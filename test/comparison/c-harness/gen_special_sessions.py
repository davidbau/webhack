#!/usr/bin/env python3
"""Generate C map traces for special levels across all dungeon branches.

Usage:
    python3 gen_special_sessions.py <group> [--seeds 42,1,100]
    python3 gen_special_sessions.py --list-groups
    python3 gen_special_sessions.py --all [--seeds 42,1,100]

Groups: sokoban, mines, vlad, knox, oracle, castle, medusa, valley,
        gehennom, wizard, quest, planes, rogue, bigroom

Each group generates session files for the special levels in that category,
capturing typGrid via #dumpmap after teleporting to each level.

Output: test/comparison/maps/seed<N>_special_<group>.session.json

Requires the C binary to be built with setup.sh first.
"""

import sys
import os
import json
import time
import tempfile
import subprocess
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'maps')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')

# Import shared helpers
import importlib.util
_spec = importlib.util.spec_from_file_location('run_dumpmap', os.path.join(SCRIPT_DIR, 'run_dumpmap.py'))
_dumpmap = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_dumpmap)

setup_home = _dumpmap.setup_home
wait_for_game_ready = _dumpmap.wait_for_game_ready
execute_dumpmap = _dumpmap.execute_dumpmap
quit_game = _dumpmap.quit_game
tmux_send = _dumpmap.tmux_send
tmux_send_special = _dumpmap.tmux_send_special
tmux_capture = _dumpmap.tmux_capture


