# 02 · Game rules

## Room
- Whoever creates the room chooses: language (ES / EN), initial time per round, number of
  rounds, and capacity (2 to 8 players).
- Recommended minimum initial time: 60 seconds. Below that, with 8 players, the last one
  is almost always knocked out by the −5 s penalties. See `03-scoring-system.md`.
- You get in with a room code. There is a waiting room with the player list and a "Listo"
  ("Ready") button.
- The invite link (`/?code=XXXX`) opens a reduced view that only asks for the name; it does not show the create-room form.
- The host can start with fewer players than the capacity, as long as at least 2 are connected. Not everybody has to be "ready".

## Round
- Every player gets the same 5-letter word.
- Up to 8 attempts per player.
- Each player's clock resets to the initial time every round. A bad round does not knock
  you out of the rest of the game.
- The round ends for a player when they solve it, use up the 8 attempts, or their clock reaches 0.
- The room's round ends when everybody has finished, or when the last clock reaches 0.
- On solving, the player's clock freezes. That value is what scores.

## Colours
The same as classic Wordle: green (letter in its place), yellow (letter in the word but
somewhere else), grey (not there).

## Time from letters
Every letter is paid **only once per position**. That prevents "farming" time by repeating
letters that have already been uncovered.

| Event | Seconds |
|---|---|
| New letter in yellow | +5 |
| New letter straight to green | +10 |
| Letter that was already yellow and is now green | +5 more |
| Letter revealed by the hint and later placed in green | +5 (the yellow is not paid) |
| Repeating a yellow or green already paid | 0 |

Maximum possible per round: 50 seconds (5 letters × 10). With repeated letters in the word
(LLAMA, for example) each occurrence counts by its position.

## Automatic attack: "−5 s al resto" ("−5 s to everyone else")
- When a player solves, every player who has **not yet solved** loses 5 seconds.
- It is announced in everyone's feed: "Ana respondió correctamente · −5 s al resto"
  ("Ana answered correctly · −5 s to everyone else").
- It does not affect those who already solved (their clock is frozen).
- With 8 players, the last one can pile up as much as 35 seconds of punishment. That is intentional.
- The HUD shows how many seconds you have lost to this in the round.

## Hint
- Every player gets **one hint per round**. If they do not use it, it is lost when the round ends; it does not carry over.
- Using it reveals **one letter that is in the word, without saying in which position**. It is marked on the keyboard with the hint style (dotted yellow). Nothing is marked on the board.
- The hint letter does **not** add the 5 s for a yellow. If you later place it in green, it adds only 5 s.
- Keeping the hint scores points: see `03-scoring-system.md`.

## Disconnections and room lifetime
- The player's session is stored in the browser (`localStorage`). If they close the tab or lose internet and come back while the game is still running, they re-enter in their place with their board and their clock exactly as they were (the clock does not stop for a disconnection).
- If they come back when the game has already finished or the room no longer exists, they see a "sesión expirada" ("session expired") message and go back to the start.
- A waiting room with nobody connected: deleted after 10 minutes.
- A game in progress with everybody disconnected: the current round ends on the clock; if nobody is connected when it ends, no other round is started, the game is marked finished and the room is deleted after 5 minutes.
- Finished game: the room is deleted after 5 minutes. Rooms live in memory and take up a few KB; these delays are hygiene, not cost.

## Visibility between players
- You never see the letters the others type.
- You do see, in a side panel, each rival's board in colours (green / yellow / grey),
  their name, which attempt they are on, their clock and whether they have already solved.
- Shared event feed: solves, penalties, hints used, emotes.

## Emotes
- Quick-reaction panel (6 to 8 icons). No text chat.
- They are sent to the whole room and appear for a few seconds above the avatar of whoever sent them.
- A 3-second cooldown per player to prevent spam.

## End of game
- The configured rounds are played. The final table sums the points of every round.
- If the game is a single round, exactly the same applies.
- Tie-breaks, in order: fewer total attempts, fewer hints used.
