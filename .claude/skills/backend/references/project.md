# Project binding — WordRush API (multiplayer Wordle)

Everything here is specific to this repo. The doctrine files in this folder are
inherited from a previous project (a cloud-drive API) and are project-agnostic;
this file says how they map onto **this** game server. Read it first, then the
workflow's doctrine files.

**Status (2026-09-14):** `backend/` exists and follows this binding. Modules: `words`, `rooms`, `game`, `reactions`, `chat`, `gateway`, `health`. Where this file and the code disagree, the code wins; fix the file.

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
| `rooms` | Create room (settings: language, mode normal/teams, word length, initial time, rounds, capacity, hint on/off), join by code (as an observer once the game runs, two at most), lobby state, ready flags, teams (join, host assigns, name and colour, counters), observers taking a seat, host actions (start, change rules, kick with a 30 s name block, restart into a new lobby). Room + Player + Team aggregates. |
| `game` | Round lifecycle: pick word (or phrase), accept guesses, colour feedback, per-letter time bonuses (once per letter position), the −5 s broadcast, hint reveal, end-of-round scoring, accumulated table, tie-breaks; the phrase game (`phrase.ts`, `submit-phrase.use-case.ts`: green anywhere in the phrase, 2 s per occurrence, five sends). This module implements `docs/context/03-*` and `06-*`. |
| `words` | Word lists ES/EN per length, validation of a guess (must be a real word), normalisation of accents and Ñ, and the phrase banks of "Adivina la frase" (`PHRASE_BANK`, `scripts/build-phrases.mjs`). Pure domain service; no I/O after boot. |
| `reactions` | Emote broadcast with the per-player burst limit (more than 8 in 3 s pauses the player for 5 s). Its own module. |
| `chat` | Text chat kept on the room per game: visibility rules (`chat-visibility.ts`: finished-only while a round runs, team channel, everybody between rounds, observers always), 200 chars, one per second, slur masking, history on demand. Implements `docs/context/06-v1.1.md` -> Chat. |
| `gateway` | The Socket.IO gateway(s): auth-less join by room code + display name, event validation via DTOs, mapping domain exceptions to socket error payloads. Presentation layer only — no rules here. |

Shared kernel (`backend/src/shared/`): `contract/` (owns the socket contract),
`domain/` (`Clock` + its `CLOCK` token, `DomainException`, `ERROR_MESSAGES`),
`events/` (`RoomEventsBus`), `config/` (env parsers), `socket/` (the CORS
adapter). The doctrine's `BaseEntity` and `BaseResponse` were never brought
over — there is no ORM, and the one HTTP route returns a plain object — and its
storage/crypto/stream utilities do not apply either.

## Socket contract

The contract is `src/shared/contract/index.ts`: typed, versioned through
`CONTRACT_VERSION`, and the single owner of every event name, payload, tuning
constant and error code.

It is deliberately **not** restated here. The table that used to sit in this
section was copied by hand and had drifted on almost every row — flat
`room:create` payloads that are now a `settings` object, acks missing half
their fields, `rowColors` for what the contract calls `rows`, `accumulated`
for `standings`, no `player:hint` at all, and no `server_full`. A prose copy
of a typed source of truth drifts the moment somebody changes the type.

The frontend keeps a byte-identical copy at
`frontend/src/shared/contract/index.ts`. `pnpm sync-contract` refreshes it and
`pnpm check-contract` fails when the two differ.

What the contract file cannot express, and so belongs here:

| Rule | Enforced in |
|---|---|
| Every client → server event answers with an ack; none is fire-and-forget. | `gateway/presentation/game.gateway.ts` |
| A handler calls **one** use case and returns its ack. Server → client events are published by the use cases on `RoomEventsBus`; the gateway is the bus's only subscriber. | `shared/events/room-events.bus.ts` |
| `round:start` is addressed per player (`toPlayerId`), so every socket gets its own `me` slice. | `game/application/use-cases/start-round.use-case.ts` |
| The word is never on the wire before `round:end`. Rival state is colours and counts, never letters. | `rooms/domain/services/state-presenter.ts` |
| Timers are server-side. The client receives `{ secondsLeft, at }` snapshots and only *renders* a countdown; it never decides that time ran out. | `rooms/domain/entities/player-round.entity.ts` |
| Floodable events are rate limited per socket; rules keyed by player (the emote burst limit) live in their use case instead. | `.claude/rules/backend-presentation.md` |

## Environment variables

`PORT`, `FRONTEND_URL`, `NODE_ENV`, `MAX_ROOMS`, and the development-only
`WORDRUSH_FIXED_WORD`. Defaults and meanings live in `backend/README.md` →
Environment, which is the one table to keep current; the parsers are in
`shared/config/env.ts`, each with a safe fallback. A new variable gets a parser
there, an entry in `.env.example` **and** a row in that README table.

## Commands

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
