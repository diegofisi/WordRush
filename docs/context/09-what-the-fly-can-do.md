# 09 · What the fly can and cannot do

A record of the investigation of 2026-09-13/14 into whether a real *Drosophila*
connectome can play this game. Written so nobody — including us in six months —
has to redo it.

Everything below is measured. Where a number is an estimate or an assumption it
says so.

## The question

Boss mode shipped with a fly that solved in ~3.5 attempts and looked impressive.
The question asked was simple: **is the fly playing, or is an algorithm playing
and the fly decorating it?**

## The answer

The algorithm was playing. And after removing every part of it, the fly could
not take over — not because the code was wrong, but because the task does not
fit the animal.

---

## What was measured

### 1. The silencing control: the brain contributed nothing

Same 40 rounds, same words, same seeds, played twice: once with the connectome
intact and once with **every synapse cut**.

| | solved | attempts |
|---|---|---|
| brain intact | 40/40 | 3.55 |
| every synapse cut | 40/40 | 3.45 |

The dead fly played **slightly better**. 21 of 40 rounds differed in the words
played, so the brain was genuinely choosing — and its choices made no difference
to the outcome, because the candidate filter had already narrowed the answer
list to a handful where nearly any choice wins.

### 2. Six things were playing the game for her

1. The move — probe, commit, hint or wait — came from hand-written thresholds
   over the candidate count.
2. The candidate list was deduction over the answer list, and its result was fed
   **back into the brain** through a "cerco" stimulus channel at 1–16 Hz.
3. The confidence shown in the panel came from that policy. No neuron had said it.
4. `scoreWord` discounted letters she had already placed to 35 %.
5. Her thinking time was scaled by that invented confidence.
6. The readout was trained to predict `informativeLetters(candidates)` — the
   recommendation of the deductive solver. Its teacher was the algorithm.

All six were removed. `HeuristicBossBrain` and `boss-solver.ts` were deleted.

### 3. The stimulus never reached her brain

With the algorithm gone, the fly played at chance. The cause was mechanical and
ours: each channel drove 120 neurons at 16 Hz, delivering ~290 spikes in 150 ms,
each worth 0.275 mV against a 7 mV threshold that needs ~25 of them at once.
**The stimulus died at the first synapse.**

A linear probe on the readout cells could recover almost nothing of the board:

| what we tried to decode from the 64 readout cells | vs a constant |
|---|---|
| **which** letters are present (27 identities) | +2.2 % |
| **which** colour each slot is (20 identities) | +0.4 % |
| **how many** letters are present (1 scalar) | +29.9 % |
| **total stimulus injected** (1 scalar) | +26.4 % |

The network transmits **how loud** the stimulus was, not **which** channel
carried it. That also explains the old training's 18.8 % headline: the cerco
channel was a scalar, and scalars are exactly what this network passes.

Read where the board *enters*, and it is perfectly legible — 63.5 % for letters
in sensory, 34.7 % for slot colours in visual projection — and gone one synapse
later. Reading the input population would be reading our own injection back.

### 4. Three fixes, all ours, all measurable

| | was | now | why |
|---|---|---|---|
| integration window | 150 ms | 900 ms | at ~10 Hz a cell fires once or twice in 150 ms; the rate estimate was mostly counting noise |
| neurons per channel | 120 | 400 | 120 cells in 138,639 is a whisper |
| stimulus rate | 16 Hz | 128 Hz | see above; still under a neuron's refractory ceiling |
| synaptic strength | Shiu et al. | **unchanged** | not needed once the window was fixed |

Letters decodable from the whole descending population went **5 % → 23 %**.

An earlier sweep reached 55 % by asking single neurons for 2,400 Hz, which no
cell can produce, and by weakening every synapse to a quarter of the published
value. Both were abandoned: a result that needs impossible rates is not a result.

### 5. Choosing the readout population by in-degree was the worst possible rule

"The 64 most-connected descending cells" was picked for narrative reasons. The
most-connected cells are the ones that pool over the most of the brain, and
pooling is what destroys detail.

| population read | letters decodable |
|---|---|
| the 64 most-connected descending | 2.4 % |
| **all 1,299 descending** | **21.6 %** |
| 1,500 random central | 23.5 % |
| 3,000 random central | 27.4 % |

All descending cells are now read: the whole output pathway, no cherry-picking.

### 6. The readout had to get simpler, not bigger

| readout | held-out vs a constant |
|---|---|
| 1,299 → 24 hidden → 28, gradient descent | **−0.5 %** (training error 0.13, held-out 0.37: memorised) |
| 1,299 → 28, ridge, penalty swept | **+8.8 %** |

31,176 weights against 960 boards is 32 parameters per sample. The linear fit
with a swept penalty beats it outright, and leaves less room for something other
than the fly to be doing the playing.

### 7. Her output channel is about two dimensions wide

Principal components of the descending rates across boards:

| boards | 1st component | effective directions |
|---|---|---|
| realistic (from real play) | 56.3 % | **2.6** |
| random | 19.1 % | 10.2 |

The boards that actually occur in a game resemble each other, so her responses
to them do too. Asking a ~2-direction channel for 28 outputs was never going to
work — and no amount of training fixes a channel that narrow.

Reading the same runs as ten 90 ms bins raises the raw dimensionality to 24.7,
but **decoding gets worse** (letters 23.3 % → 15.5 %): each bin has a tenth of
the spikes, so the extra directions are noise at any sample size we can afford.

### 8. And then the wall

