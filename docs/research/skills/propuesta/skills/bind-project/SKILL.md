---
name: bind-project
description: >
  Bind the universal backend/frontend skills to this repository: detect the stack,
  ask only what cannot be inferred, and generate .claude/ (project.md per skill,
  per-path rules, corrections.md, settings.json, hooks), a root `verify` script and
  the CLAUDE.md pointers. Use when asked to set up a new project, bind or re-bind
  the skills, configure Claude for this repo, or after the stack changes (new
  framework, new package, workspace split).
---

# Bind the skills to this repository

The doctrine skills are portable and blind to the repo. This skill writes the layer
that is only true here, so the doctrine stops guessing. Output is committed files,
not conversation.

Never invent a fact about the stack. Everything in the generated files is either read
from the repo or answered by the user.

## Workflow

### A. Inspect before asking

Read, do not ask. Budget: one pass, no more than ~20 file reads.

- Manifests: every `package.json` (root and workspaces), `pnpm-workspace.yaml`,
  `turbo.json`, `nx.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`.
- Lockfile — it names the package manager: `pnpm-lock.yaml` / `package-lock.json` /
  `yarn.lock` / `bun.lockb`.
- Dependencies, for the doctrine's Applies table. Look for: `@nestjs/*`, `express`,
  `fastify`, `react`, `next`, `vite`, `typeorm`, `prisma`, `drizzle-orm`, `mongoose`,
  `bullmq`, `socket.io`, `@tanstack/react-query`, `swr`, `zustand`, `redux`,
  `tailwindcss`, `@mui/material`, `react-hook-form`, `zod`, `class-validator`,
  `vitest`, `jest`, `@playwright/test`, `cypress`, `storybook`.
- `tsconfig.json` files (how many, where, strictness, path aliases).
- Scripts in `package.json`: which of `typecheck`, `lint`, `test`, `build`, `format`
  already exist, and under what names.
- `.github/workflows/*`, `Dockerfile`, `railway.json`, `vercel.json`, `fly.toml`,
  deploy scripts under `scripts/`.
- Existing docs: `docs/`, `ADR/`, `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`,
  `.cursorrules`, and any `.claude/` already present.
- Source tree shape: top-level dirs, and per side the folder that holds routes /
  controllers / gateways and the folder that holds features or pages.

Summarise the detection to the user in ten lines or fewer before step B, so a wrong
guess is corrected there and not in the generated files.

### B. Ask only what cannot be inferred

One round, **at most four questions**, with the `AskUserQuestion` tool. Never ask
anything step A can answer. Pick the four that matter most here, from:

1. **Source of truth for business rules** — which folder or document decides the
   rules, and whether a rule change is recorded there before the code changes.
2. **Official verification commands** — the exact commands that must pass, in order,
   before any task is reported done.
3. **Non-negotiable conventions** — the two or three the user always corrects
   (naming, layering, error shape, commit format).
4. **Forbidden areas** — paths the agent must not touch (generated contracts,
   migrations, secrets, vendored code) and commands it must not run (deploy,
   destructive DB).
5. **Language of documentation and of the user-facing UI** — they are often
   different.

Offer detected values as the default option in each question, so the usual answer is
one click.

### C. Generate

In this order. Nothing outside `.claude/`, `CLAUDE.md`, the root `package.json` and
the optional workflow is created or modified.

1. `.claude/skills/<side>/references/project.md`, one per side that exists, from
   `references/project.md.template`. Fill the **Applies / does not apply** table over
   every doctrine topic; "does not apply" needs a reason ("no database in v1"), not a
   blank. Record: package manager, workspace layout, module/feature map, transport,
   state management, form and validation libraries, test runner, aliases, the exact
   verification commands, and the invariants from question 1.
2. `.claude/skills/<side>/references/project-pitfalls.md` from
   `project-pitfalls.md.template` — **empty**, with the header only. It fills up as
   mistakes get paid for; a seeded pitfalls file from another project is worse than
   no file, because the doctrine orders it read before every change.
3. Rewrite each skill's frontmatter `description` with this repo's real trigger words
   — the actual framework, the actual folder names, the actual nouns the user types.
   The description is the only text read before the skill loads; a description that
   names a library the repo does not use is the main reason a skill loads at the
   wrong time or not at all.
4. `.claude/rules/*.md` from `rules/templates/`, one per path that exists here. Keep
   the `paths:` frontmatter pointing at real globs — delete a template whose paths do
   not exist rather than shipping a rule that never triggers. Always include
   `verification.md` and `git.md`.
5. `.claude/corrections.md` from `corrections.md.template`, seeded with its generic
   lines only.
6. `.claude/settings.json` from `settings/settings.json.template`: strip every key
   whose name starts with `_` (they are the template's comments), substitute the
   detected package manager, drop the `Stop` entry if the repo has no TypeScript, and
   copy `.claude/hooks/format.mjs` and `.claude/hooks/stop-typecheck.mjs`. Keep
   deploy and destructive commands out of `permissions.allow`. If a `settings.json`
   already exists, merge into it and show the diff; never overwrite.
7. A root `verify` script in `package.json` chaining the answers to question 2 with
   `&&` (never `;` — with `;` a failing step is followed by a passing one and the run
   reads green). Example shape:
   `"verify": "pnpm -r typecheck && pnpm -r lint:check && pnpm -r test && pnpm -r build"`.
8. Optional `.github/workflows/verify.yml`: checkout, setup node with the detected
   package manager, install, `run verify`. Only if the user wants CI; skip silently
   otherwise.
9. Three lines in `CLAUDE.md` (create it if missing), pointing at the source of
   truth, at `.claude/corrections.md`, and at the `verify` command. Append; do not
   rewrite an existing `CLAUDE.md`.

### D. Approval gate

After step C.1, **stop**. Show the generated `project.md` (each side) in full and ask
for approval. Do not write C.2–C.9 until the user approves. Everything downstream
repeats the facts in `project.md`, so a wrong fact approved here costs one edit and
an unapproved one costs nine.

### E. Verify

Run the `verify` script once, from the repo root. Report the result verbatim: the
command, the exit status, and the first failing step if any. Do not fix the repo's
pre-existing failures as part of binding — report them and let the user decide. A red
`verify` at binding time is still a successful binding: the point is that the command
exists and is honest.

## Re-binding

Run when the stack changes: a framework added or dropped, a workspace split, the test
runner replaced, verification commands renamed.

- Re-run step A and diff the detection against the current `project.md`.
- Show only the rows of the Applies table that change, and ask about those.
- Rewrite `project.md` and any `.claude/rules/*.md` whose `paths:` no longer match
  anything.
- **Never touch `project-pitfalls.md` or `corrections.md`.** They are history; a
  stack change does not undo a mistake that was already paid for.
- Re-run `verify` and report.

## Done when

- `project.md` exists per side, approved, with no blank cells in the Applies table.
- Every `paths:` glob in `.claude/rules/` matches at least one real file.
- `settings.json` parses and carries `includeCoAuthoredBy: false`.
- `verify` runs from the root and its output was shown to the user.
