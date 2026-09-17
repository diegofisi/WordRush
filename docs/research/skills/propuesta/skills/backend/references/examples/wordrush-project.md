# Project binding — WordRush API (multiplayer word race)

> **Worked example.** This is what `references/project.md` looks like once the
> `bind-project` skill has filled `project.md.template` for a real repository. It is kept
> here as a reference for shape and tone, not to be read while working on WordRush — the
> live binding is the one inside the installed skill.

**Status (2026-09-16):** `backend/` exists and follows this binding. Modules: `words`,
`rooms`, `game`, `reactions`, `chat`, `gateway`, `health`. Where this file and the code
disagree, **the code wins** — fix this file in the same change.

## What it is

Real-time server for a multiplayer word race: rooms of 2–8 players (plus 2 observers)
guess the same word of 5, 6 or 7 letters, in Spanish or English, alone or in two teams,
while a per-player (or per-team) clock runs. New letters add time, somebody else solving
takes time away, and the same rooms can play "Adivina la frase" instead.

Game rules, the scoring formula and the decision log are **not** restated here. They are
the source of truth in `docs/context/` at the repo root: `02-game-rules.md`,
`03-scoring-system.md`, `04-decisions-and-pending.md`, `06-v1.1.md`.

## Stack

- Node 22+, pnpm. Two independent workspaces: `backend/` and `frontend/`.
- NestJS 11, TypeScript 5 (strict).
- Transport: **Socket.IO** (`@nestjs/websockets`, `@nestjs/platform-socket.io`). Every
  in-game interaction is a socket event. HTTP exists only for `GET /health`.
- Persistence: **none**. Rooms live in memory in a single process and die with the game.
- No cache, no queue, no object store, no scheduler.
- Word and phrase lists: static JSON per language and length, loaded at boot
  (`modules/words/data/`, built by `scripts/build-words.mjs` / `build-phrases.mjs`).
- Path aliases: `@shared/*`, `@modules/*`, `@test/*`.

## Applies / does not apply

| Doctrine topic | Applies? | Where / why |
|---|---|---|
| 4-layer modules, dependency rule | **Yes** | Every module under `src/modules/` |
| Layer-boundary lint enforcement | **Yes** | `pnpm lint:check` runs the boundary rules; `pnpm lint` carries `--fix`, do not use it |
| Domain entities, value objects, domain services | **Yes** | `rooms/domain/entities`, `game/domain/services`, `words/domain/services` |
| Injected clock / randomness | **Yes** | `CLOCK` token in `shared/domain`; word pickers are injected (`WORD_PICKER`, `PHRASE_BANK`), which is what makes `WORDRUSH_FIXED_WORD` possible |
| Use cases and DTO validation | **Yes** | Global pipe with `whitelist + forbidNonWhitelisted`, applied to socket payloads too |
| Authentication and authorization | **No** | No accounts. Identity is a socket joined to a room under a display name; "authorization" is *is this socket a player of this room, and is it their turn/state* — checked in the use case |
| Response envelope (`BaseResponse`) | **No** | Never brought over. The one HTTP route returns a plain object; socket handlers return the contract's ack types |
| Pagination | **No** | Nothing is listed that can grow |
| Relational database and ORM | **No** | v1 has no database |
| Migrations (`migrations.md`) | **No** | Whole file skipped. TypeORM arrives only if persistence is added, and that decision is recorded in `docs/context/04` first |
| Transactions / UnitOfWork | **No** | No database. Atomicity is "no `await` inside the critical section" — see Known traps |
| In-memory stores | **Yes** | `rooms/infrastructure/repositories` behind `ROOM_REPOSITORY`; ceiling `MAX_ROOMS` (500), janitor in `rooms` deletes empty and finished rooms |
| Object storage | **No** | — |
| Queues and background jobs | **No** | — |
| Scheduled tasks / crons | **No** | — |
| In-process timers | **Yes** | 250 ms room ticker and the between-rounds scheduler in `game`; the janitor in `rooms`. **Never in the gateway** |
| HTTP controllers | **Minimal** | `health` only: `GET /health` → `{ status, rooms }` |
| WebSocket gateways | **Yes** | `gateway/presentation/game.gateway.ts`, the only presentation layer that matters |
| Typed transport contract | **Yes** | `src/shared/contract/index.ts`, versioned by `CONTRACT_VERSION`; `pnpm sync-contract` copies it to the frontend and `pnpm check-contract` fails when the copies differ |
| Rate limiting | **Yes, two kinds** | Floodable socket events per socket in the gateway; rules keyed by *player* (the emote burst limit) in their use case |
| Streaming / file downloads | **No** | — |
| Unit tests | **Yes** | Jest, specs next to the code |
| Integration / e2e suite | **Partly** | `pnpm test` includes a real Socket.IO integration test; there is no separate e2e suite and nothing external to boot |

## Module map (`backend/src/modules/`)

| Module | Owns | Layers present |
|---|---|---|
| `rooms` | Room / Player / Team / PlayerRound / PhraseProgress aggregates, room settings (language, mode, word length, initial time, rounds, capacity, hint), join by code, lobby, teams, observers, host actions (start, change rules, kick with a 30 s block, restart), the janitor, and `state-presenter.ts` — the one place that decides what each recipient may see | domain, application, infrastructure |
| `game` | Round lifecycle: pick the word or phrase, accept guesses, colour feedback, per-position time bonuses, the −5 s broadcast, hint reveal, end-of-round scoring, standings, tie-breaks, the phrase game, the room ticker | domain, application |
| `words` | Word lists ES/EN per length, guess validation, accent and Ñ normalisation, the phrase banks. Pure; no I/O after boot | domain, infrastructure |
| `reactions` | Emote broadcast with the per-player burst limit | application |
| `chat` | Per-round chat with the visibility rules (finished-only during a round, team channel, everybody between rounds, observers always), 200 chars, 1 msg/s, slur masking, history on demand | domain, application |
| `gateway` | The Socket.IO gateway: join by room code + display name, payload DTOs, one use case per handler, domain exception → error payload. Presentation only, no rules | presentation |
| `health` | `GET /health` | presentation |

