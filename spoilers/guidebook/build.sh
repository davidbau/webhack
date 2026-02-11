#!/usr/bin/env bash
# Build script for the NetHack Guidebook (HTML version)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check dependencies
if ! command -v pandoc &>/dev/null; then
  echo "Error: pandoc not found. Install with: brew install pandoc" >&2
  exit 1
fi

echo "=== Building Guidebook HTML ==="
pandoc guidebook.md \
  --from=markdown \
  --to=html5 \
  --template=template.html \
  --section-divs \
  --output=index.html

echo "    → index.html"
echo "=== Done ==="
