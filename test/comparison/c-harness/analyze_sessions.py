#!/usr/bin/env python3
"""Analyze sessions for level descents and combat statistics.

Usage:
    python3 analyze_sessions.py [session_pattern]
    python3 analyze_sessions.py  # Analyze all gameplay sessions
"""

import os
import sys
import json
import glob
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SESSIONS_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'sessions'))

# Patterns for detecting events
DESCENT_PATTERNS = [
    r'You descend',
    r'You fall',
    r'You land on',
    r'Going down',
]

ASCENT_PATTERNS = [
    r'You climb up',
    r'You rise up',
    r'Going up',
]

COMBAT_HIT_PATTERNS = [
    r'You hit',
    r'You smite',
    r'You destroy',
    r'You kill',
    r'You slay',
    r'It is hit',
    r'is hit by',
    r'bites',
    r'hits',
    r'kicks',
    r'claws',
    r'stings',
    r'butts',
    r'touches',
    r'attacks',
]

COMBAT_MISS_PATTERNS = [
    r'You miss',
    r'barely misses',
    r'misses',
    r'fails to hit',
]

MONSTER_KILL_PATTERNS = [
    r'You kill',
    r'You destroy',
    r'You slay',
    r'is killed',
    r'is destroyed',
    r'dies',
]

PLAYER_DAMAGE_PATTERNS = [
    r'The .* hits you',
    r'The .* bites you',
    r'The .* kicks you',
    r'The .* claws you',
    r'You are hit',
]

LEVEL_INDICATOR = re.compile(r'(Dlvl|Mines|Sokoban|Quest|Astral|Fort|Vlad|Air|Earth|Fire|Water):\s*(\d+)')


def analyze_session(session_path):
    """Analyze a session for events."""
    with open(session_path) as f:
        session_data = json.load(f)

    steps = session_data.get('steps', [])
    seed = session_data.get('seed', 0)
    options = session_data.get('options', {})

    stats = {
        'session': os.path.basename(session_path),
        'seed': seed,
        'role': options.get('role', 'Unknown'),
        'total_steps': len(steps),
        'total_messages': 0,
        'descents': 0,
        'ascents': 0,
        'combat_hits': 0,
        'combat_misses': 0,
        'monsters_killed': 0,
        'player_hit': 0,
        'max_depth': 1,
        'levels_visited': set(),
        'descent_details': [],
        'combat_details': [],
    }

    current_depth = 1

    for step in steps:
        msg = step.get('msg', '')
        if not msg:
            continue

        stats['total_messages'] += 1

        # Check for level changes from screen
        screen = step.get('screen', '')
        if screen:
            # Try to extract depth from status line
            lines = screen.split('\n') if isinstance(screen, str) else []
            for line in lines[-3:]:  # Status is usually at bottom
                match = LEVEL_INDICATOR.search(line)
                if match:
                    depth_num = int(match.group(2))
                    level_id = f'{match.group(1)}:{depth_num}'
                    stats['levels_visited'].add(level_id)
                    if depth_num > stats['max_depth']:
                        stats['max_depth'] = depth_num

        # Check for descents
        for pattern in DESCENT_PATTERNS:
            if re.search(pattern, msg, re.IGNORECASE):
                stats['descents'] += 1
                stats['descent_details'].append({
                    'step': step.get('action', ''),
                    'msg': msg[:60],
                })
                break

        # Check for ascents
        for pattern in ASCENT_PATTERNS:
            if re.search(pattern, msg, re.IGNORECASE):
                stats['ascents'] += 1
                break

        # Check for combat hits
        for pattern in COMBAT_HIT_PATTERNS:
            if re.search(pattern, msg, re.IGNORECASE):
                stats['combat_hits'] += 1
                stats['combat_details'].append({
                    'step': step.get('action', ''),
                    'msg': msg[:60],
                })
                break

        # Check for combat misses
        for pattern in COMBAT_MISS_PATTERNS:
            if re.search(pattern, msg, re.IGNORECASE):
                stats['combat_misses'] += 1
                break

        # Check for monster kills
        for pattern in MONSTER_KILL_PATTERNS:
            if re.search(pattern, msg, re.IGNORECASE):
                stats['monsters_killed'] += 1
                break

        # Check for player taking damage
        for pattern in PLAYER_DAMAGE_PATTERNS:
            if re.search(pattern, msg, re.IGNORECASE):
                stats['player_hit'] += 1
                break

    # Convert set to list for JSON
    stats['levels_visited'] = sorted(list(stats['levels_visited']))

    return stats


def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else '*'

    # Find sessions
    if pattern == '*':
        sessions = glob.glob(os.path.join(SESSIONS_DIR, '*_gameplay.session.json'))
        sessions += glob.glob(os.path.join(SESSIONS_DIR, '*_selfplay*.session.json'))
        sessions += glob.glob(os.path.join(SESSIONS_DIR, '*_wizard.session.json'))
    else:
        sessions = glob.glob(os.path.join(SESSIONS_DIR, f'*{pattern}*.session.json'))

    sessions = sorted(sessions)

    all_stats = []
    for session_path in sessions:
        stats = analyze_session(session_path)
        all_stats.append(stats)

    # Print summary table
    print(f'{"Session":<45} {"Role":<12} {"Steps":>6} {"Msgs":>5} {"Desc":>5} {"Hits":>5} {"Kills":>5} {"Depth":>5}')
    print('-' * 100)

    total_descents = 0
    total_hits = 0
    total_kills = 0

    for s in all_stats:
        print(f'{s["session"]:<45} {s["role"]:<12} {s["total_steps"]:>6} {s["total_messages"]:>5} {s["descents"]:>5} {s["combat_hits"]:>5} {s["monsters_killed"]:>5} {s["max_depth"]:>5}')
        total_descents += s['descents']
        total_hits += s['combat_hits']
        total_kills += s['monsters_killed']

    print('-' * 100)
    print(f'{"TOTAL":<45} {"":<12} {"":<6} {"":<5} {total_descents:>5} {total_hits:>5} {total_kills:>5}')
    print()

    # Sessions with no combat or no descents
    no_combat = [s for s in all_stats if s['combat_hits'] == 0]
    no_descents = [s for s in all_stats if s['descents'] == 0]

    if no_combat:
        print(f'\nSessions with no combat ({len(no_combat)}):')
        for s in no_combat:
            print(f'  - {s["session"]}')

    if no_descents:
        print(f'\nSessions with no level descents ({len(no_descents)}):')
        for s in no_descents:
            print(f'  - {s["session"]}')

    # Print some details for sessions with activity
    print('\n=== Combat Details (first 5 sessions with combat) ===')
    combat_sessions = [s for s in all_stats if s['combat_hits'] > 0][:5]
    for s in combat_sessions:
        print(f'\n{s["session"]}:')
        for d in s['combat_details'][:3]:
            print(f'  - {d["msg"]}')


if __name__ == '__main__':
    main()