Shared kernel (`backend/src/shared/`): `contract/` (owns the socket contract),
`domain/` (`Clock` + `CLOCK`, `DomainException`, `ERROR_MESSAGES`), `events/`
(`RoomEventsBus`), `config/` (env parsers with safe fallbacks), `socket/` (the CORS
adapter).

Doctrine pieces deliberately **not** brought over: `BaseEntity` and `BaseResponse` (no
ORM, no HTTP envelope) and every storage, quota, crypto and stream utility.

## Sanctioned cross-module seams

| From → To | Through | Why it exists |
|---|---|---|
| `game`, `chat`, `reactions`, `health` → `rooms` | `ROOM_REPOSITORY` (domain Symbol exported by `RoomsModule`) | The room is the single aggregate everything acts on |
| `game`, `chat` → `rooms/domain` entities and `state-presenter` | Direct domain-to-domain import | Both live in the centre of the dependency rule; the presenter must be the only writer of client-facing state |
| `game` → `words` | `WORD_LIST`, `WORD_PICKER`, `PHRASE_BANK` domain interfaces | Keeps the lists swappable, and is what `WORDRUSH_FIXED_WORD` hooks into |
| `rooms/domain` → `game/domain/services/phrase` | Type-only import (`ParsedPhrase`) | The phrase shape is owned by `game`; the room only stores it. Keep it type-only — a value import would close a real cycle |
| use cases → `gateway` | **`RoomEventsBus`**, never a direct call | Use cases publish; the gateway is the bus's only subscriber. This is what keeps the rules testable without a socket |

## Contract

`src/shared/contract/index.ts` is typed, versioned and the single owner of every event
name, payload, tuning constant and error code. It is deliberately **not** restated in
prose: the table that used to sit here had drifted on almost every row.

The frontend keeps a byte-identical copy at `frontend/src/shared/contract/index.ts`.
Changing an event means: edit the contract, bump `CONTRACT_VERSION`, run
`pnpm sync-contract`, and change the frontend DTO **in the same commit**;
`pnpm check-contract` fails when the copies diverge.

What the contract cannot express, and so lives here:

| Invariant | Enforced in |
|---|---|
| Every client → server event answers with an ack; none is fire-and-forget | `gateway/presentation/game.gateway.ts` |
| A handler calls one use case and returns its ack; server → client events are published on `RoomEventsBus` | `shared/events/room-events.bus.ts` |
| `round:start` is addressed per player (`toPlayerId`), so each socket gets its own `me` slice | `game/application/use-cases/start-round.use-case.ts` |
| The word is never on the wire before `round:end`; rival state is colours and counts, never letters | `rooms/domain/services/state-presenter.ts` |
| Timers are server-side; the client receives `{ secondsLeft, at }` snapshots and only renders a countdown | `rooms/domain/entities/player-round.entity.ts`, `game` ticker |
| Floodable events are limited per socket; player-keyed limits live in their use case | `gateway/presentation/`, `reactions/application/use-cases/` |

## Environment variables

`PORT`, `FRONTEND_URL`, `NODE_ENV`, `MAX_ROOMS`, plus the development-only
`WORDRUSH_FIXED_WORD` (inert when `NODE_ENV=production`). The one table to keep current
is `backend/README.md` → Environment; the parsers live in `shared/config/env.ts`, each
with a safe fallback. A new variable needs a parser there, a line in `.env.example` and a
row in that README table.

## Commands

```bash
pnpm install
pnpm start:dev                      # dev server (backend/)
pnpm build                          # nest build + tsc-alias
```

## Verification

There is no single `verify` script yet. Run these from `backend/`, **one command per
invocation** — chaining with `;` reports success when an earlier one failed:

```bash
npx tsc --noEmit -p tsconfig.json
pnpm lint:check
npx jest --silent
npx nest build
```

and from the repo root, whenever the contract was touched:

```bash
pnpm check-contract
```

Formatting is already handled: the `PostToolUse` hook runs Prettier on edited files
inside `backend/` and `frontend/`. Do not run `pnpm lint` (it carries `--fix` and
rewrites unrelated files).

## Known traps

The dated ledger is `project-pitfalls.md`. The standing, structural ones:

- **Solving is atomic per room.** Compute the position (1st/2nd/3rd), freeze the solver's
  clock and apply the −5 s to everyone else in one synchronous step. State lives in a
  `Map`, so an `await` in the middle of that section lets two near-simultaneous solves
  both read "first".
- **The time ledger is per position, charged once.** In team mode it is charged once per
  *team*. The ledger belongs to the player/team aggregate, never to the gateway.
- **Everything visible to a client goes through `state-presenter.ts`.** It is the only
  file that decides what a rival, a teammate and an observer may see.
- **Rooms are memory.** A restart drops every game in progress; `MAX_ROOMS` is the
  ceiling that keeps a burst from ending in an out-of-memory restart, and `/health`
  reports the live count.

## Maintenance

Updated in the same change as the code it describes. When it disagrees with the code, the
code wins. Re-run `bind-project` after any change to the stack, the module map or the
verification commands.
