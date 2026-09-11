# 04 · Decisions and pending items

## Decisions taken (2026-09-11)

| Decision | Reason |
|---|---|
| Points come from the % of time left, not from attempts | Promote speed and chaos. Attempts only break ties (−3 each). |
| Percentage of the initial time instead of seconds | So the balance does not depend on the clock the room was configured with. |
| Position bonuses +25 / +15 / +10 | A touch of multiplayer race, independent of the clock. |
| Keeping the hint gives +10 | So using it is a decision, not a reflex. |
| One hint per player **per round**, not per game (corrected on 2026-09-11) | The +10 for keeping it is already the cost of using it; there is no need to accumulate it across rounds. |
| Floor of 20 points for solving | Solving is never worth less than not solving. |
| 5 points per green without solving, maximum 20 | So whoever came close stays in the game. |
| Automatic "−5 s al resto" ("−5 s to everyone else") attack when someone solves | Simple, everybody understands it, produces a snowball. |
| The clock resets every round | A bad round does not take you out of the rest of the game. |
| Each letter pays time only once per position | Prevents farming time by repeating letters. |
| Yellow and then green adds 10 in total, the same as a direct green | Consistency; no route is more profitable than another. |
| The same word for everyone each round | Without that the comparison is not fair. |
| No text chat, only emotes | Less toxicity, faster, Clash Royale style. |
| Stack confirmed (2026-09-11): backend NestJS 11 + Socket.IO with rooms in memory; frontend React 19 + Vite + Tailwind + Zustand. Two independent services on Railway. | The user delegated the choice; the simplest one that delivers real time and separate deployment was taken. |
| Word bank as JSON inside the backend, not in a database | Fixed, small, read-only lists; a database would be one more service with no benefit. |
| Accents ignored (limón = limon), Ñ is a letter of its own | Keyboard with Ñ in Spanish rooms; typing accents on an on-screen keyboard is awkward. |
| The hint reveals only the letter, not the position (2026-09-11) | With the position it was almost a free green; only the letter keeps the challenge. |
| Answers = base forms only, neutral Spanish, ~900 per language (870 ES / 898 EN, 2026-09-11) | Guessing "asume" against "asumo" is luck, not skill; vosotros forms and Spain-only words are not neutral. Conjugations are still valid as guesses. |
| List of valid Spanish guesses = dictionary only; no subtitle corpus (2026-09-11) | The corpus accepted English words (CLOUD) in Spanish rooms. |
| Session in localStorage and automatic re-entry while the game is still running (2026-09-11) | Closing the tab or losing internet must not take you out of the game. |
| Room lifetime: 10 min empty in the lobby, 5 min after finishing; no new round if nobody is connected (2026-09-11) | Memory hygiene; the real cost is negligible. |
| Interface language selector (ES/EN) and theme selector (light/dark) visible in the top bar of every screen | They were missing from the design; the user asked for them on 2026-09-11. The interface language is independent of the language of the room's words. |
| Leaving a room is explicit and final (2026-09-11): "Salir de la partida" in the top bar of the game and the results, with confirmation; the seat is freed, the token stops working, the round no longer waits for the leaver and the host passes to the oldest remaining connected player | A player who walks away must not freeze the round for everybody else, and a seat nobody will come back to must not hold up the room. |
| One game at a time per browser (2026-09-11): the home page with a live session shows a "partida en curso" card (Resume / Leave it) instead of the create and join forms; creating or joining with a live session is refused by the client and by the server (`already_in_room`); a second tab takes the seat and the older one shows "abierta en otra pestaña" with "Usar esta pestaña" | The session is a single slot. Letting somebody start a second game left the first membership dangling and made "which game do I go back to" an accident. |

## Discarded ideas

| Idea | Why it was discarded |
|---|---|
| Points per attempt with a lot of weight (220 − 20 × attempt) | Rewarded caution. Speed is what is wanted. |
| Attack bar charged with greens (time theft, scrambled keyboard, sealed letters, fog, freeze) | Replaced by the automatic −5 s. Simpler for a first version. Can be brought back later. |
| "Fake letter" (marking in yellow a letter that is not there) | Breaks trust in the board; people stop reasoning. If it comes back, as a room option off by default. |
| A flat zero for not solving | The consolation of 5 per green was preferred, to keep people in the game. |

## Pending decisions
- **Name of the game.** "WordRush" is a placeholder.
- **Light or dark mode as the main one.** The canvas brings both so one can be chosen.
- **Static mockups vs. clickable prototype.** The first design delivery is static.
- **What happens if a player disconnects mid-round** (does it count 0? does it pause?).
- **Round options.** The selector offers 1, 3, 5 and 10. Decide whether to add 2 (or a free field between 1 and 10).
- **Name of the language of the words.** The room card always shows the endonym (Español / English) even when the interface is in the other language. This is deliberate; confirm it.
