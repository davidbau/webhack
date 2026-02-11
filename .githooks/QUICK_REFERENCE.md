# Testing Quick Reference

*"Keep this scroll nearby for quick incantations!"*

## 🚀 Most Common Commands

### Daily Workflow (Recommended)
```bash
# Edit files, then run tests
.githooks/test-and-log.sh

# Commit — post-commit hook attaches test note automatically
git add file.js && git commit -m "Fix bug"

# Push — pre-push verifies note exists, push carries it
git push
```

That's it! Hooks handle test tracking automatically.

---

## 📋 Cheat Sheet

### Setup (Once)
```bash
git config core.hooksPath .githooks
git config --add remote.origin.push '+refs/heads/*:refs/heads/*'
git config --add remote.origin.push '+refs/notes/test-results:refs/notes/test-results'
```

### How It Works
1. `test-and-log.sh` runs tests → writes `teststats/pending.jsonl` with `"commit":"HEAD"`
2. `post-commit` hook replaces `"HEAD"` with real hash → attaches as git note
3. `pre-push` hook verifies note exists (runs tests as fallback if not)
4. `git push` carries the note automatically (via remote.origin.push refspec)

### Manual Testing
```bash
.githooks/test-and-log.sh        # Run tests, writes pending.jsonl
git notes --ref=test-results show HEAD  # View note after commit
```

### View Results
```bash
# Dashboard
open teststats/index.html

# Last test note
git notes --ref=test-results show HEAD

# Last JSONL entry
tail -1 teststats/results.jsonl | jq '.'

# Stats
jq -r '.stats.pass' teststats/results.jsonl | tail -1
```

### Allow Regression
```bash
# Git notes
.githooks/test-and-log-to-note.sh --allow-regression

# Legacy
.githooks/test-and-log.sh --allow-regression
```

### Rebuild Dashboard
```bash
.githooks/sync-notes-to-jsonl.sh
git add teststats/results.jsonl && git commit -m "Rebuild dashboard"
```

### After Clone
```bash
git fetch origin refs/notes/test-results:refs/notes/test-results
.githooks/sync-notes-to-jsonl.sh
```

---

## 🔍 Troubleshooting

### Hooks not running
```bash
git config core.hooksPath .githooks
chmod +x .githooks/*
```

### Notes not pushing
```bash
git config --add remote.origin.push '+refs/heads/*:refs/heads/*'
git config --add remote.origin.push '+refs/notes/test-results:refs/notes/test-results'
# OR manually:
git push origin refs/notes/test-results
```

### Dashboard not updating
```bash
.githooks/sync-notes-to-jsonl.sh
git add teststats/results.jsonl && git commit -m "Update dashboard"
```

### Invalid JSON
```bash
cat teststats/results.jsonl | jq '.'  # Find the bad line
```

---

## 📊 Check Status

```bash
# Current pass rate
jq -r '.stats.pass' teststats/results.jsonl | tail -1

# Last 5 commits
tail -5 teststats/results.jsonl | jq -r '"\(.commit): \(.stats.pass)/\(.stats.total)"'

# All notes
git notes --ref=test-results list

# Test count by category
tail -1 teststats/results.jsonl | jq '.categories'
```

---

## 📚 Documentation

- **Main Guide**: ../docs/TESTING.md
- **Git Notes**: ../docs/TESTING_GIT_NOTES.md
- **Hooks**: README.md (this directory)
- **Dashboard**: ../teststats/README.md

---

*"Keep this scroll handy! May your tests always pass."*
