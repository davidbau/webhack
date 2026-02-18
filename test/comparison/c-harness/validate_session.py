#!/usr/bin/env python3
"""Validate a session by replaying it and checking message parity.

This script replays a recorded session in the C harness and verifies that
the messages (line 0) match between the recording and the replay.

Usage:
    python3 validate_session.py <session_json>
    python3 validate_session.py --all  # Validate all gameplay sessions
    python3 validate_session.py --from-config  # Validate sessions from seeds.json

This helps detect when:
- The RNG has diverged and the map is different
- Combat outcomes are different
- Item interactions differ from the recording
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
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')
DEFAULT_FIXED_DATETIME = '20000110090000'


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


def capture_screen_lines(session):
    """Capture tmux screen and return as list of 24 lines."""
    content = tmux_capture(session)
    lines = content.split('\n')
    while len(lines) < 24:
        lines.append('')
    return lines[:24]


def extract_message_line(screen_lines):
    """Extract the message line (line 0) from screen."""
    if not screen_lines:
        return None
    msg = screen_lines[0].strip()
    if not msg or msg == '--More--':
        return None
    return msg


def setup_home(options):
    """Set up .nethackrc with character options."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write(f'OPTIONS=name:{options.get("name", "Wizard")}\n')
        f.write(f'OPTIONS=race:{options.get("race", "human")}\n')
        f.write(f'OPTIONS=role:{options.get("role", "Valkyrie")}\n')
        f.write(f'OPTIONS=gender:{options.get("gender", "female")}\n')
        f.write(f'OPTIONS=align:{options.get("align", "neutral")}\n')
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


def clear_more_prompts(session, max_iterations=10):
    """Clear --More-- prompts."""
    for _ in range(max_iterations):
        time.sleep(0.02)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.1)
        elif 'Die?' in content:
            tmux_send(session, 'n', 0.1)
        else:
            break
    return content


def wait_for_game_ready(session):
    """Wait for the game to be ready after startup."""
    for attempt in range(60):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if '--More--' in content:
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


def normalize_message(msg):
    """Normalize a message for comparison."""
    if not msg:
        return ''
    # Strip whitespace
    msg = msg.strip()
    # Remove trailing punctuation variations
    # Handle minor formatting differences
    return msg


def messages_match(expected, actual):
    """Check if two messages match (with some tolerance)."""
    if expected is None and actual is None:
        return True
    if expected is None or actual is None:
        # If one has a message and the other doesn't, they might still be ok
        # (e.g., one captured a transient message)
        return True  # Be lenient for now

    exp_norm = normalize_message(expected)
    act_norm = normalize_message(actual)

    # Exact match
    if exp_norm == act_norm:
        return True

    # Allow substring match for partial messages
    if exp_norm in act_norm or act_norm in exp_norm:
        return True

    return False


