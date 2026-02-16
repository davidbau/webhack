#!/usr/bin/env bash
# Build script for the NetHack Guidebook (Menace Edition)
#
# Pipeline:
#   1. Guidebook.mn (nroff) → guidebook-base.md (via convert_guidebook.py)
#   2. guidebook-base.md + menace-supplement.md → guidebook.md (via merge_supplement.py)
#   3. guidebook.md → index.html (via pandoc)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check dependencies
if ! command -v pandoc &>/dev/null; then
  echo "Error: pandoc not found. Install with: brew install pandoc" >&2
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "Error: python3 not found." >&2
  exit 1
fi

echo "=== Converting Guidebook.mn → guidebook-base.md ==="
python3 convert_guidebook.py ../docs/reference/Guidebook.mn guidebook-base.md
echo "    → guidebook-base.md"

echo "=== Merging Menace supplement ==="
python3 merge_supplement.py guidebook-base.md menace-supplement.md guidebook.md
echo "    → guidebook.md (sections 9.2-9.18 replaced)"

echo "=== Building Guidebook HTML ==="
pandoc guidebook.md \
  --from=markdown \
  --to=html5 \
  --template=template.html \
  --section-divs \
  --output=index.html

echo "    → index.html"
echo "=== Done ==="
