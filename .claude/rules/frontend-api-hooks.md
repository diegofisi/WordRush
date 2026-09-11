---
paths:
  - 'frontend/src/**/api/**'
  - 'frontend/src/**/stores/**'
---

# Adapters (api/) and stores

- One folder per event or endpoint: `<verb>-<thing>.dto.ts` (payload / ack
  shape + mapper `toModel`) and `use<Verb><Thing>.ts`. Mappers live in the
  DTO file, never in a separate file, and hooks return domain models.
- **Socket emits with ack** are wrapped in a promise inside the hook; the
  component never touches `socket` directly. The socket instance is imported
  only from `@/core/session/lib/socket`, and only from `api/` or `stores/`.
- **Pushed events** (`lobby:update`, `round:start`, `player:progress`,
  `player:solved`, `time:penalty`, `reaction:show`, `round:end`, `game:end`)
  are store-driven: subscribe once in the store's `connect()` action, map the
  DTO there, and never mirror them into React Query.
- React Query only for request/response calls that are not events (room
  lookup, health). Mutations use `mutate` with `onSuccess`/`onError` and
  explicit `invalidateQueries`.
- The event table and payloads are owned by the backend:
  `.claude/skills/backend/references/project.md` → Socket contract. A DTO
  here mirrors one row of that table; do not invent fields.
- Rival DTOs carry colours only. If a `letters` field ever appears for
  another player, the mapper drops it.
- Clock: stores keep `secondsLeft` and the server timestamp of the last
  snapshot; rendering derives the countdown. Never set a local timeout that
  ends a round.
