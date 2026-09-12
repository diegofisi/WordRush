# 03 · Scoring system

Decided on 2026-09-11. Principle: **time and points are different things**.
Time is your life in the round (see `02-game-rules.md`). Points are your result,
and almost all of them come from the clock.

## Points per round

| Concept | Points |
|---|---|
| You solve the word | 1 point for every 1 % of the **initial time** you have left when you solve |
| Each attempt after the first | −2 |
| First, second and third to solve | +25, +15, +10 |
| You finish the round still holding your hint | +10 |
| **Floor for solving** | **minimum 30 points**, no matter what |
| You do not solve, you have greens at the end | **8 per green** |
| You do not solve, you know letters you never placed | **4 per yellow** |
| **Cap for not solving** | **maximum 28 points**, however many letters you found |
| You do not solve and you found nothing | 0 |

A **green** is a distinct answer slot the player turned green. A **yellow** is a distinct
answer slot the player knows holds a letter of the word but never turned green: a charged
yellow, or a slot the hint revealed and the player never placed. A slot that was yellow and
later went green counts once, as a green. So the consolation is
`min(28, 8 × greens + 4 × yellows)`.

### Why a percentage and not seconds
If one room uses 60 s and another 300 s, a fixed 25-point bonus would be worth a great deal
in the first and nothing in the second. With a percentage the balance is the same whatever
the room's clock. On screen it is shown as "te sobró 72 %" ("you had 72 % left").

With the letter bonuses it is possible to go over 100 %. That is deliberate: whoever solves
fast and also hunted down a lot of new letters ends up above everyone else.

### Why attempts count so little
The −2 penalty exists only so that two players with the same time left do not tie because
one threw in an extra word. The aim is to promote speed and chaos, not caution. At −2 an
eighth attempt costs 14 points, less than a quarter of a decent round: trying another word
is always better than sitting on the clock.

### Why there is a floor of 30
Somebody solving on attempt 8 with 2 seconds left would have 2 − 14 = −12. Solving can never
be worth less than not solving, so the floor has to sit above the best consolation. At 30
against a cap of 28 the worst solve still beats the best failure by 2 points, and a player
who is one letter short always has a reason to keep guessing instead of stalling.

### Why greens without solving give 8, and yellows 4
So that whoever came close does not walk away with zero and can stay in the game with a
chance. A green is hard evidence (the slot is settled), a yellow is half of one (the letter
is in the word, the place is not), so a yellow pays half. The cap of 28 keeps the whole
thing a consolation and not a strategy: it sits below the 30-point floor for solving, and
nobody plans a round around 28 points when solving fast gives more than 100.

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
| Two attempts after the first | −4 |
| Second to solve | +15 |
| Hint kept | +10 |
| **Round total** | **125** |

If Ana had used the hint at second 0 (marking the O in yellow), the green O on attempt 3
would give 5 and not 10, and she loses the +10 for the hint. She would end with 89 s → 99 points
for time → 110 total. Using the hint cost her 15 points, but it could have saved her an attempt.

Carla solves on attempt 5, at second 70, fourth in the room, with three −5 penalties and 35 s
paid by letters. Final clock 40 → 44 %. Total: 44 − 8 + 0 + 10 = **46**.

Elena solves on attempt 6 with 12 s left, fifth: 13 − 10 + 0 + 10 = 13, raised to the
floor: **30**.

Fito does not solve but finishes with 4 greens: 4 × 8 = 32, capped at **28**. Gaby, with
2 greens and one yellow she never placed: 16 + 4 = **20**. Hugo, who found nothing: **0**.

## Summary of an example round (for design and tests)

| Pos | Player | Solved | Attempt | Time left | Attempts | Position | Hint | Greens | Yellows | Round |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bruno | yes, 1st | 2 | 111 % | −2 | +25 | +10 | | | 144 |
| 2 | Ana | yes, 2nd | 3 | 104 % | −4 | +15 | +10 | | | 125 |
| 3 | Diego | yes, 3rd | 4 | 78 % | −6 | +10 | used | | | 82 |
| 4 | Carla | yes, 4th | 5 | 44 % | −8 | | +10 | | | 46 |
| 5 | Elena | yes, 5th | 6 | 13 % | −10 | | +10 | | | 30 (floor) |
| 6 | Fito | no | | | | | | 4 | 0 | 28 (cap, 32 before it) |
| 7 | Gaby | no | | | | | | 2 | 1 | 20 |
| 8 | Hugo | no | | | | | | 0 | 0 | 0 |
