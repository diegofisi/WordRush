# Pitfalls — rules this codebase has already paid for

> **Inherited ledger.** These rules were paid for by a previous project (a cloud-drive
> API with buckets, quotas, trash and sync). Keep the *patterns* — idempotent handlers,
> ownership checks first, reads never write, no swallowed errors, atomic multi-aggregate
> writes — and ignore the specifics that have no counterpart in this game server.
> Add this project's own hard-won rules at the end, dated.

Each item was a real defect found and fixed in this repo. Read before
finishing any change; the pattern is always "one path did it right, its
sibling did not".

## Deletes (trash, purge, bulk, account)

1. **Dedup guard.** Several `file_nodes` can share one `storage_path`
   (SHA-256 dedup). Before deleting objects, call
   `fileNodeRepository.findReferencedStoragePaths(paths, excludeIds)` and
   drop only what nothing else references. Missing it destroys another
   live file's bytes.
2. **Rows first, objects second.** An orphan object is recoverable; a row
   pointing at a deleted object is not. Commit `hardDeleteMany` in the
   UnitOfWork, then `deleteMany` on storage.
3. **Two buckets.** `thumbnail_path`/`preview_path` live in
   `CACHE_STORAGE_PROVIDER`. Deleting them through `STORAGE_PROVIDER` is a
   silent leak. Collect `permanentPaths` and `cachePaths` separately.
4. **Permanent delete only from trash.** `DELETE /trash/:id` must check
   `isTrashed`; otherwise it bypasses the 30-day grace on live files.
5. **Restore scope.** Restoring a folder restores descendants whose
   `trashedAt >= folder.trashedAt`; items trashed individually earlier stay
   in the trash.
6. Derivatives uploaded by a processor whose node vanished mid-job must be
   deleted right there — nothing else knows their key.

## Uploads & quota

7. Validate a chunk (`assertChunkAcceptable`) **before** writing it to
   storage; the sweeper only walks `0..totalChunks-1`.
8. Chunk sizes are exact: `chunkSize` for all but the last, remainder for
   the last. An undersized non-final chunk makes `isComplete()` true and
   completion fail forever.
9. `countStorageUsed()` includes versions and in-flight chunked uploads at
   their **declared** size. Init reserves; completion charges `0n`.
10. Every byte-adding write goes through
    `storageQuotaService.commitWithinQuota(...)` (advisory lock + re-check +
    write in one transaction). Pre-checks alone race.
11. On any failure after chunks were written, delete
    `chunks/{uploadId}/*` before marking `FAILED` — `findExpired` only
    sweeps `in_progress`.
12. Multipart simple upload buffers the whole body in RAM
    (`SIMPLE_UPLOAD_MAX_BYTES`, 100MB). Larger files use the chunked API.
13. Multi-step flows authorize the same way at every step
    (`requireWrite` at init **and** complete).

## Reads must not write

14. `GET /files/:id` uses `touchLastAccessed(id, at)` (targeted UPDATE), not
    `save(node)`. A full save bumps `updated_at`, re-publishing the row to
    delta-sync on every read, and can revert a concurrent rename.

## Sync

15. The sync cursor is the **read** position, owned by `acknowledge-cursor`.
    `apply-changes` must not move it — doing so skipped other devices'
    undelivered changes permanently.
16. `SyncAction.MOVE` validates exactly like `MoveFileNodeUseCase`
    (destination exists, is a folder, owned, not trashed, not self, not a
    descendant). A cycle in `parent_id` makes `findDescendants` (recursive
    CTE) never terminate.
17. Validate acknowledged cursors: `isNaN` → 400; future dates → 400.
18. `deviceId` is not a UUID anywhere (register, config, unregister,
    changes). Use a validated query DTO — a missing bare `@Query()` param is
    `undefined`, which TypeORM drops from `where`.
19. `apply-changes` has `@ArrayMaxSize(500)` and `@SkipThrottle()`; keep
    both facts in mind when touching it.

