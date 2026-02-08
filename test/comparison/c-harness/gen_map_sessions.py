#!/usr/bin/env python3
"""Generate v2 map-only session JSON files from the C NetHack binary.

Usage:
    python3 gen_map_sessions.py <seed> [max_depth] [--with-rng]

Generates levels 1→max_depth sequentially (via wizard mode level teleport)
and captures typGrid at each depth using #dumpmap. When --with-rng is given,
also captures per-level RNG traces from the C PRNG logger.

Output: test/comparison/maps/seed<N>_maps_c.session.json

Requires the C binary to be built with setup.sh first.
"""

import sys
import os
import json
import time
import tempfile
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'maps')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')

# Import shared helpers from run_dumpmap.py
# We import the functions we need by loading the module
import importlib.util
_spec = importlib.util.spec_from_file_location('run_dumpmap', os.path.join(SCRIPT_DIR, 'run_dumpmap.py'))
_dumpmap = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_dumpmap)

setup_home = _dumpmap.setup_home
wait_for_game_ready = _dumpmap.wait_for_game_ready
wizard_level_teleport = _dumpmap.wizard_level_teleport
execute_dumpmap = _dumpmap.execute_dumpmap
quit_game = _dumpmap.quit_game
tmux_send = _dumpmap.tmux_send
tmux_send_special = _dumpmap.tmux_send_special
tmux_capture = _dumpmap.tmux_capture


def read_rng_log(rng_log_file):
    """Read the RNG log file and return (count, lines)."""
    try:
        with open(rng_log_file) as f:
            lines = f.readlines()
        return len(lines), lines
    except FileNotFoundError:
        return 0, []


def parse_rng_lines(lines):
    """Convert raw RNG log lines to compact format: 'fn(arg)=result @ source:line'"""
    entries = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        rest = parts[1]
        rest = rest.replace(' = ', '=')
        entries.append(rest)
    return entries


def parse_dumpmap(dumpmap_file):
    """Parse a dumpmap output file into a typGrid (list of lists of ints)."""
    with open(dumpmap_file) as f:
        lines = f.readlines()
    grid = []
    for line in lines:
        row = [int(x) for x in line.strip().split()]
        grid.append(row)
    return grid


def main():
    args = sys.argv[1:]
    with_rng = '--with-rng' in args
    args = [a for a in args if not a.startswith('--')]

    if len(args) < 1:
        print(f"Usage: {sys.argv[0]} <seed> [max_depth] [--with-rng]")
        sys.exit(1)

    seed = args[0]
    max_depth = int(args[1]) if len(args) >= 2 else 5

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    verbose = os.environ.get('WEBHACK_DEBUG', '')
    setup_home()
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    # Create temp files for dumpmap output and RNG log
    tmpdir = tempfile.mkdtemp(prefix='webhack-gen-')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt') if with_rng else ''

    session_name = f'webhack-gen-{seed}-{os.getpid()}'

    try:
        # Build the shell command
        rnglog_env = f'NETHACK_RNGLOG={rng_log_file} ' if with_rng else ''
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_DUMPMAP={dumpmap_file} '
            f'{rnglog_env}'
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '100', '-y', '30', cmd],
            check=True
        )

        time.sleep(2.0)
        wait_for_game_ready(session_name, verbose)
        time.sleep(0.5)

        levels = []
        prev_rng_count = 0

        for depth in range(1, max_depth + 1):
            # Teleport to the target depth (skip for depth 1, we're already there)
            if depth > 1:
                wizard_level_teleport(session_name, depth, verbose)

            # Clean previous dumpmap output
            if os.path.exists(dumpmap_file):
                os.unlink(dumpmap_file)

            # Execute #dumpmap
            execute_dumpmap(session_name)

            # Read the dumpmap output
            if not os.path.exists(dumpmap_file):
                print(f"WARNING: dumpmap failed at depth {depth}")
                continue

            grid = parse_dumpmap(dumpmap_file)
            if len(grid) != 21:
                print(f"WARNING: depth {depth} has {len(grid)} rows (expected 21)")

            level_data = {'depth': depth, 'typGrid': grid}

            # Read RNG log delta for this depth
            if with_rng:
                rng_count, rng_lines = read_rng_log(rng_log_file)
                delta_lines = rng_lines[prev_rng_count:rng_count]
                rng_entries = parse_rng_lines(delta_lines)
                level_data['rngCalls'] = len(rng_entries)
                level_data['rng'] = rng_entries
                prev_rng_count = rng_count
            else:
                # Even without full traces, capture the count
                if rng_log_file and os.path.exists(rng_log_file):
                    rng_count, _ = read_rng_log(rng_log_file)
                    level_data['rngCalls'] = rng_count - prev_rng_count
                    prev_rng_count = rng_count

            levels.append(level_data)
            if verbose:
                print(f"  Captured depth {depth}: {len(grid)} rows" +
                      (f", {level_data.get('rngCalls', '?')} rng calls" if 'rngCalls' in level_data else ''))

        # Quit the game
        quit_game(session_name)

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name],
                       capture_output=True)
        # Clean up temp files
        for f in [dumpmap_file, rng_log_file]:
            if f and os.path.exists(f):
                os.unlink(f)
        try:
            os.rmdir(tmpdir)
        except OSError:
            pass

    # Build the session JSON
    session = {
        'version': 2,
        'seed': int(seed),
        'type': 'map',
        'source': 'c',
        'levels': levels,
    }

    # Write with compact typGrid rows
    raw = json.dumps(session, indent=2)
    lines = raw.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect start of a number array
        if line.rstrip().endswith('[') and i + 1 < len(lines):
            import re
            nxt = lines[i + 1].strip()
            if nxt and re.match(r'^-?\d', nxt.rstrip(',').rstrip()):
                prefix = line.rstrip()
                nums = []
                j = i + 1
                while j < len(lines):
                    t = lines[j].strip()
                    if t in (']', '],'):
                        result.append(f'{prefix}{", ".join(nums)}{t}')
                        i = j + 1
                        break
                    nums.append(t.rstrip(','))
                    j += 1
                continue
        result.append(line)
        i += 1

    filename = f'seed{seed}_maps_c.session.json'
    filepath = os.path.join(SESSIONS_DIR, filename)
    with open(filepath, 'w') as f:
        f.write('\n'.join(result) + '\n')

    print(f"Wrote {filepath} ({len(levels)} levels)")


if __name__ == '__main__':
    main()
