# Data flow — the Adapter Pattern

> **Read this when:** writing any hook that touches a backend endpoint. Covers
> DTO → mapper → model, the api/ subfolder pattern, query/mutation hooks, and
> endpoint classification.

## The Adapter Pattern flow

```
┌─────────────────────────────────┐     ┌──────────────┐     ┌──────────────┐
│  api/{Domain}/{Endpoint}/       │────>│  Container   │────>│  Component   │
│  {Name}DTO.ts                   │     │  (UI logic)  │     │  (pure UI)   │
│    └── DTO types (wire mirror)  │     │  consumes    │     │  receives    │
│  interfaces/{Name}ViewModel.ts  │     │  Domain      │     │  Domain      │
│    └── Mapper (DTO→ViewModel)   │     │  Model       │     │  Model       │
│  use{Action}.ts                 │     │              │     │  via props   │
│    └── RQ hook (returns Model)  │     │              │     │              │
└─────────────────────────────────┘     └──────────────┘     └──────────────┘
```

### Layer responsibilities (all six)

| Layer | Responsibility |
|---|---|
| 1. DTO (`api/{Domain}/{Endpoint}/{Name}DTO.ts`) | Types that **mirror** the backend's serialized shape (`{Name}Request`/`{Name}Response`). Snake_case if the wire is snake_case. |
| 2. Mapper (`interfaces/{Name}ViewModel.ts`) | **Pure mapper function** `transform{Name}ToViewModel(dto)` producing the frontend `{Name}ViewModel`. House style keeps this in `interfaces/`, **not** in the DTO file (the generic doctrine co-locates it in the dto file — this project deviates). |
| 3. Model (`interfaces/{Name}ViewModel.ts`) | Types **optimized for the frontend**: camelCase, `Date` objects, clean booleans. Source of truth for the UI. |
| 4. Hook (`api/{Domain}/{Endpoint}/use{Action}.ts`) | React Query hook. Queries use `select` with the mapper; mutations map inside `mutationFn`. Imports DTOs from the sibling `{Name}DTO.ts` and the mapper from `interfaces/`. |
| 5. Container (`containers/XContainer.tsx`) | Connects hooks/stores to presentational components. Works only with Models. `mutate` + callbacks. **Never imports/renders other containers** — cross-container orchestration belongs to the Page. See `containers-pages.md`. |
| 6. Component (`components/X.tsx`) | Pure UI. Receives Models via props. Zero knowledge of API or state management. |

The DTO always mirrors the **actual wire casing** — the backend serializes
snake_case in places (e.g. `card_guid`), so the DTO copies reality and the
mapper cleans it to camelCase. Never "fix" casing in the DTO and skip the mapper.

## API subfolder pattern

```text
features/{feature}/api/
  ├── http-client.ts                    # shared axios instance (baseURL, auth interceptor)
  ├── Card/
  │    ├── GetCardDetails/
  │    │    ├── GetCardDetailsDTO.ts     # GetCardDetailsRequest + GetCardDetailsResponse
  │    │    └── useGetCardDetails.ts     # useQuery hook
  │    └── RemoveCard/
  │         └── useRemoveCard.ts         # id-only mutation → no DTO file needed
  └── Preferences/
       └── UpdatePreferences/
            ├── UpdatePreferencesDTO.ts
            └── useUpdatePreferences.ts
features/{feature}/interfaces/
  └── CardDetailsViewModel.ts            # CardDetailsViewModel + transformCardDetailsToViewModel
```

Rules:
- Folders are **PascalCase**: `{Domain}/{Endpoint}/`. The DTO file is `{Name}DTO.ts`, the hook file is `use{Action}.ts`.
- `{Name}DTO.ts` contains DTO types only — `{Name}Request` and/or `{Name}Response`. The mapper `transform{Name}ToViewModel` and the `{Name}ViewModel` type live in `features/{feature}/interfaces/{Name}ViewModel.ts` (house style). *(The generic Adapter doctrine co-locates the mapper in the dto file; this project keeps it in `interfaces/` instead.)*
- **Every endpoint that carries a request/response body gets its own `{Name}DTO.ts`** — never inline DTO interfaces in the hook file. Only exception: mutations with no request body and no response body (e.g. id-only calls like `RemoveCard`).
- A DTO **shared** by several endpoints lives in the most fundamental subfolder and is imported by the others.
- Mappers always live in `interfaces/` as `transform{Name}ToViewModel` — **never** a standalone `helpers/*.mapper.ts`.

## Transport: the shared axios `httpClient`

Every fetcher goes through the per-feature axios instance
`features/{feature}/api/http-client.ts`, created with
`axios.create({ baseURL, headers })`. A request interceptor calls AWS Amplify
`fetchAuthSession` and attaches the Cognito `idToken` as the `Authorization`
header, so hooks never touch auth. There is no `invoke`, no websocket, and no
push-event channel in this transport.

Fetchers are one-liners that unwrap `response.data`:

```typescript
// features/card/api/Card/GetCardDetails/GetCardDetailsDTO.ts
export interface GetCardDetailsRequest {
  card_guid: string; // wire is snake_case — mirror it, mapper cleans it
}

// Mirror of the backend's serialized response (snake_case — copy reality, don't "fix" it here)
export interface GetCardDetailsResponse {
  card_guid: string;
  card_status: string;
  last_four: string;
  is_active: boolean;
}
```

```typescript
// features/card/interfaces/CardDetailsViewModel.ts
import type { GetCardDetailsResponse } from "../api/Card/GetCardDetails/GetCardDetailsDTO";

export interface CardDetailsViewModel {
  cardGuid: string;
  cardStatus: string;
  lastFour: string;
  isActive: boolean;
}

export const transformCardDetailsToViewModel = (
  dto: GetCardDetailsResponse,
): CardDetailsViewModel => ({
  cardGuid: dto.card_guid,
  cardStatus: dto.card_status,
  lastFour: dto.last_four,
  isActive: dto.is_active,
});
```

