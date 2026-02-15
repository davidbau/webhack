#!/usr/bin/env python3
"""Generate C map traces for special levels across all dungeon branches.

Usage:
    python3 gen_special_sessions.py <group> [--seeds 42,1,100] [--verbose]
    python3 gen_special_sessions.py --list-groups
    python3 gen_special_sessions.py --all [--seeds 42,1,100] [--verbose]

Groups: sokoban, mines, vlad, knox, oracle, castle, medusa, valley,
        gehennom, wizard, quest, planes, rogue, bigroom, filler, tutorial

Each group generates session files for the special levels in that category,
capturing typGrid via #dumpmap after teleporting to each level.

Quest capture is role-aware: quest levels are collected in separate runs using
the matching role to avoid cross-role level contamination.

Note: "planes" capture is automatically delegated to gen_planes_with_amulet.py
so endgame prerequisites (Amulet possession) are handled consistently.

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
fixed_datetime_env = _dumpmap.fixed_datetime_env


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
            {
                'name': 'knox',
                'branch': 'Fort Ludios',
                'branchLevel': 1,
                'allowBranchFallback': True,
                'allowWizloadFallback': True,
                'forceWizload': True,
            },
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

QUEST_ROLE_BY_PREFIX = {
    'Arc': 'Archeologist',
    'Bar': 'Barbarian',
    'Cav': 'Caveman',
    'Hea': 'Healer',
    'Kni': 'Knight',
    'Mon': 'Monk',
    'Pri': 'Priest',
    'Ran': 'Ranger',
    'Rog': 'Rogue',
    'Sam': 'Samurai',
    'Tou': 'Tourist',
    'Val': 'Valkyrie',
    'Wiz': 'Wizard',
}


def wizard_teleport_to_level(session, level_name, verbose, branch_name=None, allow_branch_fallback=False):
    """Use Ctrl+V ? menu to teleport to a named level.

    Name-based teleport only works within the current branch, so this uses
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
        return False, None

    # Type ? and Enter to open menu
    tmux_send(session, '?', 0.3)
    tmux_send_special(session, 'Enter', 0.8)

    # Scan menu pages to find the target level
    target_key = None
    target_depth = None
    branch_key = None
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
            m = re.match(r'^([a-zA-Z])\s+-\s+[*]?\s*' + re.escape(level_name) + r':\s*(-?\d+)', line)
            if m:
                target_key = m.group(1)
                target_depth = int(m.group(2))
                if verbose:
                    print(f'  [menu] Found "{level_name}" → key "{target_key}" in: {line}')
                break
            if allow_branch_fallback and branch_name and branch_key is None:
                mb = re.match(r'^([a-zA-Z])\s+-\s+.*' + re.escape(branch_name) + r':', line)
                if mb:
                    branch_key = mb.group(1)
            # Also match "knox: 20" without letter (Fort Ludios has no letter sometimes)
            # and branch entries like "Stair to Sokoban: 10"

        if target_key:
            break

        # Check if there are more pages.
        # "Pick" is part of the normal pager prompt and should not stop paging.
        if '(end)' in content:
            break
        if re.search(r'\(\d+ of \d+\)', content):
            # More pages available, press Space to scroll
            tmux_send_special(session, 'Space', 0.3)
        else:
            break

    if not target_key and allow_branch_fallback and branch_key:
        target_key = branch_key
        if verbose:
            print(f'  [menu] Falling back to branch "{branch_name}" via key "{target_key}"')

    if not target_key:
        if verbose:
            print(f'  [teleport] WARNING: "{level_name}" not found in menu')
        # Cancel menu
        tmux_send_special(session, 'Escape', 0.3)
        time.sleep(0.3)
        return False, None

    # Select the level
    tmux_send(session, target_key, 0.5)

    # Wait for teleport to complete
    arrived_depth = None
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

        # Quest levels show branch-local status like "Home 1"/"Goal 2"
        # rather than Dlvl, so accept those as successful arrival too.
        if ('Dlvl:' in content or 'Plane' in content or 'End Game' in content
                or re.search(r'\b(Home|Loca|Goal)\s+\d+\b', content)):
            first_line = content.split('\n')[0] if content else ''
            if 'teleport' not in first_line.lower():
                arrived_depth = _extract_dlvl(content)
                if arrived_depth is None:
                    arrived_depth = target_depth
                if verbose:
                    for line in content.split('\n'):
                        if ('Dlvl:' in line or 'Plane' in line
                                or re.search(r'\b(Home|Loca|Goal)\s+\d+\b', line)):
                            print(f'  [teleport] Arrived: {line.strip()[:60]}')
                            break
                break

        time.sleep(0.2)

    time.sleep(0.3)
    return True, arrived_depth


