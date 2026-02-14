# C Keylog Workflow

This workflow records manual C NetHack inputs from a known seed, then converts
them into replay JSON suitable for JS-port reproducibility testing.

## 1) Record manual play on C NetHack

```bash
node selfplay/runner/c_manual_record.js --seed=5 --keylog=/tmp/seed5_manual.jsonl
```

- Plays in a tmux session on socket `selfplay`.
- Session window is locked to `80x24` for reproducible prompts/layout.
- Detach with `Ctrl-b d`.
- The C binary writes one JSON event per keypress to `--keylog`.

Optional flags:

- `--role=... --race=... --gender=... --align=... --name=...`
- `--symset=ASCII|DECgraphics`
- `--tmux-socket=selfplay|default|<name>`
- `--session=<tmux-session-name>`
- `--keep-session` (default)
- `--no-keep-session`

To run in your normal (default) tmux server:

```bash
node selfplay/runner/c_manual_record.js --seed=5 --tmux-socket=default
```

## 2) Convert JSONL trace to replay JSON

```bash
node selfplay/runner/keylog_to_replay.js \
  --in=/tmp/seed5_manual.jsonl \
  --out=/tmp/seed5_manual.replay.json
```

Replay JSON contains:

- `seed`
- `keys` (raw keycode stream)
- `events` with key context (`moves`, `x`, `y`, `dlevel`, flags)

Use `keys` for deterministic input replay and `events` for state-aligned diffing.

## 3) Convert JSONL trace to C-comparison session fixture

```bash
python3 test/comparison/c-harness/keylog_to_session.py \
  --in=/tmp/seed5_manual.jsonl \
  --out=test/comparison/sessions/seed5_gnomish_mines_gameplay.session.json \
  --name=wizard --role=Valkyrie --race=human --gender=female --align=neutral \
  --startup-mode=auto
```

- `--startup-mode=auto` is the safe default for manual keylogs.
- It detects startup keys in the keylog (`in_moveloop=0`) and replays startup
  exactly from the log instead of auto-advancing prompts.
