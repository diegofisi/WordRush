# Containers, pages & logic extraction

> **Applies:** always. Library-neutral; the only thing `project.md` changes here
> is which primitives appear in the example JSX.
>
> **Read this when:** writing containers, pages, orchestrators, or deciding
> whether to extract a custom hook.

## The Container/Component boundary (universal rule)

The old "components are props-only with zero hooks" rule is **retired** — it was
over-rigid, and the author of the Container/Presentational pattern retracted the
prescriptive version. The real split is **data/business vs presentation**, not
*all state* vs *no state*.

**Rule A — where state lives.** One-sentence test: *if the state vanished on
remount and nothing outside the component would notice, it belongs in the
component; if anything external (server, store, a sibling, the URL, a toast)
depends on it, it belongs in the container or a hook.*

| In the **component** | In the **container/hook** |
|---|---|
| `useState` for open/hover/focus/expanded/active tab/own draft | Server data |
| `useRef`, `useId` | Mutations / writes |
| Outside-click or Escape listener for **its own** popover | Shared/global store state |
| CSS animation of its own UI | Business-derived data |
| | Toasts, navigation, any external effect |
| | Orchestrating multiple components |

A dropdown owning its own `open` plus outside-click listener is a correct
presentational component. Do not hoist that into a container.

**Rule B — what a container's JSX may contain.** Only (1) other components,
(2) conditional rendering, (3) fragments, and passing props/callbacks.
**Forbidden inside container JSX:** layout markup, icons, custom text layouts,
styling attributes, raw inputs and buttons. If substantial markup appears, that
JSX is a component — extract a `<FooView/>`.

*Carve-out — leaf confirm dialogs.* A tiny leaf container whose whole job is
"confirm + one write" may render the dialog shell with its title, text and
buttons directly: the dialog *is* the component, and a separate view file for a
15-line confirm is over-engineering. Extract a view once the body grows past a
simple confirm or a short form.

```tsx
// container JSX = components + conditionals + props
return (
  <>
    {children}
    {gate.phase === Phase.Open && <OnboardingScreen {...gate} />}
  </>
);
```

### Shell-with-slots — composing without raw markup

When a connected unit has real layout (heading + anchored dropdown + controls
row), the container cannot hold that markup (Rule B), and one mega-`<XView>`
taking the whole view model is not the answer either — it just moves the
monolith. Split it:

- **`XShell`** (component): pure layout with named `ReactNode` slots (`input`,
  `dropdown`, `controls`, `status`). Owns every wrapper and every style.
- **Small components per slot**, each receiving only what it renders.
- **The container** calls the hook and fills the slots; the composition decisions
  (which slot renders, with which props) live there.

```tsx
export function Search({ config }: Props) {
  const search = useStoreSearch(config);
  return (
    <SearchShell
      onClickAway={search.onClickAway}
      input={<SearchInput value={search.query} onChange={search.onChange} />}
      dropdown={search.showDropdown && <SearchResultsDropdown rows={search.rows} />}
      controls={<SearchControls radius={search.radius} />}
      status={search.isLoading && <SearchStatus />}
    />
  );
}
```

**Rows as view models.** List items must be dumb. If an item needs derived data
(distance from an anchor, selection from the URL), the hook precomputes rows —
`rows: { entity, miles, isSelected }[]` — and exposes the handler
(`onToggle(entity)`). An item that reads the store or the URL itself, or calls an
imperative map/audio API, is a container in disguise.

**Rule C — the container is THIN; logic ALWAYS lives in a hook.** A container is
not a "super component": it is the thinnest smart unit, calling a hook and wiring
its result to dumb components. The **hook is the brain**. If a container contains
a `useMemo`, a `useEffect`, derived business data, or multi-step handlers, that
logic belongs in a hook.

```tsx
// ideal container: get from a hook, render — nothing else
export const EntityListContainer = ({ onEdit }: Props) => {
  const { entities, isLoading } = useEntityList();
  if (isLoading) return <PageLoading message="…" />;
  return <EntityListTable entities={entities} onEdit={onEdit} />;
};
```

Litmus: a container should read like `const x = useX(); return <View {...x} />;`.

### The four categories (no overlap)

| Layer | Folder | What it is | Owns |
|---|---|---|---|
| **Page** | `pages/` | A route's composition root | cross-unit state (which dialog is open, shared selection). One per route. |
| **Container** | `containers/` | A thin, hook-backed connected unit | its concern's wiring. Reusable; not a route. |
| **Component** | `components/` | Presentational | props + local ephemeral UI state. |
| **Hook** | `hooks/` or `api/` | The logic | data, writes, derived state, handlers. Testable without a tree. |

- If a component fetches, writes or derives business data → it is a container.
- If a "container" holds no hook and just renders markup → it is a component.
- A page is never a container.

### When does a container exist?

A `containers/` folder appears **only when a page places 2+ independent connected
units** (a list + dialogs, tabs).

- **1 operation → no container.** The page uses the hook directly. A container a
  page wraps 1:1 is a thin-wrapper anti-pattern.
