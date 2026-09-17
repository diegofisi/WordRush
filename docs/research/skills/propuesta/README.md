# Claude Code skill package (universal)

A portable harness: doctrine that is true in any repo, plus one binding step that
writes down what is only true in *this* repo.

Two layers, and the lower one always wins:

| Layer | Lives in | Written by | Changes |
|---|---|---|---|
| Doctrine | `skills/backend/SKILL.md`, `skills/frontend/SKILL.md` + `references/` | once, by hand | rarely |
| Binding | `.claude/skills/*/references/project.md`, `.claude/rules/`, `.claude/settings.json` | the `bind-project` skill | per repo |
| Reality | the code | — | always wins over both |

The doctrine ships an "Applies / does not apply" table over its own topics. Binding
fills that table for the repo at hand, so the agent never argues from a framework the
project does not use.

## What is in here

```
README.md                      this file
skills/backend/                universal server doctrine + references/*.template
skills/frontend/               universal client doctrine + references/*.template
skills/bind-project/SKILL.md   the binding skill (inspect, ask, generate, verify)
agents/verifier.md             review subagent with no Write/Edit
corrections.md.template        cross-session memory of repeated corrections
rules/templates/*.md           per-path rules with `paths:` frontmatter
settings/settings.json.template  attribution off, hooks wired, permissions notes
hooks/format.mjs               PostToolUse: format the edited file
hooks/stop-typecheck.mjs       Stop: batched `tsc --noEmit`, report only
```

## Install

**Globally** (available in every repo, nothing committed):

```
~/.claude/skills/backend/
~/.claude/skills/frontend/
~/.claude/skills/bind-project/
~/.claude/agents/verifier.md
```

Copy the four directories/files there. Global skills carry the doctrine only; they
read `references/project.md` from the repo when one exists.

**Per repo** (committed, reviewable in PRs) — what `bind-project` generates:

```
.claude/skills/backend/references/project.md
.claude/skills/frontend/references/project.md
.claude/skills/*/references/project-pitfalls.md
.claude/rules/*.md
.claude/corrections.md
.claude/settings.json
.claude/hooks/format.mjs
.claude/hooks/stop-typecheck.mjs
.claude/agents/verifier.md          (optional; only if not installed globally)
```

Rule of thumb: doctrine global, binding committed. A repo-local `.claude/skills/backend/`
overrides the global one of the same name, so a project that needs different doctrine
copies the whole skill instead of editing the global one.

## New project in five steps

1. `git init` (or clone), install dependencies, get the project to build once.
2. Ask Claude: **"bind skills to this repo"**. The `bind-project` skill inspects the
   manifests and lockfiles first, then asks at most four questions.
3. Approve the generated `project.md` for each side. Nothing else is written until
   you do.
4. `bind-project` writes the rest (rules, settings, hooks, corrections, `verify`
   script, optional CI workflow, three lines in `CLAUDE.md`) and runs `verify` once.
5. Commit `.claude/` and `CLAUDE.md`. From then on: corrections you have to repeat go
   as one dated line into `.claude/corrections.md`; the verifier reviews anything
   larger than one file.

Re-run step 2 whenever the stack changes — see "Re-binding" in
`skills/bind-project/SKILL.md`.

## Provenance

Borrowed, with changes, from `docs/research/skills/repos/ECC/`:

- `agents/code-reviewer.md` — the `### It Is Acceptable And Expected To Return Zero
  Findings` block, the Pre-Report Gate and `## Common False Positives - Skip These`.
- `agents/planner.md` — tool restriction (`tools: Read, Grep, Glob`) as the enforcement
  mechanism rather than an instruction.
- `agents/typescript-reviewer.md` — establishing diff scope without hard-coding `main`,
  running typecheck/lint before opining, "you report findings only".
- `rules/common/git-workflow.md` — `includeCoAuthoredBy: false` in settings rather than
  a prose request.
- `scripts/hooks/stop-format-typecheck.js` — batching typecheck at `Stop` instead of
  per edit, with a time budget.

The rest (binding step, `project.md` that wins over doctrine, per-path rules,
progressive disclosure through `references/`) is this repo's own shape; see
`docs/research/skills/02-skills-mcp-ecc.md`.
