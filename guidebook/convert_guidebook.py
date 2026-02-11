#!/usr/bin/env python3
"""Convert the official NetHack Guidebook from plain text to Markdown."""

import re
import sys

def convert_guidebook(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    output = []
    in_code_block = False
    in_ascii_diagram = False
    prev_line_empty = True

    for i, line in enumerate(lines):
        # Remove trailing whitespace but preserve leading spaces
        line = line.rstrip()

        # Skip page headers (NetHack 3.7.0 ... [Month] [Day], [Year])
        # These appear as headers with NetHack version and a date
        if 'NetHack 3.7.0' in line and re.search(r'\d{4}$', line.strip()):
            continue

        # Skip the opening title and metadata (first ~9 lines)
        if i < 9:
            if i == 0:
                output.append('# A Guide to the Mazes of Menace\n')
                output.append('\n')
                output.append('<p style="text-align: center; font-style: italic; margin: 1.5em 0;">Guidebook for NetHack</p>\n')
                output.append('\n')
            elif 'Eric S. Raymond' in line:
                output.append('> ' + line.strip() + '\n')
                output.append('>\n')  # Blank line in blockquote to separate items
            elif 'Edited and expanded' in line or 'Mike Stephenson' in line:
                output.append('> ' + line.strip() + '\n')
                output.append('>\n')  # Blank line in blockquote to separate items
            elif re.search(r'\d{4}$', line.strip()):  # Date line (any month, ends with year)
                # Wrap date in nobr span to prevent line wrapping
                date_text = line.strip()
                output.append('> <span class="nobr">' + date_text + '</span>\n')
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

        # Check for ASCII diagram start (lines with +------+ patterns, may be indented)
        if re.match(r'^\s*\+[-=]+\+\s*$', line.rstrip()) and not in_ascii_diagram:
            in_ascii_diagram = True
            output.append('```\n')
            output.append(line + '\n')  # Preserve exact formatting
            prev_line_empty = False
            continue

        # Check for ASCII diagram end (lines like +---Figure-1---+ or +----+)
        if in_ascii_diagram and re.match(r'^\s*\+[-=A-Za-z0-9\s]*\+\s*$', line.rstrip()):
            output.append(line + '\n')  # Preserve exact formatting
            output.append('```\n\n')
            in_ascii_diagram = False
            prev_line_empty = True
            continue

        # Inside ASCII diagram - preserve exact formatting including all spaces
        if in_ascii_diagram:
            output.append(line + '\n')  # Preserve exact formatting
            prev_line_empty = False
            continue

        # Empty lines
        if not line:
            if not prev_line_empty:
                output.append('\n')
            prev_line_empty = True
            continue

        # Symbol definitions (indented: symbol + spaces + description)
        # e.g., "     #    A corridor, or iron bars..."
        symbol_def = re.match(r'^\s+([^\s])\s{4,}([A-Z].+)$', line)
        if symbol_def:
            symbol, description = symbol_def.groups()
            output.append(f'`{symbol}`    {description}\n')
            prev_line_empty = False
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

    # Post-process to wrap inline symbol references
    # e.g., "appear as #" -> "appear as `#`"
    processed_output = []
    for line in output:
        # Skip lines that are already in code blocks or headings
        if line.startswith('#') or line.startswith('```'):
            processed_output.append(line)
            continue

        # Wrap #commands (e.g., #attributes, #quit)
        # Match #command after space, start of line, or quote
        line = re.sub(r'(^|[\s"\(])(#[a-z]+)(\s|[,.\)\"]|$)', r'\1`\2`\3', line)

        # Wrap control character patterns
        # ^<key> pattern (generic placeholder)
        line = re.sub(r'\^<([a-z]+)>', r'`^<\1>`', line)
        # ^X, ^C etc. (specific keys)
        line = re.sub(r'\^([A-Z])\b', r'`^\1`', line)

        # Special case: ``' (backtick character) needs double backticks to escape
        # Convert ``' -> `` ` `` (backtick shown in code)
        line = re.sub(r"``'", r'`` ` ``', line)

        # Convert ASCII quotes around keys/commands to proper backticks
        # e.g., `m' -> `m` or `M-a' -> `M-a` or `?' -> `?`
        # Match any content between backtick and apostrophe (non-greedy)
        line = re.sub(r"`([^'`]+?)'", r'`\1`', line)

        # Wrap movement key patterns (vi keys)
        # [yuhjklbn], [YUHJKLBN], m[yuhjklbn], etc.
        # Match at word boundary or start of line
        line = re.sub(r'(^|\s)([mMfFgG]?\[yuhjklbn\])(\s|$)', r'\1`\2`\3', line)
        line = re.sub(r'(^|\s)(\[YUHJKLBN\])(\s|$)', r'\1`\2`\3', line)

        # Wrap <Control>+[yuhjklbn] pattern first
        line = re.sub(r'<Control>\+\[yuhjklbn\]', r'`<Control>+[yuhjklbn]`', line)

        # Wrap <X>+<Y> patterns (e.g., <Control>+<key>, <Control>+<direction>)
        line = re.sub(r'<(Control|Shift|Ctrl)>\+<([a-z]+)>', r'`<\1>+<\2>`', line)

        # Wrap standalone <key> references (avoiding those already in backticks)
        line = re.sub(r'(?<!`)<(Control|Shift|Ctrl|key|direction)>(?![+`])', r'`<\1>`', line)

        # Wrap NetHack option names
        # Pattern: option_name (with underscores) or optionname:value
        # Common options: number_pad, menustyle, statuslines, etc.
        # Handle option:value pairs first (before splitting them)
        line = re.sub(r'\b([a-z]+style):([a-z]+)', r'`\1:\2`', line)  # menustyle:traditional
        line = re.sub(r'\b(statuslines):([0-9]+)', r'`\1:\2`', line)  # statuslines:3
        # Then handle standalone options
        line = re.sub(r'\b([a-z]+_[a-z_]+)(\s|[,.\)]|$)', r'`\1`\2', line)
        line = re.sub(r'\b([a-z]+style)(\s|[,.\)]|$)', r'`\1`\2', line)  # *style options

        # Wrap special key names (ESC, SPACE, RETURN, etc.)
        line = re.sub(r'\b(ESC|SPACE|RETURN|ENTER|TAB|DELETE|BACKSPACE)\b', r'`\1`', line)

        # Wrap configuration file syntax (OPTIONS=, CHOOSE=, [section])
        # These are configuration file examples that should be in code blocks
        if line.startswith('OPTIONS=') or line.startswith('CHOOSE=') or re.match(r'^\[.*\]', line):
            line = '    ' + line  # Indent with 4 spaces to make it a code block in markdown

        # Wrap environment variable names (HACKDIR, LEVELDIR, etc.)
        # These are definition terms, wrap in inline code
        line_stripped = line.rstrip('\n')
        if re.match(r'^([A-Z_]+)$', line_stripped) and len(line_stripped) > 2:
            line = '**`' + line_stripped + '`**\n'  # Bold code for visibility

        # Wrap single symbols in common phrases
        # Pattern: "as X" or "shown as X" where X is a single non-alphanumeric char
        line = re.sub(r'\bas ([#@$%^&*+|<>._-])(\s)', r'as `\1`\2', line)
        line = re.sub(r'\bshown as ([#@$%^&*+|<>._-])(\s)', r'shown as `\1`\2', line)
        processed_output.append(line)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(processed_output)

    print(f"Converted {input_file} -> {output_file}")
    print(f"Output: {len(output)} lines")

if __name__ == '__main__':
    input_file = '../docs/reference/Guidebook.txt'
    output_file = 'guidebook.md'
    convert_guidebook(input_file, output_file)
