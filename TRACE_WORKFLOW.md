# NetHack Trace-Based Improvement Workflow

## Overview

Use selfplay agent to generate gameplay traces from C NetHack, then systematically improve the JS implementation to match C behavior.

## Workflow

### 1. Capture Traces

Generate interesting gameplay situations:

```bash
node selfplay/runner/trace_capturer.js --count=10 --turns=100
```

This captures traces with different seeds and saves the most interesting ones to `traces/captured/`.

**Interestingness scoring:**
- Combat encounters: +3 per fight
- Item usage (potions): +5
- Prayer: +10
- Low HP situations: +2
- Deeper dungeons: +5 per level
- Longer games: bonus points

### 2. Review Traces

Examine captured traces to find interesting discrepancies:

```bash
ls -lh traces/captured/
cat traces/captured/trace_SEED_role_scoreNN.json
```

Look for:
- Combat mechanics differences
- Item behavior mismatches
- Monster AI discrepancies
- Dungeon generation issues
- UI/display differences

### 3. Create BD Issues

For each interesting trace, create a tracking issue:

```bash
bd create \
  --title="Trace SEED: [brief description]" \
  --type=task \
  --priority=2 \
  --notes="traces/captured/trace_SEED_role_scoreNN.json"
```

Tag with `trace-improvement` label and note specific turns of interest.

### 4. Work on Trace (12-hour cycle)

**Choose one trace to work on:**

1. Select highest priority unassigned trace issue
2. Mark as in_progress: `bd update ISSUE_ID --status=in_progress`
3. Analyze the specific gameplay situation
4. Identify JS code that needs improvement
5. Implement fixes/improvements
6. Test against the trace
7. Commit and push incremental work
8. Close issue when complete: `bd close ISSUE_ID`

### 5. Implementation Process

For each trace issue:

```bash
# 1. Study the trace
cat traces/captured/trace_SEED_role_scoreNN.json | jq '.interesting'

# 2. Reproduce in C NetHack (if needed)
node selfplay/runner/c_runner.js --seed=SEED --turns=100

# 3. Test in JS NetHack
node selfplay/runner/headless_runner.js --seed=SEED --turns=100

# 4. Identify discrepancies
# Compare turn-by-turn: HP changes, position, actions, outcomes

# 5. Fix JS implementation
# Edit relevant js/*.js files

# 6. Commit frequently
git add js/file.js
git commit -m "Fix [specific behavior] to match C NetHack (trace SEED)"
git push

# 7. Verify fix
node selfplay/runner/headless_runner.js --seed=SEED --turns=100

# 8. Close issue
bd close ISSUE_ID --reason="Fixed [description]"
```

## Schedule

- **Every 12 hours:** Choose one trace to work on
- **Commit frequently:** Push incremental improvements
- **Document findings:** Note behavior differences in commits

## Trace Categories

Prioritize traces that exercise:

1. **Combat mechanics** - Attack/defense, damage calculation, monster AI
2. **Item interactions** - Potions, scrolls, wands, food
3. **Dungeon features** - Doors, traps, stairs, fountains, altars
4. **Special rooms** - Shops, vaults, temples, throne rooms
5. **Status effects** - Hunger, poison, sickness, confusion
6. **Multi-level navigation** - Stairs, level memory, persistence

## Example Issue Format

```
Title: Trace 42157: Combat damage calculation mismatch

Type: task
Priority: 2

Description:
Agent fights kobold on Dlvl 1 (turns 15-20).
C version: Player takes 2 damage per hit
JS version: Player takes 1 damage per hit

Trace: traces/captured/trace_42157_valkyrie_score34.json
Turns of interest: 15, 17, 19

Action: Fix damage calculation in js/combat.js to match C formula
```

## Tips

- Focus on **gameplay differences**, not cosmetic issues
- Prioritize **frequent situations** over rare edge cases
- Commit **working improvements**, even if incomplete
- Document **why C behavior is correct** in commit messages
- Use traces as **regression tests** for future changes

## Maintenance

- Review open trace issues weekly
- Archive completed traces to `traces/completed/`
- Generate new traces monthly to find new issues
- Update this workflow as process improves
