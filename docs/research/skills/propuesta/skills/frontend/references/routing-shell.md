# Routing & shell — path constants, flat router, app shell

> **Applies:** the *Path constants* rule and the *route registry vs assembly*
> split are universal for any router. The code samples use **react-router v6/v7**
> (`createBrowserRouter`); if `project.md` declares another router, translate the
> shape. Guards, roles and permissions live in `web-app-patterns.md` and apply
> only to apps with auth.
>
> **Read this when:** adding or changing routes, the nav, or the app shell.

## Path constants (universal rule)

```typescript
// shared/routes/paths.ts
export const AppPath = {
  ROOT: "/",
  ROOM: "/room/:code",
  DETAILS: "/details",
  ANY: "*",
} as const;

export type AppPath = (typeof AppPath)[keyof typeof AppPath];

// Builders for parameterised paths — the only place a segment is interpolated
export const pathForRoom = (code: string) => `/room/${code}`;
```

- Always `navigate(AppPath.DETAILS)` / `<Navigate to={AppPath.ROOT} />`. **Never**
  a hardcoded string, and never a template literal built at the call site — add a
  builder next to the constants.
- `as const` + `keyof typeof` gives the key union; a typed route map
  (`{ [key in keyof typeof AppPath]: Route }`) makes "path with no route object"
  a compile error.
- If a route's screen is chosen by a domain status, put that mapping next to the
  constants too (`pathForStatus(status)`), not in a component.

## Router — flat, one shell

```tsx
export const router = createBrowserRouter([
  {
    element: <AppShell />,            // nav + <Outlet />
    children: [
      { path: AppPath.ROOT, element: <HomePage /> },
      ...featureRoutes,
      { path: AppPath.ANY, element: <NotFoundPage /> },
    ],
  },
]);
```

- One shell for everything; feature route groups mount under it.
- Cross-view intents ("open X prefilled with this") are **router state**:
  `navigate(AppPath.X, { state })`, and the target page reads `location.state`.
  Never a global bus event.
- **Keep live-process wiring out of routes.** Global listeners and long-lived
  stores are bound above the router, so navigation never interrupts running work.
- A URL segment is not authoritative when the app also holds a session: prefer
  the session's value and treat the segment as a shareable hint
  (`session?.roomCode ?? code`).
- Hash vs history routing depends on how the app is served — declare it in
  `project.md`, don't guess from the doctrine.

### Route registry vs router assembly (+ lazy pages)

Split the **registry** ("what routes exist") from the **assembly** ("how the
router is built"), and code-split pages. The registry is the single source of
truth: adding a page means adding one route object.

```tsx
// shared/routes/feature-routes.tsx — the registry (data)
function route(path: string, label: string, load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return { path, label, element: <Suspense fallback={<PageLoading />}><Page /></Suspense> };
}

export const featureRoutes = [
  route(AppPath.OVERVIEW, "Overview", () =>
    import("@/features/x/pages/OverviewPage").then((m) => ({ default: m.OverviewPage }))),
];
```

- **Do split registry from assembly**; lazy pages keep the initial bundle small.
- **Don't fragment the registry into one file per route.** A route object is pure
  data; the page and its logic already live in the feature slice.
- More structure pays off when a real concern appears: guards, multiple layouts,
  role-based groups — each becomes its own file. That is `web-app-patterns.md`.

## AppShell

Lives in the shell layer (`shared/routes/`), built with whatever layout the repo
declares (`project.md` → UI kit).

```text
AppShell
 ├── TopBar / AppBar     # brand, language and theme controls, user menu
 ├── Sidebar or nav      # nav entries + live badges + status banner
 └── <main><Outlet /></main>
```

| Element | Source of truth |
|---|---|
| Nav items | a static list `{ path: AppPath.X, label, icon }`, rendered with the router's active-link component |
| Section title | derived from the matched route or the page heading — never a manual "current view" variable |
| Live badge (e.g. active count) | a store selector; hidden at zero |
| Status banner ("connection lost") | derived from a status query or the session store + a locally dismissed flag |
| Theme / language toggle | a ui-store action (`conventions.md` → Theme, Copy) |

The shell is also where device chrome is handled once: safe-area insets on
phones, window chrome on desktop shells. Do not repeat that padding per page.

## Route guards

*Only if the app has a session or roles.* A guard element wraps the protected
children, checks status, and either redirects with a path constant or renders
`<Outlet />`. Guards handle auth and permission **only** — business logic stays
in containers. The full pattern is in `web-app-patterns.md`.

A reload on a protected route must have a defined answer: restore from the stored
session and, if the server rejects it, redirect to the entry route.

## Do / Don't

| Do | Don't |
|---|---|
| Path constants and builders everywhere | Hardcoded path strings or inline template literals |
| The router's `navigate` / `<Navigate>` | `window.location.href` for in-app navigation |
| One flat route list under one shell | Ad-hoc nested routers per page |
| Router state for cross-view intents | A global bus event for navigation |
| Route objects in the shell layer | Route definitions scattered across feature files |
| Bind global listeners above the router | Subscribe to app-wide events inside a page |
