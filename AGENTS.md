# Agent Instructions

This project uses **GitHub Issues** for issue tracking.

## Project Authority

- `PROJECT_PLAN.md` is the overarching project plan and the authoritative source for project goals, scope, and milestone priorities.

## Quick Reference

```bash
gh issue list --state open                    # Find available work
gh issue view <number>                        # View issue details
gh issue edit <number> --add-label "agent:<name>"      # Claim work for this agent
gh issue edit <number> --remove-label "agent:<name>"   # Unclaim for this agent
gh issue close <number> --comment "Done"      # Complete work
gh issue comment <number> --body "Status..."  # Post progress updates
```

## Issue Dependencies

Use explicit dependency links in every scoped issue:
- `Blocked by #<issue>`
- `Blocks #<issue>`

Operational rules:
- Apply `blocked` label when prerequisites are open.
- Apply `has-dependents` label when the issue gates others.
- Keep workflow status in sync (`Ready`, `Blocked`, `In Progress`, `Done`).
- Default: do not start `In Progress` while declared blockers are open.
- Exception: if a blocker advisory is stale/incorrect, proceed opportunistically and fix dependency links/labels in the same work cycle.

Recommended parent/child pattern:
- Parent issue tracks outcome and acceptance criteria.
- Child issues track concrete implementation/test/doc tasks.
- Parent includes a checklist linking child issues.

## Issue Hygiene

- Run periodic issue triage (`gh issue list --state open`) to keep tracking current.
- Close obsolete or superseded issues with a clear reason in the closing comment.
- When new information is discovered, update the relevant issue immediately (body, labels, and status comment).

## Agent Ownership and Intake

- Agent name is the current working directory name; use it as the identity for issue ownership.
- Directory/topic affinity is only suggestive; any agent may take any issue.
- If you have no pending task, pull another actionable open issue.
- If starting new work not already tracked, create/update a GitHub issue immediately.
- Track issue ownership by agent label, where `<name>` is the working-directory basename.
- Use at most one `agent:*` label in normal flow; 0 labels is allowed for unowned issues.
- Temporary overlap (2 `agent:*` labels) is allowed only during explicit handoff and should be cleaned up promptly.
- When starting work, add your label: `gh issue edit <number> --add-label "agent:<name>"`
- If intentionally abandoning, remove your label: `gh issue edit <number> --remove-label "agent:<name>"`
- If you complete work on an issue assigned to another agent, proceed and resolve it; leave a detailed closing/update comment so the original assignee has full context.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- When multiple developers are active, commit and push meaningful incremental improvements as they are validated (do not batch too long locally).

## Documentation Hygiene

- If you encounter **inaccurate or outdated docs** while working, fix them immediately.
- Don't leave stale information in `docs/` — correct it or remove it.
- Docs should reflect the actual state of the code, not aspirational or historical states.
