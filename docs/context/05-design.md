# 05 · Design

## The user's brief
"A nice design, modern and minimalist but that does not feel empty."
(original: "Bonito diseño, moderno y minimalista pero que no se sienta vacío.")

## Chosen direction
- **Tone:** warm paper, large black type, saturated colour tiles as the only living
  element. Minimalist in structure, dense in game information (rivals, feed, clock).
- **Typefaces:** Bricolage Grotesque (headings and tiles), DM Sans (interface), JetBrains Mono (clock and figures).
- **Colour:** warm white background, warm almost-black ink. Green and yellow are semantic
  to the game. A single accent (violet) for primary actions, so as not to compete with green/yellow.
- **Icons:** stroke SVG, 20 px. The twenty game emotes are raster stickers
  (`frontend/src/assets/emotes/`), never recoloured.
- **No** decorative gradients, no cards with a coloured left border, no system emoji.

## "Create room" hero
Slogan: "Adivina primero. Cada segundo cuenta." ("Guess first. Every second counts.")
Above it, five tiles that flip letter by letter (CSS animation, Wordle reveal style) and
form, on a loop: AHORA → VAMOS → RELOJ → CINCO → JUEGA. Each word lasts 3 s; the last one
comes out all in green before restarting. "Adivina rápido. Róbales el tiempo."
("Guess fast. Steal their time.") was discarded for sounding aggressive for a title.

## Screens on the canvas
1. **Game** (main, desktop 1440×900): your own board, keyboard with Ñ, big clock,
   rivals panel in colours, event feed, hint, emotes, points preview.
2. **Create room**: language, initial time, rounds, capacity, code.
3. **Lobby**: 8 slots, summarised settings, "Listo" ("Ready").
4. **Results**: end of round with the points breakdown and the accumulated table.
5. **Mobile game** (390×844).
6. **Dark game**: the same main screen in dark mode, as an alternative.

## Added during implementation (2026-09-11)
The top bar of every screen carries an interface language selector (ES | EN) and a
light/dark theme button with correct contrast in both modes. They were not on the canvas.

## Sound (2026-09-13)
Seven cues, all synthesised in the browser with WebAudio — no audio files. Short
tones weigh nothing, need no attribution, and cannot arrive late over the
network at the exact moment a round opens.

| Cue | When |
|---|---|
| `start` | the round opens (rising C-E-G) |
| `lowTime` | your clock crosses 15 s (two flat square beeps) |
| `tick` | each of the last five seconds |
| `solved` | **you** solved it |
| `hit` | a solve took time off **your** clock |
| `roundEnd` | the round closed |
| `gameEnd` | the game closed |

Every cue marks something the player would otherwise have to watch the screen
for; none of them is decoration. `solved` and `hit` fire only for the player
themselves — a cue for every rival's solve in an eight-player room would be
noise, and the feed already carries those.

Two details that are not obvious:

- **The last round emits `round:end` and then `game:end` together.** The round
  cue is held for 90 ms so the game cue replaces it instead of the two playing
  over each other.
- **Browsers refuse to open an audio device before the page is touched.** The
  first click or key press opens it, which is why the round-start cue — that
  nobody clicks for — is audible at all.

Off with the speaker button in the top bar, remembered in `localStorage` like
the theme. Master volume is 0.16; the cues are meant to sit under the room.

## Source files
`docs/design/`. Each `.dc.html` is an artboard; `canvas.json` is the layout. The file
`wordrush-multiplayer.html` is the assembled canvas that gets published; it is regenerated
from the others, not edited by hand.

## Link to the canvas
https://claude.ai/code/artifact/2605ee44-424d-413d-86b1-13f80a56cdfe (published on 2026-09-11).
To update it: edit the files in `docs/design/`, reassemble the canvas and publish over that
same URL (passing the URL explicitly, because the file path changed on 2026-09-11).
