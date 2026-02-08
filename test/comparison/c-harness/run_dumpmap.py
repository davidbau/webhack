#!/usr/bin/env python3
"""Run the C NetHack binary in tmux, execute #dumpmap, and quit.

Usage:
    python3 run_dumpmap.py <seed> <output_file> [depth]

depth defaults to 1. When depth > 1, wizard mode Ctrl+V level teleport
is used to jump to the target level before dumping the map.

Everything is derived from the script's location in the project tree.
The C binary must have been built and installed via setup.sh first.

This script:
1. Sets up a temporary HOME with .nethackrc for deterministic character selection
2. Starts a tmux session running nethack with NETHACK_SEED and NETHACK_DUMPMAP set
3. Sends keystrokes to get through character selection
4. If depth > 1, uses Ctrl+V wizard teleport to reach the target level
5. Executes #dumpmap to write the terrain grid
6. Quits the game
7. Verifies the dump file was created
"""

import sys
import os
import time
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')

# The installed nethack lives here (set by setup.sh, project-local)
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')


def tmux_send(session, keys, delay=0.1):
    """Send literal keys to a tmux session and wait."""
    subprocess.run(['tmux', 'send-keys', '-t', session, '-l', keys], check=True)
    time.sleep(delay)

def tmux_send_special(session, key, delay=0.1):
    """Send a special key (Enter, Space, etc.) to a tmux session."""
    subprocess.run(['tmux', 'send-keys', '-t', session, key], check=True)
    time.sleep(delay)

def tmux_capture(session):
    """Capture the current tmux pane content."""
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p'],
        capture_output=True, text=True, check=True
    )
    return result.stdout

def setup_home():
    """Create a temporary HOME directory with .nethackrc for deterministic play."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write('OPTIONS=name:Wizard\n')
        f.write('OPTIONS=race:human\n')
        f.write('OPTIONS=role:Valkyrie\n')
        f.write('OPTIONS=gender:female\n')
        f.write('OPTIONS=align:neutral\n')
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
    for f in glob.glob(os.path.join(INSTALL_DIR, 'bon*')):
        os.unlink(f)

def wait_for_game_ready(session, verbose):
    """Wait for the game to finish character selection and show the dungeon."""
    for attempt in range(40):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            if verbose: print(f'[{attempt}] tmux session died')
            break

        first_line = content.split('\n')[0][:80] if content else ''
        if verbose: print(f'[{attempt}] {repr(first_line)}')

        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.1)
            continue

        if 'keep the save file' in content or 'keep save' in content.lower():
            tmux_send(session, 'n', 0.1)
            continue

        if 'Destroy old game' in content:
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

        # Detect game is running: look for typical dungeon characters or status line
        # The status line contains "St:" or "Dlvl:" or player stats
        if 'Dlvl:' in content or 'St:' in content or 'HP:' in content:
            break

        # Also detect common map characters (walls rendered in the game)
        lines = content.strip().split('\n')
        if len(lines) > 5 and any('|' in line and '-' in line for line in lines[1:22]):
            break

        # If none of the above matched, try pressing Space to advance
        # through any prompts or intro text we don't recognize
        if attempt > 2:
            tmux_send_special(session, 'Space', 0.1)
        else:
            time.sleep(0.1)

def wizard_level_teleport(session, target_depth, verbose):
    """Use wizard mode Ctrl+V to teleport to a specific dungeon level.

    In C NetHack wizard mode, Ctrl+V triggers level teleport which prompts
    'To what level do you want to teleport?'. We type the depth and Enter.
    """
    if verbose: print(f'[teleport] Sending Ctrl+V for level teleport to depth {target_depth}')

    # Send Ctrl+V (wizard level teleport)
    tmux_send_special(session, 'C-v', 0.1)

    # Wait for the "To what level" prompt
    for attempt in range(20):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if verbose: print(f'[teleport-{attempt}] checking for prompt...')

        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.1)
            continue

        if 'To what level' in content or 'what level' in content.lower():
            if verbose: print(f'[teleport] Got level prompt, sending {target_depth}')
            tmux_send(session, str(target_depth), 0.1)
            tmux_send_special(session, 'Enter', 0.3)
            break

        time.sleep(0.1)

    # Wait for the level change to complete — look for Dlvl:N in status
    target_str = f'Dlvl:{target_depth}'
    for attempt in range(30):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break

        if verbose: print(f'[teleport-wait-{attempt}] looking for {target_str}')

        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.1)
            continue

        if target_str in content:
            if verbose: print(f'[teleport] Arrived at {target_str}')
            break

        time.sleep(0.1)

    time.sleep(0.1)

def execute_dumpmap(session):
    """Send #dumpmap extended command and handle any --More-- prompts."""
    # Send # to start extended command
    tmux_send(session, '#', 0.1)
    time.sleep(0.1)

    # Type the command name and press Enter
    tmux_send(session, 'dumpmap', 0.1)
    tmux_send_special(session, 'Enter', 0.3)

    # Handle any --More-- after the dumpmap message
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

def quit_game(session):
    """Send #quit and handle confirmation prompts."""
    tmux_send(session, '#', 0.1)
    time.sleep(0.1)
    tmux_send(session, 'quit', 0.1)
    tmux_send_special(session, 'Enter', 0.1)

    # Handle quit confirmation prompts
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

def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <seed> <output_file> [depth]")
        sys.exit(1)

    seed = sys.argv[1]
    output_file = os.path.abspath(sys.argv[2])
    depth = int(sys.argv[3]) if len(sys.argv) >= 4 else 1

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    # Clean up any previous output
    if os.path.exists(output_file):
        os.unlink(output_file)

    setup_home()

    verbose = os.environ.get('WEBHACK_DEBUG', '')
    session = f'webhack-dumpmap-{seed}-d{depth}-{os.getpid()}'

    try:
        # Build the shell command with all env vars
        rnglog = os.environ.get('NETHACK_RNGLOG', '')
        rnglog_env = f'NETHACK_RNGLOG={rnglog} ' if rnglog else ''
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_DUMPMAP={output_file} '
            f'{rnglog_env}'
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u Wizard -D; '
            f'sleep 999'
        )
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session, '-x', '100', '-y', '30', cmd],
            check=True
        )

        # Wait for the game to start
        time.sleep(1.0)

        # Handle character selection and startup prompts
        wait_for_game_ready(session, verbose)
        time.sleep(0.1)

        # If targeting a deeper level, use wizard level teleport
        if depth > 1:
            wizard_level_teleport(session, depth, verbose)

        # Execute #dumpmap
        execute_dumpmap(session)

        # Quit the game
        quit_game(session)

    finally:
        # Always kill the tmux session
        subprocess.run(['tmux', 'kill-session', '-t', session],
                       capture_output=True)

    if os.path.exists(output_file):
        with open(output_file) as f:
            lines = f.readlines()
        if len(lines) == 21:
            print(f"SUCCESS: {output_file} ({len(lines)} rows)")
            sys.exit(0)
        else:
            print(f"WARNING: {output_file} has {len(lines)} rows (expected 21)")
            sys.exit(0)
    else:
        print(f"FAIL: {output_file} was not created")
        sys.exit(1)


if __name__ == '__main__':
    main()
