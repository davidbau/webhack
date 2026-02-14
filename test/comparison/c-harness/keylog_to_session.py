#!/usr/bin/env python3
"""Convert a C keylog JSONL trace into standard C session JSON format.

Usage:
    python3 keylog_to_session.py --in seed5.jsonl --out test/comparison/sessions/seed5.session.json

This script replays recorded keycodes into C NetHack with the same seed and
captures:
  - startup RNG + screen + typGrid
  - per-step RNG deltas + screen + depth
  - typGrid snapshots when terrain changes

It emits the same session structure used by run_session.py.
"""

import argparse
import json
import os
import subprocess
import tempfile
import time
import importlib.util
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')

_spec = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_session = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_session)

tmux_send = _session.tmux_send
tmux_send_special = _session.tmux_send_special
capture_screen_lines = _session.capture_screen_lines
capture_screen_ansi_lines = _session.capture_screen_ansi_lines
clear_more_prompts = _session.clear_more_prompts
wait_for_game_ready = _session.wait_for_game_ready
read_rng_log = _session.read_rng_log
parse_rng_lines = _session.parse_rng_lines
execute_dumpmap = _session.execute_dumpmap
quit_game = _session.quit_game
compact_session_json = _session.compact_session_json
fixed_datetime_env = _session.fixed_datetime_env
detect_depth = _session.detect_depth


def parse_args():
    p = argparse.ArgumentParser(description='Convert keylog JSONL to standard session JSON')
    p.add_argument('--in', dest='input_jsonl', required=True, help='Input keylog JSONL path')
    p.add_argument('--out', dest='output_json', required=True, help='Output session JSON path')
    p.add_argument('--seed', type=int, default=None, help='Override seed (default: from keylog)')
    p.add_argument('--name', default='Recorder')
    p.add_argument('--role', default='Valkyrie')
    p.add_argument('--race', default='human')
    p.add_argument('--gender', default='female')
    p.add_argument('--align', default='neutral')
    p.add_argument('--symset', default='ASCII', choices=['ASCII', 'DECgraphics'])
    p.add_argument(
        '--screen-capture',
        default='auto',
        choices=['auto', 'plain', 'ansi', 'both'],
        help='Screen capture mode: plain=text only, ansi=ANSI only, both=both fields, auto=ansi for DECgraphics else plain'
    )
    p.add_argument(
        '--startup-mode',
        default='auto',
        choices=['auto', 'ready', 'from-keylog'],
        help='Startup handling: ready=auto-advance to map before replay, from-keylog=replay startup keys exactly, auto=detect from keylog in_moveloop'
    )
    return p.parse_args()


def setup_home(character, symset):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    nethackrc = os.path.join(RESULTS_DIR, '.nethackrc')
    with open(nethackrc, 'w') as f:
        f.write(f'OPTIONS=name:{character["name"]}\n')
        f.write(f'OPTIONS=race:{character["race"]}\n')
        f.write(f'OPTIONS=role:{character["role"]}\n')
        f.write(f'OPTIONS=gender:{character["gender"]}\n')
        f.write(f'OPTIONS=align:{character["align"]}\n')
        f.write('OPTIONS=!autopickup\n')
        f.write('OPTIONS=!tutorial\n')
        f.write('OPTIONS=suppress_alert:3.4.3\n')
        if symset == 'DECgraphics':
            f.write('OPTIONS=symset:DECgraphics\n')
        else:
            f.write('OPTIONS=symset:ASCII\n')

    import glob
    save_dir = os.path.join(INSTALL_DIR, 'save')
    if os.path.isdir(save_dir):
        for fn in glob.glob(os.path.join(save_dir, '*')):
            os.unlink(fn)
    for fn in glob.glob(os.path.join(INSTALL_DIR, '*wizard*')):
        if not fn.endswith('.lua'):
            os.unlink(fn)
    for fn in glob.glob(os.path.join(INSTALL_DIR, '*Wizard*')):
        if not fn.endswith('.lua'):
            os.unlink(fn)
    for fn in glob.glob(os.path.join(INSTALL_DIR, f'*{character["name"]}*')):
        if not fn.endswith('.lua'):
            os.unlink(fn)
    for fn in glob.glob(os.path.join(INSTALL_DIR, 'bon*')):
        os.unlink(fn)


