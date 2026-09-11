---
paths:
  - 'backend/src/modules/**/presentation/**'
  - 'backend/src/modules/gateway/**'
---

# Gateways and controllers (presentation layer)

- Handlers are thin: validate the payload with a class-validator DTO → call
  one use case → return `BaseResponse.ok(...)` (HTTP) or the ack object
  (socket). No repository, room store or rule logic here.
- Socket events and payloads are the contract in
  `.claude/skills/backend/references/project.md` → Socket contract. Adding or
  renaming an event updates that table and the frontend DTO in the same change.
- The round word is **never** part of any emitted payload before `round:end`.
  Other players' guesses are broadcast as colours only, never letters.
- Everything time-related (seconds left, penalties, who solved first) is
  computed in the `game` use cases and emitted as snapshots. A gateway never
  runs a timer of its own.
- Every domain exception maps to `{ code, message }` on the `error` event
  through the shared filter; never `try/catch` and swallow inside a handler.
- The validation pipe runs with `whitelist` + `forbidNonWhitelisted`: a new
  field in a payload must be declared in its DTO or the client gets rejected.
- Rate limit the chatty events (`game:guess`, `reaction:send`) per socket; the
  3 s emote cooldown is enforced here as well as in the use case.
