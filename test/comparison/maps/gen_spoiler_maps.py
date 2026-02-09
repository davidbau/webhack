#!/usr/bin/env python3
"""
Generate DECgraphics maps for spoiler guide from Sokoban Lua files.

Reads the 8 Sokoban Lua maps and outputs them in the spoiler guide format
with 1-indexed coordinates and correct junction wall types.
"""

import os
import sys

# Import the wall computation logic
sys.path.insert(0, os.path.dirname(__file__))
from compute_sokoban_walls import parse_lua_map, ascii_to_initial_types, wall_extends, grid_to_decgraphics


def print_map_with_coords(dec_lines, level_name):
    """Print a map with 1-indexed coordinates like the spoiler guide."""
    rows = len(dec_lines)
    max_cols = max(len(line.rstrip()) for line in dec_lines)

    print(f"\n#### {level_name}\n")
    print("```")

    # Print column header
    col_header = "   "
    for c in range(1, max_cols + 1):
        if c % 10 == 0:
            col_header += str(c // 10)
        else:
            col_header += " "
    print(col_header)

    col_numbers = "   "
    for c in range(1, max_cols + 1):
        col_numbers += str(c % 10)
    print(col_numbers)

    # Print rows with row numbers
    for i, line in enumerate(dec_lines):
        row_num = i + 1
        # Strip trailing spaces but keep internal structure
        content = line.rstrip()
        print(f"{row_num:2d} {content}")

    print("```")


def main():
    base_dir = "/share/u/davidbau/git/interface/nethack-c/dat"

    maps = [
        ("soko4-1.lua", "Level 1, Version A"),
        ("soko4-2.lua", "Level 1, Version B"),
        ("soko3-1.lua", "Level 2, Version A"),
        ("soko3-2.lua", "Level 2, Version B"),
        ("soko2-1.lua", "Level 3, Version A"),
        ("soko2-2.lua", "Level 3, Version B"),
        ("soko1-1.lua", "Level 4, Version A (prize: bag of holding)"),
        ("soko1-2.lua", "Level 4, Version B (prize: amulet of reflection)"),
    ]

    for filename, description in maps:
        filepath = os.path.join(base_dir, filename)

        # Parse and compute wall types
        lines = parse_lua_map(filepath)
        grid = ascii_to_initial_types(lines)
        final_grid = wall_extends(grid)
        dec_lines = grid_to_decgraphics(final_grid, lines)

        # Print in spoiler format
        print_map_with_coords(dec_lines, description)


if __name__ == '__main__':
    main()
