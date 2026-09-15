import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BossModule } from '@modules/boss/boss.module';
import { GameModule } from '@modules/game/game.module';
import { GatewayModule } from '@modules/gateway/gateway.module';
import { HealthModule } from '@modules/health/health.module';
import { ReactionsModule } from '@modules/reactions/reactions.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { WordsModule } from '@modules/words/words.module';
import { SharedModule } from '@shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedModule,
    WordsModule,
    RoomsModule,
    GameModule,
    BossModule,
    ReactionsModule,
    GatewayModule,
    HealthModule,
  ],
})
export class AppModule {}
