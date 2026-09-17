# Application layer

**Applies always** for use cases and DTOs. The sections marked with a condition apply
only when `project.md` says so.

## Use cases

One class, one `execute()`, `@Injectable()`, dependencies injected by Symbol.

```ts
@Injectable()
export class CancelBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookings: IBookingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(bookingId: string, ownerId: string): Promise<BookingResponseDto> {
    // 1. Authorize by scoping the read to the caller.
    const booking = await this.bookings.findByIdAndOwner(bookingId, ownerId);
    if (!booking) throw new DomainNotFoundException(ERROR_MESSAGES.BOOKING_NOT_FOUND);

    // 2. Validate state / apply the rule (the entity owns the invariant).
    booking.cancel(new Date(this.clock.now()));

    // 3. Persist, then 4. notify.
    const saved = await this.bookings.save(booking);
    return BookingResponseDto.from(saved);
  }
}
```

Order inside `execute()`: **authorize → validate state → external side effects →
persist → notify/audit**. Authorization is the first await. The use case orchestrates;
it does not re-implement rules that belong to an entity or a domain service.

A use case is also the only place allowed to decide *time*: it reads the clock once and
passes the value down, so every entity in one operation sees the same instant.

### Authorization patterns

*Applies when the project has users, sessions or any notion of "who is asking".*

- Owner-only: `findByIdAndOwner(id, actorId)` → 404 on null. Never "load, then compare
  `ownerId`" — the same query does both.
- Owner **or** collaborator: one application service (`requireRead` / `requireWrite`)
  that returns the entity plus the permissions. Use **the same** check at every step of a
  multi-step flow; mixing a permissive check at step 1 with a stricter one at step 2 locks
  legitimate callers out halfway through.
- Role-based: the guard rejects at the edge, and the use case still receives the actor's
  id for the audit trail.

### Returning data

Return a **response DTO** built from the domain entity, never the entity, the ORM row or
the store's record. Types that do not survive JSON (`bigint`, `Map`, `Date` where the
contract says number) are converted here, once.

*When some endpoints are public/anonymous*: they return a **reduced** DTO — a separate
class, not the same one with fields blanked out. A field added to the full DTO must not
silently appear in the public one.

*When the transport has a typed contract* (a shared `contract.ts`, an OpenAPI schema):
the response DTO's shape is that contract's type, and the contract file is the source of
truth. Never restate a typed contract in prose: a prose copy drifts the moment the type
changes.

## Input DTOs

`class-validator` on every field. The global pipe is normally
`whitelist + forbidNonWhitelisted + transform`, so:

- An undecorated property is **stripped**; an unknown property is a **400** (or a
  rejected socket payload). Clients cannot smuggle extra fields.
- Query DTOs use `@Type(() => Number)` for numbers, `@IsIn([...])` for sort keys,
  `@Transform` to normalise case.
- Numeric strings that become `BigInt` are validated as bare integers
  (`@Matches(/^[0-9]+$/)`) — `@IsNumberString` accepts `"1.5"`, and `BigInt('1.5')` throws.
- Arrays get `@ArrayMaxSize(n)`; free text gets `@MaxLength(n)`. An unbounded array or
  string in a payload is a denial-of-service knob.
- Ids: `@IsUUID('4')` only when the id really is a UUID. Client-generated ids (device
  ids, room codes) are `@IsString()` with a length and a pattern.
- Sort keys advertised by a DTO must be accepted by the repository's whitelist; a silent
  fallback to a default sort is a bug, not a default.
- Multipart bodies have no DTO class and therefore no whitelist: validate each primitive
  explicitly with a pipe.

## Response envelope

*Applies when `project.md` says the project wraps HTTP responses* (`BaseResponse.ok(...)`
→ `{ success, data }`). Then every controller returns it and errors are thrown, never
returned. Lists carry `{ items, total, page|offset, limit }` inside `data`.

Projects whose transport is a typed socket contract or plain JSON have no envelope —
do not invent one.

## Transactions

*Applies when `project.md` lists a relational database.*

```ts
await this.unitOfWork.execute(async () => {
  await this.bookings.saveMany(updated);
  await this.slots.markTaken(slotIds);
});
```

- Works because every repository resolves its handle from the ambient transaction
  context; nested `execute()` joins the outer transaction.
- External systems (object storage, payment providers, e-mail) are **not** transactional:
  do their work before the transaction and compensate if the commit throws, or after the
  commit and accept the retry.
- Side effects that must survive a rollback (revoking a credential after a failed
  rotation) go **outside** the transaction, or they roll back with it.
- Never hold a transaction open across a network call to another system.

## Guarded commit under contention

*Applies when a limit is checked and then written (quota, capacity, stock, seats).*

A check-then-write across two statements races: N parallel callers all read "there is
room". The fix is one guarded commit: take a lock keyed on the contended resource
(a row lock, a database advisory lock, or — in a single-process server — a synchronous
section that cannot await between check and write), re-read the current total inside it,
then write.

A cheap pre-check before expensive work is fine; it is not a substitute for the guard.

## Audit / activity log

*Applies when the project records an activity trail.* Log after the write, awaited when
the log is part of the operation's meaning. For fire-and-forget, use a `logSafe()` helper
that records its own failures — never `.catch(() => {})`, which hides constraint
violations and mapping bugs. Log **before** a hard delete so the reference still resolves.

## Pagination

*Applies when lists can grow.* Pick one shape per list and keep it:
`page/limit/total`, `limit/offset/total`, or a keyset cursor (`base64(JSON{ key, id })`)
for feeds that change while being read. Always validate a decoded cursor (shape, `NaN`
dates) and throw a domain exception, never a raw `Error`.
