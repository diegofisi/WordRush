# 02 · Game rules

## Room
- Whoever creates the room chooses: language (ES / EN), initial time per round, number of
  rounds, and capacity (2 to 8 players). From v1.1 also the **game** (word or phrase), the
  **word length** (5 / 6 / 7) and **normal or teams** — see `06-v1.1.md`. A running room
  admits up to 2 **observers** on top (`06-v1.1.md` -> Observers).
- Recommended minimum initial time: 60 seconds. Below that, with 8 players, the last one
  is almost always knocked out by the −5 s penalties. See `03-scoring-system.md`.
- You get in with a room code, or by scanning the QR of the invite link. There is a
  waiting room with the player list, how many are connected, and a "Listo" ("Ready")
  button that is only informational. The host can **kick** somebody; that name may not
  come back for 30 s.
- The invite link (`/?code=XXXX`) opens a reduced view that only asks for the name; it does not show the create-room form.
- The host can start with fewer players than the capacity, as long as at least 2 are connected. Not everybody has to be "ready".
- The host can change the settings while in the lobby ("Cambiar reglas" / "Change rules"):
  language, initial time, rounds, capacity and hint on/off. Only the host, only before the
  game starts, and the capacity can never drop below the number of players already in the
  room. The chips update live for everybody and nobody's "ready" flag is reset.

## Round
- Every player gets the same word of the room's length (5 / 6 / 7 letters).
- Up to 8 / 9 / 10 attempts per player, by length.
- Each player's clock resets to the initial time every round. A bad round does not knock
  you out of the rest of the game.
- The round ends for a player when they solve it, use up the attempts, or their clock reaches 0.
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
> Since v1.1 (in the code from 2026-09-15) the hint reveals a new letter, or places a
> known one when every letter is known; in team mode it is one per team, and it is off
> in the phrase game. See `06-v1.1.md` -> Hint. What follows is the v1.0 hint, kept for
> the record.

- Every player gets **one hint per round**. If they do not use it, it is lost when the round ends; it does not carry over.
- Using it reveals **one letter that is in the word, without saying in which position**. It is marked on the keyboard with the hint style (dotted yellow). Nothing is marked on the board.
- The chip says how many times that letter appears: "Hay una M en la palabra", "Hay dos L en
  la palabra" ("There is one M…", "There are two L's…"). The count is real information about
  the word; the positions are still never revealed.
- The hint never repeats something you already know: it reveals a letter from an **answer position that is neither green nor already charged yellow**. It works per position, so repeated letters still count: on `LLAMA`, a player who has one `L` in yellow can still be hinted the other `L` (nothing told them the word has two); once both `L` positions are known, `L` can no longer come out.
- If every non-green position is already known, the hint does not fail: it reveals one of those letters anyway. Unknown positions always come first.
- The hint letter does **not** add the 5 s for a yellow. If you later place it in green, it adds only 5 s. A hint that lands on a position already charged yellow changes nothing in the time ledger.
- Keeping the hint scores points: see `03-scoring-system.md`.

## Leaving on purpose
- Every screen has a way out: "Salir de la sala" ("Leave room") in the waiting room and
  "Salir de la partida" ("Leave game") in the top bar of the game and the results, with a
  confirmation that says the clock keeps running for the others.
- Leaving is **not** a disconnection: the seat is freed for good. The stored session stops
  working, so coming back with it gives "sesión expirada" ("session expired").
- Mid-round, the round of whoever leaves is closed at once, so the room stops waiting for
  them: it ends when everybody still in it has finished. They do not appear in that round's
  breakdown nor in the accumulated table.
- If the one who leaves was the host, the oldest remaining **connected** player becomes host.
- The rest of the room is told: the player is greyed out as "Salió" ("Left") in the rivals
  panel, the feed shows "Bruno salió de la sala" (plus "Ana es ahora anfitrión de la sala"
  when the host changed) and a short notice appears.
- If nobody is left in the room it is deleted; if only disconnected players remain, the
  round ends on the clock and the game is marked finished (same rule as below).

## One game at a time
A browser holds **one** session (`wordrush.session` in `localStorage`), so it can be in one
room at a time. There is never a doubt about "which game do I go back to".

- **Home page with a live session.** Opening `/` first tries to re-enter the stored room.
  If it is still alive (waiting room, playing or between rounds), the create and join forms
  are not shown: a "Tienes una partida en curso" ("You have a game in progress") card takes
  their place with the room code, what is going on in it and two actions: **Reanudar**
  ("Resume"), which goes to the right screen, and **Abandonar la partida** ("Leave it"),
  which frees the seat and brings back the normal home page.
