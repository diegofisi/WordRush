import { Inject, Injectable, Logger } from '@nestjs/common';
import { BOSS } from '@shared/contract';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  HINT_PORT,
  ROUND_BOOKKEEPING,
  type IHintPort,
  type IRoundBookkeeping,
} from '@modules/game/domain/interfaces/round-bookkeeping.interface';
import { applyBossGuessRow } from '../../domain/services/boss-guess';
import type { Player } from '@modules/rooms/domain/entities/player.entity';
import type { Room } from '@modules/rooms/domain/entities/room.entity';
import { IWordList, WORD_LIST } from '@modules/words/domain/interfaces/word-list.interface';
import {
  BOSS_BRAIN,
  type BossSituation,
  type IBossBrain,
} from '../../domain/interfaces/boss-brain.interface';
import { candidatesFrom, drawCandidates } from '../../domain/services/boss-solver';
import { ALPHABET, scoreWord } from '../../domain/services/letter-readout';
import type { LetterState, SlotState } from '../../domain/services/boss-wiring';
import { BossMemoryService, type BossMemory } from '../services/boss-memory.service';

/**
 * How long a turn takes her, in wall milliseconds.
 *
 * These numbers are the balance of the whole mode, not decoration.
 *
 * Measured on 2026-09-13 over ten random words: at ~5 s a turn she finished a
 * round in 7 to 24 seconds while a human takes 30 to 90. The two never
 * overlapped, so the team's damage always landed after she was already done and
 * no clock setting could make the fight real. A turn now costs 12 to 23 s, which
 * puts her finish inside the window where humans actually solve
 * (docs/context/08-boss-mode.md).
 */
export const BOSS_CADENCE = {
  /**
   * How long a turn takes her, drawn uniformly between these two, counted from
   * the tick that starts it.
   *
   * The biology is 960 ms of simulated brain per decision; what costs about
   * seven seconds of wall time is simulating it, 138,639 neurons at 0.1 ms
   * steps. Those seconds are inside this value, so anything below them is
   * the floor: with 3 s the next turn starts the moment the brain answers,
   * with 6 s it waits 2 s more. A word every 7 to 9 s. It was raised to
   * 10–15 s on 2026-09-14 after a round where she solved by her third word,
   * and put back on 2026-09-15 once that round was measured to be luck
   * (13.5 % of rounds; the typical solve is the 4th or 5th word). Pacing
   * is not help; it is reaction time.
   */
  thinkMinMs: 3000,
  thinkMaxMs: 6000,
  /**
   * She types the word out rather than submitting it instantly. 450 since
   * 2026-09-15, a quarter less than the 600 it was, with the read-out window
   * shortened by the same quarter: the "+25 %" balance pass.
   */
  typeMsPerLetter: 450,
  /** How soon to look again when the brain has not answered at all. */
  retryMs: 1500,
} as const;

/**
 * One turn of the fly. She plays through the same round object, the same time
 * ledger and the same solve announcement as a human; the two differences are
 * the ones the rules call for (docs/context/08-boss-mode.md): she earns no time
 * from letters, and her solve damages humans instead of her teammates.
 */
@Injectable()
export class BossPlayTurnUseCase {
  private readonly logger = new Logger(BossPlayTurnUseCase.name);
  /** So a brain that never comes up says so once instead of every 200 ms. */
  private warnedSilent = false;

  constructor(
    @Inject(WORD_LIST) private readonly wordList: IWordList,
    @Inject(BOSS_BRAIN) private readonly brain: IBossBrain,
    @Inject(ROUND_BOOKKEEPING) private readonly rounds: IRoundBookkeeping,
    @Inject(HINT_PORT) private readonly hints: IHintPort,
    private readonly memory: BossMemoryService,
    private readonly bus: RoomEventsBus,
  ) {}

