import { Module } from '@nestjs/common';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { WordsModule } from '@modules/words/words.module';
import { RoomTickerService } from './application/services/room-ticker.service';
import { RoundLifecycleService } from './application/services/round-lifecycle.service';
import { RoundSchedulerService } from './application/services/round-scheduler.service';
import { EndRoundUseCase } from './application/use-cases/end-round.use-case';
import { StartGameUseCase } from './application/use-cases/start-game.use-case';
import { StartRoundUseCase } from './application/use-cases/start-round.use-case';
import { SubmitGuessUseCase } from './application/use-cases/submit-guess.use-case';
import { TickRoomsUseCase } from './application/use-cases/tick-rooms.use-case';
import { UseHintUseCase } from './application/use-cases/use-hint.use-case';

@Module({
  imports: [RoomsModule, WordsModule],
  providers: [
    RoundSchedulerService,
    RoundLifecycleService,
    RoomTickerService,
    StartRoundUseCase,
    StartGameUseCase,
    EndRoundUseCase,
    TickRoomsUseCase,
    SubmitGuessUseCase,
    UseHintUseCase,
  ],
  exports: [StartGameUseCase, SubmitGuessUseCase, UseHintUseCase],
})
export class GameModule {}
