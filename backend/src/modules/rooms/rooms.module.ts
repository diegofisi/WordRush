import { Module } from '@nestjs/common';
import { MAX_ROOMS, parseMaxRooms } from '@shared/config/env';
import { RoomJanitorService } from './application/services/room-janitor.service';
import { CreateRoomUseCase } from './application/use-cases/create-room.use-case';
import { EnsureNotInRoomUseCase } from './application/use-cases/ensure-not-in-room.use-case';
import { JoinRoomUseCase } from './application/use-cases/join-room.use-case';
import { LeaveRoomUseCase } from './application/use-cases/leave-room.use-case';
import { MarkDisconnectedUseCase } from './application/use-cases/mark-disconnected.use-case';
import { SitObserverUseCase } from './application/use-cases/observer.use-cases';
import { RejoinRoomUseCase } from './application/use-cases/rejoin-room.use-case';
import { RestartRoomUseCase } from './application/use-cases/restart-room.use-case';
import { SetReadyUseCase } from './application/use-cases/set-ready.use-case';
import {
  AssignTeamUseCase,
  CustomizeTeamUseCase,
  JoinTeamUseCase,
  ResetTeamGamesUseCase,
} from './application/use-cases/team.use-cases';
import { UpdateRoomSettingsUseCase } from './application/use-cases/update-room-settings.use-case';
import { ROOM_REPOSITORY } from './domain/interfaces/room-repository.interface';
import { InMemoryRoomRepository } from './infrastructure/repositories/in-memory-room.repository';

@Module({
  providers: [
    { provide: ROOM_REPOSITORY, useClass: InMemoryRoomRepository },
    { provide: MAX_ROOMS, useFactory: () => parseMaxRooms(process.env.MAX_ROOMS) },
    RoomJanitorService,
    CreateRoomUseCase,
    JoinRoomUseCase,
    RejoinRoomUseCase,
    SetReadyUseCase,
    JoinTeamUseCase,
    AssignTeamUseCase,
    CustomizeTeamUseCase,
    ResetTeamGamesUseCase,
    SitObserverUseCase,
    UpdateRoomSettingsUseCase,
    RestartRoomUseCase,
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
    UpdateRoomSettingsUseCase,
    RestartRoomUseCase,
    LeaveRoomUseCase,
    MarkDisconnectedUseCase,
    EnsureNotInRoomUseCase,
    JoinTeamUseCase,
    AssignTeamUseCase,
    CustomizeTeamUseCase,
    ResetTeamGamesUseCase,
    SitObserverUseCase,
  ],
})
export class RoomsModule {}
