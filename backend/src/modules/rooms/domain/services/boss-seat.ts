import { randomBytes, randomUUID } from 'node:crypto';
import { BOSS } from '@shared/contract';
import { Player } from '../entities/player.entity';
import type { Room } from '../entities/room.entity';

/**
 * The fly's seat. She is an ordinary `Player` so that progress broadcasts,
 * the penalty loop and the scoring table all treat her like anybody else;
 * `isBot` is what the few deliberate exceptions key off.
 * Rules: docs/context/06-boss-mode.md
 */
export function createBossSeat(now: number): Player {
  return Player.create({
    id: randomUUID(),
    // She has no client, so the token is never handed out. It exists only so
    // the shape stays uniform and a stray rejoin can never match it.
    token: randomBytes(24).toString('base64url'),
    name: BOSS.name,
    isHost: false,
    joinedAt: now,
    isBot: true,
  });
}

/** Adds or removes the fly so the room matches its `bossMode` setting. */
export function syncBossSeat(room: Room, now: number): void {
  const seated = room.bot;
  if (room.settings.bossMode && !seated) {
    room.addPlayer(createBossSeat(now));
  } else if (!room.settings.bossMode && seated) {
    room.removePlayer(seated.id);
  }
}
