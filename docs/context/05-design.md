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

## v1.1 (2026-09-15)
- The hint button becomes impossible to miss: large, pulsing until spent, hints left on it.
  **Revised 2026-09-17:** the pulse, the glow and the count are gone — a plain yellow pill
  reading "Pista" / "Hint", muted and disabled once spent; the count moved to the tooltip.
- **Toasts come up from the bottom (2026-09-17):** bottom right from 640 px (a 360 px
  column, 20 px in), bottom centre on the phone above the keyboard, sliding up as they
  appear. They used to drop from the top right.
- The language of the words (Español / English) sits in the game header as well as the lobby.
- Teams: slots in the lobby are clickable to switch team; the game view shows teammates'
  boards with letters, rivals' with colours; one clock per team; a rounds-won counter.
- Chat panel (text + stickers) with "(Equipo)" / "(Todos)" labels and an observer label.
  While text is locked the composer is the sticker button alone, centred (2026-09-18).
- Observers have their own area; a QR for the room code; connected count in the lobby.
- 7-letter words need a mobile layout pass (tiles and keyboard at ~400 px).
- Results show every board with the word, who solved and the chat of the round.
Rules for all of this: `06-v1.1.md`.

### Guess the phrase (mocked up 2026-09-15)
Canvas: https://claude.ai/artifact/1u8BU1kHjJ5NNzBJh9XShL — artboards in `docs/design/phrase/`
(`Main` desktop normal, `Equipos` desktop teams, `Completar` the modal after a miss, `Movil`),
built with the app's own tokens (dark palette, DM Sans / Bricolage / JetBrains Mono, 52 px
tiles, 44 px keys, 16 px cards). What the mockup settled:
- Minimal header: room code · round · word language; in teams, the rounds score by team
  name ("Los Rápidos 1 · 2 Búhos"). No hint button in this mode.
- Left column: your clock card (44 px mono, bar, time gained) — the team clock card in
  teams — then rivals as **phrase slots** (green where they have a letter, never which),
  scrolling with the app's thin scrollbar. Teams: teammates' letters tried, rival team's
  slots.
- Centre: the phrase card (words as dashed slots, found letters green), a 6-row board of
  the room's word length, the keyboard with a purple **FRASE** key at the end of the last
  row. Phrase, board and keyboard always fit on one screen and never scroll. The 52 px of
  the mockup is a middle value, not a fixed size: since 2026-09-18 the own board takes the
  tile from the free space it is given, between 34 and 73 px on the desktop and 30 and
  44 px on the phone (`docs/context/04-decisions-and-pending.md`, 2026-09-18). Rival,
  teammate and results boards keep their fixed sizes.
- Right column: the chat (one design in both modes: "Escribe un mensaje…", sticker button,
  purple send; while text is not allowed only the sticker button is drawn, centred, and the
  composer opens with a 250 ms move when it is) and the Wordle-style score card ("Si
  completas ahora" → rows → big total; "Tu ronda" once over).
- The modal: "Completa la frase. Recuerda: cada intento te resta 5 puntos. Te quedan N
  intentos." — known letters fixed, missed letters in red, footer "N % de la frase
  completada · mm:ss restantes", Cerrar / Enviar. It stays open on a miss.
- Phone: one rival at a time (name with ellipsis above its slots, rotating); the FRASE
  action is a pill in the phrase card header.

## Source files
`docs/design/`. Each `.dc.html` is an artboard; `canvas.json` is the layout. The file
`wordrush-multiplayer.html` is the assembled canvas that gets published; it is regenerated
from the others, not edited by hand.

## Link to the canvas
https://claude.ai/code/artifact/2605ee44-424d-413d-86b1-13f80a56cdfe (published on 2026-09-11).
To update it: edit the files in `docs/design/`, reassemble the canvas and publish over that
same URL (passing the URL explicitly, because the file path changed on 2026-09-11).
