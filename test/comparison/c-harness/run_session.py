#!/usr/bin/env python3
"""Capture a C NetHack session as a self-contained JSON file.

Usage:
    # Gameplay session
    python3 run_session.py <seed> <output_json> [move_sequence]
    python3 run_session.py --from-config

    # Special level session (via #wizloaddes)
    python3 run_session.py <seed> <output_json> --wizload <level_name>

    # Character generation session
    python3 run_session.py <seed> <output_json> --chargen <selections>

    # Interface/menu capture session
    python3 run_session.py <seed> <output_json> --interface <keys>

Modes:
    Gameplay (default): plays through keystrokes, capturing RNG and screens.

    Wizload (--wizload): loads a special level via #wizloaddes command,
    capturing the level generation RNG, screen, typGrid, and checkpoints.

    Chargen (--chargen): captures character generation with manual selections.
    The selections string specifies role/race/gender/align choices, e.g.:
    "vhfn" = Valkyrie, human, female, neutral

    Interface (--interface): captures menu/UI interactions without gameplay.
    Use for options menus, help screens, inventory browsing, etc.

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
    python3 run_session.py 42 sessions/seed42_castle.session.json --wizload castle
    python3 run_session.py 42 sessions/seed42_chargen.session.json --chargen vhfn
    python3 run_session.py 42 sessions/seed42_options.session.json --interface 'O><q'
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
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')
DEFAULT_FIXED_DATETIME = '20000110090000'
import re

# Default character options (must match .nethackrc)
CHARACTER = {
    'name': 'Wizard',
    'role': 'Valkyrie',
    'race': 'human',
    'gender': 'female',
    'align': 'neutral',
}

# Named character presets
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

# Chargen selection key mappings
CHARGEN_ROLE_KEYS = {
    'a': 'Archeologist', 'b': 'Barbarian', 'c': 'Caveman',
    'h': 'Healer', 'k': 'Knight', 'm': 'Monk',
    'p': 'Priest', 'r': 'Rogue', 'R': 'Ranger',
    's': 'Samurai', 't': 'Tourist', 'v': 'Valkyrie', 'w': 'Wizard',
}
CHARGEN_RACE_KEYS = {'h': 'human', 'e': 'elf', 'd': 'dwarf', 'g': 'gnome', 'o': 'orc'}
CHARGEN_GENDER_KEYS = {'m': 'male', 'f': 'female'}
CHARGEN_ALIGN_KEYS = {'l': 'lawful', 'n': 'neutral', 'c': 'chaotic'}


def harness_fixed_datetime():
    dt = os.environ.get('NETHACK_FIXED_DATETIME')
    return DEFAULT_FIXED_DATETIME if dt is None else dt


def fixed_datetime_env():
    dt = harness_fixed_datetime()
    return f'NETHACK_FIXED_DATETIME={dt} ' if dt else ''


def optional_trace_env():
    """Pass-through for optional C-side trace toggles."""
    sort_rooms = os.environ.get('NETHACK_SORT_ROOMS_TRACE', '')
    return f'NETHACK_SORT_ROOMS_TRACE={sort_rooms} ' if sort_rooms else ''


def has_calendar_luck_warning(content):
    lowered = content.lower()
    return (
        'friday the 13th' in lowered
        or 'watch out!  bad things can happen' in lowered
        or 'full moon tonight' in lowered
    )


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


def setup_home(character=None):
    char = character or CHARACTER
    os.makedirs(RESULTS_DIR, exist_ok=True)
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write(f'OPTIONS=name:{char["name"]}\n')
        f.write(f'OPTIONS=race:{char["race"]}\n')
        f.write(f'OPTIONS=role:{char["role"]}\n')
        f.write(f'OPTIONS=gender:{char["gender"]}\n')
        f.write(f'OPTIONS=align:{char["align"]}\n')
        f.write('OPTIONS=!autopickup\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        f.write('OPTIONS=symset:DECgraphics\n')

    # Clean up stale game state to avoid prompts from previous crashed runs.
    # Remove: save files, level/lock files (e.g. 501wizard.0), and bones files.
    import glob
    save_dir = os.path.join(INSTALL_DIR, 'save')
    if os.path.isdir(save_dir):
        for f in glob.glob(os.path.join(save_dir, '*')):
            try:
                os.unlink(f)
            except FileNotFoundError:
                pass
    for f in glob.glob(os.path.join(INSTALL_DIR, '*wizard*')):
        if not f.endswith('.lua'):
            try:
                os.unlink(f)
            except FileNotFoundError:
                pass
    for f in glob.glob(os.path.join(INSTALL_DIR, '*Wizard*')):
        if not f.endswith('.lua'):
            try:
                os.unlink(f)
            except FileNotFoundError:
                pass
    for f in glob.glob(os.path.join(INSTALL_DIR, 'bon*')):
        try:
            os.unlink(f)
        except FileNotFoundError:
            pass


def read_rng_log(rng_log_file):
    """Read the RNG log file and return (count, lines)."""
    try:
        with open(rng_log_file) as f:
            lines = f.readlines()
        return len(lines), lines
    except FileNotFoundError:
        return 0, []


def parse_rng_lines(lines):
    """Convert raw RNG log lines to compact format: 'fn(arg)=result @ source:line'

    Mid-level function tracing lines (>entry/<exit from 005-midlog patch)
    are passed through unchanged.
    """
    entries = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Mid-level tracing: >funcname ... or <funcname ... — pass through as-is
        if line[0] in ('>', '<'):
            entries.append(line)
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


# === ANSI RLE Screen Compression ===

def compress_ansi_line(line):
    """Compress a single ANSI line by replacing runs of spaces with cursor codes.

    Uses ESC[nC (cursor forward n columns) only when it saves bytes:
    - ESC[5C is 4 bytes, 5 spaces is 5 bytes → saves 1 byte
    - ESC[4C is 4 bytes, 4 spaces is 4 bytes → no savings
    - ESC[10C is 5 bytes, 10 spaces is 10 bytes → saves 5 bytes

    Threshold: use cursor codes only for runs of 5+ spaces.
    """
    if not line:
        return ''

    result = []
    i = 0
    while i < len(line):
        # Check for run of spaces
        if line[i] == ' ':
            run_start = i
            while i < len(line) and line[i] == ' ':
                i += 1
            run_len = i - run_start

            # Use cursor forward for runs of 5+ spaces (actually saves bytes)
            # ESC[NC is 4 bytes for N<10, 5 bytes for N>=10
            # So: 5 spaces (5 bytes) vs ESC[5C (4 bytes) → save 1 byte
            if run_len >= 5:
                result.append(f'\x1b[{run_len}C')
            else:
                result.append(' ' * run_len)
        else:
            result.append(line[i])
            i += 1

    return ''.join(result)


def encode_screen_ansi_rle(lines):
    """Encode entire screen (list of lines) as single string with ANSI RLE compression.

    Each line is compressed to remove trailing spaces and compress internal space runs.
    Lines are joined with newlines. The result is a single string.
    """
    if not lines:
        return ''

    compressed_lines = []
    for line in lines:
        # Strip trailing spaces (they're implicit)
        stripped = line.rstrip(' ')
        # Compress internal space runs
        compressed = compress_ansi_line(stripped)
        compressed_lines.append(compressed)

    # Remove trailing empty lines
    while compressed_lines and not compressed_lines[-1]:
        compressed_lines.pop()

    return '\n'.join(compressed_lines)


# === typGrid RLE Encoding ===

def typ_to_char(typ):
    """Convert terrain type (0-35) to single character.

    0-9 -> '0'-'9'
    10-35 -> 'a'-'z'
    """
    if typ < 0 or typ > 35:
        return '?'
    if typ < 10:
        return str(typ)
    return chr(ord('a') + typ - 10)


def encode_typgrid_row_rle(row, row_width=80):
    """Encode a single typGrid row using run-length encoding.

    Returns a string like "3:0,p,5:p" where:
    - Segments are count:char (or just char if count is 1)
    - Trailing zeros are omitted (assumed to fill to row_width)
    - All-zero rows return ""
    """
    if not row:
        return ""

    segments = []
    current_val = row[0]
    count = 1

    for val in row[1:]:
        if val == current_val:
            count += 1
        else:
            segments.append((count, current_val))
            current_val = val
            count = 1
    segments.append((count, current_val))

    # Remove trailing zero segments
    while segments and segments[-1][1] == 0:
        segments.pop()

    if not segments:
        return ""

    def fmt(c, v):
        char = typ_to_char(v)
        return char if c == 1 else f"{c}:{char}"

    return ",".join(fmt(c, v) for c, v in segments)


def encode_typgrid_rle(grid):
    """Encode entire typGrid (list of rows) using RLE.

    Returns a single string with rows separated by '|'.
    """
    return "|".join(encode_typgrid_row_rle(row) for row in grid)


# === Screen Capture Functions ===

def capture_screen_lines(session):
    """Capture tmux screen and return as list of 24 lines."""
    content = tmux_capture(session)
    lines = content.split('\n')
    # Pad or trim to exactly 24 lines
    while len(lines) < 24:
        lines.append('')
    return lines[:24]


def capture_screen_ansi_lines(session):
    """Capture tmux screen with ANSI escapes preserved; return as 24 lines."""
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-e', '-J', '-S', '0', '-E', '30'],
        capture_output=True, text=True, check=True
    )
    lines = result.stdout.split('\n')
    while len(lines) < 24:
        lines.append('')
    return lines[:24]


def capture_screen_compressed(session):
    """Capture tmux screen and return as single ANSI-RLE compressed string."""
    lines = capture_screen_ansi_lines(session)
    return encode_screen_ansi_rle(lines)


def capture_screen_payload(session, include_ansi=False):
    payload = {
        'screen': capture_screen_lines(session)
    }
    if include_ansi:
        payload['screenAnsi'] = capture_screen_ansi_lines(session)
    return payload


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


def read_checkpoint_entries(checkpoint_file, start_index=0):
    """Read JSONL checkpoint entries from checkpoint_file starting at start_index."""
    if not checkpoint_file or not os.path.exists(checkpoint_file):
        return [], start_index

    entries = []
    next_index = int(start_index)
    with open(checkpoint_file, 'r', encoding='utf-8', errors='ignore') as f:
        for idx, line in enumerate(f):
            if idx < int(start_index):
                continue
            next_index = idx + 1
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    return entries, next_index


def execute_wizload(session, level_name, steps, rng_log_file, verbose=False):
    """Execute #wizloaddes to load a special level, recording steps.

    Returns (success, rng_call_start) tuple.
    rng_call_start is the RNG call count just before level loading began.
    """
    if verbose:
        print(f'  [wizloaddes] Loading {level_name}.lua')

    # Record # keystroke
    tmux_send(session, '#', 0.2)
    steps.append({
        'key': '#',
        'action': 'extended-command',
        'rng': [],
        'screen': capture_screen_compressed(session),
    })

    # Type wizloaddes
    tmux_send(session, 'wizloaddes', 0.2)
    steps.append({
        'key': 'wizloaddes',
        'action': 'command-text',
        'rng': [],
        'screen': capture_screen_compressed(session),
    })

    # Press Enter
    tmux_send_special(session, 'Enter', 0.3)
    steps.append({
        'key': '\\r',
        'action': 'command-confirm',
        'rng': [],
        'screen': capture_screen_compressed(session),
    })

    # Wait for and handle the file prompt
    rng_call_start = None
    for _ in range(30):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            return False, None
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.2)
            continue
        if 'Load which des lua file?' in content:
            rng_call_start = get_rng_call_count(rng_log_file)
            break
        time.sleep(0.02)
    else:
        if verbose:
            print(f'  [wizloaddes] WARNING: no file prompt for {level_name}')
        return False, None

    # Type level name
    tmux_send(session, level_name, 0.2)
    steps.append({
        'key': level_name,
        'action': 'level-name',
        'rng': [],
        'screen': capture_screen_compressed(session),
    })

    # Press Enter to load
    tmux_send_special(session, 'Enter', 0.5)

    # Wait for level to load
    for _ in range(60):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            return False, None
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.2)
            continue
        # A settled status line with Dlvl indicates map is ready
        if 'Dlvl:' in content:
            return True, rng_call_start
        time.sleep(0.02)

    if verbose:
        print(f'  [wizloaddes] WARNING: timeout waiting for level load of {level_name}')
    return False, None


def get_rng_call_count(rng_log_file):
    """Return the last RNG call number from an RNG log file, or None."""
    if not rng_log_file or not os.path.exists(rng_log_file):
        return None
    last = None
    with open(rng_log_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            m = re.match(r'^\s*(\d+)\s+', line)
            if m:
                last = int(m.group(1))
    return last


def execute_dumpmap(session, dumpmap_file):
    """Execute #dumpmap and read the resulting grid."""
    # Remove old dumpmap file
    if os.path.exists(dumpmap_file):
        os.unlink(dumpmap_file)

    tmux_send(session, '#', 0.1)
    time.sleep(0.02)
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
        time.sleep(0.02)

    time.sleep(0.02)
    return read_typ_grid(dumpmap_file)


# Counter for tracking clear_more_prompts activity
_clear_more_stats = {'cleared': 0, 'calls': 0}

def clear_more_prompts(session, max_iterations=10):
    global _clear_more_stats
    _clear_more_stats['calls'] += 1
    content = ''
    for _ in range(max_iterations):
        time.sleep(0.02)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if '--More--' in content:
            _clear_more_stats['cleared'] += 1
            tmux_send_special(session, 'Space', 0.1)
        elif 'Die?' in content:
            # Wizard mode death: answer 'n' to resurrect
            tmux_send(session, 'n', 0.1)
            print('  [WIZARD] Died and resurrected')
        else:
            break
    return content

def get_clear_more_stats():
    return _clear_more_stats.copy()

def reset_clear_more_stats():
    global _clear_more_stats
    _clear_more_stats = {'cleared': 0, 'calls': 0}


def wait_for_game_ready(session, rng_log_file):
    """Navigate startup prompts until the game is ready."""
    for attempt in range(60):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            print(f'[startup-{attempt}] tmux session died')
            break

        rng_count, _ = read_rng_log(rng_log_file)

        if has_calendar_luck_warning(content) and harness_fixed_datetime():
            raise RuntimeError(
                'Calendar luck warning appeared despite fixed datetime; '
                'verify fixed datetime injection and C binary patch install.'
            )

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
            print(f'  [startup-{attempt}] rng={rng_count} GAME READY')
            break

        lines = content.strip().split('\n')
        if len(lines) > 5 and any('|' in line and '-' in line for line in lines[1:22]):
            print(f'  [startup-{attempt}] rng={rng_count} GAME READY (map detected)')
            break

        if attempt > 2:
            tmux_send_special(session, 'Space', 0.1)
        else:
            time.sleep(0.02)


def describe_key(key):
    names = {
        'h': 'move-west', 'j': 'move-south', 'k': 'move-north', 'l': 'move-east',
        'y': 'move-nw', 'u': 'move-ne', 'b': 'move-sw', 'n': 'move-se',
        '.': 'wait', 's': 'search', ',': 'pickup', 'i': 'inventory',
        ':': 'look', '@': 'autopickup-toggle', '>': 'descend', '<': 'ascend',
    }
    return names.get(key, f'key-{key}')

# Multi-key commands: first char triggers a prompt, second char is the response.
# These are encoded as two chars in the move string.
# w<x> = wield item x, W<x> = wear item x, T<x> = takeoff item x,
# e<x> = eat item x, q<x> = quaff item x, d<x> = drop item x,
# r<x> = read item x, a<x> = apply item x,
# P<x> = put on item x, R<x> = remove item x
ITEM_COMMANDS = {
    'w': 'wield', 'W': 'wear', 'T': 'takeoff',
    'e': 'eat', 'q': 'quaff', 'd': 'drop',
    'r': 'read', 'a': 'apply',
    'P': 'puton', 'R': 'remove',
}

# Three-key commands: command + item + direction.
# z<item><dir> = zap wand in direction, t<item><dir> = throw item in direction
ITEM_DIRECTION_COMMANDS = {
    'z': 'zap', 't': 'throw',
}

# Direction commands: first char is the command, second char is the direction.
# o<dir> = open door, c<dir> = close door
DIRECTION_COMMANDS = {
    'o': 'open', 'c': 'close',
}


def parse_moves(move_str):
    moves = []
    i = 0
    while i < len(move_str):
        ch = move_str[i]
        # Escaped byte form from session key concatenation (e.g. "\\x01")
        if ch == '\\' and i + 3 < len(move_str) and move_str[i + 1] == 'x':
            hex_part = move_str[i + 2:i + 4]
            try:
                code = int(hex_part, 16)
                decoded = chr(code)
                if 1 <= code <= 26:
                    moves.append((decoded, f'key-ctrl-{chr(code + 96)}'))
                elif code == 27:
                    moves.append((decoded, 'key-escape'))
                elif code in (10, 13):
                    moves.append((decoded, 'key-enter'))
                else:
                    moves.append((decoded, f'keycode-{code}'))
                i += 4
                continue
            except ValueError:
                pass
        if ch == 'F' and i + 1 < len(move_str):
            moves.append(('F' + move_str[i+1], f'fight-{describe_key(move_str[i+1])}'))
            i += 2
        elif ch == '^' and i + 1 < len(move_str) and i + 2 < len(move_str):
            # ^X<dir> = ctrl-X + direction (e.g., ^Dh = kick west)
            ctrl_ch = chr(ord(move_str[i+1]) & 0x1f)  # ctrl version
            dir_ch = move_str[i+2]
            ctrl_name = f'ctrl-{move_str[i+1]}'
            moves.append((ctrl_ch + dir_ch, f'{ctrl_name}-{describe_key(dir_ch)}'))
            i += 3
        elif ch in ITEM_DIRECTION_COMMANDS and i + 2 < len(move_str):
            # z<item><dir> = zap, t<item><dir> = throw
            item_ch = move_str[i+1]
            dir_ch = move_str[i+2]
            cmd_name = ITEM_DIRECTION_COMMANDS[ch]
            moves.append((ch + item_ch + dir_ch, f'{cmd_name}-{item_ch}-{describe_key(dir_ch)}'))
            i += 3
        elif ch in DIRECTION_COMMANDS and i + 1 < len(move_str):
            dir_ch = move_str[i+1]
            # Only treat as direction command if next char is actually a direction
            if dir_ch in 'hjklyubn':
                cmd_name = DIRECTION_COMMANDS[ch]
                moves.append((ch + dir_ch, f'{cmd_name}-{describe_key(dir_ch)}'))
                i += 2
            else:
                # Next char is not a direction, treat as single key
                moves.append((ch, describe_key(ch)))
                i += 1
        elif ch in ITEM_COMMANDS and i + 1 < len(move_str):
            item_ch = move_str[i+1]
            # Only treat as item command if next char looks like an item letter
            if item_ch.isalpha() or item_ch in '$*':
                cmd_name = ITEM_COMMANDS[ch]
                moves.append((ch + item_ch, f'{cmd_name}-{item_ch}'))
                i += 2
            else:
                # Next char is not an item, treat as single key
                moves.append((ch, describe_key(ch)))
                i += 1
        else:
            moves.append((move_str[i], describe_key(move_str[i])))
            i += 1
    return moves


def detect_depth(screen_lines):
    """Parse level indicator from the status lines to detect level changes.

    Returns a string like 'Dlvl:3', 'Mines:2', 'Quest:1', 'Sokoban:4', etc.
    This allows detecting level changes across all dungeon branches.
    """
    import re
    for line in screen_lines[22:24]:
        # Match various level indicators: Dlvl:N, Mines:N, Quest:N, etc.
        # Also handles End Game and other special areas
        m = re.search(r'(Dlvl|Mines|Sokoban|Quest|Astral|Fort Ludios|Vlad\'s Tower|Air|Earth|Fire|Water):\s*(\d+)', line)
        if m:
            return f'{m.group(1)}:{m.group(2)}'
        # Handle End Game specially
        if 'End Game' in line:
            return 'End Game'
    return 'Dlvl:1'


def quit_game(session):
    tmux_send(session, '#', 0.1)
    time.sleep(0.02)
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
        time.sleep(0.02)
    time.sleep(0.02)


def compact_session_json(session_data):
    """Serialize session to JSON with newlines but no indentation.

    Format:
    - Top-level keys on separate lines
    - Each step on its own line
    - Arrays (like rng) stay compact

    Uses ensure_ascii=True for portability (escapes all non-ASCII as \\uXXXX).
    """
    lines = ['{']

    keys = list(session_data.keys())
    for i, key in enumerate(keys):
        value = session_data[key]
        comma = ',' if i < len(keys) - 1 else ''

        if key == 'steps':
            # Steps array: one step per line
            lines.append(f'"{key}":[')
            steps = value
            for j, step in enumerate(steps):
                step_comma = ',' if j < len(steps) - 1 else ''
                lines.append(json.dumps(step, ensure_ascii=True) + step_comma)
            lines.append(']' + comma)
        else:
            # Other keys: compact on one line
            lines.append(f'"{key}":{json.dumps(value, ensure_ascii=True)}{comma}')

    lines.append('}')
    return '\n'.join(lines) + '\n'


def load_seeds_config():
    """Load test/comparison/seeds.json configuration."""
    config_path = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'seeds.json')
    with open(config_path) as f:
        return json.load(f)


def run_wizload_session(seed, output_json, level_name, verbose=False):
    """Capture a special level session using #wizloaddes."""
    output_json = os.path.abspath(output_json)

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    setup_home()

    # Temp files for RNG log, dumpmap, and checkpoints
    tmpdir = tempfile.mkdtemp(prefix='webhack-wizload-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')
    checkpoint_file = os.path.join(tmpdir, 'checkpoints.jsonl')

    session_name = f'webhack-wizload-{seed}-{os.getpid()}'

    try:
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'{fixed_datetime_env()}'
            f'{optional_trace_env()}'
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'NETHACK_DUMPMAP={dumpmap_file} '
            f'NETHACK_DUMPSNAP={checkpoint_file} '
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

        print(f'=== Capturing wizload session: seed={seed}, level={level_name} ===')
        print(f'=== STARTUP ===')
        wait_for_game_ready(session_name, rng_log_file)
        time.sleep(0.02)
        clear_more_prompts(session_name)
        time.sleep(0.02)

        # Capture startup state
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        print(f'Startup: {startup_rng_count} RNG calls')

        startup_screen_compressed = capture_screen_compressed(session_name)

        # Build session object (unified format v3)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)
        startup_actual_rng = sum(1 for e in startup_rng_entries if e[0] not in ('>', '<'))

        # Build startup step (first step with no key)
        startup_step = {
            'key': None,
            'action': 'startup',
            'rng': startup_rng_entries,
            'screen': startup_screen_compressed,
        }

        session_data = {
            'version': 3,
            'seed': seed,
            'source': 'c',
            'regen': {
                'mode': 'wizload',
                'level': level_name,
            },
            'options': {
                'name': CHARACTER['name'],
                'role': CHARACTER['role'],
                'race': CHARACTER['race'],
                'gender': CHARACTER['gender'],
                'align': CHARACTER['align'],
                'wizard': True,
                'symset': 'DECgraphics',
                'autopickup': False,
                'pickup_types': '',
            },
            'steps': [startup_step],
        }

        print(f'\n=== WIZLOAD ({level_name}) ===')

        # Execute wizload, collecting steps
        steps = session_data['steps']
        checkpoint_cursor = 0
        ok, rng_call_start = execute_wizload(
            session_name, level_name, steps, rng_log_file, verbose
        )

        if not ok:
            print(f'ERROR: wizload failed for {level_name}')
            sys.exit(1)

        # Clear any --More-- prompts
        clear_more_prompts(session_name)

        # Capture typGrid via #dumpmap
        typ_grid = execute_dumpmap(session_name, dumpmap_file)
        clear_more_prompts(session_name)

        if typ_grid:
            print(f'typGrid: {len(typ_grid)}x{len(typ_grid[0])} captured')
        else:
            print('WARNING: Failed to capture typGrid')

        # Read checkpoints
        checkpoints, checkpoint_cursor = read_checkpoint_entries(checkpoint_file, 0)
        if checkpoints:
            # Convert checkpoint grids to RLE format
            for cp in checkpoints:
                for grid_key in ('typGrid', 'flagGrid', 'wallInfoGrid'):
                    if grid_key in cp and isinstance(cp[grid_key], list):
                        cp[grid_key] = encode_typgrid_rle(cp[grid_key])
            print(f'Checkpoints: {len(checkpoints)} captured')

        # Read RNG log from wizload start
        final_rng_count, final_rng_lines = read_rng_log(rng_log_file)
        delta_lines = final_rng_lines[startup_rng_count:final_rng_count]
        rng_entries = parse_rng_lines(delta_lines)

        # Add final step with level data
        final_screen = capture_screen_compressed(session_name)
        final_step = {
            'key': '\\r',
            'action': f'load-{level_name}',
            'rng': rng_entries,
            'screen': final_screen,
        }
        if typ_grid:
            final_step['typGrid'] = encode_typgrid_rle(typ_grid)
        if checkpoints:
            final_step['checkpoints'] = checkpoints
        steps.append(final_step)

        # Quit the game cleanly
        quit_game(session_name)

        # Write JSON
        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            f.write(compact_session_json(session_data))

        # Summary
        print(f'\n=== DONE ===')
        print(f'Session: {output_json}')
        print(f'Steps: {len(steps)}, Level RNG calls: {len(rng_entries)}')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def run_chargen_session(seed, output_json, selections, tutorial_response='n', verbose=False):
    """Capture a character generation session with manual selections.

    selections is a string like "vhfn" meaning:
    - v = Valkyrie (role)
    - h = human (race)
    - f = female (gender)
    - n = neutral (alignment)
    tutorial_response controls the tutorial prompt answer ('y' or 'n').
    """
    output_json = os.path.abspath(output_json)

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        sys.exit(1)

    # Create minimal .nethackrc without preset selections
    os.makedirs(RESULTS_DIR, exist_ok=True)
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write('OPTIONS=name:Wizard\n')
        f.write('OPTIONS=!autopickup\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        f.write('OPTIONS=symset:DECgraphics\n')

    # Clean up stale game state to force fresh character creation
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

    tmpdir = tempfile.mkdtemp(prefix='webhack-chargen-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    session_name = f'webhack-chargen-{seed}-{os.getpid()}'

    try:
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'{fixed_datetime_env()}'
            f'{optional_trace_env()}'
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

        print(f'=== Capturing chargen session: seed={seed}, selections="{selections}" ===')

        # Wait briefly for initial screen
        time.sleep(0.5)

        # Capture initial startup state (first step with no key)
        startup_screen = capture_screen_compressed(session_name)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        steps = [{
            'key': None,
            'action': 'startup',
            'rng': startup_rng_entries,
            'screen': startup_screen,
        }]
        prev_rng_count = startup_rng_count

        # Track actual selections for session metadata
        selected = {'role': None, 'race': None, 'gender': None, 'align': None}

        # Process character generation prompts
        selection_idx = 0
        tutorial_prompt_handled = False
        for attempt in range(100):
            time.sleep(0.02)
            try:
                content = tmux_capture(session_name)
            except subprocess.CalledProcessError:
                break

            screen = capture_screen_compressed(session_name)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            if '--More--' in content:
                steps.append({
                    'key': ' ',
                    'action': 'more-prompt',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send_special(session_name, 'Space', 0.1)
                prev_rng_count = rng_count
                continue

            if 'Shall I pick' in content:
                steps.append({
                    'key': 'n',
                    'action': 'decline-autopick',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send(session_name, 'n', 0.1)
                prev_rng_count = rng_count
                continue

            if 'Pick a role' in content or 'pick a role' in content:
                key = selections[selection_idx] if selection_idx < len(selections) else 'v'
                selected['role'] = CHARGEN_ROLE_KEYS.get(key, key)
                steps.append({
                    'key': key,
                    'action': 'select-role',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send(session_name, key, 0.1)
                selection_idx += 1
                prev_rng_count = rng_count
                continue

            if 'Pick a race' in content or 'pick a race' in content:
                key = selections[selection_idx] if selection_idx < len(selections) else 'h'
                selected['race'] = CHARGEN_RACE_KEYS.get(key, key)
                steps.append({
                    'key': key,
                    'action': 'select-race',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send(session_name, key, 0.1)
                selection_idx += 1
                prev_rng_count = rng_count
                continue

            if 'Pick a gender' in content or 'pick a gender' in content:
                key = selections[selection_idx] if selection_idx < len(selections) else 'f'
                selected['gender'] = CHARGEN_GENDER_KEYS.get(key, key)
                steps.append({
                    'key': key,
                    'action': 'select-gender',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send(session_name, key, 0.1)
                selection_idx += 1
                prev_rng_count = rng_count
                continue

            if 'Pick an alignment' in content or 'pick an alignment' in content:
                key = selections[selection_idx] if selection_idx < len(selections) else 'n'
                selected['align'] = CHARGEN_ALIGN_KEYS.get(key, key)
                steps.append({
                    'key': key,
                    'action': 'select-alignment',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send(session_name, key, 0.1)
                selection_idx += 1
                prev_rng_count = rng_count
                continue

            if 'Is this ok?' in content:
                steps.append({
                    'key': 'y',
                    'action': 'confirm-character',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send(session_name, 'y', 0.1)
                prev_rng_count = rng_count
                continue

            if (not tutorial_prompt_handled) and ('Do you want a tutorial?' in content):
                tkey = tutorial_response if tutorial_response in ('y', 'n') else 'n'
                steps.append({
                    'key': tkey,
                    'action': 'accept-tutorial' if tkey == 'y' else 'decline-tutorial',
                    'rng': rng_entries,
                    'screen': screen,
                })
                tmux_send(session_name, tkey, 0.1)
                prev_rng_count = rng_count
                tutorial_prompt_handled = True
                continue

            # Game ready - capture final state
            if 'Dlvl:' in content or 'St:' in content:
                steps.append({
                    'key': '',
                    'action': 'game-ready',
                    'rng': rng_entries,
                    'screen': screen,
                })
                prev_rng_count = rng_count
                print(f'  Game ready after {len(steps)} steps, {rng_count} RNG calls')
                break

        # Capture inventory after game start
        time.sleep(0.02)
        tmux_send(session_name, 'i', 0.2)
        time.sleep(0.02)
        screen = capture_screen_compressed(session_name)
        rng_count, rng_lines = read_rng_log(rng_log_file)
        delta_lines = rng_lines[prev_rng_count:rng_count]
        rng_entries = parse_rng_lines(delta_lines)
        steps.append({
            'key': 'i',
            'action': 'inventory',
            'rng': rng_entries,
            'screen': screen,
        })
        prev_rng_count = rng_count
        print(f'  Inventory captured')

        # Dismiss inventory menu
        for _ in range(10):
            try:
                content = tmux_capture(session_name)
            except subprocess.CalledProcessError:
                break
            if '--More--' in content or '(end)' in content:
                tmux_send_special(session_name, 'Space', 0.1)
                time.sleep(0.02)
            else:
                break

        # Build options with character selections
        options = {
            'name': 'Wizard',
            'wizard': True,
            'symset': 'DECgraphics',
            'autopickup': False,
        }
        if selected['role']:
            options['role'] = selected['role']
        if selected['race']:
            options['race'] = selected['race']
        if selected['gender']:
            options['gender'] = selected['gender']
        if selected['align']:
            options['align'] = selected['align']

        session_data = {
            'version': 3,
            'seed': seed,
            'source': 'c',
            'type': 'chargen',
            'regen': {
                'mode': 'chargen',
                'selections': selections,
                'tutorial': tutorial_response,
            },
            'options': options,
            'steps': steps,
        }

        # Quit the game
        quit_game(session_name)

        # Write JSON
        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f'\n=== DONE ===')
        print(f'Session: {output_json}')
        print(f'Steps: {len(steps)}')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def run_interface_session(seed, output_json, keys, verbose=False):
    """Capture an interface/menu session by sending a sequence of keys.

    This captures each keystroke with the resulting screen state,
    useful for testing menu rendering, options, help screens, etc.
    """
    output_json = os.path.abspath(output_json)

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        sys.exit(1)

    setup_home()

    tmpdir = tempfile.mkdtemp(prefix='webhack-interface-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    session_name = f'webhack-interface-{seed}-{os.getpid()}'

    try:
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'{fixed_datetime_env()}'
            f'{optional_trace_env()}'
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
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

        print(f'=== Capturing interface session: seed={seed}, keys="{keys}" ===')
        print(f'=== STARTUP ===')
        wait_for_game_ready(session_name, rng_log_file)
        time.sleep(0.02)
        clear_more_prompts(session_name)
        time.sleep(0.02)

        # Capture startup state
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        print(f'Startup: {startup_rng_count} RNG calls')

        startup_screen = capture_screen_compressed(session_name)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)

        # Build startup step (first step with no key)
        startup_step = {
            'key': None,
            'action': 'startup',
            'rng': startup_rng_entries,
            'screen': startup_screen,
        }

        session_data = {
            'version': 3,
            'seed': seed,
            'source': 'c',
            'type': 'interface',
            'regen': {
                'mode': 'interface',
                'keys': keys,
            },
            'options': {
                'name': CHARACTER['name'],
                'role': CHARACTER['role'],
                'race': CHARACTER['race'],
                'gender': CHARACTER['gender'],
                'align': CHARACTER['align'],
                'wizard': True,
                'symset': 'DECgraphics',
                'autopickup': False,
            },
            'steps': [startup_step],
        }

        print(f'\n=== INTERFACE ({len(keys)} keys) ===')

        # Send each key and capture screen
        prev_rng_count = startup_rng_count
        for i, key in enumerate(keys):
            # Handle special key encodings
            if key == '^' and i + 1 < len(keys):
                # Ctrl+X encoded as ^X
                ctrl_char = keys[i + 1]
                continue  # Will be handled in next iteration
            if i > 0 and keys[i - 1] == '^':
                # This is the character after ^, send as Ctrl
                tmux_send_special(session_name, f'C-{key}', 0.2)
                action = f'ctrl-{key}'
            elif key == '\\' and i + 1 < len(keys) and keys[i + 1] == 'r':
                tmux_send_special(session_name, 'Enter', 0.2)
                action = 'enter'
                continue
            elif key == ' ':
                tmux_send_special(session_name, 'Space', 0.2)
                action = 'space'
            elif key == '\x1b' or key == 'ESC':
                tmux_send_special(session_name, 'Escape', 0.2)
                action = 'escape'
            else:
                tmux_send(session_name, key, 0.2)
                action = describe_key(key) if key in 'hjklyubn.<>:@,' else f'key-{key}'

            time.sleep(0.02)
            clear_more_prompts(session_name)

            screen = capture_screen_compressed(session_name)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            step = {
                'key': key,
                'action': action,
                'rng': rng_entries,
                'screen': screen,
            }
            session_data['steps'].append(step)
            prev_rng_count = rng_count

            print(f'  [{i+1:03d}] {repr(key):5s} ({action:20s}) +{len(rng_entries):4d} RNG')

        # Quit the game
        quit_game(session_name)

        # Write JSON
        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            f.write(compact_session_json(session_data))

        print(f'\n=== DONE ===')
        print(f'Session: {output_json}')
        print(f'Steps: {len(session_data["steps"])}')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def run_session_entry(entry, sessions_dir):
    """Run a single session recording (used for parallel execution)."""
    import copy
    seed = entry['seed']
    moves = entry['moves']
    label = entry.get('label', '')
    suffix = f'_{label}_gameplay' if label else '_gameplay'
    output = os.path.join(sessions_dir, f'seed{seed}{suffix}.session.json')
    # Apply character preset if specified
    char = copy.copy(CHARACTER_PRESETS.get('valkyrie', {}))
    if 'character' in entry:
        preset = entry['character'].lower()
        if preset in CHARACTER_PRESETS:
            char = copy.copy(CHARACTER_PRESETS[preset])
    # Update global CHARACTER for this process
    CHARACTER.clear()
    CHARACTER.update(char)
    print(f'\n=== Regenerating session seed={seed}{suffix} ===')
    run_session(seed, output, moves)
    return f'seed{seed}{suffix}'


def main():
    if '--from-config' in sys.argv:
        from concurrent.futures import ProcessPoolExecutor, as_completed
        import multiprocessing

        config = load_seeds_config()
        sessions_dir = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
        entries = config['session_seeds']['sessions']

        # Check for --parallel flag
        parallel = '--parallel' in sys.argv
        max_workers = 4 if parallel else 1

        if parallel:
            print(f'Running {len(entries)} sessions in parallel with {max_workers} workers')
            with ProcessPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(run_session_entry, entry, sessions_dir): entry for entry in entries}
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        print(f'=== Completed: {result} ===')
                    except Exception as e:
                        entry = futures[future]
                        print(f'=== Failed: seed{entry["seed"]} - {e} ===')
        else:
            for entry in entries:
                run_session_entry(entry, sessions_dir)
        return

    # Parse command-line flags
    args = list(sys.argv[1:])
    verbose = '--verbose' in args or os.environ.get('WEBHACK_DEBUG', '')
    args = [a for a in args if a != '--verbose']

    # Parse --character <preset> flag
    if '--character' in args:
        idx = args.index('--character')
        preset = args[idx + 1].lower()
        if preset not in CHARACTER_PRESETS:
            print(f"Unknown character preset: {preset}")
            print(f"Available: {', '.join(CHARACTER_PRESETS.keys())}")
            sys.exit(1)
        CHARACTER.update(CHARACTER_PRESETS[preset])
        args = args[:idx] + args[idx+2:]

    # Parse --wizload <level_name> flag
    wizload_level = None
    if '--wizload' in args:
        idx = args.index('--wizload')
        if idx + 1 >= len(args):
            print("Error: --wizload requires a level name")
            sys.exit(1)
        wizload_level = args[idx + 1]
        args = args[:idx] + args[idx+2:]

    # Parse --chargen <selections> flag
    chargen_selections = None
    if '--chargen' in args:
        idx = args.index('--chargen')
        if idx + 1 >= len(args):
            print("Error: --chargen requires selections (e.g., 'vhfn')")
            sys.exit(1)
        chargen_selections = args[idx + 1]
        args = args[:idx] + args[idx+2:]

    # Parse --tutorial <y|n> flag (used with --chargen)
    tutorial_response = 'n'
    if '--tutorial' in args:
        idx = args.index('--tutorial')
        if idx + 1 >= len(args):
            print("Error: --tutorial requires y or n")
            sys.exit(1)
        tutorial_response = str(args[idx + 1]).strip().lower()
        if tutorial_response not in ('y', 'n'):
            print("Error: --tutorial must be 'y' or 'n'")
            sys.exit(1)
        args = args[:idx] + args[idx+2:]

    # Parse --interface <keys> flag
    interface_keys = None
    if '--interface' in args:
        idx = args.index('--interface')
        if idx + 1 >= len(args):
            print("Error: --interface requires keys (e.g., 'O><q')")
            sys.exit(1)
        interface_keys = args[idx + 1]
        args = args[:idx] + args[idx+2:]

    # Parse --raw-moves flag
    raw_moves = '--raw-moves' in args
    if raw_moves:
        args.remove('--raw-moves')

    # Parse character override flags
    char_override = None
    if '--role' in args:
        idx = args.index('--role')
        role = args[idx + 1]
        char_override = char_override or CHARACTER.copy()
        char_override['role'] = role
        args = args[:idx] + args[idx+2:]
    if '--name' in args:
        idx = args.index('--name')
        name = args[idx + 1]
        char_override = char_override or CHARACTER.copy()
        char_override['name'] = name
        args = args[:idx] + args[idx+2:]

    if len(args) < 2:
        print(f"Usage: {sys.argv[0]} <seed> <output_json> [move_sequence] [--character <preset>]")
        print(f"       {sys.argv[0]} <seed> <output_json> --wizload <level_name>")
        print(f"       {sys.argv[0]} <seed> <output_json> --chargen <selections> [--tutorial y|n]")
        print(f"       {sys.argv[0]} <seed> <output_json> --interface <keys>")
        print(f"       {sys.argv[0]} --from-config")
        print(f"Options:")
        print(f"  --raw-moves: Moves include --More-- responses (from keylog)")
        print(f"Character presets: {', '.join(CHARACTER_PRESETS.keys())} (default: valkyrie)")
        print(f"Example: {sys.argv[0]} 42 sessions/seed42.session.json ':hhlhhhh.hhs'")
        print(f"Example: {sys.argv[0]} 42 sessions/seed42_castle.session.json --wizload castle")
        print(f"Example: {sys.argv[0]} 42 sessions/seed42_chargen.session.json --chargen vhfn")
        print(f"Example: {sys.argv[0]} 42 sessions/seed42_chargen_tut.session.json --chargen vhfn --tutorial y")
        print(f"Example: {sys.argv[0]} 42 sessions/seed42_options.session.json --interface 'O><q'")
        sys.exit(1)

    seed = int(args[0])
    output_json = os.path.abspath(args[1])

    if wizload_level:
        run_wizload_session(seed, output_json, wizload_level, verbose)
    elif chargen_selections:
        run_chargen_session(seed, output_json, chargen_selections, tutorial_response, verbose)
    elif interface_keys:
        run_interface_session(seed, output_json, interface_keys, verbose)
    else:
        move_str = args[2] if len(args) >= 3 else '...........'
        run_session(seed, output_json, move_str, raw_moves=raw_moves, character=char_override)


def run_session(seed, output_json, move_str, raw_moves=False, character=None):
    """Run a session replaying the given move string.

    Args:
        seed: Game seed
        output_json: Output file path
        move_str: String of moves to replay
        raw_moves: If True, moves include --More-- responses (from keylog).
                   If False, clear_more_prompts is called after each move.
        character: Character config dict (name, role, race, gender, align).
                   Uses default CHARACTER if None.
    """
    char = character or CHARACTER
    output_json = os.path.abspath(output_json)

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        print(f"Run setup.sh first: bash {os.path.join(SCRIPT_DIR, 'setup.sh')}")
        sys.exit(1)

    setup_home(char)

    # Temp files for RNG log and dumpmap
    tmpdir = tempfile.mkdtemp(prefix='webhack-session-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')

    session_name = f'webhack-session-{seed}-{os.getpid()}'

    try:
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'{fixed_datetime_env()}'
            f'{optional_trace_env()}'
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'NETHACK_DUMPMAP={dumpmap_file} '
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

        print(f'=== Capturing session: seed={seed}, role={char["role"]}, moves="{move_str}" ===')
        print(f'=== STARTUP ===')
        wait_for_game_ready(session_name, rng_log_file)
        time.sleep(0.02)
        clear_more_prompts(session_name)
        time.sleep(0.02)

        # Capture startup state
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

        # Capture compressed ANSI screen for startup
        startup_screen_compressed = capture_screen_compressed(session_name)

        # Build session object (unified format v3)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)
        startup_actual_rng = sum(1 for e in startup_rng_entries if e[0] not in ('>', '<'))

        # Build startup step (first step with no key)
        startup_step = {
            'key': None,
            'action': 'startup',
            'rng': startup_rng_entries,
            'screen': startup_screen_compressed,
        }
        if startup_typ_grid:
            startup_step['typGrid'] = encode_typgrid_rle(startup_typ_grid)

        session_data = {
            'version': 3,
            'seed': seed,
            'source': 'c',
            'regen': {
                'mode': 'gameplay',
                'moves': move_str,
            },
            'options': {
                'name': char['name'],
                'role': char['role'],
                'race': char['race'],
                'gender': char['gender'],
                'align': char['align'],
                'wizard': True,
                'symset': 'DECgraphics',
                'autopickup': False,
                'pickup_types': '',
            },
            'steps': [startup_step],
        }

        # Execute moves - send each character individually (no grouping)
        prev_rng_count = startup_rng_count
        prev_typ_grid = startup_typ_grid
        captured_levels = {'Dlvl:1'}  # Track levels we've captured typGrids for

        # Helper to send a single character with proper control char handling
        def send_char(ch):
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

        print(f'\n=== MOVES ({len(move_str)} steps) ===')
        for idx, ch in enumerate(move_str):
            key = ch
            description = describe_key(ch)

            # Send the character
            send_char(ch)
            time.sleep(0.003)  # 3ms delay for game to process input

            # Only clear --More-- if not raw_moves (raw moves include space keys)
            if not raw_moves:
                clear_more_prompts(session_name)

            # Capture state after this step
            screen_lines = capture_screen_lines(session_name)
            screen_compressed = capture_screen_compressed(session_name)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            # Detect current level from status line
            depth = detect_depth(screen_lines)
            delta = rng_count - prev_rng_count

            step = {
                'key': key,
                'action': description,
                'rng': rng_entries,
                'screen': screen_compressed,
            }

            # Capture typGrid when we're on a level we haven't captured yet
            # Trigger on: new depth detected OR high RNG delta (level generation)
            level_gen_likely = delta > 1000
            if depth not in captured_levels or (level_gen_likely and 'typGrid' not in step):
                current_grid = execute_dumpmap(session_name, dumpmap_file)
                clear_more_prompts(session_name)
                if current_grid:
                    step['typGrid'] = encode_typgrid_rle(current_grid)
                    captured_levels.add(depth)
                    reason = f'depth={depth}' if depth not in captured_levels else f'RNG spike ({delta} calls)'
                    print(f'  New level detected ({reason}), typGrid captured')
                    prev_typ_grid = current_grid

            session_data['steps'].append(step)
            print(f'  [{idx+1:03d}] {key!r:5s} ({description:20s}) +{delta:4d} RNG calls (total {rng_count})')
            prev_rng_count = rng_count

        # Quit the game cleanly
        quit_game(session_name)

        # Write JSON with compact typGrid rows
        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            f.write(compact_session_json(session_data))

        # Summary
        total_rng = prev_rng_count
        total_steps = len(session_data['steps'])
        stats = get_clear_more_stats()
        print(f'\n=== DONE ===')
        print(f'Session: {output_json}')
        print(f'Steps: {total_steps}, Total RNG calls: {total_rng}')
        if not raw_moves:
            print(f'clear_more_prompts: {stats["calls"]} calls, {stats["cleared"]} --More-- cleared')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    main()
