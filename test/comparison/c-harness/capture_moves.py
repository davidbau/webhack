#!/usr/bin/env python3
"""Capture the actual effective move sequence including auto-cleared --More--.

This script replays a session and records every actual keystroke sent,
including spaces inserted to clear --More-- prompts. The output is
the complete move string that can be used with raw_moves=true.
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
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')
DEFAULT_FIXED_DATETIME = '20000110090000'

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


def wait_for_game_ready(session, captured_keys):
    """Wait for game to be ready, clearing startup prompts.

    Records spaces sent to clear --More-- prompts.
    Returns the number of startup --More-- prompts cleared.
    """
    startup_mores = 0
    max_attempts = 60

    for attempt in range(max_attempts):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if '--More--' in content:
            startup_mores += 1
            tmux_send_special(session, 'Space', 0.1)
            # Don't record startup --More-- spaces in captured_keys
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


def clear_more_and_prompts(session_name, captured_keys, max_iterations=50):
    """Clear any --More-- prompts or interactive prompts.

    Records all keystrokes sent to captured_keys.
    Returns the number of prompts cleared.
    """
    cleared = 0
    for _ in range(max_iterations):
        time.sleep(0.02)
        content = tmux_capture(session_name)

        if '--More--' in content:
            captured_keys.append(' ')
            tmux_send_special(session_name, 'Space', 0.05)
            cleared += 1
            continue

        # Handle Die? prompt in wizard mode
        if 'Die?' in content:
            captured_keys.append('n')
            tmux_send(session_name, 'n', 0.1)
            cleared += 1
            continue

        # Handle other yes/no prompts
        if '[yn]' in content and 'Die?' not in content:
            # Default to 'n' for safety
            captured_keys.append('n')
            tmux_send(session_name, 'n', 0.1)
            cleared += 1
            continue

        # No more prompts
        break

    return cleared


def capture_moves(seed, original_moves, character=None, verbose=False):
    """Replay a session and capture all actual keystrokes.

    Returns:
        - captured_moves: Complete move string including auto-cleared prompts
        - stats: Dict with statistics about the capture
    """
    char = character or DEFAULT_CHARACTER
    setup_home(char)

    session_name = f'webhack-capture-{seed}-{os.getpid()}'
    captured_keys = []
    stats = {'seed': seed, 'original_len': len(original_moves), 'more_cleared': 0}

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

        # Wait for game ready (startup --More-- not recorded)
        startup_mores = wait_for_game_ready(session_name, captured_keys)
        if verbose:
            print(f'  Startup: {startup_mores} --More-- cleared')

        # Now replay moves, auto-clearing prompts and recording all keystrokes
        for i, ch in enumerate(original_moves):
            # Clear any pending prompts BEFORE sending the move
            cleared = clear_more_and_prompts(session_name, captured_keys)
            if cleared > 0 and verbose:
                print(f'  [pos {i}] Cleared {cleared} prompts before {repr(ch)}')
            stats['more_cleared'] += cleared

            # Send the actual move
            captured_keys.append(ch)
            send_char(session_name, ch)
            time.sleep(0.003)

        # Clear any trailing prompts
        cleared = clear_more_and_prompts(session_name, captured_keys)
        if cleared > 0 and verbose:
            print(f'  [end] Cleared {cleared} trailing prompts')
        stats['more_cleared'] += cleared

    except Exception as e:
        print(f'ERROR: {e}')
        raise
    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)

    captured = ''.join(captured_keys)
    stats['captured_len'] = len(captured)
    return captured, stats


def load_seeds_config():
    config_path = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'seeds.json')
    with open(config_path) as f:
        return json.load(f)


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv

    if '--from-config' not in sys.argv:
        print("Usage: python3 capture_moves.py --from-config [-v]")
        print("  Captures actual move sequences from seeds.json sessions")
        sys.exit(1)

    config = load_seeds_config()
    entries = config['session_seeds']['sessions']

    results = []

    for entry in entries:
        seed = entry['seed']
        moves = entry['moves']
        label = entry.get('label', '')
        raw_moves = entry.get('rawMoves', False)

        # Skip rawMoves sessions - they already have explicit keystrokes
        if raw_moves:
            print(f'[seed={seed} {label}] Skipping (rawMoves=true)')
            results.append(entry)
            continue

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
        print(f'[{session_name}] Capturing moves...')

        captured, stats = capture_moves(seed, moves, character=char, verbose=verbose)

        print(f'  Original: {stats["original_len"]} chars')
        print(f'  Captured: {stats["captured_len"]} chars (+{stats["more_cleared"]} prompts cleared)')

        # Create updated entry
        new_entry = entry.copy()
        new_entry['moves'] = captured
        if stats['more_cleared'] > 0:
            # Mark that this now has explicit prompt clearing
            new_entry['rawMoves'] = True
        results.append(new_entry)

    # Output results
    print('\n=== Captured Move Sequences ===')
    output = {'sessions': results}
    output_file = os.path.join(SCRIPT_DIR, 'captured_sessions.json')
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f'Written to: {output_file}')


if __name__ == '__main__':
    main()
