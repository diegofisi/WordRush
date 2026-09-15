/** English routes since v1.1 (2026-09-15); the invite link stays `/?code=XXXX`. */
export const PATHS = {
  home: '/',
  lobby: '/room/:code',
  game: '/game/:code',
  results: '/results/:code',
} as const;

export const lobbyPath = (code: string) => `/room/${code}`;
export const gamePath = (code: string) => `/game/${code}`;
export const resultsPath = (code: string) => `/results/${code}`;
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