## Public endpoints

20. Return `PublicFileNodeResponseDto` (no `ownerId`, `parentId`,
    `checksum`, `lockedById`). Check `isTrashed` and `isHidden`.
21. Streaming: clamp ranges, 416 on bad ranges, `pipeStreamToResponse`.
    Public endpoints are reachable without an account — leaks there are
    unauthenticated DoS vectors.
22. Presigned URLs: 15 minutes; batch HEAD requests with bounded
    concurrency (10).

## Media processors

23. Idempotency guard first (`isCompleted()` or a durable marker).
24. `streamToBuffer` (bounded) for images; temp files for video. Never an
    unbounded `Buffer.concat`.
25. Replacing a node's object: delete the old one, update
    `mimeType`/`name`.
26. Version rows only after deciding to keep the new object.
27. `markFailed` → FAILED only at 3 attempts; the recovery cron uses
    `markFailedTerminal`; manual retry uses `retryManually()`.

## Crons

28. `runExclusive` re-throws. Every `@Cron` handler wraps it in try/catch.
29. Locks renew via heartbeat; still pick a TTL above the worst-case run.
30. Config via `ConfigService` + explicit `Number()` coercion.

## Security

31. `trust proxy` must match the hop count (`TRUST_PROXY`); otherwise
    `req.ip` is the proxy for everyone and rate limits are global.
32. Throttler state lives in Redis; in-memory storage multiplies limits by
    replica count.
33. Any user-controlled name that becomes a path (ZIP entries, storage
    keys, temp files) passes `fileTypeDetector.sanitizeFileName`.
34. Outbound fetch of a user URL: `assertSafeUrl` per redirect hop **and**
    connect through `pinnedLookup(addresses)` — otherwise DNS rebinding.
    Stream to disk; enforce plan `maxFileSize`; `request.destroy()` on
    `timeout`.
35. No default credentials in code (`requireConfig` for MinIO keys).
36. Public tokens are encrypted at rest; a row that fails to decrypt yields
    `publicToken: null`, never ciphertext.
37. Bulk endpoints surface only `DomainException` messages per failed item;
    infrastructure error text stays in the logs.

## Logging & audit

38. `logSafe()` instead of `.catch(() => {})`.
39. Activity repository enlists in transactions — log before hard deletes.
40. Admin actions log the **actor** (`userId: performedByUserId`) with the
    target in `metadata`.

## Process

41. `pnpm lint` has `--fix`. Use `npx eslint src`.
42. Adding a repository method → update `MockOf` factory in
    `test/helpers/mock-repository.factory.ts`.
43. Adding an env var → default or `required` list, `.env.example`,
    `CLAUDE.md`.
44. Adding a migration → review checklist in `migrations.md`, update its
    table.

## Second audit (2026-09-10) — data loss, quota, contract

45. `video-conversion` deleted the superseded source unconditionally; dedup
    (url-import, reupload) shares `storage_path` between nodes. → every
    physical delete goes through `findReferencedStoragePaths`, which now
    also consults `file_versions`. A fix that adds a delete without the
    guard is a regression, not a cleanup.
46. Storage Saver wrote the compressed bytes OVER the node's own key (bytes
    of deduped siblings replaced), kept the old checksum and MIME, and
    uploaded a second copy of the original outside the quota. → new key,
    version row points at the original key, checksum/MIME updated,
    `commitWithinQuota`, output discarded if the node changed meanwhile.
47. `restore-version` copied the object and charged `version.size −
    node.size` (0 for equal sizes) → unbounded growth past the quota. →
    repoint the node at the version's object, consume the row; net 0 bytes.
48. No delete path reclaimed `file_versions.storage_path`. → each path
    calls `findStoragePathsByFileNodes` BEFORE `hardDeleteMany` (rows
    cascade away with the node).
49. `POST /bulk/delete` hard-deleted live nodes. → same guard as
    `DELETE /trash/:id`: `isTrashed` required, foreign lock refused.
