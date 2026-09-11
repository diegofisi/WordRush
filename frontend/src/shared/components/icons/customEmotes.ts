import type { Emote } from '@/shared/contract';

/**
 * Custom emote artwork dropped into `src/assets/emotes/` (see the README there).
 * Vite resolves the files at build time; a missing file simply means "use the
 * built-in icon". Preference when several formats exist: svg, then webp, then png.
 */
const files = import.meta.glob<string>('../../../assets/emotes/*.{svg,webp,png}', {
  eager: true,
  import: 'default',
  query: '?url',
});

const PRIORITY: Record<string, number> = { svg: 0, webp: 1, png: 2 };

const byEmote = new Map<string, { url: string; rank: number }>();
for (const [path, url] of Object.entries(files)) {
  const match = /\/([a-z]+)\.(svg|webp|png)$/.exec(path);
  const name = match?.[1];
  const ext = match?.[2];
  if (!name || !ext) continue;
  const rank = PRIORITY[ext] ?? 9;
  const current = byEmote.get(name);
  if (!current || rank < current.rank) byEmote.set(name, { url, rank });
}

/** URL of the custom artwork for an emote, or null to fall back to the built-in icon. */
export const customEmoteUrl = (emote: Emote): string | null => byEmote.get(emote)?.url ?? null;
