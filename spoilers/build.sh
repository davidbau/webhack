#!/usr/bin/env bash
# Build script for "The Traveler's Companion to the Mazes of Menace"
# Converts guide.md → index.html → guide.pdf
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="$SCRIPT_DIR/.venv"
WEASYPRINT="$VENV_DIR/bin/weasyprint"

# Check dependencies
if ! command -v pandoc &>/dev/null; then
  echo "Error: pandoc not found. Install with: brew install pandoc" >&2
  exit 1
fi

if [ ! -x "$WEASYPRINT" ]; then
  echo "Error: weasyprint not found in .venv. Set up with:" >&2
  echo "  python3 -m venv .venv && .venv/bin/pip install weasyprint" >&2
  exit 1
fi

echo "=== Building HTML ==="
pandoc guide.md \
  --from=markdown \
  --to=html5 \
  --template=template.html \
  --section-divs \
  --syntax-highlighting=none \
  --output=index.html

echo "    → index.html"

echo "=== Building PDF ==="
"$WEASYPRINT" index.html guide.pdf 2>&1 | grep -v "^$" || true

echo "    → guide.pdf"
echo "=== Done ==="