50. Children were listed by `owner_id` of the folder; an editor's upload
    (owner = uploader) appeared nowhere. → `findChildren(..., anyOwner)`.
51. `FileAccessService` ignored `isTrashed`: parent-folder grants kept
    read+write on a file the owner trashed. → NotFound for non-owners.
52. Sync `apply-changes`: TRASH/RESTORE without cascade; first push from a
    new device (cursor = epoch 0) flagged every change as a conflict. →
    `applyTrashState` cascades; `baseUpdatedAt` per change; epoch cursor
    skips the comparison.
53. `ProcessMediaUseCase` re-threw on the first failed enqueue → later job
    rows never created, no retry path. → attempt all, rethrow first error.
54. Refresh rotation was read-then-save. → `revokeIfActive` conditional
    UPDATE; loser triggers family revocation.
55. `reupload` computed `v{n+1}` outside any lock (second PUT overwrote the
    first). → unique key + row swap under `acquireQuotaLock`, compensating
    delete on failure.
56. Copy / url-import / Live Photo companion left objects behind when the
    quota commit threw. → compensate; companion goes through the quota.
57. ZIP opened every MinIO stream up front (≤10 000 sockets). → one at a
    time, awaiting archiver's `entry`.
58. HEIC: EXIF was read AFTER heic-convert (which strips it) → iPhone
    photos had no `taken_at`. → `exifr` on the original bytes;
    `OffsetTimeOriginal` applied when present.
59. Seven indexes existed only in migrations → `migration:generate` would
    DROP them (incl. the UNIQUE on `file_versions(file_node_id,
    version_number)`). → declared on the entities; trgm ones with
    `synchronize: false`.
60. Contract with the mobile app: `GET /photos/albums/:id/items` did not
    exist (alias added); `BulkShareIdsDto.shareIds` vs mobile `ids`
    (mobile fixed); `SyncDeltaDto` is flat, the mobile model expected a
    nested `fileNode` (mobile fixed); `/notifications/*` has NO backend
    module — the mobile feature is unrouted for that reason.
61. Version-number invariant: version rows always carry numbers strictly
    below `node.version`. Reupload/restore/compression save the row with
    the CURRENT number, then `incrementVersion()`. Keep that order.

## Third pass (2026-09-10, "zero errors")

62. `refreshTokenRepository.revokeAllByUserId` inside the rotation
    transaction was rolled back together with the failed rotation. Side
    effects that must survive a throw go OUTSIDE `unitOfWork.execute`.
63. `commitWithinQuota` skipped the transaction + owner lock for unlimited
    plans; a two-row commit (version + node) could half-apply and later
    trip the unique version index. The lock/transaction are unconditional
    now; only the comparison depends on the limit.
64. archiver's `abort()` emits neither `entry` nor `error`; anything
    awaiting per-entry progress must also listen for end/finish/close and
    a custom abort event.
65. `idx_shared_access_public_token` was dropped by EncryptPublicTokens —
    never declare on the entity an index a later migration removed.
66. A `FileVersion` row may carry `checksum: ''`; `updateStorageInfo` treats
    '' as null instead of throwing.
67. Storage Saver records the original MIME in the version comment
    (`[mime=…]`); `restore-version` re-types the node from it.
68. Lint to zero: raw query rows are typed (`getRawMany<T>()`), mapper
    methods are wrapped in arrows (unbound-method), `catch (e: unknown)`.
69. `FileNode.isLockedByOther(userId)` is the ONLY lock check — it folds
    in the 1h expiry; `isLocked && lockedById !== x` blocks forever.
70. `GET /admin/plans` (all plans) exists for the admin UI; `GET /plans`
    stays active-only. `UserProfileResponseDto.deletionRequestedAt` is
    what the profile page uses to offer "cancelar eliminación".
71. `/photos/months?tz=` accepts IANA names validated with
    `Intl.supportedValuesOf('timeZone')` (a bad zone is a 400, not a
    Postgres 500).
