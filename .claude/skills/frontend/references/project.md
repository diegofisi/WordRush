# This project: WordRush web client (multiplayer Wordle)

> This file is the **project binding** for the portable frontend doctrine in
> this skill. The doctrine files speak MUI; this file says which primitives
> replace them here, what the feature map is, and where the design comes from.
> Read it first, then the workflow's doctrine files.

**Status (2026-09-11):** `frontend/` exists and follows this binding (core `session`; features `lobby`, `game`, `results`; `shared/` with tokens, i18n, primitives, icons). Where this file and the code disagree, the code wins; fix the file.

## What it is

Web client for a real-time multiplayer Wordle: create or join a room by code,
wait in a lobby, play rounds against up to 7 rivals whose boards you see in
colours only, react with emotes, and read a per-round and accumulated score
table. Desktop and phone.

Game rules, scoring and design decisions are **not** restated here:

- `docs/context/02-game-rules.md`, `docs/context/03-scoring-system.md` — what the UI must show.
- `docs/context/05-design.md` — visual direction and the link to the Claude Design canvas.
- `docs/design/*.dc.html` — the six screens (create room, lobby, game, results, mobile game, dark game) with exact colours, spacing and copy. Build from these, not from memory.

## Stack (confirmed 2026-09-11)

React **19** · TypeScript · Vite 7 · **Tailwind v4** with hand-made primitives in
`shared/components/ui` (no shadcn, no UI kit) · `lucide-react` (only for UI chrome; game
emotes are the custom SVGs from the design) · `socket.io-client` · `zustand` ·
`react-router-dom` v7. No React Query: everything is socket-driven. ESLint flat config with
`simple-import-sort` and the boundaries plugin; Prettier. No i18n library in
v1: UI strings live in one `es`/`en` dictionary object per feature, selected
by the room language.

Fonts from the design: Bricolage Grotesque (display, tiles), DM Sans (UI),
JetBrains Mono (clock and figures). Colour tokens are the hex values in
`docs/design/Main.dc.html` `<style>`; put them in `src/index.css` as CSS
variables and never hardcode hex in components.

## Doctrine → this repo (primitive mapping)

| Doctrine (MUI) | Here |
|---|---|
| `<Typography variant>` | `H1`…`H6`, `P`, `Span`, `Small` from `@/shared/components/ui/typography` |
| `<Stack>` / `<Grid>` / `<Box>` | `Stack`, `Grid`, `Box` from `@/shared/components/layout` |
| `sx` + theme `Palette` | Tailwind classes + `cn()`; colours are CSS variables in `src/index.css` |
| `CircularProgress` / `Alert` | `PageLoading`, `PageError`, `PageEmpty` in `@/shared/components/ui/` |
| MUI controls | hand-made `Button`, `Segmented`, `Toggle`, `Card`, `Input`, `Stepper`, `Avatar` in `@/shared/components/ui/` |
| Snackbar | `useToastStore` + `<Toaster>` in `@/shared/components/ui/`, called from containers only |
| Icons | `lucide-react` for chrome; `features/game/components/emotes/*.tsx` for the six game emotes |

Everything else in the doctrine (vertical slices, adapter pattern,
Container/Presentational, stores, forms, routing, conventions) applies unchanged.

## Feature map

| Kind | Path | Slices |
|---|---|---|
| **core** | `src/core/` | `session` — player identity (name, playerId, roomCode, token in `localStorage` under `wordrush.session`), the socket connection and its lifecycle |
| **features** | `src/features/` | `lobby` (create room form, join by code, waiting room), `game` (clock, board, keyboard with Ñ, rivals panel, live feed, hint, emotes, score preview), `results` (round breakdown, accumulated table, final table) |

`src/shared/`: `components/ui` (primitives, state components, typography, icons),
`components/layout` (`AppLayout`, `TopBar`), `i18n`, `stores` (ui, toast), `lib`
(`result`, `utils`), `routes`, `hooks` (`useNow`, `useMediaQuery`).

## Sanctioned facades (the only cross-slice imports)

- `@/core/session/stores/useSessionStore` — playerId, roomCode, token, name, rejoin.
- `@/core/session/lib/socket` — the single `socket.io-client` instance and the `request()`
  ack wrapper; only `api/` folders and stores may import it.
- `@/shared/i18n` (`useT`), `@/shared/stores/useUiStore` (theme + UI language),
  `@/shared/stores/useToastStore`.
- `@/shared/**` — always.

Anything else from another slice: duplicate a minimal local hook/model.

## Transport

This app is **socket-driven**. Per the doctrine's endpoint classification
(`data-flow.md`), everything that arrives as a push event is a **store-driven
endpoint** and never gets a React Query hook:

- `useLobbyStore` — `lobby:update`.
- `useGameStore` — `round:start`, `player:progress`, `player:solved`,
  `time:penalty`, `reaction:show`, `round:end`, `game:end`.

Emits go through `features/{feature}/api/{event}/` adapters
(`{event}.dto.ts` with the payload shape + `toModel` mapper for the ack, and
`use{Action}.ts` that wraps `socket.emit` with acknowledgement into a
promise). There is no React Query; the few request/response calls go through the same
`request()` ack wrapper in `core/session/lib/socket.ts`.

The full event table is in `.claude/skills/backend/references/project.md` →
Socket contract. The backend is the contract's owner; when it changes an event,
the DTO here changes in the same commit.

**Clock rule:** the store keeps `secondsLeft` + the server timestamp of the last
snapshot; a `requestAnimationFrame` ticker only *renders* the countdown. The
client never declares a timeout; it waits for the server.

## Routing shape

Flat router under `RootLayout`: `/` (create / join), `/sala/:code` (lobby),
`/juego/:code` (game), `/resultados/:code` (results). Path constants in
`shared/routes/*-path.ts`. A reload on `/juego/:code` re-joins with the stored
playerId; if the server rejects it, go to `/`.

## Verification commands

```bash
npx tsc --noEmit -p tsconfig.app.json   # 0 errors expected
npx eslint .         # not the --fix script
npx vite build
```

## Known traps

- Rival boards render **colours only**. The DTO must not even have a
  `letters` field for other players; if the server ever sends one, drop it in
  the mapper.
- Keyboard state (green/yellow/gray per key) derives from the player's own
  rows; compute it with a selector in the store, not in the component.
- The hint tile uses the dashed yellow style (`t-h` in the design); it must not
  be confused with a normal yellow.
- Emote cooldown is enforced server-side too, but disable the button for 3 s
  locally so the UI does not look broken.
