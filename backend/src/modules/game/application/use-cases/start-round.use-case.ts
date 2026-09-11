import { Inject, Injectable, Logger } from '@nestjs/common';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { toRoundState } from '@modules/rooms/domain/services/state-presenter';
import { IWordPicker, WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';

/** Picks the word, resets every player's clock and ledger, and announces the round. */
@Injectable()
export class StartRoundUseCase {
  private readonly logger = new Logger(StartRoundUseCase.name);

  constructor(
    @Inject(WORD_PICKER) private readonly picker: IWordPicker,
    private readonly bus: RoomEventsBus,
  ) {}

  execute(room: Room, now: number): void {
    const word = this.picker.pick(room.settings.language, new Set(room.usedWords));
    room.word = word;
    room.usedWords.push(word);
    room.currentRound += 1;
    room.status = 'playing';
    room.roundStartedAt = now;
    room.solvedCount = 0;
    room.lastRoundEnd = null;
    room.nextRoundAt = null;
    room.touch(now);

    for (const player of room.players) {
      player.ready = false;
      player.round = new PlayerRound(now, room.settings.initialSeconds);
    }

    // `me` differs per player, so the payload is addressed socket by socket.
    for (const player of room.players) {
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
