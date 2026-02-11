# Git Hooks for Test Enforcement

*"You trigger a magic trap! Tests are being run..."*

## ⚡ Quick Start

**Recommended**: Use the Git Notes approach for cleaner history.

```bash
# Enable hooks
git config core.hooksPath .githooks

# Configure automatic note pushing (recommended)
git config --add remote.origin.push '+refs/notes/test-results:refs/notes/test-results'

# Use the helper script
.githooks/commit-with-tests-notes.sh "Your commit message" file1.js file2.js
```

**Full documentation**: See [docs/TESTING.md](../docs/TESTING.md)

## 📚 Two Approaches

This repository supports two testing workflows:

### 1. Git Notes (Recommended) ⭐

*"The blessed scroll - clean history, tests travel with commits"*

**Authoritative**: Git notes (`refs/notes/test-results`)
**Dashboard**: Mirrored JSONL (one commit behind)

**Scripts**:
- `test-and-log-to-note.sh` - Run tests, save to git note
- `sync-notes-to-jsonl.sh` - Rebuild JSONL from notes
- `commit-with-tests-notes.sh` - Helper (commit → test → sync → done!)
- `pre-push-notes` - Enforcement hook
- `pre-commit` - Auto-sync notes → JSONL

**Docs**: [docs/TESTING_GIT_NOTES.md](../docs/TESTING_GIT_NOTES.md)

### 2. Two-Commit (Legacy)

*"The old way - works, but creates two commits per change"*

**All data**: In `teststats/results.jsonl`

**Scripts**:
- `test-and-log.sh` - Run tests, append to JSONL
- `commit-with-tests.sh` - Helper (two commits)
- `pre-push` - Enforcement hook

**Docs**: [docs/TESTING.md](../docs/TESTING.md)

## 🎯 Git Notes Approach (Detailed)

### The Chicken-and-Egg Problem

**Q**: How can a commit name itself before it exists?
**A**: It can't! But git notes can be attached AFTER the commit exists.

### How It Works

```
1. Make code changes
2. git commit -m "Fix bug"              ← Creates commit ABC123
3. Tests run, save to git note          ← Note attached to ABC123
4. Sync notes → results.jsonl          ← Rebuilds dashboard data
5. git commit results.jsonl            ← Dashboard update commit
6. git push                            ← Both commits + notes pushed
```

**Result**:
- Commit `ABC123`: Contains code changes
- Note on `ABC123`: Contains test results (can reference ABC123!)
- Next commit: Contains updated JSONL mirror for dashboard

### Scripts

#### test-and-log-to-note.sh

Runs all tests and saves results to a git note attached to HEAD.

```bash
# Normal usage
./test-and-log-to-note.sh

# Allow regression (use sparingly!)
./test-and-log-to-note.sh --allow-regression
```

Creates a note like:
```json
{
  "commit": "abc123",
  "stats": {"total": 631, "pass": 137, "fail": 494},
  "regression": false
}
```

#### sync-notes-to-jsonl.sh

Rebuilds `teststats/results.jsonl` from all git notes.

```bash
./sync-notes-to-jsonl.sh
```

This runs automatically via **pre-commit** hook, keeping the JSONL mirror up-to-date.

#### commit-with-tests-notes.sh (Helper)

Automates the entire workflow:

```bash
# Instead of multiple manual steps:
.githooks/commit-with-tests-notes.sh "Fix bug" file1.js file2.js
```

This will:
1. Commit your changes
2. Run tests and save to git note
3. Sync notes → JSONL
4. Commit the updated JSONL
5. Ready to push!

*"One scroll to rule them all"*

#### pre-push-notes

Runs automatically before `git push`:
1. Checks if current commit has a test note
2. If not, runs tests and creates note
3. Blocks push if tests fail/regress
4. Reminds you to push notes

#### pre-commit

Runs automatically before each commit:
1. Syncs git notes → `results.jsonl`
2. Auto-stages updated JSONL
3. Keeps dashboard one commit behind (acceptable for historical data)

## 🔧 Configuration

### Enable Hooks

```bash
git config core.hooksPath .githooks
```

### Auto-Push Notes (Recommended)

```bash
git config --add remote.origin.push '+refs/notes/test-results:refs/notes/test-results'
```

Now `git push` automatically pushes both commits AND test notes!

### Fetch Notes After Clone

```bash
# One-time after cloning
git fetch origin refs/notes/test-results:refs/notes/test-results

# Rebuild dashboard
.githooks/sync-notes-to-jsonl.sh
```

## ⚠️ Disabling Hooks (Not Recommended)

*"The Wizard of Yendor frowns upon this..."*

If you need to bypass hooks temporarily:

```bash
git push --no-verify  # Skip pre-push hook (NOT RECOMMENDED)
```

**Warning**: CI will still check for test logs. This only bypasses local enforcement.

## 🔍 Manual Workflows

### Git Notes Approach (Manual)

```bash
# 1. Commit code
git commit -m "Fix bug"

# 2. Run tests and save to note
.githooks/test-and-log-to-note.sh

# 3. Sync notes to JSONL
.githooks/sync-notes-to-jsonl.sh

# 4. Commit updated JSONL
git add teststats/results.jsonl
git commit -m "Update test dashboard"

# 5. Push both commits and notes
git push
git push origin refs/notes/test-results
# (Or configure auto-push - see above)
```

### Two-Commit Approach (Manual, Legacy)

```bash
# 1. Commit code
git commit -m "Fix bug"

# 2. Run tests and append to JSONL
.githooks/test-and-log.sh

# 3. Commit test log
git add teststats/results.jsonl
git commit -m "Test results for $(git rev-parse --short HEAD^)"

# 4. Push both commits
git push
```

## 📊 Viewing Test Results

### Dashboard (Recommended)

**GitHub Pages**: https://davidbau.github.io/mazesofmenace/teststats/

**Local**: `open teststats/index.html`

### Git Notes (Command Line)

```bash
# Show note for specific commit
git notes --ref=test-results show abc123

# Show note for current commit
git notes --ref=test-results show HEAD

# List all commits with notes
git notes --ref=test-results list
```

### JSONL File (Raw Data)

```bash
# View last 5 test results
tail -5 teststats/results.jsonl | jq '.'

# Check current pass rate
jq -r '.stats.pass' teststats/results.jsonl | tail -1
```

## 🎯 Which Approach Should I Use?

| Feature | Git Notes ⭐ | Two-Commit |
|---------|-------------|------------|
| Commits per change | 1 + dashboard | 2 |
| Git history | Clean | Cluttered |
| Can reference commit hash | ✅ Yes (in note) | ❌ No (chicken-egg) |
| Data travels with repo | ✅ Yes (notes) | ✅ Yes (JSONL) |
| Dashboard support | ✅ Yes (mirrored) | ✅ Yes |
| Setup complexity | Medium | Simple |
| **Recommendation** | ✅ Use this | Legacy only |

**The Oracle says**: *"Choose the git notes path. Thy history shall remain pure, and thy tests shall travel with thy commits. This is the way of wisdom."*

## 📚 Further Reading

- **Main Guide**: [docs/TESTING.md](../docs/TESTING.md)
- **Git Notes Deep Dive**: [docs/TESTING_GIT_NOTES.md](../docs/TESTING_GIT_NOTES.md)
- **Dashboard Schema**: [teststats/schema.json](../teststats/schema.json)

---

*"May your tests always pass, and your git notes always sync."*
