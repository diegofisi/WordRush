# Testing

Unit tests live next to the code (`*.spec.ts`, `rootDir: src`); e2e tests in
`test/*.e2e-spec.ts`. ~480 unit tests run in ~40s with `npx jest`.

## Use-case unit test (canonical shape)

```ts
describe('ShareWithUserUseCase', () => {
  let useCase: ShareWithUserUseCase;
  let sharedAccessRepository: ReturnType<typeof createMockSharedAccessRepository>;
  let fileNodeRepository: ReturnType<typeof createMockFileNodeRepository>;

  beforeEach(async () => {
    sharedAccessRepository = createMockSharedAccessRepository();
    fileNodeRepository = createMockFileNodeRepository();

    const module = await Test.createTestingModule({
      providers: [
        ShareWithUserUseCase,
        { provide: SHARED_ACCESS_REPOSITORY, useValue: sharedAccessRepository },
        { provide: FILE_NODE_REPOSITORY, useValue: fileNodeRepository },
        { provide: LogActivityService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    useCase = module.get(ShareWithUserUseCase);
  });

  it('shares by email', async () => {
    fileNodeRepository.findByIdAndOwner.mockResolvedValue(createTestFileNode({ id: fileNodeId, ownerId }));
    sharedAccessRepository.findByFileAndUser.mockResolvedValue(null);
    sharedAccessRepository.save.mockImplementation((a: SharedAccess) => a);

    const result = await useCase.execute(fileNodeId, ownerId, email, SharePermission.VIEWER);

    expect(fileNodeRepository.findByIdAndOwner).toHaveBeenCalledWith(fileNodeId, ownerId);
    expect(result.permission).toBe(SharePermission.VIEWER);
  });

  it('404s when not owner', async () => {
    fileNodeRepository.findByIdAndOwner.mockResolvedValue(null);
    await expect(useCase.execute(...)).rejects.toThrow(DomainNotFoundException);
  });
});
```

Every use case test covers: the happy path, **the authorization failure**
(not owner → 404), and each domain-exception branch.

## Helpers (`test/helpers/`)

- `mock-repository.factory.ts` — `createMock{X}Repository(): MockOf<I{X}Repository>`.
  `MockOf<T>` requires **every** interface method, so adding a method to a
  repository interface fails `tsc` until you add `method: jest.fn()` here.
  That is intentional: do it in the same change.
- `test-data.factory.ts` — `createTestUser`, `createTestFileNode`,
  `createTestFolder`, `createTestSharedAccess`, … built with
  `Entity.reconstitute()` and `Partial<>` overrides. Add a factory for each
  new entity; extend overrides when adding columns.
- `mock-storage.provider.ts` — in-memory `IStorageProvider`.
- Services with side effects (`StorageQuotaService`, `ProcessMediaUseCase`,
  `PushNotificationService`, queues via `getQueueToken('name')`) are provided
  with `useValue` stubs; for `StorageQuotaService` stub
  `commitWithinQuota: (o, l, b, commit) => commit()`.

## Domain tests

Entities and domain services get their own spec (`file-node.entity.spec.ts`,
`chunked-upload.entity.spec.ts`, `permission-checker.service.spec.ts`). Test
invariants through the public methods; when you tighten an invariant
(exact chunk sizes), update the spec's fixtures to the new contract rather
than loosening the rule.

## What is NOT covered by unit tests — and needs e2e or a real DB

Advisory locks, `TransactionContext` enlistment, raw SQL (`countStorageUsed`,
recursive CTEs, `findReferencedStoragePaths`), Redis throttler storage, cron
locks, MinIO bucket routing. Unit tests mock all of it. If your change is in
that list, run e2e.

## e2e

`pnpm test:e2e` (`test/jest-e2e.json`, `--runInBand`, 30s timeout).
Needs **real** Postgres, Redis and MinIO reachable with the defaults in
`test/setup-env.ts` (the test DB, if any, is created by `global-setup.ts`).
Uses `docker-compose.yaml` services. Suites: app, auth, admin, files,
folders, search, sharing, trash. `db-cleanup.helper.ts` truncates between
tests; `auth.helper.ts` mints JWTs.

## Rules

- No test may hit the network or the real MinIO from a unit spec.
- Don't assert on log output.
- A bug fix comes with the test that would have caught it when the code is
  unit-testable (entities, use cases). Repository/SQL fixes are verified by
  e2e or a manual run, and the PR says which.
- Never run `pnpm lint` to "fix" a spec — it rewrites unrelated files.
