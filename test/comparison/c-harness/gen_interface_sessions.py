#!/usr/bin/env python3
"""Generate interface session traces from C NetHack for UI accuracy testing.

Captures:
1. Startup sequence (tutorial prompt, copyright screen)
2. Options menu (dense listing with [x] marks, ? help view)
3. Terminal attributes (inverse video, bold, etc.)

Usage:
    python3 gen_interface_sessions.py --startup
    python3 gen_interface_sessions.py --options

Output: test/comparison/sessions/interface_*.session.json
"""

import sys
import os
import json
import time
import subprocess
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
SESSIONS_DIR = os.path.join(PROJECT_ROOT, 'test', 'comparison', 'sessions')
NETHACK_BINARY = os.path.join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir', 'nethack')

def tmux_session_name():
    """Generate unique tmux session name."""
    return f"nethack-interface-{os.getpid()}"

def start_tmux_session(session):
    """Start a tmux session with 80x24 dimensions."""
    subprocess.run([
        'tmux', 'new-session', '-d', '-s', session,
        '-x', '80', '-y', '24'
    ], check=True)
    time.sleep(0.1)

def tmux_send(session, keys, delay=0.2):
    """Send keys to tmux session."""
    subprocess.run(['tmux', 'send-keys', '-t', session, keys], check=True)
    time.sleep(delay)

def capture_screen_with_attrs(session):
    """Capture screen content AND attributes from tmux.

    Returns:
        tuple: (lines, attrs) where both are 24-element arrays
        - lines: plain text content
        - attrs: attribute codes (0=normal, 1=inverse, 2=bold, etc.)
    """
    # Capture plain text
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-J'],
        capture_output=True, text=True, check=True
    )
    lines = result.stdout.rstrip('\n').split('\n')
    while len(lines) < 24:
        lines.append('')
    lines = lines[:24]

    # Capture with escape codes to parse attributes
    result_esc = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-e'],
        capture_output=True, text=True, check=True
    )

    # Parse escape codes to build attribute array
    attrs = parse_attributes(result_esc.stdout, lines)

    return lines, attrs

def parse_attributes(escaped_text, plain_lines):
    """Parse ANSI escape codes to build attribute array.

    Returns array of 24 strings, each 80 chars, with attribute codes:
    - '0' = normal
    - '1' = inverse/reverse video
    - '2' = bold
    - '4' = underline
    """
    import re

    # ANSI escape sequence pattern: \x1b[...m
    # Common codes: 0=reset, 1=bold, 4=underline, 7=inverse, 22=bold off, 24=underline off, 27=inverse off
    escape_pattern = re.compile(r'\x1b\[([0-9;]+)m')

    attrs = []
    for row_idx, plain_line in enumerate(plain_lines):
        # Build attribute string for this row
        row_attrs = ['0'] * 80

        # Find corresponding line in escaped text
        # Split escaped text by newlines and process line by line
        escaped_lines = escaped_text.split('\n')
        if row_idx < len(escaped_lines):
            escaped_line = escaped_lines[row_idx]

            # Track current attributes as we scan through the line
            current_attr = 0  # Start with normal
            char_pos = 0  # Position in the actual displayed text (not including escape codes)

            i = 0
            while i < len(escaped_line):
                # Check for escape sequence
                match = escape_pattern.match(escaped_line, i)
                if match:
                    # Parse the SGR codes
                    codes = match.group(1).split(';')
                    for code in codes:
                        code_int = int(code) if code else 0
                        if code_int == 0:
                            current_attr = 0  # Reset
                        elif code_int == 1:
                            current_attr |= 2  # Bold (we use bit 1)
                        elif code_int == 4:
                            current_attr |= 4  # Underline (we use bit 2)
                        elif code_int == 7:
                            current_attr |= 1  # Inverse (we use bit 0)
                        elif code_int == 22:
                            current_attr &= ~2  # Bold off
                        elif code_int == 24:
                            current_attr &= ~4  # Underline off
                        elif code_int == 27:
                            current_attr &= ~1  # Inverse off

                    i = match.end()
                else:
                    # Regular character
                    if char_pos < 80:
                        row_attrs[char_pos] = str(current_attr)
                    char_pos += 1
                    i += 1

        attrs.append(''.join(row_attrs))

    # Ensure we have exactly 24 rows
    while len(attrs) < 24:
        attrs.append('0' * 80)

    return attrs[:24]

def kill_tmux_session(session):
    """Kill the tmux session."""
    subprocess.run(['tmux', 'kill-session', '-t', session],
                   stderr=subprocess.DEVNULL, check=False)

