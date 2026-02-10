#!/usr/bin/env python3
"""Generate a complete C trace of oracle level generation with full RNG logging.

This captures:
1. Full RNG call sequence (NETHACK_RNGLOG)
2. Final terrain grid (NETHACK_DUMPMAP via #dumpmap)
3. Known seed and wizard mode context

Output: test/comparison/traces/oracle_seed<N>_c.json containing:
{
  "seed": 42,
  "levelName": "oracle",
  "branch": "Dungeons of Doom",
  "typGrid": [[...], ...],
  "rngLog": [
    {"call": 1, "func": "rn2", "args": "10", "result": 5, "caller": "foo(bar.c:123)"},
    ...
  ]
}

Usage:
    python3 gen_oracle_rng_trace.py [--seed 42] [--verbose]
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
TRACES_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'traces')
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


def wizard_teleport_to_oracle(session, verbose):
    """Teleport to oracle level in wizard mode."""
    if verbose:
        print('  [teleport] Initiating wizard teleport to oracle')

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
            print('  [teleport] WARNING: never got level prompt')
        return False

    # Type ? and Enter to open menu
    tmux_send(session, '?', 0.3)
    tmux_send_special(session, 'Enter', 0.8)

    # Scan menu pages to find oracle
    target_key = None
    for page in range(5):
        time.sleep(0.5)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if verbose and page == 0:
            for line in content.split('\n')[:5]:
                if line.strip():
                    print(f'  [menu] {line.rstrip()[:70]}')

        # Look for oracle in the menu
        for line in content.split('\n'):
            line = line.strip()
            m = re.match(r'^([a-zA-Z])\s+-\s+[*]?\s*oracle:', line)
            if m:
                target_key = m.group(1)
                if verbose:
                    print(f'  [menu] Found "oracle" → key "{target_key}" in: {line}')
                break

        if target_key:
            break

        if '(end)' in content or 'Pick' in content:
            break
        if re.search(r'\(\d+ of \d+\)', content):
            tmux_send_special(session, 'Space', 0.3)
        else:
            break

    if not target_key:
        if verbose:
            print('  [teleport] WARNING: "oracle" not found in menu')
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

        if 'Dlvl:' in content:
            first_line = content.split('\n')[0] if content else ''
            if 'teleport' not in first_line.lower():
                if verbose:
                    for line in content.split('\n'):
                        if 'Dlvl:' in line:
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


def parse_rng_log(rnglog_file):
    """Parse NETHACK_RNGLOG output into structured format.

    Format examples:
        1 rn2(10) = 5 @ foo(bar.c:123)
        2 rnd(6) = 4 @ baz(qux.c:456)
        >funcname @ caller(file:line)
        <funcname=result #start-end @ caller(file:line)
    """
    rng_calls = []
    with open(rnglog_file) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            # Skip mid-level tracing markers
            if line.startswith('>') or line.startswith('<'):
                continue

            # Parse RNG call: "123 rn2(10) = 5 @ foo(bar.c:123)"
            m = re.match(r'^(\d+)\s+(\w+)\(([^)]*)\)\s+=\s+(\d+)(?:\s+@\s+(.+))?$', line)
            if m:
                call_num = int(m.group(1))
                func = m.group(2)
                args = m.group(3)
                result = int(m.group(4))
                caller = m.group(5) if m.group(5) else None

                rng_calls.append({
                    'call': call_num,
                    'func': func,
                    'args': args,
                    'result': result,
                    'caller': caller
                })

    return rng_calls


def generate_oracle_trace(seed, verbose=False):
    """Generate oracle level trace with full RNG logging."""
    print(f"\n=== Generating Oracle Trace (seed {seed}) ===")

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print("Run setup.sh first.")
        sys.exit(1)

    setup_home()
    os.makedirs(TRACES_DIR, exist_ok=True)

    tmpdir = tempfile.mkdtemp(prefix=f'oracle-trace-{seed}-')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')
    rnglog_file = os.path.join(tmpdir, 'rnglog.txt')
    session_name = f'oracle-trace-{seed}-{os.getpid()}'

    try:
        # Run NetHack with RNGLOG and DUMPMAP enabled
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_DUMPMAP={dumpmap_file} '
            f'NETHACK_RNGLOG={rnglog_file} '
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

        print("  Teleporting to oracle level...")
        if not wizard_teleport_to_oracle(session_name, verbose):
            print("  ERROR: Failed to teleport to oracle")
            return None

        # Execute #dumpmap to capture terrain
        print("  Executing #dumpmap...")
        execute_dumpmap(session_name)
        time.sleep(0.2)

        # Quit the game to flush RNG log
        print("  Quitting game to flush logs...")
        quit_game(session_name)
        time.sleep(0.5)

        # Read the outputs
        if not os.path.exists(dumpmap_file):
            print("  ERROR: dumpmap file not found")
            return None

        if not os.path.exists(rnglog_file):
            print("  ERROR: rnglog file not found")
            return None

        typGrid = parse_dumpmap(dumpmap_file)
        rngLog = parse_rng_log(rnglog_file)

        print(f"  Captured terrain: {len(typGrid)} rows × {len(typGrid[0]) if typGrid else 0} cols")
        print(f"  Captured RNG calls: {len(rngLog)}")

        # Build trace JSON
        trace = {
            'version': 1,
            'seed': seed,
            'levelName': 'oracle',
            'branch': 'Dungeons of Doom',
            'context': 'wizard mode teleport directly to oracle',
            'typGrid': typGrid,
            'rngLog': rngLog
        }

        # Write trace file
        filename = f'oracle_seed{seed}_c.json'
        filepath = os.path.join(TRACES_DIR, filename)
        with open(filepath, 'w') as f:
            json.dump(trace, f, indent=2)

        print(f"\n✓ Wrote {filepath}")
        print(f"  RNG calls: {len(rngLog)}")
        print(f"  Terrain: {len(typGrid)}×{len(typGrid[0]) if typGrid else 0}")

        return filepath

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name],
                      capture_output=True)
        # Keep temp files for debugging if verbose
        if not verbose:
            if os.path.exists(dumpmap_file):
                os.unlink(dumpmap_file)
            if os.path.exists(rnglog_file):
                os.unlink(rnglog_file)
            try:
                os.rmdir(tmpdir)
            except OSError:
                pass


def main():
    args = sys.argv[1:]

    seed = 42
    verbose = False

    for i, arg in enumerate(args):
        if arg == '--seed' and i + 1 < len(args):
            seed = int(args[i + 1])
        elif arg == '--verbose':
            verbose = True

    generate_oracle_trace(seed, verbose)


if __name__ == '__main__':
    main()
