# Infrastructure layer

**Applies always** for repositories and mappers. Every other section names its condition;
skip the ones `project.md` marks as not applying.

## Repositories — the shape that does not depend on the store

The interface lives in `domain/`; the implementation lives here and is the only file that
knows what the store is.

```ts
@Injectable()
export class InMemoryBookingRepository implements IBookingRepository {
  private readonly rows = new Map<string, BookingRecord>();

  async findById(id: string): Promise<Booking | null> {
    const row = this.rows.get(id);
    return row ? BookingMapper.toDomain(row) : null;
  }

  async save(booking: Booking): Promise<Booking> {
    this.rows.set(booking.id, BookingMapper.toPersistence(booking));
    return booking;
  }
}
```

Rules that hold for any store:

- Return domain entities, never raw rows or records.
- Ordered queries get a deterministic tie-breaker on the id; without it, two rows with
  the same sort key swap places between pages.
- Filters the caller will observe (expired, hidden, archived) are applied **before**
  pagination. Filtering after paginating returns short pages and a wrong total.
- Batch methods instead of loops in the caller.
- No business rules here. A repository that decides whether something is allowed has
  taken a use case's job.

### In-memory stores

*Applies when `project.md` says state lives in the process.*

- The store is still behind the interface, so the day it moves to Redis or SQL only this
  file changes. Do not let a use case reach into the `Map`.
- Mutation is synchronous: the whole read-modify-write must run without an `await` in the
  middle, or two callers interleave. Where an operation must be atomic across several
  aggregates, do it in one synchronous step and only then await.
- Store *copies* or entities, never references handed out to callers who may mutate them
  after the fact, unless the aggregate is the single owner of that object.
- Memory is bounded: an in-memory store needs an eviction path (a janitor, a TTL, a
  ceiling that rejects new entries) or the process dies under a burst.
- Everything in the store is lost on restart. `project.md` records what that costs and
  what the deploy story is.

### ORM-backed repositories

*Applies when `project.md` lists a relational database (examples: TypeORM 0.3).*

```ts
@Injectable()
export class BookingRepository implements IBookingRepository {
  constructor(
    @InjectRepository(BookingOrmEntity) private readonly baseRepo: Repository<BookingOrmEntity>,
    private readonly txContext: TransactionContext,
  ) {}

  /** Enlists in the ambient transaction. ALWAYS go through this. */
  private get repo(): Repository<BookingOrmEntity> {
    const manager = this.txContext.getManager();
    return manager ? manager.getRepository(BookingOrmEntity) : this.baseRepo;
  }
}
```

- `this.repo` everywhere, including `this.repo.manager.query(...)` for raw SQL, so raw
  statements join the transaction too.
- Raw SQL uses bound parameters (`$1`); the only interpolated fragment allowed is a
  column name that passed a whitelist.
- A read-modify-write on a JSON or array column under concurrency needs a lock
  (`SELECT pg_advisory_xact_lock(...)` inside the transaction).
- Recursive queries over a parent link must bound depth or use `CYCLE`; the application
  also has to prevent cycles on write.
- Sensitive columns: encrypt on write, look up by hash, decrypt on read; if decryption
  fails return `null` for that field, never the ciphertext.

## ORM entities

*Applies when `project.md` lists a relational database.* They are the **only** source of
truth for the schema — migrations are generated from them (`migrations.md`).

