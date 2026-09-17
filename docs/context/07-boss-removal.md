# 07 · Boss mode — how to remove it

Status: **temporary feature, integrated on 2026-09-17**, kept only while the owner
decides whether it stays. This file exists so that decision costs ten minutes either way.

Everything about *what* the fly is and *why* her numbers are what they are lives in
`08-boss-mode.md` and `09-what-the-fly-can-do.md`. This file is only the removal recipe.

---

## 1. What boss mode is, in one paragraph

A room can play **against one opponent instead of against each other**: a fly that plays
the same word under the same rules, whose moves come out of a simulated FlyWire
connectome (138,639 neurons, 2,700,513 synapses) running on worker threads. The attack is
inverted — a human solve takes 8 s off her and nothing off a teammate; her solve takes 5 s
off every human who has not solved. The team wins the round if she does not solve it, and
every human seated when she falls takes a flat **+25**. She sits in the normal scoring
table (she plays on the room's clock), but she is never charged per attempt and never
collects the team bonus.

## 2. How to reach it in the interface

1. On the home page, next to the **Palabra / Adivina la frase** switch there is a third,
   secondary button: **"Retar a la mosca (modo antiguo)" / "Challenge the fly (legacy
   mode)"**. It only appears when `VITE_BOSS_ENABLED` is not `false`.
2. Pressing it forces the only shape she can play — five letters, word race, no teams —
   and sends `settings.bossMode: true` with `room:create`.
3. The lobby then shows her as an extra card beside the human slots ("vs la mosca"), and
   a single human may press **Empezar**.
4. During the round her clock is a health bar in the side panel (phone: a compact row),
   with a link that opens **her brain** on `/brain/:code` in a second tab.
5. The round summary says whether the team beat her, lists the words she played, and shows
   the +25 on every human's row.

## 3. What it needs to run

| Thing | Where | What happens without it |
|---|---|---|
| `backend/src/modules/boss/data/*.gz` (~7 MB) and `readout.json` | committed | She never moves; one `warn` per process: *"The brain did not answer; the fly will not move until it does"*. |
| The compiled `brain.worker.js` | `nest build` output | Same, plus *"Brain worker not found; the fly will not move"*. **After switching branches, rebuild**: `dist/` keeps the old assets. |
| Worker threads + ~90 MB of RAM per thread | Node 22 | The brain boots lazily, only once a boss room is actually playing, so a server nobody plays boss mode on holds none of it. |
| `three` / `@types/three` | `frontend/package.json` | The brain tab does not render. It is a lazy chunk (`BossInstrument`), so the main bundle does not carry it. |
| `frontend/public/models/fly/shy-fly.glb` | committed, CC-BY 3.0 | The 3-D fly is missing from the brain tab; the rest of the page still works. |

The degradation is always the same shape: **the fly stands still and says so in the log,
and nothing else in the game is affected.** Her ticker catches every throw, her turn never
blocks a socket handler, and no code path in `rooms`, `game` or `gateway` calls into her.

## 4. The flags

| Flag | Default | Effect when off |
|---|---|---|
| `BOSS_MODE_ENABLED` (backend) | `true` | `BossModule` registers **no providers at all**: no threads, no ticker, no `boss:watch` handler. `syncBossSeat` refuses the seat and clears `settings.bossMode`, so a client that asks for boss mode gets an ordinary room. |
| `VITE_BOSS_ENABLED` (frontend) | `true` | The home option is not rendered, `/brain/:code` is not registered, no panel is mounted and nothing is ever sent on `boss:watch`. |

Turning both off is the safe way to hide the feature without touching code.

## 5. Removing it for good

Every line of boss code outside the two boss folders carries the comment

```
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
```

Longer blocks are fenced with `— start.` / `— end.`. To find them all:

```
grep -rn "BOSS-MODE" backend/src frontend/src backend/nest-cli.json backend/.env.example frontend/.env.example
```

### 5.1 Delete these, whole

```
backend/src/modules/boss/                     (module, brain, data, ~7 MB)
backend/src/modules/game/domain/interfaces/round-bookkeeping.interface.ts
backend/src/modules/game/application/services/hint-port.adapter.ts
backend/src/modules/boss/presentation/boss.gateway.ts   (inside the folder above)
backend/test/boss-mode.spec.ts
backend/tools/boss-brain-control.spec.ts
backend/tools/boss-control.worker.js
backend/tools/train-boss-readout.spec.ts
backend/tools/train-collect.worker.js
frontend/src/features/boss/
frontend/public/models/fly/
scripts/build-boss-cloud.mjs
docs/context/07-boss-removal.md   (this file)
docs/context/08-boss-mode.md
docs/context/09-what-the-fly-can-do.md
```

### 5.2 Then remove the marked blocks, in this order

**Backend**

1. `src/app.module.ts` — the `BossModule` import and its entry in `imports`.
2. `src/modules/game/game.module.ts` — the `HintPortAdapter`, `ROUND_BOOKKEEPING` and
   `HINT_PORT` providers and the two exports.
3. `src/modules/game/application/services/round-lifecycle.service.ts` — the whole
   `if (room.settings.bossMode === true) { … }` branch in `announceSolve`, and `BOSS`
   from the contract import.
4. `src/modules/game/application/use-cases/end-round.use-case.ts` — the `bot` /
   `bossDefeated` / `teamBonus` block, the two trailing arguments to `scoreRound`, the
   `bossDefeated` and `boss` fields of the payload, and `BOSS` from the import.
