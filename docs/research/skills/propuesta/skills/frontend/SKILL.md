---
name: frontend
description: >
  React frontend doctrine: vertical slices, container/presentational, adapters
  over any transport (HTTP, React Query, WebSocket stores); the UI kit and data
  layer of the repo are declared in references/project.md. Use when asked to
  create or modify a component, page, view, hook, store, form, route, feature
  slice, DTO, ViewModel, i18n string, theme token or any React/TSX work —
  including Tailwind, MUI, shadcn, Zustand, React Query, react-hook-form, zod,
  react-router or socket code.
---

# Frontend

Portable React architecture doctrine: vertical slices, the Adapter Pattern,
Container/Presentational, stores, routing. It is written to survive a change of
UI kit and a change of data layer, so **no doctrine file names the library the
current repo uses** — that is declared once, in `references/project.md`.

## Order of reading

1. **`references/project.md` first**, always, when the repo has one. It declares
   the stack, the feature map, the sanctioned facades, the verification commands,
   and an *Applies / does not apply* table over the topics below. It **wins** over
   any doctrine file; the code wins over it (and then you fix the file).
2. **`references/pitfalls.md`** before finishing any change — universal traps.
   If the repo has `references/project-pitfalls.md`, read that too.
3. Only the doctrine files the workflow names (index below).

**No `project.md` in this skill?** Do not guess the stack from the doctrine's
examples. Run the bind skill in `../bind-project/`, or read `package.json`,
`eslint.config.*` and one existing feature slice, and write `project.md` from
what is actually installed before writing code.

## Topic index

| Reference file | Covers | Read it when | Conditional on |
|---|---|---|---|
| `references/project.md` | Stack, feature map, facades, applies/does-not-apply, verify commands | Always, first | — |
| `references/pitfalls.md` | Universal traps already paid for | Before finishing any change | — |
| `references/project-pitfalls.md` | This repo's own ledger | Before finishing any change | repo has one |
| `references/architecture.md` | Slice layout, folder purposes, dependency rules, cross-feature access | Creating a slice, placing a file, importing across features | — |
| `references/data-flow.md` | Adapter Pattern (DTO → mapper → model → hook), `api/` layout, endpoint classification, push events | Any hook that touches a backend endpoint or event | query sections: React Query |
| `references/containers-pages.md` | Container/component boundary, pages, orchestrators, hook extraction | Writing containers, pages, or extracting hooks | — |
| `references/components.md` | Presentational rules, layout/typography, size limits, folder organization, state components | Writing any JSX | typography/primitives: UI kit |
| `references/state.md` | Store rules, live-process stores, anti-race patterns | Stores, schedulers, anti-race logic | external store lib |
| `references/forms.md` | Schema + form-library wiring, and the no-library fallback | Any form | react-hook-form + zod |
| `references/routing-shell.md` | Path constants, flat router, app shell | Routes, nav, shell | a router lib |
| `references/conventions.md` | Naming, copy/i18n, theme, const-object enums, DO/DON'T | Naming anything; final review | i18n/theme sections |
| `references/web-app-patterns.md` | HTTP client/interceptors, auth store, role routing, permissions | Apps with login and roles | auth/roles |

## Workflow A — New feature slice

1. Scaffold `src/features/{name}/` with only the folders it uses (`api/`,
   `models/`|`interfaces/`, `components/`, `pages/`, plus `containers/`,
   `stores/`, `hooks/`, `helpers/` on demand) — `architecture.md` → Directory
   structure. The names of the model folder and the mapper live in `project.md`.
2. Implement in data-flow order: DTO + mapper → Model → hook or store → (schema)
   → container → component → page.
3. Register the route in the shell layer, path constant first — `routing-shell.md`.
4. No cross-feature imports. Duplicate a minimal local hook instead; the only
   exception is a facade listed in `project.md` → Sanctioned facades.

## Workflow B — New endpoint / event adapter

1. Confirm the endpoint or event exists in the backend contract (`project.md`
   points at it). Never invent a field.
2. Classify it with `data-flow.md` → Endpoint classification: query / mutation /
   infinite / **store-driven**.
3. *If `project.md` declares React Query*: queries map with `select`, mutations
   map inside `mutationFn`, typed `<TQueryFnData, TError, TData>`.
   *If it declares no data-fetching library*: the hook is a plain async function
   plus local state, or a store action — same DTO/mapper/model layering.
4. *If the transport pushes events* (socket, SSE, broker): pushed events are
   **store-driven** — subscribe once in the store's `bind()`, map the DTO there,
   never wrap one in a fetch hook. Only request/response (emit-with-ack, HTTP)
   gets an `api/` folder.

## Workflow C — New page

| Situation | Pattern |
|---|---|
| One operation (one form / one list) | **A — page absorbs**: page uses hooks directly, no container |
| One operation, heavy logic | **C — page + custom hook** in `hooks/` |
| Several operations (dialogs, tabs) | **B — page orchestrates** leaf containers; page owns dialog state |

Never a thin wrapper page around a single container. Register route + path
constant + nav entry (`routing-shell.md`).

## Workflow D — New component

1. Presentational: props in (Domain Models, never DTOs) + **local ephemeral UI
   state only**; no fetching, mutations, stores, toasts, or business `useMemo`.
   The boundary test is in `containers-pages.md` → Container/Component boundary.
2. *If `project.md` declares a UI kit*: text and layout go through its primitives
   and its styling API; never raw tags or hand-rolled re-implementations.
   *Otherwise*: use the repo's own primitives (`project.md` → UI primitives) and
   semantic tags with the repo's styling system. Either way: no hardcoded
   colour/spacing literals at the call site.
3. Size limits (`components.md`): >~200 JSX lines → extract sub-components; >10
   props → regroup; internal helper >~20 JSX lines → own file.
4. `components/` >~8 files → semantic subfolders by consumer view; max 2 levels.
5. Loading / error / empty come from the repo's state components
   (`project.md` → UI primitives). Keep them inside the content area — do not
   early-return the whole layout.

## Workflow E — New store

1. Stores hold client/UI state and **live-process** state. Request/response server
   data belongs to the data layer if the repo has one — check `data-flow.md` →
   Endpoint classification first.
2. `features/{feature}/stores/use{Domain}Store.ts`: typed State + Actions,
   `reset()`, initial state derived by a helper (never hardcode what comes from
   `localStorage`) — `state.md` → Derived initial state.
3. Non-React callers (schedulers, listeners, interceptors) use
   `use{X}Store.getState()` / `.setState()`.
4. Subscriptions live in a `bind()` guarded by a module-level flag (StrictMode
   double-invokes); live-process rules in `state.md` → Live-process stores.

## Bind to this project

`references/project.md` is not optional documentation — it is the half of this
skill that knows the repo. Create or refresh it with the sibling skill
**`../bind-project/`**, which produces `project.md` from
`references/project.md.template` and opens `project-pitfalls.md` from
`references/project-pitfalls.md.template`. A worked pair for a socket-driven,
Tailwind, no-React-Query repo is in `references/examples/`.

When the code and `project.md` disagree, the code wins — and fixing the file is
part of the change.

## Validation

Run the repo's verification command from `project.md` → Verification commands
(typically one `verify` script wrapping typecheck, lint, tests and build). Do not
substitute a prose checklist for it, and do not claim a change is done before the
command has passed. If a script fails for tooling reasons, read `package.json`
for its current form instead of assuming.

Two things no command checks, so they are on you: cross-feature imports beyond
the sanctioned facades, and DTOs leaking past the mapper. Both are in
`pitfalls.md`.
