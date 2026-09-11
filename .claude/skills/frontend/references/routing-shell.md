# Routing & Shell — path constants, flat router, app shell

> **Read this when:** adding or changing routes, the sidebar/nav, or the app
> shell. This is a **browser** app (React 19 + Vite + react-router-dom v6). Covers
> the path-constants rule, the flat single-shell router, and the app shell.

For **role-based routing, guards, and permissions** see `web-app-patterns.md`.
What always applies, in every project: the **path constants rule** and
exhaustive route-object typing. Path constants and route objects live in
`src/common/routes/`, grouped by feature area.

## Path constants (universal rule)

```typescript
// common/routes/CardHolderManagement/cardholder-path.ts
// const-object enum — the real map lives per feature area
export const CardholderPath = {
  ROOT: "/cardholder/",
  OVERVIEW: "/cardholder/overview",
  CARDS: "/cardholder/cards",
  DETAILS: "/cardholder/details",
  ANY: "*",
} as const;

export type CardholderPath = keyof typeof CardholderPath;
```

- Always `navigate(CardholderPath.CARDS)` (via `useNavigate`) / `<Navigate to={CardholderPath.DETAILS} />`. **NEVER** hardcode `"/cardholder/cards"`.
- `as const` + `keyof typeof` gives the key union; use `{ [key in CardholderPath]: Route }` for a typed route map, so adding a path without a route object is a compile error.

## Router — flat, one shell

```typescript
// common/routes/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { CardholderPath } from "./CardHolderManagement/cardholder-path";

export const router = createBrowserRouter([
  {
    element: <AppShell />,                       // nav + <Outlet />
    children: [
      { path: CardholderPath.ROOT, element: <Navigate to={CardholderPath.OVERVIEW} replace /> },
      { path: CardholderPath.OVERVIEW, element: <OverviewPage /> },
      { path: CardholderPath.CARDS, element: <CardsPage /> },
      { path: CardholderPath.DETAILS, element: <DetailsPage /> },
      { path: CardholderPath.ANY, element: <Navigate to={CardholderPath.OVERVIEW} replace /> },
    ],
  },
]);
```

- `createBrowserRouter` — this is a server-served browser app, so standard history routing (not hash).
- One `AppShell` for everything; nested feature route folders mount under it.
- Cross-view intents ("open view X prefilled with this data") are **router state**: `navigate(CardholderPath.X, { state: { ... } })`; the target page reads `location.state` and acts. Never a global bus event.
- **Keep live-process wiring out of routes**: global listeners and long-lived stores live above the router (see `data-flow.md`), so navigation never interrupts running work.

### Route registry vs router assembly (+ lazy pages)

Split the **registry** ("what routes exist") from the **assembly** ("how the
router is built"), and code-split each page. The registry is the single source of
truth — add a page by adding one route object.

```tsx
// common/routes/CardHolderManagement/cardholder-routes.tsx — the registry (data)
import { lazy, Suspense, type ComponentType } from "react";
import { PageLoading } from "@/common/components/PageLoading";
import { CardholderPath } from "./cardholder-path";

type LoadPage = () => Promise<{ default: ComponentType }>;

function route(path: string, label: string, load: LoadPage) {
  const Page = lazy(load);
  return { path, label, element: <Suspense fallback={<PageLoading />}><Page /></Suspense> };
}

export const cardholderRoutes = [
  route(CardholderPath.OVERVIEW, "Overview", () => import("@/features/cardholder/pages/OverviewPage").then((m) => ({ default: m.OverviewPage }))),
  route(CardholderPath.CARDS, "Cards", () => import("@/features/cardholder/pages/CardsPage").then((m) => ({ default: m.CardsPage }))),
  // one route object per page; `.then` picks the named export (type-checked)
];
```

```tsx
// common/routes/router.tsx — the assembly (thin)
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: CardholderPath.ROOT, element: <Navigate to={CardholderPath.OVERVIEW} replace /> },
      ...cardholderRoutes,
      { path: CardholderPath.ANY, element: <Navigate to={CardholderPath.OVERVIEW} replace /> },
    ],
  },
]);
```

- **Do split registry from assembly** — decoupling "what routes exist" from "how
  they mount" is a real separation of concerns; lazy pages keep the initial bundle small.
- **Don't fragment the registry into a file/folder per route.** A route object is
  pure data (path → page); the page and its logic already live in its feature
  slice — there is no concern to decouple. One readable list beats N one-line files.
- **More structure DOES pay off when a real concern appears**: guards/permissions,
  multiple layouts, or role-based route groups each become their own files
  (`guards/`, `layouts/`, route-group modules) — that is `web-app-patterns.md`
  territory (multi-user apps with auth/roles).

## AppShell

Lives in `src/common/routes/` (the "shell" layer — see `architecture.md` →
Dependency rules). Built with MUI layout primitives.

```text
AppShell (MUI Box / Stack)
 ├── AppBar / Header      # brand + user menu
 ├── Sidebar              # nav + live badges + status banner
 └── <Box component="main"><Outlet /></Box>
```

### Sidebar

| Element | Source of truth |
|---|---|
| Nav items | static list `{ path: CardholderPath.X, label, icon }`, rendered with `<NavLink>` (active style from `isActive`, applied via MUI `sx`) |
| Section title | derive from the matched route (or per-page heading) — never a manual "current view" variable |
| Live badge (e.g. active count) | a store selector (`useSomeStore(selectActiveCount)`) — hidden when 0 |
| Status banner (e.g. "session expired") | derives from a status query + local dismissed state |
| Theme toggle | ui store action (see `conventions.md` → Theme) |

- Layout with MUI `Box`/`Stack`/`Grid`; text via MUI `Typography`. Styling via the `sx` prop — no Tailwind/Shadcn.

## Do / Don't

| Do | Don't |
|---|---|
| Path constants everywhere (`CardholderPath.X`) | Hardcoded path strings |
| `useNavigate` / `<Navigate>` from react-router-dom v6 | `window.location.href` for in-app nav |
| One flat route list under one `AppShell` | Ad-hoc nested routers per page |
| Router state for cross-view intents (prefill) | A global bus event for navigation |
| MUI `Box`/`Stack` + `sx` for shell layout | Tailwind classes / Shadcn components |
| Route objects `{ path, element, label }` in `common/routes/` | Route definitions scattered in feature files |
