---
paths:
  - '<server>/src/**/presentation/**'
  - '<server>/src/**/*.controller.ts'
  - '<server>/src/**/*.gateway.ts'
  - '<server>/src/**/*.resolver.ts'
---

# Presentation layer (controllers, gateways, resolvers)

Replace the `paths:` globs with this repo's real ones during binding; delete this
file if the repo has no server side.

- **Handlers are thin.** Validate the payload → call one use case → return its
  result. No business rule, no persistence call, no shared-state mutation, no timer
  in this layer. If a handler needs an `if` about the domain, that `if` belongs in
  the use case.
- **Every inbound payload is a validated DTO.** No `any`, no reading raw request
  bodies. Validation runs with unknown fields rejected, not stripped silently, so a
  client sending a field the server does not declare fails loudly.
- **The contract is owned in one place** — the file or package named in
  `project.md`. Adding or renaming an endpoint, event or payload field means editing
  that file, bumping its version marker if it has one, regenerating or syncing the
  client copy, and changing the client in the same commit. Never hand-edit a
  generated or mirrored contract file.
- **Never leak what the client must not know.** Server-only state (answers, other
  users' private data, internal ids) is stripped in the mapper, not in the UI. If a
  field exists on the domain object and not in the DTO, that is the point.
- **Errors map through the shared filter** to one documented shape. No `try/catch`
  that swallows inside a handler, no ad-hoc error payloads.
- **Rate-limit floodable endpoints and events.** Limits that are a business rule
  (per user, per account) live in the use case — a connection is not a user, and
  reconnecting must not reset a limit. Transport-level limits (per IP, per socket)
  live here.
- **No new dependency injected into a handler** that the use case could hold
  instead.
