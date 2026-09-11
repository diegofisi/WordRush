# Project binding — WordRush API (multiplayer Wordle)

Everything here is specific to this repo. The doctrine files in this folder are
inherited from a previous project (a cloud-drive API) and are project-agnostic;
this file says how they map onto **this** game server. Read it first, then the
workflow's doctrine files.

**Status (2026-09-11):** `backend/` exists and follows this binding. Modules: `words`, `rooms`, `game`, `reactions`, `gateway`, `health`. Where this file and the code disagree, the code wins; fix the file.

## What it is

Real-time server for a multiplayer Wordle where the clock is the score. Rooms
of 2–8 players, same 5-letter word per round, per-player timers, letter
bonuses, a "−5 s to everyone else" event when someone solves, one hint per
round, emote reactions, and a per-round / accumulated leaderboard.

Game rules and the scoring formula are **not** restated here. They live in
`docs/context/` at the repo root and are the source of truth:

- `docs/context/02-game-rules.md` — room, round, timer, hint, attack, emotes.
- `docs/context/03-scoring-system.md` — points formula with a worked simulation.
- `docs/context/04-decisions-and-pending.md` — decisions taken and still open.

## Stack (confirmed 2026-09-11)

- **NestJS 11 + TypeScript 5 (strict)**, pnpm, Node 22+.
- **WebSockets via Socket.IO** (`@nestjs/websockets`, `@nestjs/platform-socket.io`).
  Every in-game interaction is a socket event; HTTP is only for health and,
  later, for anything that must survive a page reload (room lookup by code).
- **No database in v1.** Rooms live in memory in a single process and die when
  the game ends. TypeORM / PostgreSQL / migrations come only if persistence
  (history, accounts) is added; until then the doctrine's migration, queue,
  storage and quota sections **do not apply**.
- **No MinIO, no BullMQ, no Redis** in v1. If the server must scale past one
  process, the room store moves to Redis first (sticky sessions or a Socket.IO
  adapter); design the room repository interface so that swap is local.
- Word lists: static JSON per language (`es`, `en`), loaded at boot.
- Path aliases: `@shared/*`, `@modules/*`, `@test/*` (same as the doctrine assumes).

## Module map (`backend/src/modules/`)

| Module | Owns |
|---|---|
| `rooms` | Create room (settings: language, initial time, rounds, capacity, hint on/off), join by code, lobby state, ready flags, host actions. Room + Player aggregates. |
| `game` | Round lifecycle: pick word, accept guesses, colour feedback, per-letter time bonuses (once per letter position), the −5 s broadcast, hint reveal, end-of-round scoring, accumulated table, tie-breaks. This module implements `docs/context/03-*`. |
| `words` | Word lists ES/EN, validation of a guess (must be a real word), normalisation of accents and Ñ (see pending decision in `04-*`). Pure domain service; no I/O after boot. |
| `reactions` | Emote broadcast with a 3 s per-player cooldown. Tiny; may start inside `game`. |
| `gateway` | The Socket.IO gateway(s): auth-less join by room code + display name, event validation via DTOs, mapping domain exceptions to socket error payloads. Presentation layer only — no rules here. |

Shared kernel (`backend/src/shared/`): keep the doctrine's `BaseEntity`,
domain exception hierarchy, `ErrorMessages`, `BaseResponse`. Drop the
storage/crypto/stream utilities — nothing here streams files.

## Socket contract (v1 draft — the frontend binding mirrors this table)

Client → server (all payloads validated by class-validator DTOs):

| Event | Payload | Result |
|---|---|---|
| `room:create` | `{ name, language, initialSeconds, rounds, capacity, hintEnabled }` | `{ roomCode, playerId }` |
| `room:join` | `{ roomCode, name }` | `{ playerId, lobby }` or error `room_full` / `room_not_found` / `game_in_progress` |
| `room:ready` | `{ ready: boolean }` | broadcast `lobby:update` |
| `room:start` | — (host only) | broadcast `round:start` |
| `game:guess` | `{ word }` | ack `{ colors[5], secondsGained, solved }` + broadcasts below |
| `game:hint` | — | ack `{ letter }` (the position never leaves the server) |
| `reaction:send` | `{ emote }` | broadcast `reaction:show` |

Server → client:

| Event | Payload | Notes |
|---|---|---|
| `lobby:update` | `{ players[], settings }` | on join / leave / ready |
| `round:start` | `{ round, totalRounds, initialSeconds, startedAt }` | word is **never** sent |
| `player:progress` | `{ playerId, rowColors[][], attempt, secondsLeft, solved }` | colours only, never letters |
| `player:solved` | `{ playerId, position, secondsLeft }` | followed by `time:penalty` |
| `time:penalty` | `{ seconds: 5, fromPlayerId }` | to every unsolved player |
| `round:end` | `{ word, breakdown[], accumulated[] }` | breakdown fields = table in `03-*` |
| `game:end` | `{ final[] }` | with tie-breaks applied |
| `reaction:show` | `{ playerId, emote }` | |
| `error` | `{ code, message }` | codes from `ErrorMessages` |

Timers are server-side. The client receives absolute timestamps and
`secondsLeft` snapshots and only *renders* a countdown; it never decides that
time ran out.

## Environment variables (planned)

`PORT` (default 3000), `FRONTEND_URL` (CORS allowlist, comma-separated),
`NODE_ENV`. Add new ones through `ConfigService`, with a safe default or in the
`required` list, and document them in `.env.example` **and** this file.

## Commands (once scaffolded)

```bash
pnpm start:dev                      # dev server
pnpm build                          # nest build
npx tsc --noEmit -p tsconfig.json   # typecheck
pnpm lint:check                     # lint without --fix
npx jest                            # unit tests
```

## Verification set (run all before finishing)

`npx tsc --noEmit -p tsconfig.json` → `npx jest --silent` → `npx nest build`
→ `pnpm lint:check`. Format only touched files (the PostToolUse hook already
runs Prettier on edited files inside `backend/`).

## Known traps in this repo

- The doctrine's `pitfalls.md` is the previous project's bug ledger. Its
  **patterns** (idempotent handlers, ownership checks first, never swallow
  errors, reads don't write) still apply; its specifics (buckets, quota,
  trash, sync cursors) do not.
- A guess must be scored against **letter positions already charged**; the
  same letter cannot earn time twice. Keep that ledger on the Player, not in
  the gateway.
- Solving must be atomic per room: compute position (1st/2nd/3rd), freeze the
  solver's clock, then apply the −5 s to everyone else, in one synchronous
  step. Two near-simultaneous solves must never both read "first".
- Never log or emit the round word before `round:end`.
