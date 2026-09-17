# Data flow — the Adapter Pattern

> **Applies:** the Adapter Pattern (DTO → mapper → Model → hook) and the
> endpoint classification always apply. The *Query hook* and *Mutation hook*
> sections apply **only if `project.md` declares React Query** (or an equivalent
> server-state library); the *Push events* section applies **only if the
> transport pushes** (socket, SSE, broker).
>
> **Read this when:** writing any hook or store action that touches a backend
> endpoint or event.

## The Adapter Pattern flow

```
┌──────────────────────────────┐    ┌──────────────┐    ┌──────────────┐
│ api/{endpoint}/              │───>│  Container   │───>│  Component   │
│   {endpoint}.dto.ts          │    │  (wiring)    │    │  (pure UI)   │
│     └── wire shape + mapper  │    │  consumes    │    │  receives    │
│   models/{Name}.ts           │    │  Domain      │    │  Domain      │
│     └── Domain Model         │    │  Model       │    │  Model       │
│   use{Action}.ts             │    │              │    │  via props   │
│     └── hook returning Model │    │              │    │              │
└──────────────────────────────┘    └──────────────┘    └──────────────┘
```

| Layer | Responsibility |
|---|---|
| 1. DTO | Types that **mirror** the wire shape exactly, casing included. If the server serializes `card_guid`, the DTO says `card_guid`. |
| 2. Mapper | Pure function DTO → Model. Where it lives (dto file or model file) and its name (`toModel`, `transform{Name}ToViewModel`) are house style — `project.md` → House conventions. |
| 3. Model | Types optimized for the UI: camelCase, `Date` objects, clean unions. Source of truth for every component. |
| 4. Hook | Calls the transport, returns **Models**, never DTOs. |
| 5. Container | Wires the hook's result to components. Models only. |
| 6. Component | Props only. Zero knowledge of API or state management. |

**Never "fix" the casing in the DTO and skip the mapper.** The DTO copies
reality; the mapper cleans it. If the project has a typed, synced contract
module, the DTO is an alias onto it and invents nothing.

## api/ folder layout

```text
features/{feature}/api/
  ├── client.ts                  # transport instance, if the feature owns one
  ├── get-card-details/
  │    ├── get-card-details.dto.ts   # request/response types (+ mapper, house style)
  │    └── useGetCardDetails.ts      # the hook
  └── remove-card/
       └── useRemoveCard.ts          # no body in or out → no DTO file
```

Rules:
- One folder per endpoint or ack'd event. Folder-name casing (`kebab-case` vs
  `PascalCase` `{Domain}/{Endpoint}/`) is house style — `project.md`.
- Every call that carries a request or response body gets its own DTO file.
  Never inline a DTO interface in the hook file. Only bodyless calls skip it.
- A DTO shared by several endpoints lives in the most fundamental folder and is
  imported by the others.
- Mappers are never standalone `*.mapper.ts` files.

```typescript
// features/card/api/get-card-details/get-card-details.dto.ts
export interface GetCardDetailsRequest {
  card_guid: string; // wire is snake_case — mirror it
}

export interface GetCardDetailsResponse {
  card_guid: string;
  card_status: string;
  last_four: string;
  is_active: boolean;
}
```

```typescript
// Domain Model + mapper (folder/name per project.md)
export interface CardDetails {
  cardGuid: string;
  cardStatus: string;
  lastFour: string;
  isActive: boolean;
}

export const toCardDetails = (dto: GetCardDetailsResponse): CardDetails => ({
  cardGuid: dto.card_guid,
  cardStatus: dto.card_status,
  lastFour: dto.last_four,
  isActive: dto.is_active,
});
```

## Query hook — *only if the project declares React Query*

```typescript
// features/card/api/get-card-details/useGetCardDetails.ts
const getCardDetails = (params: GetCardDetailsRequest) =>
  httpClient.get<GetCardDetailsResponse>(`/cards/${params.card_guid}`).then((r) => r.data);

export function useGetCardDetails(
  params: GetCardDetailsRequest,
  options?: Omit<
    UseQueryOptions<GetCardDetailsResponse, Error, CardDetails | null>,
    "queryKey" | "queryFn" | "select"
  >,
) {
  return useQuery<GetCardDetailsResponse, Error, CardDetails | null>({
    queryKey: ["card-details", params.card_guid],
    queryFn: () => getCardDetails(params),
    select: toCardDetails, // Adapter: DTO → Model
    ...options,
  });
}
```

