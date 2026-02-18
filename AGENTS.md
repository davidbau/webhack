# Agent Instructions

## Purpose
This file defines how coding agents should work in this repository.

This project uses GitHub Issues for work tracking. `PROJECT_PLAN.md` is the authoritative source for goals, scope, and milestone priorities.

## Source of Truth and Priorities
1. NetHack C 3.7.0 behavior is the gameplay source of truth.
2. `PROJECT_PLAN.md` is the execution roadmap and phase gate definition.
3. Test harness outputs are evidence for divergences, not a place to hide or special-case them.

## Work Types and Primary Metrics
1. Porting Work
   Primary metric: reduce first divergence and increase matched PRNG log prefix against C.
   Debug focus: PRNG call context and first-mismatch localization.
2. Selfplay Agent Work
   Primary metric: held-out improvement after training-set tuning.
   Competence focus: survival, exploration breadth, depth progression, and interaction quality (combat, inventory, item use, magic/abilities).
3. Test Infrastructure Work
   Primary metric: developer insight speed.
   Requirements: tests run fast enough to avoid blocking developers and failures provide actionable debug detail.
   Scope may include deterministic replay tooling, diagnostics, and code coverage.
   Constraint: infrastructure reveals bugs; it must not solve or mask them.

## Non-Negotiable Engineering Rules
1. Fix behavior in core JS game code, not by patching comparator/harness logic.
2. Keep harness simple, deterministic, and high-signal for debugging.
3. Never normalize away real mismatches (RNG/state/screen/typgrid) just to pass tests.
4. Keep changes incremental and test-backed.
5. Preserve deterministic controls (seed, datetime, terminal geometry, options/symbol mode).

## Development Cycle
1. Identify a failing parity behavior from sessions/tests.
2. Confirm expected behavior from C source.
3. Implement faithful JS core fix that matches C logic.
4. Run relevant tests/sessions (and held-out eval where applicable).
5. Record learnings in `docs/LORE.md` for porting work and `selfplay/LEARNINGS.md` for agent work.
6. Commit only validated improvements.

## Long-Run Regeneration Discipline
When running rebuilds/regenerations that can take several minutes:
1. Do a short preflight first (single seed/single fixture) to confirm setup and output shape.
2. Start the full run only after preflight output looks correct.
3. Monitor partial output during the run (periodic status polls, milestone checks, first-output sanity).
4. Treat stalls or suspicious output as actionable: stop early, fix setup, restart, do not wait for full completion.
5. Keep logs/checkpoints so partial progress can be inspected and reported while work is still running.
6. Report partial status to the user when asked, including what is done, in progress, and next.

## Session and Coverage Expectations
1. Use the canonical key-centered deterministic session format.
2. During translation coverage work, maintain a C-to-JS mapping ledger.
3. For low-coverage parity-critical areas, add targeted deterministic sessions.
4. Keep parity suites green while expanding coverage.

## Agent Work Rules (Selfplay)
These rules apply to coding work focused on selfplay agent quality.

1. Use a 13-seed training set with one seed per NetHack character class.
2. Optimize agent behavior against that 13-class training set.
3. Before committing, run a held-out evaluation on a different 13-seed set (also one per class).
4. Only commit when held-out results show improvement over baseline.
5. Track not only survival but competence in exploration breadth, dungeon progression, and interaction quality.
6. Keep agent policy/tuning changes separate from parity harness behavior.

## Harness Boundary
Allowed harness changes:
1. Determinism controls
2. Better observability/logging
3. Faster execution that does not change semantics

Not allowed:
1. Comparator exceptions that hide true behavior differences
2. Replay behavior that injects synthetic decisions not in session keys
3. Any workaround that makes failing gameplay look passing

## Issue Dependencies and Hygiene
Use explicit dependency links in every scoped issue:
- `Blocked by #<issue>`
- `Blocks #<issue>`