def capture_startup_sequence():
    """Capture the full startup sequence including tutorial prompt."""
    session = tmux_session_name()
    start_tmux_session(session)

    steps = []

    try:
        # Set up environment and run NetHack
        nethack_dir = os.path.dirname(NETHACK_BINARY)

        # Clear screen first
        subprocess.run(['tmux', 'send-keys', '-t', session, 'clear', 'Enter'], check=True)
        time.sleep(0.2)

        # Start NetHack with proper environment
        cmd = (
            f'NETHACKDIR={nethack_dir} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY}'
        )
        subprocess.run(['tmux', 'send-keys', '-t', session, cmd, 'Enter'], check=True)

        # Wait for NetHack to fully initialize and display
        time.sleep(2.5)

        # Capture initial screen (random character prompt + copyright)
        lines, attrs = capture_screen_with_attrs(session)
        steps.append({
            "key": "startup",
            "description": "Initial screen on game launch",
            "screen": lines,
            "attrs": attrs
        })

        # Press 'n' to decline random character
        if any('pick character' in line.lower() for line in lines):
            tmux_send(session, 'n', delay=0.5)
            lines, attrs = capture_screen_with_attrs(session)
            steps.append({
                "key": "n",
                "description": "Decline random character",
                "screen": lines,
                "attrs": attrs
            })

        # Should now be at role selection - capture it
        if any('role' in line.lower() or 'profession' in line.lower() for line in lines):
            steps.append({
                "key": "role_menu",
                "description": "Role selection menu",
                "screen": lines,
                "attrs": attrs
            })

            # Press '?' to see help/navigation
            tmux_send(session, '?', delay=0.5)
            lines, attrs = capture_screen_with_attrs(session)
            steps.append({
                "key": "?",
                "description": "Role menu help",
                "screen": lines,
                "attrs": attrs
            })

            # Press '?' again to go back
            tmux_send(session, '?', delay=0.5)
            lines, attrs = capture_screen_with_attrs(session)

            # Select archeologist (a)
            tmux_send(session, 'a', delay=0.5)
            lines, attrs = capture_screen_with_attrs(session)
            steps.append({
                "key": "a",
                "description": "Select Archeologist role",
                "screen": lines,
                "attrs": attrs
            })

    finally:
        kill_tmux_session(session)

    return {
        "version": 2,
        "type": "interface",
        "subtype": "startup",
        "description": "Game startup sequence including tutorial prompt",
        "steps": steps
    }

def capture_options_menu():
    """Capture the options menu interface."""
    session = tmux_session_name()
    start_tmux_session(session)

    steps = []

    try:
        # Set up environment and run NetHack
        nethack_dir = os.path.dirname(NETHACK_BINARY)

        # Clear screen
        subprocess.run(['tmux', 'send-keys', '-t', session, 'clear', 'Enter'], check=True)
        time.sleep(0.2)

        # Start NetHack with wizard mode
        cmd = (
            f'NETHACKDIR={nethack_dir} '
            f'TERM=xterm-256color '
            f'{NETHACK_BINARY} -u wizard -D'
        )
        subprocess.run(['tmux', 'send-keys', '-t', session, cmd, 'Enter'], check=True)
        time.sleep(2.5)

        # Capture startup
        lines, attrs = capture_screen_with_attrs(session)

        # Decline random character
        subprocess.run(['tmux', 'send-keys', '-t', session, 'n', 'Enter'], check=True)
        time.sleep(0.5)

        # Auto-select wizard by pressing Enter through role selection
        subprocess.run(['tmux', 'send-keys', '-t', session, 'Enter'], check=True)
        time.sleep(0.5)

        # Should be in game now - wait for it to load
        time.sleep(1.0)

        # Open options menu with 'O'
        subprocess.run(['tmux', 'send-keys', '-t', session, 'O'], check=True)
        time.sleep(0.5)

        lines, attrs = capture_screen_with_attrs(session)
        steps.append({
            "key": "O",
            "description": "Options menu page 1",
            "screen": lines,
            "attrs": attrs
        })

        # Press '>' for page 2
        subprocess.run(['tmux', 'send-keys', '-t', session, '>'], check=True)
        time.sleep(0.3)

        lines, attrs = capture_screen_with_attrs(session)
        steps.append({
            "key": ">",
            "description": "Options menu page 2",
            "screen": lines,
            "attrs": attrs
        })

        # Press '<' to go back to page 1
        subprocess.run(['tmux', 'send-keys', '-t', session, '<'], check=True)
        time.sleep(0.3)

        lines, attrs = capture_screen_with_attrs(session)
        steps.append({
            "key": "<",
            "description": "Back to options page 1",
            "screen": lines,
            "attrs": attrs
        })

        # Press '?' for help view
        subprocess.run(['tmux', 'send-keys', '-t', session, '?'], check=True)
        time.sleep(0.3)

        lines, attrs = capture_screen_with_attrs(session)
        steps.append({
            "key": "?",
            "description": "Options help view",
            "screen": lines,
            "attrs": attrs
        })

    finally:
        kill_tmux_session(session)

    return {
        "version": 2,
        "type": "interface",
        "subtype": "options",
        "description": "Options menu interface with all views",
        "steps": steps
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: gen_interface_sessions.py [--startup|--options]")
        sys.exit(1)

    os.makedirs(SESSIONS_DIR, exist_ok=True)

    if sys.argv[1] == '--startup':
        data = capture_startup_sequence()
        outfile = os.path.join(SESSIONS_DIR, 'interface_startup.session.json')
    elif sys.argv[1] == '--options':
        data = capture_options_menu()
        outfile = os.path.join(SESSIONS_DIR, 'interface_options.session.json')
    else:
        print(f"Unknown option: {sys.argv[1]}")
        sys.exit(1)

    with open(outfile, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"✅ Generated {outfile}")
    print(f"   {len(data['steps'])} steps captured")

if __name__ == '__main__':
    main()