def _extract_dlvl(content):
    m = re.search(r'\bDlvl:(\d+)\b', content or '')
    return int(m.group(1)) if m else None


def wizard_load_des_level(session, level_name, verbose, rnglog_file=None):
    """Load a special-level Lua file via #wizloaddes."""
    if verbose:
        print(f'  [wizloaddes] Loading {level_name}.lua')

    tmux_send(session, '#', 0.2)
    tmux_send(session, 'wizloaddes', 0.2)
    tmux_send_special(session, 'Enter', 0.3)

    for _ in range(30):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            return False, None, None
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.2)
            continue
        if 'Load which des lua file?' in content:
            prompt_rng = get_rng_call_count(rnglog_file)
            tmux_send(session, level_name, 0.2)
            tmux_send_special(session, 'Enter', 0.5)
            break
        time.sleep(0.1)
    else:
        if verbose:
            print(f'  [wizloaddes] WARNING: no file prompt for {level_name}')
        return False, None, None

    for _ in range(60):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            return False, None, None
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.2)
            continue
        # A settled status line with Dlvl indicates map is ready.
        if _extract_dlvl(content) is not None:
            settled_rng = get_rng_call_count(rnglog_file)
            rng_call_start = calibrate_wizload_rng_start(
                rnglog_file, prompt_rng, settled_rng
            )
            return True, rng_call_start, _extract_dlvl(content)
        time.sleep(0.1)

    if verbose:
        print(f'  [wizloaddes] WARNING: timeout waiting for level load of {level_name}')
    return False, None, None


def capture_filler_level(session, level_name, verbose, rnglog_file=None):
    """Capture filler levels by loading the exact des Lua file."""
    return wizard_load_des_level(session, level_name, verbose, rnglog_file)


def parse_dumpmap(dumpmap_file):
    """Parse a dumpmap output file into a typGrid."""
    with open(dumpmap_file) as f:
        lines = f.readlines()
    grid = []
    for line in lines:
        row = [int(x) for x in line.strip().split()]
        grid.append(row)
    return grid


def read_checkpoint_entries(checkpoint_file, start_index=0):
    """Read JSONL checkpoint entries from checkpoint_file starting at start_index."""
    if not checkpoint_file or not os.path.exists(checkpoint_file):
        return [], start_index

    entries = []
    next_index = int(start_index)
    with open(checkpoint_file, 'r', encoding='utf-8', errors='ignore') as f:
        for idx, line in enumerate(f):
            if idx < int(start_index):
                continue
            next_index = idx + 1
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    return entries, next_index


