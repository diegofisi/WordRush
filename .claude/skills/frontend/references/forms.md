# Forms — Zod + react-hook-form + MUI

> **Read this when:** building or modifying any form. Covers Zod schema rules,
> schema composition, RHF wiring with MUI fields, validation messages, and when
> NOT to use RHF at all.

## Zod rules

- Import from `zod` (`zod@^3`); resolve via `@hookform/resolvers/zod` (`zodResolver`).
- Schemas live in the feature's `helpers/` folder: `[domain].schema.ts` or `[action]-[domain].schema.ts`. Small, form-local schemas may also sit at the top of the `Forms/*.tsx` file next to the component, but shared/reused schemas belong in `helpers/`.
- Always derive the form type with `z.infer<typeof schema>` — never duplicate the interface.
- Compose with `.partial()`, `.pick()`, `.omit()`, `.extend()` to avoid repetition.
- Validation messages are user-friendly strings, not technical errors.
- Zod is for **forms and runtime validation only**. Domain Models and DTOs remain plain TS interfaces.

```typescript
// features/{feature}/helpers/entity-form.schema.ts
import { z } from 'zod';

export const entityFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mode: z.enum(['basic', 'advanced', 'custom']),
  limit: z.number().int().min(0, 'Minimum 0').max(100, 'Maximum 100'),
  retentionDays: z.number().int().min(1),
  enabled: z.boolean(),
  notes: z.string().optional(),
});

export type EntityForm = z.infer<typeof entityFormSchema>;
```

```typescript
// Composition example: a quick-edit dialog reuses part of the main schema
export const entityQuickEditSchema = entityFormSchema
  .pick({ mode: true, limit: true })
  .extend({
    reason: z.string().min(1),
  });
```

Use `.refine()` for cross-field rules and route the message to a synthetic path
so the form can render a top-level error (see `AccountSearchForm` — the
"at least two fields" rule uses `path: ['formError']`):

```typescript
export const entityFormSchema = z
  .object({ /* ...fields... */ })
  .refine((data) => atLeastTwoFilled(data), {
    message: 'Please fill in at least two fields to start the search.',
    path: ['formError'],
  });
```

## RHF wiring

```typescript
const {
  control,
  handleSubmit,
  reset,
  formState: { errors, isValid },
} = useForm<EntityForm>({
  resolver: zodResolver(entityFormSchema),
  mode: 'onChange',
  defaultValues: { /* seed empties, or from `cachedParams`/query when editing */ },
});

const onSubmit = (data: EntityForm) => {
  mutate(data, {
    onSuccess: () => toast.success('Saved'),
    onError: (e) => toast.error(String(e)),
  });
};

// <form onSubmit={handleSubmit(onSubmit)}>
```

- `mutate` + callbacks, never `mutateAsync` + try/catch (see `containers-pages.md` → Container — Mutation).
- The presentational form component receives what it needs (`onSearch`/`onSubmit`, `isLoading`, `cachedParams`) via props and wires fields with `Controller`/`register` — no business logic (see `components.md` → Presentational component).
- When a query feeds an edit form, seed via `values:` (or `defaultValues` derived from `cachedParams`) — never a `useEffect` + `reset` sync dance. Use `reset(EMPTY_VALUES)` only for an explicit user action like "Clear fields".
- Never mix React 19 native form hooks (`useActionState`, `useFormStatus`, `useOptimistic`) with RHF (see `containers-pages.md` → React 19 note).

## Rendering fields with MUI

There are no Shadcn `<Form>/<FormField>/<FormItem>` primitives here. Fields are
MUI components wired through RHF `Controller` (or `register` for the simplest
cases). The idiom is always: spread `field`, drive the error UI from `errors`.

**Text field** — `Controller` + MUI `TextField` (or a project wrapper like
`CustomLabelTextField`), with `error` and `helperText`:

```tsx
import { Controller } from 'react-hook-form';
import { TextField } from '@mui/material';

<Controller
  name="name"
  control={control}
  render={({ field }) => (
    <TextField
      label="NAME"
      error={!!errors.name}
      helperText={errors.name?.message}
      fullWidth
      {...field}
    />
  )}
/>;
```

You may read `errors` for the message directly (as above) or use
`fieldState.error` from the render prop — both are fine:

```tsx
<Controller
  name="name"
  control={control}
  render={({ field, fieldState }) => (
    <TextField
      label="NAME"
      error={!!fieldState.error}
      helperText={fieldState.error?.message}
      {...field}
    />
  )}
/>;
```

