# This project: WordRush web client (multiplayer Wordle)

> This file is the **project binding** for the portable frontend doctrine in
> this skill. The doctrine files speak MUI; this file says which primitives
> replace them here, what the feature map is, and where the design comes from.
> Read it first, then the workflow's doctrine files.

**Status (2026-09-17):** `frontend/` exists and follows this binding (core `session`; features `lobby`, `game`, `results`, `chat`; `shared/` with tokens, i18n, primitives, icons). Where this file and the code disagree, the code wins; fix the file.

## What it is

Web client for a real-time multiplayer Wordle: create or join a room by code,
wait in a lobby, play rounds against up to 7 rivals whose boards you see in
colours only, react with emotes, and read a per-round and accumulated score
table. Desktop and phone.

Game rules, scoring and design decisions are **not** restated here:

- `docs/context/02-game-rules.md`, `docs/context/03-scoring-system.md` — what the UI must show.
- `docs/context/05-design.md` — visual direction and the link to the Claude Design canvas.
- `docs/design/*.dc.html` — the six screens (create room, lobby, game, results, mobile game, dark game) with exact colours, spacing and copy. Build from these, not from memory.

## Stack (confirmed 2026-09-14)

React **19** · TypeScript · Vite 7 · **Tailwind v4** with hand-made primitives in
`shared/components/ui` (no shadcn, no UI kit) · `lucide-react` (only for UI chrome; the
twenty game emotes are **raster WebP**, 256×256 with transparency, never recoloured) ·
`socket.io-client` · `zustand` · `react-router-dom` v7. No React Query: everything is
socket-driven.

ESLint flat config with `typescript-eslint`, `react-hooks`, `react-refresh` and
`eslint-config-prettier`; Prettier. There is **no** `simple-import-sort` and
**no** `eslint-plugin-boundaries` here, so the slice rules below are convention
on this side — unlike the backend, where the boundaries plugin does enforce its
layer rules in `lint:check`.

No i18n library: UI strings live in one `es`/`en` dictionary (`shared/i18n/`,
Spanish is the source and its shape is the `Dictionary` type). The interface
language is chosen in the top bar and is **independent** of the room's word
language — a player can read the UI in English and play a Spanish room.

Fonts from the design: Bricolage Grotesque (display, tiles), DM Sans (UI),
JetBrains Mono (clock and figures). Colour tokens are the hex values in
`docs/design/Main.dc.html` `<style>`; put them in `src/index.css` as CSS
variables and never hardcode hex in components.

## Doctrine → this repo (primitive mapping)

| Doctrine (MUI) | Here |
|---|---|
| `<Typography variant>` | plain semantic tags with Tailwind classes. There is **no** typography primitive; the three fonts are `font-display` / `font-sans` / `font-mono`. |
| `<Stack>` / `<Grid>` / `<Box>` | plain `div` with Tailwind flex/grid utilities. There are **no** layout primitives. |
| `sx` + theme `Palette` | Tailwind classes + `cn()`; colours are CSS variables in `src/index.css`. `cn()` is a four-line join, **not** `tailwind-merge`: conflicting classes are not resolved for you. |
| `CircularProgress` / `Alert` | `PageLoading` and `PageEmpty`, both exported from `@/shared/components/ui/PageState.tsx`. There is no `PageError`. |
| MUI controls | hand-made `Button`, `Card`, `Input`, `Segmented`, `Stepper`, `Toggle`, `Avatar`, `ConfirmDialog` in `@/shared/components/ui/` |
| Error fallback | `ErrorBoundary` + `CrashScreen` in `@/shared/components/ui/`, wrapped around `<App/>` in `main.tsx` |
| Snackbar | `useToastStore` + `<Toaster>` in `@/shared/components/ui/`, called from containers only |
| Icons | `lucide-react` for chrome; `shared/components/icons/GameIcons.tsx` for the traced 24×24 stroke set, `EmoteIcon.tsx` for the twenty emote stickers (raster art in `src/assets/emotes/`) |

The rest of the doctrine — vertical slices, adapter pattern,
Container/Presentational, stores, routing, conventions — applies unchanged.

**Except forms.** `references/forms.md` is written for Zod + react-hook-form and
neither is installed. The forms here are plain `useState` with inline validation
(see `HomeContainer`), which is enough for two fields and a room code; read that
chapter for its principles, not for its API.

## Feature map

