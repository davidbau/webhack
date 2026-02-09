#!/usr/bin/env python3
"""
Compute DECgraphics wall characters for NetHack Sokoban maps.

Implements the wall_extends() algorithm from NetHack C source to determine
correct junction types for wall characters in all 8 Sokoban Lua map files.
"""

import json
import re
import sys
import os

# Wall type constants (matching NetHack's rm.h)
STONE = 0
VWALL = 1
HWALL = 2
TLCORNER = 3
TRCORNER = 4
BLCORNER = 5
BRCORNER = 6
CROSSWALL = 7
TUWALL = 8
TDWALL = 9
TLWALL = 10  # Note: SDOOR=10 in rm.h but for walls, 10=TLWALL in the trace
TRWALL = 11
ROOM = 25
STAIRS_UP = 26
STAIRS_DOWN = 27
DOOR = 23

# DECgraphics characters for wall types
WALL_CHARS = {
    VWALL: '│',
    HWALL: '─',
    TLCORNER: '┌',
    TRCORNER: '┐',
    BLCORNER: '└',
    BRCORNER: '┘',
    CROSSWALL: '┼',
    TUWALL: '┴',
    TDWALL: '┬',
    TLWALL: '┤',
    TRWALL: '├',
}

TYPE_NAMES = {
    STONE: 'STONE',
    VWALL: 'VWALL',
    HWALL: 'HWALL',
    TLCORNER: 'TLCORNER',
    TRCORNER: 'TRCORNER',
    BLCORNER: 'BLCORNER',
    BRCORNER: 'BRCORNER',
    CROSSWALL: 'CROSSWALL',
    TUWALL: 'TUWALL',
    TDWALL: 'TDWALL',
    TLWALL: 'TLWALL',
    TRWALL: 'TRWALL',
    ROOM: 'ROOM',
    STAIRS_UP: 'STAIRS_UP',
    STAIRS_DOWN: 'STAIRS_DOWN',
    DOOR: 'DOOR',
}


def is_wall(t):
    """Check if a type is any kind of wall."""
    return t in (VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
                 CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL)


def extends_north(t):
    """Does this wall type extend northward (i.e., connect to a neighbor to the south)?

    A cell extends north if it has a vertical component going up.
    Types: VWALL, TLCORNER, TRCORNER, CROSSWALL, TUWALL, TRWALL, TLWALL
    Wait - let me re-read the spec more carefully.

    "South neighbor extends north" means: looking at the cell to the south,
    does it have connectivity going northward?

    Types that extend north (have a north-going segment):
    VWALL (vertical), TLCORNER (┌ - goes down and right, NOT north),

    Actually, let me think about this differently using the box-drawing metaphor:
    ┌ (TLCORNER) = goes south and east  -> extends south, extends east
    ┐ (TRCORNER) = goes south and west  -> extends south, extends west
    └ (BLCORNER) = goes north and east  -> extends north, extends east
    ┘ (BRCORNER) = goes north and west  -> extends north, extends west
    ┼ (CROSSWALL) = all four           -> extends all
    ┬ (TDWALL) = goes south, east, west -> extends south, east, west
    ┴ (TUWALL) = goes north, east, west -> extends north, east, west
    ├ (TRWALL) = goes north, south, east -> extends north, south, east
    ┤ (TLWALL) = goes north, south, west -> extends north, south, west
    │ (VWALL) = goes north, south       -> extends north, south
    ─ (HWALL) = goes east, west         -> extends east, west

    But the spec says:
    "North neighbor extends south if it's VWALL, TLCORNER, TRCORNER, TDWALL, CROSSWALL, TRWALL, or TLWALL"

    extends_south: VWALL, TLCORNER, TRCORNER, TDWALL, CROSSWALL, TRWALL, TLWALL
    Let's verify with box drawing:
    VWALL │ - yes extends south
    TLCORNER ┌ - yes extends south
    TRCORNER ┐ - yes extends south
    TDWALL ┬ - yes extends south
    CROSSWALL ┼ - yes extends south
    TRWALL ├ - yes extends south
    TLWALL ┤ - yes extends south
    Good, these are the ones with south connectivity.

    "South neighbor extends north if it's VWALL, BLCORNER, BRCORNER, TUWALL, CROSSWALL, TRWALL, or TLWALL"
    extends_north: VWALL, BLCORNER, BRCORNER, TUWALL, CROSSWALL, TRWALL, TLWALL
    VWALL │ - yes north
    BLCORNER └ - yes north
    BRCORNER ┘ - yes north
    TUWALL ┴ - yes north
    CROSSWALL ┼ - yes north
    TRWALL ├ - yes north
    TLWALL ┤ - yes north
    Good.

    "East neighbor extends west if it's HWALL, TRCORNER, BRCORNER, TUWALL, TDWALL, CROSSWALL, or TLWALL"
    extends_west: HWALL, TRCORNER, BRCORNER, TUWALL, TDWALL, CROSSWALL, TLWALL
    HWALL ─ - yes west
    TRCORNER ┐ - yes west
    BRCORNER ┘ - yes west
    TUWALL ┴ - yes west (goes east and west and north)
    TDWALL ┬ - yes west
    CROSSWALL ┼ - yes west
    TLWALL ┤ - yes west
    Good.

    "West neighbor extends east if it's HWALL, TLCORNER, BLCORNER, TUWALL, TDWALL, CROSSWALL, or TRWALL"
    extends_east: HWALL, TLCORNER, BLCORNER, TUWALL, TDWALL, CROSSWALL, TRWALL
    HWALL ─ - yes east
    TLCORNER ┌ - yes east
    BLCORNER └ - yes east
    TUWALL ┴ - yes east
    TDWALL ┬ - yes east
    CROSSWALL ┼ - yes east
    TRWALL ├ - yes east
    Good.
    """
    # Types that have north-going connectivity
    return t in (VWALL, BLCORNER, BRCORNER, TUWALL, CROSSWALL, TRWALL, TLWALL)


