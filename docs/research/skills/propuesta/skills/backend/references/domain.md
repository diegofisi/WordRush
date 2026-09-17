# Domain layer

**Applies always.** Pure TypeScript: no decorators, no framework imports, no I/O.

## Entities

Private fields with a `_` prefix, public getters, **no public setters** — state changes go
through intention-revealing methods.

```ts
export class Booking {
  private _status: BookingStatus;
  private _cancelledAt: Date | null;

  private constructor(
    readonly id: string,
    private _slot: TimeSlot,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  /** New aggregate. Validates invariants; does nothing that needs I/O. */
  static create(props: { id: string; slot: TimeSlot; now: Date }): Booking {
    if (props.slot.isInThePast(props.now)) throw new DomainException('Slot is in the past');
    return new Booking(props.id, props.slot, props.now, props.now);
  }

  /** Rehydrate from persistence. No validation, no side effects. */
  static reconstitute(props: { id: string; /* ... */ }): Booking { /* ... */ }

  get status(): BookingStatus { return this._status; }

  cancel(now: Date): void {
    if (this._status === BookingStatus.CANCELLED) throw new DomainConflictException('Already cancelled');
    this._status = BookingStatus.CANCELLED;
    this._cancelledAt = now;
    this.markUpdated(now);
  }
}
```

Rules:

- **Two factories, always**: `create*()` for new state (validates, throws a domain
  exception) and `reconstitute()` for loading (never throws, never normalises).
- Every mutator updates the entity's own bookkeeping (`updatedAt`, version, revision).
  A *read* path that calls a mutator silently republishes the aggregate to anything that
  keys on that field — see `pitfalls.md` → Reads must not write.
- Invariants that need the outside world (uniqueness, ownership, "does the parent
  exist") are checked in the use case; invariants that must hold for *every* caller live
  in the entity. Prefer a public `assertXAcceptable()` that callers can run **before**
  side effects, plus the mutating method that calls it again.
- **Time and randomness are inputs**, not calls. An entity takes `now: Date` (or reads an
  injected clock through the use case) instead of calling `Date.now()`; a picker takes a
  random source. Otherwise the behaviour cannot be tested and cannot be replayed.
- *If `project.md` names a `BaseEntity`* (`id`, `createdAt`, `updatedAt`,
  `markUpdated()`), extend it instead of repeating those fields. Many projects have none.

## Value objects

Small immutable types validated in their factory and compared with `equals()`
(`Money.create`, `Email.create`, `TimeSlot`, `Percentage`). Use them inside entities;
expose primitives from getters only where the codebase already does.

Value objects are where a unit's meaning is pinned down (seconds vs milliseconds,
cents vs units). A bug that comes from mixing units is a missing value object.

## Enums

One file per enum in `domain/enums/`. Prefer string enums (`'in_progress'`) — they
survive a round-trip through JSON or a `varchar` column unchanged.

## Domain services

Stateless logic that spans entities but still needs no I/O (`PermissionChecker`,
`ScoreCalculator`, `WordScorer`). Export a Symbol, provide with `useValue: new X()`, and
test them directly: they are the cheapest tests in the codebase, and they are where the
rules of the product actually live.

## Repository interfaces

```ts
export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');

export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  /** One line: what it is for, and any invariant callers rely on. */
  findByIdAndOwner(id: string, ownerId: string): Promise<Booking | null>;
  save(booking: Booking): Promise<Booking>;
}
```

- The interface is written in **domain terms** and says nothing about SQL, Redis, a map
  or an HTTP API. That is what lets the implementation be swapped (in-memory today, a
  database tomorrow) without touching a use case.
- *When the project has authenticated users*: ownership-scoped finders
  (`findByIdAndOwner`) are the default shape; a bare `findById` is for internal
  follow-ups, not for authorizing a request.
- Batch variants (`findByIds`, `saveMany`, `deleteMany`) exist to avoid N+1 in bulk
  paths — add them rather than looping.
- *When lists are paginated*: paginated finders return `{ items, total }` and take
  `{ limit, offset }` or `{ page, limit }`. Follow the neighbouring interface's shape.
- Methods return domain entities or `null`, never ORM rows, driver results or DTOs.

## Domain exceptions

One base `DomainException` plus a small set of subclasses, thrown by domain and
application code and translated **once**, at the edge:

| Throw | Means | HTTP (if there are controllers) |
|---|---|---|
| `DomainException` | Invalid input or state the caller can fix | 400 |
| `DomainNotFoundException` | Missing **or not visible to this caller** (don't leak existence) | 404 |
| `DomainForbiddenException` | Authenticated but not allowed | 403 |
| `DomainConflictException` | Duplicate or concurrent state | 409 |
| `DomainGoneException` | Existed, intentionally retired | 410 |

*With HTTP*: an exception filter maps them to status codes. *With sockets*: the same
filter maps them to the contract's error payload (`{ code, message }`) — see
`presentation.md`. Either way the translation table lives in one place.

Messages come from a shared `ERROR_MESSAGES`/`ErrorMessages` map when reusable, so the
transport layer and the tests agree on the string. A raw `throw new Error()` inside a use
case or repository surfaces as a 500 (or an unhandled socket error) — reserve it for
programmer errors.
