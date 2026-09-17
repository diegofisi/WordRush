// BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
import type { HintReveal } from '@shared/contract';
import type { Player } from '@modules/rooms/domain/entities/player.entity';
import type { Room } from '@modules/rooms/domain/entities/room.entity';

export const ROUND_BOOKKEEPING = Symbol('ROUND_BOOKKEEPING');

/**
 * The round bookkeeping an optional mode is allowed to drive.
 *
 * It exists so boss mode can move a seat through a round without reaching into
 * this module's application layer (the architecture boundaries forbid that
 * import anyway): the fly's turns take exactly the path a human guess takes,
 * so the time hit, the progress broadcast and the end-of-round check can never
 * drift apart. Delete this file with the rest of boss mode.
 */
export interface IRoundBookkeeping {
  /** `player:progress` for one seat. */
  publishProgress(room: Room, player: Player, now: number): void;
  /** `player:solved` and the time hit it causes. */
  announceSolve(room: Room, player: Player, now: number): void;
  /** Closes the round when every seat is finished. */
  endRoundIfOver(room: Room, now: number): boolean;
}

export const HINT_PORT = Symbol('HINT_PORT');

/**
 * Spending a seat's one hint. Returns null when the room refuses it (hints
 * disabled, already used, round over) instead of throwing, because the caller
 * is a policy deciding whether to try, not a player being told off.
 */
export interface IHintPort {
  reveal(roomCode: string, playerId: string): HintReveal | null;
}
