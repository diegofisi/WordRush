# Web-app patterns — HTTP client, auth, roles

> **Read this when:** the project is a multi-user **web** app (HTTP backend,
> login, roles). This is the agent-portal reality: a browser app with AWS
> Amplify (Cognito) auth and role-based feature gating. Routing lives in
> `routing-shell.md`.

## HTTP client & interceptors

Each feature owns an axios `httpClient` (e.g. `common/lib/httpClient.ts` or a
feature-local client). The request interceptor pulls the current Cognito
**idToken** from Amplify via `fetchAuthSession()` and sets `Authorization`.
The token lifecycle is **owned by Amplify** — there is no hand-rolled
JWT/refresh store and no 401-retry interceptor; Amplify refreshes the session
under the hood and `fetchAuthSession()` returns valid tokens.

**Key pattern:** never read a token from `localStorage` or hand-roll refresh.
Ask Amplify for the session on every request; if there is no session the call
goes out unauthenticated and the backend 401s, which route guards handle by
redirecting to login.

```typescript
// common/lib/httpClient.ts
import axios from "axios";
import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the Cognito idToken (managed/refreshed by Amplify) to every request
httpClient.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) config.headers.Authorization = idToken;
  } catch {
    // no session — request goes out unauthenticated; backend 401 → guard redirects
  }
  return config;
});

// Optional response interceptor: unwrap a { success, message, data } envelope
httpClient.interceptors.response.use((response) => {
  if (response.data && "success" in response.data && "data" in response.data) {
    response.data = response.data.data;
  }
  return response;
});
```

The fetcher pattern with this client (React Query 5): `const { data } = await
httpClient.get<XDTOResponse>("/path"); return data;` inside
`queryFn`/`mutationFn`, then `select: toModel`.

## Auth session vs. derived UI state (Amplify + Zustand)

Amplify is the source of truth for the session/token. Do **not** duplicate the
token or auth status in a store. A lightweight Zustand store may still hold
**derived** state — the resolved user profile, role/permission helpers, and UI
flags — hydrated once after Amplify confirms a session.

```typescript
// common/stores/useUserStore.ts
// The token/session lives in Amplify. This store only holds DERIVED user + UI
// state (role, permission helpers, profile). Rehydrate on app load from the
// authenticated Cognito user; never persist tokens here.
import { create } from "zustand";

interface UserStore {
  user: User | null;
  status: AuthStatus;
  setUser: (user: User) => void;
  setStatus: (status: AuthStatus) => void;
  reset: () => void;
}

const initialState = { user: null as User | null, status: AuthStatus.Idle };

export const useUserStore = create<UserStore>((set) => ({
  ...initialState,
  setUser: (user) => set({ user, status: AuthStatus.Authenticated }),
  setStatus: (status) => set({ status }),
  reset: () => set(initialState),
}));
```

Login flow rule set: sign-in goes through Amplify (`signIn` from
`aws-amplify/auth`). On success, fetch/resolve the user profile,
`setUser(user)`, toast, then `navigate(<PathConstant>, { replace: true })` —
inside the mutation's `onSuccess`. Sign-out calls Amplify `signOut()` and
`reset()`s the derived store.

## Role-based routing

Routes and their path constants live in `src/common/routes/`, grouped by feature
area (e.g. `common/routes/CardHolderManagement/`). Role/permission gating is
layered on top of the flat router via guard elements. See `routing-shell.md` for
the path-constants-first router assembly; this section covers the guard +
permission wiring.

### RootLayout — auth initialization

A top-level route component wrapping all groups: on mount it checks the Amplify
session (`fetchAuthSession()` / `getCurrentUser()`), resolves the user profile,
sets the derived store, shows a spinner while `status === Idle`, then renders
`<Outlet />`. On no-session / error → `setStatus(AuthStatus.Unauthenticated)`,
which the guards turn into a redirect to login.

### Guard responsibilities

| Concern | Where |
|---|---|
| Path constants | `common/routes/<Area>/<area>-path.ts` — single source of truth for the group's URLs (const-object enum, e.g. `CardholderPath`). |
| Guard | Checks Amplify auth status + permissions; redirects if unauthorized, renders `<Outlet />` if valid. |
| Default redirect | Base path → default sub-route (`<Navigate to={CardholderPath.OVERVIEW} replace />`). |
| Route objects | `{ path, element, label }` map for the group. |

### Route object shape

```typescript
export interface Route {
  path: string;
  element: React.ReactNode;
  label?: string;
}
```

### Code patterns

