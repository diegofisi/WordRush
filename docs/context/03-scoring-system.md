# 03 · Scoring system

Decided on 2026-09-11. Principle: **time and points are different things**.
Time is your life in the round (see `02-game-rules.md`). Points are your result,
and almost all of them come from the clock.

## Points per round

| Concept | Points |
|---|---|
| You solve the word | 1 point for every 1 % of the **initial time** you have left when you solve |
| Each attempt after the first | −3 |
| First, second and third to solve | +25, +15, +10 |
| You finish the round still holding your hint | +10 |
| **Floor for solving** | **minimum 20 points**, no matter what |
| You do not solve, you have greens at the end | **5 per green**, maximum 20 (4 greens) |
| You do not solve, no greens | 0 |

### Why a percentage and not seconds
If one room uses 60 s and another 300 s, a fixed 25-point bonus would be worth a great deal
in the first and nothing in the second. With a percentage the balance is the same whatever
the room's clock. On screen it is shown as "te sobró 72 %" ("you had 72 % left").

With the letter bonuses it is possible to go over 100 %. That is deliberate: whoever solves
fast and also hunted down a lot of new letters ends up above everyone else.

### Why attempts count so little
The −3 penalty exists only so that two players with the same time left do not tie because
one threw in an extra word. The aim is to promote speed and chaos, not caution.

### Why there is a floor of 20
Somebody solving on attempt 8 with 2 seconds left would have 2 − 21 = −19. Solving can never
be worth less than not solving. With the floor, the worst of those who solved (20) matches
the best of those who did not (4 greens = 20), and never falls below.

### Why greens without solving give 5
So that whoever came one letter short does not walk away with zero and can stay in the game
with a chance. 4 greens = 20 = the floor for solving. It is a consolation, not a strategy:
nobody plans a round around 20 points when solving fast gives more than 100.

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
| Two attempts after the first | −6 |
| Second to solve | +15 |
| Hint kept | +10 |
| **Round total** | **123** |

If Ana had used the hint at second 0 (marking the O in yellow), the green O on attempt 3
would give 5 and not 10, and she loses the +10 for the hint. She would end with 89 s → 99 points
for time → 108 total. Using the hint cost her 15 points, but it could have saved her an attempt.

Carla solves on attempt 5, at second 70, fourth in the room, with three −5 penalties and 35 s
paid by letters. Final clock 40 → 44 %. Total: 44 − 12 + 0 + 10 = **42**.

Fito does not solve but finishes with 4 greens: **20**. Gaby, with 2 greens: **10**. Hugo, with no greens: **0**.

## Summary of an example round (for design and tests)

| Pos | Player | Solved | Attempt | Time left | Attempts | Position | Hint | Greens | Round |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Bruno | yes, 1st | 2 | 111 % | −3 | +25 | +10 | | 143 |
| 2 | Ana | yes, 2nd | 3 | 104 % | −6 | +15 | +10 | | 123 |
| 3 | Diego | yes, 3rd | 4 | 78 % | −9 | +10 | used | | 79 |
| 4 | Carla | yes, 4th | 5 | 44 % | −12 | | +10 | | 42 |
| 5 | Elena | yes, 5th | 6 | 13 % | −15 | | +10 | | 20 (floor) |
| 6 | Fito | no | | | | | | 4 | 20 |
| 7 | Gaby | no | | | | | | 2 | 10 |
| 8 | Hugo | no | | | | | | 0 | 0 |
