---
name: backend
description: >
  NestJS backend architecture doctrine for the WordRush game server. Use when asked to
  create or modify a module, use case, entity, repository, DTO, controller,
  endpoint, socket gateway, migration, scheduled task, guard, or any server
  work. Covers NestJS 11 + TypeScript + TypeORM 0.3 (PostgreSQL) + MinIO +
  BullMQ/Redis, strict 4-layer Clean Architecture per module, Symbol-injected
  repositories, UnitOfWork transactions, and TypeORM migrations.
---

# Backend (NestJS 11 + Clean Architecture)

Backend doctrine bound to this project's stack (**NestJS 11 + TS + TypeORM 0.3
+ PostgreSQL 15 + MinIO + BullMQ/Redis + pnpm**). Doctrine files are
project-agnostic; everything specific to this repo lives in
`references/project.md` — **read it first**.

## How to use this skill

1. **Always read `references/project.md` first** — module map, shared kernel,
   real commands, env vars, known traps. When reusing this skill elsewhere,
   replace or delete `project.md`.
2. Pick the workflow below that matches the task.
3. Open only the reference files the workflow lists (topic index below).
4. **Before finishing, read `references/pitfalls.md`** — it is the list of
   bugs this codebase has already paid for; a change that reintroduces one
   is not done.

## Topic index

| Reference file | What it covers | When to read it |
|---|---|---|
| `references/project.md` | Module map, shared kernel, commands, env vars, verification set | Always, first |
| `references/architecture.md` | The 4 layers, dependency rules, module template, DI tokens, cross-module imports | Creating a module, placing any file, importing across modules |
| `references/domain.md` | Entities (`create`/`reconstitute`), value objects, domain services, domain exceptions → HTTP | Touching `domain/` |
| `references/application.md` | Use cases, DTOs, response DTOs, `BaseResponse`, pagination, activity log, UnitOfWork, quota guard | Touching `application/` |
| `references/infrastructure.md` | ORM entities, mappers, repositories (TransactionContext), storage buckets, BullMQ processors, scheduled tasks | Touching `infrastructure/`, queues, crons |
| `references/presentation.md` | Controllers, guards, decorators, route ordering, streaming/ranges, multipart, headers | Touching `presentation/` |
| `references/migrations.md` | TypeORM migration workflow, review checklist, raw-SQL index trap, data backfills | Any schema or data change |
| `references/testing.md` | Unit test shape, mock factories, test data factory, e2e prerequisites | Writing or updating tests; adding a repository method |
| `references/pitfalls.md` | Hard-won rules: dedup deletes, two buckets, quota race, cron safety, sync cursor, public DTOs, ranges, SSRF | **Final review of any change**; anything touching delete/upload/sync/public/cron |

## Workflow A — New module

1. Scaffold `src/modules/{name}/` with the 4 layers — tree and template in
   `references/architecture.md` → Module template. Only create the folders
   you need (`domain/services`, `infrastructure/processors` are optional).
2. Implement bottom-up: ORM entity → domain entity → repository interface +
   Symbol → mapper → repository impl → use cases → DTOs → controller → module.
3. Generate the migration from the ORM entity and **review it** —
   `references/migrations.md`.
4. Register the module in `app.module.ts`. Cross-module dependencies go
   through `forwardRef(() => OtherModule)` and the other module's `exports`
   — `references/architecture.md` → Cross-module access.
5. Add the repository's mock factory to `test/helpers/mock-repository.factory.ts`
   and a domain-entity spec — `references/testing.md`.

## Workflow B — New endpoint (use case + controller method)

1. Confirm the module owns the concept; if it needs another module's data,
   inject that module's **repository interface** (Symbol), never its ORM
   entity or its use cases — `references/architecture.md`.
2. Write the DTO with class-validator (`references/application.md` → DTOs).
   The global pipe has `whitelist + forbidNonWhitelisted + transform`.
3. Write the use case: one class, one `execute()`, ownership check first,
   domain exceptions for every failure — `references/application.md`.
4. If it deletes storage objects, changes quota, or writes more than one
   aggregate, read `references/pitfalls.md` → Deletes / Quota / Transactions
   **before** writing it.
5. Controller method: thin, `@CurrentUser()`, `ParseUUIDPipe` on UUID params
   (only UUID params — `deviceId` is not one), `BaseResponse.ok()` —
   `references/presentation.md`. Declare literal routes before `:id` routes.
6. Register the use case in the module `providers`. Unit test with the mock
   factories — `references/testing.md`.

## Workflow C — Schema change (migration)

1. Change the `*.orm-entity.ts` — it is the single source of truth.
2. `pnpm migration:generate src/migrations/DescriptiveName` against a DB that
   is at the previous migration.
3. Review the generated file line by line: delete any `DROP INDEX` /
   `CREATE INDEX` touching raw-SQL indexes (pg_trgm), check column types
   (`bigint` ↔ `string`, `timestamptz`), write a real `down()` —
   `references/migrations.md` → Review checklist.
4. Data backfills are hand-written migrations that may import app code
   (see `EncryptPublicTokens`); never edit a migration that has already run.
5. Update the mapper, domain entity and test data factory for new columns.

## Workflow D — Background work (BullMQ processor or cron)

1. Processor: `@Processor('queue', { concurrency })` extending `WorkerHost`;
   **idempotency guard first** (`isCompleted()`), stream big inputs to temp
   files, bound anything you buffer with `streamToBuffer`, and if the owning
   row vanished mid-job delete the artifact you just uploaded —
   `references/infrastructure.md` → Processors.
2. Enqueue from a use case via `@InjectQueue`, persisting a `ConversionJob`
   row first; failures to enqueue call `markFailedTerminal`.
3. Cron: lives in `modules/scheduled-tasks/`, wrapped in
   `DistributedLockService.runExclusive` **and** try/catch — a rejecting cron
   handler kills the process — `references/infrastructure.md` → Scheduled tasks.
4. Anything that deletes storage: DB rows first, then objects; dedup guard
   for `storage_path`; derivatives through `CACHE_STORAGE_PROVIDER` —
   `references/pitfalls.md` → Deletes.

## Workflow E — Repository change

1. Add the method to the **interface** in `domain/interfaces/` first, with a
   one-line doc comment saying what it is for.
2. Implement in `infrastructure/repositories/` using the `repo` getter (never
   `baseRepo` directly) so it enlists in the ambient transaction —
   `references/infrastructure.md` → Repositories.
3. Any ordered query gets an `id` tie-breaker; any user-facing filter
   (expired, trashed, hidden) is applied in SQL before pagination.
4. Update `test/helpers/mock-repository.factory.ts` — the `MockOf<T>` type
   makes `tsc` fail until you do.

## Validation checklist (before finishing any task)

Run the verification set from `references/project.md`:
`npx tsc --noEmit -p tsconfig.json`, `pnpm lint:check` (**not** `pnpm lint` —
it carries `--fix` and rewrites the repo; `lint:check` also runs the layer
boundary rules), `npx jest`, `npx nest build`.
Format only the files you touched with `npx prettier --write <files>`.

Also verify: no `import` from another module's `infrastructure/` or
`application/`; repositories go through `this.repo`; every storage delete
splits permanent vs cache paths and runs the dedup guard; every new cron has
lock + try/catch; every `:id` param that is a UUID has `ParseUUIDPipe`; every
`@Public()` endpoint returns a reduced DTO; no `.catch(() => {})` (use
`logSafe`); migrations reviewed and `down()` written.
