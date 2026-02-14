#!/usr/bin/env python3
"""Capture a C NetHack inventory session for comparison testing.

Starts a game as a Wizard (lots of starting items), presses 'i' to show
inventory, captures the screen, then picks up floor items and shows
inventory again.

Usage:
    python3 capture_inventory.py <seed> <output_json> [move_sequence]

The move_sequence defaults to just 'i' (show inventory at start).
You can add moves like 'i,l,li' to: show inventory, pickup, move east,
move east, show inventory again.

Example:
    python3 capture_inventory.py 42 ../sessions/seed42_inventory_wizard.session.json 'i'
"""

import sys
import os
import json
import time
import subprocess
import shutil
import tempfile
import importlib.util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')

# Import shared helpers from run_session.py
_spec = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_session = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_session)

# Override CHARACTER for Wizard role
CHARACTER = {
    'name': 'Merlin',
    'role': 'Wizard',
    'race': 'elf',
    'gender': 'male',
    'align': 'chaotic',
}

# Reuse helpers
parse_rng_lines = _session.parse_rng_lines
compact_session_json = _session.compact_session_json
read_rng_log = _session.read_rng_log
tmux_send = _session.tmux_send
tmux_send_special = _session.tmux_send_special
capture_screen_lines = _session.capture_screen_lines
clear_more_prompts = _session.clear_more_prompts
detect_depth = _session.detect_depth
quit_game = _session.quit_game
fixed_datetime_env = _session.fixed_datetime_env

RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')


