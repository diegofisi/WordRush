# Components — primitives, typography, size & organization rules

> **Applies:** the presentational contract, size limits, folder organization and
> the state/responsive patterns are universal. Every code sample shows the shape
> in **two dialects**; which one is real here is `project.md` → UI kit.
> Copy the dialect your repo declares, never both.
>
> **Read this when:** writing any JSX.

Examples use placeholder names (`Entity`, `{feature}`). User-facing strings are
shown inline for brevity; if `project.md` declares an i18n layer, every one of
them comes from the dictionary instead (`conventions.md` → Copy).

## The presentational contract

A presentational component: **props in (Domain Models, never DTOs), JSX out.**

- **May** own local, ephemeral, presentation-only state: a disclosure/hover/focus
  toggle, an `open` flag for its own menu, `useRef`, `useId`, the outside-click
  listener of its own widget.
- **Must not** fetch, write, read or write stores, fire toasts, navigate, or
  compute business-derived data. If it does, it is a container in disguise —
  move it (`containers-pages.md` → Container/Component boundary).

"Zero hooks in a component" is a smell, not a rule.

```tsx
// Kit dialect (MUI)
export const EntityCard = ({ entity }: { entity: Entity }) => (
  <Card>
    <CardHeader title={entity.title} />
    <CardContent>
      <Stack spacing={1}>
        <Typography variant="body1">{entity.status}</Typography>
        <Typography variant="body2" color="text.secondary">{entity.description}</Typography>
      </Stack>
    </CardContent>
  </Card>
);

// Utility-CSS dialect (Tailwind + house primitives)
export const EntityCard = ({ entity }: { entity: Entity }) => (
  <Card>
    <h3 className="font-display text-lg">{entity.title}</h3>
    <div className="flex flex-col gap-1">
      <p className="text-base">{entity.status}</p>
      <p className="text-sm text-muted">{entity.description}</p>
    </div>
  </Card>
);
```

Both dialects obey the same two rules: **compose the repo's primitives, never
re-implement them**, and **no colour, font-size or spacing literal at the call
site** — it comes from a theme token, a CSS variable or a scale class.

## Layout and text

*If `project.md` declares a component kit with layout primitives* (MUI
`Stack`/`Grid`/`Box`, or a house equivalent): raw `<div>` for layout and raw
`<p>`/`<span>`/`<h1>`–`<h6>` for text are forbidden in feature code. Text goes
through the kit's typography component, whose `variant` carries the role (size +
weight) from the theme scale; the polymorphic `component` prop keeps the semantic
tag right when the look must differ from the element.

*If the repo has no layout or typography primitive* (utility-CSS repos usually
have none): use **semantic tags** — `<h1>`…`<h3>`, `<p>`, `<ul>`, `<section>`,
`<button>` — with the repo's type/colour classes. The rule that survives is that
the role is expressed once (a class set or a token), not as a font-size literal
per call site.

| Concern | Kit dialect | Utility dialect |
|---|---|---|
| Flex/grid layout | `Stack` / `Grid` / `Box` | `div` + `flex` / `grid` utilities |
| Text role | `<Typography variant="body2" color="text.secondary">` | semantic tag + role classes (`text-sm text-muted`) |
| One-off styling | `sx` against the theme | a utility class from the scale |
| Colour | theme palette path or a `Palette` token | CSS variable / token class — **never** a hex and never `var(--x)` written into `className` |
| New text role | extend the theme's typography variants | add the class set to the design tokens once |

## Size limits & extraction

**One component per file.** Internal helper components move to their own file
past ~20 JSX lines; smaller inline render helpers may stay as `const`.

| Metric | Threshold | Action |
|---|---|---|
| JSX lines | > ~200 | Extract sections into sub-components |
| Props | > 10 | Group via a hook or split the component |
| Distinct visual blocks | 3+ | Each block is an extraction candidate |
| Internal sub-component | > ~20 JSX lines | Own file in the same folder |

Extraction strategy: identify visual blocks → create sub-components named after
the section (`EntityOptionsCard`, `EntityAdvancedCard`) → props flow down, subs
stay presentational → the parent becomes pure composition.

