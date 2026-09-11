# Architecture — 4 layers per module

## Dependency rule

```
presentation → application → domain ← infrastructure
```

- **domain/** knows nothing about NestJS, TypeORM, Dio, MinIO or HTTP. Pure
  TypeScript: entities, value objects, enums, repository *interfaces*,
  domain services, domain exceptions. The only decorator-free layer.
- **application/** knows domain + NestJS DI (`@Injectable`, `@Inject`). Use
  cases, DTOs (class-validator), response DTOs, application services
  (`FileAccessService`, `StorageQuotaService`, `LogActivityService`).
  It depends on repository **interfaces**, never implementations.
- **infrastructure/** knows everything external: ORM entities, mappers,
  repository implementations, MinIO/FFmpeg/Sharp services, BullMQ processors.
  Implements domain interfaces.
- **presentation/** knows HTTP: controllers, guards, decorators. Calls use
  cases; never touches repositories or ORM entities.

If you need to import "upward" (e.g. a domain entity needing a repository),
the design is wrong — pass the data in from the use case.

## Directory layout

```
src/modules/{name}/
├── {name}.module.ts
├── domain/
│   ├── entities/{thing}.entity.ts          (+ .spec.ts)
│   ├── enums/{thing}-status.enum.ts
│   ├── interfaces/{thing}-repository.interface.ts   ← Symbol + interface
│   └── services/{thing}.service.ts          ← optional, pure logic
├── application/
│   ├── dtos/{action}.dto.ts, {thing}-response.dto.ts, {thing}-query.dto.ts
│   ├── services/                            ← cross-use-case logic
│   └── use-cases/{group}/{verb}-{thing}.use-case.ts   (+ .spec.ts)
├── infrastructure/
│   ├── orm-entities/{thing}.orm-entity.ts
│   ├── mappers/{thing}.mapper.ts
│   ├── repositories/{thing}.repository.ts
│   ├── services/                            ← MinIO, FFmpeg, Sharp wrappers
│   └── processors/{thing}.processor.ts      ← BullMQ
└── presentation/
    ├── {name}.controller.ts
    └── {name}-auth.guard.ts                 ← only auth has guards
```

Use cases are grouped by sub-concept when a module grows
(`file-ops/`, `upload/`, `folders/`, `streaming/`, `versioning/` in
`file-nodes`; `user-sharing/`, `public-links/` in `sharing`).

## DI tokens

Every repository interface exports a Symbol next to it:

```ts
export const SHARED_ACCESS_REPOSITORY = Symbol('SHARED_ACCESS_REPOSITORY');
export interface ISharedAccessRepository extends IBaseRepository<SharedAccess> { ... }
```

Consumers inject by Symbol and type by interface:

```ts
@Inject(SHARED_ACCESS_REPOSITORY)
private readonly sharedAccessRepository: ISharedAccessRepository,
```

Domain services (no `@Injectable`) are provided with `useValue`:

```ts
{ provide: PERMISSION_CHECKER, useValue: new PermissionChecker() }
```

Application services and use cases are plain `@Injectable()` classes listed
in `providers`.

## Module template

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([ThingOrmEntity]),
    forwardRef(() => FileNodesModule),   // cross-module deps
    forwardRef(() => ActivityModule),
  ],
  controllers: [ThingController],
  providers: [
    { provide: THING_REPOSITORY, useClass: ThingRepository },
    CreateThingUseCase,
    // ...
  ],
  exports: [THING_REPOSITORY],          // only what others need
})
export class ThingModule {}
```

`SharedModule` and `StorageModule` are `@Global()` — `UNIT_OF_WORK`,
`TransactionContext`, `STORAGE_PROVIDER`, `CACHE_STORAGE_PROVIDER` need no
import.

## Enforcement (eslint-plugin-boundaries)

The rules on this page are executable: `eslint.config.mjs` classifies every
file under `src/` as `{module} × {domain|application|infrastructure|orm-entity|presentation|module-root}`
(plus `scheduled-task`, `shared-*`, `app`) and `boundaries/dependencies`
rejects imports that break the dependency rule or reach into another
module's private layers. `pnpm lint:check` runs it.

- A `boundaries/dependencies` error means: fix the design (move the code,
  introduce a domain interface + Symbol, or use an existing facade).
- Sanctioned cross-module facades are listed at the bottom of the config
  with the service that justifies each one. Adding one is an architecture
  decision — comment it.
- Existing breaches are marked in place with
  `// eslint-disable-next-line boundaries/dependencies -- KNOWN DEBT: <fix>`.
  `grep -rn "KNOWN DEBT" src` lists the debt; never add a new one to avoid
  a refactor you could do now.
- `boundaries/no-unknown-files` fails on a file that matches no element:
  a new top-level folder needs an element descriptor, deliberately.

## Cross-module access

- Inject the other module's **repository Symbol** (it must be in that
  module's `exports`). Do not import its ORM entity into your ORM entity
  unless you need a real FK relation — and then only from
  `infrastructure/orm-entities/`.
- Do not call another module's use case from a use case; extract an
  application service into the owning module and export it
  (`FileAccessService`, `LogActivityService`, `ProcessMediaUseCase` are the
  sanctioned examples).
- Circular imports between modules are resolved with `forwardRef` on both
  sides. If you need it, check whether the dependency really belongs there.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Domain entity | `PascalCase`, file `kebab.entity.ts` | `SharedAccess`, `shared-access.entity.ts` |
| ORM entity | `{Name}OrmEntity`, `*.orm-entity.ts` | `SharedAccessOrmEntity` |
| Mapper | `{Name}Mapper` static `toDomain`/`toOrm` | `SharedAccessMapper` |
| Repository iface | `I{Name}Repository` + `{NAME}_REPOSITORY` | `ISharedAccessRepository` |
| Use case | `{Verb}{Thing}UseCase`, `*.use-case.ts` | `RevokeAccessUseCase` |
| DTO | `{Action}Dto`, `{Thing}ResponseDto`, `{Thing}QueryDto` | `ShareWithUserDto` |
| Controller | `{Module}Controller`, `@Controller('{route}')` | `SharingController` |
| Processor | `{Thing}Processor` | `ThumbnailProcessor` |
| Cron | `{Thing}Task` | `TrashPurgeTask` |
| DB columns | `snake_case` via `@Column({ name })` | `file_node_id` |
| Indexes | `idx_{table}_{cols}` | `idx_shared_access_file_user` |
