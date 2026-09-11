# Migrations (TypeORM 0.3)

`docs/MIGRATIONS.md` has the long form. This is the operational version.

## Principles

- **ORM entities are the schema.** Migrations are generated from the diff
  between `*.orm-entity.ts` and the live database.
- `synchronize: false` always. `migrationsRun: true` applies pending
  migrations at boot (app and e2e), so a broken migration = an app that
  does not start.
- A migration that has run anywhere (another dev, staging, prod) is
  **immutable**. Fix forward with a new migration.
- CLI config: `src/config/typeorm.config.ts` (reads `.env`,
  `entities: ['src/**/*.orm-entity.ts']`).

## Workflow

```bash
# 1. DB at the previous migration (fresh dev: pnpm db:reset && pnpm migration:run)
# 2. Edit the ORM entity
pnpm migration:generate src/migrations/AddFooToBar        # timestamp is prepended
# 3. REVIEW the file (checklist below)
pnpm migration:run                                        # or just start the app
pnpm migration:show                                       # confirm [X]
```

Hand-written migration (seed, backfill, raw SQL):

```bash
pnpm migration:create src/migrations/BackfillFoo   # empty up()/down()
```

## Review checklist — every generated migration

1. **Raw-SQL indexes**: TypeORM does not know about indexes created with
   `queryRunner.query('CREATE INDEX ... USING gin (name gin_trgm_ops)')`.
   It will emit `DROP INDEX "idx_file_nodes_name_trgm"` and try to recreate
   it wrong. Delete those lines. Same for partial indexes with expressions
   it cannot model.
2. **Types**: `bigint` columns must stay `bigint`; dates `timestamptz`
   (migration 2 converted everything — don't regress to `timestamp`);
   `uuid` for ids.
3. **Data loss**: `DROP COLUMN` / `ALTER TYPE` on populated tables need a
   backfill step or an explicit decision. Column renames generate
   drop+add — rewrite as `ALTER TABLE ... RENAME COLUMN`.
4. **Defaults & NOT NULL on existing rows**: add the column nullable or
   with a `DEFAULT`, backfill, then tighten in a second statement.
5. **Indexes on big tables**: consider `CREATE INDEX CONCURRENTLY` in a
   hand-written migration (cannot run inside a transaction — TypeORM wraps
   migrations in one; set `transaction = false` on that migration class).
6. **`down()`** must actually reverse `up()`. Generated ones usually do;
   hand-written ones often forget.
7. **Nothing unrelated**: if the diff includes changes you didn't make, your
   DB is not at the previous migration. Reset and regenerate.
8. **Migrations are excluded from ESLint** (`eslint.config.mjs`), so lint
   will not catch mistakes here — read it.

## Data backfills with application code

`1775500100000-EncryptPublicTokens` is the model: import a pure helper
(`TokenCipher`) — never a Nest provider — iterate with parameterised
`UPDATE ... WHERE id = $3`, and keep the row count bounded (batch by
`LIMIT/OFFSET` on large tables). The helper must keep producing the same
output the runtime expects; if you later change the helper, existing rows
were written by the old one.

## Adding a column end to end

1. ORM entity: `@Column({ name: 'foo_bar', type: 'varchar', nullable: true }) fooBar: string | null;`
2. Generate + review migration.
3. Domain entity: field, getter, `reconstitute` prop, mutator if needed.
4. Mapper: both directions.
5. Response DTO if exposed; input DTO with validators if writable.
6. `test/helpers/test-data.factory.ts` overrides + any `MockOf` factory.
7. If the column feeds quota or sync, re-read `pitfalls.md`.

## Seeds & dev DB

`pnpm db:reset` (drops/recreates dev DB) then migrations create the 4 plans
inside `InitialSchema`. `pnpm db:seed` adds a demo user/folders/files.
Never point these scripts at a shared database.

## Current migrations (as of this skill)

| File | What |
|---|---|
| `InitialSchema` | All tables, pg_trgm extension + GIN index, 4 plans |
| `TimestampToTimestamptz` | All timestamps → `timestamptz` |
| `AddLivePhotoSupport` | `live_photo_video_id`, `is_hidden` |
| `AddPhotosModule` | albums, album_items, backup_configs |
| `AddFcmTokenToSyncCursors` | `fcm_token` |
| `PerformanceIndexes` | Composite indexes for hot queries |
| `EncryptPublicTokens` | `public_token` → AES-GCM + `public_token_hash`, backfill |

Update this table when you add one.
