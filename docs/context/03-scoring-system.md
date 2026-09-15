# 03 · Scoring system

Decided on 2026-09-11, simplified on 2026-09-12. Principle: **time and points are different
things**. Time is your life in the round (see `02-game-rules.md`). Points are your result,
and almost all of them come from the clock.

## Points per round

| Concept | Points |
|---|---|
| You solve the word | **+40**, flat |
| Time left when you solve | 1 point for every 1 % of the **initial time** you have left |
| Each attempt after the first | −4 (−2 until 2026-09-15) |
| First, second and third to solve | +20, +15, +10 |
| You finish the round still holding your hint | +10 |
| You do not solve, you have greens at the end | **8 per green** |
| You do not solve, you know letters you never placed | **4 per yellow** |
| You do not solve and you found nothing | 0 |

Solving is `timePoints + 40 + attemptPenalty + positionBonus + hintBonus`, with no floor and
no cap. Not solving is `8 × greens + 4 × yellows`, with no cap.

A **green** is a distinct answer slot the player turned green. A **yellow** is a distinct
answer slot the player knows holds a letter of the word but never turned green: a charged
yellow, or a slot the hint revealed and the player never placed. A slot that was yellow and
later went green counts once, as a green.

### Why a percentage and not seconds
If one room uses 60 s and another 300 s, a fixed 20-point bonus would be worth a great deal
in the first and nothing in the second. With a percentage the balance is the same whatever
the room's clock. On screen it is shown as "te sobró 72 %" ("you had 72 % left").

With the letter bonuses it is possible to go over 100 %. That is deliberate: whoever solves
fast and also hunted down a lot of new letters ends up above everyone else.

### Why attempts count a little, not a lot
The penalty exists so that two players with the same time left do not tie because one
threw in an extra word, and so that words are not free. It was −2 until 2026-09-15, when
the eighth attempt cost 14 points — attempts were nearly free and people sprayed words.
At −4 the eighth attempt costs 28, still under a fifth of a decent round: trying another
word remains better than sitting on the clock, but it is a decision now. The solve bonus
stays the floor, so no amount of attempts can push a solve under 40.

### Why a flat +40 for solving instead of a floor and a cap
The old rules protected the same idea with two moving parts: a floor of 30 points for
solving and a cap of 28 on the consolation. Two numbers that only made sense next to each
other, and a table row nobody could repeat from memory. A flat +40 does the same job with
one number: solving is worth 40 points plus whatever the round gave you, and the best a
player can get without solving is 4 greens and a yellow, 36 — below the bonus on its own.
Nothing has to be clamped, every row on the results table adds up by hand, and the card in
the lobby reads as a list of bonuses instead of a list of limits.

The solve bonus is also the minimum a solve can score: the attempt penalty never eats into
it. Without that, a solve on attempt 8 with the clock at zero and the hint spent would score
40 − 28 = 12, under the 36 of a perfect consolation (4 greens + 1 yellow). With the minimum,
the worst possible solve is 40 and solving always beats not solving. This is an invariant of
the formula, not a line in the scoring card.

### Why greens without solving give 8, and yellows 4
So that whoever came close does not walk away with zero and can stay in the game with a
chance. A green is hard evidence (the slot is settled), a yellow is half of one (the letter
is in the word, the place is not), so a yellow pays half. It stays a consolation and not a
strategy: the ceiling without solving is 36, and nobody plans a round around that when
solving fast gives more than 150.

Team mode (v1.1) scores per team with its own table: `06-v1.1.md`.

## Final table
Sum of the points of every round. Tie-breaks: fewer total attempts, then fewer hints used.

## Full simulation
A room with 90 s initial time, the word SOLID, 8 players. We follow Ana, who does not use her hint.

| Second | What happens | Letters that pay | Clock |
|---|---|---|---|
| 0 | The round starts | | 90 |
| 12 | Attempt 1: SANDY | S green +10, D yellow +5 | 78 + 15 = 93 |
| 25 | Attempt 2: SLIDE | L yellow +5, I yellow +5, D yellow again 0, S green again 0 | 80 + 10 = 90 |
| 30 | "Bruno respondió correctamente" ("Bruno answered correctly") | −5 to everyone else | 85 − 5 = 80 |
| 41 | Attempt 3: SOLID | O green +10, L, I and D green after yellow +5 each, S already paid 0 | 69 + 25 = 94 |

Ana solves on attempt 3, second in the room, with 94 s. Her clock freezes there.

| Concept | Points |
|---|---|
| Time left: 94 of the 90 initial = 104 % | 104 |
| Solved the word | +40 |
| Two attempts after the first | −8 |
| Second to solve | +15 |
| Hint kept | +10 |
| **Round total** | **161** |

If Ana had used the hint at second 0 (marking the O in yellow), the green O on attempt 3
would give 5 and not 10, and she loses the +10 for the hint. She would end with 89 s → 99 points
for time → 146 total. Using the hint cost her 15 points, but it could have saved her an attempt.

Carla solves on attempt 5, at second 70, fourth in the room, with three −5 penalties and 35 s
paid by letters. Final clock 40 → 44 %. Total: 44 + 40 − 16 + 0 + 10 = **78**.

Elena solves on attempt 6 with 12 s left, fifth: 13 + 40 − 20 + 0 + 10 = **43**.

Fito does not solve but finishes with 4 greens: 4 × 8 = **32**. Gaby, with 2 greens and one
yellow she never placed: 16 + 4 = **20**. Hugo, who found nothing: **0**.

## Summary of an example round (for design and tests)

| Pos | Player | Solved | Attempt | Time left | Solve | Attempts | Position | Hint | Greens | Yellows | Round |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bruno | yes, 1st | 2 | 111 % | +40 | −4 | +20 | +10 | | | 177 |
| 2 | Ana | yes, 2nd | 3 | 104 % | +40 | −8 | +15 | +10 | | | 161 |
| 3 | Diego | yes, 3rd | 4 | 78 % | +40 | −12 | +10 | used | | | 116 |
| 4 | Carla | yes, 4th | 5 | 44 % | +40 | −16 | | +10 | | | 78 |
| 5 | Elena | yes, 5th | 6 | 13 % | +40 | −20 | | +10 | | | 43 |
| 6 | Fito | no | | | | | | | 4 | 0 | 32 |
| 7 | Gaby | no | | | | | | | 2 | 1 | 20 |
| 8 | Hugo | no | | | | | | | 0 | 0 | 0 |
