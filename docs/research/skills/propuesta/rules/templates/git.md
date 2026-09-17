---
paths:
  - '**'
---

# Git

- **No attribution trailers.** No `Co-Authored-By: Claude`, no "Generated with
  Claude", no AI attribution in commit messages, PR bodies or file headers. This is
  enforced in `.claude/settings.json` (`includeCoAuthoredBy: false`, empty
  `attribution`), which is the mechanism; this line is the reminder for the cases a
  setting cannot reach — a trailer typed into a message by hand. After committing,
  check `git log -1 --format=%B` and amend if one slipped in.
- **No commits and no pushes unless asked.** Staging and committing are not part of
  "finish the task". When asked to commit, commit; pushing is a separate request.
- **Branch before committing on the main branch.** If `HEAD` is on `main`/`master`,
  create a branch first. Never commit directly to the default branch.
- **Never rewrite shared history.** No `push --force` (use `--force-with-lease` and
  only when asked), no rebase of a branch someone else has, no `reset --hard` on work
  that is not yours to discard.
- **Never bypass hooks**: no `--no-verify`, no `-c core.hooksPath=`.
- **One logical change per commit.** Do not bundle an unrelated refactor or a
  formatter sweep with a fix; the diff is what review reads.
- Commit subject: imperative, present tense, under ~72 characters, saying what
  changed and why if it is not obvious. Follow whatever format `project.md` records
  (conventional commits or plain prose) — do not introduce a new one.
- **Never commit secrets.** Check the diff for keys and tokens (`sk-`, `ghp_`,
  `AKIA`, `xox`), `.env` files and credential blobs before staging.
