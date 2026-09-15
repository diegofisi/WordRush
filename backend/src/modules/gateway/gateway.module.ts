import { Module } from '@nestjs/common';
import { ChatModule } from '@modules/chat/chat.module';
import { GameModule } from '@modules/game/game.module';
import { ReactionsModule } from '@modules/reactions/reactions.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { GameGateway } from './presentation/game.gateway';
import { SessionRegistry } from './presentation/session-registry';
import { SocketRateLimiter } from './presentation/socket-rate-limiter';

@Module({
  imports: [RoomsModule, GameModule, ReactionsModule, ChatModule],
  providers: [GameGateway, SessionRegistry, SocketRateLimiter],
})
export class GatewayModule {}
