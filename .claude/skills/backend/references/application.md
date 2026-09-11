# Application layer

## Use cases

One class, one `execute()`, `@Injectable()`, dependencies by Symbol.

```ts
@Injectable()
export class RevokeAccessUseCase {
  constructor(
    @Inject(SHARED_ACCESS_REPOSITORY)
    private readonly sharedAccessRepository: ISharedAccessRepository,
    @Inject(FILE_NODE_REPOSITORY)
    private readonly fileNodeRepository: IFileNodeRepository,
    private readonly logActivityService: LogActivityService,
  ) {}

  async execute(fileNodeId: string, sharedWithId: string, ownerId: string): Promise<void> {
    // 1. Authorize by scoping the read to the caller.
    const fileNode = await this.fileNodeRepository.findByIdAndOwner(fileNodeId, ownerId);
    if (!fileNode) throw new DomainNotFoundException(ErrorMessages.FILE_NOT_FOUND);

    // 2. Do the work.
    await this.sharedAccessRepository.deleteByFileAndUser(fileNodeId, sharedWithId);

    // 3. Audit.
    await this.logActivityService.log({ userId: ownerId, fileNodeId, action: ActivityAction.UNSHARED, metadata: { revokedUserId: sharedWithId } });
  }
}
```

Order inside `execute()`: **authorize → validate state → side effects
(storage) → persist → audit/notify**. Authorization is the *first* await.

### Authorization patterns

- Owner-only: `findByIdAndOwner(id, userId)` → 404 on null.
- Owner **or collaborator**: `fileAccessService.requireRead(id, userId)` /
  `requireWrite(id, userId)` → returns `{ node, permissions }`. Use the same
  one in every step of a multi-step flow (init **and** complete of chunked
  upload) — mixing `requireWrite` at init with `findByIdAndOwner` at
  completion locked EDITORs out.
- Admin: `@Roles('admin')` on the controller; the use case still receives
  `performedByUserId` for the audit log (log the actor, put the target in
  `metadata`).

### Returning data

Return a **response DTO** class (`FileNodeResponseDto`, `SharedAccessResponseDto`),
constructed from the domain entity, never the entity or ORM row. `bigint`
becomes `string` in the DTO (`size: node.size.toString()`).

Public/anonymous endpoints return a **reduced** DTO
(`PublicFileNodeResponseDto`: no `ownerId`, `parentId`, `checksum`,
`lockedById`, internal flags).

## DTOs (input)

`class-validator` on every field; the global pipe is
`whitelist + forbidNonWhitelisted + transform`, so:

- An undecorated property is **stripped**; an unknown property is a **400**.
  Clients cannot send extra fields.
- Query DTOs use `@Type(() => Number)` for numbers, `@IsIn([...])` for
  sort keys, `@Transform` to normalise case.
- Numeric strings that become `BigInt` must be validated as bare integers:
  `@Matches(/^[0-9]+$/) @MaxLength(19)` — `@IsNumberString` accepts `"1.5"`
  and `BigInt("1.5")` throws a 500.
- Arrays get `@ArrayMaxSize(n)` (100 for bulk, 500 for sync).
- UUIDs: `@IsUUID('4')`. `deviceId` is `@IsString() @MaxLength(255)`, not a UUID.
- Sort keys advertised by a DTO must be accepted by the repository whitelist
  (`SORT_ALIASES` maps `created_at` → `createdAt`); a silent fallback to
  `name` is a bug, not a default.
- Multipart bodies have no DTO: validate primitives with
  `@Body('parentId', new ParseUUIDPipe({ optional: true }))`.

## `BaseResponse`

Every controller returns `BaseResponse.ok(data, message?)`; errors are thrown
as domain exceptions and formatted by the filter as
`{ success: false, message, statusCode }`. Lists return
`{ items|nodes|results, total, page|offset, limit }` inside `data`.

## Activity logging

`LogActivityService.log(props)` is awaited when the log is part of the
operation's meaning (share, move, plan change). For fire-and-forget after a
write, use **`logSafe(props)`** — it records failures. `.catch(() => {})`
hides constraint violations and mapping bugs; don't add new ones.

The activity repository is **transaction-aware**: a `log()` inside a
`unitOfWork.execute` rolls back with it. Log *before* a hard delete so the FK
still resolves.

## Transactions — `IUnitOfWork`

```ts
await this.unitOfWork.execute(async () => {
  await this.fileNodeRepository.hardDeleteMany(ids);   // enlists automatically
  await this.syncCursorRepository.save(cursor);        // same transaction
});
```

Works because every repository resolves `this.repo` from
`TransactionContext`. Nested `execute()` joins the outer transaction.
Storage (MinIO) is **not** transactional: do storage deletes *after* the
transaction commits, and compensate storage writes if the DB save throws
(`storageProvider.delete(path).catch(...)`).

Don't hold a transaction across a MinIO upload or a multi-object copy; do the
object work first, then open the transaction for the row writes.

## Quota — `StorageQuotaService`

Every path that adds bytes to an account must wrap its row write:

```ts
saved = await this.storageQuotaService.commitWithinQuota(
  ownerId,
  user.isAdmin() ? 0n : user.storageLimit,   // 0n = unlimited → skipped
  additionalBytes,                            // net delta; ≤ 0n → skipped
  () => this.fileNodeRepository.save(fileNode),
);
```

It takes a per-owner `pg_advisory_xact_lock`, re-reads `countStorageUsed()`
and commits in one transaction, closing the check-then-write race that lets
N parallel uploads all pass. `countStorageUsed()` = `file_nodes` +
`file_versions` + **declared** `file_size` of in-flight chunked uploads
(init is a reservation; completion has delta `0n` — do not re-charge it).

A cheap advisory pre-check before an expensive upload is fine; it is not a
substitute for the guarded commit.

## Pagination shapes in use

- `page`/`limit`/`total` — folders, trash, search, activity.
- `limit`/`offset`/`total` — sharing lists (default limit 20).
- Keyset cursor (`base64(JSON{ t, id })`) — sync, photos timeline, album
  items. Always validate the decoded cursor (`isNaN(date)`, shape) and throw
  `DomainException`, never `Error`.
