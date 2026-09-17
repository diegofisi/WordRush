# State — store rules, live-process stores, anti-race patterns

> **Applies:** whenever the repo has an external store. Examples are written in
> **Zustand**; if `project.md` declares a different store library, the rules hold
> and only the API changes. The paragraphs about a cache
> (`queryClient.invalidateQueries`) apply **only if `project.md` declares a
> server-state library**.
>
> **Read this when:** touching a store, a scheduler or a live process, or any
> anti-race logic.

## General store rules

- Stores hold **client/UI state** (selections, filters, modals, theme, language)
  and **live-process state**. Plain request/response server data belongs to the
  data layer when there is one (`data-flow.md` → Endpoint classification).
- Stores work with **Domain Models**, never DTOs. Mapping happens in the
  listener or the action, before `set()`.
- Type the store explicitly and **separate State from Actions**.
- Always provide `reset()`.
- File name `use{Domain}Store.ts`.
- **Derive initial state** from external sources via helpers; never hardcode a
  value that should come from `localStorage` or the environment.
- Non-React callers (event listeners, schedulers, interceptors) use
  `use{X}Store.getState()` / `.setState()`. A store file never imports React.

### Canonical shape

```typescript
interface EntityUiStore {
  // State
  selected: Entity | null;
  filters: { search: string; onlyActive: boolean };
  // Actions
  setSelected: (entity: Entity | null) => void;
  setFilters: (filters: Partial<EntityUiStore["filters"]>) => void;
  reset: () => void;
}

const initialState = { selected: null, filters: { search: "", onlyActive: false } };

export const useEntityUiStore = create<EntityUiStore>((set) => ({
  ...initialState,
  setSelected: (selected) => set({ selected }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  reset: () => set(initialState),
}));
```

### Derived initial state

```typescript
const getInitialLang = (): Lang => {
  try {
    return localStorage.getItem("{app}.lang") === "en" ? "en" : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG; // private mode / disabled storage throws
  }
};

const initialState = { lang: getInitialLang(), theme: getInitialTheme() };
```

Hardcoding these breaks the app on reload: the user's language, theme or
onboarding flag resets on every boot. Wrap every storage read in try/catch.

## Choosing: useState / useReducer / store / data layer

Escalate only as needed:

- **`useState`** — local state, a couple of independent primitives.
- **`useReducer`** — complex *local* state where several handlers drive related
  transitions. Not a substitute for `useMemo` chains, never for derived data.
- **Store** — state shared across components, surviving unmount, or living
  outside the tree. Don't lift a reducer through context to fake this.
