#!/usr/bin/env python3
"""Generate character creation session JSON files from the C NetHack binary.

Usage:
    python3 gen_chargen_sessions.py --from-config
    python3 gen_chargen_sessions.py <seed> <role> <race> <gender> <align> <label>

Each session captures the full character creation sequence as interactive
keystrokes, including --More-- prompts recorded as space steps. After
creation, captures inventory display and terrain grid.

The script uses a minimal .nethackrc (no role/race/gender/align) so the
game prompts for character selection interactively. It adaptively detects
each prompt on screen and sends the configured key, handling cases where
menus are skipped (e.g., Knight has only one valid race and alignment).

Output: test/comparison/sessions/seed<N>_chargen_<label>.session.json

Requires the C binary to be built with setup.sh first.
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

# Import shared helpers from run_dumpmap.py (tmux ops, quit)
_spec = importlib.util.spec_from_file_location('run_dumpmap', os.path.join(SCRIPT_DIR, 'run_dumpmap.py'))
_dumpmap = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_dumpmap)

tmux_send = _dumpmap.tmux_send
tmux_send_special = _dumpmap.tmux_send_special
quit_game = _dumpmap.quit_game

# Import helpers from run_session.py (RNG parsing, JSON formatting)
_spec2 = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_session = importlib.util.module_from_spec(_spec2)
_spec2.loader.exec_module(_session)

parse_rng_lines = _session.parse_rng_lines
compact_session_json = _session.compact_session_json
read_rng_log = _session.read_rng_log

# Label maps for character fields
ROLE_LABELS = {
    'a': 'Archeologist', 'b': 'Barbarian', 'c': 'Caveman',
    'h': 'Healer', 'k': 'Knight', 'm': 'Monk',
    'p': 'Priest', 'r': 'Rogue', 'R': 'Ranger',
    's': 'Samurai', 't': 'Tourist', 'v': 'Valkyrie', 'w': 'Wizard',
}
RACE_LABELS = {'h': 'human', 'e': 'elf', 'd': 'dwarf', 'g': 'gnome', 'o': 'orc'}
GENDER_LABELS = {'m': 'male', 'f': 'female', 'n': 'neuter'}
ALIGN_LABELS = {'l': 'lawful', 'n': 'neutral', 'c': 'chaotic'}


def tmux_capture(session):
    """Capture the current tmux pane content."""
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-S', '0', '-E', '30'],
        capture_output=True, text=True, check=True
    )
    return result.stdout


def capture_screen_lines(session):
    """Capture tmux screen as exactly 24 lines."""
    content = tmux_capture(session)
    lines = content.split('\n')
    while len(lines) < 24:
        lines.append('')
    return lines[:24]


def setup_chargen_home():
    """Set up HOME with minimal .nethackrc for interactive character creation.

    Unlike the standard setup_home(), this does NOT set role/race/gender/align,
    forcing the game to prompt for character selection interactively.
    """
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # Write minimal .nethackrc WITHOUT role/race/gender/align
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write('OPTIONS=name:Wizard\n')
        f.write('OPTIONS=!autopickup\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        f.write('OPTIONS=symset:DECgraphics\n')

    # Clean up stale game state (saves, locks, bones)
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
    if os.path.exists(dumpmap_file):
        os.unlink(dumpmap_file)

    tmux_send(session, '#', 0.1)
    time.sleep(0.1)
    tmux_send(session, 'dumpmap', 0.1)
    tmux_send_special(session, 'Enter', 0.3)

    # Clear any --More-- from dumpmap output (not recorded as session steps)
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


def generate_one(seed, role_key, race_key, gender_key, align_key, label):
    """Generate one chargen session for the given role configuration."""

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    setup_chargen_home()
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    tmpdir = tempfile.mkdtemp(prefix='webhack-chargen-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')

    session_name = f'webhack-chargen-{seed}-{os.getpid()}'

    try:
        cmd = (
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

        print(f'=== Chargen: seed={seed}, role={label} ===')

        # Capture initial screen before any keystrokes
        startup_screen = capture_screen_lines(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng = parse_rng_lines(startup_rng_lines)
        print(f'  Startup: {startup_rng_count} RNG calls')

        # Navigate character creation adaptively, recording each step
        steps = []
        prev_rng_count = startup_rng_count
        game_ready = False

        for attempt in range(80):
            try:
                content = tmux_capture(session_name)
            except subprocess.CalledProcessError:
                print(f'  [attempt {attempt}] tmux session died')
                break

            # Determine key to send based on screen content
            key = None
            action = None

            if 'Destroy old game' in content:
                key, action = 'y', 'destroy-old'
            elif 'keep the save file' in content or 'keep save' in content.lower():
                key, action = 'n', 'discard-save'
            elif 'Shall I pick' in content:
                key, action = 'n', 'decline-autopick'
            elif 'Pick a role' in content or 'pick a role' in content:
                key, action = role_key, 'pick-role'
            elif 'Pick a race' in content or 'pick a race' in content:
                key, action = race_key, 'pick-race'
            elif 'Pick a gender' in content or 'pick a gender' in content:
                key, action = gender_key, 'pick-gender'
            elif 'Pick an alignment' in content or 'pick an alignment' in content:
                key, action = align_key, 'pick-align'
            elif 'Is this ok?' in content:
                key, action = 'y', 'confirm-ok'
            elif '--More--' in content:
                key, action = ' ', 'more'
            elif 'tutorial' in content.lower():
                key, action = 'n', 'decline-tutorial'
            elif 'Dlvl:' in content or 'HP:' in content:
                game_ready = True
                break
            else:
                # Check for map characters as game-ready signal
                lines = content.strip().split('\n')
                if len(lines) > 5 and any('|' in l and '-' in l for l in lines[1:22]):
                    game_ready = True
                    break
                time.sleep(0.1)
                continue

            # Send the key
            if key == ' ':
                tmux_send_special(session_name, 'Space', 0.1)
            else:
                tmux_send(session_name, key, 0.1)

            # Wait for screen update, then capture state after the keystroke
            time.sleep(0.1)
            screen = capture_screen_lines(session_name)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            step = {
                'key': key,
                'action': action,
                'rng': rng_entries,
                'screen': screen,
            }
            steps.append(step)

            delta = rng_count - prev_rng_count
            print(f'  [{len(steps):02d}] key={key!r:3s} ({action:20s}) +{delta} RNG')
            prev_rng_count = rng_count

        if not game_ready:
            print(f'WARNING: game never reached ready state for {label}')
            quit_game(session_name)
            return

        # Game is ready — capture typGrid via #dumpmap (not recorded as steps)
        typ_grid = execute_dumpmap(session_name, dumpmap_file)
        if typ_grid:
            print(f'  typGrid: {len(typ_grid)}x{len(typ_grid[0])}')
        else:
            print(f'  WARNING: typGrid capture failed')

        # Send 'i' for inventory display
        tmux_send(session_name, 'i', 0.1)
        time.sleep(0.2)

        screen = capture_screen_lines(session_name)
        rng_count, rng_lines = read_rng_log(rng_log_file)
        delta_lines = rng_lines[prev_rng_count:rng_count]
        rng_entries = parse_rng_lines(delta_lines)

        inv_step = {
            'key': 'i',
            'action': 'inventory',
            'rng': rng_entries,
            'screen': screen,
        }
        if typ_grid:
            inv_step['typGrid'] = typ_grid
        steps.append(inv_step)

        delta = rng_count - prev_rng_count
        print(f'  [{len(steps):02d}] key="i" (inventory            ) +{delta} RNG')
        prev_rng_count = rng_count

        # Dismiss inventory pages (--More-- or (end))
        for _ in range(10):
            content = tmux_capture(session_name)
            if '--More--' in content or '(end)' in content:
                tmux_send_special(session_name, 'Space', 0.1)
                time.sleep(0.1)

                screen = capture_screen_lines(session_name)
                rng_count, rng_lines = read_rng_log(rng_log_file)
                delta_lines = rng_lines[prev_rng_count:rng_count]
                rng_entries = parse_rng_lines(delta_lines)

                steps.append({
                    'key': ' ',
                    'action': 'dismiss',
                    'rng': rng_entries,
                    'screen': screen,
                })

                delta = rng_count - prev_rng_count
                print(f'  [{len(steps):02d}] key=" " (dismiss              ) +{delta} RNG')
                prev_rng_count = rng_count
            else:
                break

        # Quit the game
        quit_game(session_name)

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)

    # Build session JSON
    character = {
        'name': 'Wizard',
        'role': ROLE_LABELS.get(role_key, role_key),
        'race': RACE_LABELS.get(race_key, race_key),
        'gender': GENDER_LABELS.get(gender_key, gender_key),
        'align': ALIGN_LABELS.get(align_key, align_key),
    }

    session_data = {
        'version': 1,
        'seed': int(seed),
        'type': 'chargen',
        'source': 'c',
        'wizard': True,
        'character': character,
        'startup': {
            'rngCalls': startup_rng_count,
            'rng': startup_rng,
            'screen': startup_screen,
        },
        'steps': steps,
    }

    filename = f'seed{seed}_chargen_{label.lower()}.session.json'
    filepath = os.path.join(SESSIONS_DIR, filename)
    with open(filepath, 'w') as f:
        f.write(compact_session_json(session_data))

    print(f'Wrote {filepath} ({len(steps)} steps)\n')


def load_seeds_config():
    """Load test/comparison/seeds.json configuration."""
    config_path = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'seeds.json')
    with open(config_path) as f:
        return json.load(f)


def main():
    if '--from-config' in sys.argv:
        config = load_seeds_config()
        chargen = config['chargen_seeds']
        seed = chargen['seed']
        print(f'Generating chargen sessions for seed {seed}\n')
        for entry in chargen['sessions']:
            generate_one(
                str(seed),
                entry['role'], entry['race'],
                entry['gender'], entry['align'],
                entry['label']
            )
        return

    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 6:
        print(f"Usage: {sys.argv[0]} <seed> <role> <race> <gender> <align> <label>")
        print(f"       {sys.argv[0]} --from-config")
        print(f"Example: {sys.argv[0]} 42 v h f n Valkyrie")
        sys.exit(1)

    generate_one(args[0], args[1], args[2], args[3], args[4], args[5])


if __name__ == '__main__':
    main()