When the same visual pattern repeats across features, promote it to the shared
layer. Feature-local first; promote on the second use.

## components/ folder organization

Group by **consumer** (the page or container that uses them), subfolders in
`kebab-case`:

| Signal | Action |
|---|---|
| Components serve clearly different views (list / detail / form) | Group by consumer view |
| > 8 files in `components/` | Strongly consider subfolders |
| Flat folder mixes list, detail and form | Always split |
| > 10 files in a consumer subfolder | Sub-group by section/tab |
| Component used by multiple subfolders | Keep it at `components/` root |

**Two nesting levels maximum.**

```text
features/{feature}/components/
  StatusBadge.tsx          # shared across list/ and form/
  list/
    EntityListTable.tsx
    EntityListFilters.tsx
  detail/
    DetailHeaderCard.tsx
  form/
    EntityFormDialog.tsx
    OptionsSection.tsx
```

Moving files: fix the relative depth of every import (`../models/` →
`../../models/` one level down) and the sibling refs.

## State components — loading, error, empty, not found

Handle **all four** through the repo's shared state components, listed in
`project.md` → UI primitives. Do not scatter bespoke inline markup per view.

| Role | Kit dialect | Utility dialect |
|---|---|---|
| Loading | `CircularProgress` / `PageLoading` | the repo's spinner or `PageLoading` |
| Error | `Alert severity="error"` / `PageError` | the repo's `PageError` or an inline error block built from tokens |
| Empty | muted typography / `PageEmpty` | the repo's `PageEmpty` |
| Not found | error component **with an `onBack` callback** | same |

If the repo has only some of them (many have no `PageError`), use what exists and
say so in `project.md` rather than inventing a component mid-task. Always pass a
context-specific message.

### Loading & error without unmounting layout

Render states **inside the content area** instead of early-returning, so headers,
filters and navigation stay mounted:

```tsx
// BAD: early return unmounts the header and the filter tabs
if (isLoading) return <PageLoading />;

// GOOD: header stays; states render in the content slot
return (
  <section className="flex flex-col gap-6">
    <SourceTabs source={source} onChange={setSource} />
    {isLoading && <PageLoading message="Loading feed..." />}
    {isError && <PageError message="Failed to load." />}
    {data && <ResultsGrid items={data} />}
  </section>
);
```

Early returns are fine when the whole component *is* the loading state.

## Responsive table → cards

Data tables: a table at desktop width, a labelled card list below the breakpoint.
Applies to any list view — even desktop apps get narrow windows.

- Kit dialect: two blocks with `sx={{ display: { xs: 'none', md: 'block' } }}` /
  `{ xs: 'block', md: 'none' }`.
- Utility dialect: `hidden md:block` / `md:hidden`.

Rules that matter regardless of dialect:

- **Always label the values on the mobile cards** — a small muted label above
  each value. Unlabelled columns are unreadable once the header is gone.
- Group related fields into rows, with a divider between logical groups.
- Let long text wrap (`flex-wrap`, `min-w-0`).

## Accessibility that colour alone cannot carry

Whenever state is communicated by colour (a tile, a badge, a key, a status dot),
it must also be communicated by text: an `aria-label`, `aria-pressed`,
`role="status"`, or visible text. A screen reader never hears a class name. This
is not optional polish; it is the difference between a usable and an unusable
state indicator.

## Do / Don't

| Do | Don't |
|---|---|
| Compose the repo's declared primitives | Hand-roll re-implementations of them |
| Keep colour/spacing in tokens | Hardcode a hex or a pixel value at the call site |
| Extract at ~200 JSX lines / 3+ blocks | 500-line mega-components |
| Use the shared state components | Bespoke inline loading/error markup per view |
| Keep states inside the content area | Early returns that unmount headers/filters |
| Label mobile card values | Unlabelled stacked data |
| Pair every colour-coded state with text | Rely on colour alone |
| Local ephemeral UI state in components | Fetching, writes, stores or toasts in components |