- **Data layer** (React Query/SWR, or the repo's fetch hooks) — server state.
  Never model server data in `useState` or a store "because it is easier".

Context is fine for low-frequency reads (theme, locale, auth) and wrong for
high-frequency values: every consumer re-renders on every update.

## Binding subscriptions — `bind()` with a module flag

*If the transport pushes events*, each store owns a `bind()` that subscribes its
listeners:

```typescript
let bound = false;

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  bind: () => {
    if (bound) return;   // StrictMode invokes effects twice in dev
    bound = true;
    client.on("round:start", (dto) => set(toRoundState(dto)));
    client.on("player:progress", (dto) => set((state) => patchProgress(state, toProgress(dto))));
  },
}));
```

Rules:

- The flag is **module-level**, not store state: a store reset must not
  re-subscribe.
- `bind()` is called **once** from the app bootstrap, not from the components
  that happen to need the data.
- App-singleton listeners are **not removed on unmount** — removing them drops
  events while the user navigates. If a store is genuinely scoped to a screen,
  say so and clean up; otherwise leave them attached and document it.
- Stores rehydrate from each other by subscribing to the other store outside
  React (`useOtherStore.subscribe(...)`), never through a component effect.

## Live-process stores — a scheduler is not a query

The "server state → data layer" rule assumes request/response. Some apps drive
**long-running processes**: a job queue with pause/resume/reorder and event-fed
progress, a round clock, an upload pipeline. Caching, staleness and refetching
are meaningless there. The process state lives in the store, and the store's
scheduler calls the start/cancel endpoints **directly**, with plain fetchers —
never through a mutation hook.

### Job-queue archetype

| Concern | Rule |
|---|---|
| State | `items: JobItem[]` (Domain Models with a status union), `concurrency` |
| Subscription | components select **narrowly**, per item where possible |
| `enqueue(list)` | dup-check against pending statuses; notify on duplicates |
| `pump()` | fills slots while `activeCount() < concurrency` |
| `run(item)` | internal function calling the start endpoint via a plain fetcher |
| **Run-sequence guard** | each run gets a `runSeq`; settlements from a stale run (fast pause→resume) are ignored |
| Resume semantics | keep `progress` on resume if the backend continues partial work; reset only on `retry` |
| Credential expiry | on an auth error: pause the failing item **and** the queued ones, flag them, trigger one silent reconnect |
| **Single-flight reconnect** | a module-level flag/promise guarantees one attempt no matter how many items fail at once |
| `handleProgress(...)` | called by the **global** listener; patch only items in active statuses |
| Bulk actions | `move`, `retryAllFailed`, `clearFinished` (terminal-success/cancelled only) |
| Derived counts | exposed as selectors; badges subscribe to the selector, never to a bus event |
| Completion | record it, then invalidate the affected cache keys if there is a cache; a failed recording must not break the flow |
| Imports | its own fetchers, the cache singleton, the toast store — **never React** |

Keep the scheduler internals as plain functions over `get()`/`set()` so they are
testable without a component tree.

### Server-owned clocks

When the server owns the timing of a process, the store keeps the last snapshot
(`secondsLeft` + the server timestamp it was measured at) and rendering derives
the countdown from `Date.now()`. **The client never declares the process over.**
No `setTimeout` that ends a round, closes a session or fails a job: it will fire
on a lagging tab, a backgrounded phone or a clock skew, and the two sides
disagree. Wait for the server's event.

## Session / credentials state

| Concern | Pattern |
|---|---|
| Status source of truth | a status query, or the session store fed by the transport's connect/disconnect events |
| Silent reconnect | module-level **shared-promise single-flight** — a cache dedupes queries, not imperative calls |
| "Session expired" banner | derived from status + a locally dismissed flag in the shell, not a global event |
| Credentials renewed | the global listener invalidates the session keys or re-runs rejoin |

## Anti-race patterns — what a cache replaces and what survives

| Pattern | Fate under a server-state library | Why |
|---|---|---|
| Manual load-sequence tokens discarding stale list loads | **Dies** | keying the query discards stale results; `isFetching` replaces manual flags |
| Cross-page dedupe of a shifting feed | **Survives**, inside `select` | pages are appended verbatim; feed shift is a domain problem |
| Per-item run-sequence guard in a live-process store | **Survives** | the cache never owns the process |
| Single-flight shared promise for an imperative reconnect | **Survives** | imperative calls have no dedupe |
| `setInterval` polling a status | **Dies** | `refetchInterval`, and only where no push event exists |
| Global typed event bus | **Mostly dies** | see below |

Each surviving guard exists because a bug was reproduced. Do not "simplify" one
away without reproducing the bug it prevents.

### Migrating off an event bus

| Bus event | Replacement |
|---|---|
| "count changed" (nav badge) | store selector |
| "work completed" | cache invalidation from the store |
| "session expired/connected" | status query or session store + shell-local dismissed flag |
| "theme changed" | ui store subscription |
| "navigate to X" | router navigation with path constants |
| "prefill view Y with data" | `navigate(Path.X, { state })`; the target page reads `location.state` |

## Do / Don't

| Do | Don't |
|---|---|
| Keep scheduler logic in the store, testable without React | Put pump/run logic in components or effects |
| Guard `bind()` with a module-level flag | Subscribe from a component effect |
| Narrow selectors (`useStore(s => s.items)`, count selectors) | Subscribe a component to the whole store |
| `reset()` on every store | Hardcode initial state that mirrors `localStorage` |
| Derive countdowns from server snapshots | Local timers that end a server-owned process |
| Map DTO → Model before `set()` | Store raw payloads |
