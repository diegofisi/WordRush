# Testing

**Applies always.** The runner and the paths come from `project.md`; the shapes here are
the doctrine.

Unit tests live next to the code (`*.spec.ts`); integration and end-to-end tests live in
the project's test folder.

## Use-case unit test (canonical shape)

```ts
describe('CancelBookingUseCase', () => {
  let useCase: CancelBookingUseCase;
  let bookings: ReturnType<typeof createMockBookingRepository>;

  beforeEach(async () => {
    bookings = createMockBookingRepository();

    const module = await Test.createTestingModule({
      providers: [
        CancelBookingUseCase,
        { provide: BOOKING_REPOSITORY, useValue: bookings },
        { provide: CLOCK, useValue: { now: () => 1_700_000_000_000 } },
      ],
    }).compile();
    useCase = module.get(CancelBookingUseCase);
  });

  it('cancels a booking owned by the caller', async () => {
    bookings.findByIdAndOwner.mockResolvedValue(createTestBooking({ id, ownerId }));
    bookings.save.mockImplementation((b: Booking) => b);

    const result = await useCase.execute(id, ownerId);

    expect(bookings.findByIdAndOwner).toHaveBeenCalledWith(id, ownerId);
    expect(result.status).toBe(BookingStatus.CANCELLED);
  });

  it('is not found when the caller is not the owner', async () => {
    bookings.findByIdAndOwner.mockResolvedValue(null);
    await expect(useCase.execute(id, otherId)).rejects.toThrow(DomainNotFoundException);
  });
});
```

Every use-case spec covers the happy path, **the authorization failure**, and one case per
domain-exception branch.

Arrange / Act / Assert, in that order, with a blank line between them. The test name says
the behaviour (`'refuses a second solve from the same team'`), not the method.

## Helpers

- **Typed mock factories** — `createMock{X}Repository(): MockOf<I{X}Repository>`, where
  `MockOf<T>` requires *every* method of the interface. Adding a method to a repository
  interface then fails the typecheck until the factory is updated, which is the point: do
  it in the same change.
- **Test data factories** — `createTestBooking(overrides)` built with
  `Entity.reconstitute()` and `Partial<>` overrides. One per entity; extend the overrides
  when a field is added.
- **Fakes for side effects** — an in-memory implementation of each external interface
  (storage, clock, id generator, event bus). A fake with real behaviour catches more than
  a stub that returns `undefined`.
- Time and randomness are injected, so tests set them instead of waiting: a fake clock
  and fake timers, never a real `sleep` in a unit test.

## Domain tests

Entities and domain services get their own spec. Test invariants through the public
methods. When an invariant is deliberately tightened, update the spec's fixtures to the
new contract — never loosen the rule to keep an old test green. **Fix the implementation,
not the test.**

## What unit tests do not cover

Anything the mocks replace: transaction enlistment, advisory locks, raw SQL, real queue
delivery, actual socket transport, cross-process locks. If a change is in that list it
needs an integration test, a real run, or an explicit note saying how it was verified.

## Integration and e2e

*Applies when `project.md` lists an e2e suite.* It needs the real dependencies it names
(database, cache, object store) and a cleanup step between tests. A socket server is
tested with a real client connecting over a random port — that is the only way to catch
contract mistakes, ack shapes and disconnection handling.

## Rules

- No unit test reaches the network, the filesystem or a real external service.
- Do not assert on log output.
- A bug fix ships with the test that would have caught it, whenever the code is
  unit-testable. When it is not (raw SQL, transport), say in the change how it was
  verified instead.
- Never run a lint command with `--fix` to make a spec pass; it rewrites unrelated files.
