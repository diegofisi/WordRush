---
name: frontend
description: >
  React frontend architecture doctrine. Use when asked to create or modify a
  view, page, component, hook, store, form, route, feature slice, or any React
  UI work. Covers vertical slices, Container/Presentational, stores, and the
  Adapter Pattern over whatever the transport is. The doctrine's examples are
  written in MUI + React Query; what THIS repo actually uses is in
  references/project.md, which is read first and wins.
---

# Frontend (React 19)

Portable React architecture doctrine. Its examples are written against
**MUI 5 + React Query + axios**, which is where it came from — that is a
vocabulary for the patterns, **not** a description of the repo you are in.

WordRush is React 19 + Vite + **Tailwind v4** with hand-made primitives,
**Zustand**, **socket.io** and **no React Query**, and it does have an ES/EN
i18n layer. Every one of those mappings lives in `references/project.md`, which
you read **first** and which wins wherever it disagrees with a doctrine file.

## How to use this skill

1. **Always read `references/project.md` first** when working in a repo that has
   one — it binds the doctrine to the project (feature map, real endpoint table,
   sanctioned facades, house conventions). Doctrine files are project-agnostic;
   when reusing this skill in another project, replace or delete `project.md`.
2. Pick the workflow below that matches the task.
3. Open only the reference files that the workflow lists (topic index below).

## Topic index

| Reference file | What it covers | When to read it |
|---|---|---|
| `references/project.md` | Project binding: feature map, endpoint table, facades, conventions | Always, first, if present |
| `references/architecture.md` | Philosophy, directory structure, folder purposes, dependency rules, cross-feature access | Creating a feature slice, placing any file, importing across features |
| `references/data-flow.md` | Adapter Pattern (DTO → mapper → model → hook), API subfolders, query/mutation hooks, endpoint classification, push events | Writing any hook that touches a backend endpoint or event |
| `references/containers-pages.md` | Containers, pages, orchestrators, page complexity patterns, custom-hook extraction | Writing containers, pages, or extracting hooks |
| `references/components.md` | Presentational components, layout/typography primitives, size limits, folder organization, state components | Writing any JSX |
| `references/state.md` | Zustand rules, live-process stores, anti-race patterns | Touching stores, schedulers, or anti-race logic |
| `references/forms.md` | Zod schemas + react-hook-form wiring | Any form |
| `references/routing-shell.md` | Path constants, flat router, app shell, desktop (Tauri) shell specifics | Routes, sidebar, shell, window chrome |
| `references/conventions.md` | Naming, i18n, theme, const-object enums, full DO/DON'T list | Naming anything; final review of any change |
| `references/web-app-patterns.md` | HTTP client/interceptors, auth store, role-based routing, permissions | Only for web projects with auth/roles; never for desktop apps |

## Workflow A — New feature slice

1. Scaffold `src/features/{name}/` with only the folders needed (`api/`, `models/`, `components/`, `pages/`, plus `containers/`, `stores/`, `hooks/`, `helpers/` on demand) — tree in `references/architecture.md` → Directory structure.
2. Implement in data-flow order: DTO + mapper → Model → hook → (schema) → container → component → page.
3. Register the page route in the shell layer (path constant first) — `references/routing-shell.md`.
4. Never import from another feature; duplicate a minimal local hook instead — `references/architecture.md` → Cross-feature data access. Sole exception: the sanctioned facades listed in `references/project.md`.

## Workflow B — New endpoint hook (adapter)

1. Confirm the endpoint/command exists in the backend contract (`references/project.md` points to it).
2. Classify it with the archetype table in `references/data-flow.md` → Endpoint classification: query / mutation / infinite query / store-driven. Store-driven endpoints NEVER get a React Query hook.
3. Create `features/{feature}/api/{endpoint}/`:
   - `{endpoint}.dto.ts` — TS mirror of the transport shape + `to{Model}` mapper.
   - `use{Action}.ts` — fetcher call in `queryFn`/`mutationFn`, `select: toModel` (queries) or mapper inside `mutationFn` (mutations).
4. In this repo the transport **is** websockets: anything the server pushes is store-driven (subscribe in the store's `bind()`), and only emit-with-ack gets an `api/` folder. Never poll — `references/project.md` → Transport.

## Workflow C — New page

| Situation | Pattern |
|---|---|
| One operation (one form / one list) | **A — page absorbs**: page uses hooks directly, no container. |
| One operation, heavy logic | **C — page + custom hook** in `hooks/`. |
| Several operations (dialogs, tabs) | **B — page orchestrates** leaf containers; page owns dialog state. |

Never a thin wrapper page around a single container. Register route + path constant + nav entry (`references/routing-shell.md`).

## Workflow D — New component

1. Presentational only: props in (Domain Models, never DTOs), JSX out. No API calls, no toasts, no business `useMemo`.
2. Presentational: props in (Domain Models) + **local, ephemeral UI state only**
   (toggles/hover/refs/own-popover); no data fetching, mutations, stores, or toasts.
   Text via MUI `<Typography variant="...">` (no raw `<h1>`/`<p>`/`<span>`);
   layout via MUI `<Stack>`/`<Grid>`/`<Box>` (no raw `<div>` soup); styling via
   `sx` + theme/`Palette` (no hardcoded hex). The Container/Component boundary
   rule is in `references/containers-pages.md` → The Container/Component boundary
   (universal rule).
3. Size limits (`references/components.md` → Size limits & extraction): >~200 JSX lines → extract sub-components; >10 props → regroup; internal helper >~20 JSX lines → own file.
4. `components/` >~8 files → semantic subfolders by consumer view; max 2 nesting levels (`references/components.md` → Folder organization).
5. Loading/error/empty → MUI `CircularProgress` / `Alert` (and, when repeated, a shared `PageLoading`/`PageError`/`PageEmpty` in `common/components/`) — `references/components.md` → Shared state components. Keep states inside the content area, don't early-return the whole layout.

## Workflow E — New store

1. Only client/UI state or live-process state. Server snapshots belong to React Query — check `references/data-flow.md` → Endpoint classification first.
2. `features/{feature}/stores/use{Domain}Store.ts`: typed State + Actions, `reset()`, derived initial state via helper (never hardcode values that come from `localStorage`) — `references/state.md` → Derived initial state.
3. Non-React callers (schedulers, event listeners) use `use{X}Store.getState()` / `.setState()`; React Query cache access from stores goes through the exported `queryClient` singleton.
4. Live-process rules (scheduler, run-sequence guards, single-flight): `references/state.md` → Live-process stores.

## Validation checklist (before finishing any task)

Run the project's verification commands — read them from `references/project.md`
→ Verification commands, not from memory. Here that is `pnpm typecheck`,
`pnpm lint`, `pnpm build`, plus `pnpm check-contract` from the repo root. If a
script fails for tooling reasons, check `package.json` for its current form
instead of assuming.

Also verify: no cross-feature imports beyond the sanctioned facades — nothing
lints this on the frontend, so it is on you; no DTO reaching a component; no
hardcoded route strings (use `shared/routes/paths.ts`); the socket imported only
from `api/` and `stores/`; no raw hex and no `var(--x)` in a `className`; and
every user-facing string coming from the `es`/`en` dictionary rather than typed
inline.