def read_keylog(path):
    events = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(e.get('key'), int):
                events.append(e)
    events.sort(key=lambda e: int(e.get('seq', 0)))
    if not events:
        raise RuntimeError(f'No key events found in {path}')
    return events


def key_repr(code):
    if 32 <= code <= 126:
        return chr(code)
    return chr(code)


def describe_key(code):
    if code == 10 or code == 13:
        return 'key-enter'
    if code == 27:
        return 'key-escape'
    if code == 127:
        return 'key-backspace'
    if 1 <= code <= 26:
        return f'key-ctrl-{chr(code + 96)}'
    if 32 <= code <= 126:
        return _session.describe_key(chr(code))
    return f'keycode-{code}'


def send_keycode(session_name, code):
    if code == 10 or code == 13:
        tmux_send_special(session_name, 'Enter', 0.05)
        return
    if code == 27:
        tmux_send_special(session_name, 'Escape', 0.05)
        return
    if code == 127:
        tmux_send_special(session_name, 'BSpace', 0.05)
        return
    if 1 <= code <= 26:
        tmux_send_special(session_name, f'C-{chr(code + 96)}', 0.05)
        return
    tmux_send(session_name, chr(code), 0.05)


def resolve_screen_capture_mode(screen_capture, symset):
    if screen_capture != 'auto':
        return screen_capture
    # Keep plain `screen` for compatibility while adding ANSI fidelity in DECgraphics mode.
    return 'both' if symset.lower() == 'decgraphics' else 'plain'


def capture_screens(session_name, mode):
    """Capture screen fields according to mode and return dict."""
    out = {}
    if mode in ('plain', 'both'):
        out['screen'] = capture_screen_lines(session_name)
    if mode in ('ansi', 'both'):
        out['screenAnsi'] = capture_screen_ansi_lines(session_name)
    return out