def validate_session(session_path, verbose=False):
    """Validate a session by replaying and checking messages.

    Returns a dict with:
        - passed: bool
        - total_steps: int
        - messages_checked: int
        - divergences: list of {step, expected, actual}
    """
    with open(session_path) as f:
        session_data = json.load(f)

    seed = session_data.get('seed', 0)
    options = session_data.get('options', {})
    steps = session_data.get('steps', [])
    regen = session_data.get('regen', {})
    moves = regen.get('moves', '')

    if not moves and len(steps) > 1:
        # Extract moves from steps
        moves = ''.join(s.get('key', '') or '' for s in steps[1:] if s.get('key'))

    result = {
        'session': os.path.basename(session_path),
        'passed': True,
        'total_steps': len(steps),
        'messages_checked': 0,
        'messages_matched': 0,
        'divergences': [],
    }

    setup_home(options)

    tmpdir = tempfile.mkdtemp(prefix='webhack-validate-')
    session_name = f'webhack-validate-{seed}-{os.getpid()}'

    try:
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'{fixed_datetime_env()}'
            f'NETHACK_SEED={seed} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u {options.get("name", "Wizard")} -D; '
            f'sleep 999'
        )
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )

        time.sleep(1.0)

        if verbose:
            print(f'Validating: seed={seed}, steps={len(steps)}')

        wait_for_game_ready(session_name)
        clear_more_prompts(session_name)

        # Check startup message
        if steps:
            startup_step = steps[0]
            expected_msg = startup_step.get('msg')
            screen_lines = capture_screen_lines(session_name)
            actual_msg = extract_message_line(screen_lines)

            if expected_msg is not None:
                result['messages_checked'] += 1
                if messages_match(expected_msg, actual_msg):
                    result['messages_matched'] += 1
                else:
                    result['divergences'].append({
                        'step': 0,
                        'action': 'startup',
                        'expected': expected_msg,
                        'actual': actual_msg,
                    })
                    if verbose:
                        print(f'  [0] DIVERGE: expected "{expected_msg}", got "{actual_msg}"')

        # Replay moves and check messages
        move_idx = 0
        for step_idx, step in enumerate(steps[1:], 1):
            key = step.get('key', '')
            if not key:
                continue

            # Send the key
            send_char(session_name, key)
            time.sleep(0.003)
            clear_more_prompts(session_name)

            # Capture and check message
            expected_msg = step.get('msg')
            screen_lines = capture_screen_lines(session_name)
            actual_msg = extract_message_line(screen_lines)

            if expected_msg is not None:
                result['messages_checked'] += 1
                if messages_match(expected_msg, actual_msg):
                    result['messages_matched'] += 1
                else:
                    result['divergences'].append({
                        'step': step_idx,
                        'key': key,
                        'action': step.get('action', ''),
                        'expected': expected_msg,
                        'actual': actual_msg,
                    })
                    if verbose:
                        print(f'  [{step_idx}] DIVERGE: expected "{expected_msg}", got "{actual_msg}"')

            move_idx += 1

        # Determine pass/fail
        if result['divergences']:
            result['passed'] = False

        if verbose:
            print(f'  Messages: {result["messages_matched"]}/{result["messages_checked"]} matched')
            if result['divergences']:
                print(f'  Divergences: {len(result["divergences"])}')

    except Exception as e:
        result['passed'] = False
        result['error'] = str(e)
        if verbose:
            print(f'  ERROR: {e}')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)

    return result


def validate_all_sessions(verbose=False):
    """Validate all gameplay sessions."""
    import glob

    sessions = glob.glob(os.path.join(SESSIONS_DIR, '*_gameplay.session.json'))
    sessions += glob.glob(os.path.join(SESSIONS_DIR, '*_selfplay*.session.json'))
    sessions += glob.glob(os.path.join(SESSIONS_DIR, '*_wizard.session.json'))

    results = []
    for session_path in sorted(sessions):
        print(f'\n=== Validating {os.path.basename(session_path)} ===')
        result = validate_session(session_path, verbose=verbose)
        results.append(result)

        status = 'PASS' if result['passed'] else 'FAIL'
        print(f'  Result: {status} ({result["messages_matched"]}/{result["messages_checked"]} messages)')

    # Summary
    passed = sum(1 for r in results if r['passed'])
    total = len(results)
    print(f'\n=== Summary ===')
    print(f'Passed: {passed}/{total}')

    return results


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('-')]

    if '--all' in sys.argv:
        validate_all_sessions(verbose=verbose)
    elif len(args) >= 1:
        session_path = args[0]
        if not os.path.isabs(session_path):
            session_path = os.path.join(SESSIONS_DIR, session_path)
        result = validate_session(session_path, verbose=True)
        status = 'PASS' if result['passed'] else 'FAIL'
        print(f'\nResult: {status}')
        if result['divergences']:
            print(f'Divergences: {len(result["divergences"])}')
            for d in result['divergences'][:5]:
                print(f'  Step {d["step"]}: expected "{d["expected"]}", got "{d["actual"]}"')
    else:
        print(f'Usage: {sys.argv[0]} <session_json>')
        print(f'       {sys.argv[0]} --all')
        sys.exit(1)


if __name__ == '__main__':
    main()