Operational rules:
- Apply `blocked` label when prerequisites are open.
- Apply `has-dependents` label when an issue gates others.
- Keep workflow status in sync (`Ready`, `Blocked`, `In Progress`, `Done`).
- Default: do not start `In Progress` while declared blockers are open.
- Exception: if a blocker advisory is stale/incorrect, proceed opportunistically and fix links/labels in the same cycle.

Issue hygiene:
- Run periodic triage (`gh issue list --state open`).
- Close obsolete/superseded issues with a clear reason.
- Update issue body/labels/status comments promptly when new evidence changes scope or priority.
- Use `parity` label for C-vs-JS divergence/parity issues in the unified backlog.

## Agent Ownership and Intake
1. Agent name is the current working directory basename; use it as identity for issue ownership.
2. Directory/topic affinity is suggestive only; any agent may take any issue.
3. If no pending task exists, pull another actionable open issue.
4. If starting work not tracked yet, create/update a GitHub issue immediately.
5. Issues are unowned by default; do not assign ownership labels until work is actively claimed.
6. Track ownership with `agent:<name>` label only while actively working.
7. Use at most one `agent:*` label in normal flow; temporary overlap is allowed only during explicit handoff.
8. When starting work: `gh issue edit <number> --add-label "agent:<name>"`
9. If intentionally abandoning: `gh issue edit <number> --remove-label "agent:<name>"`
10. If you complete work on an issue assigned to another agent, proceed and resolve it; leave a detailed closing/update comment so the original assignee has full context.

## Practical Commands
- Install/run basics: see `docs/DEVELOPMENT.md`.
- Issue workflow quick reference:

```bash
gh issue list --state open
gh issue view <number>
gh issue edit <number> --add-label "agent:<name>"
gh issue edit <number> --remove-label "agent:<name>"
gh issue close <number> --comment "Done"
gh issue comment <number> --body "Status..."
```

- RNG divergence triage quick reference:

```bash
# Reproduce one session with JS caller-tagged RNG entries
RNG_LOG_TAGS=1 \
node test/comparison/session_test_runner.js --verbose <session-path>

# Inspect first mismatch window for one step
node test/comparison/rng_step_diff.js <session-path> --step <N> --window 8
```

`RNG_LOG_PARENT=0` can be used to shorten tags if needed.

## Priority Docs (Read Order)
1. Always start with:
   - `PROJECT_PLAN.md`
   - `docs/DEVELOPMENT.md`
   - `docs/LORE.md`
2. For porting/parity divergence work:
   - `docs/SESSION_FORMAT_V3.md`
   - `docs/RNG_ALIGNMENT_GUIDE.md`
   - `docs/C_PARITY_WORKLIST.md`
3. For special-level parity work:
   - `docs/SPECIAL_LEVELS_PARITY_2026-02-14.md`
   - `docs/special-levels/SPECIAL_LEVELS_TESTING.md`
4. For selfplay agent work:
   - `selfplay/LEARNINGS.md`
   - `docs/SELFPLAY_C_LEARNINGS_2026-02-14.md`
   - `docs/agent/EXPLORATION_ANALYSIS.md`
5. For known issue deep-dives:
   - `docs/bugs/pet-ai-rng-divergence.md`
   - `docs/NONWIZARD_PARITY_NOTES_2026-02-17.md`

## Completion Discipline
When a task is complete:
1. File issues for any remaining follow-up work.
2. Run relevant quality gates.
3. Update issue status.
4. Pull/rebase and push (do not leave validated work stranded locally):
   ```bash
   git pull --rebase
   git push
   git status
   ```
5. Verify changes are committed and pushed.
6. Report what changed, what was validated, and remaining risks.

Critical rules:
- Work is NOT complete until `git push` succeeds.
- NEVER stop before pushing — that leaves work stranded locally.
- NEVER say "ready to push when you are" — YOU must push.
- If push fails, resolve and retry until it succeeds.
- When multiple developers are active, push meaningful validated increments rather than batching too long locally.

## Documentation Hygiene
1. If docs are inaccurate or stale, fix or remove them immediately.
2. Keep `docs/` aligned to actual code behavior and active workflows.
