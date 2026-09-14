import { Injectable } from '@nestjs/common';

/**
 * Who has her brain panel open.
 *
 * Streaming the simulation costs a worker thread real CPU, so it only runs
 * while somebody is actually looking. A player who closes the panel, leaves or
 * disconnects stops paying for it.
 */
@Injectable()
export class BossWatchersService {
  private readonly byRoom = new Map<string, Set<string>>();

  set(roomCode: string, playerId: string, watching: boolean): void {
    const room = this.byRoom.get(roomCode) ?? new Set<string>();
    if (watching) room.add(playerId);
    else room.delete(playerId);
    if (room.size === 0) this.byRoom.delete(roomCode);
    else this.byRoom.set(roomCode, room);
  }

  /** Forgets a player everywhere; called when their socket goes. */
  drop(playerId: string): void {
    for (const [code, room] of this.byRoom) {
      room.delete(playerId);
      if (room.size === 0) this.byRoom.delete(code);
    }
  }

  watched(roomCode: string): boolean {
    return this.byRoom.has(roomCode);
  }

  /** The one room being watched, when exactly one is; the worker serves one at a time. */
  onlyRoom(): string | null {
    const codes = [...this.byRoom.keys()];
    return codes.length === 1 ? (codes[0] ?? null) : null;
  }
}
