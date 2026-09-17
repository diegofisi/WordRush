# Conventions — naming, copy, theme, rules & anti-patterns

> **Applies:** naming, comments, const-object enums, effects and animations are
> universal. *Copy* has two branches (i18n layer / no i18n layer) — pick the one
> `project.md` declares. *Theme* depends on the styling system declared there.
>
> **Read this when:** naming anything, touching user-facing copy or theme, or
> doing the final review of a change.

## Naming

The table below is the **shape**; the exact casing of `api/` folders and the
mapper name are house style, declared in `project.md` → House conventions. What
never varies is that one convention is used everywhere.

| Element | Convention | Example |
|---|---|---|
| Feature folder | `kebab-case` | `game/`, `store-locator/` |
| API subfolder | one per endpoint/event, house casing | `api/get-card-details/` or `api/Card/GetCardDetails/` |
| DTO file | house form, always named after the endpoint | `get-card-details.dto.ts` / `GetCardDetailsDTO.ts` |
| Data hook file | `use{Action}.ts` | `useGetStores.ts` |
| Custom hook file | `use{X}.ts` | `useEntityFilters.ts` |
| Component / container file | `PascalCase.tsx` | `EntityCard.tsx` |
| Model + mapper file | named after the model, in the models folder | `CardDetails.ts` |
| Store file | `use{Domain}Store.ts` | `useGameStore.ts` |
| Helper file | `camelCase.ts` | `parseInput.ts` |
| Schema file | `kebab-case.ts` | `entity-form.schema.ts` |
| Type / interface | `PascalCase` | `GetCardDetailsResponse` |
| Mapper function | house form | `toCardDetails` / `transformCardDetailsToViewModel` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_CONCURRENCY` |
| Event name | exactly what the backend calls it | `'round:start'` |

Data-layer hooks live under `api/`; custom hooks in `hooks/`. Use the configured
path alias in imports, never a chain of `../../..` across layers.

### Identifier names — descriptive, never single letters

`.map((store) => …)`, not `.map((s) => …)`; comparators `(first, second)`;
selectors `(state) => state.x`. The only exceptions: loop indexes `i`/`j` in
plain `for` loops and `_` for an intentionally unused argument. `e`, `err` and
`res` are **not** exceptions — write `event`, `error`, `response`.

## Comments — sparse, why-not-what

Add a comment only when it says something the code cannot.

- Max 1–2 lines, in the repo's documentation language, explaining the **why**.
- **Cut redundancy**: a comment restating the code or naming the identifier above
  it. Litmus: if deleting it loses nothing a competent reader gets from the code,
  delete it.
- **Cut essays**: a walkthrough of how a system works belongs in the docs, not
  inline.
- **Keep** the terse non-obvious reason: `// first match wins`,
  `// StrictMode double-effect guard`, `// the server owns the deadline`.
- Never touch directive comments (`eslint-disable`, `@ts-expect-error`).

## User-facing copy

**Branch A — the project has an i18n layer** (`project.md` says so):

- Every user-facing string comes from the dictionary. No inline literal in JSX,
  no string built in a mapper, no `"Loading…"` fallback typed at a call site.
- One language is the **source**, and its shape is the type every other
  dictionary must satisfy. Adding a key means adding it to all of them, and the
  typecheck is what tells you that you forgot.
- Dynamic text uses a function in the dictionary
  (`t.game.solvedBy(name)`), not string concatenation at the call site.
- Non-React callers (stores, event handlers) read the dictionary through the
  non-React accessor, not through the hook.
- The interface language is a separate concept from any domain language (the
  language of the content). Do not couple them.

**Branch B — no i18n layer**: strings are written inline, in the project's
language, **where they render** — surfaced in the presentational layer, never
buried in a mapper, a reducer branch or a nested ternary. If the same phrasing
repeats, a local `const` is fine; a global catalog is a deliberate migration, not
something to bolt on while touching a view.

Both branches: **backend-owned copy stays backend-owned.** When the server
returns a user-facing message, render it; don't shadow it with a hardcoded
string.

## Theme & tokens

- Colours, spacing, radii and fonts are **tokens** defined once: a theme object,
  a palette const, or CSS variables. `project.md` says which.
- **No hex, rgb or pixel literal at a call site.** A literal silently forks from
  the design system: the next brand or spacing change will not reach it.
- Prefer the scale over an arbitrary value (`px: 3` over `'18px'`;
  `rounded-lg` over `border-radius: 14px`). Use a literal only where no token or
  scale value exists — and then consider adding one.
- With utility CSS, **never write a raw `var(--x)` into a class attribute**: the
  utility compiler only emits classes it can see, and an arbitrary value string
  built at runtime produces nothing. Add the token to the theme layer and use its
  generated class.
- Theme changes (a new brand colour, a component default) happen **once** in the
  theme/token files; components restyle by referencing the token.

## Const object + type pattern

Always const object + type extraction — never a TS `enum`:

