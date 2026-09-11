# Conventions — naming, copy, theme, rules & anti-patterns

> **Read this when:** naming any file/type/function, touching user-facing copy or
> theme, or doing a final review of a change. Ends with the complete DO/DON'T list —
> when in doubt, that list wins.

## Naming (full table)

| Element | Convention | Example |
|---|---|---|
| Feature folder | `kebab-case` | `{feature-name}/` |
| API subfolder | `PascalCase` grouping under `api/` | `api/CardManagement/CardDetails/`, `api/MemberSearch/v1/` |
| DTO file | `{Name}DTO.ts` | `GetCardDetailsDTO.ts`, `MemberAccountDTO.ts` |
| Hook file (RQ) | `use{Action}.ts` | `useGetStores.ts`, `useGetMemberCardsByMemberAndProgram.ts` |
| Hook file (custom) | `use{X}.ts` | `useAddressStore.ts`, `useStoreLocator.ts` |
| Component file | `PascalCase.tsx` | `CardDetails.tsx` |
| Container file | `PascalCase.tsx` | `MemberSearchContainer.tsx` |
| ViewModel / mapper file | `{Name}ViewModel.ts` in `interfaces/` | `CardDetailsViewModel.ts` |
| Store file | `use{Domain}Store.ts` | `useStoreLocatorStore.ts`, `useTableauTabStore.ts` |
| Helper file | `camelCase.ts` | `parseInput.ts` |
| Schema file | `kebab-case.ts` | `entity-form.schema.ts` |
| Interface/Type | `PascalCase` | `CardDetailsViewModel`, `GetCardDetailsResponse` |
| Mapper function | `transform{Name}ToViewModel` | `transformCardDetailsToViewModel` |
| Constant | `UPPER_SNAKE_CASE` | `RECENT_KEY`, `MAX_CONCURRENCY` |
| Backend endpoint name (in the fetcher) | whatever the backend really uses | an HTTP path is its real route (e.g. `/account/member/locations/{cardGuid}`) |
| Push/event name | `kebab-case` string | `'job-progress'` |

React Query hooks live under `api/[Endpoint]/`; custom hooks in `hooks/` (or a
feature `context/`). ViewModels and their `transform…ToViewModel` mappers live in
`interfaces/`; DTOs in `dto/` or co-located under `api/`. Use the configured path
alias for `common/` and `features/` imports.

### Identifier names — always descriptive, never single letters

Every variable/parameter carries a meaningful name: `.map((store) => …)`, not
`.map((s) => …)`; sort comparators use `(first, second)`, not `(a, b)`; store
selectors use `(state) => state.x`, not `(s) => s.x`. The ONLY allowed
exceptions: loop indexes `i`/`j` in plain `for` loops, and the conventional `_`
for an intentionally unused argument. `e`/`err`/`res` are NOT exceptions — write
`event`, `error`, `response`.

## House rules (universal defaults — project.md may refine)

| Topic | Rule |
|---|---|
| Commit messages | **English**, conventional style `type(scope): description` (follow the house PR format) |
| Code comments | **English**, concise, max ~2 lines; explain the *why* |
| UI text / user-facing errors | Inline **English** strings — there is no i18n layer. Keep copy readable and out of deep logic (see below) |
| localStorage | Prefix every key with the app's namespace (`{app}.`) — the concrete prefix and legacy keys live in `project.md` |
| Backend error strings | If the backend returns user-facing error strings (no error codes), treat them as product copy: show them as the toast body |

## Comments — sparse, why-not-what

Add a comment only when it says something the code cannot. Default to none.

- **Max 1–2 lines**, English, explain the **why** — never the what.
- **Cut redundancy**: a comment that restates the code, names the rule/identifier
  right above it, or narrates what a line does. Litmus: if deleting it loses no
  information a competent reader gets from the code, delete it.
- **Cut technical essays**: a multi-line walkthrough of how a system works belongs
  in the skill/docs, not inline — reference the concept, don't transcribe it.
- **Keep** the terse non-obvious reason: `// first match wins`, `// StrictMode
  double-effect guard`, `// programs are versioned at program level`.
- Never touch directive comments (`eslint-disable`, `@ts-expect-error`, region
  markers) — they are not prose.

## User-facing copy — inline English (no i18n layer)

This app has **no i18n library** (no i18next/react-i18next, no Paraglide, no
message catalogs). User-facing strings are written **inline in English** at the
call site. There is no `t.*` object, no ICU templates, no `data-*` translation
attributes — do not invent or port any of that.

- **Write the string where it renders**: `<Typography variant="h1">Card
  details</Typography>`. No key indirection, no accessor object.
- **Keep copy readable and out of deep logic**: a user-facing string should be
  legible where it lives — surface it in the presentational layer, not buried
  inside a mapper, reducer branch, or nested ternary. If the same phrasing repeats,
  a local `const` is fine; a global catalog is not the pattern here.
