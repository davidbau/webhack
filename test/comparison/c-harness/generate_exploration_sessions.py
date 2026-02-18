#!/usr/bin/env python3
"""Generate selfplay sessions that explore to Dlvl:2 or XP level 2.

For each character class, try different seeds until we find a playthrough
that reaches at least dungeon level 2 or experience level 2 within 200 moves.
"""

import os
import sys
import json
import re
import subprocess
import tempfile
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')

CHARACTER_CLASSES = [
    'archeologist', 'barbarian', 'caveman', 'healer', 'knight',
    'monk', 'priest', 'ranger', 'rogue', 'samurai', 'tourist',
    'valkyrie', 'wizard'
]

# Exploration move pattern - move around, try stairs, search
# This pattern explores in different directions and tries '>' frequently
EXPLORE_PATTERN = (
    "hhhh>jjjj>llll>kkkk>"  # Move in directions, try stairs
    "hhhjjj>lllkkk>s"       # Diagonal-ish exploration
    "yyyuuu>bbbnnn>s"       # Use diagonal moves
    "hhjjllkk>."            # Box pattern with stair attempt
)

def generate_moves(num_moves=200):
    """Generate exploration moves."""
    moves = ""
    while len(moves) < num_moves:
        moves += EXPLORE_PATTERN
    return moves[:num_moves]


def run_session_and_check(seed, character, moves, verbose=False):
    """Run a session and check if it reaches Dlvl:2 or XP level 2.

    Returns: (success, max_dlvl, max_xp, session_file_path)
    """
    output_file = tempfile.NamedTemporaryFile(suffix='.json', delete=False).name

    try:
        # Run the session
        cmd = [
            'python3', os.path.join(SCRIPT_DIR, 'run_session.py'),
            str(seed), output_file, moves,
            '--character', character
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode != 0:
            if verbose:
                print(f"  Session failed: {result.stderr[:100]}")
            return False, 1, 1, None

        # Parse the session to check depth and XP
        with open(output_file) as f:
            data = json.load(f)

        max_dlvl = 1
        max_xp = 1

        for step in data['steps']:
            screen = step.get('screen', '')

            # Check dungeon level
            match = re.search(r'Dlvl:(\d+)', screen)
            if match:
                dlvl = int(match.group(1))
                if dlvl > max_dlvl:
                    max_dlvl = dlvl

            # Check experience level (format varies: "Xp:2" or "Exp:2")
            match = re.search(r'(?:Xp|Exp):(\d+)', screen)
            if match:
                xp = int(match.group(1))
                if xp > max_xp:
                    max_xp = xp

        success = max_dlvl >= 2 or max_xp >= 2
        return success, max_dlvl, max_xp, output_file

    except Exception as e:
        if verbose:
            print(f"  Error: {e}")
        return False, 1, 1, None


def find_good_session(character, start_seed=1, max_attempts=100, verbose=True):
    """Try different seeds until we find a good session for this character."""
    moves = generate_moves(200)

    for attempt in range(max_attempts):
        seed = start_seed + attempt

        if verbose:
            print(f"  Trying seed {seed}...", end=' ', flush=True)

        success, dlvl, xp, session_file = run_session_and_check(
            seed, character, moves, verbose=False
        )

        if verbose:
            print(f"Dlvl:{dlvl} XP:{xp}", end='')
            if success:
                print(" ✓")
            else:
                print()

        if success:
            return seed, dlvl, xp, session_file

        # Clean up failed attempt
        if session_file and os.path.exists(session_file):
            os.unlink(session_file)

    return None, 1, 1, None


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv

    print("Generating exploration sessions for each character class...")
    print("Goal: Reach Dlvl:2 or XP level 2 within 200 moves")
    print("=" * 60)

    results = []

    for i, character in enumerate(CHARACTER_CLASSES):
        print(f"\n[{i+1}/{len(CHARACTER_CLASSES)}] {character.capitalize()}")

        # Start with seed based on character index (101, 102, etc.)
        base_seed = 101 + i * 100  # Try 101, 201, 301... for each class

        seed, dlvl, xp, temp_file = find_good_session(
            character, start_seed=base_seed, max_attempts=50, verbose=verbose
        )

        if seed is not None:
            # Copy to final location
            final_name = f"seed{seed}_{character}_explore200.session.json"
            final_path = os.path.join(SESSIONS_DIR, final_name)
            shutil.copy(temp_file, final_path)
            os.unlink(temp_file)

            results.append({
                'character': character,
                'seed': seed,
                'dlvl': dlvl,
                'xp': xp,
                'file': final_name
            })
            print(f"  → Saved: {final_name} (Dlvl:{dlvl}, XP:{xp})")
        else:
            print(f"  ✗ No good session found after 50 attempts")
            results.append({
                'character': character,
                'seed': None,
                'dlvl': 1,
                'xp': 1,
                'file': None
            })

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    success_count = sum(1 for r in results if r['seed'] is not None)
    print(f"Found good sessions: {success_count}/{len(CHARACTER_CLASSES)}")

    for r in results:
        if r['seed']:
            print(f"  {r['character']:15} seed={r['seed']:4} Dlvl:{r['dlvl']} XP:{r['xp']}")
        else:
            print(f"  {r['character']:15} NO GOOD SESSION FOUND")


if __name__ == '__main__':
    main()
