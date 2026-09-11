# Custom emotes

Drop your own artwork here and the game uses it instead of the built-in stroke icons.
No code changes needed: the files are discovered at build time by name.

## File names

One file per emote, named exactly like the emote id in the contract:

| Emote id | File name (pick one format) |
|---|---|
| `smile`  | `smile.svg` · `smile.png` · `smile.webp` |
| `laugh`  | `laugh.svg` · `laugh.png` · `laugh.webp` |
| `angry`  | `angry.svg` · `angry.png` · `angry.webp` |
| `cry`    | `cry.svg` · `cry.png` · `cry.webp` |
| `shock`  | `shock.svg` · `shock.png` · `shock.webp` |
| `thumbs` | `thumbs.svg` · `thumbs.png` · `thumbs.webp` |

Any emote without a file here keeps the default icon, so you can replace them one at a
time. If the same emote has several formats, `svg` wins, then `webp`, then `png`.

## Recommended format

- **SVG** with a square `viewBox` (for example `0 0 64 64`), no fixed `width`/`height`,
  shapes with their own fills (the game does not recolour custom art).
- Raster fallback: **PNG or WebP, 128×128 px** with a transparent background. The game
  shows emotes between 15 and 24 px (bar, feed, bubble over the avatar), so 128 px stays
  crisp on high-density screens.
- Keep each file under ~20 KB; every file here ships in the client bundle.

## Where they appear

The emote bar under the keyboard, the bubble over a rival's avatar when they react, and
the live feed line. All three go through `EmoteIcon` in
`src/shared/components/icons/EmoteIcon.tsx`, which reads this folder through
`src/shared/components/icons/customEmotes.ts`.

To add a NEW emote (not just replace art) you also have to add its id to `EMOTES` in the
contract (`backend/src/shared/contract/index.ts`, then `pnpm sync-contract`) and a label in
both i18n dictionaries.
