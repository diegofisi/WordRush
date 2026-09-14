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
  `player:solved`, `player:hint`, `player:left`, `time:penalty`,
  `reaction:show`, `round:end`, `game:end`, `session:replaced`) are
  store-driven: subscribe once in the store's `bind()` action, map the DTO
  there, and never turn one into an `api/` hook.
- `bind()` is guarded by a module-level flag so StrictMode's double-invoke
  cannot double-subscribe, and the listeners are never removed — these stores
  are app singletons that keep receiving events across route changes.
- **There is no React Query in this project.** Everything is socket-driven;
  the few request/response calls go through the same `request()` ack wrapper.
- The event names and payloads are owned by the backend's
  `src/shared/contract/index.ts`, mirrored byte-for-byte at
  `frontend/src/shared/contract/index.ts` by `pnpm sync-contract`. A DTO here
  is a type alias onto that contract; do not invent fields.
- Rival DTOs carry colours only. If a `letters` field ever appears for
  another player, the mapper drops it.
- Clock: stores keep `secondsLeft` and the server timestamp of the last
  snapshot; rendering derives the countdown. Never set a local timeout that
  ends a round.
