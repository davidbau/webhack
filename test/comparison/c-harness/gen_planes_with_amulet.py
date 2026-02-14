#!/usr/bin/env python3
"""Generate C map traces for elemental planes with endgame setup.

This script uses wizard mode to:
1. Wish for the Amulet of Yendor
2. Teleport to each elemental plane
3. Capture typGrid via #dumpmap

Usage: python3 gen_planes_with_amulet.py [--seeds 1,42,100]
"""

import sys
import os
import json
import time
import tempfile
import subprocess
import re

# Import from parent directory
sys.path.insert(0, os.path.dirname(__file__))
from gen_special_sessions import (
    setup_home, wait_for_game_ready, execute_dumpmap, quit_game,
    tmux_send, tmux_send_special, tmux_capture,
    NETHACK_BINARY, INSTALL_DIR, SESSIONS_DIR, RESULTS_DIR,
    fixed_datetime_env,
    get_rng_call_count, get_rng_raw_draw_count,
    extract_rng_prelude_calls, extract_post_prelude_fingerprint
)

def wizard_wish_amulet(session, verbose=False):
    """Use wizard mode to wish for the Amulet of Yendor."""
    if verbose:
        print("  [wish] Wishing for Amulet of Yendor...")

    # Send Ctrl+W for wizard wish
    tmux_send_special(session, 'C-w', 0.5)

    # Wait for "For what do you wish?" prompt
    for attempt in range(20):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if 'For what do you wish' in content:
            break
        time.sleep(0.1)

    # Type "Amulet of Yendor" and press Enter
    tmux_send(session, 'Amulet of Yendor', 0.3)
    tmux_send_special(session, 'Enter', 0.5)

    # Handle any prompts (--More--, etc.)
    for attempt in range(10):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.3)
            continue
        if 'Dlvl:' in content:
            break
        time.sleep(0.2)

    # Clear any remaining prompt text by sending Escape
    tmux_send_special(session, 'Escape', 0.3)
    time.sleep(0.5)

    if verbose:
        print("  [wish] Amulet of Yendor obtained")

    time.sleep(0.3)

def wizard_teleport_to_plane(session, plane_name, verbose=False):
    """Teleport to an elemental plane using wizard mode."""
    if verbose:
        print(f"  [teleport] Teleporting to {plane_name}...")

    # Send Ctrl+V (wizard level teleport)
    tmux_send_special(session, 'C-v', 0.5)

    # Wait for "To what level" prompt
    prompt_seen = False
    for attempt in range(30):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if verbose and attempt == 0:
            print(f"  [debug] Screen after Ctrl+V (first 10 lines):")
            for i, line in enumerate(content.split('\n')[:10]):
                print(f"    [{i}] {line.rstrip()}")
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.3)
            continue
        if 'To what level' in content:
            prompt_seen = True
            if verbose:
                print(f"  [teleport] Got 'To what level' prompt")
            break
        time.sleep(0.2)

    if not prompt_seen:
        if verbose:
            print(f"  [teleport] WARNING: Never saw 'To what level' prompt")
            print(f"  [debug] Final screen content (last 5 lines):")
            try:
                content = tmux_capture(session)
                lines = content.split('\n')
                for line in lines[-5:]:
                    if line.strip():
                        print(f"    {line.rstrip()}")
            except:
                pass
        return False

    # Type ? and Enter to open menu
    tmux_send(session, '?', 0.3)
    tmux_send_special(session, 'Enter', 0.8)

    # Wait for menu to appear (look for letter options)
    menu_seen = False
    for attempt in range(10):
        time.sleep(0.3)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        # Look for menu format (lines with letter - levelname)
        if re.search(r'[a-zA-Z]\s+-\s+', content):
            menu_seen = True
            if verbose:
                print(f"  [teleport] Menu appeared")
            break

    if not menu_seen:
        if verbose:
            print(f"  [teleport] WARNING: Menu didn't appear after typing ?")
        return False

    # Scan menu pages to find the plane
    target_key = None
    for page in range(5):
        time.sleep(0.5)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if verbose and page == 0:
            print(f"  [menu] Searching for '{plane_name}' in menu:")
            for i, line in enumerate(content.split('\n')[:15]):
                if line.strip():
                    print(f"    [{i}] {line.strip()[:70]}")

        # Look for plane name (case insensitive, more flexible matching)
        for line in content.split('\n'):
            line_clean = line.strip()
            # Use search instead of match to allow map characters before menu text
            m = re.search(r'([a-zA-Z])\s+-\s+[*]?\s*' + re.escape(plane_name) + r':', line_clean, re.IGNORECASE)
            if m:
                target_key = m.group(1)
                if verbose:
                    print(f"  [menu] Found '{plane_name}' → key '{target_key}' in: {line_clean[:60]}")
                break

        if target_key:
            break

        # Check if there are more pages
        if '(end)' in content or 'Pick' in content:
            break
        if re.search(r'\(\d+ of \d+\)', content):
            tmux_send_special(session, 'Space', 0.3)
        else:
            break

    if not target_key:
        if verbose:
            print(f"  [teleport] WARNING: {plane_name} not found in menu")
        tmux_send_special(session, 'Escape', 0.3)
        return False

    # Select the plane
    tmux_send(session, target_key, 0.5)

    # Wait for teleport to complete (handle any prompts)
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

        if 'Endgame prerequisite' in content:
            tmux_send_special(session, 'Space', 0.3)
            continue

        if 'Plane' in content or 'Astral' in content:
            if verbose:
                for line in content.split('\n'):
                    if 'Plane' in line or 'Astral' in line:
                        print(f"  [teleport] Arrived: {line.strip()[:60]}")
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

