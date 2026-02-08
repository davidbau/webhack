#!/usr/bin/env python3
"""Capture a C NetHack session as a self-contained JSON file.

Usage:
    python3 run_session.py <seed> <output_json> [move_sequence]

Plays through the C NetHack game with a fixed seed, sending a sequence
of keystrokes and capturing screen state + RNG log + terrain grids
into a single JSON session file.

See docs/SESSION_FORMAT.md for the format specification.

The move_sequence is a string of move characters. Special encodings:
    h/j/k/l/y/u/b/n   -- vi movement keys
    .                  -- wait
    s                  -- search
    ,                  -- pickup
    i                  -- inventory
    :                  -- look
    @                  -- autopickup toggle
    >                  -- descend stairs
    <                  -- ascend stairs
    F<dir>             -- fight in direction (e.g., Fj = fight south)

Example:
    python3 run_session.py 42 sessions/seed42.session.json ':hhlhhhh.hhs'
"""

import sys
import os
import json
import time
import subprocess
import shutil
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')

# Character options (must match .nethackrc)
CHARACTER = {
    'name': 'Wizard',
    'role': 'Valkyrie',
    'race': 'human',
    'gender': 'female',
    'align': 'neutral',
}


def tmux_send(session, keys, delay=0.1):
    subprocess.run(['tmux', 'send-keys', '-t', session, '-l', keys], check=True)
    time.sleep(delay)

def tmux_send_special(session, key, delay=0.1):
    subprocess.run(['tmux', 'send-keys', '-t', session, key], check=True)
    time.sleep(delay)

def tmux_capture(session):
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-S', '0', '-E', '30'],
        capture_output=True, text=True, check=True
    )
    return result.stdout


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

    # Clean up stale game state to avoid prompts from previous crashed runs.
    # Remove: save files, level/lock files (e.g. 501wizard.0), and bones files.
    import glob
    save_dir = os.path.join(INSTALL_DIR, 'save')
    if os.path.isdir(save_dir):
        for f in glob.glob(os.path.join(save_dir, '*')):
            os.unlink(f)
    for f in glob.glob(os.path.join(INSTALL_DIR, '*wizard*')):
        if not f.endswith('.lua'):
            os.unlink(f)
    for f in glob.glob(os.path.join(INSTALL_DIR, '*Wizard*')):
        if not f.endswith('.lua'):
            os.unlink(f)
    for f in glob.glob(os.path.join(INSTALL_DIR, 'bon*')):
        os.unlink(f)


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
        # Format: "2808 rn2(12) = 2 @ mon.c:1145"
        # Parse: idx fn(args) = result @ source
        parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        rest = parts[1]  # "rn2(12) = 2 @ mon.c:1145"
        # Compact: remove spaces around =
        rest = rest.replace(' = ', '=')
        entries.append(rest)
    return entries


def capture_screen_lines(session):
    """Capture tmux screen and return as list of 24 lines."""
    content = tmux_capture(session)
    lines = content.split('\n')
    # Pad or trim to exactly 24 lines
    while len(lines) < 24:
        lines.append('')
    return lines[:24]


def read_typ_grid(dumpmap_file):
    """Read a dumpmap file and return 21x80 grid of ints."""
    if not os.path.exists(dumpmap_file):
        return None
    with open(dumpmap_file) as f:
        grid = []
        for line in f:
            row = [int(x) for x in line.strip().split()]
            grid.append(row)
    return grid if len(grid) == 21 else None


def execute_dumpmap(session, dumpmap_file):
    """Execute #dumpmap and read the resulting grid."""
    # Remove old dumpmap file
    if os.path.exists(dumpmap_file):
        os.unlink(dumpmap_file)

    tmux_send(session, '#', 0.1)
    time.sleep(0.1)
    tmux_send(session, 'dumpmap', 0.1)
    tmux_send_special(session, 'Enter', 0.3)

    # Clear --More--
    for _ in range(5):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.1)
        else:
            break
        time.sleep(0.1)

    time.sleep(0.1)
    return read_typ_grid(dumpmap_file)


def clear_more_prompts(session, max_iterations=10):
    content = ''
    for _ in range(max_iterations):
        time.sleep(0.1)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.1)
        elif 'Die?' in content:
            # Wizard mode death: answer 'n' to resurrect
            tmux_send(session, 'n', 0.1)
            print('  [WIZARD] Died and resurrected')
        else:
            break
    return content


def wait_for_game_ready(session, rng_log_file):
    """Navigate startup prompts until the game is ready."""
    for attempt in range(60):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            print(f'[startup-{attempt}] tmux session died')
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
            tmux_send(session, 'v', 0.1)
            continue

        if 'pick a race' in content or 'Pick a race' in content:
            tmux_send(session, 'h', 0.1)
            continue

        if 'pick a gender' in content or 'Pick a gender' in content:
            tmux_send(session, 'f', 0.1)
            continue

        if 'pick an alignment' in content or 'Pick an alignment' in content:
            tmux_send(session, 'n', 0.1)
            continue

        if 'Dlvl:' in content or 'St:' in content or 'HP:' in content:
            print(f'  [startup-{attempt}] rng={rng_count} GAME READY')
            break

        lines = content.strip().split('\n')
        if len(lines) > 5 and any('|' in line and '-' in line for line in lines[1:22]):
            print(f'  [startup-{attempt}] rng={rng_count} GAME READY (map detected)')
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


