# DECgraphics Support for Selfplay Agent

**Status**: ✅ Implemented (2026-02-10)
**Related Issue**: interface-8rm

## Overview

The selfplay agent now supports both ASCII and DECgraphics symbol sets when running against the C NetHack binary via tmux. This allows the agent to correctly parse and understand screen output regardless of the symbol set used.

## What Changed

### 1. TmuxAdapter (selfplay/interface/tmux_adapter.js)

- **Added `symset` option** to constructor (default: 'ASCII')
- **ANSI Escape Sequence Parser**: New `parseAnsiLine()` function that:
  - Parses ANSI SGR (Select Graphic Rendition) sequences
  - Extracts both characters and colors from tmux output
  - Maps ANSI color codes (30-37, 90-97) to NetHack's 16-color palette
  - Handles bright/bold attribute (SGR code 1)
  - Preserves Unicode box-drawing characters
- **Enhanced screen capture**: Changed `tmux capture-pane` to use `-e` flag
  - Before: `-p` (plain text, loses colors)
  - After: `-p -e` (with ANSI escape sequences, preserves colors and Unicode)
- **Dynamic .nethackrc generation**: Adds `OPTIONS=symset:DECgraphics` when symset='DECgraphics'

### 2. C Runner (selfplay/runner/c_runner.js)

- **New CLI option**: `--graphics=MODE`
  - `--graphics=ascii` - Use ASCII symbols (default)
  - `--graphics=dec` - Use DECgraphics Unicode symbols
- **Option displayed in startup output**

### 3. Screen Parser (selfplay/perception/screen_parser.js)

- **No changes needed!** Already supported DECgraphics symbols:
  - Wall chars: `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`
  - Floor char: `·` (middle dot, U+00B7)
  - All symbols properly classified by `classifyCell()`

## ANSI Color Mapping

NetHack uses a 16-color palette (0-15). ANSI SGR codes are mapped as follows:

| ANSI Code | Color         | NetHack Index |
|-----------|---------------|---------------|
| 30        | Black         | 0             |
| 31        | Red           | 1             |
| 32        | Green         | 2             |
| 33        | Brown/Yellow  | 3             |
| 34        | Blue          | 4             |
| 35        | Magenta       | 5             |
| 36        | Cyan          | 6             |
| 37        | Gray/White    | 7             |
| 90        | Bright Black  | 8             |
| 91        | Bright Red    | 9             |
| 92        | Bright Green  | 10            |
| 93        | Bright Yellow | 11            |
| 94        | Bright Blue   | 12            |
| 95        | Bright Magenta| 13            |
| 96        | Bright Cyan   | 14            |
| 97        | Bright White  | 15            |

The bright/bold attribute (SGR code 1) adds 8 to the base color index (e.g., red 1 + bright = 9).

## Usage Examples

### ASCII Mode (default)
```bash
node selfplay/runner/c_runner.js --seed=42 --turns=100
# Uses: |, -, +, #, . for walls and features
```

### DECgraphics Mode
```bash
node selfplay/runner/c_runner.js --seed=42 --turns=100 --graphics=dec
# Uses: ─│┌┐└┘├┤┬┴┼ for walls, · for floor
```

## Testing

Basic syntax tests in `test/selfplay/test_ansi_parser.js` document expected behavior:
- Plain text preservation
- Color code handling (red, bright colors)
- Unicode character preservation (box-drawing)
- Line padding to terminal width

To test end-to-end:
1. Run agent in both modes with same seed
2. Verify wall detection, pathfinding work identically
3. Compare agent behavior (should be identical)

## Implementation Notes

### ANSI Parser Edge Cases
- **Multiple parameters**: Handles sequences like `\x1b[1;31m` (bright + red)
- **Bright attribute**: Immediately affects current color if already set
- **Reset code**: `\x1b[0m` resets to default gray (color 7)
- **Background colors**: Ignored (40-47, 100-107) - NetHack doesn't use them
- **Unknown codes**: Silently ignored

### tmux Capture Details
- Uses `-e` flag to include ANSI escape sequences
- UTF-8 encoding preserved throughout
- 24x80 terminal grid captured from rows 0-23
- Each cell is {ch, color} object

## Related Files

- `selfplay/interface/tmux_adapter.js` - tmux interface, ANSI parser
- `selfplay/runner/c_runner.js` - CLI runner with --graphics option
- `selfplay/perception/screen_parser.js` - Symbol recognition (already complete)
- `test/selfplay/test_ansi_parser.js` - ANSI parser behavior tests

## Next Steps

- ✅ Basic DECgraphics support complete
- ⬜ Test with real gameplay sessions (interface-b9r)
- ⬜ IBMgraphics support (different Unicode set)
- ⬜ Compare agent behavior across symbol sets

## References

- NetHack source: `src/drawing.c`, `src/symbols.c`
- ANSI escape codes: SGR (Select Graphic Rendition)
- Unicode box-drawing: U+2500 - U+257F block
- Session memory: MEMORY.md (notes tmux charset preservation)
