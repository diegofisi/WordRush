# Architecture — philosophy, directory structure, dependency rules

> **Applies:** always. The only conditional section is *Transport
> encapsulation*, whose shape depends on `project.md` → Transport.
>
> **Read this when:** creating a feature slice, deciding where a new file goes,
> or importing anything across features.

## Core philosophy

- **Separation of concerns:** logic (containers/hooks) != UI (components).
- **Domain integrity:** the UI layer **never** consumes DTOs. It consumes Domain
  Models produced by a mapper.
- **Vertical slicing:** one self-contained slice per business domain.
- **Co-location:** each endpoint or event owns its DTO, mapper and hook together.
- **No layout soup:** layout and text go through the repo's primitives. *If
  `project.md` declares a component kit* (MUI, shadcn, a house kit), raw `<div>`
  / `<p>` / `<h1>` in feature code is a bug. *If the repo styles with utility
  classes and has no layout primitive*, semantic tags with utility classes are
  the correct form — but colour and spacing still come from tokens, never
  literals (`conventions.md` → Theme).

## Directory structure

Vertical slices plus a shared layer. Placeholder names (`{feature}`, `Entity`);
the real feature map is in `project.md` → Feature map.

```text
src/
 ├── shared/ (or common/)   # name declared in project.md
 │    ├── components/        # shared primitives + page-state components
 │    ├── hooks/             # shared custom hooks
 │    ├── lib/ · helpers/    # utilities
 │    ├── config/            # app-wide config (query client, env)
 │    ├── stores/            # app-wide UI stores (theme, language, toasts)
 │    ├── models/            # shared types and tokens
 │    ├── theme/             # theme / token wiring
 │    ├── i18n/              # dictionaries, if the project has an i18n layer
 │    └── routes/            # SHELL layer: router, path constants, AppShell
 │
 ├── core/                   # optional: cross-cutting runtime the app cannot boot without
 │    └── {concern}/         # e.g. session: identity + transport lifecycle
 │
 ├── features/
 │    └── {feature}/
 │         ├── api/          # one folder per endpoint/event: DTO + mapper + hook
 │         ├── components/   # presentational
 │         ├── containers/   # smart, thin — only when a page has 2+ connected units
 │         ├── models/ | interfaces/   # Domain Models + mappers (name in project.md)
 │         ├── helpers/      # schemas, pure utils
 │         ├── hooks/        # custom hooks (NOT data-layer hooks — those live in api/)
 │         ├── stores/       # stores scoped to this slice
 │         ├── pages/        # composition roots
 │         └── index.ts      # only if this slice exposes a sanctioned facade
 │
 └── main.tsx                # providers + router + global wiring
```

### Purpose of each folder inside a feature

| Folder | Purpose |
|---|---|
| `api/` | One subfolder per endpoint or ack'd event. Holds the DTO file (wire shape) and the `use{Action}` hook. The transport client is imported **only** here and in `stores/`. |
| `components/` | Presentational. Props in, JSX out, local ephemeral UI state allowed. |
| `containers/` | Smart and **thin**: call a hook, wire its result to components. |
| `models/` \| `interfaces/` | Domain Models (camelCase, clean types) with their mapper co-located. The folder name and the mapper name are house style — see `project.md`. |
| `pages/` | Composition root for a route. The only layer that renders containers. |
| `stores/` | Client/UI and live-process state, in Domain Models. |
| `hooks/` | Custom hooks only. |
| `helpers/` | Validation schemas and pure functions. |

Not every feature needs every folder. Create only what the feature uses; a slice
with no `containers/` folder is correct when all its pages are single-operation.

## Cross-feature data access — no cross-imports

Features **never** import from other features, with one sanctioned exception:
**app-level shared contracts** exposed through a feature's `index.ts` facade —
a queue store other features enqueue into, a session hook, a chat widget. **The
list of sanctioned facades lives in `project.md`; anything not on it is
forbidden.** Deep paths (`@/features/{other}/stores/...`) are always forbidden,
even into a facade feature.

*If the repo has `eslint-plugin-boundaries` (or equivalent), configure it to
enforce this.* Otherwise it is convention, and reviewing it is on you.

For anything else, create a **local adapter** inside the consuming feature that
calls the same endpoint directly:

- it maps only the fields it needs, not the source feature's full model;
- it uses a distinct cache key (if there is a cache) so it cannot collide;
- its DTO may be minimal.

```typescript
// features/{feature-b}/api/get-entity-options/useEntityOptions.ts
// Same backend endpoint feature-a uses, owned by feature-b.
// Data-layer flavour (React Query):
export const useEntityOptions = () =>
  useQuery({
    queryKey: ["{feature-b}", "entityOptions"], // distinct key, no collision
    queryFn: fetchEntityOptions,                // this feature's own fetcher
    select: toEntityOptions,                    // only the fields this feature renders
  });

// No-data-layer flavour: the same three pieces, without the cache —
// fetcher + mapper called from a store action or a small custom hook.
```

**Why not share the hook?** If the source feature changes its DTO, it must not
break consumers. That duplication is the point.

## Dependency rules

| From | May import | Never imports |
|---|---|---|
| `shared/` (except routes) | `shared/` only | anything in `features/` |
| shell (`shared/routes`) | `shared/`, shell, feature `index.ts` facades and `pages/*` | feature internals |
| `core/{concern}` | `shared/`, own concern | `features/` |
| `features/{feature}` | `shared/`, `core/` facades, own slice, path constants, sanctioned facades via `index.ts` | any other cross-feature path |
| `main.tsx` | everything | — |

Within a feature the layering still applies: components stay props-only,
containers connect hooks/stores to components, pages are the only layer that
renders containers — containers never render containers.

Cross-feature communication happens through the sanctioned facades, cache
invalidation, or route navigation with path constants. **Never a global event
bus for app logic** (`state.md` → Migrating off an event bus).

## Transport encapsulation

Whatever the transport is — an axios/fetch client, a socket instance, a Tauri
`invoke`, an SDK — **it is imported only by `api/` and `stores/`**. Components,
containers and pages consume data exclusively through hooks and store selectors
that return Domain Models.

Add a `no-restricted-imports` lint rule for the transport module and, if there is
one, for the data-layer primitives. `project.md` → Transport names the exact
module path to restrict.

## Layer summary

| Layer | Knows about | Example |
|---|---|---|
| Page | routes, dialog state, containers | `EntityListPage` owning the delete-confirm state |
| Container | hooks + stores → props | `EntityListContainer` |
| Component | props only (Domain Models) | `EntityCard`, `EntityListRow` |
