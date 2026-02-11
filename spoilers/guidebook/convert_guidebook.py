#!/usr/bin/env python3
"""Convert the official NetHack Guidebook from plain text to Markdown."""

import re
import sys

def convert_guidebook(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    output = []
    in_code_block = False
    prev_line_empty = True

    for i, line in enumerate(lines):
        # Remove trailing whitespace but preserve leading spaces
        line = line.rstrip()

        # Skip the opening title and metadata (first ~9 lines)
        if i < 9:
            if i == 0:
                output.append('# A Guide to the Mazes of Menace\n')
                output.append('\n')
                output.append('*Guidebook for NetHack*\n')
                output.append('\n')
            elif 'Eric S. Raymond' in line:
                output.append('> ' + line.strip() + '\n')
            elif 'Edited and expanded' in line or 'Mike Stephenson' in line:
                output.append('> ' + line.strip() + '\n')
            elif 'December' in line or '202' in line:
                output.append('> ' + line.strip() + '\n')
                output.append('\n')
                output.append('---\n')
                output.append('\n')
            continue

        # Main section headings (e.g., "     1.  Introduction")
        main_section = re.match(r'^     (\d+)\.\s+(.+)$', line)
        if main_section:
            num, title = main_section.groups()
            output.append(f'\n## {num}. {title}\n\n')
            prev_line_empty = True
            continue

        # Subsection headings (e.g., "     3.1.  The status lines (bottom)")
        subsection = re.match(r'^     (\d+\.\d+)\.\s+(.+)$', line)
        if subsection:
            num, title = subsection.groups()
            output.append(f'\n### {num}. {title}\n\n')
            prev_line_empty = True
            continue

        # Sub-subsection headings (e.g., "     5.4.1.  Shop idiosyncrasies")
        subsubsection = re.match(r'^     (\d+\.\d+\.\d+)\.\s+(.+)$', line)
        if subsubsection:
            num, title = subsubsection.groups()
            output.append(f'\n#### {num}. {title}\n\n')
            prev_line_empty = True
            continue

        # Empty lines
        if not line:
            if not prev_line_empty:
                output.append('\n')
            prev_line_empty = True
            continue

        # Lines with significant indentation might be lists or code
        if line.startswith('          '):
            # This looks like body text (10+ spaces) - remove leading spaces
            cleaned = line.strip()
            if cleaned:
                output.append(cleaned + '\n')
                prev_line_empty = False
        elif line.startswith('     '):
            # 5 spaces - might be section marker or continuation
            cleaned = line.strip()
            if cleaned and not cleaned[0].isdigit():
                # Not a section number, treat as normal text
                output.append(cleaned + '\n')
                prev_line_empty = False
            else:
                # Might be a section number we missed, just output it
                output.append(cleaned + '\n')
                prev_line_empty = False
        else:
            # Normal line or less indented - preserve as-is
            cleaned = line.strip()
            if cleaned:
                output.append(cleaned + '\n')
                prev_line_empty = False

    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(output)

    print(f"Converted {input_file} -> {output_file}")
    print(f"Output: {len(output)} lines")

if __name__ == '__main__':
    input_file = '../../docs/reference/Guidebook.txt'
    output_file = 'guidebook.md'
    convert_guidebook(input_file, output_file)
