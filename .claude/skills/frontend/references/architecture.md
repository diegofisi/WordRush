# Architecture — Core philosophy, directory structure, dependency rules

> **Read this when:** creating a feature slice, deciding where a new file goes,
> or importing anything across features. Covers the vertical-slice layout, the
> purpose of every folder, and the import-boundary rules.

## Core philosophy

We prioritize **Separation of Concerns**, **Domain Integrity**, and **Composition**.

- **No Div Soup:** strictly avoid raw `<div>` for layout. Use MUI Layout Primitives (`Stack`, `Grid`, `Box` from `@mui/material`).
- **Smart vs. Dumb:** logic (Containers) != UI (Components).
- **Domain Integrity:** the UI layer **NEVER** consumes DTOs directly. It only consumes **Domain Models** (`{Name}ViewModel`).
- **Vertical Slicing:** features are self-contained domains — one slice per business domain.
- **Co-location:** each backend endpoint owns its DTO and React Query hook in a single subfolder.

## Directory structure

Vertical slices + a shared layer. The tree below uses structural placeholder
names (`{feature}`, `Entity`) — the real feature map for the current project
lives in `project.md`.

```text
src/
 ├── common/
 │    ├── components/         # shared MUI-based components + PageLoading/PageError/PageEmpty
 │    ├── hooks/              # shared custom hooks
 │    ├── helpers/            # utilities, i18n helper
 │    ├── config/            # query-client.ts and app-wide config
 │    ├── stores/             # app-wide UI stores (e.g. useUiStore: lang + theme)
 │    ├── models/             # shared types (e.g. palette.ts → Palette const)
 │    ├── theme/              # theme.ts (MUI theme) + palette wiring
 │    └── routes/             # SHELL layer: router.tsx, app-path.ts, AppShell (see routing-shell.md)
 │
 ├── features/
 │    ├── {feature}/          # example slice: list + detail + mutations
 │    │    ├── api/
 │    │    │    ├── http-client.ts        # axios instance + fetchAuthSession interceptor
 │    │    │    └── Entity/               # PascalCase domain folder
 │    │    │         ├── GetEntities/     # GetEntitiesDTO.ts + useGetEntities.ts
 │    │    │         └── UpdateEntity/    # UpdateEntityDTO.ts + useUpdateEntity.ts
 │    │    ├── components/    # EntityCard.tsx, EntityListTable.tsx (dumb)
 │    │    ├── containers/    # EntityListContainer.tsx (smart) — only if the page grows multiple operations
 │    │    ├── interfaces/    # entity.interface.ts → EntityViewModel + transformEntityToViewModel
 │    │    ├── helpers/       # entity-form.schema.ts, pure utils
 │    │    ├── hooks/         # custom hooks (NOT React Query hooks — those live in api/)
 │    │    ├── stores/        # Zustand stores scoped to this feature
 │    │    ├── index.ts       # only if this slice exposes a sanctioned facade (see below)
 │    │    └── pages/         # EntityListPage.tsx
 │    └── {other-feature}/    # one folder per vertical slice
 │
 └── main.tsx                 # QueryClientProvider + RouterProvider + ThemeProvider + global wiring
```

### Purpose of each folder inside a feature

| Folder | Purpose | Example |
|---|---|---|
| `api/` | **PascalCase `{Domain}/{Endpoint}/` subfolders.** Each contains a `{Name}DTO.ts` (Request/Response DTO types) and a `use{Action}.ts` React Query hook. Also holds `http-client.ts` (axios instance). | `api/Entity/GetEntities/GetEntitiesDTO.ts`, `api/Entity/GetEntities/useGetEntities.ts` |
| `components/` | **Dumb/presentational.** Only receive props, no logic. MUI-based. | `EntityCard.tsx`, `EntityListRow.tsx` |
| `containers/` | **Smart.** Connect hooks/stores to presentational components. Single responsibility: flat file. Multiple operations: folder with orchestrator + leaves (see `containers-pages.md`). | `EntityListContainer.tsx` |
| `interfaces/` | **Domain Models** optimized for the frontend (`{Name}ViewModel`, camelCase, clean types) **with their mapper `transform{Name}ToViewModel` co-located** in the same file. Also props/event/contract types. | `entity.interface.ts` → `EntityViewModel` |
| `pages/` | **Composition Root.** Orchestrates containers, manages inter-container state (dialogs, selections). Only layer that imports containers. | `EntityListPage.tsx` |
| `stores/` | Zustand stores. UI/live-process state using **Domain Models**. | `useJobQueueStore.ts` |
| `hooks/` | **Custom hooks only** (NOT React Query hooks — those live in `api/`). | `useEntityFilters.ts` |
| `helpers/` | **Zod schemas** and pure utility functions for the feature. | `entity-form.schema.ts` |

