import { Inject, Injectable, Logger } from '@nestjs/common';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { PhraseProgress } from '@modules/rooms/domain/entities/phrase-progress.entity';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { TeamRound } from '@modules/rooms/domain/entities/team.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { toRoundState } from '@modules/rooms/domain/services/state-presenter';
import { IPhraseBank, PHRASE_BANK } from '@modules/words/domain/interfaces/phrase-bank.interface';
import { IWordPicker, WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import { parsePhrase } from '../../domain/services/phrase';

/** Picks the word, resets every player's clock and ledger, and announces the round. */
@Injectable()
export class StartRoundUseCase {
  private readonly logger = new Logger(StartRoundUseCase.name);

  constructor(
    @Inject(WORD_PICKER) private readonly picker: IWordPicker,
    @Inject(PHRASE_BANK) private readonly phrases: IPhraseBank,
    private readonly bus: RoomEventsBus,
  ) {}

  execute(room: Room, now: number): void {
    const { language, wordLength, initialSeconds, game } = room.settings;
    // Observers who asked for a seat get one now, while seats last; the
    // roster everybody holds must know before the boards appear.
    if (room.seatWaitingObservers().length > 0) {
      this.bus.publish({
        roomCode: room.code,
        event: 'lobby:update',
        payload: room.toLobbyState(),
      });
    }
    if (game === 'phrase') {
      const text = this.phrases.pick(language, new Set(room.usedPhrases));
      room.usedPhrases.push(text);
      room.phrase = parsePhrase(text);
      room.word = null;
    } else {
      const word = this.picker.pick(language, wordLength, new Set(room.usedWords));
      room.word = word;
      room.usedWords.push(word);
      room.phrase = null;
    }
    room.currentRound += 1;
    room.status = 'playing';
    room.roundStartedAt = now;
    room.solvedCount = 0;
    room.lastRoundEnd = null;
    room.nextRoundAt = null;
    room.touch(now);

    // Team mode: one clock, ledger and hint per team, shared by its members.
    for (const team of room.teams) {
      team.round = new TeamRound(now, initialSeconds, wordLength);
      if (game === 'phrase') team.round.phrase = new PhraseProgress();
    }
    for (const player of room.players) {
      player.ready = false;
      const team = room.teamOf(player);
      player.round = new PlayerRound(now, initialSeconds, wordLength, team?.round ?? null);
      if (game === 'phrase' && !team) player.round.ownPhrase = new PhraseProgress();
    }

    // `me` differs per player, so the payload is addressed socket by socket.
    // Observers get the same boards with a neutral `me`.
    for (const player of room.everyone) {
      if (!player.connected) continue;
      this.bus.publish({
        roomCode: room.code,
        toPlayerId: player.id,
        event: 'round:start',
        payload: toRoundState(room, player, now),
      });
    }
    this.logger.log(
      `Room ${room.code}: round ${room.currentRound}/${room.settings.rounds} started with ${room.players.length} players`,
    );
  }
}
