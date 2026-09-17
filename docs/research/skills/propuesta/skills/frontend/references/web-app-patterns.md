# Web-app patterns — HTTP client, auth, roles

> **Applies only if `project.md` declares auth and/or roles.** Skip this file
> entirely for an app with no login (a single-player tool, a kiosk, a game room
> joined by code) — nothing in it is doctrine for those.
>
> The auth examples show **two providers**: a managed identity SDK (the
> Amplify/Cognito shape) and a hand-rolled token flow. `project.md` says which
> one is real; never mix them.
>
> **Read this when:** wiring the HTTP client, the session, guards or permissions.

## HTTP client & interceptors

One client per app (or per feature, if the project says so), created once with
its base URL and default headers. Every fetcher goes through it; nothing calls
`fetch` directly.

```typescript
// shared/lib/httpClient.ts
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});
```

**Variant A — managed identity SDK owns the token.** The request interceptor asks
the SDK for the current session on every request; there is no hand-rolled refresh
and no 401-retry interceptor.

```typescript
httpClient.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) config.headers.Authorization = token;
  } catch {
    // no session — the request goes out unauthenticated; the guard handles the 401
  }
  return config;
});
```

**Variant B — the app owns the token.** The interceptor reads the token from the
auth store (not from `localStorage` at the call site), and a response interceptor
handles 401 by triggering **one** refresh, shared by every request that failed in
the same window (module-level single-flight promise), then retrying them. On
refresh failure it calls the store's `logout()` — and navigation happens through
the router, never `window.location.href`.

Either way: **never read a raw token in a component, a container, or a fetcher.**

An optional response interceptor unwraps an envelope
(`{ success, message, data }` → `data`) so DTOs mirror the payload, not the
envelope.

## Session state vs derived UI state

The session is owned by exactly one place: the identity SDK (variant A) or the
auth store (variant B). Do **not** duplicate the token anywhere else.

A lightweight store may hold **derived** state — the resolved profile, role and
permission helpers, UI flags — hydrated once after the session is confirmed.

```typescript
const initialState = { user: null as User | null, status: AuthStatus.Idle };

export const useUserStore = create<UserStore>((set) => ({
  ...initialState,
  setUser: (user) => set({ user, status: AuthStatus.Authenticated }),
  setStatus: (status) => set({ status }),
  reset: () => set(initialState),
}));
```

Login flow: sign in → resolve the profile → `setUser` → notify →
`navigate(Path.X, { replace: true })`, all inside the write's `onSuccess`.
Sign-out clears the provider session **and** `reset()`s the derived store.

```typescript
export const AuthStatus = {
  Idle: "idle",                 // the session is still resolving
  Authenticated: "authenticated",
  Unauthenticated: "unauthenticated",
} as const;
export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];
```

The `Idle` state is not optional: without it, the first render of a protected
route redirects an authenticated user to the login screen.

## Role-based routing

Path constants and route objects live in the shell layer, grouped by area
(`routing-shell.md`). Gating is layered on top with guard elements.

### RootLayout — auth initialization

A top-level route component wrapping all groups: on mount it resolves the
session, sets the derived store, renders a spinner while `status === Idle`, then
renders `<Outlet />`. No session or an error → `Unauthenticated`, which the
guards turn into a redirect.

### Guard responsibilities

| Concern | Where |
|---|---|
| Path constants | the area's `*-path.ts` — the single source of truth for its URLs |
| Guard | checks status + permissions; redirects or renders `<Outlet />` |
| Default redirect | base path → default sub-route |
| Route objects | `{ path, element, label }` map for the group |

```tsx
export const AreaGuard = () => {
  const { authStatus, userPermissions } = useUserInfo();
  if (authStatus === AuthStatus.Idle) return <PageLoading />;
  if (authStatus === AuthStatus.Unauthenticated) return <Navigate to={AuthPath.LOGIN} replace />;
  if (!userPermissions?.isAgent()) return <Navigate to={AuthPath.ROOT} replace />;
  return <Outlet />;
};
```

Rules:

- One folder per area/role group; never mix groups.
- Paths are the single source of truth — a constant, never a literal.
- The route map is exhaustive (`{ [key in AreaPath]: Route }`), so adding a path
  without a route object fails to compile.
- Guards handle auth and permission only; business logic lives in containers.
- Guards read **derived status**, never tokens.
- Client-side gating is UX, not security. The server authorizes every call.

## Roles & permissions

Roles come from the authenticated user (the provider's groups/claims resolved
into the profile), never from a value the client can set.

```typescript
export const Role = { Agent: "agent", Client: "client", Admin: "admin" } as const;
export type RoleType = (typeof Role)[keyof typeof Role];

const permissionConfig = {
  isAgent: [Role.Agent, Role.Admin],
  isClient: [Role.Client],
  // Granular per-feature gates as needed:
  // cards: { create: [Role.Agent], read: [Role.Agent, Role.Client] },
} as const;

export const userPermissions = (currentRole: RoleType) => {
  const has = (roles: readonly RoleType[]) => roles.includes(currentRole);
  return {
    isAgent: () => has(permissionConfig.isAgent),
    isClient: () => has(permissionConfig.isClient),
  };
};
export type UserPermissions = ReturnType<typeof userPermissions>;
```

One central hook exposes it:

```typescript
export const useUserInfo = () => {
  const user = useUserStore((state) => state.user);
  const status = useUserStore((state) => state.status);
  return {
    authStatus: status,
    userPermissions: user ? userPermissions(user.role) : null,
    userInfoLoading: status === AuthStatus.Idle,
  };
};
```

Adding permissions for a new feature: extend `permissionConfig`, add the matching
method, consume it in guards or containers. Never scatter
`user.role === "admin"` checks through components.

## Do / Don't

| Do | Don't |
|---|---|
| One client, one interceptor, tokens attached there | Attach `Authorization` by hand in fetchers |
| Single-flight refresh shared by concurrent 401s | A refresh per failed request |
| Derived auth state in a store | Duplicate the token in a store or `localStorage` |
| An explicit `Idle` status | Redirect before the session resolved |
| Central permission helpers | Inline role-string comparisons in components |
| Router navigation on logout | `window.location.href` |
