import type { BossViewModel } from '../models/boss-view.model';

/**
 * The link between the game tab and the brain tab.
 *
 * The brain lives on its own route, so it runs in a second tab. That tab must
 * not open its own socket: rejoining a room from a second socket takes the seat
 * away from the first one (`session:replaced`, see the gateway's session
 * registry), which would knock the player out of the game they are watching.
 *
 * So the game tab stays the only socket, and it relays the fly's state over a
 * BroadcastChannel. The brain tab is a pure viewer; when nobody is viewing, the
 * game tab stops asking the server for frames.
 */

export const BOSS_CHANNEL = 'wordrush.boss';

/**
 * Every message carries its room: one browser can hold several games at once
 * (a few tabs, a few players), and they all share this channel. Both ends drop
 * anything addressed to a room that is not theirs.
 */
export type BossChannelMessage =
  /** Game tab -> viewers: the fly as she stands right now. */
  | { kind: 'state'; roomCode: string; boss: BossViewModel | null }
  /** Viewer -> game tab: I am here (or leaving). Drives the server stream. */
  | { kind: 'viewer'; roomCode: string; open: boolean }
  /** Viewer -> game tab: I just loaded, send me the state you have. */
  | { kind: 'hello'; roomCode: string };

/** `null` where the browser has no BroadcastChannel; callers degrade quietly. */
export function openBossChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(BOSS_CHANNEL);
}