  /** Returns true when she actually acted. Awaits the brain on its own thread. */
  async execute(room: Room, bot: Player, now: number): Promise<boolean> {
    const round = bot.round;
    const answer = room.word;
    if (!round || !answer || round.finished) return false;

    /*
     * Every word a player may type, not the 870 the answer is drawn from.
     *
     * Choosing from the answer list was a 92% cut of the search space handed to
     * her for nothing: every word she played could be the answer, while a human
     * spends attempts on words that never could be. Same keyboard, same
     * dictionary, same odds (docs/context/08-boss-mode.md, 2026-09-13).
     */
    const pool = this.wordList.guessable(room.settings.language, BOSS.wordLength);
    const memory = this.memory.forRound(room.code, room.currentRound, now);
    if (now < memory.nextMoveAt || memory.thinking) return false;

    // Half a second of brain is long enough for the ticker to come round again.
    memory.thinking = true;
    let decision;
    try {
      decision = await this.brain.decide(this.situationOf(room, round, memory));
    } finally {
      memory.thinking = false;
    }
    // The round can end while she is thinking.
    if (round.finished || room.status !== 'playing' || room.word !== answer) return false;

    // No brain, no move. There used to be a hand-written policy standing in for
    // her here, which meant a broken worker was invisible and an algorithm was
    // quietly playing the game. Standing still is the honest failure.
    if (!decision.letterPreference) {
      if (!this.warnedSilent) {
        this.warnedSilent = true;
        this.logger.warn('The brain did not answer; the fly will not move until it does');
      }
      memory.nextMoveAt = now + BOSS_CADENCE.retryMs;
      return false;
    }

    /*
     * Her hint. The readout asks for it; the rules answer.
     *
     * The room may have hints switched off and she may have spent hers already,
     * exactly as for a human — she presses a button that is sometimes not there.
     * What comes back is a letter she now perceives as present, reaching her
     * through the same channel her own greens and yellows use. It narrows no
     * list, because she has no list.
     */
    let hintSpent = false;
    if (decision.hintWant > 0.5 && room.settings.hintEnabled && !round.hintUsed) {
      const reveal = this.hints.reveal(room.code, bot.id);
      if (reveal) {
        memory.hint = { letter: reveal.letter, position: reveal.position };
        hintSpent = true;
      }
    }

    const announce = (typing: string) =>
      this.bus.publish({
        roomCode: room.code,
        event: 'boss:decision',
        payload: {
          playerId: bot.id,
          action: 'guess',
          confidence: Math.round(decision.confidence * 100) / 100,
          hintWant: Math.round(decision.hintWant * 100) / 100,
          hintSpent,
          attempt: round.attempt,
          letters: preferenceToLetters(decision.letterPreference),
          brain: decision.rates.length > 0,
          biologicalMs: decision.biologicalMs,
          wallMs: decision.wallMs,
          telemetry: decision.telemetry,
          typing,
        },
      });

    /*
     * Her move, and the one thing the game does for her.
     *
     * The game strikes out every word that contradicts the colours on her board
     * (`candidatesFrom`), because deduction is what a fly brain cannot do and
     * what a human does in their head. From what survives it draws
     * BOSS.candidates at random — uniformly, so nothing here prefers one word
     * over another — and her readout chooses among those. That choice is hers,
     * and it is the only part of the turn that is.
     *
     * Measured on 2026-09-14 and recorded in docs/context/09-what-the-fly-can-do.md:
     * without the filter she cannot converge at all (0 of 30 rounds), and with
     * it a random choice already wins 98.6% of rounds in 8 attempts. She gets
     * BOSS.maxAttempts, more than a human's 8, uncharged; the round the team
     * plays is against her clock. The filter is declared on her panel in as
     * many words.
     */
    const compatible = candidatesFrom(pool, round.rows, memory.hint).filter(
      (candidate) => !memory.played.has(candidate),
    );
    const shown =
      compatible.length > 0
        ? drawCandidates(compatible, BOSS.candidates, memory.random)
        : // Nothing agrees with her board, which means a row contradicts the
          // answer and something upstream is broken. She still moves.
          drawCandidates(
            pool.filter((w) => !memory.played.has(w)),
            BOSS.candidates,
            memory.random,
          );
    if (compatible.length === 0) {
      this.logger.warn(
        `Room ${room.code}: no word matches the fly's own rows; drawing from the pool`,
      );
    }
    const word = bestMatch(shown, decision.letterPreference);

    announce(word);
    this.guess(room, bot, word, answer, memory, now);

    // A pace with a spread in it and nothing else. It used to be scaled by the
    // policy's confidence, and that confidence was invented by the policy, so
    // the timing was telling the room something no neuron had said. The draw
    // comes from the round's own generator, so a replayed round paces the same.
    const think =
      BOSS_CADENCE.thinkMinMs +
      memory.random() * (BOSS_CADENCE.thinkMaxMs - BOSS_CADENCE.thinkMinMs);
    memory.nextMoveAt = now + think + BOSS_CADENCE.typeMsPerLetter * word.length;
    return true;
  }

