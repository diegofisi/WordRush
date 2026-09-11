export const PATHS = {
  home: '/',
  lobby: '/sala/:code',
  game: '/juego/:code',
  results: '/resultados/:code',
} as const;

export const lobbyPath = (code: string) => `/sala/${code}`;
export const gamePath = (code: string) => `/juego/${code}`;
export const resultsPath = (code: string) => `/resultados/${code}`;
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