> Not every feature needs all folders. Only create the folders the feature actually uses. Note that **Domain Models live in `interfaces/`** as `{Name}ViewModel`, alongside their mapper — there is no separate `models/` folder inside a feature.

## Cross-feature data access — no cross-imports

Features must **never** import from other features, with ONE sanctioned
exception (enforce it with `eslint-plugin-boundaries`): **app-level shared
contracts** exposed via a feature's `index.ts` **facade** — e.g. a job-queue
store other features enqueue into, a session/auth status hook, or a prefill
contract. **List the sanctioned facades in `project.md`.** Deep paths
(`@/features/{feature}/stores/...`) always fail lint, even into a facade
feature. For anything else, create a **local hook** inside the consuming
feature that calls the endpoint directly.

**Why not share the hook?** Cross-feature imports create coupling: if the
source feature changes its DTO or ViewModel, it must not break consumers. Each
feature owns its own adapter for the data it consumes.

Rules:
- The local hook maps only the **fields it needs** (not the source feature's full ViewModel).
- Use a **distinct `queryKey`** to avoid cache collisions with the source feature's hooks.
- The DTO/mapper can be minimal — only what the consuming feature actually uses.

```typescript
// features/{feature-b}/api/Entity/GetEntityOptions/useEntityOptions.ts
// Calls the same backend endpoint {feature-a} uses, but lives in {feature-b}.
export function useEntityOptions() {
  return useQuery({
    queryKey: ["{feature-b}", "entityOptions"], // distinct key, no collision
    queryFn: fetchEntities,                     // this feature's own fetcher
    select: toEntityOptions,                    // maps only the fields this feature renders
  });
}
```

When several features consume the same endpoint, there is no "shared preview
slice": each consumer owns its **own local hook** in its own `api/` folder, with
its own trimmed DTO. That duplication is the point — no feature imports another
feature's DTOs, ViewModels, or hooks outside the sanctioned facades. Ever.

## Dependency rules

Enforced by `eslint.config.js` (`eslint-plugin-boundaries`) with four element
types — `main` (`src/main.tsx`), `shell` (`src/common/routes` — the app
composition layer), `common` (shared), `features`:

| From | May import | Never imports |
|---|---|---|
| `common/` (except routes) | `common/` only | anything in `features/` |
| `shell` (`common/routes`) | `common/`, `shell`, feature `index.ts` facades and `pages/*.tsx` | feature internals |
| `features/{feature}` | `common/`, own slice, `common/routes/app-path.ts`, and the sanctioned facades (per `project.md`) via `index.ts` only | any other cross-feature path (deep paths always) |
| `main.tsx` | everything | — |

Within a feature, the layering still applies: components stay props-only
(ViewModels + the shared i18n helper); containers connect hooks/stores to
components; pages are the only layer that renders containers — containers never
render containers.

Cross-feature communication: the sanctioned facades, React Query cache
(invalidation), or route navigation with path constants — nothing else. Never a
global event bus for app logic (see `state.md` → Migrating off an event bus).

### Transport encapsulation (web / HTTP)

This is a web app. Transport is a **per-feature axios instance**
(`features/{feature}/api/http-client.ts`) whose request interceptor calls AWS
Amplify `fetchAuthSession` and injects the Cognito `idToken` as the
`Authorization` header. Add a **transport-encapsulation lint rule**
(`no-restricted-imports`): the axios `httpClient` and React Query primitives may
only be imported by each feature's `api/` and `stores/` layers — **never** by
components, containers, or pages. Those layers consume data exclusively through
the `use{Action}` hooks, which return **Domain Models** (`{Name}ViewModel`),
never raw DTOs.

## Layer summary (page / container / component)

| Layer | Knows about | Typical example |
|---|---|---|
| Page | routes, dialog state, containers | `EntityListPage` owning the delete-confirm dialog state |
| Container | hooks + stores → props | `EntityListContainer` (list query + row actions → `EntityListTable`) |
| Component | props only (Domain Models) | `EntityCard`, `EntityListRow`, `EntityForm` |

Not every feature needs all folders — create only what the feature uses.
