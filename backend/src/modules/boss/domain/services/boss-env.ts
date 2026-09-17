/**
 * Boss mode's own environment reading, so the shared config file never learns
 * that the fly exists. docs/context/07-boss-removal.md
 */

/**
 * `BOSS_MODE_ENABLED`. Default **true** for now: the mode ships on while the
 * owner decides whether to keep it. Set it to `false`/`0`/`off` and no boss
 * provider is constructed, no seat is ever created and the events are dead.
 */
export function bossModeEnabled(raw: string | undefined = process.env.BOSS_MODE_ENABLED): boolean {
  if (raw === undefined || raw.trim() === '') return true;
  return !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase());
}

/**
 * Brain threads of one kind (`BOSS_DECIDERS`, `BOSS_STREAMS`). Each holds a
 * copy of the connectome, about 90 MB, so the range is deliberately small.
 */
export function parseThreadCount(raw: string | undefined, fallback: number): number {
  const count = Number(raw);
  return Number.isInteger(count) && count >= 1 && count <= 8 ? count : fallback;
}
