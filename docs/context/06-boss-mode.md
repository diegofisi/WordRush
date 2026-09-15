# 06 · Boss mode — the fly

Status: **implemented on 2026-09-13** (backend module `boss`, frontend boss panel). Everything here is a design
The plain multiplayer game (`02-game-rules.md`) is unaffected and stays the default
mode; boss mode is a room setting, off by default.

## The idea
The room stops being everybody against everybody and becomes **the room against one
opponent**: a fly that plays the same word, under the same rules, with a brain that is
actually simulated. From 1 to 8 humans can take her on. She is the boss, so beating her
is the point of the round.

There is exactly one fly. No difficulty selector: she is a single trained checkpoint,
identified by her vocabulary and her training generation. Calibration is the target of
the training, not a knob the host turns.

## What stays the same as the normal game
- Same 5-letter word for everybody, the fly included.
- 8 attempts per player. Same colours. Same rule that a letter is paid only once per position.
- Time from letters for the humans, at the same rates: +10 for a new green, +5 for a new
  yellow, +5 more when a paid yellow turns green. Maximum 50 s per round. **The fly is the
  exception: see "The boss does not heal" below.**
- One hint per player per round, and the fly gets one too.
- The server is the only owner of the word, the clocks and the score. The fly never sees
  the word; she only receives her own colours, like everyone else.

## What changes

### The attack is inverted
This is the whole mode in one line.

| Event | Normal game | Boss mode |
|---|---|---|
| A human solves | every player who has not solved loses 5 s | **the fly loses 5 s.** No human loses anything. |
| The fly solves | — | every human who has not solved loses 5 s |

Humans are a team. They never damage each other. The only target is the fly, and the
only attacker is the fly.

### The fly's clock is the boss's health, and the boss does not heal
She has one clock, visible to the whole room as a bar, and it is the thing the team is
trying to empty. She earns **no time from letters**. Her clock only ever goes down. This is the one place
where she does not play by the human rules, and it is not decoration: without it the mode
does not work.

The arithmetic that forced it, found while prototyping on 2026-09-13. A player uncovering
the whole word earns up to 50 s. Eight humans each dealing 5 s deal 40 s in total. So a
fly who played well would out-earn the entire room's damage and could never be brought
down, no matter how many people were in it. Letting the boss heal made the boss unkillable.

So her clock has three components only:

| Component | Effect |
|---|---|
| Starting clock | **45 s, flat** — it does not grow with the room |
| A human solving | **−8 s** each |
| Time passing | −1 s per second, as for anybody |

### Why the clock is flat
The first design scaled it with the room. It read badly and played worse: in a full room a
solve took 16 s off a 148 s bar, a scratch nobody could see, and the fight was decided by
arithmetic rather than by anyone playing well. Flat, every solve is a visible fifth of her
life and the rule fits in a sentence: *she has 40 seconds, and every one of you who solves
takes 8 off her.* More players help, because more people can land a hit.

### What the numbers were tuned against
Measured on 2026-09-13 with the connectome doing the choosing: she solves in 2 to 3
attempts and needs 15 s at best, **29 s typically and 32 s at worst**, at 12 to 23 s of
deliberation per turn. Her clock is 45 s, so untouched she wins; the earlier 40 s left her
8 s of headroom in a bad round and played as permanent near-death.

| Humans who solve in time | Her budget | Outcome |
|---|---|---|
| 0 | 45 s | she wins |
| 1 | 37 s | she usually wins |
| 2 | 29 s | a coin flip on the word |
| 3 | 21 s | the team usually wins |
| 4 | 13 s | the team wins |

Untouched she nearly always wins, one solve rarely turns it, and two or three make her the
underdog. That is the shape the mode wants.

### Her pace is a balance number, not flavour
She takes 12 to 23 s per turn, so a round costs her 30 to 60 s. This is not decoration.
At about 5 s a turn she finished in 7 to 24 s while a human takes 30 to 90, so the team's
damage always arrived after she was already done: no clock setting could make that fight
real. The two have to overlap in time or there is no fight to have.

The interface still shows what she *would* have earned from her letters, greyed out, so the
rule reads as a deliberate handicap rather than a missing feature.

### Winning
- **The team wins the round if the fly does not solve it**, whether she ran out of clock,
  ran out of attempts, or both.
