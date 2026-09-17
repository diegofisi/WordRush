import { Module } from '@nestjs/common';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { WordsModule } from '@modules/words/words.module';
import { RoomTickerService } from './application/services/room-ticker.service';
import { RoundLifecycleService } from './application/services/round-lifecycle.service';
import { RoundSchedulerService } from './application/services/round-scheduler.service';
import { EndRoundUseCase } from './application/use-cases/end-round.use-case';
import { SettleRoundUseCase } from './application/use-cases/settle-round.use-case';
import { StartGameUseCase } from './application/use-cases/start-game.use-case';
import { StartRoundUseCase } from './application/use-cases/start-round.use-case';
import { SubmitGuessUseCase } from './application/use-cases/submit-guess.use-case';
import { SubmitPhraseUseCase } from './application/use-cases/submit-phrase.use-case';
import { TickRoomsUseCase } from './application/use-cases/tick-rooms.use-case';
import { UseHintUseCase } from './application/use-cases/use-hint.use-case';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
import { HintPortAdapter } from './application/services/hint-port.adapter';
import { HINT_PORT, ROUND_BOOKKEEPING } from './domain/interfaces/round-bookkeeping.interface';

@Module({
  imports: [RoomsModule, WordsModule],
  providers: [
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
    HintPortAdapter,
    { provide: ROUND_BOOKKEEPING, useExisting: RoundLifecycleService },
    { provide: HINT_PORT, useExisting: HintPortAdapter },
    RoundSchedulerService,
    RoundLifecycleService,
    RoomTickerService,
    StartRoundUseCase,
    StartGameUseCase,
    EndRoundUseCase,
    TickRoomsUseCase,
    SubmitGuessUseCase,
    SubmitPhraseUseCase,
    UseHintUseCase,
    SettleRoundUseCase,
  ],
  exports: [
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
    ROUND_BOOKKEEPING,
    HINT_PORT,
    StartGameUseCase,
    SubmitGuessUseCase,
    SubmitPhraseUseCase,
    UseHintUseCase,
    SettleRoundUseCase,
  ],
})
export class GameModule {}