## Query hook (read endpoint)

The fetcher calls the shared `httpClient` and returns `response.data`; the hook
maps DTO → Model with `select`:

```typescript
// features/card/api/Card/GetCardDetails/useGetCardDetails.ts
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { httpClient } from "../../http-client";
import {
  transformCardDetailsToViewModel,
  type CardDetailsViewModel,
} from "../../../interfaces/CardDetailsViewModel";
import type {
  GetCardDetailsRequest,
  GetCardDetailsResponse,
} from "./GetCardDetailsDTO";

const getCardDetails = (params: GetCardDetailsRequest) =>
  httpClient
    .get<GetCardDetailsResponse>(`/cards/${params.card_guid}`)
    .then((r) => r.data);

export function useGetCardDetails(
  params: GetCardDetailsRequest,
  options?: Omit<
    UseQueryOptions<GetCardDetailsResponse, Error, CardDetailsViewModel | null>,
    "queryKey" | "queryFn" | "select"
  >,
) {
  return useQuery<GetCardDetailsResponse, Error, CardDetailsViewModel | null>({
    queryKey: ["card-details", params.card_guid],
    queryFn: () => getCardDetails(params),
    select: (data) => transformCardDetailsToViewModel(data), // Adapter: DTO → Model
    ...options,
  });
}
```

For a POST-shaped read the fetcher is
`httpClient.post<GetCardDetailsResponse>('/path', body).then((r) => r.data)` —
same hook shape.

## Mutation hook (write endpoint)

```typescript
// features/card/api/Card/RemoveCard/useRemoveCard.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "../../http-client";

const removeCard = (id: string) =>
  httpClient.delete<void>(`/cards/${id}`).then((r) => r.data);

export function useRemoveCard() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => removeCard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["card"] }),
  });
}
```

Rules:
- **Generic typing (strict rule):** query hooks are typed `<TQueryFnData, TError, TData>` (DTO, Error, Model) and accept external `options` via `Omit<..., "queryKey" | "queryFn" | "select">` — this is what makes the Adapter Pattern composable.
- **Mutations map in `mutationFn`:** when a mutation sends/returns mapped data, do the mapping there: `mutationFn: async (model) => transformXToViewModel(await callEndpoint(toRequestDTO(model)))`.
- Containers/pages call `mutate` with `onSuccess`/`onError` callbacks. **Never** `mutateAsync` + try/catch.
- Query keys: `['{feature}', ...detail]` — `['card-details', cardGuid]`, `['{feature}']`, `['{feature}', id]`, `['{feature}', 'list', filters]`. Record the project's real key map in `project.md`.
- Cache invalidation in the hook's `onSuccess` when it is intrinsic (a write that stales its own list); in the container's callback when it is contextual (navigation, toast).

## Endpoint classification (decision table)

Not every backend interaction is a simple request/response. Classify **before**
writing a hook; the project's real endpoint-by-endpoint table lives in
`project.md`.

| Archetype | Shape | Caller | Cache behavior |
|---|---|---|---|
| Fetch list / detail (`GetCardDetails`) | Query | `useQuery` hook | keyed `['{feature}', ...]` |
| Paged feed / search | **Infinite query** | `useInfiniteQuery` hook | key includes the search/source param |
| Slow-changing status with no better signal | Query with `refetchInterval` | `useQuery` hook | poll ONLY when there is no better signal |
| Write (`UpdatePreferences`, `RemoveCard`) | Mutation | `useMutation` hook | invalidates its list/detail keys |
| OS / external side-effect (open new tab, download file) | Mutation | `useMutation` hook or plain fetcher call from a store action | no cache |
| **Viewport/map-driven fetch** (store locator) | Query keyed by a **committed anchor** | `useQuery` hook + a driver hook that commits the anchor | key = `[id, origin, radius]`; `placeholderData: keepPreviousData`; `enabled` gates it |

**Viewport-driven queries** (a map that refetches as the user pans): do NOT key
the query by the raw viewport — it changes every frame. A driver hook
(`hooks/useStoreQuery`-style) debounces the movement, applies a
distance-threshold dedupe, and only then **commits an anchor**
(`{ origin, radius }`) that becomes the queryKey. React Query then owns
fetch/abort/cache; `keepPreviousData` keeps the last good result on refetch or
error, and writes to any mirroring store happen only on success (a failed fetch
must never wipe good data).

There are no push events in this WEB transport — completion of a request is the
HTTP response itself. **Do not poll** (`refetchInterval`) unless a status has no
better signal (e.g. a backend job whose only progress indicator is its own
status endpoint); prefer invalidating the relevant query on the mutation that
triggered the work.

## Do / Don't

| Do | Don't |
|---|---|
| One fetcher path per feature: the shared `httpClient` axios instance | Invent ad-hoc `axios`/`fetch` calls per hook, or a second unshared instance |
| Mirror the backend's real casing in the DTO (`card_guid`) | "Fix" casing in the DTO and skip the mapper |
| Keep the mapper in `interfaces/{Name}ViewModel.ts` as `transform{Name}ToViewModel` | Scatter mappers into `helpers/*.mapper.ts` or inline them in the component |
| `select: mapper` for queries; map inside `mutationFn` for mutations | Return DTOs from hooks or pass them to components |
| Let auth ride on the `httpClient` interceptor (`fetchAuthSession` → idToken) | Attach the `Authorization` header by hand in each fetcher |
| Check the classification table before writing a hook | Reach for `refetchInterval` when a mutation-triggered invalidation would do |