```typescript
export const JobStatus = {
  Queued: "queued",
  Running: "running",
  Done: "done",
  Error: "error",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
```

Tree-shakeable, gives a runtime value and a type, and consistent across statuses,
modes and unions. Always compare against the constant, never a raw string.

## Effects — you might not need one

`useEffect` is ONLY for synchronizing with an **external system**: a subscription,
a timer, a DOM measurement, an imperative widget.

| Anti-pattern | Correct approach |
|---|---|
| Derived state set in an effect | Compute during render |
| Expensive derived value | `useMemo` |
| Reset *all* state when a prop changes | `key` prop to remount |
| Adjust *some* state on a prop change | Store the minimum, derive the rest during render |
| Logic that should run on a user action | An event handler |
| Notifying a parent | Call the callback in the handler that set the state |
| Subscribing to an external store | `useSyncExternalStore` (or the store's hook) |
| Initializing an app singleton | Call it module-side or in the bootstrap |

Enable `react-hooks/exhaustive-deps` and
`react-hooks/set-state-in-effect`. Never silence a deps warning without a comment
saying why. Every subscription, interval, listener and in-flight request gets a
cleanup — **except** the app-singleton listeners described in `state.md`, where
the absence of cleanup is the deliberate design and is written down.

**Legit effects** still include timers, DOM/event listeners, and syncing one
external store into another. Note that React Query v5 has no `onSuccess` on
`useQuery`, so an effect (or `select`) is the correct cache→store sync mechanism.

## Animations — without effects

Never drive an animation from `useEffect`: a class toggle after mount forces an
extra commit and repaint, and on lists it causes layout thrash. Preference order:

1. **CSS transitions** for state toggles (open/close, hover), or the kit's
   transition components.
2. **`@starting-style` + `transition-behavior: allow-discrete`** for enter
   animations and animating out of `display: none` — the exact replacement for
   "useEffect to animate on mount".
3. **View transitions** for reorders and shared-element morphs.
4. **A physics library** only for springs, gestures and layout animation.
5. **`useLayoutEffect`** only for pre-paint measurement.

Always honour `prefers-reduced-motion`.

Transition the property that is actually animated. Modern CSS (and Tailwind v4)
exposes `translate`, `scale` and `rotate` as **independent properties**:
`transition-[transform]` does not animate a `translate-x-*` utility. See
`pitfalls.md`.

## Rules & anti-patterns

### DO

- Transform every DTO into a Model before the UI sees it.
- Keep components dumb and containers thin; the logic lives in a hook.
- Use the repo's declared primitives and tokens for layout, text and colour.
- Create feature folders only when needed.
- Client/UI and live-process state in stores; request/response server data in the
  data layer.
- Co-locate DTO + mapper + hook per endpoint, in the house form.
- `if` + early returns for conditional rendering — no `else` chains, no
  `switch/case` (an object lookup table is the alternative).
- `use{X}Store.getState()` in non-React contexts.
- Derive store initial state from storage via helpers, inside try/catch.
- Navigation callbacks from pages to containers; `<button type="button">` for
  intra-page moves.
- Const-object enums for every status comparison.
- Loading/error inside the content area when headers must persist.
- Extract custom hooks at ~200 logic lines or 5+ memos/effects.
- Presentational components under ~200 JSX lines.
- Semantic `components/` subfolders past ~8 files; max 2 levels.

### DON'T

- **NEVER** pass DTOs to components.
- **NEVER** put business logic in a presentational component.
- **NEVER** import the transport client outside `api/` and `stores/`.
- **NEVER** use `any`.
- **NEVER** import across features outside the sanctioned facades.
- **NEVER** create standalone mapper files, or inline a DTO in a hook file.
- **NEVER** put data-layer hooks in `hooks/`.
- **NEVER** hardcode paths — path constants only.
- **NEVER** use `switch/case` or `if-else` chains for view selection.
- **NEVER** use `window.location.href` for in-app navigation.
- **NEVER** hardcode store initial state that depends on runtime values.
- **NEVER** early-return loading/error when it unmounts context the user needs.
- **NEVER** show unlabelled data on mobile cards.
- **NEVER** mix React 19 form hooks with a form library.
- **NEVER** nest component subfolders past 2 levels.
- **NEVER** wrap a pushed event or a live process in a query hook.
- **NEVER** hardcode a colour or spacing literal at a call site.
- **NEVER** bury user-facing copy in deep logic.

## Ground rules for agent work

1. Scaffold the folder structure first, then implement in data-flow order:
   DTO → Model + mapper → hook/store → schema → container → component → page.
2. Generate **all layers** for a new endpoint — never a hook without its DTO and
   Model.
3. Use the primitives and tokens `project.md` declares; do not import a library
   the repo does not have.
4. Respect the configured path aliases.
5. Finish by running the repo's verification command (`SKILL.md` → Validation)
   and re-reading `pitfalls.md`.