```typescript
// cardholder-path.ts — const-object enum; keyof typeof = exhaustive key union
export const CardholderPath = {
  ROOT: "/cardholder/",
  OVERVIEW: "/cardholder/overview",
  CARDS: "/cardholder/cards",
  DETAILS: "/cardholder/details",
  ANY: "*",
} as const;
export type CardholderPath = keyof typeof CardholderPath;

// Guard with early-return ifs (no else / if-else); permissions from the
// authenticated user (see userPermissions.ts / isAgent below)
export const CardholderGuard: React.FC = () => {
  const { authStatus, userPermissions } = useUserInfo();
  if (authStatus === AuthStatus.Unauthenticated) {
    return <Navigate to={AuthPath.LOGIN} replace />;
  }
  if (!userPermissions?.isAgent()) {
    return <Navigate to={AuthPath.ROOT} replace />;
  }
  return <Outlet />;
};

// Route objects — { path, element, label }
export const CardholderRoutes: { [key in CardholderPath]: Route } = {
  ROOT: { path: CardholderPath.ROOT, element: <Navigate to={CardholderPath.OVERVIEW} replace /> },
  OVERVIEW: { path: CardholderPath.OVERVIEW, element: <Overview />, label: "Overview" },
  CARDS: { path: `${CardholderPath.CARDS}/*`, element: <Cards />, label: "Cards" },
  DETAILS: { path: CardholderPath.DETAILS, element: <Details />, label: "Details" },
  ANY: { path: CardholderPath.ANY, element: <Navigate to={CardholderPath.OVERVIEW} replace /> },
} as const;
```

### Flow summary

`RootLayout` (Amplify session check → resolve user → set derived store) → path
constants → route objects → router → guard (`<Outlet />`) → feature page.

### Rules

- One folder per feature/role group under `common/routes/`; never mix groups.
- Paths are the single source of truth — `CardholderPath.OVERVIEW`, never `'/cardholder/overview'`.
- Route map must be exhaustive (`{ [key in CardholderPath]: Route }`).
- Guards handle auth/permission only; business logic belongs in containers.
- Session/token comes from Amplify; guards read derived status, not tokens.

## Roles & permissions

Role/permission logic already exists in the app as `userPermissions.ts` (with
helpers such as `isAgent()` and other role checks). Roles come from the
**authenticated Cognito user** (groups/attributes resolved into the user
profile), not from a hand-rolled token store. Permission helpers gate features
and routes.

### Role definition

```typescript
// common/types/roles.ts
export const Role = {
  Agent: "agent",
  Client: "client",
  Admin: "admin",
} as const;
export type RoleType = (typeof Role)[keyof typeof Role];

// Domain models reference RoleType instead of duplicating string unions:
export type UserRole = RoleType;
export interface User { id: string; role: UserRole; /* ... */ }
```

### Permission system — config-driven helpers (userPermissions.ts)

```typescript
// common/helpers/userPermissions.ts
const permissionConfig = {
  isAgent: [Role.Agent, Role.Admin],
  isClient: [Role.Client],
  // Granular per-feature gates as needed:
  // cards: { create: [Role.Agent], read: [Role.Agent, Role.Client], ... },
} as const;

export const userPermissions = (currentRole: RoleType) => {
  const hasPermission = (roles: readonly RoleType[]) => roles.includes(currentRole);
  return {
    isAgent: () => hasPermission(permissionConfig.isAgent),
    isClient: () => hasPermission(permissionConfig.isClient),
    // cards: { create: () => hasPermission(permissionConfig.cards.create), ... },
  };
};
export type UserPermissions = ReturnType<typeof userPermissions>;
```

### useUserInfo hook — central auth info

```typescript
// common/hooks/useUserInfo.ts
export const useUserInfo = () => {
  const user = useUserStore((s) => s.user);
  const status = useUserStore((s) => s.status);
  const permissions: UserPermissions | null = user ? userPermissions(user.role) : null;
  return {
    authStatus: status,           // 'idle' | 'authenticated' | 'unauthenticated'
    userPermissions: permissions, // UserPermissions | null
    userInfoLoading: status === "idle",
  };
};

// Usage in guards/containers:
// const { userPermissions } = useUserInfo();
// if (userPermissions?.isAgent()) { /* agent-only */ }
```

### Adding permissions for a new feature

1. Add the config to `permissionConfig` in `common/helpers/userPermissions.ts`.
2. Add the corresponding methods to the `userPermissions` return object.
3. Consume via `useUserInfo().userPermissions?.feature.action()` in guards or containers.

## AuthStatus

```typescript
// common/types/status.ts
export const AuthStatus = {
  Idle: "idle",                    // Amplify session resolving
  Authenticated: "authenticated",
  Unauthenticated: "unauthenticated",
} as const;
export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];
```

Always compare against `AuthStatus.Authenticated`, never raw strings
(autocomplete, refactoring safety, single source of truth). This is the
canonical instance of the const-object pattern (see `conventions.md` → Const
object + type pattern).