  private situationOf(
    room: Room,
    round: NonNullable<Player['round']>,
    memory: BossMemory,
  ): BossSituation {
    return {
      slots: slotsOf(round),
      letters: lettersOf(round, memory.hint?.letter ?? null),
      seed: (room.currentRound * 1_000_003 + round.attempt * 7919 + room.code.charCodeAt(0)) >>> 0,
    };
  }

  private guess(
    room: Room,
    bot: Player,
    word: string,
    answer: string,
    memory: BossMemory,
    now: number,
  ): void {
    const round = bot.round;
    if (!round) return;

    applyBossGuessRow(round, word, answer, BOSS.earnsTimeFromLetters);
    memory.played.add(word);
    room.touch(now);

    const solved = word === answer;
    if (solved) {
      room.solvedCount += 1;
      round.markSolved(room.solvedCount, now);
    } else if (round.attempt >= BOSS.maxAttempts) {
      round.finish('attempts', now);
    }

    this.rounds.publishProgress(room, bot, now);
    if (solved) this.rounds.announceSolve(room, bot, now);
    this.rounds.endRoundIfOver(room, now);

    this.logger.debug(`Room ${room.code}: fly played ${word} on attempt ${round.attempt}`);
  }
}

/** What her own board looks like: one colour per slot, as the brain sees it. */
function slotsOf(round: NonNullable<Player['round']>): SlotState[] {
  const slots: SlotState[] = Array.from<SlotState>({ length: BOSS.wordLength }).fill('unknown');
  for (const row of round.rows) {
    for (let i = 0; i < row.colors.length; i += 1) {
      const colour = row.colors[i];
      if (colour === 'green') slots[i] = 'green';
      else if (slots[i] !== 'green') slots[i] = colour === 'yellow' ? 'yellow' : 'gray';
    }
  }
  return slots;
}

/** Her keyboard: what every letter she has spent turned out to be. */
function lettersOf(
  round: NonNullable<Player['round']>,
  hintLetter: string | null,
): [string, LetterState][] {
  const state = new Map<string, LetterState>();
  // A hint is perceived, not deduced: the letter it named is one she now knows
  // is in the word, and it reaches her through the same channel her own yellows
  // and greens do.
  if (hintLetter) state.set(hintLetter, 'present');
  for (const row of round.rows) {
    for (let i = 0; i < row.colors.length; i += 1) {
      const letter = row.word[i];
      if (row.colors[i] === 'gray') {
        if (!state.has(letter)) state.set(letter, 'absent');
      } else {
        state.set(letter, 'present');
      }
    }
  }
  return [...state];
}

/**
 * The legal word that best spends the letters her brain asked for. `legal` is
 * already filtered: it never holds a word she has played.
 */
function bestMatch(legal: readonly string[], preference: Float32Array): string {
  let best = legal[0];
  let bestScore = -Infinity;
  for (const word of legal) {
    const score = scoreWord(word, preference);
    if (score > bestScore) {
      bestScore = score;
      best = word;
    }
  }
  return best;
}

/** The letters she wants most this turn, for the room to see. */
function preferenceToLetters(preference: Float32Array | null): string[] {
  if (!preference) return [];
  return [...preference]
    .map((value, index) => ({ value, letter: ALPHABET[index] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((entry) => entry.letter.toUpperCase());
}
