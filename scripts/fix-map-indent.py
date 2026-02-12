#!/usr/bin/env python3
"""Fix map string indentation in JS level files to match C Lua originals.

For each JS file in js/levels/, finds template literal map strings and
strips the common leading whitespace (JS code indentation) so map content
starts at column 0, matching C's Lua [[...]] strings.

Also strips leading/trailing empty lines from map content to match how
C Lua [[...]] strings are typically formatted.
"""

import re
import sys
from pathlib import Path


def fix_map_strings(js_content):
    """Strip code indentation from map template literal strings."""
    result = []
    i = 0
    changed = False

    while i < len(js_content):
        # Look for map: `
        match = re.search(r'map:\s*`', js_content[i:])
        if not match:
            result.append(js_content[i:])
            break

        # Add everything before and including map: `
        match_end = i + match.end()
        result.append(js_content[i:match_end])
        i = match_end

        # Find the closing backtick
        j = i
        while j < len(js_content) and js_content[j] != '`':
            if js_content[j] == '\\':
                j += 1  # skip escaped char
            j += 1

        if j >= len(js_content):
            result.append(js_content[i:])
            break

        # Extract map content between backticks
        map_content = js_content[i:j]

        # Split into lines
        lines = map_content.split('\n')

        # Strip leading empty lines
        while lines and not lines[0].strip():
            lines.pop(0)

        # Strip trailing empty lines (keep one trailing \n for formatting)
        while len(lines) > 1 and not lines[-1].strip():
            lines.pop()

        # Find minimum leading whitespace among non-empty lines
        non_empty = [l for l in lines if l.strip()]
        if non_empty:
            min_indent = min(len(l) - len(l.lstrip()) for l in non_empty)
            if min_indent > 0:
                lines = [l[min_indent:] if l.strip() else l for l in lines]
                changed = True

        # Reconstruct: \n before content, trailing \n after
        new_content = '\n' + '\n'.join(lines) + '\n'
        if new_content != js_content[i:j]:
            changed = True

        result.append(new_content)
        i = j  # Position at closing backtick

    return ''.join(result), changed


def main():
    levels_dir = Path(__file__).parent.parent / 'js' / 'levels'
    if not levels_dir.exists():
        print(f"Error: {levels_dir} not found")
        sys.exit(1)

    changed_files = []
    for js_file in sorted(levels_dir.glob('*.js')):
        content = js_file.read_text()
        fixed, changed = fix_map_strings(content)
        if changed:
            js_file.write_text(fixed)
            changed_files.append(js_file.name)
            print(f"Fixed: {js_file.name}")

    print(f"\n{len(changed_files)} files fixed")


if __name__ == '__main__':
    main()
