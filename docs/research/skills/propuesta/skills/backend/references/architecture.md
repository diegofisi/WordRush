# Architecture — 4 layers per module

**Applies always.** Every other reference in this folder assumes the rules on this page.

Examples use a neutral `Booking` domain. Replace the names; the shapes are the doctrine.

## Dependency rule

```
presentation → application → domain ← infrastructure
```

- **domain/** knows nothing about NestJS, any ORM, HTTP or sockets. Pure TypeScript:
  entities, value objects, enums, repository *interfaces*, domain services, domain
  exceptions. The only decorator-free layer.
- **application/** knows domain + NestJS DI (`@Injectable`, `@Inject`). Use cases, input
  DTOs (class-validator), response DTOs, application services. It depends on repository
  **interfaces**, never on implementations.
- **infrastructure/** knows everything external: ORM entities or in-memory stores,
  mappers, repository implementations, clients for external services, queue processors.
  Implements the domain's interfaces.
- **presentation/** knows the transport: controllers, gateways, guards, decorators. Calls
  use cases; never touches repositories, stores or ORM entities.

If you need to import "upward" (a domain entity that wants a repository), the design is
wrong — pass the data in from the use case.

## Directory layout

```
src/modules/{name}/
├── {name}.module.ts
├── domain/
│   ├── entities/{thing}.entity.ts              (+ .spec.ts)
│   ├── enums/{thing}-status.enum.ts
│   ├── interfaces/{thing}-repository.interface.ts   ← Symbol + interface
│   └── services/{thing}.service.ts              ← optional, pure logic
├── application/
│   ├── dtos/{action}.dto.ts, {thing}-response.dto.ts, {thing}-query.dto.ts
│   ├── services/                                ← cross-use-case logic
│   └── use-cases/{group}/{verb}-{thing}.use-case.ts (+ .spec.ts)
├── infrastructure/
│   ├── orm-entities/{thing}.orm-entity.ts       ← only with a relational DB
│   ├── mappers/{thing}.mapper.ts
│   ├── repositories/{thing}.repository.ts       ← ORM-backed or in-memory
│   ├── services/                                ← external clients
│   └── processors/{thing}.processor.ts          ← only with queues
└── presentation/
    ├── {name}.controller.ts                     ← only with HTTP
    ├── {name}.gateway.ts                        ← only with WebSockets
    └── {name}.guard.ts
```

Create only the folders the module needs. A module with no transport of its own (a pure
rules module) has no `presentation/`; a module whose state lives in memory has no
`orm-entities/`. Group use cases by sub-concept once a module grows past ~8 of them.

## DI tokens

Every repository interface exports a Symbol next to it:

```ts
export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');
export interface IBookingRepository { /* ... */ }
```

Consumers inject by Symbol and type by interface:

```ts
@Inject(BOOKING_REPOSITORY)
private readonly bookingRepository: IBookingRepository,
```

Same for anything the domain must not know the implementation of — a clock, an id
generator, a random source. Injecting them is what makes time and randomness testable:

```ts
export const CLOCK = Symbol('CLOCK');
export interface Clock { now(): number }
```

Domain services (no `@Injectable`) are provided with `useValue`:

```ts
{ provide: PERMISSION_CHECKER, useValue: new PermissionChecker() }
```

Application services and use cases are plain `@Injectable()` classes listed in
`providers`.

## Module template

```ts
@Module({
  imports: [
    // TypeOrmModule.forFeature([BookingOrmEntity]),  // only with a relational DB
    forwardRef(() => OtherModule),                    // only for a real cycle
  ],
  controllers: [BookingController],                   // or none
  providers: [
    { provide: BOOKING_REPOSITORY, useClass: BookingRepository },
    CreateBookingUseCase,
    CancelBookingUseCase,
  ],
  exports: [BOOKING_REPOSITORY],                      // only what others need
})
export class BookingModule {}
```

`project.md` lists which modules are `@Global()` (a shared kernel usually is) and what
tokens they publish, so those need no import.

## Cross-module access

- Inject the other module's **repository Symbol** — it must be in that module's
  `exports`. Do not import its ORM entity, its store or its mapper.
- Do not call another module's use case from a use case. Extract an application service
  into the owning module and export it; `project.md` lists the sanctioned seams and the
  reason each one exists. Adding a seam is an architecture decision — record it there.
- Modules that must react to each other without depending on each other publish on an
  event bus owned by the shared kernel. One subscriber turns events into transport
  (see `presentation.md` → gateways).
- Circular imports are resolved with `forwardRef` on both sides. Needing one is a signal
  to check whether the dependency belongs there at all.

## Enforcement

*Applies when `project.md` says the repo runs `eslint-plugin-boundaries` or an
equivalent.* The dependency rule is then executable: the config classifies every file
under `src/` as `{module} × {layer}` and rejects imports that cross a layer or reach into
another module's private layers.

- A boundaries error means: fix the design (move the code, introduce a domain interface +
  Symbol, or use an existing seam), not the config.
- Existing breaches are marked in place with
  `// eslint-disable-next-line boundaries/dependencies -- KNOWN DEBT: <fix>`; grepping
  `KNOWN DEBT` lists the debt. Never add a new one to avoid a refactor you could do now.
- A rule that fails is never loosened to make a check pass.

Where there is no such lint rule, the same reviews happen by hand: before importing,
check the path of what you are importing.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Domain entity | `PascalCase`, file `kebab.entity.ts` | `Booking`, `booking.entity.ts` |
| ORM entity | `{Name}OrmEntity`, `*.orm-entity.ts` | `BookingOrmEntity` |
| Mapper | `{Name}Mapper`, static `toDomain` / `toPersistence` | `BookingMapper` |
| Repository iface | `I{Name}Repository` + `{NAME}_REPOSITORY` | `IBookingRepository` |
| Use case | `{Verb}{Thing}UseCase`, `*.use-case.ts` | `CancelBookingUseCase` |
| DTO | `{Action}Dto`, `{Thing}ResponseDto`, `{Thing}QueryDto` | `CreateBookingDto` |
| Controller | `{Module}Controller`, `@Controller('{route}')` | `BookingsController` |
| Gateway | `{Module}Gateway` | `GameGateway` |
| Queue processor | `{Thing}Processor` | `ThumbnailProcessor` |
| Scheduled task | `{Thing}Task` | `PurgeTask` |
| DB columns | `snake_case` via `@Column({ name })` | `booking_id` |
| Indexes | `idx_{table}_{cols}` | `idx_bookings_user_date` |