- **Backend-owned copy stays backend-owned**: when the backend returns a
  user-facing message, render that message — don't shadow it with a hardcoded FE
  string. (Business rules and error-message *text* belong on the backend; the FE
  just renders it.)
- **Dynamic strings**: build them with plain template literals
  (`` `No results for "${query}".` ``). Keep the interpolation obvious and local.
- A future i18n layer (routing all copy through catalogs) would be a **separate,
  deliberate effort** — not something to bolt on ad hoc while touching a view.

## Theme — MUI theme + `Palette` const + `sx`

- The app palette is a **const object** in `common/models/palette.ts`
  (`Palette.AQUA`, `Palette.BACKGROUND`, `Palette.DANGER`, `Palette.GRAY_LIGHT`,
  …). No hex literals at call sites — reference a `Palette` token.
- The **MUI theme** lives in `common/theme/theme.ts` (built on
  `common/theme/baseTheme.ts`), wiring `Palette` tokens into `palette`, `typography`,
  and component defaults. Style through the theme, not raw values.
- **Style with the `sx` prop and theme tokens** — `sx={{ color: 'primary.main',
  px: 3, borderRadius: 2 }}` — not inline `style`, not CSS classes, not CSS
  variables. Spacing/radius use the theme scale (`px: 3` = the theme's spacing unit
  ×3), not arbitrary pixel values.
- Where a token isn't in the theme yet, pull from `Palette`
  (`sx={{ color: Palette.DANGER }}`) rather than hardcoding a hex at the call site.
- Theme changes (a new brand color, a component default) go in the theme/`Palette`
  files **once**; components restyle by referencing the token, no per-component hex.

## Const object + type pattern

For enums, always **const object + type extraction** — never TS `enum`:

```typescript
export const JobStatus = {
  Queued: "queued",
  Running: "running",
  Finalizing: "finalizing",
  Paused: "paused",
  Done: "done",
  Error: "error",
  Canceled: "canceled",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
```

Tree-shakeable, gives runtime value + type, consistent across
statuses/modes/unions. Always compare against the constant (`JobStatus.Done`),
not raw strings. (The canonical auth instance, `AuthStatus`, lives in
`web-app-patterns.md`.)

## Effects — you might not need one

`useEffect` is ONLY for synchronizing with an **external system** (event
subscription, timer, DOM measurement, imperative widget). If no external system is
involved, you don't need an effect. Enforce with the ESLint lint
`react-hooks/set-state-in-effect`.

