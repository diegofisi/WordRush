# Components — MUI, primitives, typography, size & organization rules

> **Read this when:** writing any JSX. Covers presentational components, layout
> and typography primitives, size limits and extraction, `components/` folder
> organization, shared state components, and the responsive table→cards pattern.

All examples use structural placeholder names (`Entity`, `{feature}`).
User-facing strings in examples are plain English — in real code they stay inline
English too. This project has **no i18n library**; there is no translation layer
to route strings through (see `project.md` and `conventions.md`).

## Presentational component

```typescript
// features/{feature}/components/EntityCard.tsx
import type { EntityViewModel } from "../interfaces/EntityViewModel";
import { Card, CardContent, CardHeader, Stack, Typography } from "@mui/material";

interface EntityCardProps {
  entity: EntityViewModel;
}

export const EntityCard = ({ entity }: EntityCardProps) => (
  <Card>
    <CardHeader title={entity.title} />
    <CardContent>
      <Stack spacing={1}>
        <Typography variant="body1">{entity.status}</Typography>
        <Typography variant="body2" color="text.secondary">
          {entity.description}
        </Typography>
      </Stack>
    </CardContent>
  </Card>
);
```

What makes a component presentational: **zero business logic** — no
toast/snackbar calls, no `useMemo` with business rules, no API calls. Only
`register`/`Controller`, layout, props forwarding. If it computes derived
business data or fires notifications, it's a container disguised as a component —
refactor it.

Presentational components MAY own **local, ephemeral, presentation-only state** —
a disclosure/hover/focus toggle, an `open` flag for their own menu/popover, `useRef`,
`useId`, and the outside-click listener of their own widget. What they must NOT do
is fetch, mutate, read/write stores, fire snackbars, or compute business-derived
data. 'Zero hooks in a component' is a smell, not a rule (see
`containers-pages.md` → The Container/Component boundary).

MUI components come from `@mui/material`; compose and theme them, never
re-implement them by hand. Use the existing MUI primitives before inventing new
ones.

## Layout primitives — replace raw `<div>`

**Never use raw `<div>`, `<p>`, `<span>`, or `<h1>`–`<h6>` in feature code.**
Use MUI layout primitives and `<Typography>`.

| Primitive | Replaces | Description | Key props | CSS basis |
|---|---|---|---|---|
| `Stack` | `<div>` with flex | Flex container for stacking | `spacing`, `direction`, `alignItems`, `justifyContent`, `flexWrap`, `sx` | Flexbox |
| `Grid` | `<div>` with grid | Responsive grid layout | `container`, `item`, `spacing`, `xs`/`sm`/`md`, `sx` | Flexbox/Grid |
| `Box` | generic `<div>` | Polymorphic themed wrapper | `sx`, `component` | Block/Flex |

Spacing, colors, and one-off rules go through the `sx` prop against the theme —
never inline `style={{...}}` or a raw class.

## Typography — MUI `<Typography variant=...>`

All text renders through MUI `<Typography>` from `@mui/material`:
`<Typography variant="..." color="..." sx={...}>`. **Never** raw `<h1>`/`<p>`/`<span>`
in feature code.

- **`variant`** = role → size + default weight, from the theme's typography scale.
  Values: `h1 h2 h3 h4 h5 h6 subtitle1 subtitle2 body1 body2 caption overline`.
  For inline emphasis inside running text, keep it inside the parent `Typography`
  (e.g. a nested `<Box component="span" sx={{ fontWeight: 600 }}>`).
- **`component`** = constrained polymorphic tag. Each variant maps to a default
  semantic tag via the theme's `variantMapping`; pass `component` only when the
  look must differ from the element: `<Typography variant="h1" component="h2">`
  renders h1 styling on an `<h2>`.
- **`color`**: use theme palette paths — `text.primary`, `text.secondary`,
  `text.disabled`, `primary`, `error`, etc. — e.g. `color="text.secondary"`.
- The call site carries **no raw font-size**: `<Typography variant="body2" color="text.secondary">`.
  Need a genuinely new role? Extend the theme's typography variants rather than
  hardcoding `sx={{ fontSize: 13 }}` at every call site; reserve `sx` for true one-offs.

Palette constants live in `common/models/palette.ts` (`Palette`); prefer theme
palette paths in `sx`/`color` and reach for `Palette` only where the theme
doesn't already expose the value.

## Size limits & extraction

**One component per file.** Each `.tsx` exports exactly one component. Internal
helper components go to their own file when they exceed ~20 JSX lines; smaller
inline render helpers (no props interface) may stay as `const` in the file.

| Metric | Threshold | Action |
|---|---|---|
| JSX lines | > ~200 | Extract sections into sub-components |
| Props | > 10 | Group via a hook or split the component |
| Distinct visual blocks (Cards/sections) | 3+ | Each block is an extraction candidate |
| Internal sub-component | > ~20 JSX lines | Extract to own file in same folder |

Extraction strategy: (1) identify visual blocks (each `<Card>`/section);
(2) create sub-components in the same folder named after the section
(`EntityOptionsCard`, `EntityAdvancedCard`); (3) props flow down —
sub-components stay purely presentational; (4) the parent becomes pure
composition (~100 lines of `<XCard form={form} />` blocks).

Shared pattern components: when the same visual pattern repeats across
features, promote it to `common/components/` (e.g. an integer-only
`QuantityInput`). Feature-local first; promote when reused.

## components/ folder organization

Group by **consumer** (the page/container that uses them), subfolders in
`kebab-case`:

