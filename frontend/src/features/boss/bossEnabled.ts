/**
 * The frontend half of the boss-mode flag (`VITE_BOSS_ENABLED`, default on).
 *
 * When it is off the home option is not rendered, the brain route is not
 * registered, no boss panel is mounted and the socket never asks for frames:
 * the only trace left is the optional contract fields, which stay null.
 * docs/context/07-boss-removal.md
 */
const raw = import.meta.env.VITE_BOSS_ENABLED;

export const BOSS_ENABLED =
  raw === undefined || raw.trim() === ''
    ? true
    : !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase());