def extends_south(t):
    """Does this wall type extend southward?"""
    return t in (VWALL, TLCORNER, TRCORNER, TDWALL, CROSSWALL, TRWALL, TLWALL)


def extends_east(t):
    """Does this wall type extend eastward?"""
    return t in (HWALL, TLCORNER, BLCORNER, TUWALL, TDWALL, CROSSWALL, TRWALL)


def extends_west(t):
    """Does this wall type extend westward?"""
    return t in (HWALL, TRCORNER, BRCORNER, TUWALL, TDWALL, CROSSWALL, TLWALL)


def parse_lua_map(filepath):
    """Extract the ASCII map from a Lua file's des.map() call."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the map between [[ and ]]
    match = re.search(r'des\.map\(\[\[\n(.*?)\]\]\)', content, re.DOTALL)
    if not match:
        raise ValueError(f"Could not find des.map() in {filepath}")

    map_text = match.group(1)
    lines = map_text.split('\n')
    # Remove trailing empty line if present
    while lines and lines[-1] == '':
        lines.pop()

    return lines


def ascii_to_initial_types(lines):
    """Convert ASCII map characters to initial wall types.

    Returns a 2D grid of type constants.
    """
    rows = len(lines)
    cols = max(len(line) for line in lines) if lines else 0

    grid = []
    for r in range(rows):
        row = []
        for c in range(cols):
            if c < len(lines[r]):
                ch = lines[r][c]
            else:
                ch = ' '

            if ch == '-':
                row.append(HWALL)
            elif ch == '|':
                row.append(VWALL)
            elif ch == '.':
                row.append(ROOM)
            elif ch == '<':
                row.append(STAIRS_UP)
            elif ch == '>':
                row.append(STAIRS_DOWN)
            elif ch == '+':
                row.append(DOOR)
            elif ch == ' ':
                row.append(STONE)
            elif ch == 'F':
                row.append(ROOM)  # iron bars, treat as room for wall connectivity
            elif ch == '^':
                row.append(ROOM)  # trap, treat as room
            elif ch == '@':
                row.append(ROOM)  # placeholder
            else:
                row.append(STONE)  # default unknown to stone
        grid.append(row)

    return grid


def wall_extends(grid):
    """Apply NetHack's wall_extends() algorithm iteratively.

    For each wall cell, check 4 cardinal neighbors to determine connectivity,
    then assign the appropriate junction type. Repeat until stable.
    """
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0

    iteration = 0
    while True:
        changed = False
        iteration += 1
        new_grid = [row[:] for row in grid]  # deep copy

        for r in range(rows):
            for c in range(cols):
                if not is_wall(grid[r][c]):
                    continue

                original_type = grid[r][c]

                # Check four neighbors for wall connectivity
                # North: does the cell to the north extend south?
                has_north = False
                if r > 0 and is_wall(grid[r-1][c]):
                    has_north = extends_south(grid[r-1][c])

                # South: does the cell to the south extend north?
                has_south = False
                if r < rows - 1 and is_wall(grid[r+1][c]):
                    has_south = extends_north(grid[r+1][c])

                # East: does the cell to the east extend west?
                has_east = False
                if c < cols - 1 and is_wall(grid[r][c+1]):
                    has_east = extends_west(grid[r][c+1])

                # West: does the cell to the west extend east?
                has_west = False
                if c > 0 and is_wall(grid[r][c-1]):
                    has_west = extends_east(grid[r][c-1])

                # Determine new type based on connectivity
                if has_north and has_south and has_east and has_west:
                    new_type = CROSSWALL
                elif has_south and has_east and has_west and not has_north:
                    new_type = TDWALL
                elif has_north and has_east and has_west and not has_south:
                    new_type = TUWALL
                elif has_north and has_south and has_east and not has_west:
                    new_type = TRWALL
                elif has_north and has_south and has_west and not has_east:
                    new_type = TLWALL
                elif has_south and has_east and not has_north and not has_west:
                    new_type = TLCORNER
                elif has_south and has_west and not has_north and not has_east:
                    new_type = TRCORNER
                elif has_north and has_east and not has_south and not has_west:
                    new_type = BLCORNER
                elif has_north and has_west and not has_south and not has_east:
                    new_type = BRCORNER
                elif has_east and has_west:
                    new_type = HWALL
                elif has_north and has_south:
                    new_type = VWALL
                else:
                    # Only one direction or none - keep original
                    new_type = original_type

                new_grid[r][c] = new_type
                if new_type != original_type:
                    changed = True

        grid = new_grid

        if not changed:
            break

        if iteration > 100:
            print("WARNING: wall_extends() did not converge after 100 iterations!")
            break

    return grid


def grid_to_decgraphics(grid, original_lines):
    """Convert the type grid to DECgraphics string representation."""
    rows = len(grid)
    result = []

    for r in range(rows):
        line = []
        for c in range(len(grid[r])):
            t = grid[r][c]
            if t == STONE:
                line.append(' ')
            elif t == ROOM:
                line.append('·')
            elif t == STAIRS_UP:
                line.append('<')
            elif t == STAIRS_DOWN:
                line.append('>')
            elif t == DOOR:
                line.append('+')
            elif is_wall(t):
                line.append(WALL_CHARS.get(t, '?'))
            else:
                line.append('?')
        result.append(''.join(line))

    return result


def validate_against_trace(computed_grid, trace_grid, map_name, lua_offset_col, lua_offset_row):
    """Validate computed wall types against C trace data.

    The C trace uses a full 80x21 grid, while Lua maps are placed at an offset.
    We need to find where the Lua map data appears in the trace grid.
    """
    errors = 0
    lua_rows = len(computed_grid)
    lua_cols = len(computed_grid[0]) if lua_rows > 0 else 0
    trace_rows = len(trace_grid)
    trace_cols = len(trace_grid[0]) if trace_rows > 0 else 0

    # Find the offset by looking for the first non-zero cell in trace
    # The trace grid has the map placed somewhere in the 80x21 grid
    min_r, min_c = trace_rows, trace_cols
    for r in range(trace_rows):
        for c in range(trace_cols):
            if trace_grid[r][c] != 0:
                min_r = min(min_r, r)
                min_c = min(min_c, c)

    print(f"  Trace offset: row={min_r}, col={min_c}")

    for r in range(lua_rows):
        for c in range(lua_cols):
            tr = r + min_r
            tc = c + min_c
            if tr >= trace_rows or tc >= trace_cols:
                continue

            computed = computed_grid[r][c]
            traced = trace_grid[tr][tc]

            # Map our internal types to trace types
            # DOOR in trace = 23, ROOM = 25, STAIRS_UP = 26, STAIRS_DOWN = 27
            # Skip non-wall comparisons (we only compute wall types)

            if is_wall(computed) and traced != computed:
                errors += 1
                if errors <= 20:
                    print(f"  MISMATCH at lua({r},{c}) trace({tr},{tc}): "
                          f"computed={TYPE_NAMES.get(computed, computed)} "
                          f"traced={TYPE_NAMES.get(traced, traced)}")
            elif not is_wall(computed) and is_wall(traced):
                errors += 1
                if errors <= 20:
                    print(f"  MISMATCH at lua({r},{c}) trace({tr},{tc}): "
                          f"computed={TYPE_NAMES.get(computed, computed)} "
                          f"traced={TYPE_NAMES.get(traced, traced)} (expected wall)")
            elif is_wall(computed) and not is_wall(traced):
                errors += 1
                if errors <= 20:
                    print(f"  MISMATCH at lua({r},{c}) trace({tr},{tc}): "
                          f"computed={TYPE_NAMES.get(computed, computed)} "
                          f"traced={TYPE_NAMES.get(traced, traced)} (expected non-wall)")

    return errors


def process_map(filepath, map_name, trace_data=None):
    """Process a single Sokoban map file."""
    print(f"\n{'='*70}")
    print(f"  {map_name}: {os.path.basename(filepath)}")
    print(f"{'='*70}")

    # Parse the Lua map
    lines = parse_lua_map(filepath)

    print(f"\nOriginal ASCII map:")
    for i, line in enumerate(lines):
        print(f"  {i:2d}: {line}")

    # Convert to initial types
    grid = ascii_to_initial_types(lines)

    # Apply wall_extends()
    final_grid = wall_extends(grid)

    # Convert to DECgraphics
    dec_lines = grid_to_decgraphics(final_grid, lines)

    print(f"\nDECgraphics wall map:")
    for i, line in enumerate(dec_lines):
        print(f"  {i:2d}: {line}")

    # Print type grid for debugging
    print(f"\nType grid (numeric):")
    for i, row in enumerate(final_grid):
        # Only print non-zero values compactly
        vals = [f"{v:2d}" for v in row]
        print(f"  {i:2d}: [{', '.join(vals)}]")

    # Validate against trace if available
    if trace_data is not None:
        print(f"\nValidation against C trace:")
        errors = validate_against_trace(final_grid, trace_data, map_name, 0, 0)
        if errors == 0:
            print(f"  PASS - All wall types match!")
        else:
            print(f"  FAIL - {errors} mismatches found!")

    return final_grid, dec_lines


def main():
    base_dir = "/share/u/davidbau/git/interface/nethack-c/dat"
    trace_path = "/share/u/davidbau/git/interface/test/comparison/maps/seed1_special_sokoban.session.json"

    # Load trace data
    with open(trace_path, 'r') as f:
        trace = json.load(f)

    # Build trace lookup by level name
    trace_by_name = {}
    for level in trace['levels']:
        trace_by_name[level['levelName']] = level['typGrid']

    # Map files and their metadata
    maps = [
        ("soko4-1.lua", "Level 1, Variant A (soko4-1) - Entry", "soko4"),
        ("soko4-2.lua", "Level 1, Variant B (soko4-2) - Entry", None),
        ("soko3-1.lua", "Level 2, Variant A (soko3-1)", "soko3"),
        ("soko3-2.lua", "Level 2, Variant B (soko3-2)", None),
        ("soko2-1.lua", "Level 3, Variant A (soko2-1)", None),
        ("soko2-2.lua", "Level 3, Variant B (soko2-2)", "soko2"),
        ("soko1-1.lua", "Level 4, Variant A (soko1-1) - Prize", "soko1"),
        ("soko1-2.lua", "Level 4, Variant B (soko1-2) - Prize", None),
    ]

    all_results = {}

    for filename, description, trace_name in maps:
        filepath = os.path.join(base_dir, filename)
        trace_data = trace_by_name.get(trace_name) if trace_name else None

        final_grid, dec_lines = process_map(filepath, description, trace_data)
        all_results[filename] = (final_grid, dec_lines)

    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"Processed {len(maps)} Sokoban map files.")
    print(f"Validated 4 maps against C trace data.")


if __name__ == '__main__':
    main()
