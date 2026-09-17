# Example binding: WordRush web client (multiplayer word race)

> Worked example of `project.md.template`, filled for a repo with **no UI kit,
> no data-fetching library, no forms library and no login** — the case where the
> doctrine's default examples apply least, which is why it is the example.
> Copy it to `references/project.md` in that repo, not here.

**Status (2026-09-16):** `frontend/` exists and follows this binding (core
`session`; features `lobby`, `game`, `results`, `chat`; `shared/` with tokens,
i18n, primitives, icons). Where this file and the code disagree, the code wins;
fix the file.

## What it is

Web client for a real-time multiplayer word race: create or join a room by code,
wait in a lobby, play rounds against up to 7 rivals whose boards you see **in
colours only**, react with emotes, chat, and read a per-round and accumulated
score table. Since v1.1 the same rooms can play a phrase-guessing game instead,
and can play in two teams. Desktop and phone.

Sources of truth this file does not restate:

- `docs/context/02-game-rules.md`, `docs/context/03-scoring-system.md` — what the UI must show.
- `docs/context/06-v1.1.md` — word length, the new hint, teams, chat, observers, kick, the phrase game.
- `docs/context/05-design.md` + `docs/design/*.dc.html` — the screens with exact colours, spacing and copy. Build from these, not from memory.

## Stack (confirmed 2026-09-16)

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 19 | StrictMode on; React Compiler **off** |
| Build | Vite 7 | |
| Language | TypeScript | `tsconfig.app.json` for typecheck |
| Styling | **Tailwind v4** | tokens are CSS variables in `src/index.css`, taken from `docs/design/Main.dc.html` |
| UI kit | **none** — hand-made primitives in `shared/components/ui` | no shadcn, no MUI |
| Data fetching | **none** | everything is socket-driven |
| State | Zustand 5 | |
| Transport | `socket.io-client`, single instance in `@/core/session/lib/socket` | |
| Router | `react-router-dom` v7, browser history | |
| Forms | plain `useState` + inline validation | no react-hook-form, no zod |
| i18n | house dictionary in `shared/i18n/` | Spanish is the source; its shape is the `Dictionary` type |
| Tests | Vitest | |
| Lint | `typescript-eslint`, `react-hooks`, `react-refresh`, `eslint-config-prettier` | **no** `eslint-plugin-boundaries` and **no** `simple-import-sort` — the slice rules are convention here, unlike the backend |

Fonts: Bricolage Grotesque (display, tiles), DM Sans (UI), JetBrains Mono (clock
and figures) — `font-display` / `font-sans` / `font-mono`. Never a hex in a
component.

## Applies / does not apply

| Doctrine topic | Reference file | Applies here? | What replaces it |
|---|---|---|---|
| Vertical slices, folder layout | `architecture.md` | yes | plus a `core/session` concern above the slices |
| Container / Presentational | `containers-pages.md` | yes | unchanged |
| Adapter Pattern (DTO → Model) | `data-flow.md` | yes | DTOs are aliases onto the synced contract |
| Data-fetching library | `data-flow.md` → query/mutation hooks | **no** | pushed events are store-driven; emit-with-ack goes through `request()` and returns `Result<T>` |
| UI kit (typography, layout primitives, `sx`) | `components.md` | **no kit** | semantic tags + Tailwind; see the mapping below |
| Forms library | `forms.md` | **no** | `useState` + a validation helper; read the chapter for principles, not API |
| Auth / roles / guards | `web-app-patterns.md` | **no** | there is no login: identity is a name + a room token in `localStorage`; `RequireSession` is a session check, not a role guard |
| i18n | `conventions.md` → Copy | yes | `shared/i18n/`, `useT()` in React, `getT()` outside |
| Router | `routing-shell.md` | yes | flat router under `AppLayout` |
| External store | `state.md` | yes | Zustand |
| Live-process stores | `state.md` | yes | the round clock is server-owned |

## Doctrine → this repo (primitive mapping)

| Doctrine (kit dialect) | Here |
|---|---|
| `<Typography variant>` | plain semantic tags with Tailwind classes. There is **no** typography primitive |
| `<Stack>` / `<Grid>` / `<Box>` | plain `div` with flex/grid utilities. There are **no** layout primitives |
| `sx` + theme palette | Tailwind classes + `cn()`. `cn()` is a four-line join, **not** `tailwind-merge`: conflicting classes are not resolved for you |
| `CircularProgress` / `Alert` | `PageLoading` and `PageEmpty` from `@/shared/components/ui/PageState.tsx`. There is **no** `PageError` |
| Kit controls | hand-made `Button`, `Card`, `Input`, `Segmented`, `Stepper`, `Toggle`, `Avatar`, `ConfirmDialog` in `@/shared/components/ui/` |
| Error fallback | `ErrorBoundary` + `CrashScreen`, wrapped around `<App/>` in `main.tsx` |
| Snackbar | `useToastStore` + `<Toaster>`, called from containers only |
| Icons | `lucide-react` for chrome; `GameIcons.tsx` for the traced 24×24 stroke set; `EmoteIcon.tsx` for the twenty raster emote stickers (256×256 WebP, never recoloured) |

## Feature map

| Kind | Path | Slices |
|---|---|---|
| core | `src/core/` | `session` — player identity (name, playerId, roomCode, token in `localStorage` under `wordrush.session`), the socket connection and its lifecycle |
| features | `src/features/` | `lobby` (create room, join by code, waiting room, team slots), `game` (clock, board, keyboard with Ñ and the FRASE key, rivals or team panel, live feed, hint, emotes, score preview, phrase card/modal/slots), `results` (round breakdown or team cards, accumulated and final tables), `chat` (messages, channel switch, phone sheet — embedded by game and results) |