| Kind | Path | Slices |
|---|---|---|
| **core** | `src/core/` | `session` — player identity (name, playerId, roomCode, token in `localStorage` under `wordrush.session`), the socket connection and its lifecycle |
| **features** | `src/features/` | `lobby` (create room form, join by code, the room-URL entry view, waiting room, team slots with drag and drop in team mode), `game` (clock, board, keyboard with Ñ and the FRASE key, rivals panel or team panel, hint, emotes, score preview, the room stream it hands to the chat; the phrase game's card, modal and slots), `results` (round breakdown or team cards, accumulated table, final table), `chat` (the one room panel: system events, stickers and messages in a single stream, channel switch, composer with the sticker trigger, phone sheet; embedded by game and results) |

`src/shared/`:

| Folder | Contents |
|---|---|
| `components/ui` | `Avatar` `Button` `Card` `ConfirmDialog` `CrashScreen` `ErrorBoundary` `Input` `PageState` `Segmented` `Stepper` `Toaster` `Toggle` |
| `components/layout` | `AppLayout` `TopBar` `Logo` `ThemeToggle` `LangSegmented` `RoomContext` |
| `components/icons` | `GameIcons` `EmoteIcon` `customEmotes` |
| `lib` | `cn` `format` `result` `avatarTone` |
| `hooks` | `useNow` `useMediaQuery` `useToastSafeBottom` |
| `stores` | `useUiStore` (theme + interface language + remembered name + sound: muted, volume, keyboard tick), `useToastStore` |
| `i18n`, `routes`, `contract` | dictionaries, `paths.ts`, the synced copy of the socket contract |

## Sanctioned facades (the only cross-slice imports)

- `@/core/session/stores/useSessionStore` — playerId, roomCode, token, name, rejoin.
- `@/core/session/lib/socket` — the single `socket.io-client` instance and the `request()`
  ack wrapper; only `api/` folders and stores may import it.
- `@/shared/i18n` (`useT`), `@/shared/stores/useUiStore` (theme + UI language),
  `@/shared/stores/useToastStore`.
- `@/shared/**` — always.
- `@/features/chat` — `ChatContainer`, `useChatStore` and the `ChatStreamEvent` type: the
  chat is one slice that the game and results screens embed, and the game hands it the
  round's events already rendered (docs/context/06-v1.1.md -> Chat).

Anything else from another slice: duplicate a minimal local hook/model.

## Transport

This app is **socket-driven**. Per the doctrine's endpoint classification
(`data-flow.md`), everything that arrives as a push event is a **store-driven
endpoint** and never gets a React Query hook:

- `useSessionStore` — `connect`, `disconnect`, `connect_error`,
  `session:replaced`, `error`. Every `connect` re-runs `rejoin()` when a session
  is stored, which covers both the first connect and every reconnect.
- `useLobbyStore` — `lobby:update`, `round:start`.
- `useGameStore` — `round:start`, `player:progress`, `player:solved`,
  `player:hint`, `phrase:attempt`, `player:left`, `time:penalty`, `reaction:show`, `round:end`,
  `game:end`, `lobby:update`; team mode adds `teammate:progress` (a teammate's
  rows with letters), `team:hint` (the team's reveal) and `team:clocks`.
- `useResultsStore` — `round:end`, `game:end`, `round:start`, `lobby:update`.
- `useChatStore` — `chat:message`; refetches `chat:history` on `round:end`, on my own
  finishing `player:progress` and on `team:clocks` (what was hidden while I guessed).

Each store's `bind()` is guarded by a module-level flag so the listeners attach
once despite StrictMode's double-invoke, and they are never removed: these are
app singletons that must keep receiving events across route changes. `App.tsx`
calls `bind()` once from `<Bootstrap/>`. Stores rehydrate from each other by
subscribing to `useSessionStore` directly, outside React.

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

Flat router under `AppLayout`: `/` (create / join), `/room/:code` (lobby),
`/game/:code` (game), `/results/:code` (results), plus a `*` 404. Path
constants and builders in `shared/routes/paths.ts`, including `pathForStatus()`,
which maps a room status to its screen, and `inviteLinkFor()`, the canonical
invitation (`${origin}/room/CODE`, what "copy link" writes). The three room
routes sit behind `RequireSession`.

**Every room URL is an entry point** (2026-09-17). `RequireSession` takes a
`fallback` — `RoomEntryPage` in the lobby slice — and renders it whenever the
stored session does not open the room in the URL: no session shows the join view
for that code, a session in *another* room shows the "one game at a time" card
with "leave it to join CODE". A session for that room walks through and
`useSessionBootstrap` lands it on the screen its status asks for; a dead session
on a room URL is dropped silently (no expiry notice, no toast) because the code
in the URL is somewhere to go. `/?code=XXXX` is kept for old links and redirects
to `/room/XXXX`.

A reload on `/game/:code` re-joins with the stored session. Note the `:code`
segment is **not** authoritative *inside* the room: where a session exists it
wins (`session?.roomCode ?? code`).

## Verification commands

```bash
pnpm typecheck                          # tsc --noEmit -p tsconfig.app.json
pnpm lint                               # eslint . — 0 errors AND 0 warnings today
pnpm build                              # tsc -b && vite build, what Railway runs
```

From the repo root, `pnpm check-contract` must also pass: it fails when
`frontend/src/shared/contract/index.ts` has drifted from the backend's copy.

## Known traps

- Rival boards render **colours only**. The DTO must not even have a
  `letters` field for other players; if the server ever sends one, drop it in
  the mapper.
- Keyboard state (green/yellow/gray/hint per key) derives from the player's own
  rows through `deriveKeyStates` in `features/game/helpers/keyboard.ts`. It is
  called from a `useMemo` in `GameContainer`, not from a selector in the store —
  it is a pure function of `me.rows` + `me.hint` and nothing persists it.
- **The hint never appears on the board.** It only lights its letter on the
  keyboard (`key-hint`, dashed yellow). `index.css` also defines a `tile-hint`
  class, but no component uses it; do not take its presence as a sign that the
  board is supposed to show the hint.
- Tile and key colour is not enough on its own: every revealed tile and every
  key that carries a state also gets an `aria-label` with that state, because a
  screen reader never hears a CSS class.
- The emote burst rule (more than 8 in 3 s pauses the player for 5 s) is
  enforced server-side; run the same rule in the store before sending and show
  the countdown on the picker trigger, so the UI never looks broken.
- Sound is one module, `shared/lib/sound.ts`: every cue is synthesised (sine and
  triangle voices through one low-pass filter and a master gain, peak ~−14 dBFS)
  and asked for by name from the store that owns the event, never from a
  component's render. `useUiStore` holds `muted`, `volume` and `keyboardSounds`
  (the typing tick, off by default); the top bar's `SoundToggle` is their one
  place. In `dev`, `window.__wordrushSound` records every cue asked for and
  `window.__wordrushSocket` is the socket, both only so a verification run can
  assert on them.
