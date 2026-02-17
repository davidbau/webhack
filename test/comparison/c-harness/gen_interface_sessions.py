#!/usr/bin/env python3
"""Generate interface session traces from C NetHack for UI accuracy testing.

Usage:
    python3 gen_interface_sessions.py --startup
    python3 gen_interface_sessions.py --options
    python3 gen_interface_sessions.py --chargen
    python3 gen_interface_sessions.py --tutorial
    python3 gen_interface_sessions.py --all

Captures UI-focused sessions with screen content and terminal attributes for
testing menu rendering, inverse video, bold text, etc.

Output: test/comparison/sessions/interface_*.session.json
"""

import sys
import os
import json
import time
import subprocess
import importlib.util
import tempfile
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
NETHACK_BINARY = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir', 'nethack')
DEFAULT_FIXED_DATETIME = '20000110090000'

# Import helpers from run_session.py
_spec = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_session = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_session)

compact_session_json = _session.compact_session_json
capture_screen_compressed = _session.capture_screen_compressed
fixed_datetime_env = _session.fixed_datetime_env
tmux_send = _session.tmux_send
tmux_send_special = _session.tmux_send_special
read_rng_log = _session.read_rng_log
parse_rng_lines = _session.parse_rng_lines


def tmux_session_name():
    """Generate unique tmux session name."""
    return f"nethack-interface-{os.getpid()}"


def start_tmux_session(session):
    """Start a tmux session with 80x24 dimensions."""
    subprocess.run([
        'tmux', 'new-session', '-d', '-s', session,
        '-x', '80', '-y', '24'
    ], check=True)
    time.sleep(0.1)


def kill_tmux_session(session):
    """Kill the tmux session."""
    subprocess.run(['tmux', 'kill-session', '-t', session],
                   stderr=subprocess.DEVNULL, check=False)


# Use capture_screen_compressed from run_session.py
capture_screen = capture_screen_compressed


def capture_startup_sequence():
    """Capture the full startup sequence including tutorial prompt."""
    session = tmux_session_name()
    start_tmux_session(session)
    steps = []

    try:
        nethack_dir = os.path.dirname(NETHACK_BINARY)

        # Clear screen
        subprocess.run(['tmux', 'send-keys', '-t', session, 'clear', 'Enter'], check=True)
        time.sleep(0.2)

        # Start NetHack
        cmd = (
            f'{fixed_datetime_env()}'
            f'NETHACKDIR={nethack_dir} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY}'
        )
        subprocess.run(['tmux', 'send-keys', '-t', session, cmd, 'Enter'], check=True)
        time.sleep(2.5)

        # Capture initial screen (startup step with key: null)
        screen = capture_screen(session)
        steps.append({
            'key': None,
            'action': 'startup',
            'rng': [],
            'screen': screen        })

        # Decline random character
        tmux_send(session, 'n', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'n',
            'action': 'decline-autopick',
            'rng': [],
            'screen': screen        })

        # Role selection - press '?' for help
        tmux_send(session, '?', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': '?',
            'action': 'role-help',
            'rng': [],
            'screen': screen        })

        # Press '?' again to return
        tmux_send(session, '?', delay=0.5)

        # Select archeologist
        tmux_send(session, 'a', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'a',
            'action': 'select-role',
            'rng': [],
            'screen': screen        })

    finally:
        kill_tmux_session(session)

    return {
        'version': 3,
        'seed': 0,
        'source': 'c',
        'type': 'interface',
        'regen': {
            'mode': 'interface',
            'subtype': 'startup',
        },
        'options': {
            'description': 'Game startup sequence including tutorial prompt',
            'tutorial': True,
        },
        'steps': steps
    }


