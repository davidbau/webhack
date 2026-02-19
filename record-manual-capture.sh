#!/usr/bin/env bash
set -euo pipefail

# Convenience launcher for manual seeded C NetHack key capture.
# Wraps: selfplay/runner/c_manual_record.js

show_help() {
  cat <<'EOF'
Usage:
  ./record-manual-capture.sh [options]

Description:
  Starts a seeded C NetHack session for manual play and records per-key JSONL.
  Default tmux socket is your normal human tmux server (default socket).
  Session window is locked to 80x24 for reproducible traces.

Common options:
  --seed=N                 RNG seed (default: 1)
  --keylog=PATH            Output JSONL path (default: /tmp/nethack_keylog_seed...)
  --tmux-socket=SOCKET     default | selfplay | custom-name (default: default)
  --datetime=YYYYMMDDhhmmss Fixed in-game datetime (default: 20000110090000)
  --real-time              Use real wall-clock datetime (no override)
  --session=NAME           tmux session name (default: auto timestamped)
  --keep-session           Keep session alive after detach (default: on)
  --no-keep-session        Auto-kill session after detach
  --role=ROLE              Character role (default: Valkyrie)
  --race=RACE              Character race (default: human)
  --gender=GENDER          Character gender (default: female)
  --align=ALIGN            Character alignment (default: neutral)
  --name=NAME              Character name (default: Recorder)
  --wizard                 Enable debug/wizard mode (default)
  --no-wizard              Disable debug/wizard mode
  --tutorial               Enable tutorial prompt; recorder stops there for manual y/n
  --no-tutorial            Skip tutorial prompt (default)
  --symset=ASCII|DECgraphics
  --help, -h               Show this help

Examples:
  ./record-manual-capture.sh --seed=5
  ./record-manual-capture.sh --seed=5 --tutorial
  ./record-manual-capture.sh --seed=42 --keylog=/tmp/seed42.jsonl
  ./record-manual-capture.sh --tmux-socket=selfplay --session=manual-nh
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  echo
  echo "Underlying runner help:"
  node selfplay/runner/c_manual_record.js --help
  exit 0
fi

exec node selfplay/runner/c_manual_record.js "$@"
