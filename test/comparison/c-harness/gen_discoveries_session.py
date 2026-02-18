#!/usr/bin/env python3
"""Generate a session trace that tests the \\ (discoveries) command.

Uses seed 2 where Valkyrie gets an oil lamp, making discoveries
interesting (weapons + armor classes are known).

Usage:
    python3 gen_discoveries_session.py [seed]

Output: test/comparison/sessions/interface_discoveries.session.json
"""

import sys
import os
import json
import importlib.util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')

# Import run_session helpers
_spec = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

compact_session_json = _mod.compact_session_json


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    output = os.path.join(SESSIONS_DIR, 'interface_discoveries.session.json')

    # Keys: \ (discoveries), then spaces to page through, then final space exits pager
    # run_interface_session with auto_clear_more=False preserves pager pages
    keys = '\\   '  # backslash + 3 spaces to page through discoveries

    _mod.run_interface_session(seed, output, keys, verbose=True)

    # Patch the session metadata
    with open(output) as f:
        data = json.load(f)
    data['regen']['subtype'] = 'in-game'
    data['options']['description'] = 'Discoveries (\\) command at game start — Valkyrie with oil lamp'
    with open(output, 'w') as f:
        f.write(compact_session_json(data))

    print(f'Output: {output}')


if __name__ == '__main__':
    main()