- **The fly wins the round if she solves it.**
- A game is the configured number of rounds. Whoever takes more rounds wins the game.

### Scoring: the boss does not score
Every human still scores individually with the formula in `03-scoring-system.md`, so
personal play still matters and there is still a table inside the team. On top of that,
every human who was still in the room when the fly went down gets a flat team bonus.

**The fly is absent from the breakdown and from the standings.** Found in the first
playtest on 2026-09-13: she solved first, in three attempts against a human's six, and
still lost the round by 62 points. The formula pays for the percentage of your clock you
had left, and her clock is her health — 40 s that only ever counts down — so a mechanic
built to put her under pressure was also quietly taxing her for being under it. The two
roles cannot share one number.

So she has no points and no rank. The round says whether the team beat her and how many
attempts she took, and that is her whole result. It is also how a boss fight should read:
the boss is the opponent, not a name on the leaderboard.

The bonus is **+25**, paid to every human in the room, and it sits outside the solve floor
so a player who lost their own round still shares the team's win. The fly never collects it.

## Pending decisions
- **The team bonus for beating the fly.** Shipped as a flat +25 for every human seated when
  she went down; a share of her remaining clock is the alternative.
- **Whether the damage lands in time in a real room.** The table above assumes a solve
  reaches her before she finishes. Against live players some hits will arrive too late,
  which makes her stronger than measured. This is the one number only a playtest settles.
- **Whether the no-healing rule is too blunt.** The alternative is letting her earn time at
  a reduced rate, for example half. Tried flat-zero first because it is the easiest to
  explain and the easiest to balance against.
- **Does the fly's hint count as an attack?** Right now it is just her own hint.
- **What the room sees of each other.** The normal game shows rivals' boards in colour.
  In a team mode that could be more generous, since they are not competing.
- **Solo play.** With 1 human the room has no lobby dynamics worth the name. Decide whether
  solo boss mode is its own entry point from the home page.

## How she actually thinks

She runs a real brain. Every turn:

1. Her board goes in as Poisson drive on real **visual projection** populations, one channel
   per slot and colour, plus one sensory channel for how boxed in she is.
2. **138,639 FlyWire neurons and 2,700,513 synapses** integrate and fire for 150 ms of
   biological time, leaky integrate-and-fire at the Shiu et al. parameters. Nothing in that
   step knows anything about Wordle.
3. The firing rates of **64 real descending neurons** come back — the cells that in a fly
   carry decisions out of the brain towards the body, picked by how strongly the rest of the
   brain drives them.
4. A small trained readout turns those rates into **the letters she wants**.
5. The board plays the legal word that best spends them.

The word is the brain's. The list of candidates only decides what is *legal*, the same
division a chess engine makes between generating legal moves and choosing one.

### What is trained, and what is not
Only the readout: 64 rates in, 27 letter preferences out, one hidden layer. It was fitted
offline against how evenly each letter splits the answers still standing
(`tools/train-boss-readout.spec.ts`). The connectome upstream of it is fixed anatomy and is
never touched by training, which is what makes the control below mean anything.

What she does with a turn — risk a word, probe for letters, spend her hint, hold — is still
a policy of four thresholds. That is a decision about the rules of a game, and dressing it
up as biology would be the decoration this project keeps refusing.

### Two measurements that had to come first
Both were run on 2026-09-13 before any of this was built, because both could have killed it.

**The network saturates.** Between 20 and 150 Hz of drive the population rate only moves
from 25 to 38 Hz. Every colour first landed on that flat stretch and the brain could not
tell one board from another: the same board with a different random seed was as different
as two different boards. The input rates now sit on the steep part of the curve
(green 16 Hz, yellow 9, gray 3).

**The signal is real once you are on the steep part.** A linear readout on those 64
descending cells tells four board states apart with **88 % held-out accuracy against a 25 %
chance baseline**. That is the whole reason this works.

**The first readout was worse than no readout.** Trained on the board colours alone it scored
−1.8 % against a constant guess: she could not see *which letters she had already spent*, so
the target was not predictable from her input. The training script asserts that the brain
beats a constant and it failed, loudly. Giving her 27 more channels, one per letter with
three levels, fixed it: the readout is now **18.8 % better than ignoring the brain**
(held-out error 0.186 against 0.229).

