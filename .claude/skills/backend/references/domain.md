# Domain layer

Pure TypeScript. No decorators, no framework imports, no I/O.

## Entities

Extend `BaseEntity` (`id`, `createdAt`, `updatedAt`, `markUpdated()`).
Private fields with `_` prefix, public getters, **no public setters** —
state changes go through intention-revealing methods.

```ts
export class SharedAccess extends BaseEntity {
  private _permission: SharePermission;
  private _expiresAt: Date | null;

  constructor(id: string, ..., createdAt: Date, updatedAt: Date) {
    super(id, createdAt, updatedAt);
    ...
  }

  /** New aggregate. Validates invariants, generates nothing that needs I/O. */
  static createUserShare(props: { fileNodeId: string; sharedById: string; ... }): SharedAccess {
    if (!props.fileNodeId) throw new DomainException('File is required');
    const now = new Date();
    return new SharedAccess(undefined!, ..., now, now);   // id assigned by repository/save
  }

  /** Rehydrate from persistence. No validation, no side effects. */
  static reconstitute(props: { id: string; ... }): SharedAccess { ... }

  get permission(): SharePermission { return this._permission; }

  updatePermission(permission: SharePermission): void {
    this._permission = permission;
    this.markUpdated();
  }

  get isExpired(): boolean {
    return this._expiresAt != null && new Date() > this._expiresAt;
  }
}
```

Rules:
- Two factories, always: `create*()` for new state (validates, throws
  `DomainException`) and `reconstitute()` for loading (never throws).
- Every mutator calls `markUpdated()`. `updatedAt` is what delta-sync keys
  on, so a mutator that forgets it is invisible to other devices — and a
  *read* path that calls a mutator re-broadcasts the row to every device
  (see `pitfalls.md` → Reads must not write).
- Invariants that need a database (uniqueness, ownership, descendants) are
  checked in the use case, not the entity.
- Guards that must hold for *every* caller live in the entity
  (`assertNotLocked`, chunk range checks). Prefer a public
  `assertXAcceptable()` that callers can run **before** side effects, plus
  the mutating method that calls it again.
- `bigint` for byte sizes and quotas (`FileSize` VO); `Date` for timestamps.

## Value objects (`@shared/domain/value-objects`)

`FileSize.create(bigint)`, `Checksum.create(hex)`, `Email`, `PublicToken.generate()`
(32 random bytes hex), `StoragePath`. Immutable, validated in the factory,
compared by `equals()`. Use them inside entities; expose primitives from
getters only where the whole codebase already does (`size: bigint`).

## Enums

One file per enum in `domain/enums/`. String enums (`'in_progress'`), because
they are stored as-is in Postgres `varchar` columns and read back in mappers.

## Domain services

Stateless logic that spans entities but still needs no I/O
(`PermissionChecker`, `FileTypeDetector`). Export a Symbol and provide with
`useValue: new X()`. Test them directly — they are the cheapest tests in the
codebase.

## Repository interfaces

```ts
export const THING_REPOSITORY = Symbol('THING_REPOSITORY');

export interface IThingRepository extends IBaseRepository<Thing> {
  findByIdAndOwner(id: string, ownerId: string): Promise<Thing | null>;
  /** One-line: what it is for and any invariant callers rely on. */
  findExpired(before: Date, limit: number): Promise<Thing[]>;
}
```

- Ownership-scoped finders (`findByIdAndOwner`, `findByIdsAndOwner`) are the
  default shape; a bare `findById` is for internal follow-ups (companions,
  descendants), not for authorizing a request.
- Batch variants (`findByIds`, `saveMany`, `deleteMany`, `hardDeleteMany`)
  exist to avoid N+1 in bulk paths — add them rather than looping.
- Paginated finders return `{ items | nodes, total }` and accept
  `{ limit, offset }` or `{ page, limit }` (follow the neighbour's shape).

## Exceptions

| Throw | HTTP | Use for |
|---|---|---|
| `DomainException` | 400 | Invalid input/state the client can fix |
| `DomainNotFoundException(ErrorMessages.X)` | 404 | Missing **or not owned** (don't leak existence) |
| `DomainForbiddenException` | 403 | Authenticated but not allowed (quota, permission) |
| `DomainConflictException` | 409 | Duplicate / concurrent state |
| `DomainGoneException` | 410 | Existed, intentionally retired (expired link, expired upload) |
| `DomainRangeNotSatisfiableException` | 416 | Bad `Range` header |

Messages come from `ErrorMessages` when reusable. A raw `throw new Error()`
inside a use case or repository surfaces as a **500** — reserve it for
programmer errors.
