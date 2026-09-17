# Project pitfalls — WordRush API

> **Worked example.** What `references/project-pitfalls.md` looks like after a few weeks
> on a real repository. The entries are the rules WordRush has actually written down in
> `.claude/rules/backend-*.md`, `docs/context/06-v1.1.md` and the binding's "Known traps";
> the dates are the dates of those documents.

This is **this repository's** bug ledger: one dated line per mistake already paid for
here. `pitfalls.md` next to it holds what is true of any NestJS Clean Architecture
service. A change that reintroduces a line from this file is not done.

## How it grows

Add a line when a bug reached the branch, or when the same correction had to be made
twice. Do not add style opinions, restatements of the universal `pitfalls.md`, or
anything a type, a lint rule or a test already enforces — if it can be made executable,
make it executable instead of writing it here.

Format: `YYYY-MM-DD — <rule, imperative> — <why: what broke> — <where>`.

## Ledger

2026-09-11 — The round word is never in an emitted payload, an ack or a log line before
`round:end` — anything on the wire is readable by every client, and the answer on the wire
ends the game — `gateway/presentation/`, `rooms/domain/services/state-presenter.ts`

2026-09-11 — Other players' guesses are broadcast as colours and counts, never letters —
a rival's letters are the answer in disguise — `rooms/domain/services/state-presenter.ts`

2026-09-11 — Everything time-related (seconds left, penalties, who solved first) is
computed in the `game` use cases and emitted as snapshots; a gateway never runs a timer —
a client-side countdown that decides a round has ended lets two clients disagree about who
solved — `game/application/`, `gateway/presentation/`

2026-09-11 — The room store has a ceiling (`MAX_ROOMS`) and a janitor — rooms live in this
process, and a burst of creations without a ceiling ends in an out-of-memory restart that
drops every game in progress — `rooms/infrastructure/repositories/`, `shared/config/env.ts`

2026-09-14 — Never restate the typed contract in prose — the hand-copied event table in
the binding had drifted on almost every row (flat `room:create` payloads that are now a
`settings` object, acks missing half their fields, `rowColors` for what the contract calls
`rows`, `accumulated` for `standings`, no `player:hint`, no `server_full`) —
`src/shared/contract/index.ts` is the source of truth

2026-09-14 — Solving is one synchronous step per room: compute the position, freeze the
solver's clock, apply the −5 s to everyone else, then await — with state in a `Map`, an
`await` inside that section lets two near-simultaneous solves both read "first" —
`game/application/use-cases/`

2026-09-14 — A letter position pays time once, and the ledger of charged positions lives
on the player (in team mode, on the team) — keeping it anywhere near the transport let the
same letter earn time twice — `rooms/domain/entities/player-round.entity.ts`,
`game/domain/services/time-ledger.ts`

2026-09-15 — Rate limits that describe a *person* (the emote burst: more than 8 in 3 s
pauses the player for 5 s) are keyed on the player id in their use case, not on the socket
in the gateway — a socket is not a player, and reconnecting reset the limit —
`reactions/application/use-cases/`

2026-09-15 — Hints are anonymous: the feed says "somebody used a hint" or "team X used its
hint", never who — naming the player leaks which board is close — `game/application/use-cases/use-hint.use-case.ts`

2026-09-15 — In team mode a position is charged once per **team** and there is one solve
per team; the second teammate to uncover the same letter adds nothing — charging per
player doubled a big team's clock — `rooms/domain/entities/team.entity.ts`, `game/`

2026-09-15 — Changing or adding a socket event means editing `shared/contract/index.ts`,
bumping `CONTRACT_VERSION`, running `pnpm sync-contract` and changing the frontend DTO in
the **same commit** — a contract changed on one side only fails at runtime, not at build —
repo root `scripts/sync-contract.mjs`

2026-09-15 — No round is ever started into an empty room, and a round that ends with
nobody connected ends the game — a ticker running for an empty room kept a dead game alive
until the janitor — `game/application/services/round-lifecycle.service.ts`

2026-09-15 — `WORDRUSH_FIXED_WORD` is resolved once at boot and is inert whenever
`NODE_ENV=production` — a stray variable on the deployed server would freeze the answer
for everyone — `words/domain/services/fixed-word.ts`

2026-09-16 — Run verification commands one per invocation; never chain them with `;` — a
`;` chain reports success when the typecheck already failed, and the change was committed
with broken tests — `backend/` verification set

2026-09-16 — `pnpm lint` carries `--fix`; the no-fix variant is `pnpm lint:check`, which
also runs the layer-boundary rules — the fixing variant rewrote files the change never
touched — `backend/package.json`