def get_rng_call_count(rnglog_file):
    """Return the last RNG call number from an RNG log file, or None."""
    if not rnglog_file or not os.path.exists(rnglog_file):
        return None
    last = None
    with open(rnglog_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            m = re.match(r'^\s*(\d+)\s+', line)
            if m:
                last = int(m.group(1))
    return last


def get_rng_raw_draw_count(rnglog_file, upto_call_no=None):
    """Estimate underlying raw PRNG draws up to an optional logged call number."""
    if not rnglog_file or not os.path.exists(rnglog_file):
        return None

    line_re = re.compile(
        r'^\s*(\d+)\s+([a-zA-Z0-9_]+)\(([^)]*)\)\s*=\s*(-?\d+)'
    )

    def draw_count(fn, args_text, result):
        # Primitive RNG wrappers consume one raw draw.
        if fn in ('rn2', 'rnd', 'rnl'):
            return 1
        # d(n,x) consumes n raw draws in C rnd.c.
        if fn == 'd':
            parts = [p.strip() for p in args_text.split(',')]
            if parts and re.fullmatch(r'-?\d+', parts[0]):
                return max(0, int(parts[0]))
            return 1
        # rne(x) is logged as a summary in traces that also include its
        # underlying rn2 calls, so treat this entry as non-consuming here.
        if fn == 'rne':
            return 0
        # rnz() is typically logged alongside its component calls in our traces.
        # Count 0 here to avoid double-counting when those calls are present.
        if fn == 'rnz':
            return 0
        return 1

    total = 0
    with open(rnglog_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            m = line_re.match(line.rstrip('\n'))
            if not m:
                continue
            call_no = int(m.group(1))
            if upto_call_no is not None and call_no > int(upto_call_no):
                break
            fn = m.group(2)
            args_text = m.group(3).strip()
            result = int(m.group(4))
            total += draw_count(fn, args_text, result)
    return total


def extract_rng_prelude_calls(rnglog_file, rng_call_start):
    """Extract nhlua prelude RNG calls between start and special-level init."""
    if not rnglog_file or not os.path.exists(rnglog_file) or rng_call_start is None:
        return None

    line_re = re.compile(
        r'^\s*(\d+)\s+([a-zA-Z0-9_]+)\(([^)]*)\)\s*=\s*.*?\s+@\s+(.+)$'
    )
    calls = []
    with open(rnglog_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            m = line_re.match(line.rstrip('\n'))
            if not m:
                continue
            call_no = int(m.group(1))
            if call_no <= int(rng_call_start):
                continue
            fn = m.group(2)
            arg_text = m.group(3).strip()
            src = m.group(4)

            # Prelude ends once level_init's random-lit call starts.
            if 'splev_initlev(sp_lev.c:2984)' in src:
                break
            if 'nhl_rn2(nhlua.c:930)' not in src:
                continue
            if fn != 'rn2':
                continue
            if not re.fullmatch(r'-?\d+', arg_text):
                continue
            calls.append({'fn': 'rn2', 'arg': int(arg_text)})

    return calls if calls else None


def extract_post_prelude_fingerprint(rnglog_file, rng_call_start, limit=20):
    """Capture first simple RNG ops after prelude for offset calibration."""
    if not rnglog_file or not os.path.exists(rnglog_file) or rng_call_start is None:
        return None

    line_re = re.compile(
        r'^\s*(\d+)\s+([a-zA-Z0-9_]+)\(([^)]*)\)\s*=\s*(-?\d+).*?\s+@\s+(.+)$'
    )
    calls = []
    with open(rnglog_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            m = line_re.match(line.rstrip('\n'))
            if not m:
                continue
            call_no = int(m.group(1))
            if call_no <= int(rng_call_start):
                continue
            fn = m.group(2)
            arg_text = m.group(3).strip()
            result = int(m.group(4))
            src = m.group(5)

            # Skip prelude Lua rn2 calls; they are replayed separately.
            if 'nhl_rn2(nhlua.c:930)' in src:
                continue
            if fn not in ('rn2', 'rnd', 'd', 'rne', 'rnz'):
                continue
            entry = {'fn': fn, 'result': result}
            if fn in ('rn2', 'rnd', 'rne', 'rnz'):
                if not re.fullmatch(r'-?\d+', arg_text):
                    continue
                entry['arg'] = int(arg_text)
            elif fn == 'd':
                parts = [p.strip() for p in arg_text.split(',')]
                if len(parts) != 2:
                    continue
                if not re.fullmatch(r'-?\d+', parts[0]) or not re.fullmatch(r'-?\d+', parts[1]):
                    continue
                entry['args'] = [int(parts[0]), int(parts[1])]
            else:
                continue
            calls.append(entry)
            if len(calls) >= limit:
                break
    return calls if calls else None


def calibrate_wizload_rng_start(rnglog_file, prompt_rng, settled_rng):
    """Estimate rngCallStart for #wizloaddes from RNG-log source locations."""
    if prompt_rng is None:
        return None
    # Use the RNG count at the "Load which des lua file?" prompt directly.
    #
    # Rationale:
    # Previous marker-based scanning could jump forward into sp_lev/mk* calls
    # and over-skip early wizload RNG, causing large flip/parity divergences
    # on some seeds (notably knox seed 1). Using prompt_rng is stable across
    # seeds and keeps JS/C alignment at the command boundary.
    return prompt_rng


def generate_group(group_name, seeds, verbose=False):
    """Generate special-level traces for one group across all requested seeds."""
    if group_name not in LEVEL_GROUPS:
        print(f"Error: unknown group '{group_name}'")
        print(f"Available: {', '.join(sorted(LEVEL_GROUPS.keys()))}")
        sys.exit(1)

    # Elemental planes require endgame setup; always route through the
    # dedicated harness so callers of this script don't accidentally produce
    # empty plane sessions.
    if group_name == 'planes':
        cmd = [
            sys.executable,
            os.path.join(SCRIPT_DIR, 'gen_planes_with_amulet.py'),
            '--seeds',
            ','.join(str(s) for s in seeds),
        ]
        if verbose:
            cmd.append('--verbose')
        subprocess.run(cmd, check=True)
        return

    group = LEVEL_GROUPS[group_name]
    print(f"\n=== {group['description']} ===")
    print(f"Seeds: {seeds}")

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first.")
        sys.exit(1)

    os.makedirs(SESSIONS_DIR, exist_ok=True)

    for seed in seeds:
        print(f"\n--- Seed {seed} ---")

        tmpdir = tempfile.mkdtemp(prefix=f'webhack-special-{seed}-')
        dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')
        checkpoint_file = os.path.join(tmpdir, 'checkpoints.jsonl')
        rnglog_file = os.path.join(tmpdir, 'rnglog.txt')

        levels = []

        def capture_level_batch(level_defs, role_name=None):
            """Capture a batch of level definitions in one game session."""
            nonlocal rnglog_file
            role_tag = role_name.lower() if role_name else 'default'
            session_name = f'webhack-special-{seed}-{role_tag}-{os.getpid()}'
            checkpoint_cursor = 0

            # For quest captures, role must match requested quest levels.
            if role_name:
                setup_home(role=role_name, race=None, gender=None, align=None)
            else:
                setup_home()

            cmd = (
                f'{fixed_datetime_env()}'
                f'NETHACKDIR={INSTALL_DIR} '
                f'NETHACK_SEED={seed} '
                f'NETHACK_DUMPMAP={dumpmap_file} '
                f'NETHACK_DUMPSNAP={checkpoint_file} '
                f"{('NETHACK_RNGLOG=' + os.environ['NETHACK_RNGLOG'] + ' ') if os.environ.get('NETHACK_RNGLOG') else ('NETHACK_RNGLOG=' + rnglog_file + ' ')}"
                f"{('NETHACK_RNDMON_TRACE=' + os.environ['NETHACK_RNDMON_TRACE'] + ' ') if os.environ.get('NETHACK_RNDMON_TRACE') else ''}"
                f"{('NETHACK_MKOBJ_TRACE=' + os.environ['NETHACK_MKOBJ_TRACE'] + ' ') if os.environ.get('NETHACK_MKOBJ_TRACE') else ''}"
                f'HOME={RESULTS_DIR} '
                f'TERM=xterm-256color '
                f'{NETHACK_BINARY} -u Wizard -D; '
                f'sleep 999'
            )
            subprocess.run(
                ['tmux', 'new-session', '-d', '-s', session_name, '-x', '100', '-y', '30', cmd],
                check=True
            )

            try:
                time.sleep(1.0)
                wait_for_game_ready(session_name, verbose)
                time.sleep(0.3)

                for level_def in level_defs:
                    level_name = level_def['name']
                    print(f"  Teleporting to {level_name}...")
                    rng_call_start = get_rng_call_count(rnglog_file)
                    level_checkpoint_start = checkpoint_cursor
                    abs_depth = None

                    # Teleport to the level
                    if bool(level_def.get('forceWizload')):
                        ok, wiz_rng_start, abs_depth = wizard_load_des_level(
                            session_name, level_name, verbose, rnglog_file
                        )
                        if ok and wiz_rng_start is not None:
                            rng_call_start = wiz_rng_start
                    elif group_name == 'quest':
                        # Wizard teleport menu often reports the correct quest key
                        # but lands back on "Home 1". For quest parity captures,
                        # load the exact des level directly.
                        ok, wiz_rng_start, abs_depth = wizard_load_des_level(
                            session_name, level_name, verbose, rnglog_file
                        )
                        if ok and wiz_rng_start is not None:
                            rng_call_start = wiz_rng_start
                    elif group_name == 'filler':
                        ok, wiz_rng_start, abs_depth = capture_filler_level(
                            session_name, level_name, verbose, rnglog_file
                        )
                        if wiz_rng_start is not None:
                            rng_call_start = wiz_rng_start
                    else:
                        ok, abs_depth = wizard_teleport_to_level(
                            session_name,
                            level_name,
                            verbose,
                            branch_name=level_def.get('branch'),
                            allow_branch_fallback=bool(level_def.get('allowBranchFallback')),
                        )
                        if (not ok) and bool(level_def.get('allowWizloadFallback')):
                            ok, wiz_rng_start, abs_depth = wizard_load_des_level(
                                session_name, level_name, verbose, rnglog_file
                            )
                            if ok and wiz_rng_start is not None:
                                rng_call_start = wiz_rng_start
                    if not ok:
                        print(f"  WARNING: teleport failed for {level_name}, skipping capture")
                        continue

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
                    if len(grid) != 21 or any(len(row) != 80 for row in grid):
                        rows = len(grid)
                        cols = len(grid[0]) if rows else 0
                        print(f"  WARNING: {level_name} has shape {rows}x{cols} (expected 21x80), skipping capture")
                        continue

                    checkpoints, checkpoint_cursor = read_checkpoint_entries(
                        checkpoint_file, level_checkpoint_start
                    )

                    level_data = {
                        'levelName': level_name,
                        'branch': level_def['branch'],
                        'typGrid': grid,
                    }
                    if checkpoints:
                        level_data['checkpoints'] = checkpoints
                    if 'branchLevel' in level_def:
                        level_data['branchLevel'] = level_def['branchLevel']
                    if 'nlevels' in level_def:
                        level_data['nlevels'] = level_def['nlevels']
                    if role_name:
                        level_data['role'] = role_name
                    if abs_depth is not None:
                        level_data['absDepth'] = int(abs_depth)
                    if rng_call_start is not None:
                        level_data['rngCallStart'] = int(rng_call_start)
                        raw_start = get_rng_raw_draw_count(
                            rnglog_file, rng_call_start
                        )
                        if raw_start is not None:
                            level_data['rngRawCallStart'] = int(raw_start)
                        prelude_calls = extract_rng_prelude_calls(
                            rnglog_file, rng_call_start
                        )
                        if prelude_calls:
                            level_data['preRngCalls'] = prelude_calls
                        fingerprint = extract_post_prelude_fingerprint(
                            rnglog_file, rng_call_start
                        )
                        if fingerprint:
                            level_data['rngFingerprint'] = fingerprint

                    levels.append(level_data)
                    print(f"  Captured {level_name}: {len(grid)} rows, {len(grid[0]) if grid else 0} cols")

                # Quit the game
                quit_game(session_name)
            finally:
                subprocess.run(['tmux', 'kill-session', '-t', session_name],
                               capture_output=True)

        try:
            if group_name == 'quest':
                role_batches = {}
                for level_def in group['levels']:
                    level_name = level_def['name']
                    prefix = level_name.split('-')[0]
                    role_name = QUEST_ROLE_BY_PREFIX.get(prefix)
                    if not role_name:
                        print(f"  WARNING: unknown quest role prefix for {level_name}, skipping")
                        continue
                    role_batches.setdefault(role_name, []).append(level_def)

                for role_name in QUEST_ROLE_BY_PREFIX.values():
                    batch = role_batches.get(role_name, [])
                    if not batch:
                        continue
                    print(f"  Capturing quest levels as role {role_name}...")
                    capture_level_batch(batch, role_name=role_name)
            else:
                capture_level_batch(group['levels'])
        finally:
            if os.path.exists(dumpmap_file):
                os.unlink(dumpmap_file)
            if os.path.exists(checkpoint_file):
                os.unlink(checkpoint_file)
            if os.path.exists(rnglog_file):
                os.unlink(rnglog_file)
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
            'screenMode': 'decgraphics',
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
