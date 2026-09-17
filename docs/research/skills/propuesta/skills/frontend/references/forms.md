# Forms

> **Applies:** the *Principles* and *When NOT to reach for a form library*
> sections are universal. Everything from *Schema rules* to *Wiring fields*
> applies **only if `project.md` declares react-hook-form + zod** (or an
> equivalent schema/form pair). If it declares neither, read the principles and
> implement them with the repo's approach — usually `useState` plus a validation
> helper.
>
> **Read this when:** building or modifying any form.

## Principles (library-independent)

1. **One source of truth for the shape.** The form type is derived from the
   validation rules, never hand-written twice.
2. **Validation messages are user copy**, not technical errors — and if the
   project has an i18n layer, they come from the dictionary like any other
   string.
3. **The presentational form component receives what it needs via props**
   (`onSubmit`, `isLoading`, current values) and wires fields. No writes, no
   toasts, no navigation inside it (`components.md` → presentational contract).
4. **Seed edit forms from the loaded data**, never with an effect that resets the
   form when data arrives. That dance drops what the user typed.
5. **Submit once.** Disable the submit control while the write is in flight; a
   double submit is a duplicate record.
6. **Errors render next to the field**, and a cross-field error renders once at
   form level.
7. **Never mix React 19 form hooks** (`useActionState`, `useFormStatus`,
   `useOptimistic`) with a form library — they are for native form actions only.

## Schema rules — *zod*

- Schemas live in the feature's `helpers/`: `{domain}.schema.ts` or
  `{action}-{domain}.schema.ts`. A small form-local schema may sit at the top of
  its own component file; shared schemas belong in `helpers/`.
- Always derive the type with `z.infer<typeof schema>`.
- Compose with `.partial()`, `.pick()`, `.omit()`, `.extend()`.
- Schemas are for **forms and runtime validation only**. Domain Models and DTOs
  stay plain TypeScript interfaces.

```typescript
export const entityFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mode: z.enum(["basic", "advanced", "custom"]),
  limit: z.number().int().min(0, "Minimum 0").max(100, "Maximum 100"),
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export type EntityForm = z.infer<typeof entityFormSchema>;

// Reuse, don't duplicate:
export const entityQuickEditSchema = entityFormSchema
  .pick({ mode: true, limit: true })
  .extend({ reason: z.string().min(1) });
```

Cross-field rules use `.refine()` with a synthetic path so the form can render
one top-level error:

```typescript
.refine((data) => atLeastTwoFilled(data), {
  message: "Fill in at least two fields to start the search.",
  path: ["formError"],
});
```

*If the project localizes messages*, build the schema inside a function that
takes the dictionary, so the strings re-evaluate when the language changes.

## Wiring — *react-hook-form*

```typescript
const {
  control,
  handleSubmit,
  reset,
  formState: { errors, isValid },
} = useForm<EntityForm>({
  resolver: zodResolver(entityFormSchema),
  mode: "onChange",
  values: entity,            // a loaded entity feeds the form directly
});

const onSubmit = handleSubmit((data) =>
  mutate(data, {
    onSuccess: () => toast.success("Saved"),
    onError: (error) => toast.error(String(error)),
  }),
);
```

- Seed via `values:` (or `defaultValues` from cached params) — **never**
  `useEffect` + `reset`. Use `reset(EMPTY_VALUES)` only for an explicit "Clear"
  action.
- `mutate` + callbacks, never `mutateAsync` + try/catch.

## Wiring fields

The idiom is the same in every kit: **spread `field`, drive the error UI from
`errors` (or `fieldState.error`)**. Only the tag names change.

```tsx
// Kit dialect (MUI)
<Controller
  name="name"
  control={control}
  render={({ field, fieldState }) => (
    <TextField
      label="Name"
      error={!!fieldState.error}
      helperText={fieldState.error?.message}
      fullWidth
      {...field}
    />
  )}
/>

// House-primitive dialect
<Controller
  name="name"
  control={control}
  render={({ field, fieldState }) => (
    <Input label="Name" error={fieldState.error?.message} {...field} />
  )}
/>
```

Specific cases:

- **Select:** same pattern; the kit's select plus its option component, still
  spreading `field`.
- **Checkbox / boolean:** bind `checked`, not `value`
  (`checked={field.value} onChange={field.onChange}`).
- **Custom or uncontrolled widgets** (date pickers, autocompletes): bridge the
  widget's `value`/`onChange` to `field` by hand, converting at the boundary —
  e.g. keep the schema value as a formatted string and parse into a `Date` for
  the widget.
- **Top-level / cross-field error:** render the synthetic path (`formError`) once,
  above or below the fields.

If the repo has no `<Form>`/`<FormField>` primitives, do not invent them — wire
the repo's inputs directly.

## No form library — the fallback

For a repo with neither a form nor a schema library:

```tsx
const [name, setName] = useState("");
const [error, setError] = useState<string | null>(null);

const onSubmit = (event: FormEvent) => {
  event.preventDefault();
  const problem = validateName(name);   // pure helper in helpers/
  setError(problem);
  if (problem) return;
  onCreate(name);
};
```

Keep the validation in a **pure helper** in `helpers/`, not inline in the JSX, so
it stays testable and reusable. Everything in *Principles* still applies:
disabled submit while pending, per-field errors, no effect-based resets.

## When NOT to reach for a form library

| Input | Correct tool |
|---|---|
| Single search box + submit | `useState` + `onSubmit` |
| A code/name field with one rule | `useState` + a validation helper |
| Free-text box whose "validation" is really an analysis step | `useState` + a parsing helper; feedback comes from the analysis result |
| Multi-field form with real validation rules | the form library, if the project has one |

## Do / Don't

| Do | Don't |
|---|---|
| Derive the form type from the schema | Hand-written duplicate interfaces |
| Compose schemas | Copy-pasted field lists |
| Seed edit forms from loaded data | `useEffect` + `reset` dances |
| Spread `field`, drive errors from `fieldState` | Manual `value`/`onChange` plumbing per field |
| Disable submit while pending | Let the user double-submit |
| Keep trivial single-input forms plain | Wrap a search box in a form library |
| Put shared schemas in `helpers/` | Scatter reused schemas across components |
