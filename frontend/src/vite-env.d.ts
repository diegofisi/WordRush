/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL?: string;
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  /** `false` hides the fly entirely. Default on. */
  readonly VITE_BOSS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