def capture_options_menu():
    """Capture in-game options menu with strict RNG+screen trace."""
    import tempfile
    with tempfile.NamedTemporaryFile(prefix='interface-options-', suffix='.json', delete=False) as tmp:
        tmp_path = tmp.name
    try:
        # Deep in-game options flow: edit fruit, set number_pad mode, navigate pages.
        _session.run_interface_session(0, tmp_path, 'Oakiwi\nbc><', verbose=False)
        with open(tmp_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data.setdefault('regen', {})
        data['regen']['mode'] = 'interface'
        data['regen']['subtype'] = 'options'
        data.setdefault('options', {})
        data['options']['description'] = 'In-game options flow: edit fruit + set number_pad mode + page navigation'
        return data
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def capture_complete_chargen():
    """Capture complete character generation sequence through to game start."""
    session = tmux_session_name()
    start_tmux_session(session)
    steps = []

    try:
        nethack_dir = os.path.dirname(NETHACK_BINARY)

        subprocess.run(['tmux', 'send-keys', '-t', session, 'clear', 'Enter'], check=True)
        time.sleep(0.2)

        cmd = (
            f'{fixed_datetime_env()}'
            f'NETHACKDIR={nethack_dir} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY}'
        )
        subprocess.run(['tmux', 'send-keys', '-t', session, cmd, 'Enter'], check=True)
        time.sleep(2.5)

        # Initial screen (startup step with key: null)
        screen = capture_screen(session)
        steps.append({
            'key': None,
            'action': 'startup',
            'rng': [],
            'screen': screen        })

        # Decline random character
        tmux_send(session, 'n', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'n',
            'action': 'decline-autopick',
            'rng': [],
            'screen': screen        })

        # Select archeologist
        tmux_send(session, 'a', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'a',
            'action': 'select-role',
            'rng': [],
            'screen': screen        })

        # Select human
        tmux_send(session, 'h', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'h',
            'action': 'select-race',
            'rng': [],
            'screen': screen        })

        # Select male
        tmux_send(session, 'm', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'm',
            'action': 'select-gender',
            'rng': [],
            'screen': screen        })

        # Select neutral
        tmux_send(session, 'n', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'n',
            'action': 'select-align',
            'rng': [],
            'screen': screen        })

        # Confirm if needed
        tmux_send(session, 'y', delay=0.5)
        screen = capture_screen(session)
        steps.append({
            'key': 'y',
            'action': 'confirm',
            'rng': [],
            'screen': screen        })

    finally:
        kill_tmux_session(session)

    return {
        'version': 3,
        'seed': 0,
        'source': 'c',
        'type': 'interface',
        'regen': {
            'mode': 'interface',
            'subtype': 'chargen',
        },
        'options': {
            'description': 'Complete character generation from startup to game start'
        },
        'steps': steps
    }