### The control, and what it actually found
`tools/boss-brain-control.spec.ts` plays the same words with the same seeds twice: once with
the brain intact and once with every synapse cut. Same readout, same stimulus, same list.

Run over 20 rounds on 2026-09-13:

| | Solved | Attempts |
|---|---|---|
| Brain intact | 20 / 20 | 3.35 |
| Every synapse cut | 20 / 20 | 3.05 |

**Half the rounds played out differently, and the silenced fly was marginally better.**

Read that honestly. The connectome really does choose the word — cut it and she plays a
different game in 10 rounds out of 20, so it is not being ignored. But it is not *earning*
anything: her skill comes almost entirely from the legal-candidate filter, and once that
filter has done its work the surviving words are so close in value that which one she picks
barely moves the result.

This is the same finding the Fly Dino authors were careful about, in the other direction.
Their silencing control dropped the agent from 99/100 to 0/100 because in a reflex game the
circuit *is* the skill. Here the game's difficulty lives in a search over a word list, which
is not something a spiking network does, so the brain's contribution is real but small.

The way to make the brain's quality decide the game is to take the filter away and let her
choose from all 870 words every turn. She would play much worse and the silenced fly would
play far worse still, which is exactly what would make the control dramatic. That is a game
design choice, not a technical one, and it is still open.

### The instrument
**Its own tab** (`/brain/:code`), opened from the link in her panel. It was a
dialog over the game until 2026-09-13; a second screen is the right shape for
something you leave open and watch while you play, and a lid over your own board
is not. What it draws:

- **The brain as a point cloud**, 8,000 real somata, in one of three modes.
  *Transmitter* colours every cell by its own neurotransmitter — what a cell
  **is**. *Atlas* drops the resting cloud to a faint grey shell and colours only
  what is firing, green for excitatory and orange for inhibitory — what the
  brain is **doing**. *Circuit* drops the whole brain to an unlit shell and draws
  only the **64 descending cells the readout reads**, in their real anatomical
  places, plus the **198 real synapses between them** — where the decision
  happens. Each node's brightness is its measured rate, the same number the
  decision network shows in its input column, and a line lights when its source
  cell fires. Every line is an edge in the connectome; none is drawn for effect.
  Orbit can be stopped, and a live-state line reports the mean activity and how
  many cells are lit, read straight off the buffer being drawn rather than
  computed about it.

  Both position files come out of `scripts/build-boss-cloud.mjs` in one pass, so
  the 64 cells and the 8,000 share a transform and land in the same space —
  a single uniform scale (254 / longest span) with each axis centred on 128.
  Regenerating the cloud reproduces the shipped file byte for byte.

  Two brightnesses, because the two sources are not equally strong evidence: a
  live 20 ms slice lights a cell by its spike count (0.42 / 0.72 / 1.0), while
  the per-turn snapshot only says "fired at least once in 150 ms" — true of a
  quarter of the sample — and lights at 0.5. Lighting 1,998 cells at full is
  what turned the panel into a white smear. Drawn the way the published connectome viewers do it:
  additive blending so density reads as anatomy, point size falling off with
  perspective, and each firing cell burning towards white with a halo. The first
  attempt was a flat 2-D scatter and looked like a smudge.
- **The fly on her keyboard**, the real "Shy fly" mesh (Maf'j Alvarez, CC-BY 3.0,
  attribution in `frontend/public/models/fly/ATTRIBUTION.md`), shipped unmodified
  and recoloured at load time as *Drosophila melanogaster*: tan thorax, abdomen
  banded dark, two red eyes, clear wings. The banding is written as vertex
  colours along the body axis, and the second eye is the first one copied across
  the midline — the mesh only paints one of its two eye bulges red, and tinting
  the body amber turned the other into what read as a snout.
  She presses **the keys of the word she is really sending**, at the pace of the
  motor population. Nothing about the animation is mimed.

  A denser CC0 mesh (Kohyzazi) was tried on 2026-09-13 and reverted the same day.
  It was the better mesh by every measurable count — more triangles, two real
  eyes, clean materials — and looked like a brown blob. Counts are not looks.
- The spike raster, the membrane-voltage histogram, the population rates, the
  stimulus per slot, and the readout drawn with its own weights.

