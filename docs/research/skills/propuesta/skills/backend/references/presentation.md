# Presentation layer

**Applies when the module has a transport of its own.** Read the HTTP part when
`project.md` lists controllers, the WebSocket part when it lists gateways. Modules with
neither have no `presentation/` folder.

The rule both halves share: a handler **decodes the request, calls one use case, and
returns its result**. No rules, no repository access, no store access, no timers, no
try/catch that swallows (the exception filter maps domain exceptions).

---

## HTTP controllers

*Applies when `project.md` lists HTTP endpoints.*

```ts
@Controller('bookings')
export class BookingsController {
  constructor(private readonly cancelBooking: CancelBookingUseCase) {}

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.cancelBooking.execute(id, user.id);
  }
}
```

`@HttpCode(HttpStatus.OK)` on POSTs that do not create. *If the project uses a response
envelope* (`project.md` says so), wrap the result in it here and nowhere else.

### Guards and decorators

*Applies when the project has authentication.*

- Everything is authenticated by default; an explicit `@Public()` opts a handler out —
  use it only for callbacks, health checks and genuinely public resources.
- Role checks are a guard at the controller level; the use case still receives the
  actor's id for the audit trail.
- A `@Public()` endpoint returns a reduced DTO and keeps its own rate limit. It is
  reachable without an account, so a leak there is also a denial-of-service vector.

### Params

- UUID params: `@Param('id', new ParseUUIDPipe())`, so a malformed id is a 400 instead of
  a driver error at 500. Only for params that really are UUIDs.
- Query strings: a validated `@Query() dto: XQueryDto` class, not bare `@Query('x')`. A
  missing bare param is `undefined`, and an ORM typically **drops undefined keys from a
  `where`**, matching arbitrary rows.
- Multipart: there is no DTO whitelist, so validate each field with an explicit pipe.
- Optional client headers are read with `@Headers('x-...')` and validated like any input.

### Route ordering

Nest matches in declaration order: literal segments **before** parameterised ones
(`@Get('search')`, then `@Get(':id')`). A `@Get(':id')` with `ParseUUIDPipe` declared
first turns every later literal route into a 400.

### Streaming responses

*Applies when the project serves files or large payloads.*

- Parse both `bytes=start-end` and the suffix form `bytes=-N`; the **use case** clamps
  `end` to `size-1` and rejects impossible ranges with the 416 domain exception. Never
  echo the client's `end` into `Content-Length`.
- `Content-Disposition: ...; filename*=UTF-8''<encoded>` (RFC 6266). `inline` only for
  media types you are sure are safe to render; everything else `attachment`, with
  `X-Content-Type-Options: nosniff`.
- Pipe through a helper that destroys the upstream stream when the client aborts; a bare
  `stream.pipe(res)` leaks one connection per abandoned download.

---

## WebSocket gateways

*Applies when `project.md` lists a gateway (`@nestjs/websockets`).*

```ts
@WebSocketGateway({ cors: /* from config */ })
export class GameGateway {
  constructor(private readonly submitGuess: SubmitGuessUseCase) {}

  @SubscribeMessage('game:guess')
  async onGuess(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: GuessDto,
  ): Promise<GuessAck> {
    return this.submitGuess.execute(/* ... */);
  }
}
```

- **Payloads are validated like HTTP bodies.** A `ValidationPipe` with
  `whitelist + forbidNonWhitelisted` is applied to the gateway (globally or with
  `@UsePipes`); every event has a DTO class. Unvalidated socket input is the most common
  way rules get bypassed.
- **Every client→server event answers.** Decide once — ack callback or error event — and
  keep it: a handler that can fail silently is a client stuck waiting.
- **Errors**: a `WsExceptionFilter` maps domain exceptions to the contract's error shape
  (`{ code, message }`). Never `try/catch` and swallow inside a handler.
- **Server→client events are published by use cases**, typically on an event bus owned by
  the shared kernel, with the gateway as the bus's only subscriber. A use case that emits
  through the socket server directly makes the rules untestable without a socket.
- **Per-recipient payloads**: when each client must see a different slice of the same
  state (their own hand, their own board), the event carries an addressee and one
  presenter builds each slice. Never broadcast the full state and let clients filter —
  whatever is on the wire is public.
- **No timers in the gateway.** Countdowns, tick loops and between-step schedulers live in
  the owning module; the gateway forwards snapshots.
- **Rate limit floodable events** per connection. Limits that are about a *person* (a
  burst limit, a cooldown) are keyed on the domain id in the use case — reconnecting must
  not reset them.
- **Connection lifecycle**: `handleConnection` / `handleDisconnect` map a socket to a
  domain identity and back, and nothing else. Reconnection, presence and grace periods are
  rules, so they live in a use case.
- *When a typed contract file owns the event names and payloads*: it is the single source
  of truth. Adding or renaming an event means editing the contract, bumping its version,
  re-syncing the client copy and changing the client DTO **in the same commit**. Do not
  restate the event table in prose anywhere — a prose copy of a typed source drifts on the
  first change.

---

## Things that are not endpoints

A module can be pure rules (scoring, validation, word lists) with no `presentation/` at
all. Do not add a controller or a gateway handler "for symmetry": each entry point is
public surface that has to be validated, rate limited and kept in the contract.