# Level groups: each entry is (level_name_for_ctrl_v, metadata)
# level_name is what you type after Ctrl+V prompt
LEVEL_GROUPS = {
    'sokoban': {
        'description': 'Sokoban puzzle levels (4 levels × 2 variants)',
        'levels': [
            {'name': 'soko4', 'branch': 'Sokoban', 'branchLevel': 4, 'nlevels': 2},
            {'name': 'soko3', 'branch': 'Sokoban', 'branchLevel': 3, 'nlevels': 2},
            {'name': 'soko2', 'branch': 'Sokoban', 'branchLevel': 2, 'nlevels': 2},
            {'name': 'soko1', 'branch': 'Sokoban', 'branchLevel': 1, 'nlevels': 2},
        ],
    },
    'mines': {
        'description': 'Gnomish Mines special levels',
        'levels': [
            {'name': 'minetn', 'branch': 'Gnomish Mines', 'nlevels': 7},
            {'name': 'minend', 'branch': 'Gnomish Mines', 'nlevels': 3},
        ],
    },
    'vlad': {
        'description': "Vlad's Tower (3 levels)",
        'levels': [
            {'name': 'tower1', 'branch': "Vlad's Tower", 'branchLevel': 1},
            {'name': 'tower2', 'branch': "Vlad's Tower", 'branchLevel': 2},
            {'name': 'tower3', 'branch': "Vlad's Tower", 'branchLevel': 3},
        ],
    },
    'knox': {
        'description': 'Fort Ludios',
        'levels': [
            {'name': 'knox', 'branch': 'Fort Ludios', 'branchLevel': 1},
        ],
    },
    'oracle': {
        'description': 'Oracle level',
        'levels': [
            {'name': 'oracle', 'branch': 'Dungeons of Doom'},
        ],
    },
    'castle': {
        'description': 'Castle level',
        'levels': [
            {'name': 'castle', 'branch': 'Dungeons of Doom'},
        ],
    },
    'medusa': {
        'description': 'Medusa level (4 variants)',
        'levels': [
            {'name': 'medusa', 'branch': 'Dungeons of Doom', 'nlevels': 4},
        ],
    },
    'valley': {
        'description': 'Valley of the Dead (Gehennom entry)',
        'levels': [
            {'name': 'valley', 'branch': 'Gehennom', 'branchLevel': 1},
        ],
    },
    'wizard': {
        'description': 'Wizard of Yendor tower (3 levels)',
        'levels': [
            {'name': 'wizard1', 'branch': 'Gehennom'},
            {'name': 'wizard2', 'branch': 'Gehennom'},
            {'name': 'wizard3', 'branch': 'Gehennom'},
        ],
    },
    'gehennom': {
        'description': 'Gehennom demon lairs and special levels',
        'levels': [
            {'name': 'sanctum', 'branch': 'Gehennom'},
            {'name': 'juiblex', 'branch': 'Gehennom'},
            {'name': 'baalz', 'branch': 'Gehennom'},
            {'name': 'asmodeus', 'branch': 'Gehennom'},
            {'name': 'orcus', 'branch': 'Gehennom'},
            {'name': 'fakewiz1', 'branch': 'Gehennom'},
            {'name': 'fakewiz2', 'branch': 'Gehennom'},
        ],
    },
    'planes': {
        'description': 'Elemental Planes (endgame)',
        'levels': [
            {'name': 'astral', 'branch': 'Elemental Planes', 'branchLevel': 1},
            {'name': 'water', 'branch': 'Elemental Planes', 'branchLevel': 2},
            {'name': 'fire', 'branch': 'Elemental Planes', 'branchLevel': 3},
            {'name': 'air', 'branch': 'Elemental Planes', 'branchLevel': 4},
            {'name': 'earth', 'branch': 'Elemental Planes', 'branchLevel': 5},
        ],
    },
    'rogue': {
        'description': 'Rogue level',
        'levels': [
            {'name': 'rogue', 'branch': 'Dungeons of Doom'},
        ],
    },
    'bigroom': {
        'description': 'Big room (13 variants)',
        'levels': [
            {'name': 'bigrm', 'branch': 'Dungeons of Doom', 'nlevels': 13},
        ],
    },
    'filler': {
        'description': 'Filler levels (procedural maze levels)',
        'levels': [
            {'name': 'minefill', 'branch': 'Gnomish Mines'},
            {'name': 'hellfill', 'branch': 'Gehennom'},
        ],
    },
    'tutorial': {
        'description': 'Tutorial levels',
        'levels': [
            {'name': 'tut-1', 'branch': 'Tutorial'},
            {'name': 'tut-2', 'branch': 'Tutorial'},
        ],
    },
    'quest': {
        'description': 'Quest levels (13 roles × 3 levels: start/locate/goal)',
        'levels': [
            # Archeologist quest
            {'name': 'Arc-strt', 'branch': 'The Quest'},
            {'name': 'Arc-loca', 'branch': 'The Quest'},
            {'name': 'Arc-goal', 'branch': 'The Quest'},
            # Barbarian quest
            {'name': 'Bar-strt', 'branch': 'The Quest'},
            {'name': 'Bar-loca', 'branch': 'The Quest'},
            {'name': 'Bar-goal', 'branch': 'The Quest'},
            # Caveman quest
            {'name': 'Cav-strt', 'branch': 'The Quest'},
            {'name': 'Cav-loca', 'branch': 'The Quest'},
            {'name': 'Cav-goal', 'branch': 'The Quest'},
            # Healer quest
            {'name': 'Hea-strt', 'branch': 'The Quest'},
            {'name': 'Hea-loca', 'branch': 'The Quest'},
            {'name': 'Hea-goal', 'branch': 'The Quest'},
            # Knight quest
            {'name': 'Kni-strt', 'branch': 'The Quest'},
            {'name': 'Kni-loca', 'branch': 'The Quest'},
            {'name': 'Kni-goal', 'branch': 'The Quest'},
            # Monk quest
            {'name': 'Mon-strt', 'branch': 'The Quest'},
            {'name': 'Mon-loca', 'branch': 'The Quest'},
            {'name': 'Mon-goal', 'branch': 'The Quest'},
            # Priest quest
            {'name': 'Pri-strt', 'branch': 'The Quest'},
            {'name': 'Pri-loca', 'branch': 'The Quest'},
            {'name': 'Pri-goal', 'branch': 'The Quest'},
            # Ranger quest
            {'name': 'Ran-strt', 'branch': 'The Quest'},
            {'name': 'Ran-loca', 'branch': 'The Quest'},
            {'name': 'Ran-goal', 'branch': 'The Quest'},
            # Rogue quest
            {'name': 'Rog-strt', 'branch': 'The Quest'},
            {'name': 'Rog-loca', 'branch': 'The Quest'},
            {'name': 'Rog-goal', 'branch': 'The Quest'},
            # Samurai quest
            {'name': 'Sam-strt', 'branch': 'The Quest'},
            {'name': 'Sam-loca', 'branch': 'The Quest'},
            {'name': 'Sam-goal', 'branch': 'The Quest'},
            # Tourist quest
            {'name': 'Tou-strt', 'branch': 'The Quest'},
            {'name': 'Tou-loca', 'branch': 'The Quest'},
            {'name': 'Tou-goal', 'branch': 'The Quest'},
            # Valkyrie quest
            {'name': 'Val-strt', 'branch': 'The Quest'},
            {'name': 'Val-loca', 'branch': 'The Quest'},
            {'name': 'Val-goal', 'branch': 'The Quest'},
            # Wizard quest
            {'name': 'Wiz-strt', 'branch': 'The Quest'},
            {'name': 'Wiz-loca', 'branch': 'The Quest'},
            {'name': 'Wiz-goal', 'branch': 'The Quest'},
        ],
    },
}


