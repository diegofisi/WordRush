# WordRush · Multiplayer Wordle

Guess the word before everyone else. Every new letter adds seconds to your clock, every
rival solve takes seconds away, and whoever finishes with the most clock wins. Rooms of 2
to 8 players (plus 2 observers), words of 5, 6 or 7 letters in Spanish or English, one
hint per round, emote reactions, a chat, and an accumulated leaderboard across rounds.

**v1.1** (2026-09-15) adds: word length 5 / 6 / 7 with 8 / 9 / 10 attempts, a hint that
reveals a new letter or places a known one, **team mode** (one clock, one hint and one
score per team, teammates' boards live), a **chat** (finished players only while a round
runs, team channel, everybody between rounds), **observers** who join a running game and
take a seat next round, host **kick**, a QR of the room link, every board on the results
screen, four sound cues, and a second game on the same rooms: **Adivina la frase** (a
hidden phrase revealed only by the letters of the words you type, five sends to complete
it). Rules: [docs/context/06-v1.1.md](docs/context/06-v1.1.md).

Game rules and the scoring formula live in [docs/context/](docs/context/).
The approved design is in [docs/design/](docs/design/).

## Structure

```
backend/    NestJS 11 + Socket.IO. Rooms live in memory; the word, clocks and points live here.
frontend/   React 19 + Vite + Tailwind. Web client, desktop and phone, light/dark, ES/EN UI.
docs/       context (rules, decisions) and design (Claude Design canvas).
scripts/    sync-contract.mjs (copies the event contract to the frontend), build-words.mjs, build-phrases.mjs.
```

The two services are independent packages, each with its own `package.json` and
lockfile. They share exactly one file: the Socket.IO event contract at
`backend/src/shared/contract/index.ts`. The backend owns it; after changing it, run
`pnpm sync-contract` from the root to refresh the frontend copy (`pnpm check-contract`
verifies they match).

## Run locally

Requirements: Node 22 or newer and pnpm.

```bash
# terminal 1 · server on http://localhost:3000
cd backend
pnpm install
pnpm start:dev

# terminal 2 · client on http://localhost:5173
cd frontend
pnpm install
pnpm dev
```

The client targets `http://localhost:3000` by default. For another server, create
`frontend/.env` with `VITE_SOCKET_URL=http://host:port`.

Server tests: `cd backend && pnpm test`.

## Deploy on Railway

The project is live:

| Service | URL |
|---|---|
| backend | https://wordrush-api.up.railway.app (health check at `/health`) |
| frontend | https://wordrush.up.railway.app |

One Railway project (`WordRush`) with **two services**. They were created and are deployed
with the Railway CLI from a clean export of the last commit, so shipping a change is:

```bash
git commit -am "..."                              # deploys upload what is committed
pnpm deploy                                       # both; or pnpm deploy:backend / pnpm deploy:frontend
railway service status --service backend --json   # SUCCESS when done
```

Requirements: `npm i -g @railway/cli`, `railway login`, and `railway link` once from the
repo root (project `WordRush`, environment `production`). The script
`scripts/railway-deploy.mjs` exports each folder with `git archive` to a temp dir before
`railway up`; that is the workaround for the CLI failing with `prefix not found` on
subfolders of a git repo.

If you prefer automatic deploys on push, connect GitHub to each service in the Railway UI
and set its Root Directory (`backend` / `frontend`). The manual setup from scratch follows.

### 1. `backend` service
- Settings → Source → **Root Directory**: `backend`.
- Railway picks up `railway.json`: Nixpacks build, start `node dist/main.js`, health
  check on `/health`.
- Settings → Networking → **Generate Domain**. Note the URL, e.g.
  `https://wordrush-api.up.railway.app`.
- Variables:
  - `FRONTEND_URL` = the public URL of the frontend (step 2). Several origins can be
    separated by commas.
  - `PORT` is set by Railway; do not define it.

### 2. `frontend` service
- Settings → Source → **Root Directory**: `frontend`.
- `railway.json` builds with Vite and serves `dist/` with `serve` (SPA fallback).
- Settings → Networking → **Generate Domain**.
- Variables (read **at build time**, so redeploy after changing them):
  - `VITE_SOCKET_URL` = the public URL of the backend from step 1.

### 3. Close the loop
Go back to the backend and set `FRONTEND_URL` to the domain Railway generated for the
frontend. Redeploy both. Open the frontend, create a room and join from another browser
with the code.

If nothing connects, check the browser console: a CORS error means `FRONTEND_URL` does
not exactly match the frontend origin (include `https://`, no trailing slash).

Optional: under Settings → Build, set **Watch Paths** to `backend/**` and `frontend/**`
respectively so each service only redeploys when its own folder changes.

## Word bank

Lives in the repository as JSON, not in a database: one file per language and word
length in `backend/src/modules/words/data/` (`es.json`, `es6.json`, `es7.json`, `en.json`,
`en6.json`, `en7.json`), each with `answers` (words the game picks) and `allowed` (valid
guesses, a superset of the answers). Loaded into memory
at boot. Reason: fixed, small (under 200 KB), read-only lists; a database would add a
service without adding anything.

They are generated by `scripts/build-words.mjs` from public word lists. Valid guesses
come only from dictionaries of the language (no subtitle corpora, which mix languages);
answers are the most frequent of those, with proper nouns and offensive words removed. A
Spanish room accepts only Spanish and an English room only English. The script documents
its sources. Accents are ignored (`limón` and `limon` are the same word) and `ñ` is a
letter of its own.

| Language | Letters | Words the game picks | Valid guesses |
|---|---|---|---|
| Spanish | 5 | 1060 | 10835 |
| Spanish | 6 | 1000 | 25409 |
| Spanish | 7 | 900 | 49133 |
| English | 5 | 1300 | 10202 |
| English | 6 | 1000 | 14132 |
| English | 7 | 900 | 16320 |

Answers are **base forms only** (infinitives, singular nouns, masculine singular
adjectives; in English no plurals or past tenses), in neutral Spanish, the most used words
of the language, sorted from most to least frequent. The picker favours the head of the
list. The lists are deliberately far below Wordle's ~2300: no regionalisms, no profanity,
no proper nouns, and none of the tail of rare words that appears past the ~900 most used.
To widen them, change `EN_ANSWERS` / `ES_ANSWERS` in the script and regenerate.

## Phrase bank

"Adivina la frase" picks from `backend/src/modules/words/data/phrases.{es,en}.json`:
sayings and everyday expressions, 4 to 8 words, curated by hand inside
`scripts/build-phrases.mjs` (299 Spanish, 285 English on 2026-09-15). The script only
validates the shape and writes the files; run `node scripts/build-phrases.mjs` after
editing the lists. Accents are stripped at play time like the word lists, so "más" and
"mas" are the same phrase.

## Changing rules

First in `docs/context/` (with date and reason in `04-decisions-and-pending.md`), then
in the code. The scoring numbers live in one place: the `SCORING` constant of the
contract.
