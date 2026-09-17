# Pitfalls — universal frontend traps

> **Applies:** always. Read it before finishing any change, together with
> `project-pitfalls.md` if the repo has one.
>
> Every entry is a bug someone already paid for, in more than one codebase.
> Nothing here is repo-specific: repo-specific traps go in
> `project-pitfalls.md`, not in this file.

## Boundaries

1. **A DTO never reaches a component.** The mapper is the wall. The symptom is a
   component reading `card_guid` or a nullable field the model already cleaned;
   the cause is a hook that returned the raw payload because "it was already the
   right shape". It stops being the right shape the day the backend adds a field.
2. **No cross-feature imports except the sanctioned facades.** Deep paths into
   another slice (`@/features/x/stores/...`) are always wrong, even into a facade
   feature. If two features need the same data, each owns a minimal local
   adapter. Nothing lints this in most repos — it is on the reviewer.
3. **The transport client is imported only by `api/` and `stores/`.** A socket,
   an axios instance or an SDK imported from a component is a boundary breach
   that turns into a rendering bug the first time the component remounts.
4. **A container that grew a `useMemo`, a `useEffect` or a multi-step handler is
   a hook that has not been extracted yet.** Containers wire; hooks think.
5. **Do not invent backend fields.** If the repo has a typed, synced contract,
   DTOs alias onto it. A hand-written "obvious" field is a runtime `undefined`.

## Stores and subscriptions

6. **Bind subscriptions once, behind a module-level flag.** React StrictMode
   invokes effects twice in development: without the flag every push event is
   handled twice, and the bug only shows as doubled counters or doubled toasts.
   The flag lives at module scope, not in store state, so a `reset()` cannot
   re-subscribe.
7. **App-singleton listeners are not removed on unmount.** If the store must keep
   receiving events across navigation, cleaning up in an effect silently drops
   events while the user is on another screen. Decide which stores are singletons,
   write it down, and be consistent.
8. **Never let a local timer end a server-owned process.** No `setTimeout` that
   ends a round, expires a session, or fails a job. Backgrounded tabs throttle
   timers, phones suspend them, and clocks skew: the two sides then disagree
   about reality. Keep the server's last snapshot plus its timestamp and derive
   the display; wait for the server's event to change state.
9. **Stores do not import React.** A store that imports a hook cannot be used
   from a listener or an interceptor, which is exactly where it is needed.
10. **Subscribe narrowly.** A component selecting the whole store re-renders on
    every unrelated change; at 60 updates a second that is a frozen UI.
11. **Wrap every `localStorage` access in try/catch** and provide a default.
    Private mode and blocked site data throw on access, not on write.

## Effects and rendering

12. **An effect with a missing or unstable dependency re-runs every render.**
    The classic forms: an object or array literal in the deps, a function
    recreated each render, or a `setState` that feeds its own dependency. Enable
    `react-hooks/exhaustive-deps`, and never silence it without a written reason.
13. **Derived state does not belong in an effect.** Compute during render, or
    `useMemo` when it is expensive. An effect adds a render, and the two values
    desync on the frame in between.
14. **Do not animate from an effect.** Toggling a class after mount forces an
    extra commit and repaint, and on lists it thrashes layout. Use CSS
    transitions, `@starting-style`, or view transitions.
15. **Transition the property that actually animates.** Modern CSS — and Tailwind
    v4 — expose `translate`, `scale` and `rotate` as independent properties, so a
    `translate-x-*` utility is **not** a `transform`: `transition-[transform]`
    animates nothing and the element jumps. Transition `translate` (or use the
    kit's own transition helper).
16. **Never build a class name with a runtime value in a utility-CSS project.**
    `className={`text-[${color}]`}` produces no CSS: the compiler only emits what
    it can see in the source. The same applies to writing `var(--x)` into a class
    attribute. Map the value to a fixed class or a token.
17. **A class-merge helper that is only a string join does not resolve
    conflicts.** `cn("p-2", "p-4")` emits both, and which wins is source order in
    the generated stylesheet, not argument order. Know which helper the repo has
    before relying on "the last one wins".

## Focus, dialogs and input

18. **A modal must not steal focus on every render.** Focus on *open*, and after
    that only when the thing that should have focus actually moves. An effect
    that focuses on each render will yank focus off the Close and Submit buttons
    every time a parent re-renders — and a parent that renders a clock re-renders
    every second.
19. **Never focus from an inline `ref` callback.** React calls ref callbacks with
    `null` and then the node again on every re-render when the callback identity
    changes, so the element refocuses constantly. Keep a stable `useRef` array or
    a `useCallback` ref, and focus from an effect keyed to the cursor.
20. **A dialog traps Tab.** Without a focus trap, Tab walks into the page behind
    the overlay and the user is typing into invisible fields. Also: Escape
    closes, focus returns to the trigger, and the dialog is labelled.
21. **Key handlers inside a dialog stop propagation.** Otherwise the app-level
    keyboard handler behind it also receives the keystroke, and the user's letter
    lands in two places.
22. **Interactive elements are `<button type="button">`** unless they submit.
    A bare `<button>` inside a form submits it; a `<div onClick>` is invisible to
    the keyboard.

## Data, lists, async

23. **A failed refetch must never wipe good data.** Write to the mirroring state
    only on success, and keep the previous result while the new one loads.
24. **Keys are stable identities, not indexes.** An index key on a reorderable or
    filterable list keeps the state of the wrong row — including focus and input
    values.
25. **Guard against stale async results.** When a request can be superseded
    (fast pause→resume, a changed filter), tag the run and ignore settlements
    from an old one. A cache library does this for queries; it does not do it for
    imperative calls or store schedulers.
26. **One in-flight refresh, not one per caller.** Concurrent failures need a
    module-level shared promise, or you fire N refreshes and rate-limit yourself.
27. **Disable submit while a write is in flight.** Otherwise a double click
    creates two records.

## Copy, tokens, accessibility

28. **In a project with an i18n layer, no user-facing string is typed inline** —
    not in JSX, not in a mapper, not as a `"Loading…"` fallback. The source
    dictionary's shape is the type the other dictionaries must satisfy, so a
    missing key is a typecheck failure and not a blank label in production.
29. **No colour, spacing or font-size literal at a call site.** It forks from the
    design system the moment the tokens change.
30. **Colour alone communicates nothing** to a screen reader or to a
    colour-blind user. Every state carried by colour also carries text: an
    `aria-label`, `aria-pressed`, `role="status"`, or visible copy.
31. **Respect `prefers-reduced-motion`** on every transition you add.
32. **Handle the phone's safe areas once, in the shell** — not with ad-hoc
    padding per screen, which drifts.

## Process

33. **The formatter runs after you write.** If a format-on-write hook is
    installed, the file on disk is not byte-for-byte what you wrote: re-read
    before a second edit that matches on exact text, and never assume an anchor
    string survived reformatting.
34. **Verification is a command, not a feeling.** Run the repo's `verify`
    script before saying a change is done, and read the failure rather than
    re-running it.
35. **A repeated correction becomes a line in `project-pitfalls.md`.** If the
    same mistake has now been corrected twice, the fix is not remembering harder;
    it is writing it down where the next session reads it.