The word choice was fixed to score candidates by how much more than usual she
wanted each letter — using the raw preference let the Spanish letter frequencies
swamp the board-dependent part, and 29 of 30 rounds came out identical. After
the fix she plays a different word per board, demonstrably.

But she solved **0 of 30** rounds. And the reason is not the brain:

> **A fly choosing completely at random, with the candidate filter, solves
> 98.6 % of rounds in 8 attempts.**

Filtering to consistent words and picking at random is already near-optimal
Wordle. There is no room above 98.6 % for a brain to contribute anything.

Cutting her to 4 attempts opens a gap — random 47.7 %, oracle 81.8 % — but the
achievable ceiling is 74.5 %, reached by *preferring common words*. That is a
property of the word, not of the board, and a frequency table does it better
than any brain. The fly would be a decorative middleman again.

The same holds for Mastermind with colours instead of letters, which is Wordle
without the dictionary:

| | random | best achievable | oracle |
|---|---|---|---|
| 6 colours × 4 slots, 5 tries | 82.5 % | 95.0 % | 100 % |
| 8 colours × 5 slots, 5 tries | 26.5 % | 36.0 % | 87.8 % |

Ten to twelve points of room, and reaching it means computing which candidate
best splits the surviving set — deduction again.

### 9. What shipped, measured against a coin (2026-09-14)

The honest intermediate in `08-boss-mode.md`: the game strikes out the
contradicted words and shows her **8 uniformly random survivors**; her readout
picks one; she has **4 attempts**. `tools/boss-brain-control.spec.ts` plays each
round three times on identical candidates — intact brain, every synapse cut,
and a coin — so the only thing that differs is who chooses.

The first run tied all three at 11/30 with the same 136 attempts. The rounds
were not identical (intact and cut differed in 30/30), but the answers came in
triplets — `video` three rounds running, then `acaso`, then `brazo` — because
consecutive seeds into the LCG give first draws 0.0004 apart. The worker now
scatters every seed through the murmur3 finaliser before it reaches the
generator. With that fixed, 30 rounds:

| chooser | solved | mean attempts |
|---|---|---|
| brain intact | 17 / 30 (56.7 %) | 4.13 |
| synapses cut | 11 / 30 (36.7 %) | 4.50 |
| coin | 14 / 30 (46.7 %) | 4.23 |

Three rounds over the coin is inside what 30 rounds can tell apart from luck,
so the number went to 120 rounds before it was written on her page:

| chooser | solved | mean attempts |
|---|---|---|
| brain intact | 43 / 120 (35.8 %) | 4.50 |
| synapses cut | 41 / 120 (34.2 %) | 4.52 |
| coin | 49 / 120 (40.8 %) | 4.45 |

Intact and cut played different words in 119 of 120 rounds. The 17/30 was the
top of the noise: over the 90 rounds that followed she solved 26 to the coin's
35.

So this is what she is, measured: **her choice is real** — cut the synapses and
she plays a different game in 119 rounds out of 120 — **and it is worth
nothing**: on the same eight candidates a coin solves as many rounds as she
does, and a little more. She is a brain choosing, and choosing no better than
chance. That sentence is on her page, with these numbers, and it is the reason
this branch is not on `master`.

---

## The conclusion

**In any game about guessing a hidden thing, once the incompatible options are
removed, the remaining skill is logical inference over the survivors.** A fly
brain has neither symbolic memory nor inference. Changing words for colours
changes the size of the decision, not its nature.

So: this connectome cannot meaningfully play Wordle, or any variant of it. Not
because of how we built it — because of what the task is.

## What is left, and what it would take

The one path that respects the premise is **plasticity**: letting experience
change her brain, rather than reading a frozen one.

The circuit is in our connectome, identified cell by cell:

| | count | role |
|---|---|---|
| Kenyon cells | 5,177 in 11 types | represent the stimulus |
| MBONs | 96 in 35 types | the output that drives behaviour |
| dopaminergic (PAM/PPL) | 331 in 27 types | signal reward and punishment |

The rule is documented: when a Kenyon cell is active and dopamine arrives, its
synapse onto the MBON is depressed. That is how a fly learns that an odour leads
to something bad.

A game built on **learning associations** — green rewards, grey punishes, and
her brain is different next turn — would use the fly for what a fly does. It
would not be Wordle.

Also worth knowing, from the literature: [Lappalainen et al.][1] succeed with a
connectome-constrained network by **training the network's own free parameters**
(time constants, resting potentials, synaptic gains per cell type — none of
which are in a connectome) on a task the circuit performs naturally. We freeze
everything and train only a readout, which is reservoir computing; and the
published work using [this connectome as a reservoir][2] reports its advantage
as *resistance to overfitting*, not power, on **time-series** tasks.

[1]: https://www.biorxiv.org/content/10.1101/2023.03.11.532232v1
[2]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12109256/

## Honest notes on the investigation itself

- The silencing control is a weak test. With synapses cut the readout sees zeros
  and always answers the same, so beating it proves very little. The strong test
  is beating **random choice among the same candidates**, and that is the one
  that killed each design.
- Several of the day's estimates were wrong and were corrected by measurement:
  the "2.6 effective directions" figure applies to realistic boards, not to
  random ones; the 81.8 % ceiling was an oracle, not achievable; the first
  decodability probes were overfitted and their "no signal" verdict was wrong.
- Every number here is reproducible from the tools in `backend/tools/` and the
  scripts referenced in the commit that added this file.
