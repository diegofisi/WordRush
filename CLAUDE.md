# WordRush · Multiplayer Wordle

A game of guessing 5-letter words, multiplayer (up to 8), in Spanish and English,
where the clock rules: you gain time from new letters and lose it when somebody else
solves. "WordRush" is a working name.

## Source of truth
The whole idea, the rules and the decisions live in `docs/context/`. Read it before
touching anything in the game or the design:

- `docs/context/README.md` — index and how to maintain the folder.
- `docs/context/01-concept.md` — what the game is and who it is for.
- `docs/context/02-game-rules.md` — room, rounds, attempts, hint, attack, emotes.
- `docs/context/03-scoring-system.md` — the final formula with a step-by-step simulation.
- `docs/context/04-decisions-and-pending.md` — what was decided, what was discarded, what is missing.
- `docs/context/05-design.md` — visual direction, screens and the link to the Claude Design canvas.

## Repository structure
```
CLAUDE.md
.claude/
  settings.json          project hooks
  hooks/format.mjs       runs Prettier on the edited file (backend/ and frontend/)
  rules/                 per-path rules (they load by themselves when those paths are touched)
  skills/backend/        NestJS + Clean Architecture doctrine (read references/project.md first)
  skills/frontend/       React + vertical slices + adapter doctrine (read references/project.md first)
docs/
  context/               rules, scoring, decisions (source of truth)
  design/                Claude Design canvas artboards and the assembled canvas
backend/                 API + WebSockets (NestJS).
frontend/                web client (React + Vite).
```

## How to work here
- Server work: use the `backend` skill. Interface work: use the `frontend` skill.
  Each one has a `references/project.md` that ties the doctrine to this project; that file
  is updated whenever the stack or the module map changes.
- Any change to the rules or the scoring is recorded first in `docs/context/` and only then
  in the code or the design.
- The server is the only source of truth for the word, the clock and the score. The client
  never knows the word before the round ends.

## Conventions
- Documentation, file names and code comments in English. The player-facing interface
  exists in Spanish and English (`frontend/src/shared/i18n/`).
- Complete dates in the documents (2026-09-11), never relative ones.
- No commits or pushes unless asked. Commit messages carry no `Co-Authored-By` or AI
  attribution lines, ever.