def setup_home():
    os.makedirs(RESULTS_DIR, exist_ok=True)
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write(f'OPTIONS=name:{CHARACTER["name"]}\n')
        f.write(f'OPTIONS=race:{CHARACTER["race"]}\n')
        f.write(f'OPTIONS=role:{CHARACTER["role"]}\n')
        f.write(f'OPTIONS=gender:{CHARACTER["gender"]}\n')
        f.write(f'OPTIONS=align:{CHARACTER["align"]}\n')
        f.write('OPTIONS=!autopickup\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        f.write('OPTIONS=symset:DECgraphics\n')

    # Clean up stale game state
    import glob
    save_dir = os.path.join(INSTALL_DIR, 'save')
    if os.path.isdir(save_dir):
        for f in glob.glob(os.path.join(save_dir, '*')):
            os.unlink(f)
    for pattern in ['*wizard*', '*Wizard*', '*Merlin*', '*merlin*', 'bon*']:
        for f in glob.glob(os.path.join(INSTALL_DIR, pattern)):
            if not f.endswith('.lua'):
                os.unlink(f)


def wait_for_game_ready(session, rng_log_file):
    """Navigate startup prompts until the game is ready."""
    for attempt in range(60):
        try:
            content = subprocess.run(
                ['tmux', 'capture-pane', '-t', session, '-p', '-S', '0', '-E', '30'],
                capture_output=True, text=True, check=True
            ).stdout
        except subprocess.CalledProcessError:
            break

        rng_count, _ = read_rng_log(rng_log_file)

        if '--More--' in content:
            print(f'  [startup-{attempt}] rng={rng_count} --More--')
            tmux_send_special(session, 'Space', 0.1)
            continue

        if 'keep the save file' in content or 'keep save' in content.lower():
            tmux_send(session, 'n', 0.1)
            continue

        if 'Destroy old game?' in content or 'destroy old game' in content.lower():
            tmux_send(session, 'y', 0.1)
            continue

        if 'Shall I pick' in content:
            tmux_send(session, 'y', 0.1)
            continue

        if 'Is this ok?' in content:
            tmux_send(session, 'y', 0.1)
            continue

        if 'tutorial' in content.lower():
            tmux_send(session, 'n', 0.1)
            continue

        if 'pick a role' in content or 'Pick a role' in content:
            tmux_send(session, 'w', 0.1)  # Wizard
            continue

        if 'pick a race' in content or 'Pick a race' in content:
            tmux_send(session, 'e', 0.1)  # elf
            continue

        if 'pick a gender' in content or 'Pick a gender' in content:
            tmux_send(session, 'm', 0.1)  # male
            continue

        if 'pick an alignment' in content or 'Pick an alignment' in content:
            tmux_send(session, 'c', 0.1)  # chaotic
            continue

        if 'Dlvl:' in content or 'St:' in content or 'HP:' in content:
            print(f'  [startup-{attempt}] rng={rng_count} GAME READY')
            break

        if attempt > 2:
            tmux_send_special(session, 'Space', 0.1)
        else:
            time.sleep(0.1)


def describe_key(key):
    names = {
        'h': 'move-west', 'j': 'move-south', 'k': 'move-north', 'l': 'move-east',
        'y': 'move-nw', 'u': 'move-ne', 'b': 'move-sw', 'n': 'move-se',
        '.': 'wait', 's': 'search', ',': 'pickup', 'i': 'inventory',
        ':': 'look', '@': 'autopickup-toggle', '>': 'descend', '<': 'ascend',
    }
    return names.get(key, f'key-{key}')


def parse_moves(move_str):
    moves = []
    i = 0
    while i < len(move_str):
        if move_str[i] == 'F' and i + 1 < len(move_str):
            moves.append(('F' + move_str[i+1], f'fight-{describe_key(move_str[i+1])}'))
            i += 2
        else:
            moves.append((move_str[i], describe_key(move_str[i])))
            i += 1
    return moves


def run_session(seed, output_json, move_str):
    output_json = os.path.abspath(output_json)

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        sys.exit(1)

    setup_home()

    tmpdir = tempfile.mkdtemp(prefix='webhack-inv-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')

    session_name = f'webhack-inv-{seed}-{os.getpid()}'

    try:
        cmd = (
            f'{fixed_datetime_env()}'
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'NETHACK_DUMPMAP={dumpmap_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u {CHARACTER["name"]} -D; '
            f'sleep 999'
        )
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )

        time.sleep(1.0)

        print(f'=== Capturing inventory session: seed={seed}, role=Wizard, moves="{move_str}" ===')
        print(f'=== STARTUP ===')
        wait_for_game_ready(session_name, rng_log_file)
        time.sleep(0.1)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture startup state
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        print(f'Startup: {startup_rng_count} RNG calls')

        startup_rng_entries = parse_rng_lines(startup_rng_lines)
        session_data = {
            'version': 1,
            'seed': seed,
            'wizard': True,
            'character': CHARACTER.copy(),
            'symset': 'DECgraphics',
            'screenMode': 'decgraphics',
            'startup': {
                'rngCalls': startup_rng_count,
                'rng': startup_rng_entries,
                'screen': startup_screen,
            },
            'steps': [],
        }

        # Parse and execute moves
        moves = parse_moves(move_str)
        prev_rng_count = startup_rng_count
        turn = 0

        print(f'\n=== MOVES ({len(moves)} steps) ===')
        for idx, (key, description) in enumerate(moves):
            # Send the keystroke
            tmux_send(session_name, key, 0.1)

            time.sleep(0.2)

            # For inventory, the display stays up until dismissed
            # Capture what's on screen before dismissing
            screen = capture_screen_lines(session_name)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            # Detect depth from status line
            depth = detect_depth(screen)

            non_turn_keys = {':', 'i', '@'}
            if key not in non_turn_keys:
                turn += 1

            step = {
                'key': key,
                'action': description,
                'turn': turn,
                'depth': depth,
                'rng': rng_entries,
                'screen': screen,
            }

            session_data['steps'].append(step)
            delta = rng_count - prev_rng_count
            print(f'  [{idx+1:03d}] {key!r:5s} ({description:20s}) turn={turn} +{delta:4d} RNG calls (total {rng_count})')

            # Print the captured screen for debugging
            print('  --- screen ---')
            for line in screen:
                if line.strip():
                    print(f'  | {line}')
            print('  --- end ---')

            # After inventory display, need to dismiss it
            # C NetHack inventory uses a menu that needs ESC or space to dismiss
            content = subprocess.run(
                ['tmux', 'capture-pane', '-t', session_name, '-p', '-S', '0', '-E', '30'],
                capture_output=True, text=True, check=True
            ).stdout
            if '(end)' in content or '--More--' in content or key == 'i':
                tmux_send_special(session_name, 'Space', 0.2)
                clear_more_prompts(session_name)

            prev_rng_count = rng_count

        # Quit the game cleanly
        quit_game(session_name)

        # Write JSON
        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f'\n=== DONE ===')
        print(f'Session: {output_json}')
        print(f'Steps: {len(session_data["steps"])}')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <seed> <output_json> [move_sequence]")
        print(f"Example: {sys.argv[0]} 42 ../sessions/seed42_inventory_wizard.session.json 'i'")
        sys.exit(1)

    seed = int(sys.argv[1])
    output_json = os.path.abspath(sys.argv[2])
    move_str = sys.argv[3] if len(sys.argv) >= 4 else 'i'
    run_session(seed, output_json, move_str)


if __name__ == '__main__':
    main()
