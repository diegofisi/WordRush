import { Logger, Module, type Provider } from '@nestjs/common';
import { GameModule } from '@modules/game/game.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { WordsModule } from '@modules/words/words.module';
import { BossMemoryService } from './application/services/boss-memory.service';
import { BossTickerService } from './application/services/boss-ticker.service';
import { BossWatchersService } from './application/services/boss-watchers.service';
import { BossPlayTurnUseCase } from './application/use-cases/boss-play-turn.use-case';
import { BOSS_BRAIN, BOSS_BRAIN_STREAM } from './domain/interfaces/boss-brain.interface';
import { bossModeEnabled } from './domain/services/boss-env';
import { BrainWorkerService } from './infrastructure/brain-worker.service';
import { ConnectomeBossBrain } from './infrastructure/connectome-boss-brain';
import { BossGateway } from './presentation/boss.gateway';

/**
 * Boss mode: the room against the fly. docs/context/08-boss-mode.md
 *
 * Temporary and deliberately removable: docs/context/07-boss-removal.md.
 * The dependency arrow only ever points this way — nothing in `rooms`, `game`
 * or `gateway` imports this module — so removing boss mode is deleting this
 * folder plus the marked lines listed in the removal note.
 *
 * `BOSS_MODE_ENABLED=false` registers nothing at all: no brain threads, no
 * ticker, no socket handler. The seat is refused separately (`boss-seat.ts`),
 * so a client that asks for boss mode with the flag off simply gets a normal
 * room.
 */
const enabled = bossModeEnabled();

const providers: Provider[] = enabled
  ? [
      BrainWorkerService,
      ConnectomeBossBrain,
      // The only brain there is. When it cannot load she does not move; a
      // hand-written policy standing in for it would be an algorithm playing
      // the game (docs/context/08-boss-mode.md).
      { provide: BOSS_BRAIN, useExisting: ConnectomeBossBrain },
      { provide: BOSS_BRAIN_STREAM, useExisting: BrainWorkerService },
      BossMemoryService,
      BossWatchersService,
      BossPlayTurnUseCase,
      BossTickerService,
      BossGateway,
    ]
  : [];

@Module({
  imports: [RoomsModule, GameModule, WordsModule],
  providers,
})
export class BossModule {
  constructor() {
    if (!enabled) {
      new Logger(BossModule.name).log('Boss mode is off (BOSS_MODE_ENABLED=false)');
    }
  }
}
