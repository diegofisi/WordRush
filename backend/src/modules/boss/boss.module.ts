import { Module } from '@nestjs/common';
import { GameModule } from '@modules/game/game.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { WordsModule } from '@modules/words/words.module';
import { BossMemoryService } from './application/services/boss-memory.service';
import { BossTickerService } from './application/services/boss-ticker.service';
import { BossWatchersService } from './application/services/boss-watchers.service';
import { BossPlayTurnUseCase } from './application/use-cases/boss-play-turn.use-case';
import { BOSS_BRAIN, BOSS_BRAIN_STREAM } from './domain/interfaces/boss-brain.interface';
import { BrainWorkerService } from './infrastructure/brain-worker.service';
import { ConnectomeBossBrain } from './infrastructure/connectome-boss-brain';

/**
 * Boss mode: the room against the fly. docs/context/06-boss-mode.md
 *
 * The dependency arrow only ever points this way. Nothing in `rooms`, `game`
 * or `gateway` imports this module, so removing boss mode is deleting this
 * folder and the line below in `app.module.ts`.
 */
@Module({
  imports: [RoomsModule, GameModule, WordsModule],
  providers: [
    BrainWorkerService,
    ConnectomeBossBrain,
    // The only brain there is. There used to be a hand-written policy behind it
    // for the seconds while the connectome loads and for a worker that fails;
    // that policy played the game, so now she simply does not move until the
    // brain answers (docs/context/06-boss-mode.md).
    { provide: BOSS_BRAIN, useExisting: ConnectomeBossBrain },
    { provide: BOSS_BRAIN_STREAM, useExisting: BrainWorkerService },
    BossMemoryService,
    BossWatchersService,
    BossPlayTurnUseCase,
    BossTickerService,
  ],
  exports: [BossWatchersService],
})
export class BossModule {}
