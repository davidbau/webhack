#!/usr/bin/env python3
"""Detect where --More-- prompts appear during session replay.

This script replays sessions and identifies where --More-- prompts appear,
then generates modified move sequences with explicit spaces inserted.

Usage:
    python3 detect_more_prompts.py [session_pattern]
    python3 detect_more_prompts.py --from-config  # Process all seeds.json sessions
"""

import os
import sys
import json
import time
import subprocess
import shutil
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')
DEFAULT_FIXED_DATETIME = '20000110090000'

# Character presets (same as run_session.py)
CHARACTER_PRESETS = {
    'valkyrie': {'name': 'Wizard', 'role': 'Valkyrie', 'race': 'human', 'gender': 'female', 'align': 'neutral'},
    'wizard':   {'name': 'Wizard', 'role': 'Wizard',   'race': 'human', 'gender': 'male',   'align': 'neutral'},
    'ranger':   {'name': 'ricky', 'role': 'Ranger',   'race': 'human', 'gender': 'female', 'align': 'chaotic'},
    'barbarian': {'name': 'brak', 'role': 'Barbarian', 'race': 'human', 'gender': 'male', 'align': 'neutral'},
    'knight':    {'name': 'lancelot', 'role': 'Knight', 'race': 'human', 'gender': 'male', 'align': 'lawful'},
    'monk':      {'name': 'sumi', 'role': 'Monk', 'race': 'human', 'gender': 'female', 'align': 'neutral'},
    'priest':    {'name': 'clara', 'role': 'Priest', 'race': 'human', 'gender': 'female', 'align': 'neutral'},
    'rogue':     {'name': 'shade', 'role': 'Rogue', 'race': 'human', 'gender': 'male', 'align': 'chaotic'},
    'samurai':   {'name': 'akira', 'role': 'Samurai', 'race': 'human', 'gender': 'male', 'align': 'lawful'},
    'tourist':   {'name': 'mabel', 'role': 'Tourist', 'race': 'human', 'gender': 'female', 'align': 'neutral'},
    'archeologist': {'name': 'indy', 'role': 'Archeologist', 'race': 'human', 'gender': 'male', 'align': 'neutral'},
    'caveman':   {'name': 'ugo', 'role': 'Caveman', 'race': 'human', 'gender': 'male', 'align': 'neutral'},
    'healer':    {'name': 'flora', 'role': 'Healer', 'race': 'human', 'gender': 'female', 'align': 'neutral'},
}

DEFAULT_CHARACTER = CHARACTER_PRESETS['valkyrie']


def harness_fixed_datetime():
    dt = os.environ.get('NETHACK_FIXED_DATETIME')
    return DEFAULT_FIXED_DATETIME if dt is None else dt


def fixed_datetime_env():
    dt = harness_fixed_datetime()
    return f'NETHACK_FIXED_DATETIME={dt} ' if dt else ''


def tmux_send(session, keys, delay=0):
    subprocess.run(['tmux', 'send-keys', '-t', session, '-l', keys], check=True)
    if delay > 0:
        time.sleep(delay)


def tmux_send_special(session, key, delay=0):
    subprocess.run(['tmux', 'send-keys', '-t', session, key], check=True)
    if delay > 0:
        time.sleep(delay)


def tmux_capture(session):
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-S', '0', '-E', '30'],
        capture_output=True, text=True, check=True
    )
    return result.stdout


