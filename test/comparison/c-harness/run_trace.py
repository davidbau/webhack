#!/usr/bin/env python3
"""Capture a move-by-move trace from the C NetHack binary.

Usage:
    python3 run_trace.py <seed> <output_dir> [move_sequence]

Plays through the C NetHack game with a fixed seed, sending a sequence
of keystrokes and capturing the full screen state + RNG log after each move.

Output files in <output_dir>:
    startup_NNN.txt         — screen captures during startup/character creation
    screen_000_start.txt    — screen after character selection, before first move
    screen_001_<key>.txt    — screen after move 1
    ...
    rnglog.txt              — full RNG call log for the session
    trace_summary.txt       — human-readable summary of all moves

The move_sequence is a string of move characters. Special encodings:
    h/j/k/l/y/u/b/n   — vi movement keys
    .                  — wait
    s                  — search
    ,                  — pickup
    i                  — inventory
    :                  — look
    @                  — autopickup toggle
    F<dir>             — fight in direction (e.g., Fj = fight south)
"""

import sys
import os
import time
import subprocess
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(SCRIPT_DIR, 'results')
INSTALL_DIR = os.path.join(os.path.expanduser('~'), 'nethack-minimal', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')


def tmux_send(session, keys, delay=0.3):
    subprocess.run(['tmux', 'send-keys', '-t', session, '-l', keys], check=True)
    time.sleep(delay)

def tmux_send_special(session, key, delay=0.3):
    subprocess.run(['tmux', 'send-keys', '-t', session, key], check=True)
    time.sleep(delay)

def tmux_capture(session):
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-S', '0', '-E', '30'],
        capture_output=True, text=True, check=True
    )
    return result.stdout

def setup_home():
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

    save_dir = os.path.join(INSTALL_DIR, 'save')
    if os.path.isdir(save_dir):
        import glob
        for f in glob.glob(os.path.join(save_dir, '*')):
            os.unlink(f)


def read_rng_log_lines(rng_log_file):
    """Read current RNG log line count."""
    try:
        with open(rng_log_file) as f:
            lines = f.readlines()
        return len(lines), lines
    except FileNotFoundError:
        return 0, []


def wait_for_game_ready(session, output_dir, rng_log_file):
    """Navigate startup, capturing every screen + RNG state as we go."""
    startup_screens = []
    step = 0

    def save_startup_screen(content, action_taken, rng_count):
        nonlocal step
        screen_file = os.path.join(output_dir, f'startup_{step:03d}.txt')
        with open(screen_file, 'w') as f:
            f.write(f'--- Action: {action_taken} | RNG calls so far: {rng_count} ---\n')
            f.write(content)
        startup_screens.append({
            'step': step,
            'action': action_taken,
            'rng_count': rng_count,
            'file': screen_file,
            'content': content,
        })
        # Print first non-empty line for debugging
        lines = [l for l in content.split('\n') if l.strip()]
        first = lines[0].rstrip() if lines else '(empty)'
        print(f'  [startup-{step:03d}] rng={rng_count} action={action_taken!r:30s} | {first[:70]}')
        step += 1

    for attempt in range(60):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            print(f'[startup-{attempt}] tmux session died')
            break

        rng_count, _ = read_rng_log_lines(rng_log_file)

        if '--More--' in content:
            save_startup_screen(content, 'press Space (--More--)', rng_count)
            tmux_send_special(session, 'Space', 0.5)
            continue

        if 'keep the save file' in content or 'keep save' in content.lower():
            save_startup_screen(content, 'press n (keep save)', rng_count)
            tmux_send(session, 'n', 0.5)
            continue

        if 'Shall I pick' in content:
            save_startup_screen(content, 'press y (shall I pick)', rng_count)
            tmux_send(session, 'y', 0.5)
            continue

        if 'Is this ok?' in content:
            save_startup_screen(content, 'press y (is this ok)', rng_count)
            tmux_send(session, 'y', 0.5)
            continue

        if 'tutorial' in content.lower():
            save_startup_screen(content, 'press n (tutorial)', rng_count)
            tmux_send(session, 'n', 0.5)
            continue

        if 'pick a role' in content or 'Pick a role' in content:
            save_startup_screen(content, 'press v (pick role)', rng_count)
            tmux_send(session, 'v', 0.3)
            continue

        if 'pick a race' in content or 'Pick a race' in content:
            save_startup_screen(content, 'press h (pick race)', rng_count)
            tmux_send(session, 'h', 0.3)
            continue

        if 'pick a gender' in content or 'Pick a gender' in content:
            save_startup_screen(content, 'press f (pick gender)', rng_count)
            tmux_send(session, 'f', 0.3)
            continue

        if 'pick an alignment' in content or 'Pick an alignment' in content:
            save_startup_screen(content, 'press n (pick alignment)', rng_count)
            tmux_send(session, 'n', 0.3)
            continue

        # Check for game running
        if 'Dlvl:' in content or 'St:' in content or 'HP:' in content:
            save_startup_screen(content, 'GAME READY', rng_count)
            break

        lines = content.strip().split('\n')
        if len(lines) > 5 and any('|' in line and '-' in line for line in lines[1:22]):
            save_startup_screen(content, 'GAME READY (map detected)', rng_count)
            break

        # Unrecognized screen — save it and try Space
        if attempt > 2:
            save_startup_screen(content, 'press Space (unrecognized)', rng_count)
            tmux_send_special(session, 'Space', 0.3)
        else:
            save_startup_screen(content, 'waiting...', rng_count)
            time.sleep(0.5)

    return startup_screens


