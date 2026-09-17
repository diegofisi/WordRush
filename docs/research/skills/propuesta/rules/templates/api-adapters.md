---
paths:
  - '<client>/src/**/api/**'
  - '<client>/src/**/stores/**'
  - '<client>/src/**/services/**'
---

# API adapters and stores (client)

Replace the `paths:` globs with this repo's real ones during binding; delete this
file if the repo has no client side.

- **The adapter owns the transport.** Components and hooks never import the HTTP
  client, the socket, or the query client directly. One folder per endpoint or
  event: the DTO (wire shape) plus a mapper `toModel`, and the hook that calls it.
  Hooks return domain models; the wire shape stops at the mapper.
- **Mappers live next to their DTO**, not in a shared `mappers.ts`. A field the UI
  does not need is dropped in the mapper.
- **Request/response and pushed events are different animals.** Request/response
  (fetch, RPC, emit-with-ack) is wrapped in the adapter hook. **Pushed events**
  (server push, subscriptions, websocket broadcasts) are **store-driven**:
  subscribed once in the store's `bind()` action, mapped there, and never turned
  into a per-component hook. A component that needs pushed data reads the store.
- **`bind()` is idempotent.** Guard it with a module-level flag so a double-invoke in
  development mode cannot double-subscribe. These stores are app singletons; they
  keep receiving while routes change.
- **Types come from the contract**, not from what the response happened to look like.
  A DTO here is a type alias onto the shared contract; do not invent fields and do
  not widen to `any` to make a build pass.
- **Server time is server time.** Store the value and the timestamp it was measured
  at; derive anything that ticks during render. Never run a local timer that decides
  a state transition the server owns.
- **Errors surface as domain errors.** The adapter converts a transport failure into
  the error shape the UI knows; components never inspect status codes.
- Whatever `project.md` says about the data-fetching library wins over the doctrine's
  examples, including "there is none".
