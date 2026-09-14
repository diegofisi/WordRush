export const PATHS = {
  home: '/',
  lobby: '/room/:code',
  game: '/game/:code',
  results: '/results/:code',
  /** The fly's brain, opened in its own tab from the game. */
  brain: '/brain/:code',
} as const;

export const lobbyPath = (code: string) => `/room/${code}`;
export const gamePath = (code: string) => `/game/${code}`;
export const resultsPath = (code: string) => `/results/${code}`;
export const brainPath = (code: string) => `/brain/${code}`;

/**
 * The brain tab is a viewer: it claims no session and rejoins no room, because
 * a second rejoin would take the player's seat in the tab that is playing
 * (docs/context/06-boss-mode.md). The app bootstrap checks this before it binds
 * anything.
 */
export const isBrainPath = (pathname: string) =>
  pathname.startsWith(PATHS.brain.replace('/:code', '/'));
export const homeWithCode = (code: string) => `/?code=${encodeURIComponent(code)}`;

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
