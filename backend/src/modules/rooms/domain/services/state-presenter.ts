import { attemptsFor, PHRASE_RULES } from '@shared/contract';
import type {
  FullState,
  PlayerProgress,
  RoundEndPayload,
  RoundState,
  SelfState,
  TeammateRows,
  TeamRoundState,
} from '@shared/contract';
import type { ParsedPhrase } from '@modules/game/domain/services/phrase';
import {
  foundCount,
  phraseLetters,
  phraseMask,
  phraseShape,
} from '@modules/game/domain/services/phrase';
import type { PhraseProgress as PhraseProgressEntity } from '../entities/phrase-progress.entity';
import type { Player } from '../entities/player.entity';
import type { Room } from '../entities/room.entity';
import type { Team } from '../entities/team.entity';

/**
 * Pure mappers from the aggregate to the contract shapes. Colours only for
 * rivals, letters only in the caller's own `SelfState`, never the word.
 */
function toPhraseSelf(phrase: ParsedPhrase | null, progress: PhraseProgressEntity | null) {
  if (!phrase || !progress) return null;
  return {
    letters: phraseLetters(phrase, progress.found),
    found: foundCount(phrase, progress.found),
    total: phrase.total,
    sendsUsed: progress.sendsUsed,
    completed: progress.completed,
  };
}

function toPhraseProgress(phrase: ParsedPhrase | null, progress: PhraseProgressEntity | null) {
  if (!phrase || !progress) return null;
  return {
    mask: phraseMask(phrase, progress.found),
    found: foundCount(phrase, progress.found),
    total: phrase.total,
    sendsUsed: progress.sendsUsed,
    completed: progress.completed,
  };
}

export function toPlayerProgress(
  player: Player,
  now: number,
  phrase: ParsedPhrase | null = null,
): PlayerProgress {
  const round = player.round;
  return {
    playerId: player.id,
    rows: round ? round.rows.map((r) => [...r.colors]) : [],
    attempt: round?.attempt ?? 0,
    secondsLeft: round?.secondsLeft(now) ?? 0,
    at: now,
    solved: round?.solved ?? false,
    solvedPosition: round?.solvedPosition ?? null,
    finished: round?.finished ?? false,
    greens: round?.greens ?? 0,
    yellows: round?.yellows ?? 0,
    penaltySeconds: round?.penaltySeconds ?? 0,
    phrase: toPhraseProgress(phrase, round?.phrase ?? null),
  };
}

export function toSelfState(
  player: Player,
  now: number,
  phrase: ParsedPhrase | null = null,
): SelfState {
  const round = player.round;
  return {
    rows: round ? round.rows.map((r) => ({ word: r.word, colors: [...r.colors] })) : [],
    secondsLeft: round?.secondsLeft(now) ?? 0,
    at: now,
    solved: round?.solved ?? false,
    finished: round?.finished ?? false,
    hintUsed: round?.hintUsed ?? false,
    hint: round?.hint ? { ...round.hint } : null,
    penaltySeconds: round?.penaltySeconds ?? 0,
    phrase: toPhraseSelf(phrase, round?.phrase ?? null),
  };
}

export function toTeamRoundState(
  team: Team,
  now: number,
  phrase: ParsedPhrase | null = null,
): TeamRoundState {
  const round = team.round;
  return {
    id: team.id,
    secondsLeft: round?.secondsLeft(now) ?? 0,
    at: now,
    solved: round?.solved ?? false,
    solvedPosition: round?.solvedPosition ?? null,
    solverId: round?.solverId ?? null,
    finished: round?.finished ?? false,
    hintUsed: round?.hintUsed ?? false,
    penaltySeconds: round?.penaltySeconds ?? 0,
    attemptsAfterFirst: round?.attemptsAfterFirst ?? 0,
    phrase: toPhraseProgress(phrase, round?.phrase ?? null),
  };
}

/** A teammate's board with letters: only teammates ever receive this. */
export function toTeammateRows(player: Player, phrase: ParsedPhrase | null = null): TeammateRows {
  return {
    playerId: player.id,
    rows: player.round
      ? player.round.rows.map((r) => ({ word: r.word, colors: [...r.colors] }))
      : [],
    phrase: toPhraseSelf(phrase, player.round?.phrase ?? null),
  };
}

/** What an observer gets as `me`: nothing to type, nothing running. */
function observerSelf(room: Room, now: number): SelfState {
  return {
    rows: [],
    secondsLeft: 0,
    at: now,
    solved: false,
    finished: true,
    hintUsed: false,
    hint: null,
    penaltySeconds: 0,
    phrase: null,
  };
}

export function toRoundState(room: Room, player: Player, now: number): RoundState {
  const teammates =
    player.team === null || player.isObserver
      ? []
      : room
          .members(player.team)
          .filter((p) => p.id !== player.id)
          .map((p) => toTeammateRows(p, room.phrase));
  return {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    mode: room.settings.mode,
    game: room.settings.game,
    phraseWords: room.phrase ? phraseShape(room.phrase) : null,
    wordLength: room.settings.wordLength,
    // Phrase game: six words a round, whatever the length.
    maxAttempts:
      room.settings.game === 'phrase' ? PHRASE_RULES.words : attemptsFor(room.settings.wordLength),
    initialSeconds: room.settings.initialSeconds,
    startedAt: room.roundStartedAt,
    // No hint in the phrase game: every green already reveals a letter.
    hintAvailable: room.settings.hintEnabled && room.settings.game === 'wordle',
    role: player.role,
    me: player.isObserver ? observerSelf(room, now) : toSelfState(player, now, room.phrase),
    players: room.players.map((p) => toPlayerProgress(p, now, room.phrase)),
    teams: room.teams.map((team) => toTeamRoundState(team, now, room.phrase)),
    myTeam: player.isObserver ? null : player.team,
    teammates,
  };
}

/**
 * The stored payload carries the countdown as it was when the round ended. A
 * client arriving later (rejoin after a reload) must get what is *left*, or its
 * countdown restarts from the full 12 s. Never 0 while a round is still coming:
 * the contract reserves 0 for "the game ended".
 */
function withRemainingCountdown(
  payload: RoundEndPayload,
  room: Room,
  now: number,
): RoundEndPayload {
  if (room.status !== 'between-rounds' || room.nextRoundAt === null) return payload;
  return { ...payload, nextRoundIn: Math.max(1, Math.ceil((room.nextRoundAt - now) / 1000)) };
}

export function toFullState(room: Room, player: Player, now: number): FullState {
  const hasRound = room.status === 'playing' || room.status === 'between-rounds';
  const showLastEnd = room.status === 'between-rounds' || room.status === 'finished';
  const lastRoundEnd =
    showLastEnd && room.lastRoundEnd ? withRemainingCountdown(room.lastRoundEnd, room, now) : null;
  return {
    role: player.role,
    lobby: room.toLobbyState(),
    round: hasRound && (player.round || player.isObserver) ? toRoundState(room, player, now) : null,
    lastRoundEnd,
  };
}
