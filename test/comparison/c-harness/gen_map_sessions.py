#!/usr/bin/env python3
"""Generate v2 map-only session JSON files from the C NetHack binary.

Usage:
    python3 gen_map_sessions.py <seed> [max_depth] [--with-rng]
    python3 gen_map_sessions.py --from-config
    python3 gen_map_sessions.py --c-golden

Single-seed mode: generates levels 1→max_depth sequentially (via wizard
mode level teleport) and captures typGrid at each depth using #dumpmap.
When --with-rng is given, also captures per-level RNG traces.

Config mode (--from-config): reads test/comparison/seeds.json and
generates C map sessions for all seeds listed in map_seeds.with_rng.c.

C golden mode (--c-golden): reads test/comparison/seeds.json c_golden
config and generates grid-only (no RNG traces) C map sessions for all
seeds at depths 1→max_depth. Faster than --from-config since no RNG
log is written. Output: test/comparison/maps/seed<N>_maps_c_golden.session.json

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
fixed_datetime_env = _dumpmap.fixed_datetime_env


def read_rng_log(rng_log_file):
    """Read the RNG log file and return (count, lines)."""
    try:
        with open(rng_log_file) as f:
            lines = f.readlines()
        return len(lines), lines
    except FileNotFoundError:
        return 0, []


def parse_rng_lines(lines):
    """Convert raw RNG log lines to compact format: 'fn(arg)=result @ source:line'

    Filters out wrapper function entries (rne, rnz) whose internal rn2/rnd
    calls are logged separately.  d() is kept because its internal RND()
    calls bypass rn2 and are not individually logged.

    Mid-level function tracing lines (>entry/<exit from 005-midlog patch)
    are passed through unchanged.
    """
    entries = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Mid-level tracing: >funcname ... or <funcname ... — pass through as-is
        if line[0] in ('>', '<'):
            entries.append(line)
            continue
        parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        rest = parts[1]
        # Skip wrapper entries whose internals are logged individually (rne, rnz).
        # Keep d() because its internal RND() calls bypass rn2 logging.
        fn = rest.split('(', 1)[0]
        if fn not in ('rn2', 'rnd', 'rn1', 'd'):
            continue
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


def generate_one(seed, max_depth, with_rng, output_filename=None, debug_themerm=True):
    """Generate a single C map session for the given seed.

    Args:
        seed: Random seed for level generation
        max_depth: Maximum depth to generate (1-5)
        with_rng: Whether to capture RNG traces
        output_filename: Optional custom output filename
        debug_themerm: If True, allow THEMERM debug mode (backward compat, default)
                      If False, explicitly unset THEMERM/THEMERMFILL (normal reservoir sampling)
    """

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
        # CRITICAL: Control THEMERM debug mode for themed room generation
        # Debug mode (default): allows env vars to be inherited, may skip reservoir sampling
        # Normal mode: explicitly unset env vars, ensures full reservoir sampling
        if debug_themerm:
            themerm_cmd = ''  # Allow debug mode (env vars may be inherited)
            env_check = ''
        else:
            themerm_cmd = 'unset THEMERM THEMERMFILL; '  # Force normal mode
            # Debug: verify THEMERM is unset
            env_check = 'echo "THEMERM=${THEMERM:-UNSET}" >> /tmp/nethack_env.log; '

        rnglog_env = f'NETHACK_RNGLOG={rng_log_file} ' if with_rng else ''
        cmd = (
            f'{themerm_cmd}'
            f'{env_check}'
            f'{fixed_datetime_env()}'
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

        time.sleep(1.0)
        wait_for_game_ready(session_name, verbose)
        time.sleep(0.1)

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
                level_data['rngCalls'] = sum(1 for e in rng_entries if e[0] not in ('>', '<'))
                level_data['rng'] = rng_entries
                prev_rng_count = rng_count
            else:
                # Even without full traces, capture the count
                if rng_log_file and os.path.exists(rng_log_file):
                    rng_count, rng_lines_raw = read_rng_log(rng_log_file)
                    delta_lines = rng_lines_raw[prev_rng_count:rng_count]
                    actual_rng = sum(1 for l in delta_lines if l.strip() and l.strip()[0] not in ('>', '<'))
                    level_data['rngCalls'] = actual_rng
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
        'wizard': True,  # Always true (uses -D flag for level teleport)
        'screenMode': 'decgraphics',
        'debugThemerm': debug_themerm,  # Whether THEMERM debug mode was enabled
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

    filename = output_filename or f'seed{seed}_maps_c.session.json'
    filepath = os.path.join(SESSIONS_DIR, filename)
    with open(filepath, 'w') as f:
        f.write('\n'.join(result) + '\n')

    print(f"Wrote {filepath} ({len(levels)} levels)")


def load_seeds_config():
    """Load test/comparison/seeds.json configuration."""
    config_path = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'seeds.json')
    with open(config_path) as f:
        return json.load(f)


def main():
    args = sys.argv[1:]

    if '--from-config' in args:
        config = load_seeds_config()
        c_rng_seeds = config['map_seeds']['with_rng']['c']
        print(f"Generating C map sessions with RNG for seeds: {c_rng_seeds}")
        for seed in c_rng_seeds:
            generate_one(str(seed), max_depth=5, with_rng=True)
        return

    if '--c-golden' in args or '--c-golden-depth1' in args:
        depth1_only = '--c-golden-depth1' in args
        config = load_seeds_config()
        c_golden = config['map_seeds']['c_golden']
        seeds = c_golden['seeds']
        max_depth = 1 if depth1_only else c_golden['max_depth']
        print(f"Generating C golden map sessions (grid-only, no RNG) for {len(seeds)} seeds, depths 1-{max_depth}")
        for i, seed in enumerate(seeds):
            print(f"[{i+1}/{len(seeds)}] seed={seed}")
            filename = f'seed{seed}_maps_c_golden.session.json'
            generate_one(str(seed), max_depth=max_depth, with_rng=False,
                         output_filename=filename)
        print(f"Done: {len(seeds)} seeds × {max_depth} depths")
        return

    with_rng = '--with-rng' in args
    normal_mode = '--normal-mode' in args  # Disable THEMERM debug mode
    args = [a for a in args if not a.startswith('--')]

    if len(args) < 1:
        print(f"Usage: {sys.argv[0]} <seed> [max_depth] [--with-rng] [--normal-mode]")
        print(f"       {sys.argv[0]} --from-config")
        print(f"       {sys.argv[0]} --c-golden")
        print(f"")
        print(f"Options:")
        print(f"  --with-rng      Include RNG traces in output")
        print(f"  --normal-mode   Disable THEMERM debug mode (use normal reservoir sampling)")
        print(f"                  Default is debug mode for backward compatibility")
        sys.exit(1)

    seed = args[0]
    max_depth = int(args[1]) if len(args) >= 2 else 5
    debug_themerm = not normal_mode  # Invert: normal_mode=True means debug_themerm=False
    generate_one(seed, max_depth, with_rng, debug_themerm=debug_themerm)


if __name__ == '__main__':
    main()