- **2+ operations → containers.** Each connected unit is a thin container; the
  page owns the state between them.

A feature with no `containers/` folder is correct, not an omission.

## Container — read

```tsx
export const EntityListContainer = () => {
  // 'entities' is typed as the Domain Model, never a DTO
  const { data: entities, isLoading } = useGetEntities();

  if (isLoading) return <PageLoading message="Loading..." />;
  if (!entities) return null;

  return <EntityListTable entities={entities} />;
};
```

## Container — write

Strict rules:

- *If the project uses React Query*: `mutate` + `onSuccess`/`onError`, **never**
  `mutateAsync` + try/catch. *Otherwise*: the same shape — call the action, then
  branch on its result in one place; do not scatter try/catch through the tree.
- Containers receive **navigation callbacks** from their parent page (`onDone`,
  `onOpenDetail`) instead of links, when the navigation is intra-page and
  state-based. Components render `<button type="button">` for those.
- Programmatic navigation always uses path constants (`routing-shell.md`).

```tsx
export const PreferencesFormContainer = () => {
  const { data: preferences } = useGetPreferences();
  const { mutate, isPending } = useSetPreferences();
  const form = usePreferencesForm(preferences);

  const onSubmit = form.handleSubmit((data) =>
    mutate(data, {
      onSuccess: () => toast.success(t.preferences.saved),
      onError: (error) => toast.error(String(error)),
    }),
  );

  return <PreferencesForm form={form} onSubmit={onSubmit} isLoading={isPending} />;
};
```

## Page — composition root

The page is the **only** layer that renders multiple containers. It manages
inter-container state (dialog open/close, selection) and passes callbacks down.
**Containers never import other containers.**

```tsx
export const EntityListPage = () => {
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <EntityListContainer onDelete={setDeleteTarget} onImport={() => setImportOpen(true)} />
      <DeleteEntityContainer
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        entity={deleteTarget}
      />
      <ImportEntitiesContainer open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};
```

Each container is self-contained (own data, own writes). The page only decides
*which* container is visible and *which* entity is selected — that is what
prevents god components.

## Page orchestrator pattern

When one page manages multiple **state-switched** views (input → preview →
confirm):

- Sequential `if` + early returns. No `switch/case`, no `else` chains; the
  default view is the last unconditioned return.
- A union type for the views.
- Navigation callbacks (`onBack`, `onAnalyzed`) down to the containers.

```tsx
export const ImportPage = () => {
  const [view, setView] = useState<ImportView>("input");
  if (view === "preview") return <ImportPreviewContainer onBack={() => setView("input")} />;
  return <ImportInputContainer onAnalyzed={() => setView("preview")} />;
};
```

## Orchestrator container pattern

When a detail view needs **3+ independent operations**, the container becomes a
folder:

```text
containers/
  SimpleContainer.tsx
  EntityDetailContainer/
    index.ts                    # re-exports ONLY the orchestrator
    EntityDetailContainer.tsx   # fetches, manages dialog state, renders leaves
    EditSectionContainer.tsx    # leaf: form + one write
    DeleteEntityContainer.tsx   # leaf: confirm + one write
```

| Role | Responsibilities |
|---|---|
| Orchestrator | Fetches the main entity, owns dialog state, renders layout + leaves. **Never owns forms or writes directly.** |
| Leaf | Owns its form and its write. Receives `open`, `onOpenChange`, data via props. **Never imports other leaves.** |

1–2 operations: keep it a flat file.

## Page complexity patterns

**Never a page that is a thin wrapper around a single container.**

| Complexity | Pattern | Separate container? |
|---|---|---|
| Single simple operation | **A — page absorbs** | No |
| Single operation, heavy logic | **C — page + custom hook** | No (hook yes) |
| Multiple operations | **B — page orchestrates** | Yes (leaf containers) |

In Pattern B the JSX reads as composable blocks: blur the prop values and the
structure still makes sense (`<Header/>`, `<Tabs/>`, `<EditDialog/>`).

Anti-pattern: `export const XPage = () => <XContainer />;`.

## Custom-hook extraction

| Signal | Action |
|---|---|
| 5+ `useMemo`/`useEffect` in one file | Extract to a hook |
| >~200 lines of logic (excluding JSX) | Extract to a hook |
| Logic reused across pages/containers | Extract to a shared hook |
| One `useState` + one handler | Keep inline — don't over-extract |

The hook owns form + writes + memos + handlers and returns
`{ form, onSubmit, isPending, ... }`; the page/container composes.

**When NOT to:** `useReducer` is not a substitute for `useMemo` chains. With a
form library managing state, derived data are computed values, not state
transitions. `useReducer` only for genuine state machines.

### React 19 note

Without the React Compiler enabled, `useMemo`/`useCallback` remain the standard
tools for expensive computations and referential stability. If the compiler is
enabled later, revisit. **Never** mix React 19 form hooks (`useActionState`,
`useFormStatus`, `useOptimistic`) with a form library — they are for native form
actions only.
