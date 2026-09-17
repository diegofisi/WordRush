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
} as const;

export const lobbyPath = (code: string) => `/room/${code}`;
export const gamePath = (code: string) => `/game/${code}`;
export const resultsPath = (code: string) => `/results/${code}`;

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
