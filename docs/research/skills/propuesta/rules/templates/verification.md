---
paths:
  - '**'
---

# Verification

What must be green before any task is reported done. This rule is always active;
`project.md` holds the exact commands for this repo.

- **One command.** The root `verify` script chains the official commands with `&&`.
  Run `<pm> verify` from the repo root. Never with `;`: a failing step followed by a
  passing one reads green and broken work gets reported as done.
- **Run it, do not reason about it.** A command that was not executed did not pass.
  Quote the command and its exit status when reporting a task complete.
- **Changed code needs a test or a reason.** New behaviour: a test. Bug fix: a test
  that fails without the fix. If neither is possible, say why in one line.
- **Never make the check pass by weakening it.** Do not delete, skip or `.only` a
  test, loosen an assertion, add a suppression comment, relax `tsconfig`, disable a
  lint rule, or edit the formatter config to accommodate the code. Fix the code. If
  the check itself is genuinely wrong, say so and stop — changing it is a separate,
  announced task.
- **Never bypass the gate.** No `--no-verify`, no `--force`, no skipping hooks.
- **The implementer does not sign off on the implementation.** For anything touching
  more than one file, hand the change to the `verifier` agent and report its verdict.
- **The Stop typecheck hook is a report, not a gate.** It never blocks; a clean hook
  output is not a substitute for running `verify`.
- **Three attempts.** If the same failure survives three fixes, stop and escalate
  with the full history instead of trying a fourth approach.