def wizard_teleport_to_level(session, level_name, verbose):
    """Use Ctrl+V ? menu to teleport to a named level.

    Name-based teleport only works within the current branch, so we use
    the interactive menu (?) which supports cross-branch teleport. The
    menu lists all levels with their letter keys. We scan pages to find
    the target level name and select its letter.
    """
    if verbose:
        print(f'  [teleport] Teleporting to "{level_name}" via menu')

    # Send Ctrl+V (wizard level teleport)
    tmux_send_special(session, 'C-v', 0.5)

    # Wait for the "To what level" prompt
    for attempt in range(30):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.3)
            continue
        if 'To what level' in content:
            break
        time.sleep(0.2)
    else:
        if verbose:
            print(f'  [teleport] WARNING: never got level prompt')
        return False

    # Type ? and Enter to open menu
    tmux_send(session, '?', 0.3)
    tmux_send_special(session, 'Enter', 0.8)

    # Scan menu pages to find the target level
    target_key = None
    for page in range(5):  # max 5 pages
        time.sleep(0.5)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if verbose and page == 0:
            # Show first few lines of menu
            for line in content.split('\n')[:5]:
                if line.strip():
                    print(f'  [menu] {line.rstrip()[:70]}')

        # Look for the target level name in the menu
        # Format: " X -   levelname: depth" or " X - * levelname: depth"
        for line in content.split('\n'):
            line = line.strip()
            # Match pattern like "B -   soko1: 6" or "c -   oracle: 9"
            m = re.match(r'^([a-zA-Z])\s+-\s+[*]?\s*' + re.escape(level_name) + r':', line)
            if m:
                target_key = m.group(1)
                if verbose:
                    print(f'  [menu] Found "{level_name}" → key "{target_key}" in: {line}')
                break
            # Also match "knox: 20" without letter (Fort Ludios has no letter sometimes)
            # and branch entries like "Stair to Sokoban: 10"

        if target_key:
            break

        # Check if there are more pages
        if '(end)' in content or 'Pick' in content:
            break
        if re.search(r'\(\d+ of \d+\)', content):
            # More pages available, press Space to scroll
            tmux_send_special(session, 'Space', 0.3)
        else:
            break

    if not target_key:
        if verbose:
            print(f'  [teleport] WARNING: "{level_name}" not found in menu')
        # Cancel menu
        tmux_send_special(session, 'Escape', 0.3)
        time.sleep(0.3)
        return False

    # Select the level
    tmux_send(session, target_key, 0.5)

    # Wait for teleport to complete
    for attempt in range(50):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.3)
            continue

        if 'Really' in content and '?' in content:
            tmux_send(session, 'y', 0.3)
            continue

        # Check for Endgame prerequisite prompt (teleporting to planes)
        if 'Endgame prerequisite' in content:
            tmux_send_special(session, 'Space', 0.3)
            continue

        if 'Dlvl:' in content or 'Plane' in content or 'End Game' in content:
            first_line = content.split('\n')[0] if content else ''
            if 'teleport' not in first_line.lower():
                if verbose:
                    for line in content.split('\n'):
                        if 'Dlvl:' in line or 'Plane' in line:
                            print(f'  [teleport] Arrived: {line.strip()[:60]}')
                            break
                break

        time.sleep(0.2)

    time.sleep(0.3)
    return True


def parse_dumpmap(dumpmap_file):
    """Parse a dumpmap output file into a typGrid."""
    with open(dumpmap_file) as f:
        lines = f.readlines()
    grid = []
    for line in lines:
        row = [int(x) for x in line.strip().split()]
        grid.append(row)
    return grid


