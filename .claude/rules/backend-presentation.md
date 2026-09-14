---
paths:
  - 'backend/src/modules/**/presentation/**'
  - 'backend/src/modules/gateway/**'
---

# Gateways and controllers (presentation layer)

- Handlers are thin: validate the payload with a class-validator DTO → call
  one use case → return the ack object. No repository, room store or rule logic
  here. (There is no `BaseResponse` in this repo; the one HTTP route, `/health`,
  returns a plain object.)
- Socket events and payloads are owned by `src/shared/contract/index.ts`.
  Adding or renaming an event means editing that file, bumping
  `CONTRACT_VERSION`, running `pnpm sync-contract` from the repo root, and
  changing the frontend DTO in the same commit.
- The round word is **never** part of any emitted payload before `round:end`.
  Other players' guesses are broadcast as colours only, never letters.
- Everything time-related (seconds left, penalties, who solved first) is
  computed in the `game` use cases and emitted as snapshots. A gateway never
  runs a timer of its own.
- Every domain exception maps to `{ code, message }` on the `error` event
  through the shared filter; never `try/catch` and swallow inside a handler.
- The validation pipe runs with `whitelist` + `forbidNonWhitelisted`: a new
  field in a payload must be declared in its DTO or the client gets rejected.
- Rate limit floodable events (`game:guess`) per socket. Game rules keyed by
  player — the emote burst limit, for one — belong in their use case, not here:
  a socket is not a player, and rejoining must not reset a limit.