| Signal | Action |
|---|---|
| Components serve clearly different views (list vs detail vs form) | Group by consumer view |
| > 8 files in `components/` | Strongly consider subfolders |
| Flat folder mixes list, detail, and form components | Always split |
| > 10 files in a consumer subfolder | Sub-group by section/tab (`detail/{section}/`-style) |
| A tab has 2+ extracted sub-components | Move tab + subs into a sub-folder |
| Component used by multiple subfolders | Keep at `components/` root |

**Two nesting levels maximum.** `components/list/EntityListRow.tsx` (1) and
`components/list/row/EntityRowActions.tsx` (2) are fine; a third level is
never allowed.

```text
features/{feature}/components/
  StatusBadge.tsx             # shared across list/ and form/
  list/                       # → list view section
    EntityListTable.tsx
    EntityListFilters.tsx
  detail/                     # → detail view
    DetailHeaderCard.tsx
    DetailItemsTable.tsx
  form/                       # → create/edit dialog
    EntityFormDialog.tsx
    OptionsSection.tsx
    AdvancedSection.tsx
```

Import-path updates when moving files: inside level-1 subfolders `../interfaces/` →
`../../interfaces/`; inside level-2 `../../interfaces/` → `../../../interfaces/`;
sibling refs `./StatusBadge` → `../StatusBadge`; external consumers add the
subfolder path.

## Shared state components

Handle ALL loading/error/empty/not-found states with MUI primitives:
`CircularProgress` for loading, `Alert severity="error"` for errors, and a muted
`<Typography>` for empty. **Do not** scatter bespoke inline markup for these
states across features.

Today there are **no** shared `PageLoading`/`PageError`/`PageEmpty` components —
each view wires MUI primitives directly. Consider introducing small shared
wrappers in `common/components/` once the pattern repeats:

| Component (suggested) | Built on | Default message | Usage |
|---|---|---|---|
| `PageLoading` | `CircularProgress` | "Loading..." | Data being fetched |
| `PageError` | `Alert severity="error"` | "Something went wrong." | Endpoint error |
| `PageEmpty` | muted `Typography` | "No results." | List has zero items |
| `PageNotFound` | `Alert` + back action | (message required) | Entity not found; **requires `onBack`** callback |

```tsx
{isLoading ? (
  <CircularProgress aria-label="Loading list..." />
) : isError ? (
  <Alert severity="error">Failed to load the list.</Alert>
) : (
  <EntityListTable entities={data} />
)}

if (entities.length === 0) {
  return <Typography color="text.secondary">Nothing here yet.</Typography>;
}
```

Always pass a context-specific message. If/when you add the shared wrappers,
adopt them from day one in new features.

## Loading & error without unmounting layout

Render loading/error **inside the content area** instead of early-returning, so
headers/filters/navigation stay mounted:

```tsx
// BAD: early return unmounts the header and the filter tabs
if (isLoading) return <CircularProgress />;

// GOOD: header stays; states render in the content slot
return (
  <Stack spacing={3}>
    <SourceTabs source={source} onChange={setSource} />
    {isLoading && <CircularProgress aria-label="Loading feed..." />}
    {isError && <Alert severity="error">Failed to load.</Alert>}
    {data && <ResultsGrid items={data} />}
  </Stack>
);
```

Apply when: detail views with back/header, views with filters or search bars
above the data, any view where the user needs context while loading. Early
returns are OK when the whole component IS the loading state (no surrounding
layout yet).

## Responsive Table → Cards

Data tables: desktop `<Table>` (`sx={{ display: { xs: 'none', md: 'block' } }}`)
+ mobile `<Card>` list (`sx={{ display: { xs: 'block', md: 'none' } }}`). Apply to
any list view — even desktop apps get narrow windows.

```tsx
// Desktop: table
<Box sx={{ display: { xs: 'none', md: 'block' } }}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Title</TableCell>
        <TableCell>Format</TableCell>
        <TableCell align="right">Date</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {entries.map((e) => (
        <TableRow key={e.id}>
          <TableCell>{e.title}</TableCell>
          <TableCell>{e.format}</TableCell>
          <TableCell align="right">{formatDate(e.date)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</Box>

// Mobile: cards — ALWAYS labeled values
<Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
  {entries.map((e) => (
    <Card key={e.id}>
      <CardContent sx={{ p: 1.5 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">Title</Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>{e.title}</Typography>
            </Stack>
          </Stack>
          <Divider />
          <Stack direction="row" spacing={3}>
            <Stack>
              <Typography variant="caption" color="text.secondary">Format</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{e.format}</Typography>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  ))}
</Stack>
```

Rules: **always show labels** on mobile cards (`<Typography variant="caption" color="text.secondary">`
above each value); group related fields in `Stack direction="row"` rows with a
`<Divider />` between logical groups; `sx={{ flexWrap: 'wrap' }}` for long text.

## Do / Don't

| Do | Don't |
|---|---|
| MUI `Stack`/`Grid`/`Box` for all layout | Raw `<div>` soup |
| `<Typography variant>` for all text | Raw `<p>`/`<span>`/`<h*>` |
| Explicit `color="text.secondary"` on nested typography | Rely on inheritance when parent is muted |
| Extend theme typography variants for new roles | Hardcode `sx={{ fontSize: 13 }}` at every call site |
| `sx` prop + theme for one-off styling | Inline `style={{...}}` or ad-hoc classes |
| Extract at ~200 JSX lines / 3+ blocks | 500-line mega-components |
| MUI `CircularProgress`/`Alert` (or shared `PageLoading`/`PageError`/`PageEmpty` once added) | Bespoke inline state markup per view |
| Keep states inside the content area | Early returns that unmount headers/filters |
| Compose/theme MUI components | Hand-written re-implementations of MUI primitives |