def run_from_keylog(events, seed, character, symset, output_json, screen_capture_mode, startup_mode):
    setup_home(character, symset)
    output_json = os.path.abspath(output_json)

    tmpdir = tempfile.mkdtemp(prefix='webhack-keylog-session-')
    rng_log_file = os.path.join(tmpdir, 'rnglog.txt')
    dumpmap_file = os.path.join(tmpdir, 'dumpmap.txt')
    session_name = f'webhack-keylog-{seed}-{os.getpid()}'
    keylog_moves_base = int(events[0].get('moves', 0))

    try:
        cmd = (
            f'NETHACKDIR={INSTALL_DIR} '
            f'{fixed_datetime_env()}'
            f'NETHACK_SEED={seed} '
            f'NETHACK_RNGLOG={rng_log_file} '
            f'NETHACK_DUMPMAP={dumpmap_file} '
            f'HOME={RESULTS_DIR} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u {character["name"]} -D; '
            f'sleep 999'
        )
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session_name, '-x', '80', '-y', '24', cmd],
            check=True
        )
        time.sleep(1.0)

        keylog_has_startup = any(int(e.get('in_moveloop', 1)) == 0 for e in events[:64])
        replay_startup_from_keylog = (
            startup_mode == 'from-keylog'
            or (startup_mode == 'auto' and keylog_has_startup)
        )
        if replay_startup_from_keylog:
            # Keylog traces captured via c_manual_record already include startup/chargen keys.
            # Do not auto-advance prompts here or we will double-apply startup.
            time.sleep(0.5)
        else:
            wait_for_game_ready(session_name, rng_log_file)
            time.sleep(0.1)
            clear_more_prompts(session_name)
            time.sleep(0.1)

        startup_screens = capture_screens(session_name, screen_capture_mode)
        startup_rng_count, startup_rng_lines = read_rng_log(rng_log_file)
        startup_rng_entries = parse_rng_lines(startup_rng_lines)
        startup_actual_rng = sum(1 for e in startup_rng_entries if e[0] not in ('>', '<'))
        startup_typ_grid = execute_dumpmap(session_name, dumpmap_file)
        if not replay_startup_from_keylog:
            clear_more_prompts(session_name)

        session_data = {
            'version': 1,
            'seed': seed,
            'wizard': True,
            'character': character,
            'symset': symset,
            'screenMode': 'decgraphics' if symset.lower() == 'decgraphics' else 'ascii',
            'startup': {
                'rngCalls': startup_actual_rng,
                'rng': startup_rng_entries,
                'typGrid': startup_typ_grid,
                **startup_screens,
            },
            'steps': [],
        }

        prev_rng_count = startup_rng_count
        startup_depth_lines = startup_screens.get('screen') or startup_screens.get('screenAnsi') or []
        prev_depth = detect_depth(startup_depth_lines)
        prev_typ_grid = startup_typ_grid

        print(f'=== Replaying {len(events)} keylog events (seed={seed}, screenCapture={screen_capture_mode}) ===')
        for i, e in enumerate(events):
            code = int(e['key'])
            send_keycode(session_name, code)
            time.sleep(0.05)
            if not replay_startup_from_keylog:
                clear_more_prompts(session_name)
                time.sleep(0.05)

            screens = capture_screens(session_name, screen_capture_mode)
            rng_count, rng_lines = read_rng_log(rng_log_file)
            delta_lines = rng_lines[prev_rng_count:rng_count]
            rng_entries = parse_rng_lines(delta_lines)

            depth_lines = screens.get('screen') or screens.get('screenAnsi') or []
            depth = int(e.get('dlevel', detect_depth(depth_lines)))
            turn = max(0, int(e.get('moves', 0)) - keylog_moves_base)

            # Guard against startup-state mismatch: if status says Tutorial while
            # keylog dnum says otherwise, abort instead of producing a bad fixture.
            if depth_lines:
                status_line = depth_lines[23] if len(depth_lines) > 23 else ''
                ev_dnum = e.get('dnum')
                if isinstance(ev_dnum, int) and 'Tutorial:' in status_line and ev_dnum != 8:
                    raise RuntimeError(
                        f'Keylog/session mismatch at seq={e.get("seq")}: '
                        f'status shows Tutorial but keylog dnum={ev_dnum}'
                    )

            step = {
                'key': key_repr(code),
                'action': describe_key(code),
                'turn': turn,
                'depth': depth,
                'rng': rng_entries,
                **screens,
            }

            # For long manual traces, #dumpmap on every key is too expensive.
            # Capture typGrid when depth changes, matching level-transition points.
            if depth != prev_depth:
                current_grid = execute_dumpmap(session_name, dumpmap_file)
                clear_more_prompts(session_name)
                if current_grid:
                    step['typGrid'] = current_grid
                    prev_typ_grid = current_grid
                prev_depth = depth

            session_data['steps'].append(step)
            prev_rng_count = rng_count
            if (i + 1) % 200 == 0:
                print(f'  replayed {i + 1}/{len(events)} events')

        quit_game(session_name)

        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            f.write(compact_session_json(session_data))
        print(f'Wrote {output_json}')

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    args = parse_args()
    events = read_keylog(args.input_jsonl)
    seed = args.seed
    if seed is None:
        raw_seed = events[0].get('seed')
        seed = int(raw_seed) if raw_seed is not None else 1

    character = {
        'name': args.name,
        'role': args.role,
        'race': args.race,
        'gender': args.gender,
        'align': args.align,
    }

    screen_capture_mode = resolve_screen_capture_mode(args.screen_capture, args.symset)
    run_from_keylog(events, seed, character, args.symset, args.output_json, screen_capture_mode, args.startup_mode)


if __name__ == '__main__':
    main()
