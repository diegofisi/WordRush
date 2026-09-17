---
name: backend
description: >
  NestJS backend doctrine: Clean Architecture in four layers per module, with or without a
  relational database, queues or object storage. Use when asked to create or change a module,
  use case, entity, value object, repository, DTO, controller, endpoint, REST API, WebSocket
  gateway or socket event, guard, interceptor, pipe, exception filter, migration, queue
  processor, scheduled task, or any NestJS / TypeScript server work. Which parts apply to a
  given repository is declared in references/project.md, which is read first and wins over
  this doctrine.
---

# Backend — NestJS + Clean Architecture

Portable doctrine: the 4-layer module, the dependency rule, and the patterns that hold
for any NestJS service. It does **not** know which of them this repository uses —
`references/project.md` does.

## Precedence

`code > references/project.md > doctrine files`. Where the doctrine and `project.md`
disagree, `project.md` wins. Where `project.md` and the code disagree, the code wins and
you fix `project.md` in the same change.

## How to use this skill

1. **Read `references/project.md` first.** It carries the stack, the module map and an
   **Applies / does not apply** table over the topics below. If that file does not exist
   or contradicts the code, do Workflow F before anything else.
2. Read only the topics the table marks as applying. A section whose condition is false
   is skipped, not "adapted".
3. Pick a workflow below; open only the references it names.
4. Before finishing, read `references/pitfalls.md` and, if the repo has one,
   `references/project-pitfalls.md`. A change that reintroduces a listed bug is not done.
5. Validate with the project's verify command — see **Validation**.

## Topic index

| Reference | Covers | Read it when |
|---|---|---|
| `references/project.md` | Stack, module map, applicability table, seams, commands (written by `bind-project` from `project.md.template`) | Always, first |
| `references/architecture.md` | Layers, dependency rule, DI tokens, module template, cross-module access, naming | Always |
| `references/domain.md` | Entities, value objects, enums, domain services, repository interfaces, domain exceptions | Touching `domain/` |
| `references/application.md` | Use cases, input and response DTOs, authorization order, transactions, pagination | Touching `application/` |
| `references/infrastructure.md` | Repository implementations (ORM or in-memory), mappers, external services, queue processors, scheduled tasks | Touching `infrastructure/` |
| `references/presentation.md` | HTTP controllers, guards, params, streaming; WebSocket gateways | Touching `presentation/` |
| `references/migrations.md` | Migration workflow and review checklist | Only if `project.md` lists a relational database |
| `references/testing.md` | Unit test shape, mocks, factories, what needs an integration test | Writing tests; changing a repository interface |
| `references/pitfalls.md` | Universal rules already paid for in production | Final review of any change |
| `references/project-pitfalls.md` | This repo's own dated bug ledger (from `project-pitfalls.md.template`) | Final review of any change |

## Workflow A — New module

*Always applies.*

1. Scaffold `src/modules/{name}/` — tree and module template in `architecture.md`.
   Create only the folders you need; `domain/services`, `infrastructure/processors`
   and `presentation/` are optional.
2. Implement bottom-up: persistence shape (ORM entity, or the in-memory store's record)
   → domain entity → repository interface + Symbol → mapper → repository implementation
   → use cases → DTOs → entry point (controller or gateway handler).
3. *If `project.md` lists a relational database*: generate and review the migration —
   `migrations.md`. Otherwise skip.
4. Register the module in `app.module.ts`. Cross-module dependencies go through the other
   module's `exports` (and `forwardRef` when the cycle is real) — `architecture.md`.
5. Add the repository's mock factory and a domain-entity spec — `testing.md`.

## Workflow B — New use case and entry point

*Always applies.*

1. Confirm the module owns the concept. If it needs another module's data, inject that
   module's **repository interface** by Symbol, or a sanctioned seam listed in
   `project.md` — never its ORM entity, its store or its use cases.
2. Write the input DTO with class-validator — `application.md`. The global pipe runs
   `whitelist + forbidNonWhitelisted + transform` unless `project.md` says otherwise.
3. Write the use case: one class, one `execute()`, order **authorize → validate state →
   external side effects → persist → notify/audit** — `application.md`.
4. Entry point, thin: one use case per handler, no rules — `presentation.md`
   (controllers for HTTP, gateway handlers for sockets; `project.md` says which exist).
5. Register the use case in the module `providers`; unit test it — `testing.md`.

## Workflow C — Persistence change

*If `project.md` lists a relational database with migrations*: change the ORM entity
first (it is the schema), generate the migration, review it line by line, then update
mapper, domain entity and test factories — `migrations.md`.

*Otherwise* (in-memory, external API, file-backed): the change lives in the repository
implementation and its mapper only. The domain entity and the repository interface
change together; no schema artefact exists — `infrastructure.md`.

## Workflow D — Background work

*If `project.md` lists queues or scheduled tasks.* Otherwise skip: work that must survive
a crash cannot live in a `setTimeout`, and adding a queue is an architecture decision,
not part of a task.

1. Queue processor: idempotency guard first, bound anything buffered, clean up artefacts
   whose owning row vanished — `infrastructure.md` → Queue processors.
2. Scheduled task: a lock if more than one instance can run, **and** try/catch — an
   unhandled rejection in a cron handler ends the process — `infrastructure.md`.
3. In-process timers (tickers, between-step schedulers) live in the owning module's
   application or domain layer, never in a controller or a gateway.

## Workflow E — Repository change

*Always applies.*

1. Add the method to the **interface** in `domain/interfaces/` first, with a one-line
   comment saying what it is for.
2. Implement it in `infrastructure/repositories/`; if the project has transactions, go
   through the transaction-aware accessor, never the raw one — `infrastructure.md`.
3. Ordered queries get a deterministic tie-breaker; filters the caller will observe are
   applied before pagination, not after.
4. Update the mock factory — a typed `MockOf<T>` makes the typecheck fail until you do
   (`testing.md`).

## Workflow F — Bind to this project

*When `references/project.md` is missing, or contradicts the code.* Use the sibling
**`bind-project`** skill (`../bind-project/`): it reads the repository and writes
`references/project.md` from `references/project.md.template`, plus an empty
`references/project-pitfalls.md` from its template. A finished binding looks like
`references/examples/wordrush-project.md`.

Do not start coding against an unbound doctrine: without the applicability table you will
import patterns (migrations, quotas, buckets) the repository does not have.

## Validation

Run the verify command `project.md` declares — a single script if the repo has one,
otherwise its listed sequence, one command per invocation. Never substitute a prose
checklist for it, and never report a check you did not run. Report the outcome as
`typecheck / lint / tests / build / <project-specific> → READY or NOT READY`, naming the
failing command. If a command is missing from `project.md`, add it there once found.
