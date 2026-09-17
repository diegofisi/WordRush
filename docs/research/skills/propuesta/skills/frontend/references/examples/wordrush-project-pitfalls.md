# Example ledger: WordRush — frontend pitfalls

> Worked example of `project-pitfalls.md.template`, seeded from bugs this repo
> actually paid for (dates from the commits that fixed them, or from the review
> that caught them). Copy it to `references/project-pitfalls.md` in that repo,
> not here.
>
> **This file grows.** Every correction that has had to be made twice becomes one
> dated line. Read it before finishing any frontend change, together with
> `pitfalls.md`.

## Transport, contract and stores

- **2026-09-14** — The socket is imported **only** from `@/core/session/lib/socket`, and only by `api/` folders and `stores/`. A component that imports it re-subscribes on every mount.
- **2026-09-14** — Pushed events are store-driven: subscribe in the store's `bind()`, map the DTO there. Never turn `lobby:update`, `round:start`, `player:progress`, `player:solved`, `player:hint`, `player:left`, `time:penalty`, `reaction:show`, `round:end`, `game:end`, `chat:message`, `phrase:attempt`, `teammate:progress`, `team:hint` or `team:clocks` into an `api/` hook.
- **2026-09-14** — `bind()` is guarded by a **module-level** flag (`let bound = false`), because StrictMode double-invokes the bootstrap effect; without it every event is handled twice. The listeners are then never removed — these stores are app singletons and cleanup would drop events during navigation.
- **2026-09-14** — Rival DTOs carry **colours only**. If a `letters` field ever appears for another player, the mapper drops it: the word must not exist on a rival's client before `round:end`.
- **2026-09-14** — A DTO here is a **type alias onto `@/shared/contract`**. Do not invent fields. Changing an event means `CONTRACT_VERSION` + `pnpm sync-contract` + this client DTO in the same commit, and `pnpm check-contract` from the root is what proves it.
- **2026-09-14** — Clocks are derived from the server's last snapshot (`secondsLeft` + its timestamp); a `requestAnimationFrame` ticker only renders. **No `setTimeout` ends a round** — a backgrounded phone would end it at a different moment than the server.
- **2026-09-15** — The emote burst limit (more than 8 in 3 s pauses the player for 5 s) is enforced server-side; run the same rule in the store **before sending** and show the countdown on the picker trigger, so the UI never looks broken. The limit is per player, not per socket.
- **2026-09-15** — Stores rehydrate from each other by subscribing to `useSessionStore` outside React, never through a component effect.

## Rendering, focus and input

- **2026-09-14** — A dialog traps Tab. Without the trap, Tab walks into the board behind the overlay and the player types into invisible fields. (`dialog-focus-trap`)
- **2026-09-15** — `PhraseModal` focuses on **open and on cursor moves only**. `GameContainer` re-renders every tick of the clock; focusing on every render steals focus back from the Close and Send buttons while the player is reaching for them.
- **2026-09-15** — Never focus from an inline `ref` callback in that modal — React re-invokes it with `null` and the node on each re-render, so the field refocuses forever. Keep the stable `inputs.current[]` array and focus from the effect keyed to the cursor.
- **2026-09-15** — Key handlers inside `PhraseModal` call `stopPropagation()`; otherwise the game's global keyboard handler also receives the letter and it lands on the board as well.
- **2026-09-14** — A toast pauses while the pointer is on it: a player reading a message should not lose it to a timer. (`toast-pause-on-hover`)
- **2026-09-14** — A render error shows `CrashScreen` through the `ErrorBoundary` around `<App/>`, not a blank page.

## Styling and tokens

- **2026-09-15** — Tailwind v4 exposes `translate` as its **own property**: a `translate-x-*` utility is not a `transform`, so `transition-[transform]` animates nothing and the switch thumb jumps. Transition `translate`. (`the game switch animates its thumb`)
- **2026-09-15** — Colours come from the palette tokens in `src/index.css`. No hex at a call site, and **no `var(--x)` written into a `className`** — Tailwind emits only the classes it can see. (`the switch uses the palette token for dark text`)
- **2026-09-14** — `cn()` here is a four-line join, **not** `tailwind-merge`. Conflicting utilities are both emitted and the winner is stylesheet order, not argument order; write the conditional so only one of them is produced.
- **2026-09-14** — Safe-area insets are handled once in the layout, not with ad-hoc padding per screen. (`safe-area-insets`)

## Copy and accessibility

- **2026-09-14** — Every user-facing string comes from `shared/i18n/`. Spanish is the source and its shape is the `Dictionary` type, so a key missing from `en` is a typecheck failure — which is the only thing that catches it. Stores and handlers use `getT()`, components `useT()`.
- **2026-09-15** — The interface language is independent of the room's word language: a player may read the UI in English and play a Spanish room. Never derive one from the other.
- **2026-09-14** — Every revealed tile and every key carrying a state also gets an `aria-label` with that state: a screen reader never hears a CSS class. (`Board tiles and keyboard keys announce their state`)
- **2026-09-15** — The hint never appears on the board; it only lights its key (`key-hint`, dashed yellow). `index.css` also defines an unused `tile-hint` class — its presence is not permission to show the hint on the board.
- **2026-09-15** — Player-facing texts and public docs do not name the trademarked daily game.

## Slices

- **2026-09-14** — Cross-slice imports are limited to the facades in `project.md`: `@/core/session/stores/useSessionStore`, `@/core/session/lib/socket` (api and stores only), `@/shared/**`, and `@/features/chat` (`ChatContainer`, `useChatStore`). Nothing lints this here — `eslint-plugin-boundaries` is installed on the backend, not on the client.
- **2026-09-15** — Keyboard state derives from the player's own rows through `deriveKeyStates` in `features/game/helpers/keyboard.ts`, called from a `useMemo` in `GameContainer`. It is a pure function of `me.rows` + `me.hint`; do not persist it in the store.

## Tooling and workflow

- **2026-09-14** — The `PostToolUse` hook reformats every edited `.ts`/`.tsx`/`.css` with Prettier right after the write, so the file on disk is not byte-for-byte what was written. Re-read before a second edit that matches on exact text; an anchor string may have moved to another line.
- **2026-09-14** — `pnpm lint` must end at **0 errors and 0 warnings**; a new warning is a failure here, not a note.
- **2026-09-14** — Do not run `pnpm dev:backend` / `dev:frontend` in a session: they never exit.
- **2026-09-14** — No `Co-Authored-By` or any AI-attribution trailer in commits or PR descriptions. Check `git log -1 --format=%B` after committing and amend if one slipped in.
