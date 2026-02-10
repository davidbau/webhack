#!/usr/bin/env python3
"""Generate C NetHack sessions testing option behaviors.

Usage:
    python3 gen_option_sessions.py [--all] [--option <name>]

Generates session files for testing option behaviors:
- verbose: on/off comparison for instruction messages
- autopickup: on/off/nopick comparison
- DECgraphics: ASCII vs box-drawing symbols
- msg_window: single-line vs 3-line message window
- travel: destination selection and pathfinding

Output: test/comparison/sessions/seed<N>_<option>_<value>.session.json
"""

import os
import sys
import json
import time
import subprocess
import tempfile
import shutil
import importlib.util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')

# Import helpers from run_session.py
_spec = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_session = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_session)

tmux_send = _session.tmux_send
tmux_send_special = _session.tmux_send_special
tmux_capture = _session.tmux_capture
capture_screen_lines = _session.capture_screen_lines
parse_rng_lines = _session.parse_rng_lines
compact_session_json = _session.compact_session_json
read_rng_log = _session.read_rng_log
clear_more_prompts = _session.clear_more_prompts
wait_for_game_ready = _session.wait_for_game_ready
quit_game = _session.quit_game


def setup_option_home(option_flags):
    """Set up HOME with .nethackrc containing specific option values.

    Args:
        option_flags: dict of option names to values (True/False/"on"/"off")
    """
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # Clean up stale game state
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

    # Write .nethackrc with specified options
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write('OPTIONS=name:Wizard\n')
        f.write('OPTIONS=race:elf\n')
        f.write('OPTIONS=role:Wizard\n')
        f.write('OPTIONS=gender:male\n')
        f.write('OPTIONS=align:chaotic\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')

        # Write option flags
        for opt, value in option_flags.items():
            if opt == 'verbose':
                prefix = '' if value else '!'
                f.write(f'OPTIONS={prefix}verbose\n')
            elif opt == 'autopickup':
                prefix = '' if value else '!'
                f.write(f'OPTIONS={prefix}autopickup\n')
            elif opt == 'DECgraphics':
                if value:
                    f.write('OPTIONS=symset:DECgraphics\n')
                else:
                    f.write('OPTIONS=symset:default\n')
            elif opt == 'msg_window':
                # C NetHack uses 'msghistory' option
                if value:
                    f.write('OPTIONS=msghistory:3\n')
                else:
                    f.write('OPTIONS=msghistory:1\n')