5. `src/modules/game/application/use-cases/start-game.use-case.ts` — the `minimum`
   line goes back to `ROOM_LIMITS.minPlayers`.
6. `src/modules/game/domain/services/scoring.ts` — the two optional parameters of
   `scoreRound`, the `bossBonus` field and the three places it is added.
7. `src/modules/rooms/domain/entities/player.entity.ts` — `isBot` (prop, field,
   constructor, `toPublic`).
8. `src/modules/rooms/domain/entities/room.entity.ts` — `humanPlayers()`, `bot`, and
   the `!p.isBot` filters in `connectedPlayers`, `isFull`, `isEmpty`, `addPlayer`,
   `removePlayer` and `lastDisconnectionAt` (each one says what it used to be).
9. `src/modules/rooms/application/use-cases/create-room.use-case.ts` and
   `update-room-settings.use-case.ts` — the `syncBossSeat` import and call; in the
   latter, `humanPlayers()` goes back to `players`.
10. `src/modules/rooms/application/dtos/room-settings.dto.ts` — the `bossMode` field.
11. `src/modules/rooms/domain/services/state-presenter.ts` — `toBossState` and the
    `boss:` line in `toRoundState`.
12. `src/modules/words/domain/interfaces/word-list.interface.ts` and
    `infrastructure/repositories/json-word-list.repository.ts` — `guessable`.
13. The two spec stubs that implement `IWordList`
    (`submit-guess.use-case.spec.ts`, `random-word.picker.spec.ts`).
14. `nest-cli.json` — the two `modules/boss/data` asset entries.
15. `.env.example` — the fenced BOSS-MODE section.
16. `src/shared/contract/index.ts` — the whole block between the two banners, plus the
    five optional fields (`RoomSettings.bossMode`, `PlayerPublic.isBot`,
    `RoundState.boss`, `RoundEndPayload.bossDefeated`/`boss`,
    `RoundBreakdown.bossBonus`) and the three events (`boss:watch`, `boss:decision`,
    `boss:frame`). Bump `CONTRACT_VERSION` and run `node scripts/sync-contract.mjs`.

**Frontend** (the contract copy is regenerated by the command above, never edited)

17. `src/App.tsx` — the three marked blocks; `Bootstrap` loses `useLocation`, `viewer`
    and the `if (viewer) return;`, and `useSessionBootstrap()` takes no argument again.
18. `src/core/session/hooks/useSessionBootstrap.ts` — the `skip` parameter, the
    `skip ||` and the dependency.
19. `src/shared/routes/paths.ts` — `brain`, `brainPath`, `isBrainPath`.
20. `src/features/lobby/pages/HomePage.tsx` — the two imports, the `bossMode` state with
    `pickGame`/`pickBoss` (`onChange={setGame}` goes back on the switch), the option in
    the top bar and the `bossMode` prop.
21. `src/features/lobby/containers/HomeContainer.tsx` — the prop, the default value and
    the forcing effect.
22. `src/features/lobby/api/create-room/create-room.dto.ts` — the field and the mapping.
23. `src/features/lobby/models/lobby.model.ts` — `isBot` and the four `humans` counts
    (each says it was `players`).
24. `src/features/lobby/components/PlayerSlots.tsx` — `humans`/`boss` and her card.
25. `src/features/lobby/containers/LobbyContainer.tsx` — `minPlayers` back to
    `ROOM_LIMITS.minPlayers`.
26. `src/features/game/stores/useGameStore.ts` — `boss`/`bossFrame` in the state, the
    initial state, `applyRound`, the snapshot reset, `onProgress`, `player:solved`, the
    two `socket.on('boss:…')` handlers and the `time:penalty` block.
27. `src/features/game/containers/GameContainer.tsx` — the two selectors, the rivals
    filter and its dependency, `bossView` and `useBossBroadcast`, and `boss:` in `view`.
28. `src/features/game/models/game-view.model.ts` — the import and the `boss` prop.
29. `src/features/game/components/GameDesktop.tsx` / `GameMobile.tsx` — the import and
    the `<BossPanel …>`.
30. `src/features/results/models/results.model.ts` — `BossSummary`, the three fields and
    the three mappings.
31. `src/features/results/components/RoundHeader.tsx` — the banner and the two notes.
32. `src/features/results/containers/ResultsContainer.tsx` — the import and `<BossRows>`.
33. `src/shared/i18n/es.ts` and `en.ts` — the single `boss: { … }` group between the
    banners, and `BossAction` from the Spanish import.
34. `src/vite-env.d.ts` and `.env.example` — `VITE_BOSS_ENABLED`.
35. `package.json` — `three` and `@types/three`; then `pnpm install`.

### 5.3 Check

```
cd backend  && npx tsc --noEmit -p tsconfig.json && pnpm lint:check && pnpm test && pnpm build
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx eslint . && pnpm test && pnpm build
node scripts/sync-contract.mjs --check
grep -rn "BOSS-MODE\|bossMode\|isBot" backend/src frontend/src   # must come back empty
```

Finally, drop this file, `08-boss-mode.md` and `09-what-the-fly-can-do.md` from
`docs/context/README.md`, from `CLAUDE.md`'s source-of-truth list and the 2026-09-17 row
from `04-decisions-and-pending.md`.