def main():
    args = sys.argv[1:]

    # Parse --seeds
    seeds = [1]
    for i, arg in enumerate(args):
        if arg == '--seeds' and i + 1 < len(args):
            seeds = [int(s) for s in args[i + 1].split(',')]
            break

    verbose = '--verbose' in args or os.environ.get('WEBHACK_DEBUG', '')

    print("\n=== Elemental Planes (with Amulet) ===")
    print(f"Seeds: {seeds}")

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        sys.exit(1)

    setup_home()
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    planes = ['astral', 'water', 'fire', 'air', 'earth']

    for seed in seeds:
        print(f"\n--- Seed {seed} ---")

        tmpdir = tempfile.mkdtemp(prefix=f'webhack-planes-{seed}-')
        dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')
        rnglog_file = os.path.join(tmpdir, 'rng.log')
        session_name = f'webhack-planes-{seed}-{os.getpid()}'

        levels = []

        try:
            cmd = (
                f'{fixed_datetime_env()}'
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

            # Wish for Amulet of Yendor
            wizard_wish_amulet(session_name, verbose)

            # First teleport to Water to enter the endgame (planes require Amulet)
            print(f"  Teleporting to water (entry plane)...")
            success = wizard_teleport_to_plane(session_name, 'water', verbose)
            if not success:
                print(f"  ERROR: Failed to teleport to water - cannot access other planes")
                quit_game(session_name)
                continue

            # Now we're ON an elemental plane, capture all 5 planes from here
            # We start by teleporting to astral, then visit all planes including water
            current_plane = 'water'
            for plane_name in planes:
                print(f"  Teleporting to {plane_name}...")

                # Track RNG call count before teleport
                rng_call_start = get_rng_call_count(rnglog_file)

                # Teleport to the plane (unless we're already on it)
                if plane_name == current_plane:
                    print(f"  Already on {plane_name}, capturing...")
                else:
                    success = wizard_teleport_to_plane(session_name, plane_name, verbose)
                    if not success:
                        print(f"  WARNING: Failed to teleport to {plane_name}")
                        continue
                    current_plane = plane_name

                # Clean previous dumpmap
                if os.path.exists(dumpmap_file):
                    os.unlink(dumpmap_file)

                # Execute #dumpmap
                execute_dumpmap(session_name)
                time.sleep(0.2)

                # Read the dumpmap
                if not os.path.exists(dumpmap_file):
                    print(f"  WARNING: dumpmap failed for {plane_name}")
                    continue

                grid = parse_dumpmap(dumpmap_file)
                if len(grid) != 21:
                    print(f"  WARNING: {plane_name} has {len(grid)} rows (expected 21)")

                level_data = {
                    'levelName': plane_name,
                    'branch': 'Elemental Planes',
                    'typGrid': grid,
                }

                # Add RNG fingerprint data if available
                # Capture full RNG sequence (not just 20 calls) for debugging
                if rng_call_start is not None:
                    level_data['rngCallStart'] = int(rng_call_start)
                    raw_start = get_rng_raw_draw_count(rnglog_file, rng_call_start)
                    if raw_start is not None:
                        level_data['rngRawCallStart'] = int(raw_start)
                    prelude_calls = extract_rng_prelude_calls(rnglog_file, rng_call_start)
                    if prelude_calls:
                        level_data['preRngCalls'] = prelude_calls
                    # Use large limit to capture full RNG sequence for level generation
                    fingerprint = extract_post_prelude_fingerprint(rnglog_file, rng_call_start, limit=10000)
                    if fingerprint:
                        level_data['rngFingerprint'] = fingerprint

                levels.append(level_data)
                rng_info = f", rngFingerprint: {len(level_data.get('rngFingerprint', []))} calls" if level_data.get('rngFingerprint') else ""
                print(f"  Captured {plane_name}: {len(grid)} rows, {len(grid[0]) if grid else 0} cols{rng_info}")

            # Quit the game
            quit_game(session_name)

        finally:
            subprocess.run(['tmux', 'kill-session', '-t', session_name],
                           capture_output=True)
            if os.path.exists(dumpmap_file):
                os.unlink(dumpmap_file)
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
            'group': 'planes',
            'screenMode': 'decgraphics',
            'levels': levels,
        }

        # Write with compact typGrid rows
        filename = f'seed{seed}_special_planes.session.json'
        filepath = os.path.join(SESSIONS_DIR, filename)

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

        with open(filepath, 'w') as f:
            f.write('\n'.join(result) + '\n')

        print(f"  Wrote {filepath} ({len(levels)} levels)")

if __name__ == '__main__':
    main()