- **Generic typing is the strict rule**: `<TQueryFnData, TError, TData>` = DTO,
  Error, Model, plus external `options` via
  `Omit<..., "queryKey" | "queryFn" | "select">`. That is what makes the adapter
  composable.
- Query keys follow one documented shape (`['{feature}', ...]`); record the real
  key map in `project.md`.

## Mutation hook — *only if the project declares React Query*

```typescript
export function useRemoveCard() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => httpClient.delete<void>(`/cards/${id}`).then((r) => r.data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["card"] }),
  });
}
```

- Mutations map inside `mutationFn`:
  `mutationFn: async (model) => toModel(await call(toRequestDto(model)))`.
- Containers call `mutate` with `onSuccess` / `onError` callbacks — **never**
  `mutateAsync` + try/catch (unhandled rejections; error handling drifts away
  from the call site).
- Invalidate in the hook's `onSuccess` when it is intrinsic (a write that stales
  its own list); in the container's callback when it is contextual (navigate,
  toast).

## No data-fetching library — the same layering, by hand

*If `project.md` declares no server-state library*, the adapter does not
disappear; only the cache does.

```typescript
// features/card/api/get-card-details/useGetCardDetails.ts
export const getCardDetails = async (
  params: GetCardDetailsRequest,
): Promise<Result<CardDetails>> => {
  const response = await request<GetCardDetailsResponse>((ack) =>
    client.emit("card:details", params, ack),
  );
  return response.ok ? ok(toCardDetails(response.value)) : response;
};

// The hook wraps it with the loading/error state the caller needs.
```

DTO, mapper and Model stay exactly as above. What you must **not** do is invent a
second ad-hoc fetching style per hook, or return the DTO because "there is no
`select` here".

## Push events — *only if the transport pushes*

Anything the server pushes is a **store-driven endpoint**: it has no request, no
cache key and no caller to await it.

- Subscribe **once** in the store's `bind()` action, guarded by a module-level
  flag (StrictMode double-invokes effects in dev).
- Map the DTO **in the listener**, then `set()` Models.
- Never turn a pushed event into a fetch hook; never `useEffect(() =>
  socket.on(...))` inside a component.
- Listeners for app singletons are attached once and not removed — removing them
  on unmount drops events during navigation. Say so explicitly in `project.md`
  when that is the design.
- Only request/response (emit-with-ack, HTTP) gets an `api/` folder.

## Endpoint classification (decide before writing anything)

| Archetype | Shape | Caller | Cache behavior |
|---|---|---|---|
| Fetch list / detail | Query | query hook (or plain fetcher) | keyed `['{feature}', ...]` |
| Paged feed / search | Infinite query | infinite hook | key includes the search/source param |
| Write | Mutation | mutation hook (or store action) | invalidates its list/detail keys |
| Slow-changing status with **no better signal** | Query + `refetchInterval` | query hook | poll only as a last resort |
| OS / external side effect (open tab, download) | Imperative | plain fetcher from a store action | no cache |
| Viewport/map-driven fetch | Query keyed by a **committed anchor** | query hook + driver hook | `keepPreviousData`; `enabled` gates it |
| **Pushed event** | Subscription | store `bind()` | no cache, ever |
| **Live process** (job queue, round clock) | Store-owned scheduler | store actions calling plain fetchers | no cache, ever |

**Viewport-driven queries:** never key the query by the raw viewport — it changes
every frame. A driver hook debounces, applies a distance-threshold dedupe, and
commits an anchor (`{ origin, radius }`) that becomes the key. Writes to any
mirroring store happen only on success: a failed fetch must never wipe good data.

**Do not poll** when a mutation-triggered invalidation or a push event carries
the same information.

## Do / Don't

| Do | Don't |
|---|---|
| One fetcher path per feature (the declared client) | Ad-hoc `fetch`/`axios` calls per hook |
| Mirror the wire casing in the DTO | "Fix" casing in the DTO and skip the mapper |
| Keep the mapper co-located per house style | Standalone `*.mapper.ts`, or mapping inside a component |
| Return Models from hooks | Return DTOs, or let a DTO reach a component |
| Classify before writing the hook | Wrap a pushed event or a live process in a query |
| Alias DTOs onto the typed contract when one exists | Invent fields the backend does not send |