def generate_verbose_sessions():
    """Generate sessions testing verbose option (on/off)."""
    print("\n=== Generating verbose option sessions ===")

    # Test verbose=on: pressing 'm' should show "Next command will request menu..."
    seed = 301
    option_flags = {'verbose': True, 'autopickup': False, 'DECgraphics': False}
    session_name = f'webhack-option-{seed}-{os.getpid()}'
    tmpdir = tempfile.mkdtemp(prefix='webhack-option-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')

    try:
        setup_option_home(option_flags)

        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )

        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )
        time.sleep(1.0)

        wait_for_game_ready(session_name, rng_log_file)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture startup
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        # Step 1: Press 'm' to trigger verbose message
        tmux_send(session_name, 'm', 0.1)
        time.sleep(0.1)
        screen_after_m = capture_screen_lines(session_name)
        rng_count_m, rng_lines_m = read_rng_log(rng_log_file)
        rng_entries_m = parse_rng_lines(rng_lines_m[startup_rng_count:])

        # Step 2: Press '.' to execute the wait command
        tmux_send(session_name, '.', 0.1)
        time.sleep(0.1)
        clear_more_prompts(session_name)
        screen_after_wait = capture_screen_lines(session_name)
        rng_count_wait, rng_lines_wait = read_rng_log(rng_log_file)
        rng_entries_wait = parse_rng_lines(rng_lines_wait[rng_count_m:])

        session_data = {
            'version': 1,
            'seed': seed,
            'type': 'option_test',
            'option': 'verbose',
            'option_value': True,
            'description': 'Test verbose option - should show "Next command will..." message',
            'character': {
                'name': 'Wizard',
                'role': 'Wizard',
                'race': 'elf',
                'gender': 'male',
                'align': 'chaotic'
            },
            'startup': {
                'rngCalls': len([e for e in startup_rng_entries if e[0] not in ('>', '<')]),
                'screen': startup_screen,
            },
            'steps': [
                {
                    'key': 'm',
                    'action': 'menu-prefix',
                    'expected_message': 'Next command will request menu or move without autopickup/attack.',
                    'rng': rng_entries_m,
                    'screen': screen_after_m,
                },
                {
                    'key': '.',
                    'action': 'wait',
                    'rng': rng_entries_wait,
                    'screen': screen_after_wait,
                }
            ]
        }

        quit_game(session_name)

        output_path = os.path.join(SESSIONS_DIR, 'seed301_verbose_on.session.json')
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f"✓ Created {output_path}")

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)

    # Test verbose=off: pressing 'm' should NOT show message
    seed = 302
    option_flags = {'verbose': False, 'autopickup': False, 'DECgraphics': False}
    session_name = f'webhack-option-{seed}-{os.getpid()}'
    tmpdir = tempfile.mkdtemp(prefix='webhack-option-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')

    try:
        setup_option_home(option_flags)

        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )

        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )
        time.sleep(1.0)

        wait_for_game_ready(session_name, rng_log_file)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture startup
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        # Step 1: Press 'm' (should not show message)
        tmux_send(session_name, 'm', 0.1)
        time.sleep(0.1)
        screen_after_m = capture_screen_lines(session_name)
        rng_count_m, rng_lines_m = read_rng_log(rng_log_file)
        rng_entries_m = parse_rng_lines(rng_lines_m[startup_rng_count:])

        # Step 2: Press '.' to execute wait
        tmux_send(session_name, '.', 0.1)
        time.sleep(0.1)
        clear_more_prompts(session_name)
        screen_after_wait = capture_screen_lines(session_name)
        rng_count_wait, rng_lines_wait = read_rng_log(rng_log_file)
        rng_entries_wait = parse_rng_lines(rng_lines_wait[rng_count_m:])

        session_data = {
            'version': 1,
            'seed': seed,
            'type': 'option_test',
            'option': 'verbose',
            'option_value': False,
            'description': 'Test verbose=off - should NOT show "Next command will..." message',
            'character': {
                'name': 'Wizard',
                'role': 'Wizard',
                'race': 'elf',
                'gender': 'male',
                'align': 'chaotic'
            },
            'startup': {
                'rngCalls': len([e for e in startup_rng_entries if e[0] not in ('>', '<')]),
                'screen': startup_screen,
            },
            'steps': [
                {
                    'key': 'm',
                    'action': 'menu-prefix',
                    'expected_message': None,
                    'rng': rng_entries_m,
                    'screen': screen_after_m,
                },
                {
                    'key': '.',
                    'action': 'wait',
                    'rng': rng_entries_wait,
                    'screen': screen_after_wait,
                }
            ]
        }

        quit_game(session_name)

        output_path = os.path.join(SESSIONS_DIR, 'seed302_verbose_off.session.json')
        with open(output_path, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f"✓ Created {output_path}")

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def generate_decgraphics_sessions():
    """Generate sessions testing DECgraphics option (ASCII vs box-drawing)."""
    print("\n=== Generating DECgraphics option sessions ===")

    # Test DECgraphics=off (ASCII)
    seed = 303
    option_flags = {'verbose': False, 'autopickup': False, 'DECgraphics': False}
    session_name = f'webhack-option-{seed}-{os.getpid()}'
    tmpdir = tempfile.mkdtemp(prefix='webhack-option-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')

    try:
        setup_option_home(option_flags)

        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )

        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )
        time.sleep(1.0)

        wait_for_game_ready(session_name, rng_log_file)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture startup (shows ASCII walls: | - )
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        session_data = {
            'version': 1,
            'seed': seed,
            'type': 'option_test',
            'option': 'DECgraphics',
            'option_value': False,
            'description': 'Test DECgraphics=off - should show ASCII walls (| - )',
            'character': {
                'name': 'Wizard',
                'role': 'Wizard',
                'race': 'elf',
                'gender': 'male',
                'align': 'chaotic'
            },
            'startup': {
                'rngCalls': len([e for e in startup_rng_entries if e[0] not in ('>', '<')]),
                'screen': startup_screen,
            },
            'steps': []
        }

        quit_game(session_name)

        output_path = os.path.join(SESSIONS_DIR, 'seed303_decgraphics_off.session.json')
        with open(output_path, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f"✓ Created {output_path}")

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)

    # Test DECgraphics=on (box-drawing)
    seed = 304
    option_flags = {'verbose': False, 'autopickup': False, 'DECgraphics': True}
    session_name = f'webhack-option-{seed}-{os.getpid()}'
    tmpdir = tempfile.mkdtemp(prefix='webhack-option-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')

    try:
        setup_option_home(option_flags)

        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )

        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )
        time.sleep(1.0)

        wait_for_game_ready(session_name, rng_log_file)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture startup (shows box-drawing: │ ─ ┌ ┐ └ ┘)
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        session_data = {
            'version': 1,
            'seed': seed,
            'type': 'option_test',
            'option': 'DECgraphics',
            'option_value': True,
            'description': 'Test DECgraphics=on - should show box-drawing walls (│ ─ ┌ etc.)',
            'character': {
                'name': 'Wizard',
                'role': 'Wizard',
                'race': 'elf',
                'gender': 'male',
                'align': 'chaotic'
            },
            'startup': {
                'rngCalls': len([e for e in startup_rng_entries if e[0] not in ('>', '<')]),
                'screen': startup_screen,
            },
            'steps': []
        }

        quit_game(session_name)

        output_path = os.path.join(SESSIONS_DIR, 'seed304_decgraphics_on.session.json')
        with open(output_path, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f"✓ Created {output_path}")

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def generate_time_sessions():
    """Generate sessions testing time option (on/off)."""
    print("\n=== Generating time option sessions ===")

    # Test time=on: status line should show T:N
    seed = 305
    option_flags = {'verbose': False, 'autopickup': False, 'DECgraphics': False}
    session_name = f'webhack-option-{seed}-{os.getpid()}'
    tmpdir = tempfile.mkdtemp(prefix='webhack-option-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')

    try:
        # For time option, we need to set it in .nethackrc
        os.makedirs(RESULTS_DIR, exist_ok=True)
        nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
        with open(nethackrc, 'w') as f:
            f.write('OPTIONS=name:Wizard\n')
            f.write('OPTIONS=race:elf\n')
            f.write('OPTIONS=role:Wizard\n')
            f.write('OPTIONS=gender:male\n')
            f.write('OPTIONS=align:chaotic\n')
            f.write('OPTIONS=suppress_alert:3.4.3\n')
            f.write('OPTIONS=time\n')  # Enable time option

        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )

        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )
        time.sleep(1.0)

        wait_for_game_ready(session_name, rng_log_file)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture startup (should show T:N in status line)
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        session_data = {
            'version': 1,
            'seed': seed,
            'type': 'option_test',
            'option': 'time',
            'option_value': True,
            'description': 'Test time=on - should show turn counter T:N in status line',
            'character': {
                'name': 'Wizard',
                'role': 'Wizard',
                'race': 'elf',
                'gender': 'male',
                'align': 'chaotic'
            },
            'startup': {
                'rngCalls': len([e for e in startup_rng_entries if e[0] not in ('>', '<')]),
                'screen': startup_screen,
            },
            'steps': []
        }

        quit_game(session_name)

        output_path = os.path.join(SESSIONS_DIR, 'seed305_time_on.session.json')
        with open(output_path, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f"✓ Created {output_path}")

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)

    # Test time=off: status line should NOT show T:N
    seed = 306
    session_name = f'webhack-option-{seed}-{os.getpid()}'
    tmpdir = tempfile.mkdtemp(prefix='webhack-option-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')

    try:
        os.makedirs(RESULTS_DIR, exist_ok=True)
        nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
        with open(nethackrc, 'w') as f:
            f.write('OPTIONS=name:Wizard\n')
            f.write('OPTIONS=race:elf\n')
            f.write('OPTIONS=role:Wizard\n')
            f.write('OPTIONS=gender:male\n')
            f.write('OPTIONS=align:chaotic\n')
            f.write('OPTIONS=suppress_alert:3.4.3\n')
            f.write('OPTIONS=!time\n')  # Disable time option

        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )

        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )
        time.sleep(1.0)

        wait_for_game_ready(session_name, rng_log_file)
        clear_more_prompts(session_name)
        time.sleep(0.1)

        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        session_data = {
            'version': 1,
            'seed': seed,
            'type': 'option_test',
            'option': 'time',
            'option_value': False,
            'description': 'Test time=off - should NOT show turn counter in status line',
            'character': {
                'name': 'Wizard',
                'role': 'Wizard',
                'race': 'elf',
                'gender': 'male',
                'align': 'chaotic'
            },
            'startup': {
                'rngCalls': len([e for e in startup_rng_entries if e[0] not in ('>', '<')]),
                'screen': startup_screen,
            },
            'steps': []
        }

        quit_game(session_name)

        output_path = os.path.join(SESSIONS_DIR, 'seed306_time_off.session.json')
        with open(output_path, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f"✓ Created {output_path}")

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    if '--all' in sys.argv or '--option' not in sys.argv:
        generate_verbose_sessions()
        generate_decgraphics_sessions()
        generate_time_sessions()
        print("\n✓ All option sessions generated successfully")
    elif '--option' in sys.argv:
        idx = sys.argv.index('--option')
        option = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None

        if option == 'verbose':
            generate_verbose_sessions()
        elif option == 'DECgraphics':
            generate_decgraphics_sessions()
        elif option == 'time':
            generate_time_sessions()
        else:
            print(f"Unknown option: {option}")
            print("Available options: verbose, DECgraphics, time")
            sys.exit(1)


if __name__ == '__main__':
    main()
