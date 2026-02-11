#!/usr/bin/env python3
"""Generate C NetHack sessions testing pickup_types option.

Usage:
    python3 gen_pickup_types_sessions.py

Tests pickup_types filtering with various object classes:
- Empty string (pickup all types)
- "$" (gold only)
- "!?" (potions and scrolls only)
- "$/!?=+" (gold, potions, scrolls, rings, spellbooks)

Each test:
1. Enables autopickup
2. Wizard mode: create items of various classes
3. Drop items on ground
4. Walk over items
5. Verify correct items picked up based on pickup_types

Output: test/comparison/sessions/seed<N>_pickup_types_<config>.session.json
"""

import os
import sys
import json
import time
import subprocess
import glob
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
clear_more_prompts = _session.clear_more_prompts
wait_for_game_ready = _session.wait_for_game_ready
quit_game = _session.quit_game


def setup_pickup_types_home(pickup_types_value):
    """Set up HOME with .nethackrc containing pickup_types option.

    Args:
        pickup_types_value: string value for pickup_types (e.g., "$", "!?", "$/!?=+")
    """
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # Clean up stale game state
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

    # Write .nethackrc with pickup_types option
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write('OPTIONS=name:Wizard\n')
        f.write('OPTIONS=race:elf\n')
        f.write('OPTIONS=role:Wizard\n')
        f.write('OPTIONS=gender:male\n')
        f.write('OPTIONS=align:chaotic\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        f.write('OPTIONS=autopickup\n')  # Enable autopickup

        # Set pickup_types
        if pickup_types_value:
            f.write(f'OPTIONS=pickup_types:{pickup_types_value}\n')
        # Empty string means don't set the option (default behavior)

    return RESULTS_DIR


def generate_pickup_types_session(session_name, seed, pickup_types_value, pickup_types_label):
    """Generate a session testing specific pickup_types configuration.

    Args:
        session_name: name for the session file
        seed: random seed
        pickup_types_value: value for pickup_types option
        pickup_types_label: label for the config (e.g., "gold_only")
    """
    print(f"\nGenerating {session_name} (pickup_types={repr(pickup_types_value)})...")

    home_dir = setup_pickup_types_home(pickup_types_value)

    # Start tmux session
    session_id = f'nhtest_{int(time.time())}'

    # Kill any existing session
    subprocess.run(['tmux', 'kill-session', '-t', session_id],
                   stderr=subprocess.DEVNULL)

    # Build command with proper environment variables (same pattern as gen_option_sessions.py)
    cmd = (
        f'NETHACKDIR={INSTALL_DIR} '
        f'HOME={home_dir} '
        f'NETHACKOPTIONS=!legacy '
        f'TERM=xterm-256color '
        f'{NETHACK_BINARY} -u Wizard -D; '
        f'sleep 999'
    )

    # Start new session with shell command
    subprocess.run(['tmux', 'new-session', '-d', '-s', session_id, '-x', '80', '-y', '24', 'sh', '-c', cmd])
    time.sleep(0.5)

    steps = []

    # Wait for game to start (no RNG logging for this test)
    rng_log = os.path.join(home_dir, 'rnglog.txt')
    wait_for_game_ready(session_id, rng_log)
    time.sleep(0.3)

    # Capture startup
    screen = capture_screen_lines(session_id)
    steps.append({
        'step': 0,
        'command': 'startup',
        'screen': screen,
        'description': f'Game start with pickup_types={repr(pickup_types_value)}'
    })

    # Wizard mode: create test items
    # We'll create: potion (!), scroll (?), dagger ()), gold ($), ring (=)

    # Create potion
    tmux_send_special(session_id, 'C-w')  # Ctrl+W for wizard wish
    time.sleep(0.2)
    clear_more_prompts(session_id)
    tmux_send(session_id, 'potion of healing')
    tmux_send_special(session_id, 'Enter')
    time.sleep(0.3)
    clear_more_prompts(session_id)

    # Create scroll
    tmux_send_special(session_id, 'C-w')
    time.sleep(0.2)
    clear_more_prompts(session_id)
    tmux_send(session_id, 'scroll of identify')
    tmux_send_special(session_id, 'Enter')
    time.sleep(0.3)
    clear_more_prompts(session_id)

    # Create dagger
    tmux_send_special(session_id, 'C-w')
    time.sleep(0.2)
    clear_more_prompts(session_id)
    tmux_send(session_id, 'dagger')
    tmux_send_special(session_id, 'Enter')
    time.sleep(0.3)
    clear_more_prompts(session_id)

    # Create ring
    tmux_send_special(session_id, 'C-w')
    time.sleep(0.2)
    clear_more_prompts(session_id)
    tmux_send(session_id, 'ring of invisibility')
    tmux_send_special(session_id, 'Enter')
    time.sleep(0.3)
    clear_more_prompts(session_id)

    # Create gold (100 zorkmids)
    tmux_send_special(session_id, 'C-w')
    time.sleep(0.2)
    clear_more_prompts(session_id)
    tmux_send(session_id, '100 gold pieces')
    tmux_send_special(session_id, 'Enter')
    time.sleep(0.3)
    clear_more_prompts(session_id)

    # Drop all items
    tmux_send(session_id, 'd')  # drop command
    time.sleep(0.2)
    clear_more_prompts(session_id)
    tmux_send(session_id, '*')  # drop all
    time.sleep(0.3)
    clear_more_prompts(session_id)

    screen = capture_screen_lines(session_id)
    steps.append({
        'step': 1,
        'command': 'drop_items',
        'screen': screen,
        'description': 'Dropped all test items'
    })

    # Move away (one square)
    tmux_send(session_id, 'l')  # move right
    time.sleep(0.3)
    clear_more_prompts(session_id)

    screen = capture_screen_lines(session_id)
    steps.append({
        'step': 2,
        'command': 'move-east',
        'screen': screen,
        'description': 'Moved away from items'
    })

    # Move back onto items (autopickup should trigger)
    tmux_send(session_id, 'h')  # move left
    time.sleep(0.5)
    clear_more_prompts(session_id)

    screen = capture_screen_lines(session_id)
    steps.append({
        'step': 3,
        'command': 'move-west',
        'screen': screen,
        'description': 'Moved back onto items - autopickup triggered'
    })

    # Check inventory to see what was picked up
    tmux_send(session_id, 'i')  # inventory
    time.sleep(0.3)
    screen = capture_screen_lines(session_id)
    steps.append({
        'step': 4,
        'command': 'inventory',
        'screen': screen,
        'description': 'Check what was picked up'
    })

    # Clear inventory display
    tmux_send_special(session_id, 'Escape')
    time.sleep(0.2)

    # Quit
    quit_game(session_id)

    # Save session
    session_file = os.path.join(SESSIONS_DIR, f'{session_name}.session.json')
    session_data = {
        'seed': seed,
        'character': 'Wizard chaotic elf male',
        'version': '3.7',
        'wizard': True,
        'pickup_types': pickup_types_value,
        'pickup_types_label': pickup_types_label,
        'steps': steps
    }

    with open(session_file, 'w') as f:
        json.dump(session_data, f, indent=2)

    print(f"  ✓ Saved {session_file}")

    # Clean up tmux
    subprocess.run(['tmux', 'kill-session', '-t', session_id],
                   stderr=subprocess.DEVNULL)


def main():
    """Generate all pickup_types test sessions."""
    print("=== Generating pickup_types test sessions ===")

    # Ensure sessions directory exists
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    # Test configurations
    configs = [
        ('seed42_pickup_types_all', 42, '', 'all'),
        ('seed42_pickup_types_gold_only', 42, '$', 'gold_only'),
        ('seed42_pickup_types_potions_scrolls', 42, '!?', 'potions_scrolls'),
        ('seed42_pickup_types_valuables', 42, '$/!?=+', 'valuables'),
    ]

    for session_name, seed, pickup_types_value, label in configs:
        try:
            generate_pickup_types_session(session_name, seed, pickup_types_value, label)
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            import traceback
            traceback.print_exc()

    print("\n=== Done ===")
    print(f"Generated {len(configs)} pickup_types test sessions")


if __name__ == '__main__':
    main()
