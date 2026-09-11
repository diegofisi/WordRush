import { Module } from '@nestjs/common';
import { RoomJanitorService } from './application/services/room-janitor.service';
import { CreateRoomUseCase } from './application/use-cases/create-room.use-case';
import { EnsureNotInRoomUseCase } from './application/use-cases/ensure-not-in-room.use-case';
import { JoinRoomUseCase } from './application/use-cases/join-room.use-case';
import { LeaveRoomUseCase } from './application/use-cases/leave-room.use-case';
import { MarkDisconnectedUseCase } from './application/use-cases/mark-disconnected.use-case';
import { RejoinRoomUseCase } from './application/use-cases/rejoin-room.use-case';
import { SetReadyUseCase } from './application/use-cases/set-ready.use-case';
import { ROOM_REPOSITORY } from './domain/interfaces/room-repository.interface';
import { InMemoryRoomRepository } from './infrastructure/repositories/in-memory-room.repository';

@Module({
  providers: [
    { provide: ROOM_REPOSITORY, useClass: InMemoryRoomRepository },
    RoomJanitorService,
    CreateRoomUseCase,
    JoinRoomUseCase,
    RejoinRoomUseCase,
    SetReadyUseCase,
    LeaveRoomUseCase,
    MarkDisconnectedUseCase,
    EnsureNotInRoomUseCase,
  ],
  exports: [
    ROOM_REPOSITORY,
    CreateRoomUseCase,
    JoinRoomUseCase,
    RejoinRoomUseCase,
    SetReadyUseCase,
    LeaveRoomUseCase,
    MarkDisconnectedUseCase,
    EnsureNotInRoomUseCase,
  ],
})
export class RoomsModule {}