def detect_depth(screen_lines):
    """Parse 'Dlvl:N' from the status lines to determine current depth."""
    for line in screen_lines[22:24]:
        if 'Dlvl:' in line:
            import re
            m = re.search(r'Dlvl:(\d+)', line)
            if m:
                return int(m[1])
    return 1


def quit_game(session):
    tmux_send(session, '#', 0.1)
    time.sleep(0.1)
    tmux_send(session, 'quit', 0.1)
    tmux_send_special(session, 'Enter', 0.1)
    for _ in range(15):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if 'Really quit' in content or 'really quit' in content:
            tmux_send(session, 'y', 0.1)
        elif 'do you want your possessions' in content.lower():
            tmux_send(session, 'n', 0.1)
        elif '--More--' in content:
            tmux_send_special(session, 'Space', 0.1)
        elif 'PROCESS_DONE' in content or 'sleep 999' in content:
            break
        time.sleep(0.1)
    time.sleep(0.1)


def compact_session_json(session_data):
    """Serialize session to JSON with compact typGrid rows.

    Uses json.dumps for all string values to ensure correct escaping
    of non-ASCII characters (DEC graphics in screen lines, etc.).
    Only typGrid rows are compacted to single lines.
    """
    raw = json.dumps(session_data, indent=2, ensure_ascii=False)
    # Post-process: collapse arrays of numbers (typGrid rows) to single lines
    lines = raw.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect start of a number array: line ends with "[" and next is a number
        if line.rstrip().endswith('[') and i + 1 < len(lines):
            next_trimmed = lines[i + 1].strip()
            if next_trimmed and next_trimmed.rstrip(',').lstrip('-').isdigit():
                # Collect all numbers until closing "]"
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
    return '\n'.join(result) + '\n'


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <seed> <output_json> [move_sequence]")
        print(f"Example: {sys.argv[0]} 42 sessions/seed42.session.json ':hhlhhhh.hhs'")
        sys.exit(1)

    seed = int(sys.argv[1])
    output_json = os.path.abspath(sys.argv[2])
    move_str = sys.argv[3] if len(sys.argv) >= 4 else '...........'

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    setup_home()

    # Temp files for RNG log and dumpmap
    tmpdir = tempfile.mkdtemp(prefix='webhack-session-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')

    session_name = f'webhack-session-{seed}-{os.getpid()}'

    try:
        cmd = (
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

        print(f'=== Capturing session: seed={seed}, moves="{move_str}" ===')
        print(f'=== STARTUP ===')
        wait_for_game_ready(session_name, rng_log_file)
        time.sleep(0.1)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture startup state
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        print(f'Startup: {startup_rng_count} RNG calls')

        # Capture startup typ grid via #dumpmap
        startup_typ_grid = execute_dumpmap(session_name, dumpmap_file)
        if startup_typ_grid:
            print(f'Startup typGrid: {len(startup_typ_grid)}x{len(startup_typ_grid[0])} captured')
        else:
            print('WARNING: Failed to capture startup typGrid')

        # Clear any --More-- from dumpmap
        clear_more_prompts(session_name)

        # Build session object
        startup_rng_entries = parse_rng_lines(startup_rng_lines)
        session_data = {
            'version': 1,
            'seed': seed,
            'wizard': True,
            'character': CHARACTER.copy(),
            'symset': 'DECgraphics',
            'startup': {
                'rngCalls': startup_rng_count,
                'rng': startup_rng_entries,
                'typGrid': startup_typ_grid,
                'screen': startup_screen,
            },
            'steps': [],
        }

        # Parse and execute moves
        moves = parse_moves(move_str)
        prev_rng_count = startup_rng_count
        prev_depth = 1
        prev_typ_grid = startup_typ_grid
        turn = 0

        print(f'\n=== MOVES ({len(moves)} steps) ===')
        for idx, (key, description) in enumerate(moves):
            # Send the keystroke
            if key.startswith('F'):
                tmux_send(session_name, 'F', 0.1)
                tmux_send(session_name, key[1], 0.1)
            else:
                tmux_send(session_name, key, 0.1)

            time.sleep(0.1)
            clear_more_prompts(session_name)
            time.sleep(0.1)

            # Capture state after this step
            screen = capture_screen_lines(session_name)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            # Detect depth from status line
            depth = detect_depth(screen)

            # Determine turn number
            # Movement keys, wait, and search consume a turn; look (:) does not
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

            # Capture typ grid after every step; include if it changed
            # (level change, digging, kicking doors, etc.)
            current_grid = execute_dumpmap(session_name, dumpmap_file)
            clear_more_prompts(session_name)
            if current_grid and current_grid != prev_typ_grid:
                step['typGrid'] = current_grid
                if depth != prev_depth:
                    print(f'  Level change: depth {prev_depth} -> {depth}, typGrid captured')
                else:
                    print(f'  Terrain changed on depth {depth}, typGrid captured')
                prev_typ_grid = current_grid

            session_data['steps'].append(step)
            delta = rng_count - prev_rng_count
            print(f'  [{idx+1:03d}] {key!r:5s} ({description:20s}) turn={turn} +{delta:4d} RNG calls (total {rng_count})')

            prev_rng_count = rng_count
            prev_depth = depth

        # Quit the game cleanly
        quit_game(session_name)

        # Write JSON with compact typGrid rows
        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            f.write(compact_session_json(session_data))

        # Summary
        total_rng = prev_rng_count
        total_steps = len(session_data['steps'])
        print(f'\n=== DONE ===')
        print(f'Session: {output_json}')
        print(f'Steps: {total_steps}, Total RNG calls: {total_rng}')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    main()
