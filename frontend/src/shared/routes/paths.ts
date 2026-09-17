/**
 * English routes since v1.1 (2026-09-15). Every room URL is a valid entry
 * point since 2026-09-17: `/room/:code`, `/game/:code` and `/results/:code`
 * opened without a session show the join view for that code, so the link
 * somebody copies from the URL bar works as an invitation. `/?code=XXXX` is
 * kept for the old links and redirects to `/room/XXXX`.
 */
export const PATHS = {
  home: '/',
  lobby: '/room/:code',
  game: '/game/:code',
  results: '/results/:code',
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  /** The fly's brain, opened in its own tab from the game. */
  brain: '/brain/:code',
} as const;

export const lobbyPath = (code: string) => `/room/${code}`;
export const gamePath = (code: string) => `/game/${code}`;
export const resultsPath = (code: string) => `/results/${code}`;

// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
export const brainPath = (code: string) => `/brain/${code}`;

/**
 * The brain tab is a viewer: it claims no session and rejoins no room, because
 * a second rejoin would take the player's seat in the tab that is playing
 * (docs/context/08-boss-mode.md). The app bootstrap checks this before it
 * binds anything.
 */
export const isBrainPath = (pathname: string) => pathname.startsWith('/brain/');
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.

/** The canonical invitation: the lobby URL, which is also what the URL bar shows. */
export const inviteLinkFor = (code: string) => `${window.location.origin}${lobbyPath(code)}`;

/** Which screen a room status maps to; used after rejoin and on pushed transitions. */
export const pathForStatus = (
  status: 'lobby' | 'playing' | 'between-rounds' | 'finished',
  code: string,
) => {
  switch (status) {
    case 'lobby':
      return lobbyPath(code);
    case 'playing':
      return gamePath(code);
    case 'between-rounds':
    case 'finished':
      return resultsPath(code);
  }
};
