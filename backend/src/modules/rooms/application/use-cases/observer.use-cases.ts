import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '../../domain/interfaces/room-repository.interface';

/**
 * An observer asks for a seat (docs/context/06-v1.1.md -> Observers). In the
 * lobby with a free seat they sit straight away; during a game the wish is
 * remembered and honoured when the next round starts, seats permitting.
 * Nobody is ever moved who did not ask.
 */
@Injectable()
export class SitObserverUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
  ) {}

  execute(roomCode: string, playerId: string, wants: boolean): void {
    const room = this.rooms.findByCode(roomCode);
    if (!room || !room.findAnyone(playerId)) throw new DomainException('not_in_room');
    const observer = room.findObserver(playerId);
    if (!observer) throw new DomainException('not_observer');

    observer.wantsSeat = wants;
    if (wants && room.status === 'lobby') room.seat(observer);
    room.touch(this.clock.now());
    this.bus.publish({ roomCode: room.code, event: 'lobby:update', payload: room.toLobbyState() });
  }
}
