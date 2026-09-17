import { randomBytes, randomUUID } from 'node:crypto';
import { BOSS } from '@shared/contract';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import type { Room } from '@modules/rooms/domain/entities/room.entity';
import { bossModeEnabled } from './boss-env';

/**
 * The fly's seat. She is an ordinary `Player` so that progress broadcasts,
 * the penalty loop and the scoring table all treat her like anybody else;
 * `isBot` is what the few deliberate exceptions key off.
 * Rules: docs/context/08-boss-mode.md
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

/**
 * Whether this room may actually run boss mode.
 *
 * Her brain is wired for a five-letter Wordle board and her readout was
 * trained on one, so the phrase game, team mode and the 6/7-letter boards are
 * out. Asking for boss mode in one of those simply gets a room without her.
 */
export function bossPlayable(room: Room): boolean {
  const s = room.settings;
  return (
    bossModeEnabled() &&
    s.bossMode === true &&
    s.game === 'wordle' &&
    s.mode === 'normal' &&
    s.wordLength === BOSS.wordLength
  );
}

/** Adds or removes the fly so the room matches its `bossMode` setting. */
export function syncBossSeat(room: Room, now: number): void {
  const seated = room.bot;
  if (bossPlayable(room)) {
    if (!seated) room.addPlayer(createBossSeat(now));
    return;
  }
  if (seated) room.removePlayer(seated.id);
  // The room is not playing against her after all; stop claiming it is, so the
  // lobby, the clients and the round all read the same thing.
  if (room.settings.bossMode) room.settings.bossMode = false;
}
