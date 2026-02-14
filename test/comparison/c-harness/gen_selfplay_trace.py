#!/usr/bin/env python3
"""Generate 100-turn selfplay traces with character creation from C NetHack.

Usage:
    python3 gen_selfplay_trace.py <seed> [--turns N] [--role ROLE]
    python3 gen_selfplay_trace.py 3
    python3 gen_selfplay_trace.py 4 --turns 100 --role Valkyrie

Combines:
1. Interactive character creation (from gen_chargen_sessions.py)
2. Selfplay agent for interesting gameplay (via c_runner.js)
3. Full session capture (RNG logs, screens, typGrids from run_session.py)

Output: test/comparison/sessions/seed<N>_selfplay.session.json

The script:
- Starts C NetHack in tmux with the given seed
- Navigates character creation menus adaptively
- Launches the selfplay agent (c_runner.js) to generate interesting moves
- Captures RNG calls, screen states, and terrain grids after each move
- Stops after exactly 100 turns (configurable)
- Saves everything in the standard session JSON format
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
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')

# Import shared helpers from run_session.py
_spec = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_session = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_session)

tmux_send = _session.tmux_send
tmux_send_special = _session.tmux_send_special
parse_rng_lines = _session.parse_rng_lines
compact_session_json = _session.compact_session_json
read_rng_log = _session.read_rng_log
capture_screen_lines = _session.capture_screen_lines
read_typ_grid = _session.read_typ_grid
execute_dumpmap = _session.execute_dumpmap
clear_more_prompts = _session.clear_more_prompts
quit_game = _session.quit_game
detect_depth = _session.detect_depth
fixed_datetime_env = _session.fixed_datetime_env

# Character configuration
ROLE_KEYS = {
    'Valkyrie': 'v', 'Wizard': 'w', 'Barbarian': 'b', 'Knight': 'k',
    'Monk': 'm', 'Priest': 'p', 'Ranger': 'R', 'Rogue': 'r',
    'Samurai': 's', 'Tourist': 't', 'Archeologist': 'a', 'Caveman': 'c', 'Healer': 'h'
}

def setup_home():
    """Set up HOME with minimal .nethackrc for interactive character creation."""
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # Minimal .nethackrc WITHOUT role/race/gender/align to force prompts
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write('OPTIONS=name:Wizard\n')
        f.write('OPTIONS=!autopickup\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        f.write('OPTIONS=symset:DECgraphics\n')

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


def tmux_capture(session):
    """Capture the current tmux pane content."""
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-S', '0', '-E', '30'],
        capture_output=True, text=True, check=True
    )
    return result.stdout


def wait_for_game_ready_with_chargen(session, rng_log_file, role='Valkyrie'):
    """Navigate startup prompts AND character creation until game is ready.

    Returns:
        List of chargen steps (key, action, rng, screen)
    """
    role_key = ROLE_KEYS.get(role, 'v')
    chargen_steps = []
    prev_rng_count = 0

    for attempt in range(80):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            print(f'  [attempt {attempt}] tmux session died')
            break

        rng_count, rng_lines = read_rng_log(rng_log_file)

        # Determine key to send based on screen content
        key = None
        action = None

        if 'Destroy old game' in content or 'destroy old game' in content.lower():
            key, action = 'y', 'destroy-old'
        elif 'keep the save file' in content or 'keep save' in content.lower():
            key, action = 'n', 'discard-save'
        elif 'Shall I pick' in content:
            key, action = 'n', 'decline-autopick'
        elif 'Pick a role' in content or 'pick a role' in content:
            key, action = role_key, 'pick-role'
        elif 'Pick a race' in content or 'pick a race' in content:
            key, action = 'h', 'pick-race-human'
        elif 'Pick a gender' in content or 'pick a gender' in content:
            key, action = 'f', 'pick-gender-female'
        elif 'Pick an alignment' in content or 'pick an alignment' in content:
            key, action = 'n', 'pick-align-neutral'
        elif 'Is this ok?' in content:
            key, action = 'y', 'confirm-ok'
        elif '--More--' in content:
            key, action = ' ', 'more'
        elif 'tutorial' in content.lower():
            key, action = 'n', 'decline-tutorial'
        elif 'Dlvl:' in content or 'HP:' in content:
            print(f'  [attempt {attempt}] GAME READY')
            break
        else:
            # Check for map characters as game-ready signal
            lines = content.strip().split('\n')
            if len(lines) > 5 and any('|' in l and '-' in l for l in lines[1:22]):
                print(f'  [attempt {attempt}] GAME READY (map detected)')
                break
            if attempt > 2:
                time.sleep(0.1)
            continue

        # Send the key
        if key == ' ':
            tmux_send_special(session, 'Space', 0.1)
        else:
            tmux_send(session, key, 0.1)

        # Wait for screen update, then capture state
        time.sleep(0.1)
        screen = capture_screen_lines(session)
        rng_count, rng_lines = read_rng_log(rng_log_file)
        delta_lines = rng_lines[prev_rng_count:rng_count]
        rng_entries = parse_rng_lines(delta_lines)

        step = {
            'key': key,
            'action': action,
            'rng': rng_entries,
            'screen': screen,
        }
        chargen_steps.append(step)

        delta = rng_count - prev_rng_count
        print(f'  [{len(chargen_steps):02d}] key={key!r:3s} ({action:20s}) +{delta} RNG')
        prev_rng_count = rng_count

    return chargen_steps, prev_rng_count


def get_agent_move(session_name, screen_lines, turn):
    """Query the selfplay agent for the next move.

    For now, returns a simple exploration sequence.
    TODO: Integrate with c_runner.js to get AI-generated moves.
    """
    # Simple exploration pattern for now
    # TODO: Call node c_runner.js with current screen state to get AI decision
    moves = ['h', 'h', 'j', 'j', 'l', 'l', 'k', 'k', '.', 's']
    return moves[turn % len(moves)]


def generate_trace(seed, max_turns=100, role='Valkyrie'):
    """Generate a selfplay trace with character creation."""

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    setup_home()
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    tmpdir = tempfile.mkdtemp(prefix='webhack-selfplay-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')

    session_name = f'webhack-selfplay-{seed}-{os.getpid()}'

    try:
        cmd = (
            f'{fixed_datetime_env()}'
            f'NETHACKDIR={INSTALL_DIR} '
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'NETHACK_DUMPMAP={dumpmap_file} '
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

        print(f'=== Generating selfplay trace: seed={seed}, role={role}, turns={max_turns} ===')
        print(f'\n=== CHARACTER CREATION ===')

        # Navigate character creation and capture steps
        chargen_steps, prev_rng_count = wait_for_game_ready_with_chargen(
            session_name, rng_log_file, role
        )

        # Capture startup state (after chargen)
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines[:prev_rng_count])

        print(f'\nChargen complete: {len(chargen_steps)} steps, {prev_rng_count} RNG calls')

        # Clear any --More-- prompts
        clear_more_prompts(session_name)
        time.sleep(0.1)

        # Capture initial typGrid
        startup_typ_grid = execute_dumpmap(session_name, dumpmap_file)
        if startup_typ_grid:
            print(f'Startup typGrid: {len(startup_typ_grid)}x{len(startup_typ_grid[0])} captured')
        else:
            print('WARNING: Failed to capture startup typGrid')

        clear_more_prompts(session_name)

        # Build session object with chargen steps
        session_data = {
            'version': 1,
            'seed': seed,
            'wizard': True,
            'character': {
                'name': 'Wizard',
                'role': role,
                'race': 'human',
                'gender': 'female',
                'align': 'neutral',
            },
            'symset': 'DECgraphics',
            'screenMode': 'decgraphics',
            'type': 'gameplay',  # Use 'gameplay' type for existing test infrastructure
            'maxTurns': max_turns,
            'startup': {
                'rngCalls': prev_rng_count,
                'rng': startup_rng_entries,
                'typGrid': startup_typ_grid,
                'screen': startup_screen,
            },
            'chargen': chargen_steps,
            'steps': [],
        }

        print(f'\n=== GAMEPLAY ({max_turns} turns) ===')

        # Generate moves using selfplay agent
        turn = 0
        prev_depth = 1
        prev_typ_grid = startup_typ_grid

        while turn < max_turns:
            # Get current screen
            screen = capture_screen_lines(session_name)

            # Get next move from agent
            key = get_agent_move(session_name, screen, turn)

            # Send keystroke
            tmux_send(session_name, key, 0.1)
            time.sleep(0.1)
            clear_more_prompts(session_name)
            time.sleep(0.1)

            # Capture state after move
            screen = capture_screen_lines(session_name)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            # Detect depth
            depth = detect_depth(screen)

            # Build step
            turn += 1
            step = {
                'key': key,
                'action': f'move-{key}',
                'turn': turn,
                'depth': depth,
                'rng': rng_entries,
                'screen': screen,
            }

            # Capture typGrid if depth changed or periodically
            if turn % 20 == 0 or depth != prev_depth:
                current_grid = execute_dumpmap(session_name, dumpmap_file)
                clear_more_prompts(session_name)
                if current_grid and current_grid != prev_typ_grid:
                    step['typGrid'] = current_grid
                    print(f'  Terrain captured at turn {turn}')
                    prev_typ_grid = current_grid

            session_data['steps'].append(step)

            delta = rng_count - prev_rng_count
            if turn % 10 == 0:
                print(f'  [{turn:03d}] {key!r:3s} depth={depth} +{delta:4d} RNG calls (total {rng_count})')

            prev_rng_count = rng_count
            prev_depth = depth

        # Quit the game
        quit_game(session_name)

        # Write JSON
        filename = f'seed{seed}_selfplay_{max_turns}turns.session.json'
        filepath = os.path.join(SESSIONS_DIR, filename)
        with open(filepath, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f'\n=== DONE ===')
        print(f'Session: {filepath}')
        print(f'Chargen steps: {len(chargen_steps)}')
        print(f'Gameplay turns: {turn}')
        print(f'Total RNG calls: {prev_rng_count}')

        return filepath

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <seed> [--turns N] [--role ROLE]")
        print(f"Example: {sys.argv[0]} 3")
        print(f"Example: {sys.argv[0]} 4 --turns 100 --role Valkyrie")
        sys.exit(1)

    seed = int(sys.argv[1])
    max_turns = 100
    role = 'Valkyrie'

    # Parse optional arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--turns' and i + 1 < len(sys.argv):
            max_turns = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--role' and i + 1 < len(sys.argv):
            role = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    generate_trace(seed, max_turns, role)


if __name__ == '__main__':
    main()