```ts
@Entity('bookings')
@Index('idx_bookings_user_slot', ['userId', 'slotId'], { unique: true })
export class BookingOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ type: 'bigint' }) amountCents: string;            // bigint ↔ string
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

- `snake_case` column names via `name:`; `timestamptz` for instants; `bigint` columns are
  typed `string` and parsed with `BigInt()` in the mapper.
- Named indexes (`idx_*`). An index created with raw SQL in a migration is invisible to
  the ORM — see `migrations.md`.
- `@UpdateDateColumn` fires on every `save()`. That is why read paths use a targeted
  `UPDATE` instead of saving the whole entity.

## Mappers

Static `toDomain(record)` / `toPersistence(entity)`. `toDomain` calls
`Entity.reconstitute()`; `toPersistence` builds a fresh record field by field. Mappers
hold no logic beyond type conversion (enum casts, `BigInt()`, joined relation → info
object). A rule that sneaks into a mapper is invisible to every test of the domain.

## External service clients

*Applies when the project talks to something outside the process* (object storage, a
payment API, an e-mail provider, an LLM).

- One thin client per system, behind an interface owned by `domain/interfaces/` when a
  use case depends on it. That interface is also what the tests fake.
- Timeouts and a bounded retry policy are part of the client, not of the caller.
- Errors are translated into domain exceptions at this boundary; the provider's error
  text goes to the log, never to the client of your API.
- Credentials come from config with no defaults in code; a missing one fails at boot.
- Anything unbounded that comes back (a stream, a list) is capped before it is buffered.

## Object storage

*Applies when `project.md` lists an object store.*

- The provider interface is the seam: `upload`, `download`, `delete`, `deleteMany`,
  `copy`, `head`, `getPresignedUrl`. Use cases talk to the interface.
- When there is more than one bucket (originals vs derivatives/cache), each has its own
  injection token. Deleting an object through the wrong provider is a **silent no-op that
  leaks the object forever** — every delete path collects the paths per bucket.
- Rows first, objects second: an orphan object is recoverable, a row pointing at a
  deleted object is not.
- Presigned URLs are short-lived and cannot be revoked; keep the TTL in minutes.

## Queue processors

*Applies when `project.md` lists a queue (BullMQ or equivalent).*

```ts
@Processor('thumbnails', { concurrency: 4 })
export class ThumbnailProcessor extends WorkerHost {
  async process(job: Job<{ jobId: string }>) {
    const record = await this.jobs.findById(job.data.jobId);
    if (!record || record.isCompleted()) return;      // at-least-once delivery → idempotent
    // ...
  }
}
```

- **Idempotency guard first.** Delivery is at-least-once; a processor without a durable
  "already done" marker will do the work twice.
- Enqueue from a use case that persists the job row **before** `queue.add`; if the add
  throws, mark the row failed so nothing is silently lost.
- Bound everything you buffer; stream large inputs to temp files and clean them up in a
  `finally`.
- If the owning row vanished mid-job, delete the artefact you just produced — nothing
  else knows its key.
- Throw to let the queue retry; mark terminal failure only when the attempt budget is
  spent.

## Scheduled tasks

*Applies when `project.md` lists crons.*

```ts
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handlePurge(): Promise<void> {
  try {
    await this.lock.runExclusive('purge', 30 * 60 * 1000, () => this.runPurge());
  } catch (error) {
    this.logger.error(`Purge failed: ${asMessage(error)}`);
  }
}
```

- The try/catch is **mandatory**: an unhandled rejection in a cron handler ends the
  process.
- More than one instance ⇒ a distributed lock with a TTL above the worst-case run.
- Work in bounded batches; never `SELECT` an unbounded set into memory.
- Read config through `ConfigService` with explicit coercion (`Number(...)` +
  `isFinite`) — a typed getter does not convert strings.

## Rate limiting

*Applies when the process is reachable from untrusted clients.*

- Limit what floods: writes, auth attempts, message sends. Exempt hot read paths
  deliberately, never anything that writes.
- Key the limit on the right identity. A connection is not a user: a per-connection limit
  is reset by reconnecting, so a rule about a *player*, an *account* or a *tenant* belongs
  in the use case that owns that concept.
- With more than one instance, the counter lives in shared storage; in-memory counters
  multiply the limit by the instance count.
- *When behind a proxy*: the trusted-hop setting must match reality, or every request
  looks like it comes from the proxy and the limit becomes global.