`src/shared/`:

| Folder | Contents |
|---|---|
| `components/ui` | `Avatar` `Button` `Card` `ConfirmDialog` `CrashScreen` `ErrorBoundary` `Input` `PageState` `Segmented` `Stepper` `Toaster` `Toggle` |
| `components/layout` | `AppLayout` `TopBar` `Logo` `ThemeToggle` `LangSegmented` `RoomContext` |
| `components/icons` | `GameIcons` `EmoteIcon` `customEmotes` |
| `lib` | `cn` `format` `result` `avatarTone` |
| `hooks` | `useNow` `useMediaQuery` `useToastSafeBottom` |
| `stores` | `useUiStore` (theme, interface language, remembered name), `useToastStore` |
| `i18n`, `routes`, `contract` | dictionaries, `paths.ts`, the synced copy of the socket contract |

## Sanctioned facades (the only cross-slice imports)

- `@/core/session/stores/useSessionStore` — playerId, roomCode, token, name, rejoin.
- `@/core/session/lib/socket` — the single socket instance and the `request()` ack
  wrapper. **Only `api/` folders and stores may import it.**
- `@/shared/i18n` (`useT`, `getT`), `@/shared/stores/useUiStore`,
  `@/shared/stores/useToastStore`.
- `@/shared/**` — always.
- `@/features/chat` — `ChatContainer` and `useChatStore`: the chat is one slice
  that game and results embed.

Anything else from another slice: duplicate a minimal local hook or model.

## Transport

Socket-driven. Everything the server pushes is a **store-driven endpoint** and
never gets a fetch hook:

- `useSessionStore` — `connect`, `disconnect`, `connect_error`,
  `session:replaced`, `error`. Every `connect` re-runs `rejoin()` when a session
  is stored, which covers the first connect and every reconnect.
- `useLobbyStore` — `lobby:update`, `round:start`.
- `useGameStore` — `round:start`, `player:progress`, `player:solved`,
  `player:hint`, `phrase:attempt`, `player:left`, `time:penalty`,
  `reaction:show`, `round:end`, `game:end`, `lobby:update`; team mode adds
  `teammate:progress`, `team:hint`, `team:clocks`.
- `useResultsStore` — `round:end`, `game:end`, `round:start`, `lobby:update`.
- `useChatStore` — `chat:message`; refetches `chat:history` on `round:end`, on my
  own finishing `player:progress`, and on `team:clocks`.

Each store's `bind()` is guarded by a module-level flag so the listeners attach
once despite StrictMode's double-invoke, and they are **never removed**: these are
app singletons that must keep receiving events across route changes. `App.tsx`
calls `bind()` once from `<Bootstrap/>`. Stores rehydrate from each other by
subscribing to `useSessionStore` directly, outside React.

Emits go through `features/{feature}/api/{event}/`: `{event}.dto.ts` with the
payload shape and the `toModel` mapper for the ack, plus `use{Action}.ts`
wrapping `socket.emit` with acknowledgement into a promise via `request()`.

The event table is **not copied here**: it is owned by the backend's
`src/shared/contract/index.ts` and mirrored byte-for-byte at
`frontend/src/shared/contract/index.ts` by `pnpm sync-contract`. A DTO here is a
type alias onto that contract. Changing an event means `CONTRACT_VERSION` +
`sync-contract` + the client DTO in the same commit.

**Clock rule:** the store keeps `secondsLeft` plus the server timestamp of the
last snapshot; a `requestAnimationFrame` ticker only *renders* the countdown. The
client never declares a timeout; it waits for the server.

## Routing shape

Flat router under `AppLayout`: `/` (create / join), `/room/:code` (lobby),
`/game/:code` (game), `/results/:code` (results), plus `*`. Path constants and
builders in `shared/routes/paths.ts`, including `pathForStatus()`, which maps a
room status to its screen. The three room routes sit behind `RequireSession`.

A reload on `/game/:code` re-joins with the stored session; if the server rejects
it, go to `/`. The `:code` segment is **not** authoritative — where a session
exists it wins (`session?.roomCode ?? code`); the segment is only there to be
shareable.

## House conventions

| Question | This repo |
|---|---|
| `api/` folder casing | `kebab-case`, one per event: `api/send-phrase/` |
| DTO file name | `{verb}-{thing}.dto.ts` |
| Model folder | `models/` |
| Model name | `{Name}` (no `ViewModel` suffix) |
| Mapper name and location | `toModel`, inside the dto file |
| Shared layer name | `shared/`, plus `core/` for session |
| `localStorage` prefix | `wordrush.` (`wordrush.session`, `wordrush.lang`, …) |
| Documentation / comment language | English; the UI exists in ES and EN |
| Dates in documents | complete (`2026-09-16`), never relative |
| Commit message style | English, imperative, one line describing the behaviour change |

## Verification commands

There is no single `verify` script today. Until there is, run, from `frontend/`:

```bash
pnpm typecheck   # tsc --noEmit -p tsconfig.app.json
pnpm lint        # eslint . — 0 errors AND 0 warnings
pnpm test        # vitest run
pnpm build       # tsc -b && vite build, what the host runs
```

and from the repo root `pnpm check-contract`, which fails when
`frontend/src/shared/contract/index.ts` has drifted from the backend's copy.

## Known traps

Pointers only; the dated ledger is `project-pitfalls.md`.

- Rival boards are **colours only** — the DTO must not even have a `letters`
  field for other players.
- The hint never appears on the board; it only lights its key.
- `bind()` once, per store, behind the module flag.
- No local timer ends a round.
- Nothing outside `api/` and `stores/` imports the socket.