It is lazy-loaded: the mesh, Three.js and the cloud only download on that route,
so an ordinary game never pays for them (the main bundle is 140 kB gzip; the
instrument's own chunk is 189 kB and loads nowhere else).

### How the second tab gets its data
The brain tab **opens no socket of its own**. Rejoining a room from a second
socket takes the seat away from the first one — that is what `session:replaced`
is for — so a brain tab that connected normally would knock the player out of
the game they were watching.

Instead the game tab stays the only connection and relays the fly's state over a
`BroadcastChannel` (`frontend/src/features/game/helpers/boss-channel.ts`), at
most once every 120 ms. The brain tab announces itself on that channel; the game
tab turns the server's `boss:watch` on while a viewer is there and off when it
stops renewing. No viewer, no simulation: the worker only runs while somebody is
reading it. Messages carry their room code and both ends drop anything for
another room: one browser can hold several games at once.

The brain route is deliberately outside the session guard, and the app bootstrap
skips it entirely (`isBrainPath`). That last part was not optional: the normal
bootstrap rejoins the stored session and then navigates to the room's current
screen, so the brain tab opened, rejoined — taking the seat from the tab that
was playing — and redirected itself straight back to the game.

### Live, not per-turn
Her decision is one 150 ms simulation per turn, which left the panel frozen
between turns. Since contract v15 the worker also runs a **continuous stream**
while somebody is watching: 20 biological ms every 160 ms, sent as `boss:frame`
with the fired-neuron bitset, the voltage histogram, the population rates, the
spike raster, the 64 descending rates **and the readout run on those live rates**
— its 12 hidden units and its 27 letter preferences. That last part matters: the
decision network's three columns all move now, because all three are measured on
the slice that just ran, not held over from the last turn.

Two details that were wrong and are covered by a test now
(`test/boss-mode.spec.ts`): the raster scaled its spike times against a fixed
150 ms window, which squeezed a 20 ms slice into the left edge of the panel, and
the frames carried only the descending column. The test asserts that a frame
carries all three columns and that two consecutive slices differ.

### What it costs
Half a second of wall time for 150 ms of biological time, measured. It runs on a **worker
thread**, because half a second on the main thread would freeze every socket in every room.
She takes 12 to 23 seconds over a turn anyway, so the brain is about 3 % of her thinking.

The live stream costs about 90 ms of wall time per 20 ms slice, roughly six slices a
second, and only while a brain tab is open.

## Her candidate list is derived, not carried
Measured on 2026-09-13, from a real round the answer of which was PANIC. She
played BULLY, RATIO, SPEND, CREST and then MIDST three times with MIGHT in
between — while, from her third guess onward, PANIC was the *only* answer still
consistent with her own colours.

Two defects, neither of them in the brain:

- The list was built incrementally: seeded with the whole answer list, narrowed
  after each guess. When it emptied, the code fell back to the **entire pool**,
  so she played words her own greys had already ruled out.
- Nothing excluded the words she had already sent, so the same preference over
  the same pool produced the same word again and again.

Both are fixed. The list is now **derived from the rows on her board** every
turn (`candidatesFrom`), which costs one pass over ~900 words and cannot drift
out of step with what she can see; and a word she has played is never legal
again. Probing may still leave the candidate list — a word that cannot be the
answer can still be the best question — but it can never contradict a grey.
An empty list now logs a warning instead of silently widening.

This makes her meaningfully stronger: she no longer spends attempts on words
that cannot win. The regression is covered in `test/boss-mode.spec.ts`.

## 2026-09-14 — what she is now

The full investigation is in `07-what-the-fly-can-do.md`. The short version: a
fly brain cannot deduce, and deduction is the game. So the game does that one
part for her, says so, and everything else is hers.

Each of her turns:

1. The game strikes out every word that contradicts the colours on her board
   (`candidatesFrom`). This is the **declared prosthesis** — the deduction a
   human does in their head. Her panel says it in those words.
2. From what survives it draws **8 words uniformly at random** (`BOSS.candidates`).
   Uniform, so nothing prefers a word for her.
3. Her readout — a ridge fit over all 1,299 descending cells, trained against
   ground truth — scores the 8 by how much more than usual it wants each letter.
   **She plays the highest.** This is the only decision in the turn that is hers.
4. She has **4 attempts** (`BOSS.maxAttempts`), not a human's 8. Measured: with
   the filter, a coin toss among the survivors already solves 98.6 % of rounds
   in 8 attempts and 47.7 % in 4. Four is where her choice can still matter.

What is honest to say about her, and what her page says: she is a real brain
choosing among words the game has already narrowed; her choice is real and
board-dependent; it does not make her a strong player. The control experiment
(`tools/boss-brain-control.spec.ts`) plays every round three times on the same
eight candidates. Measured on 2026-09-14, 120 rounds:

| chooser | solved |
|---|---|
| her brain, intact | 43 / 120 (35.8 %) |
| her brain, every synapse cut | 41 / 120 (34.2 %) |
| a coin | 49 / 120 (40.8 %) |

Intact and cut played different words in 119 rounds of 120: the choice is hers.
It is also no better than the coin's. That is the number on her page, and the
reason this design lives on the `fly-boss` branch and not on `master`
(`07-what-the-fly-can-do.md`, section 9).

Nothing removed on 2026-09-13 came back: no policy, no cerco channel, no
discount, no answer-list shortcut. Her hint is still the readout's 28th output.

Two smaller rules, both found by the end-to-end suite on 2026-09-14:

- **She does not play in a room with nobody connected.** A room outlives its
  last human for the reconnection grace, and there is one brain thread for
  every room; a fly still thinking in an abandoned room starved the fly in a
  room with people in it (her requests time out at 8 s). The ticker skips
  those rooms; she resumes when someone comes back.
- **She never collects the team bonus.** `BOSS.defeatedBonus` was reaching her
  row of the breakdown as well; it is 0 for her now, as this document always
  said it was.

## 2026-09-13 — the algorithm comes out

An audit of what the panel shows and what actually decides her moves found that
the telemetry was real everywhere, and that **the game was not being played by
the fly**. Six things were doing it for her:

1. Her move — probe, commit, hint or wait — came from `BOSS_POLICY`, thresholds
   written by hand over the candidate count.
2. The candidate list was deduction over the 898 answers, and its result was fed
   **back into the brain** through a "cerco" channel at 1–16 Hz. The brain was
   being told the algorithm's conclusion and then admired for knowing it.
3. The confidence the room saw came from that policy. No neuron had said it.
4. `scoreWord` discounted letters she had already placed to 35 %: a rule about
   how to play Wordle, applied on top of what the brain asked for.
5. Her thinking time, 9–20 s, was scaled by that same invented confidence.
6. The readout was trained to predict `informativeLetters(candidates)` — the
   recommendation of the deductive solver. Its teacher was the algorithm, and
   therefore so was its ceiling.

### The measurement that settled it
The silencing control, 40 rounds, same words and same seeds for both:

| | solved | attempts |
|---|---|---|
| brain intact | 40/40 | 3.55 |
| every synapse cut | 40/40 | 3.45 |

21 of 40 rounds played out differently, so the connectome was genuinely changing
what she played — and the silenced fly played **slightly better**. The brain was
choosing words; the filter was winning games.

### What it is now
- **One move: she plays the word her brain asked for.** `BOSS_POLICY` and
  `HeuristicBossBrain` are deleted, not disabled.
- **Every real word is legal.** The list is the keyboard, the same restriction a
  human plays under — not a filter over what can still be the answer. Her
  memory holds only the words she herself has sent, so she never repeats one.
- **The cerco channel is gone.** All she is shown is five slot colours and what
  she has learnt about each of the 27 letters. Exactly what a player sees.
- **Confidence is measured on the readout's own 27 outputs**: how far its top
  letter stands above their mean.
- **A flat pace**, because pacing is reaction time, not help.
- **No fallback.** If the brain does not answer she does not move, and the log
  says so. A policy standing in for the brain is an algorithm playing the game,
  and it hid the failure besides.
- **The readout is trained against ground truth**: the letters that were really
  in the word. The teacher is the answer — the one thing you cannot train
  without — and the task is the player's own, look at a board and name the
  letters. The solver is out of the project entirely, training included.

She is much weaker for it, and that is the point: she has to be beatable by a
person, and what beats her has to be her own limits. **Any balancing from here
goes through the clock, never through help.**

## What is never shown while the round runs
The fly's panel gives tension, not information. During the round nobody sees the letters
she types, the word she sent before her colours come back, her candidate list, or the
answer. All of it appears in the round summary, once it can no longer help anybody win.
The detail of her instrument panel lives in `05-design.md`.
