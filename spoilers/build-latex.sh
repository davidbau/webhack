#!/usr/bin/env bash
# Build script for "The Traveler's Companion to the Mazes of Menace"
# LaTeX pipeline: guide.md → pandoc + lua filter → xelatex → guide-latex.pdf
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check dependencies
if ! command -v pandoc &>/dev/null; then
  echo "Error: pandoc not found. Install with: brew install pandoc" >&2
  exit 1
fi

if ! command -v xelatex &>/dev/null; then
  echo "Error: xelatex not found. Install with: brew install --cask mactex" >&2
  exit 1
fi

echo "=== Building PDF via LaTeX ==="
pandoc guide.md \
  --from=markdown \
  --pdf-engine=xelatex \
  --template=template.tex \
  --lua-filter=latex-filter.lua \
  --top-level-division=part \
  --toc \
  --output=guide-latex.pdf 2>&1

echo "    → guide-latex.pdf"
echo "=== Done ==="