def clear_more_prompts(session, max_iterations=10):
    """Clear any --More-- prompts that appear after a move."""
    content = ''
    for _ in range(max_iterations):
        time.sleep(0.2)
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if '--More--' in content:
            tmux_send_special(session, 'Space', 0.2)
        else:
            break
    return content


def describe_key(key):
    names = {
        'h': 'move-west', 'j': 'move-south', 'k': 'move-north', 'l': 'move-east',
        'y': 'move-nw', 'u': 'move-ne', 'b': 'move-sw', 'n': 'move-se',
        '.': 'wait', 's': 'search', ',': 'pickup', 'i': 'inventory',
        ':': 'look', '@': 'autopickup-toggle',
    }
    return names.get(key, f'key-{key}')


def parse_moves(move_str):
    moves = []
    i = 0
    while i < len(move_str):
        if move_str[i] == 'F' and i + 1 < len(move_str):
            moves.append(('F' + move_str[i+1], f'fight-{describe_key(move_str[i+1])}'))
            i += 2
        else:
            moves.append((move_str[i], describe_key(move_str[i])))
            i += 1
    return moves


def quit_game(session):
    tmux_send(session, '#', 0.3)
    time.sleep(0.3)
    tmux_send(session, 'quit', 0.3)
    tmux_send_special(session, 'Enter', 0.5)
    for _ in range(15):
        try:
            content = tmux_capture(session)
        except subprocess.CalledProcessError:
            break
        if 'Really quit' in content or 'really quit' in content:
            tmux_send(session, 'y', 0.3)
        elif 'do you want your possessions' in content.lower():
            tmux_send(session, 'n', 0.3)
        elif '--More--' in content:
            tmux_send_special(session, 'Space', 0.2)
        elif 'PROCESS_DONE' in content or 'sleep 999' in content:
            break
        time.sleep(0.3)
    time.sleep(0.5)


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <seed> <output_dir> [move_sequence]")
        print(f"Example: {sys.argv[0]} 42 /tmp/trace42 ':hlhhhh.hhs'")
        sys.exit(1)

    seed = sys.argv[1]
    output_dir = os.path.abspath(sys.argv[2])
    move_str = sys.argv[3] if len(sys.argv) >= 4 else '...........'

    if not os.path.isfile(NETHACK_BINARY):
        print(f"Error: nethack binary not found at {NETHACK_BINARY}")
        sys.exit(1)

    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    setup_home()

    rng_log_file = os.path.join(output_dir, 'rnglog.txt')
    session = f'webhack-trace-{seed}-{os.getpid()}'

    try:
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
            ['tmux', 'new-session', '-d', '-s', session, '-x', '80', '-y', '24', cmd],
            check=True
        )

        time.sleep(2.0)

        print('=== STARTUP SEQUENCE ===')
        startup_screens = wait_for_game_ready(session, output_dir, rng_log_file)
        time.sleep(1.0)

        # Clear remaining --More-- prompts
        clear_more_prompts(session)
        time.sleep(0.5)

        # Capture initial game state
        screen = tmux_capture(session)
        rng_count, rng_lines = read_rng_log_lines(rng_log_file)

        screen_file = os.path.join(output_dir, 'screen_000_start.txt')
        with open(screen_file, 'w') as f:
            f.write(screen)

        # Save initial RNG snapshot (all calls from game start through level gen)
        init_rng_file = os.path.join(output_dir, 'rng_000_init.txt')
        with open(init_rng_file, 'w') as f:
            for line in rng_lines:
                f.write(line)

        print(f'\n=== GAME READY ===')
        print(f'[000] START: {rng_count} total RNG calls through initialization')

        # Parse and execute moves
        moves = parse_moves(move_str)
        summary_lines = []
        summary_lines.append(f'Trace for seed={seed}')
        summary_lines.append(f'Move sequence: {move_str}')
        summary_lines.append(f'')
        summary_lines.append(f'=== STARTUP ===')
        for s in startup_screens:
            summary_lines.append(f'  startup-{s["step"]:03d}: rng={s["rng_count"]} action={s["action"]}')
        summary_lines.append(f'')
        summary_lines.append(f'=== MOVES ===')
        summary_lines.append(f'[000] START — {rng_count} RNG calls total')

        prev_rng_count = rng_count

        print(f'\n=== MOVES ===')
        for idx, (key, description) in enumerate(moves, 1):
            # Send the keystroke
            if key.startswith('F'):
                tmux_send(session, 'F', 0.2)
                tmux_send(session, key[1], 0.3)
            else:
                tmux_send(session, key, 0.3)

            # Wait and clear --More--
            time.sleep(0.3)
            screen = clear_more_prompts(session)
            time.sleep(0.2)
            screen = tmux_capture(session)

            rng_count, rng_lines = read_rng_log_lines(rng_log_file)
            delta = rng_count - prev_rng_count

            # Save screen
            key_safe = key.replace('/', 'slash').replace('\\', 'bslash')
            screen_file = os.path.join(output_dir, f'screen_{idx:03d}_{key_safe}_{description}.txt')
            with open(screen_file, 'w') as f:
                f.write(screen)

            # Save RNG delta
            rng_delta_file = os.path.join(output_dir, f'rng_{idx:03d}_{key_safe}_{description}.txt')
            with open(rng_delta_file, 'w') as f:
                for line in rng_lines[prev_rng_count:rng_count]:
                    f.write(line)

            msg_line = screen.split('\n')[0].rstrip() if screen else ''
            print(f'[{idx:03d}] {key!r:5s} ({description:20s}) — +{delta:4d} RNG calls (total {rng_count})')
            if msg_line:
                print(f'  msg: {msg_line!r}')

            summary_lines.append(f'[{idx:03d}] key={key!r} ({description}) — +{delta} RNG calls (total {rng_count})')
            summary_lines.append(f'  message: {msg_line}')

            prev_rng_count = rng_count

        # Write summary
        summary_file = os.path.join(output_dir, 'trace_summary.txt')
        with open(summary_file, 'w') as f:
            f.write('\n'.join(summary_lines) + '\n')
        print(f'\nSummary: {summary_file}')

        quit_game(session)

    finally:
        subprocess.run(['tmux', 'kill-session', '-t', session], capture_output=True)

    print(f'\nTrace complete. {output_dir}/')


if __name__ == '__main__':
    main()
