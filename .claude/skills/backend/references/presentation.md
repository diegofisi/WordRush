# Presentation layer

## Controllers

Thin: decode the request, call one use case, wrap in `BaseResponse`.

```ts
@Controller('sharing')
export class SharingController {
  constructor(private readonly shareWithUserUseCase: ShareWithUserUseCase, ...) {}

  @Post(':fileNodeId/share')
  async shareWithUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileNodeId', new ParseUUIDPipe()) fileNodeId: string,
    @Body() dto: ShareWithUserDto,
  ) {
    const result = await this.shareWithUserUseCase.execute(fileNodeId, user.id, dto.email, dto.permission);
    return BaseResponse.ok(result);
  }
}
```

No business logic, no repository access, no try/catch (the filter maps
domain exceptions). `@HttpCode(HttpStatus.OK)` on POSTs that don't create.

## Guards & decorators

Global order: `JwtAuthGuard` → `RolesGuard` → `ThrottlerGuard`.

- Everything is authenticated by default. `@Public()` opts a handler out;
  use it only for auth callbacks, `/health` and public-link endpoints.
- `@Roles('admin')` + `@UseGuards(RolesGuard)` at controller level for admin.
- `@CurrentUser()` gives `{ id, email, name, role, planId, storageLimit }`.
- `@SkipThrottle()` for hot paths only; `@Throttle({...})` to tighten.
- `@Public()` endpoints: reduced DTO, still check `isTrashed`/`isHidden`,
  still use `pipeStreamToResponse`, consider **not** skipping throttling.

## Params

- UUID params: `@Param('id', new ParseUUIDPipe())`. A non-UUID is then a 400
  instead of reaching Postgres as a 500.
- `deviceId` and other client-generated ids: plain `@Param('deviceId')`,
  validated by length in the DTO that stored it.
- Query strings: a `@Query() dto: XQueryDto` class (validated), not bare
  `@Query('x')` — a missing bare query param becomes `undefined` and TypeORM
  **drops undefined `where` keys**, matching arbitrary rows.
- Multipart: `@UploadedFile()` + `@Body('field', new ParseUUIDPipe({ optional: true }))`
  for UUID fields (no DTO class for multipart, so no whitelist).
- Optional client headers: `@Headers('x-device-id') deviceId?: string`.

## Route ordering

Nest matches in declaration order. Literal segments **before** parameterised
ones: `@Get('list-for-drive')`, `@Get('smart')`, `@Get('smart/:type')` and
only then `@Get(':id')`. A controller ending in `@Delete(':id')` with
`ParseUUIDPipe` turns any later literal DELETE into a 400.

Two controllers share the `files` prefix; never add `@Post(':id/:action')`
patterns there.

## Streaming responses

```ts
const result = await this.streamFileUseCase.execute(id, user.id, range);
res.set({
  'Content-Type': result.mimeType,
  'Accept-Ranges': 'bytes',
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': `${inlineSafe ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
});
if (range) { res.status(206); res.set({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(length) }); }
pipeStreamToResponse(result.stream, res);   // destroys the MinIO stream on client abort
```

- Parse both `bytes=start-[end]` and the suffix form `bytes=-N`.
- The use case clamps `end` to `size-1`, rejects `start >= size` /
  `end < start` with `DomainRangeNotSatisfiableException` (416). Never echo
  the client's `end` into `Content-Length`.
- `filename*=UTF-8''…` (RFC 6266), not `filename="…"` with percent-encoding.
- `inline` only for `image/*` (not SVG), `video/*`, `audio/*`; everything else
  `attachment`.
- **Always** `pipeStreamToResponse`; a raw `stream.pipe(res)` leaks a MinIO
  socket per aborted download.

## Response shapes

- Single: `BaseResponse.ok(dto)` → `{ success, data: {...} }`.
- List: `BaseResponse.ok({ items, total, limit, offset })`.
- Empty success: `BaseResponse.ok(null, 'Done')`.
- Errors: thrown, never returned.

## Things that are NOT endpoints here

`notifications` has no controller (push is outbound only). Clients that
need in-app notifications need a new module with a real `controllers: []`
array — check `app.module.ts` wiring and add the DTOs/use cases like any
other feature; don't bolt a controller onto the FCM service.
