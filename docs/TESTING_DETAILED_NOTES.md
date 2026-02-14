# Detailed Test Notes System

This document describes the enhanced test tracking system for capturing granular
test results, session step coverage, and code metrics across the project's history.

## Goals

1. **Track individual test results** — Know exactly which tests pass/fail at each commit
2. **Track session step coverage** — For multi-step session replays, know where divergence occurs
3. **Track code metrics** — Lines changed, files modified, categorized by type
4. **Enable historical queries** — "When did this test break?", "What's our coverage trend?"
5. **Support backfill** — Efficiently populate data for 1000+ historical commits

## Schema

### Primary Note Format (git notes)

Each commit has a JSON note attached in `refs/notes/test-results`:

```json
{
  "version": 2,
  "commit": "abc1234",
  "parent": "def5678",
  "date": "2026-02-14T10:00:00-05:00",
  "author": "David Bau",
  "message": "Fix monster movement RNG alignment",

  "stats": {
    "total": 1500,
    "pass": 800,
    "fail": 700,
    "skip": 0,
    "duration": 45.2
  },

  "categories": {
    "unit": { "total": 498, "pass": 498, "fail": 0 },
    "chargen": { "total": 90, "pass": 90, "fail": 0 },
    "special": { "total": 84, "pass": 84, "fail": 0 },
    "map": { "total": 60, "pass": 12, "fail": 48 },
    "gameplay": { "total": 72, "pass": 30, "fail": 42 }
  },

  "sessions": {
    "seed1_gameplay": {
      "status": "fail",
      "totalSteps": 72,
      "passedSteps": 45,
      "firstDivergentStep": 46,
      "divergenceType": "rng",
      "coveragePercent": 62.5
    },
    "seed3_selfplay_100turns_gameplay": {
      "status": "fail",
      "totalSteps": 100,
      "passedSteps": 67,
      "firstDivergentStep": 68,
      "coveragePercent": 67.0
    }
  },

  "tests": {
    "pass": ["unit/combat.test.js::melee damage", "comparison/chargen::seed1_archeologist"],
    "fail": ["comparison/gameplay::seed1_gameplay", "comparison/map::seed42_depth3"],
    "skip": []
  },

  "codeMetrics": {
    "filesChanged": 5,
    "linesAdded": 150,
    "linesRemoved": 42,
    "categories": {
      "js": { "files": 3, "added": 120, "removed": 30 },
      "test": { "files": 2, "added": 30, "removed": 12 },
      "docs": { "files": 0, "added": 0, "removed": 0 }
    }
  },

  "regression": false,
  "regressedTests": [],
  "newlyPassing": ["comparison/gameplay::seed42_step30"]
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `version` | int | Schema version (currently 2) |
| `commit` | string | Short commit hash |
| `parent` | string | Parent commit hash |
| `date` | string | ISO 8601 timestamp |
| `author` | string | Commit author |
| `message` | string | First line of commit message |
| `stats` | object | Aggregate test statistics |
| `categories` | object | Per-category breakdown |
| `sessions` | object | Step-level detail for session tests |
| `tests` | object | Lists of passing/failing/skipped test IDs |
| `codeMetrics` | object | Git diff statistics |
| `regression` | boolean | True if any tests regressed |
| `regressedTests` | array | Test IDs that were passing before, now failing |
| `newlyPassing` | array | Test IDs that were failing before, now passing |

### Session Detail Fields

For each session in `sessions`:

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | "pass", "fail", or "error" |
| `totalSteps` | int | Total steps in the session |
| `passedSteps` | int | Steps that matched before first divergence |
| `firstDivergentStep` | int | 0-indexed step where divergence occurred |
| `divergenceType` | string | "rng", "screen", "crash", or "timeout" |
| `coveragePercent` | float | `passedSteps / totalSteps * 100` |

## Implementation

### Scripts

#### 1. `scripts/collect-test-results.mjs`

Node.js script that:
- Runs tests with JSON reporter
- Parses session test results for step-level detail
- Outputs JSON matching the schema

```bash
node scripts/collect-test-results.mjs > /tmp/test-results.json
```

#### 2. `scripts/collect-code-metrics.sh`

Bash script that extracts git diff statistics:

```bash
scripts/collect-code-metrics.sh HEAD^ HEAD > /tmp/code-metrics.json
```

#### 3. `scripts/generate-detailed-note.sh`

Combines test results + code metrics + regression analysis:

```bash
scripts/generate-detailed-note.sh [--allow-regression]
```

#### 4. `scripts/backfill-detailed-notes.sh`

Efficient backfill for historical commits:

```bash
# Code metrics only (fast)
scripts/backfill-detailed-notes.sh --code-only --commits 1000