def generate_group(group_name, seeds, verbose=False):
    """Generate special level traces for a group of levels."""
    if group_name not in LEVEL_GROUPS:
        print(f"Error: unknown group '{group_name}'")
        print(f"Available: {', '.join(sorted(LEVEL_GROUPS.keys()))}")
        sys.exit(1)

    group = LEVEL_GROUPS[group_name]
    print(f"\n=== {group['description']} ===")
    print(f"Seeds: {seeds}")

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first.")
        sys.exit(1)

    setup_home()
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    for seed in seeds:
        print(f"\n--- Seed {seed} ---")

        tmpdir = tempfile.mkdtemp(prefix=f'webhack-special-{seed}-')
        dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')
        session_name = f'webhack-special-{seed}-{os.getpid()}'

        levels = []

        try:
            cmd = (
                f'NETHACKDIR={INSTALL_DIR} '
                f'NETHACK_SEED={seed} '
                f'NETHACK_DUMPMAP={dumpmap_file} '
                f'HOME={RESULTS_DIR} '
                f'TERM=xterm-256color '
                f'{NETHACK_BINARY} -u Wizard -D; '
                f'sleep 999'
            )
            subprocess.run(
                ['tmux', 'new-session', '-d', '-s', session_name, '-x', '100', '-y', '30', cmd],
                check=True
            )

            time.sleep(1.0)
            wait_for_game_ready(session_name, verbose)
            time.sleep(0.3)

            for level_def in group['levels']:
                level_name = level_def['name']
                print(f"  Teleporting to {level_name}...")

                # Teleport to the level
                wizard_teleport_to_level(session_name, level_name, verbose)

                # Clean previous dumpmap
                if os.path.exists(dumpmap_file):
                    os.unlink(dumpmap_file)

                # Execute #dumpmap
                execute_dumpmap(session_name)
                time.sleep(0.2)

                # Read the dumpmap
                if not os.path.exists(dumpmap_file):
                    print(f"  WARNING: dumpmap failed for {level_name}")
                    continue

                grid = parse_dumpmap(dumpmap_file)
                if len(grid) != 21:
                    print(f"  WARNING: {level_name} has {len(grid)} rows (expected 21)")

                level_data = {
                    'levelName': level_name,
                    'branch': level_def['branch'],
                    'typGrid': grid,
                }
                if 'branchLevel' in level_def:
                    level_data['branchLevel'] = level_def['branchLevel']
                if 'nlevels' in level_def:
                    level_data['nlevels'] = level_def['nlevels']

                levels.append(level_data)
                print(f"  Captured {level_name}: {len(grid)} rows, {len(grid[0]) if grid else 0} cols")

            # Quit the game
            quit_game(session_name)

        finally:
            subprocess.run(['tmux', 'kill-session', '-t', session_name],
                           capture_output=True)
            if os.path.exists(dumpmap_file):
                os.unlink(dumpmap_file)
            try:
                os.rmdir(tmpdir)
            except OSError:
                pass

        # Build session JSON
        session = {
            'version': 2,
            'seed': int(seed),
            'type': 'special',
            'source': 'c',
            'group': group_name,
            'levels': levels,
        }

        # Write with compact typGrid rows
        raw = json.dumps(session, indent=2)
        lines_out = raw.split('\n')
        result = []
        i = 0
        while i < len(lines_out):
            line = lines_out[i]
            if line.rstrip().endswith('[') and i + 1 < len(lines_out):
                nxt = lines_out[i + 1].strip()
                if nxt and re.match(r'^-?\d', nxt.rstrip(',').rstrip()):
                    prefix = line.rstrip()
                    nums = []
                    j = i + 1
                    while j < len(lines_out):
                        t = lines_out[j].strip()
                        if t in (']', '],'):
                            result.append(f'{prefix}{", ".join(nums)}{t}')
                            i = j + 1
                            break
                        nums.append(t.rstrip(','))
                        j += 1
                    continue
            result.append(line)
            i += 1

        filename = f'seed{seed}_special_{group_name}.session.json'
        filepath = os.path.join(SESSIONS_DIR, filename)
        with open(filepath, 'w') as f:
            f.write('\n'.join(result) + '\n')

        print(f"  Wrote {filepath} ({len(levels)} levels)")


def main():
    args = sys.argv[1:]

    if '--list-groups' in args:
        print("Available level groups:")
        for name, group in sorted(LEVEL_GROUPS.items()):
            nlevels = len(group['levels'])
            print(f"  {name:12s} - {group['description']} ({nlevels} level(s))")
        return

    # Parse --seeds
    seeds = [42, 1, 100]
    for i, arg in enumerate(args):
        if arg == '--seeds' and i + 1 < len(args):
            seeds = [int(s) for s in args[i + 1].split(',')]
            args = args[:i] + args[i + 2:]
            break

    verbose = '--verbose' in args or os.environ.get('WEBHACK_DEBUG', '')
    args = [a for a in args if a != '--verbose']

    if '--all' in args:
        for group_name in LEVEL_GROUPS:
            generate_group(group_name, seeds, verbose)
        return

    if not args:
        print(f"Usage: {sys.argv[0]} <group> [--seeds 42,1,100]")
        print(f"       {sys.argv[0]} --all [--seeds 42,1,100]")
        print(f"       {sys.argv[0]} --list-groups")
        sys.exit(1)

    group_name = args[0]
    generate_group(group_name, seeds, verbose)


if __name__ == '__main__':
    main()
