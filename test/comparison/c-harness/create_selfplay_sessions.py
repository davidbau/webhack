#!/usr/bin/env python3
"""Create selfplay sessions for all 13 classes.

Seeds 101-113: One selfplay session per class with 200 turns of movement.
"""

import os
import sys
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RUN_SESSION = os.path.join(SCRIPT_DIR, 'run_session.py')
SESSIONS_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'sessions'))

# Character presets for each class
CLASSES = [
    ('archeologist', 101),
    ('barbarian', 102),
    ('caveman', 103),
    ('healer', 104),
    ('knight', 105),
    ('monk', 106),
    ('priest', 107),
    ('ranger', 108),
    ('rogue', 109),
    ('samurai', 110),
    ('tourist', 111),
    ('valkyrie', 112),
    ('wizard', 113),
]

# Selfplay pattern: 200 turns of movement + search
SELFPLAY_PATTERN = 'hhjjllkk.s' * 20  # 200 moves


def create_selfplay_session(char_class, seed):
    """Create a single selfplay session."""
    output = os.path.join(SESSIONS_DIR, f'seed{seed}_{char_class}_selfplay200.session.json')

    print(f'\n=== Creating selfplay session: seed={seed}, class={char_class} ===')

    # Run the session
    cmd = [
        sys.executable, RUN_SESSION,
        str(seed), output,
        SELFPLAY_PATTERN,
        '--character', char_class
    ]

    result = subprocess.run(cmd, capture_output=False)

    if result.returncode == 0:
        print(f'SUCCESS: {output}')
        return True
    else:
        print(f'FAILED: seed={seed}, class={char_class}')
        return False


def main():
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    # Check which seed to start from (for resuming)
    start_seed = int(sys.argv[1]) if len(sys.argv) > 1 else 101

    success_count = 0
    fail_count = 0

    for char_class, seed in CLASSES:
        if seed < start_seed:
            continue

        if create_selfplay_session(char_class, seed):
            success_count += 1
        else:
            fail_count += 1

    print(f'\n=== Summary ===')
    print(f'Success: {success_count}')
    print(f'Failed: {fail_count}')


if __name__ == '__main__':
    main()