# Full test runs (slow but complete)
scripts/backfill-detailed-notes.sh --commits 100

# Sample every Nth commit
scripts/backfill-detailed-notes.sh --sample 10 --commits 1000
```

### Test Runner Integration

The test collection script hooks into Node's test runner:

```javascript
// Captures test events and session step results
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

const results = { pass: [], fail: [], skip: [], sessions: {} };

// Custom reporter that captures detailed results
```

### Session Step Analysis

For session tests, we hook into `session_helpers.js`:

```javascript
// After replaySession() completes:
const sessionResult = {
  status: allStepsPassed ? 'pass' : 'fail',
  totalSteps: session.steps.length,
  passedSteps: firstDivergentIndex === -1 ? session.steps.length : firstDivergentIndex,
  firstDivergentStep: firstDivergentIndex,
  divergenceType: divergenceType,
  coveragePercent: (passedSteps / totalSteps) * 100
};
```

## Backfill Strategy

### Phase 1: Code Metrics Only (Fast)

For all 1345 commits, collect git diff statistics:
- ~1 second per commit
- Total: ~25 minutes

### Phase 2: Selective Test Runs

Run tests on a sample of commits:
- Every 50th commit → 27 commits
- Plus any tagged releases
- Plus commits touching `test/` or `js/dungeon.js` (core files)

### Phase 3: Full Coverage (Recent)

Run full tests on most recent 100 commits for complete detail.

### Handling Missing Tests

Early commits may not have the test framework. The script handles:
- Missing `test/` directory → skip tests, code metrics only
- Missing `package.json` → skip tests, code metrics only
- Test framework errors → record error state, continue

## Queries Enabled

### 1. Session Coverage Over Time

```bash
jq -r '.sessions["seed1_gameplay"].coveragePercent' teststats/results.jsonl | \
  paste - <(jq -r '.commit' teststats/results.jsonl) | \
  sort -n
```

### 2. When Did a Test Break?

```bash
jq -r 'select(.tests.fail | contains(["comparison/gameplay::seed1"]))' \
  teststats/results.jsonl | head -1
```

### 3. Regression History

```bash
jq -r 'select(.regression == true) | "\(.commit): \(.regressedTests | join(", "))"' \
  teststats/results.jsonl
```

### 4. Code Churn by Category

```bash
jq -r '[.codeMetrics.categories.js.added] | add' teststats/results.jsonl
```

## Dashboard Enhancements

The dashboard at `teststats/index.html` will be extended to show:

1. **Session coverage timeline** — Line chart of coverage % per session over time
2. **Test status heatmap** — Grid showing pass/fail status per test per commit
3. **Regression markers** — Red dots on timeline where regressions occurred
4. **Drill-down detail** — Click a session to see step-by-step RNG comparison

## Migration from v1

Existing notes (version 1) remain valid. The collection script:
1. Reads existing note if present
2. Adds new fields (sessions, tests, codeMetrics)
3. Sets version to 2
4. Preserves all v1 data

## File Locations

| File | Purpose |
|------|---------|
| `scripts/collect-test-results.mjs` | Test runner with detailed output |
| `scripts/collect-code-metrics.sh` | Git diff statistics |
| `scripts/generate-detailed-note.sh` | Note generation |
| `scripts/backfill-detailed-notes.sh` | Historical backfill |
| `teststats/results.jsonl` | JSONL mirror of notes |
| `teststats/schema-v2.json` | JSON Schema for v2 format |
| `docs/TESTING_DETAILED_NOTES.md` | This document |