def setup_home(character):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write(f'OPTIONS=name:{character["name"]}\n')
        f.write(f'OPTIONS=race:{character["race"]}\n')
        f.write(f'OPTIONS=role:{character["role"]}\n')
        f.write(f'OPTIONS=gender:{character["gender"]}\n')
        f.write(f'OPTIONS=align:{character["align"]}\n')
        f.write('OPTIONS=!autopickup\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        f.write('OPTIONS=symset:DECgraphics\n')

    # Clean up stale game state
    import glob
    save_dir = os.path.join(INSTALL_DIR, 'save')
    if os.path.isdir(save_dir):
        for f in glob.glob(os.path.join(save_dir, '*')):
            try:
                os.unlink(f)
            except FileNotFoundError:
                pass
    for pattern in ['*wizard*', '*Wizard*', 'bon*']:
        for f in glob.glob(os.path.join(INSTALL_DIR, pattern)):
            if not f.endswith('.lua'):
                try:
                    os.unlink(f)
                except FileNotFoundError:
                    pass


def wait_for_game_ready_no_auto(session, max_attempts=60):
    """Wait for game to be ready, only handling essential startup prompts.

    Returns the number of --More-- prompts that were cleared during startup.
    """
    startup_mores = 0
    for attempt in range(max_attempts):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        # Handle --More-- during startup (these are unavoidable)
        if '--More--' in content:
            startup_mores += 1
            tmux_send_special(session, 'Space', 0.1)
            continue

        # Handle essential startup prompts
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
        if 'Do you want a tutorial?' in content:
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

        # Game ready
        if 'Dlvl:' in content or 'St:' in content or 'HP:' in content:
            break

        lines = content.strip().split('\n')
        if len(lines) > 5 and any('|' in line and '-' in line for line in lines[1:22]):
            break

        if attempt > 2:
            tmux_send_special(session, 'Space', 0.1)
        else:
            time.sleep(0.02)

    return startup_mores


def send_char(session_name, ch):
    """Send a single character with proper control char handling."""
    code = ord(ch)
    if code == 10 or code == 13:
        tmux_send_special(session_name, 'Enter')
    elif code == 27:
        tmux_send_special(session_name, 'Escape')
    elif code == 127:
        tmux_send_special(session_name, 'BSpace')
    elif code < 32:
        tmux_send_special(session_name, f'C-{chr(code + 96)}')
    else:
        tmux_send(session_name, ch)


def detect_more_positions(seed, moves, character=None, verbose=False):
    """Replay a session and detect where --More-- prompts appear.

    Returns:
        - modified_moves: The move string with spaces inserted for --More-- prompts
        - more_positions: List of positions where --More-- was detected
    """
    char = character or DEFAULT_CHARACTER

    setup_home(char)

    tmpdir = tempfile.mkdtemp(prefix='webhack-detect-')
    session_name = f'webhack-detect-{seed}-{os.getpid()}'

    modified_moves = []
    more_positions = []

    try:
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'{fixed_datetime_env()}'
            f'NETHACK_SEED={seed} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u {char["name"]} -D; '
            f'sleep 999'
        )
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )

        time.sleep(1.0)

        # Wait for game to be ready (startup --More-- handled automatically)
        startup_mores = wait_for_game_ready_no_auto(session_name)
        if verbose:
            print(f'  Startup: {startup_mores} --More-- prompts cleared')

        # Now replay moves and detect --More-- prompts
        move_idx = 0
        for ch in moves:
            # Check if there's a --More-- before sending the move
            content = tmux_capture(session_name)
            while '--More--' in content:
                # Insert a space to clear the --More--
                modified_moves.append(' ')
                more_positions.append(move_idx)
                if verbose:
                    print(f'  [pos {move_idx}] --More-- detected, inserting space')
                tmux_send_special(session_name, 'Space', 0.05)
                time.sleep(0.02)
                content = tmux_capture(session_name)

            # Handle Die? prompt (wizard mode death)
            if 'Die?' in content:
                tmux_send(session_name, 'n', 0.1)
                time.sleep(0.02)
                content = tmux_capture(session_name)

            # Now send the actual move
            send_char(session_name, ch)
            modified_moves.append(ch)
            move_idx += 1
            time.sleep(0.003)

        # Check for trailing --More-- prompts
        content = tmux_capture(session_name)
        while '--More--' in content:
            modified_moves.append(' ')
            more_positions.append(move_idx)
            if verbose:
                print(f'  [pos {move_idx}] trailing --More-- detected')
            tmux_send_special(session_name, 'Space', 0.05)
            time.sleep(0.02)
            content = tmux_capture(session_name)
            move_idx += 1

    except Exception as e:
        print(f'ERROR: {e}')
        raise

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)

    return ''.join(modified_moves), more_positions


def load_seeds_config():
    config_path = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'seeds.json')
    with open(config_path) as f:
        return json.load(f)


def escape_moves_for_json(moves):
    """Escape a move string for JSON, handling control characters."""
    result = []
    for ch in moves:
        code = ord(ch)
        if code < 32:
            # Control character - use \uXXXX escape
            result.append(f'\\u{code:04x}')
        elif ch == '"':
            result.append('\\"')
        elif ch == '\\':
            result.append('\\\\')
        else:
            result.append(ch)
    return ''.join(result)


def process_session_entry(entry, verbose=False):
    """Process a single session entry from seeds.json."""
    seed = entry['seed']
    moves = entry['moves']
    label = entry.get('label', '')
    raw_moves = entry.get('rawMoves', False)

    # Skip raw_moves sessions - they already include explicit --More-- clearing
    if raw_moves:
        if verbose:
            print(f'  Skipping seed={seed} {label} (rawMoves=true)')
        return entry, False

    # Determine character
    char = DEFAULT_CHARACTER.copy()
    if 'character' in entry:
        char_spec = entry['character']
        if isinstance(char_spec, str):
            preset = char_spec.lower()
            if preset in CHARACTER_PRESETS:
                char = CHARACTER_PRESETS[preset].copy()
        elif isinstance(char_spec, dict):
            char = char_spec.copy()

    session_name = f'seed{seed}_{label}' if label else f'seed{seed}'
    print(f'\n=== Processing {session_name} ===')
    print(f'  Original moves: {len(moves)} chars')

    modified_moves, more_positions = detect_more_positions(
        seed, moves, character=char, verbose=verbose
    )

    if more_positions:
        print(f'  --More-- prompts found at positions: {more_positions}')
        print(f'  Modified moves: {len(modified_moves)} chars (+{len(more_positions)} spaces)')

        # Create updated entry
        new_entry = entry.copy()
        new_entry['moves'] = modified_moves
        # Remove rawMoves if present since we're now explicit
        if 'rawMoves' in new_entry:
            del new_entry['rawMoves']
        return new_entry, True
    else:
        print(f'  No --More-- prompts found')
        return entry, False


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('-')]

    if '--from-config' in sys.argv:
        config = load_seeds_config()
        entries = config['session_seeds']['sessions']

        modified_entries = []
        changes = 0

        for entry in entries:
            new_entry, changed = process_session_entry(entry, verbose=verbose)
            modified_entries.append(new_entry)
            if changed:
                changes += 1

        print(f'\n=== Summary ===')
        print(f'Total sessions: {len(entries)}')
        print(f'Sessions modified: {changes}')

        if changes > 0:
            # Output the modified sessions section
            print(f'\n=== Modified session_seeds.sessions ===')
            print(json.dumps(modified_entries, indent=2, ensure_ascii=False))

            # Also write to a file
            output_file = os.path.join(SCRIPT_DIR, 'modified_sessions.json')
            with open(output_file, 'w') as f:
                json.dump({'sessions': modified_entries}, f, indent=2, ensure_ascii=False)
            print(f'\nWritten to: {output_file}')

    else:
        print("Usage: python3 detect_more_prompts.py --from-config [-v]")
        sys.exit(1)


if __name__ == '__main__':
    main()