def _wait_for_text(session, needle, timeout_s=8.0):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        pane = subprocess.check_output(
            ['tmux', 'capture-pane', '-pt', session, '-e'],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        if needle in pane:
            return True
        time.sleep(0.05)
    return False


def capture_tutorial_prompt_flow(seed=1):
    """Capture tutorial acceptance flow with strict per-key RNG deltas."""
    session = tmux_session_name()
    start_tmux_session(session)
    steps = []
    tmpdir = tempfile.mkdtemp(prefix='interface-tutorial-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')

    try:
        nethack_dir = os.path.dirname(NETHACK_BINARY)
        subprocess.run(['tmux', 'send-keys', '-t', session, 'clear', 'Enter'], check=True)
        time.sleep(0.2)

        cmd = (
            f'NETHACKDIR={nethack_dir} '
            f'{fixed_datetime_env()}'
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'HOME={tmpdir} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D'
        )
        subprocess.run(['tmux', 'send-keys', '-t', session, cmd, 'Enter'], check=True)
        if not _wait_for_text(session, "Shall I pick character's race, role, gender and alignment for you?"):
            raise RuntimeError('Timed out waiting for autopick prompt')

        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        steps.append({
            'key': None,
            'action': 'startup',
            'rng': parse_rng_lines(startup_rng_lines),
            'screen': capture_screen(session),
        })

        key_plan = [
            ('n', 'decline-autopick'),
            ('v', 'select-role'),
            ('h', 'select-race'),
            ('f', 'select-gender'),
            ('n', 'select-alignment'),
            ('y', 'confirm-character'),
            (' ', 'more-prompt'),
            (' ', 'more-prompt'),
            ('y', 'accept-tutorial'),
            (' ', 'more-prompt'),
            (' ', 'more-prompt'),
            (' ', 'more-prompt'),
        ]
        # Continue with ~20 gameplay moves on tutorial map for interface replay coverage.
        for key in "lllljjjjhhhhkkkkllll":
            key_plan.append((key, 'tutorial-move'))
        prev_rng_count = startup_rng_count
        for key, action in key_plan:
            if key == ' ':
                tmux_send_special(session, 'Space', delay=0.25)
            else:
                tmux_send(session, key, delay=0.25)
            time.sleep(0.03)
            screen = capture_screen(session)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            steps.append({
                'key': key,
                'action': action,
                'rng': parse_rng_lines(delta_lines),
                'screen': screen,
            })
            prev_rng_count = rng_count
    finally:
        kill_tmux_session(session)
        shutil.rmtree(tmpdir, ignore_errors=True)

    # Keep tutorial-focused trace: startup at tutorial prompt, then accept and play.
    prompt_idx = None
    for i, step in enumerate(steps):
        scr = step.get('screen', [])
        text = '\n'.join(scr) if isinstance(scr, list) else str(scr)
        if 'Do you want a tutorial?' in text:
            prompt_idx = i
            break
    if prompt_idx is None:
        raise RuntimeError('Could not find tutorial prompt in captured steps')

    startup_step = {
        'key': None,
        'action': 'startup',
        'rng': steps[prompt_idx].get('rng', []),
        'screen': steps[prompt_idx].get('screen', []),
    }
    tutorial_steps = [startup_step] + steps[prompt_idx + 1:]

    return {
        'version': 3,
        'seed': seed,
        'source': 'c',
        'type': 'interface',
        'regen': {
            'mode': 'interface',
            'subtype': 'tutorial',
            'keys': ''.join(s.get('key', '') or '' for s in tutorial_steps[1:]),
        },
        'options': {
            'description': 'Tutorial acceptance flow with strict RNG deltas',
            'name': 'wizard',
            'role': 'Valkyrie',
            'race': 'human',
            'gender': 'female',
            'align': 'neutral',
        },
        'steps': tutorial_steps,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: gen_interface_sessions.py [--startup|--options|--chargen|--tutorial|--all]")
        sys.exit(1)

    os.makedirs(SESSIONS_DIR, exist_ok=True)

    if sys.argv[1] == '--all':
        for mode in ['--startup', '--options', '--chargen']:
            sys.argv[1] = mode
            main()
        return

    if sys.argv[1] == '--startup':
        data = capture_startup_sequence()
        outfile = os.path.join(SESSIONS_DIR, 'interface_startup.session.json')
    elif sys.argv[1] == '--options':
        data = capture_options_menu()
        outfile = os.path.join(SESSIONS_DIR, 'interface_options.session.json')
    elif sys.argv[1] == '--chargen':
        data = capture_complete_chargen()
        outfile = os.path.join(SESSIONS_DIR, 'interface_chargen.session.json')
    elif sys.argv[1] == '--tutorial':
        data = capture_tutorial_prompt_flow(seed=1)
        manual_dir = os.path.join(SESSIONS_DIR, 'manual')
        os.makedirs(manual_dir, exist_ok=True)
        outfile = os.path.join(manual_dir, 'interface_tutorial.session.json')
    else:
        print(f"Unknown option: {sys.argv[1]}")
        sys.exit(1)

    with open(outfile, 'w') as f:
        f.write(compact_session_json(data))

    print(f"Generated {outfile}")
    print(f"  {len(data['steps'])} steps captured")


if __name__ == '__main__':
    main()
