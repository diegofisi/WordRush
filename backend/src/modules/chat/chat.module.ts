import { Module } from '@nestjs/common';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { ChatHistoryUseCase } from './application/use-cases/chat-history.use-case';
import { SendChatUseCase } from './application/use-cases/send-chat.use-case';

@Module({
  imports: [RoomsModule],
  providers: [SendChatUseCase, ChatHistoryUseCase],
  exports: [SendChatUseCase, ChatHistoryUseCase],
})
export class ChatModule {}
