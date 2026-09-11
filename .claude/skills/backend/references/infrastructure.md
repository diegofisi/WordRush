# Infrastructure layer

## ORM entities (`*.orm-entity.ts`)

The **only** source of truth for the schema (migrations are generated from
them — see `migrations.md`).

```ts
@Entity('shared_access')
@Index('idx_shared_access_file_user', ['fileNodeId', 'sharedWithId'], {
  unique: true, where: '"shared_with_id" IS NOT NULL',
})
export class SharedAccessOrmEntity {
  @PrimaryColumn('uuid') id: string;                       // generated in domain, not DB

  @ManyToOne(() => FileNodeOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_node_id' })
  fileNode?: FileNodeOrmEntity;                            // optional relation for joins

  @Index('idx_shared_access_file_node')
  @Column({ name: 'file_node_id', type: 'uuid' }) fileNodeId: string;

  @Column({ type: 'bigint' }) size: string;                // bigint ↔ string
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

- `snake_case` column names via `name:`; `timestamptz` for dates; `bigint`
  columns are typed `string` on the ORM side and parsed with `BigInt()` in
  the mapper.
- Named indexes (`idx_*`). Indexes created with raw SQL in a migration
  (pg_trgm GIN) are **invisible** to TypeORM — see `migrations.md`.
- `@UpdateDateColumn` fires on every `save()`. That is why read paths must
  use targeted `UPDATE`s (`touchLastAccessed`) instead of `save(entity)`.

## Mappers

Static `toDomain(orm)` / `toOrm(domain)`. `toDomain` uses
`Entity.reconstitute()`; `toOrm` builds a fresh ORM instance field by field.
Mappers hold no logic beyond type conversion (enum casts, `BigInt()`,
joined relation → info object).

## Repositories

```ts
@Injectable()
export class ThingRepository implements IThingRepository {
  constructor(
    @InjectRepository(ThingOrmEntity) private readonly baseRepo: Repository<ThingOrmEntity>,
    private readonly txContext: TransactionContext,
  ) {}

  /** Enlists in the ambient UnitOfWork. ALWAYS go through this. */
  private get repo(): Repository<ThingOrmEntity> {
    const manager = this.txContext.getManager();
    return manager ? manager.getRepository(ThingOrmEntity) : this.baseRepo;
  }
}
```

Rules:
- `this.repo` everywhere; `this.repo.manager.query(...)` for raw SQL so it
  joins the transaction too.
- Raw SQL uses `$1` parameters; the only interpolated fragment allowed is a
  column name that passed a whitelist (`safeSortColumn`).
- Every `ORDER BY` gets `.addOrderBy('x.id', 'DESC')` — deterministic paging.
- Filters the client will observe (expired, trashed, hidden) go in the
  `WHERE`, **before** `take/skip`. Filtering after pagination returns short
  pages and a wrong `total`.
- Read-modify-write on a JSON/array column under concurrency needs a lock:
  `SELECT pg_advisory_xact_lock(hashtext($1))` inside a transaction
  (`acquireQuotaLock`, `acquireUploadLock` are the pattern).
- Recursive CTEs over `parent_id` must bound depth or use `CYCLE`; the
  application must also prevent cycles on write (validated `moveTo`).
- Sensitive columns: encrypt in `save()`, look up by hash, decrypt on read;
  if decryption fails, return `null` for that field — never the ciphertext
  (`SharedAccessRepository.withDecryptedToken`).

## Storage — two buckets

| Token | Bucket | Holds |
|---|---|---|
| `STORAGE_PROVIDER` | `MINIO_BUCKET` | Originals (`storage_path`), chunk objects `chunks/{uploadId}/{i}`, versions |
| `CACHE_STORAGE_PROVIDER` | `MINIO_CACHE_BUCKET` | `thumbnail_path`, `preview_path` |

Deleting a thumbnail through `STORAGE_PROVIDER` is a silent no-op that leaks
the object forever. Every delete path collects `permanentPaths` and
`cachePaths` separately (see `account-purge.task.ts` as the model).

`IStorageProvider`: `upload(key, Buffer|Readable, size, contentType)`,
`download(key)`, `downloadPartial(key, offset, length)`, `delete`,
`deleteMany`, `copyObject`, `headObject`, `getPresignedUrl(key, seconds)`
(keep presigned TTLs short — 15 min; they cannot be revoked).

## BullMQ processors

```ts
@Processor('thumbnail-generation', { concurrency: 4 })
export class ThumbnailProcessor extends WorkerHost {
  async process(job: Job<{ conversionJobId: string; mimeType: string; ownerId?: string }>) {
    const conversionJob = await this.conversionJobRepository.findById(job.data.conversionJobId);
    if (!conversionJob) return;
    if (conversionJob.isCompleted()) return;          // at-least-once delivery → idempotent
    conversionJob.markProcessing(); await this.conversionJobRepository.save(conversionJob);
    try {
      // video → streamToTempFile + ffmpeg on disk; image → streamToBuffer (bounded)
      // upload derivative to cacheStorageProvider
      const fileNode = await this.fileNodeRepository.findById(conversionJob.fileNodeId);
      if (!fileNode) { await this.cacheStorageProvider.delete(path).catch(() => undefined); return; } // node vanished → reclaim
      fileNode.setThumbnailPath(path); await this.fileNodeRepository.save(fileNode);
      conversionJob.markCompleted(path, BigInt(size)); await this.conversionJobRepository.save(conversionJob);
    } catch (e) {
      conversionJob.markFailed(msg); await this.conversionJobRepository.save(conversionJob);
      throw e;                                          // let BullMQ retry (attempts: 3)
    } finally {
      await cleanupTempFiles(...);
    }
  }
}
```

Rules:
- Idempotency guard first. Processors without a `ConversionJob` row
  (`photo-compression`) need another durable marker (the "original"
  `FileVersion` row).
- Never `Buffer.concat` an original without a cap: `streamToBuffer(stream)`
  (256MB) for images, `streamToTempFile` + on-disk tools for video.
- `mimeType` is client-declared. Treat it as a hint.
- When you replace a node's object (video → MP4), delete the superseded
  object and update `mimeType`/`name` (`updateMediaType`).
- Persist a version row only **after** you have decided to keep the new
  object; a row pointing at a deleted object breaks restore.
- Enqueue via a use case that first saves the `ConversionJob`; if
  `queue.add` throws, `markFailedTerminal`.
- Auto-retry budget is `canRetry()`; user-triggered retry is
  `canRetryManually()`/`retryManually()` (resets attempts).

## Scheduled tasks

```ts
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handleTrashPurge(): Promise<void> {
  try {
    await this.lock.runExclusive('trash-purge', 30 * 60 * 1000, () => this.runPurge());
  } catch (error) {
    this.logger.error(`Trash purge failed: ${msg}`);
  }
}
```

- `runExclusive(name, ttlMs, work)` — Redis lock with heartbeat renewal;
  it **re-throws**, so the try/catch is mandatory: an unhandled rejection
  ends the process.
- Work in batches (`BATCH_SIZE = 500`); rows first, objects second; dedup
  guard; both buckets.
- Read config through `ConfigService` and coerce (`Number(...)` +
  `isFinite`) — `get<number>` does not convert strings.

## Rate limiting

`RedisThrottlerStorage` (fixed window, fails open on Redis outage). Hot
read/navigation/sync paths carry `@SkipThrottle()`; auth endpoints carry
`@Throttle({ default: { limit: 5, ttl: 60000 } })`. Do not add
`@SkipThrottle()` to anything that writes bytes or is `@Public()`.