- **Invitation link with a live session** (`/?code=XXXX`). The same card, with one extra
  line: "Abandónala para entrar en XXXX" ("Leave it to join XXXX"). Leaving shows the
  reduced invite view for XXXX.
- **A dead session never nags.** If re-entering fails (the room is gone, the game finished,
  the token no longer works), the session is dropped silently and the ordinary home page is
  shown. The "sesión expirada" notice is only for somebody who was thrown out of a room, not
  for a plain visit to the home page.
- **Creating or joining with a live session is refused**, both in the client and in the
  server (`already_in_room`). The screens above make it unreachable; the check is the net.
- **Two tabs, one session.** The newest tab to re-enter takes the seat. The older one gets a
  full-screen "Esta partida está abierta en otra pestaña" ("This game is open in another
  tab") notice with a "Usar esta pestaña" ("Use this tab") button that takes the seat back.

## Disconnections and room lifetime
- Mid-round, decided 2026-09-15: the clock keeps running, the player may come back while the round lasts, an absent player counts as not solved. Teams: `06-v1.1.md`.
- The player's session is stored in the browser (`localStorage`). If they close the tab or lose internet and come back while the game is still running, they re-enter in their place with their board and their clock exactly as they were (the clock does not stop for a disconnection).
- If they come back when the game has already finished or the room no longer exists, they see a "sesión expirada" ("session expired") message and go back to the start.
- A waiting room with nobody connected: deleted after 10 minutes.
- A game in progress with everybody disconnected: the current round ends on the clock; if nobody is connected when it ends, no other round is started, the game is marked finished and the room is deleted after 5 minutes.
- Finished game: the room is deleted after 5 minutes. Rooms live in memory and take up a few KB; these delays are hygiene, not cost.

## Visibility between players
- You never see the letters the others type (v1.1: except your **teammates'**, live — `06-v1.1.md`).
- You do see, in a side panel, each rival's board in colours (green / yellow / grey),
  their name, which attempt they are on, their clock and whether they have already solved.
- Shared event feed: solves, penalties, hints used, emotes.

## Emotes
- **Twenty stickers**, no text chat. In picker order: `love`, `wink`, `tease`,
  `mindblown`, `shock`, `explode`, `oops`, `whoa`, `ez`, `done`, `clutch`, `gg`, `lol`,
  `grumpy`, `thumbs`, `luck`, `point`, `shrug`, `ok`, `shh`. The artwork lives in
  `frontend/src/assets/emotes/`, the label of each one in both i18n dictionaries.
- **Picker**, not a permanent bar: a single round trigger (desktop, bottom of the right
  column; phone, under the keyboard) opens a popover with the stickers in a 5 × 4 grid —
  a full-width sheet at the bottom of the screen on phones. On hover or focus a sticker
  grows and shows its label. Above the grid, the last 5 emotes the player used, when there
  are any. Clicking one sends it and closes the picker.
- They are sent to the whole room and appear in one place only: **stickers appear as
  messages in the live feed** (112 px under a "time + name" header, consecutive ones from
  the same player within 10 s stacked under a single header, the sender included); on
  phones, which have no feed, as a 2.5 s overlay of 96 px above the keyboard with the
  sender's name in a pill.
- **Burst limit instead of a cooldown.** A player reacts as often as they like. If they
  send **more than 8 emotes within 3 seconds**, the server refuses the rest for
  **5 seconds** (`cooldown`, "Espera 5 segundos" / "Wait 5 seconds"). The pause is always
  exactly 5 seconds — insisting during it does not make it longer — and when it ends the
  3-second window starts empty again. The client applies the same rule before sending, so
  most of the spam never reaches the server, and shows the countdown on the trigger.

## End of game
- The configured rounds are played. The final table sums the points of every round.
- If the game is a single round, exactly the same applies.
- Tie-breaks, in order: fewer total attempts, fewer hints used.

## Playing again
- On the final results the host has **"Jugar de nuevo" ("Play again")**. The room is reused:
  same code, same players, same settings, same host. It goes back to being a waiting room,
  so the host can change the rules before starting, and everybody lands in it automatically.
- Everything the finished game produced is wiped: ready flags, the accumulated table, totals,
  attempts, hints and the list of words already played (a word may come up again). The
  "deleted 5 minutes after finishing" clock is cancelled; from then on the lobby rules apply
  (deleted after 10 minutes with nobody connected).
- Players who are disconnected keep their seat and rejoin the new lobby with their stored
  session, exactly as they would have rejoined the game.
- Guests read "Esperando a que el anfitrión inicie otra partida…" ("Waiting for the host to
  start another game…") and keep "Salir de la sala" ("Leave room"). Only the host can restart,
  and only once the game has finished: between rounds the game is still running.
