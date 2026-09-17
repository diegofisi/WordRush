# Migrations

**Applies only when `project.md` lists a relational database with a migration tool.**
If it does not, skip this file entirely: there is no schema to migrate, and adding an ORM
is an architecture decision that is recorded before it is coded.

The commands below are TypeORM 0.3 with pnpm. `project.md` has the repo's real script
names; where they differ, its names win.

## Principles

- **ORM entities are the schema.** Migrations are generated from the diff between
  `*.orm-entity.ts` and the live database.
- `synchronize: false` always. `migrationsRun: true` applies pending migrations at boot,
  so a broken migration is an application that does not start.
- A migration that has run anywhere (another developer, staging, production) is
  **immutable**. Fix forward with a new one.
- The CLI reads its own data source config file; keep it pointing at the same entity glob
  the application uses.

## Workflow

```bash
# 1. Database at the previous migration.
# 2. Edit the ORM entity.
pnpm migration:generate src/migrations/AddFooToBar    # timestamp is prepended
# 3. REVIEW the generated file (checklist below).
pnpm migration:run
pnpm migration:show                                   # confirm it is applied
```

A seed, a backfill or anything with raw SQL starts from an empty file:

```bash
pnpm migration:create src/migrations/BackfillFoo
```

## Review checklist — every generated migration

1. **Raw-SQL indexes.** The ORM does not know about indexes created with
   `queryRunner.query('CREATE INDEX ... USING gin (...)')` or about partial indexes with
   expressions it cannot model. It will emit a `DROP INDEX` and try to recreate them
   wrong. Delete those lines.
2. **Types.** `bigint` stays `bigint`; instants stay `timestamptz`; ids stay `uuid`.
3. **Data loss.** `DROP COLUMN` or `ALTER TYPE` on a populated table needs a backfill or
   an explicit decision. A column rename is generated as drop + add — rewrite it as
   `ALTER TABLE ... RENAME COLUMN`.
4. **Defaults and NOT NULL on existing rows.** Add nullable or with a default, backfill,
   then tighten in a second statement.
5. **Indexes on big tables.** Consider `CREATE INDEX CONCURRENTLY` in a hand-written
   migration; it cannot run inside a transaction, so that migration sets
   `transaction = false`.
6. **`down()` must actually reverse `up()`.** Generated ones usually do; hand-written ones
   often forget. Test with `migration:run` then `migration:revert`.
7. **Nothing unrelated.** If the diff contains changes you did not make, your database is
   not at the previous migration. Reset and regenerate.
8. **Migrations are usually excluded from lint**, so nothing else will catch a mistake
   here. Read the file.

## Backfills that need application code

Import a **pure helper**, never a Nest provider: a migration runs outside the DI
container. Iterate with parameterised statements and bound the row count (batch with
`LIMIT`/`OFFSET` on large tables). If you later change that helper, remember that
existing rows were written by the old version.

## Adding a column end to end

1. ORM entity: the column, with `name`, type and nullability.
2. Generate and review the migration.
3. Domain entity: field, getter, `reconstitute` prop, mutator if it is writable.
4. Mapper: both directions.
5. Response DTO if it is exposed; input DTO with validators if it is writable.
6. Test data factory and any typed mock factory.
7. Re-read `pitfalls.md` if the column feeds a limit, a sync cursor or anything money.

## Dev database and seeds

Reset scripts drop and recreate a **local** database. Never point them at a shared one.
Keep the list of applied migrations in `project.md` only if the repo actually maintains
it; an out-of-date table is worse than no table.
