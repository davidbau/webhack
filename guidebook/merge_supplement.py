#!/usr/bin/env python3
"""Merge the Menace supplement into the NetHack Guidebook.

Reads guidebook-base.md and menace-supplement.md, replaces sections
9.2 through 9.18 with the supplement content, adds Menace credits,
and outputs guidebook.md.
"""

import re
import sys


def parse_supplement(supplement_file):
    """Parse supplement file, extracting content after the header comments."""
    with open(supplement_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Skip header comments (lines starting with #)
    content_start = 0
    for i, line in enumerate(lines):
        if not line.startswith('#'):
            content_start = i
            break

    return ''.join(lines[content_start:])


MENACE_CREDITS = '''
### 12.3. Menace Edition (Royal Jelly)

The Menace edition is a JavaScript port of NetHack 3.7, playable in
any modern web browser. It was created through **vibe coding** —
building software by collaborating with LLM coding agents rather
than writing every line by hand.

**David Bau** assisted by **Claude** and **Codex** vibe coding agents.

*You hear a low buzzing.*

This is the **Royal Jelly** — the sweet output of The Hive.

Project: [https://github.com/davidbau/menace](https://github.com/davidbau/menace)

Play: [https://mazesofmenace.net/](https://mazesofmenace.net/)

'''


def merge_guidebook(base_file, supplement_file, output_file):
    """Merge supplement into guidebook, replacing sections 9.2-9.18 and adding credits."""

    with open(base_file, 'r', encoding='utf-8') as f:
        guidebook = f.read()

    supplement = parse_supplement(supplement_file)

    # Find section 9.2 start (### 9.2.)
    section_92_match = re.search(r'^### 9\.2\..*$', guidebook, re.MULTILINE)
    if not section_92_match:
        print(f"Error: Could not find section 9.2 in {base_file}", file=sys.stderr)
        sys.exit(1)

    # Find section 10 start (## 10.)
    section_10_match = re.search(r'^## 10\..*$', guidebook, re.MULTILINE)
    if not section_10_match:
        print(f"Error: Could not find section 10 in {base_file}", file=sys.stderr)
        sys.exit(1)

    # Extract parts
    before_92 = guidebook[:section_92_match.start()]
    after_918 = guidebook[section_10_match.start():]

    # Combine: before 9.2 + supplement + section 10 onwards
    merged = before_92 + supplement.strip() + '\n\n' + after_918

    # Add Menace credits at the end (after section 12.2)
    merged = merged.rstrip() + '\n' + MENACE_CREDITS

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(merged)

    print(f"Merged {base_file} + {supplement_file} -> {output_file}")

    # Count sections replaced
    orig_section_count = len(re.findall(r'^### 9\.\d+\.', guidebook, re.MULTILINE))
    new_section_count = len(re.findall(r'^### 9\.\d+\.', merged, re.MULTILINE))
    print(f"  Original section 9 subsections: {orig_section_count}")
    print(f"  New section 9 subsections: {new_section_count}")
    print(f"  Added section 12.3 (Menace Edition credits)")


if __name__ == '__main__':
    base_file = 'guidebook-base.md'
    supplement_file = 'menace-supplement.md'
    output_file = 'guidebook.md'

    if len(sys.argv) > 1:
        base_file = sys.argv[1]
    if len(sys.argv) > 2:
        supplement_file = sys.argv[2]
    if len(sys.argv) > 3:
        output_file = sys.argv[3]

    merge_guidebook(base_file, supplement_file, output_file)
