# WordRush backend

Real-time server for the multiplayer word race: NestJS 11 + Socket.IO, rooms in memory,
no database. The game rules and the scoring formula live in `../docs/context/`; the
socket contract is `src/shared/contract/index.ts` (frozen, mirrored by the frontend).

## Run

```bash
pnpm install
pnpm start:dev                      # dev server with watch, http://localhost:3000
pnpm build && node dist/main.js     # production build
```

Checks:

```bash
npx tsc --noEmit -p tsconfig.json   # typecheck (sources + tests)
pnpm test                           # unit tests + socket.io integration test
pnpm lint:check                     # eslint without --fix (includes layer boundaries)
```

`GET /health` returns `{ "status": "ok", "rooms": <count> }`.

## Environment

| Variable       | Default | Meaning                                                               |
| -------------- | ------- | --------------------------------------------------------------------- |
| `PORT`         | `3000`  | HTTP + Socket.IO port. Railway injects its own.                       |
| `FRONTEND_URL` | unset   | Comma-separated CORS allowlist. Unset allows every origin (dev only). |
| `NODE_ENV`     | unset   | Informational, except that `production` disables the testing hook.    |
| `MAX_ROOMS`    | `500`   | Rooms held at once. Past it `room:create` answers `server_full`.      |

See `.env.example`.

`MAX_ROOMS` exists because rooms live in this process: without a ceiling a burst
of creations ends in an out-of-memory restart, and a restart drops every game in
progress. The default is a starting point, not a measurement — `/health` reports
the live room count, so raise or lower it once this deployment has been watched.

## Testing

```bash
pnpm test                           # unit + socket.io integration
npx tsc --noEmit -p tsconfig.json
pnpm lint:check
```

### `WORDRUSH_FIXED_WORD` (development only)

Set it to a valid 5-letter answer and **every** round uses that word instead of a random
one, so a scripted game can be played to the end:

```bash
WORDRUSH_FIXED_WORD=ahora PORT=3000 node dist/main.js   # Spanish rooms
WORDRUSH_FIXED_WORD=solid PORT=3000 node dist/main.js   # English rooms
```

Guards, in `src/modules/words/domain/services/fixed-word.ts`:

- it is resolved once at boot and is **inert whenever `NODE_ENV=production`**, so a stray
  variable on the deployed server can never freeze the answer;
- the value is normalised and must be five letters (`[a-zñ]`), otherwise it is ignored;
- if the word is not in the room language's list, `FixedWordPicker` logs a warning and falls
  back to the random picker for that round.

`resolveFixedWord` is covered by `src/modules/words/domain/services/fixed-word.spec.ts`.

## Deploy (Railway)

`railway.json` builds with Nixpacks and starts `node dist/main.js` with `/health` as the
healthcheck. Set `FRONTEND_URL` to the deployed frontend origin. The server listens on
`0.0.0.0:$PORT` and accepts both `websocket` and `polling` transports on the default
Socket.IO path. One process only: rooms are in memory.

## Layout

```
src/
  main.ts, app.module.ts
  shared/            contract (frozen), DomainException, Clock, RoomEventsBus, CORS adapter
  modules/
    words/           word lists ES/EN per length and the phrase banks (data/*.json), normalisation, pickers
    rooms/           Room / Player / Team / PlayerRound aggregates, lobby, teams, observers, kick, janitor
    game/            colour feedback, time ledger, scoring, round lifecycle, ticker, the phrase game
    reactions/       emote broadcast with cooldown
    chat/            chat messages with the visibility rules, slur masking, history
    gateway/         the Socket.IO gateway (presentation only), validation, error mapping
    health/          GET /health
```

Use cases publish server -> client events on the `RoomEventsBus`; the gateway is its only
subscriber and turns them into Socket.IO emits. Timers live in `game` (250 ms room
ticker, between-rounds scheduler) and `rooms` (janitor), never in the gateway.

## Room lifecycle

`src/modules/rooms/domain/room-lifecycle.ts` holds every delay of
`docs/context/02-game-rules.md` -> "Disconnections and room lifetime": a lobby player
disconnected for 60 s loses their slot, a room nobody is connected to is deleted 10 minutes
after the last disconnection, and a finished room 5 minutes after its `game:end`. A round that
ends with nobody connected ends the game as well: no round is ever started into an empty room.

## Contract note

Events that return no data (`room:leave`, `room:ready`, `room:start`, `reaction:send`) ack with the
contract's `EmptyAck` (`{ ok: true }` or an error payload).