| Anti-pattern (don't) | Correct approach |
|---|---|
| Derived state via `setState` in an effect | Compute during render |
| Expensive derived value | `useMemo` |
| Reset *all* state when a prop changes | `key` prop to remount |
| Adjust *some* state on a prop change | Store minimal state, derive the rest during render (or the "prev value in render" pattern) |
| Logic that should run on a user action | Event handler, not an effect |
| Notifying a parent | Call the callback in the same handler that set the state |
| Subscribing to an external store | `useSyncExternalStore` |

**Legit effects still include** timers, DOM/event listeners, and **syncing one
external store into another** (e.g. seeding a Zustand working-copy from a React
Query result) — note React Query v5 has **no `onSuccess` on `useQuery`**, so an
effect (or `select`) is the correct RQ→store sync mechanism, not an anti-pattern.

## Animations — without effects

Never drive animation from `useEffect` (a class/style toggle after mount forces an
extra commit+repaint and, on lists, layout thrash). Preference order:
1. **MUI transitions / CSS transitions** for state toggles (open/close, hover) —
   MUI's `Fade`/`Collapse`/`Grow` or a `sx` `transition`.
2. **`@starting-style` + `transition-behavior: allow-discrete`** for mount/enter
   and animating out of `display:none` (the exact replacement for the
   "useEffect to animate on mount" pattern) — expressed via `sx`.
3. **`view-transition` / React `<ViewTransition>`** for reorders and shared-element morphs (FLIP without manual measuring).
4. **Motion (Framer)** only for spring physics / gestures / `layout` animation.
5. **`useLayoutEffect`** ONLY for pre-paint measurement (FLIP, tooltip positioning) — usually a library already does it.

## `sx` + theme tokens over ad-hoc values (gotcha)

Reach for theme tokens before literal values in `sx`: `px: 3` over `px: '18px'`,
`borderRadius: 2` over `borderRadius: '16px'`, `color: 'error.main'` /
`Palette.DANGER` over `color: '#FF7E7E'`. A raw hex or pixel value at a call site
silently forks from the theme — the next brand/spacing change won't reach it, and
it drifts from every other component. Use a literal only where no token/scale value
exists.

## Rules & anti-patterns (complete)

### DO

- Use MUI Layout Primitives (`Stack`, `Grid`, `Box`) and `<Typography variant="...">` for all text — never raw layout/text tags.
- Set `color` explicitly on nested typography when the parent's color must not inherit.
- Transform every DTO into a ViewModel (via `transform{Name}ToViewModel`) before the UI consumes it.
- Keep components **dumb** and containers **smart**.
- Use React Query's `select` for query data transformation; type hooks generically for the Adapter Pattern.
- Use the theme spacing scale over arbitrary px in `sx` (`px: 3`, not `px: '18px'`; 1 unit = the theme's spacing base). Literal `sx` values ONLY where no token/scale form exists.
- Create feature folders only when needed.
- Zustand for client UI state + live processes; request/response server data in React Query.
- Zod for form validation; `z.infer` for types; compose schemas.
- Co-locate DTO + hook under `api/[Endpoint]/`; keep the `{Name}DTO.ts` separate; keep the ViewModel + `transform…ToViewModel` mapper in `interfaces/`.
- `mutate` + `onSuccess`/`onError` in containers.
- `hooks/` for custom hooks only.
- Path constants (`AppPath.*`) for all navigation.
- `if` + early returns for conditional rendering — no `else`, no `if-else` chains, no `switch/case` (object lookup tables are the alternative).
- `use{X}Store.getState()` in non-React contexts (schedulers, event listeners, interceptors).
- Derive Zustand initial state from `localStorage` via helpers.
- Navigation callbacks from pages to containers; `<button type="button">` in components for intra-page moves.
- Const-object enums for all status comparisons.
- Promote containers to folders at 3+ dialogs/operations (see `containers-pages.md` → Orchestrator Container).
- Responsive Table → Cards with labeled mobile fields (see `components.md` → Responsive Table → Cards).
- Local hooks for cross-feature data (see `architecture.md` → Cross-feature data access).
- Loading/error inside the content area when headers/filters must persist (see `components.md` → Loading & error without unmounting).
- Extract custom hooks at ~200 logic lines or 5+ memos/effects (see `containers-pages.md` → Custom-hook extraction).
- Presentational components under ~200 JSX lines; extract visual blocks (see `components.md` → Size limits).
- Semantic `components/` subfolders past ~8 files; sub-group past ~10; max 2 levels (see `components.md` → Folder organization).
- Shared state components for loading/error/empty/not-found (see `components.md` → Shared state components).

### DON'T

- **NEVER** pass DTOs to components.
- **NEVER** use raw `<div>` for layout or raw `<p>/<span>/<h*>` for text.
- **NEVER** put business logic in presentational components (no business `useMemo`, no `toast`, no API calls there).
- **NEVER** call the transport (HTTP client) from components/containers/pages — only `api/` hooks and stores.
- **NEVER** use `any`.
- **NEVER** mix feature concerns or import across features (local hooks instead; sole exception: the sanctioned facades listed in `project.md`, via `index.ts` only).
- **NEVER** use `mutateAsync` + `try/catch` in containers.
- **NEVER** create standalone mapper files — keep the `transform…ToViewModel` mapper with its ViewModel in `interfaces/`; never inline a DTO in a hook file.
- **NEVER** put React Query hooks in `hooks/`.
- **NEVER** hardcode paths — `AppPath.*` only.
- **NEVER** use `switch/case` or `if-else` chains.
- **NEVER** use `window.location.href` for navigation — router navigation only. (The 401-interceptor variant of this rule lives in `web-app-patterns.md`.)
- **NEVER** use `<Link>` for intra-page view switching — callbacks + buttons.
- **NEVER** hardcode Zustand initial state that depends on runtime values.
- **NEVER** early-return loading/error when it unmounts context the user needs.
- **NEVER** show unlabeled data on mobile cards.
- **NEVER** use `useReducer` as a `useMemo`-chain substitute under RHF.
- **NEVER** use `useActionState`/`useFormStatus`/`useOptimistic` with RHF.
- **NEVER** nest component subfolders past 2 levels.
- **NEVER** write inline loading/error/empty `<Typography>` patterns.
- **NEVER** bury user-facing copy in deep logic (mappers, reducer branches, nested ternaries) — surface it in the presentational layer.
- **NEVER** wrap store-driven process endpoints (start/cancel job) in React Query.
- **NEVER** hardcode a hex or pixel value in `sx` — use a theme token or `Palette` const.

## AI-driven development ground rules

1. When creating a new feature, scaffold the folder structure first, then implement following the data-flow direction: DTO → ViewModel + `transform…ToViewModel` → Hook → Schema → Container → Component → Page.
2. Generate **all layers** when integrating a new endpoint — never a hook without its DTO and ViewModel/mapper.
3. Use MUI components from `@mui/material`; style via `sx` + theme tokens, never hand-rolled styled `<div>`s with hardcoded values.
4. Respect the configured path aliases for `common/...` and `features/...` in all imports.
5. Follow the naming table strictly. Everything else is the DO/DON'T list above, restated — when in doubt, that list wins.