**Select** — MUI `Select` + `MenuItem`, still spreading `field`:

```tsx
import { Controller } from 'react-hook-form';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

<Controller
  name="mode"
  control={control}
  render={({ field }) => (
    <FormControl fullWidth error={!!errors.mode}>
      <InputLabel>Mode</InputLabel>
      <Select label="Mode" {...field}>
        <MenuItem value="basic">Basic</MenuItem>
        <MenuItem value="advanced">Advanced</MenuItem>
        <MenuItem value="custom">Custom</MenuItem>
      </Select>
    </FormControl>
  )}
/>;
```

**Checkbox / boolean** — bind `checked`, not `value`:

```tsx
import { Controller } from 'react-hook-form';
import { FormControlLabel, Checkbox } from '@mui/material';

<Controller
  name="enabled"
  control={control}
  render={({ field }) => (
    <FormControlLabel
      control={<Checkbox checked={field.value} onChange={field.onChange} />}
      label="Enabled"
    />
  )}
/>;
```

**Custom/uncontrolled widgets** (date pickers, autocompletes) — bridge the
widget's value/`onChange` to `field` manually, since the widget doesn't spread
cleanly. The birthdate field keeps the schema value as an `MM/dd/yyyy` string and
converts on the boundary with `date-fns`:

```tsx
import { Controller } from 'react-hook-form';
import { format, isValid as isValidDate, parse } from 'date-fns';
import { DatePicker } from '@/common/components/DatePicker';

<Controller
  name="birthdate"
  control={control}
  render={({ field }) => {
    const dateValue = field.value
      ? parse(field.value, 'MM/dd/yyyy', new Date())
      : null;

    return (
      <DatePicker
        label="DATE OF BIRTH"
        value={isValidDate(dateValue) ? dateValue : null}
        onChange={(date) => field.onChange(date ? format(date, 'MM/dd/yyyy') : '')}
        error={!!errors.birthdate}
        helperText={errors.birthdate?.message}
      />
    );
  }}
/>;
```

**Top-level / cross-field error** — render the synthetic error path (see the
`.refine()` above) as a standalone message, styled with MUI `sx`:

```tsx
import { Typography } from '@mui/material';

{(errors as any).formError && (
  <Typography color="error" sx={{ textAlign: 'center', mb: 1 }}>
    {(errors as any).formError.message}
  </Typography>
)}
```

Layout uses MUI (`Grid`, `Box`) and styling uses the `sx` prop / theme — no
Tailwind classes. See `AccountSearchForm.tsx` and `CardSearchForm.tsx` under
`features/agent-portal/components/MemberSearch/Forms/` for the full pattern
(Grid layout, `mode: 'onChange'`, submit disabled on `!isValid`, clear-fields
via `reset`).

## Validation messages

Zod messages are plain user-facing strings passed at schema definition time
(`z.string().min(1, 'Card number is required')`, or the message option on a
`.refine()`). Keep them human-readable and specific to the field. If a project
area later needs localized messages, build the schema inside a function so the
strings re-evaluate — but the current forms use fixed English strings, which is
fine here.

## When NOT to use RHF

Don't over-engineer trivial inputs:

| Input | Correct tool |
|---|---|
| Single search box + submit | `useState` + form `onSubmit` — no RHF, no Zod |
| Free-text paste box whose validation is really an analysis step | `useState` + a parsing helper in `helpers/`; feedback comes from the analysis result |
| Multi-field form with validation rules | RHF + Zod + MUI fields, always |

The project's real form inventory (which forms exist, which schemas feed them)
lives in `project.md`.

## Do / Don't

| Do | Don't |
|---|---|
| `z.infer` for every form type | Hand-written duplicate interfaces |
| Compose schemas (`.pick`, `.extend`) | Copy-pasted field lists across schemas |
| Seed edit forms from queries via `values:`/`defaultValues` | `useEffect` + `reset` sync dances |
| Wire MUI fields through `Controller`, spread `field`, drive `error`/`helperText` from `errors` | Reinvent Shadcn `<Form>/<FormField>` primitives (they don't exist here) |
| Style with MUI `sx`/theme and `Grid`/`Box` layout | Tailwind utility classes |
| `mutate` + `onSuccess`/`onError` | `mutateAsync` + try/catch |
| Keep trivial single-input forms as `useState` | Wrap a search box in RHF + Zod |
| Shared schemas in `helpers/`, one per form | Scattering reused schemas inline across components |
