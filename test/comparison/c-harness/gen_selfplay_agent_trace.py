#!/usr/bin/env python3
"""Generate selfplay trace using the actual AI agent.

This integrates with c_runner.js but captures the full session format
with RNG logs, screens, and typGrids for comparison testing.

Usage:
    python3 gen_selfplay_agent_trace.py <seed> [--turns N]
    python3 gen_selfplay_agent_trace.py 4 --turns 100
"""

import sys
import os
import json
import time
import subprocess
import tempfile
import importlib.util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
INSTALL_DIR = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir')
NETHACK_BINARY = os.path.join(INSTALL_DIR, 'nethack')

# Import shared helpers from run_session.py
_spec = importlib.util.spec_from_file_location('run_session', os.path.join(SCRIPT_DIR, 'run_session.py'))
_session = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_session)

parse_rng_lines = _session.parse_rng_lines
compact_session_json = _session.compact_session_json


def generate_agent_trace(seed, max_turns=100):
    """Run c_runner.js and capture its tmux session for full trace."""

    print(f'=== Generating AI agent trace: seed={seed}, turns={max_turns} ===')

    # Run c_runner.js with trace capture
    # We'll use a custom wrapper that captures RNG logs and screens
    c_runner_path = os.path.join(PROJECT_ROOT, 'selfplay', 'runner', 'c_runner.js')

    if not os.path.isfile(c_runner_path):
        print(f"Error: c_runner.js not found at {c_runner_path}")
        sys.exit(1)

    # For now, invoke c_runner.js directly and let it do its thing
    # Then we'll need to extract the session data from tmux
    # This is complex - let's use a simpler approach: modify gen_selfplay_trace.py
    # to call a helper that queries the agent

    print("This script needs integration work. Use gen_selfplay_trace_v2.py instead.")
    sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <seed> [--turns N]")
        sys.exit(1)

    seed = int(sys.argv[1])
    max_turns = 100

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--turns' and i + 1 < len(sys.argv):
            max_turns = int(sys.argv[i + 1])
            i += 2
        else:
            i += 1

    generate_agent_trace(seed, max_turns)
