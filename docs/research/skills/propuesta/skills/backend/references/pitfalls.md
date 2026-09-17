# Pitfalls — universal rules

**Applies always.** Read before finishing any change.

Every rule here was paid for by a real defect in a real NestJS service, and every one is
true of *any* Clean Architecture backend. Repository-specific rules do not belong in this
file — they go in `project-pitfalls.md`, dated.

The recurring shape of these bugs: **one path did it right and its sibling did not.**
When you fix something, grep for the other callers of the same idea.

## Authorization

1. **Authorize first, and by scoping the query.** `findByIdAndOwner(id, actorId)` → not
   found. "Load, then compare the owner field" leaks existence and is forgotten in the
   second code path.
2. **Not found beats forbidden** for resources the caller cannot see; a 403 tells an
   attacker the id is real.
3. **A multi-step flow authorizes identically at every step.** A permissive check at step
   one and a stricter one at completion locks legitimate callers out halfway through, with
   state already written.
4. **Bulk endpoints authorize per item**, not once for the batch.

## Correctness of state

5. **Reads must not write.** A read path that calls a mutator bumps `updatedAt` and
   republishes the aggregate to everything that keys on it (sync, caches, subscribers),
   and can revert a concurrent edit. Use a targeted update when a read really must record
   something.
6. **One operation, one clock read.** Take `now` once in the use case and pass it down, or
   two entities in the same operation disagree about when it happened.
7. **A thing is charged once.** Whenever something can be counted twice (a bonus, a
   credit, a notification), the ledger of what has already been counted lives on the
   aggregate that owns it — never on the connection, the request or the transport object.
8. **Operations that must be atomic run without an `await` in the middle.** In a
   single-process store, the read-modify-write section must be synchronous; two callers
   that interleave both read "first" and both win.
9. **Filters before pagination.** Applying a visibility filter after `take/skip` returns
   short pages and a wrong total.
10. **Deterministic ordering.** Every ordered query gets a tie-breaker on the id, or rows
    swap between pages.

## Concurrency and idempotency

11. **Check-then-write races.** Any limit (quota, capacity, stock, seats) is enforced by a
    guarded commit: lock the contended key, re-read inside the lock, write. A pre-check
    alone lets N parallel callers all pass.
12. **At-least-once means idempotent.** Queue handlers, webhooks and retried client calls
    need a durable "already done" marker checked before doing the work.
13. **A retry must not double the side effect.** If the work is not idempotent, make the
    marker part of the same transaction as the work.
14. **Scheduled work needs a lock when more than one instance runs it**, with a TTL above
    the worst-case run time.

## Transactions and external systems

15. **External systems are not transactional.** Do their work before the transaction and
    compensate on failure, or after the commit and accept a retry. Never hold a
    transaction open across a network call.
16. **Side effects that must survive a rollback go outside the transaction.** A revocation
    performed inside a failed transaction is undone with it.
17. **Rows first, external objects second.** An orphan object is recoverable; a row
    pointing at a deleted object is not.

## Deleting shared resources

18. **Dedupe before deleting.** When several records can reference the same underlying
    resource (a deduplicated file, a shared key, a cached artefact), check for other
    references before deleting it. Missing this destroys a live record's data.
19. **Delete through the same component that created it.** When resources live in more
    than one store or bucket, deleting through the wrong one is a silent no-op that leaks
    forever. Collect the paths per store.
20. **Grace periods are checked at the point of deletion**, not only in the UI that offers
    it: the permanent-delete endpoint verifies the record really is in the state that
    permits it.
21. **An artefact whose owner vanished mid-job is deleted right there** — nothing else
    knows its key.

## Errors and logging

22. **Never swallow an exception.** `.catch(() => {})` hides constraint violations and
    mapping bugs; use a helper that logs and moves on, and only where losing the result
    really is acceptable.
23. **A raw `throw new Error()` in a use case or repository becomes a 500.** Throw a
    domain exception with a message the caller can act on; reserve raw errors for
    programmer mistakes.
24. **Infrastructure error text never reaches the client.** Surface the domain message;
    log the rest.
25. **Do not assert on log output** and do not make logs part of a contract.
26. **Never log or emit a secret**, and never log data the protocol says the recipient
    must not have yet.

## Boundaries

27. **No import from another module's `infrastructure/` or `application/`.** Cross a
    module boundary through a repository interface (by Symbol) or a sanctioned exported
    service, listed in `project.md`.
28. **The domain layer imports no framework.** A decorator or a driver type in `domain/`
    means the rule has escaped into the infrastructure.
29. **A rule that ends up in a mapper, a controller or a gateway is invisible to the
    tests** that cover the domain. Push it back down.
30. **Do not restate a typed source of truth in prose.** A hand-copied table of events,
    routes or columns drifts on the first change; point at the type instead.

## Input and transport

31. **Every payload has a validated DTO**, sockets included. Unvalidated input is how
    rules get bypassed.
32. **Bound every array and string** in an input; unbounded ones are denial-of-service
    knobs.
33. **A missing query parameter is `undefined`,** which some ORMs drop from a `where`,
    matching arbitrary rows. Validate query objects as a class.
34. **A connection is not a user.** Limits and cooldowns that describe a person are keyed
    on the domain id, or reconnecting resets them.
35. **What is on the wire is public.** Filtering in the client is not a rule; send each
    recipient only the slice they are allowed to see.

## Configuration and process

36. **Typed config getters do not coerce.** Read the value and convert it explicitly, with
    a sane fallback.
37. **No default credentials in code.** A missing required secret fails at boot, loudly.
38. **An unhandled rejection in a background handler ends the process.** Cron handlers,
    event-bus subscribers and detached promises get their own try/catch.
39. **In-memory state needs a ceiling and an eviction path**, or a burst ends in an
    out-of-memory restart.
40. **A new environment variable is added in three places at once**: the parser with its
    default, the example env file, and the documentation table.

## Process hygiene

41. **Never loosen a lint, type or test config to make a check pass.** Fix the code.
42. **Adding a method to a repository interface means updating its mock factory** in the
    same change.
43. **Run the verification commands one per invocation.** Chaining them with `;` reports
    success when an earlier one failed.
44. **Report only checks you actually ran**, and name the command that failed.
