#!/usr/bin/env python3
"""Convert the official NetHack Guidebook from nroff source (.mn) to Markdown.

Parses Guidebook.mn (nroff with tmac.n/tmac.nh macros) and produces
guidebook.md suitable for pandoc conversion to HTML.
"""

import re
import sys


def _is_code_like(s):
    """Check if a quoted string looks like a keystroke, command, or code reference."""
    s = s.strip()
    if not s:
        return False
    # Single character or symbol - almost certainly a keystroke/symbol
    # (must check before backtick/asterisk bailouts below)
    if len(s) == 1:
        return True
    # Already has backticks - don't double-wrap
    if '`' in s:
        return False
    # Contains markdown formatting (bold/italic) - don't wrap in backticks
    # as that would make the formatting literal
    if '*' in s:
        return False
    # Very short strings that are clearly keys/codes
    if len(s) <= 3 and not s[0].isupper():
        return True
    # #command references
    if s.startswith('#'):
        return True
    # Control/Meta key combos: ^X, M-x, etc.
    if re.match(r'^\^[A-Za-z]$', s) or re.match(r'^M-[A-Za-z]$', s):
        return True
    # Key names with special chars: [yuhjklbn], <esc>, etc.
    if s.startswith('[') or s.startswith('<'):
        return True
    # Config patterns: option:value, OPTIONS=value, etc.
    if '=' in s or (':' in s and not s.endswith(':')):
        return True
    # Short single-word strings that look like commands/options
    if len(s) <= 20 and ' ' not in s:
        return True
    # Game prompts containing option lists like [a-zA-Z ?*]
    if '[' in s and ']' in s and '?' in s:
        return True
    # Short phrases that look like status/game terms (no articles/prepositions)
    if len(s) <= 15 and not any(w in s.lower().split() for w in
            ['the', 'a', 'an', 'is', 'to', 'do', 'you', 'it', 'of', 'in',
             'or', 'and', 'for', 'are', 'your', 'this', 'that', 'what',
             'with', 'be', 'not', 'on', 'will', 'have', 'can']):
        return True
    return False


def convert_guidebook(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8', errors='replace') as f:
        raw_lines = f.readlines()

    # Pre-process: handle line continuations (\<newline>)
    lines = []
    i = 0
    while i < len(raw_lines):
        line = raw_lines[i].rstrip('\n')
        # Handle backslash continuation (line ending with \)
        # But not \\ (escaped backslash) or lines ending with \" (comment)
        while line.endswith('\\') and not line.endswith('\\\\'):
            i += 1
            if i < len(raw_lines):
                line = line[:-1] + raw_lines[i].rstrip('\n')
            else:
                line = line[:-1]
                break
        lines.append(line)
        i += 1

    # State
    output = []
    # Section numbering registers (h0=major, h1=sub, h2=subsub, h3=subsubsub)
    h = [0, 0, 0, 0]
    in_title = False        # Between .mt and .bt (first .pg)
    title_done = False      # Has .bt been called?
    in_author = False       # Between .au and next .hn or .pg
    in_display = False      # Inside .sd/.ed or .SD/.ED
    display_is_code = False # Is the display a code block (has .ft CR)?
    display_cc_items = []   # Accumulated .CC items inside display blocks
    in_table = False        # Inside .TS/.TE
    table_format_done = False
    table_has_box = False
    table_has_header = False # Multi-line format spec = has header row
    table_tab = '\t'
    table_cols = []         # Column alignment specs
    table_rows = []         # Accumulated table rows
    table_text_block = None # T{ ... T} accumulator
    in_code_font = False    # .ft CR active
    char_translations = {}  # .tr character translations
    indent_level = 0        # .si/.ei nesting
    in_ps_list = False      # Inside .PS/.PE
    prev_was_blank = True   # Track blank lines to avoid doubles
    pending_lp = None       # Pending .lp label (deferred until we see content)
    lp_continuations = []   # Buffered .lp labels ending in "and" (for combining)
    in_centered = False     # .ce active
    center_count = 0        # Lines remaining for .ce
    # String variables (.ds)
    strings = {}

    def emit(text=''):
        """Emit a line of output."""
        nonlocal prev_was_blank
        if text == '':
            if not prev_was_blank:
                output.append('\n')
                prev_was_blank = True
        else:
            output.append(text + '\n')
            prev_was_blank = (text == '')

    def flush_cc_items():
        """Emit accumulated .CC items as a table."""
        nonlocal display_cc_items
        if display_cc_items:
            emit()
            emit('| Key | Description |')
            emit('| --- | --- |')
            for key, defn in display_cc_items:
                defn_escaped = defn.replace('|', '\\|')
                key_escaped = key.replace('|', '\\|')
                emit(f'| `{key_escaped}` | {defn_escaped} |')
            emit()
            display_cc_items = []

    def format_lp_label(label):
        """Format a .lp label for output."""
        label = process_inline(label)
        # Handle bare backtick character (key label)
        if label == '`':
            return '`` ` ``'
        # If label already has inline formatting (backticks, bold, italic),
        # don't wrap in additional backticks.
        # Check for actual markdown formatting, not bare * or **
        if '`' in label or (label.startswith('*') and len(label) > 2):
            return label
        # Labels with " or " separator: backtick each alternative
        # e.g. "G[yuhjklbn] or <Control>+[yuhjklbn]"
        if ' or ' in label:
            parts = label.split(' or ')
            return ' or '.join(f'`{p.strip()}`' for p in parts)
        # If label looks like a sentence (long with spaces, has common words),
        # emit as-is without code formatting
        elif len(label) > 20 and ' ' in label:
            return label
        else:
            return f'`{label}`'

    def _get_lp_prefix():
        """Get buffered continuation labels as prefix text, and clear the buffer."""
        nonlocal lp_continuations
        if lp_continuations:
            prefix = ' '.join(lp_continuations) + ' '
            lp_continuations = []
            return prefix
        return ''

    def flush_pending_lp():
        """If there's a pending .lp label, emit it standalone (no text to combine with)."""
        nonlocal pending_lp
        if pending_lp is not None:
            label = pending_lp
            pending_lp = None
            prefix = _get_lp_prefix()
            if label == '':
                # Continuation paragraph (no label) - no blank line,
                # text will flow as continuation of previous entry
                if prefix:
                    emit(prefix.rstrip())
            elif label == '\x04bullet':
                # Bullet item with no text - shouldn't happen, but handle
                emit('- ')
            else:
                emit()
                emit(prefix + format_lp_label(label))

    def expand_strings(text):
        """Expand \\*(xx or \\*x string references."""
        def repl(m):
            name = m.group(1) or m.group(2)
            return strings.get(name, '')
        text = re.sub(r'\\\*\((\w\w)', repl, text)
        text = re.sub(r'\\\*(\w)', repl, text)
        return text

    def process_special_chars(text):
        """Convert nroff special character escapes to Unicode/ASCII."""
        # Two-char special characters: \(xx
        char_map = {
            'lq': '\u201c',  # left double quote
            'rq': '\u201d',  # right double quote
            'oq': '\u2018',  # left single quote
            'cq': '\u2019',  # right single quote
            'aq': "'",       # apostrophe
            'dq': '"',       # double quote
            'em': '\u2014',  # em dash
            'ha': '^',       # caret
            'ti': '~',       # tilde
            'rs': '\\',      # backslash
            'bu': '\u2022',  # bullet
        }
        for code, char in char_map.items():
            text = text.replace(f'\\({code}', char)

        # Handle double-backslash sequences (nroff \\X = escaped \X)
        # \\- -> - (escaped minus), \\\\ -> \\ -> \ (two levels)
        text = text.replace('\\\\-', '-')
        text = text.replace('\\\\', '\\')
        # Second pass for quad-backslash (\\\\ -> \\ -> \)
        text = text.replace('\\\\', '\\')
        # \- -> - (minus/hyphen)
        text = text.replace('\\-', '-')
        # \& -> zero-width (strip)
        text = text.replace('\\&', '')
        # \e -> backslash
        text = text.replace('\\e', '\\')
        # \~ -> non-breaking space
        text = text.replace('\\~', '\u00a0')
        # \0 -> digit-width space
        text = text.replace('\\0', ' ')
        # \  (backslash space) -> non-breaking space
        text = text.replace('\\ ', '\u00a0')
        # \c -> line continuation (strip, handled elsewhere)
        text = text.replace('\\c', '')
        # \` -> grave accent
        text = text.replace('\\`', '`')

        return text

    # Sentinel character for backtick delimiters in code spans.
    # Used during font escape processing to prevent process_special_chars
    # from accidentally consuming backslashes adjacent to real backticks.
    _CODE_TICK = '\x01'

    def _clean_code_content(s):
        """Process nroff escapes within collected code content."""
        # Handle nroff escapes that appear inside \f(CR...\fP
        s = s.replace('\\\\', '\x03')  # temp placeholder for literal backslash
        s = s.replace('\\-', '-')
        s = s.replace('\\&', '')
        s = s.replace('\\`', '`')
        s = s.replace('\\e', '\x03')
        s = s.replace('\x03', '\\')  # restore backslashes
        return s

    def _wrap_code(content):
        """Wrap content in code span using sentinel characters."""
        content = _clean_code_content(content)
        content = content.strip()
        if not content:
            return ''
        if '`' in content:
            return f'{_CODE_TICK}{_CODE_TICK} {content} {_CODE_TICK}{_CODE_TICK}'
        else:
            return f'{_CODE_TICK}{content}{_CODE_TICK}'

    def process_font_escapes(text):
        """Convert inline font escapes to Markdown formatting."""
        # \f(CR...\fP or \f(CR...\fR -> `...` (code)
        # Handle nested: \f(CR...\fI...\fP...\fP cases
        # Process from innermost out

        # First, handle \f(CR...\fP and \f(CR...\fR (code font)
        # Allow other font changes inside (they'll be stripped)
        result = ''
        i = 0
        while i < len(text):
            if text[i:i+4] == '\\f(C' and i + 5 < len(text) and text[i+4] == 'R':
                # Start of code font
                i += 5
                code_content = ''
                while i < len(text):
                    if text[i:i+3] in ('\\fP', '\\fR'):
                        i += 3
                        break
                    elif text[i:i+3] == '\\fI' or text[i:i+3] == '\\fB':
                        # Nested font change inside code - just strip
                        i += 3
                    elif text[i:i+4] == '\\f(C' and i + 5 < len(text) and text[i+4] == 'R':
                        # Re-entering code font
                        i += 5
                    else:
                        code_content += text[i]
                        i += 1
                result += _wrap_code(code_content)
            elif text[i:i+3] == '\\fI':
                # Italic
                i += 3
                italic_content = ''
                while i < len(text):
                    if text[i:i+3] in ('\\fP', '\\fR'):
                        i += 3
                        break
                    elif text[i:i+3] == '\\fB':
                        # Bold inside italic - just consume
                        i += 3
                    elif text[i:i+3] == '\\fI':
                        # Re-entering italic
                        i += 3
                    elif text[i:i+4] == '\\f(C':
                        # Code font inside italic
                        i += 5  # skip \f(CR
                        code_part = ''
                        while i < len(text):
                            if text[i:i+3] in ('\\fP', '\\fR', '\\fI'):
                                i += 3
                                break
                            else:
                                code_part += text[i]
                                i += 1
                        italic_content += _wrap_code(code_part)
                    else:
                        italic_content += text[i]
                        i += 1
                italic_content = italic_content.strip()
                if italic_content:
                    result += f'*{italic_content}*'
            elif text[i:i+3] == '\\fB':
                # Bold
                i += 3
                bold_content = ''
                while i < len(text):
                    if text[i:i+3] in ('\\fP', '\\fR'):
                        i += 3
                        break
                    elif text[i:i+3] == '\\fI':
                        # Italic inside bold
                        i += 3
                    elif text[i:i+3] == '\\fB':
                        # Re-entering bold
                        i += 3
                    elif text[i:i+4] == '\\f(C':
                        i += 5
                        code_part = ''
                        while i < len(text):
                            if text[i:i+3] in ('\\fP', '\\fR', '\\fB'):
                                i += 3
                                break
                            else:
                                code_part += text[i]
                                i += 1
                        bold_content += _wrap_code(code_part)
                    else:
                        bold_content += text[i]
                        i += 1
                bold_content = bold_content.strip()
                if bold_content:
                    result += f'**{bold_content}**'
            elif text[i:i+3] in ('\\fP', '\\fR'):
                # Stray font reset - skip
                i += 3
            else:
                result += text[i]
                i += 1

        return result

    def process_inline(text):
        """Process all inline formatting in a text line."""
        text = expand_strings(text)
        text = process_font_escapes(text)
        text = process_special_chars(text)
        # Convert code span sentinels to actual backticks
        text = text.replace(_CODE_TICK, '`')
        return text

    def strip_quotes(s):
        """Strip surrounding double quotes from a macro argument."""
        s = s.strip()
        if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
            return s[1:-1]
        # Also strip just leading quote (nroff allows unbalanced quotes)
        if s.startswith('"'):
            return s[1:]
        return s

    def parse_macro_args(rest):
        """Parse the arguments after a macro name.
        Handles quoted strings and unquoted words."""
        args = []
        rest = rest.strip()
        while rest:
            if rest[0] == '"':
                # Quoted argument - find closing quote
                end = rest.find('"', 1)
                if end == -1:
                    args.append(rest[1:])
                    break
                args.append(rest[1:end])
                rest = rest[end+1:].strip()
            else:
                # Unquoted - take until space
                parts = rest.split(None, 1)
                args.append(parts[0])
                rest = parts[1] if len(parts) > 1 else ''
        return args

    def _table_cell(text):
        """Process and escape a table cell value for markdown."""
        text = process_inline(text)
        # Escape pipe characters
        text = text.replace('|', '\\|')
        # Wrap bare backticks to avoid breaking markdown tables
        stripped = text.strip()
        if stripped == '`':
            text = '`` ` ``'
        # Wrap identifier-like cells in backtick code
        # (lowercase words with hyphens/underscores, or short all-caps)
        elif ('`' not in stripped and stripped and
              (re.match(r'^[a-z][a-z0-9_-]*$', stripped) or
               re.match(r'^[A-Z]{1,4}$', stripped)) and
              len(stripped) >= 2):
            text = f'`{stripped}`'
        return text

    def emit_table():
        """Emit accumulated table data as markdown."""
        nonlocal table_rows, table_cols, table_has_box, table_has_header
        if not table_rows:
            return

        # Ensure blank line before table (required by pandoc)
        emit()

        # Clean up any remaining continuation/placeholder markers
        for row in table_rows:
            for j in range(len(row)):
                if row[j] in ('\x00CONT\x00', '\x00TBLOCK\x00'):
                    row[j] = ''

        # Determine number of columns from data
        max_cols = max(len(row) for row in table_rows) if table_rows else 0
        if max_cols == 0:
            return

        # For boxed tables (like ASCII art figures), emit as code block
        # This covers single-column figures and multi-column diagrams (Figure 3)
        if table_has_box and in_code_font:
            # Process all cells first, then pad columns to align
            processed_rows = []
            for row in table_rows:
                processed_cells = []
                for cell in row:
                    cell = expand_strings(cell)
                    cell = re.sub(r'\\f\(CR', '', cell)
                    cell = re.sub(r'\\f[IBPR]', '', cell)
                    cell = process_special_chars(cell)
                    for from_c, to_c in char_translations.items():
                        cell = cell.replace(from_c, to_c)
                    processed_cells.append(cell)
                processed_rows.append(processed_cells)
            # Calculate max width for each column
            col_widths = [0] * max_cols
            for row in processed_rows:
                for j, cell in enumerate(row):
                    if j < max_cols:
                        col_widths[j] = max(col_widths[j], len(cell))
            emit('```')
            for row in processed_rows:
                if len(row) == 1:
                    emit(row[0])
                else:
                    parts = []
                    for j, cell in enumerate(row):
                        col_align = table_cols[j] if j < len(table_cols) else 'l'
                        if j < len(row) - 1:
                            if col_align == 'c':
                                parts.append(cell.center(col_widths[j]))
                            else:
                                parts.append(cell.ljust(col_widths[j]))
                        else:
                            if col_align == 'c':
                                parts.append(cell.center(col_widths[j]))
                            else:
                                parts.append(cell)
                    emit('   '.join(parts))
            emit('```')
            emit()
            return

        if max_cols == 1 and table_has_box:
            emit('```')
            for row in table_rows:
                cell = row[0] if row else ''
                emit(cell)
            emit('```')
            emit()
            return

        # For multi-column tables, build markdown table
        # Pad columns
        while len(table_cols) < max_cols:
            table_cols.append('l')

        # Build alignment row
        align_row = []
        for col in table_cols[:max_cols]:
            if col == 'c':
                align_row.append(':---:')
            elif col == 'r':
                align_row.append('---:')
            else:
                align_row.append('---')

        # Determine if first row is a header
        # Multi-line format specs in nroff indicate header row(s)
        # Also check for underscore separator after first row
        has_header = table_has_header
        if not has_header and len(table_rows) >= 2:
            # Check if second row is all underscores (separator)
            second = table_rows[1] if len(table_rows) > 1 else []
            if all(cell.strip().startswith('_') or cell.strip() == '' for cell in second):
                has_header = True

        if has_header and len(table_rows) >= 2:
            # First row is header, skip separator row if present
            header = table_rows[0]
            while len(header) < max_cols:
                header.append('')
            emit('| ' + ' | '.join(_table_cell(c) for c in header) + ' |')
            emit('| ' + ' | '.join(align_row) + ' |')
            # Skip separator row (underscores) if present
            start = 1
            if len(table_rows) > 1:
                second = table_rows[1]
                if all(cell.strip().startswith('_') or cell.strip() == '' for cell in second):
                    start = 2
            for row in table_rows[start:]:
                while len(row) < max_cols:
                    row.append('')
                emit('| ' + ' | '.join(_table_cell(c) for c in row) + ' |')
        else:
            # No header - emit empty header row for valid markdown
            if table_rows:
                empty_header = [''] * max_cols
                emit('| ' + ' | '.join(empty_header) + ' |')
                emit('| ' + ' | '.join(align_row) + ' |')
                for row in table_rows:
                    while len(row) < max_cols:
                        row.append('')
                    emit('| ' + ' | '.join(_table_cell(c) for c in row) + ' |')

        emit()

    # Main processing loop
    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1

        # Strip trailing whitespace
        line = line.rstrip()

        # Skip comment lines
        if line.startswith('.\\"') or line.startswith('.\\\"'):
            continue

        # Handle inline comments: strip \" and everything after
        # But be careful not to strip escaped \" inside text
        comment_match = re.search(r'(?:^|[^\\])\s*\\"', line)
        if comment_match and not line.startswith('.'):
            # For text lines, strip the comment
            pos = comment_match.start()
            if pos > 0:
                line = line[:pos+1].rstrip()

        # Handle .ds (define string)
        if line.startswith('.ds '):
            parts = line[4:].split(None, 1)
            if len(parts) >= 2:
                name = parts[0]
                val = parts[1]
                # Strip trailing comment
                cm = re.search(r'\s*\\"', val)
                if cm:
                    val = val[:cm.start()]
                strings[name] = val.strip()
            elif len(parts) == 1:
                strings[parts[0]] = ''
            continue

        # Handle tables
        if line == '.TS':
            in_table = True
            table_format_done = False
            table_has_box = False
            table_has_header = False
            table_format_lines = 0
            table_tab = '\t'
            table_cols = []
            table_rows = []
            table_text_block = None
            # Read table options and format spec
            continue

        if in_table:
            if line == '.TE':
                # Flush any pending text block
                if table_text_block is not None:
                    # shouldn't happen, but handle gracefully
                    pass
                emit_table()
                in_table = False
                continue

            # Skip comments inside tables
            if line.startswith('.\\"') or line.startswith('.\\\"'):
                continue
            # Skip certain directives inside tables
            if re.match(r'^\.(sp|ne|br|if|ie|el)\b', line):
                continue

            # Handle text blocks T{ ... T}
            if table_text_block is not None:
                if line.strip() == 'T}' or line.strip().startswith('T}'):
                    # End of text block
                    cell_text = ' '.join(table_text_block)
                    # Find the TBLOCK placeholder in the last row and replace it
                    if table_rows:
                        for j in range(len(table_rows[-1])):
                            if table_rows[-1][j] == '\x00TBLOCK\x00':
                                table_rows[-1][j] = cell_text
                                break
                    table_text_block = None
                    continue
                else:
                    table_text_block.append(line.strip())
                    continue

            if not table_format_done:
                # Parse table options line and format spec
                # Options line has keywords like: center, box, tab(x)
                # Format spec has column types like: l, c, r, L, C, R, with optional modifiers
                # Format spec ends with a period

                # Check for options (center, box, allbox, tab(x))
                stripped = line.strip().rstrip(';')
                if stripped.startswith('.'):
                    continue  # directive inside table preamble
                if 'tab(' in stripped:
                    m = re.search(r'tab\((.)\)', stripped)
                    if m:
                        table_tab = m.group(1)
                if 'box' in stripped.lower():
                    table_has_box = True

                # Check if this line ends with a period (format terminator)
                if line.rstrip().endswith('.'):
                    # This is the final format spec line
                    # If we already saw format lines before this one,
                    # the table has a header (multi-line format spec)
                    if table_format_lines > 0:
                        table_has_header = True
                    # Parse column alignment from format spec
                    fmt_part = line.rstrip().rstrip('.')
                    # Remove options keywords
                    fmt_part = re.sub(r'\b(center|box|allbox|tab\(.\))\b', '', fmt_part)
                    fmt_part = fmt_part.strip().rstrip(';').strip()
                    # Parse columns: l=left, c=center, r=right, s=span, n=numeric
                    # Modifiers like z, 1, 2, fCR etc follow the alignment char
                    cols = []
                    for ch in fmt_part:
                        if ch.lower() in ('l', 'c', 'r', 'n'):
                            cols.append(ch.lower())
                        elif ch.lower() == 's':
                            cols.append('l')  # span treated as left
                    if cols:
                        table_cols = cols
                    table_format_done = True
                elif ';' in stripped:
                    # Options-only line ending with semicolon
                    pass  # Continue reading format
                elif re.match(r'^[lcrnLCRNs\d\s.fwpz]+$', stripped.replace('fCR', '')):
                    # Looks like a format line without the period (header format)
                    table_format_lines += 1
                    # (multi-line format specs)
                    pass
                continue

            # Data line
            # Handle _ (horizontal rule) or = (double rule) rows
            if line.strip() in ('_', '=', '\\_', '\\_\t\\_\t\\_'):
                # Skip separator rows (we handle header detection differently)
                continue

            # Check for standalone T{ on its own line
            if line.strip() == 'T{':
                table_text_block = []
                continue

            # Split by table delimiter
            cells = line.split(table_tab)
            # Clean up cells and track \& continuation markers
            cleaned_cells = []
            has_continuation = False
            has_text_block_start = False
            for idx, cell in enumerate(cells):
                cell = cell.rstrip()  # preserve leading whitespace for code blocks
                if cell == '\\&':
                    has_continuation = True
                    cleaned_cells.append('\x00CONT\x00')  # continuation marker
                elif cell == 'T{' or cell.startswith('T{'):
                    # Text block starts in this cell
                    has_text_block_start = True
                    rest = cell[2:].strip()
                    table_text_block = [rest] if rest else []
                    # Save the row so far with a placeholder for this cell
                    cleaned_cells.append('\x00TBLOCK\x00')
                else:
                    cell = cell.replace('\\&', '')
                    cleaned_cells.append(cell)

            if has_text_block_start:
                # Save the partial row; will complete when T} found
                table_rows.append(cleaned_cells)
                continue

            if has_continuation:
                # This row has continuation markers - save it and wait for next
                table_rows.append(cleaned_cells)
            elif (table_rows and
                  any('\x00CONT\x00' in str(c) for c in table_rows[-1])):
                # Previous row had continuation markers - merge
                prev = table_rows[-1]
                for j in range(min(len(prev), len(cleaned_cells))):
                    if prev[j] == '\x00CONT\x00':
                        prev[j] = cleaned_cells[j]
                    elif cleaned_cells[j]:
                        if prev[j].endswith(','):
                            prev[j] = prev[j] + ' ' + cleaned_cells[j]
                        else:
                            prev[j] = prev[j] + ' ' + cleaned_cells[j]
            else:
                table_rows.append(cleaned_cells)
            continue

        # Handle display blocks
        if line in ('.sd', '.SD') or line.startswith('.SD ') or line.startswith('.sd '):
            flush_pending_lp()
            in_display = True
            display_is_code = False
            continue

        if line in ('.ed', '.ED'):
            if in_display:
                flush_cc_items()
                if display_is_code:
                    emit('```')
                in_display = False
                display_is_code = False
                emit()
            continue

        if in_display:
            # Flush CC items before any non-CC content
            if not line.startswith('.CC ') and display_cc_items:
                flush_cc_items()

            # Check for font changes inside display
            if line == '.ft CR' or line.startswith('.ft CR '):
                if not display_is_code:
                    emit('```')
                    display_is_code = True
                continue
            if re.match(r'^\.ft(\s|$)', line) and not line.startswith('.ft CR'):
                # .ft with no arg, .ft R, .ft P, or .ft with comment = revert font
                if display_is_code:
                    emit('```')
                    display_is_code = False
                continue
            # Skip other directives inside displays
            if line.startswith('.si') or line.startswith('.ei'):
                continue
            if line.startswith('.CC '):
                # CC inside display: collect items for table output
                rest = line[4:]
                args = parse_macro_args(rest)
                if len(args) >= 2:
                    key = process_inline(args[0])
                    defn = process_inline(args[1])
                    display_cc_items.append((key, defn))
                elif len(args) == 1:
                    display_cc_items.append((process_inline(args[0]), ''))
                continue
            if line.startswith('.'):
                # Skip other dot directives in displays
                macro = line.split()[0] if line.split() else line
                if macro in ('.br', '.sp', '.ne', '.if', '.ie', '.el',
                             '.nr', '.ns', '.rs', '.fi', '.nf', '.ce',
                             '.ta', '.ti', '.in', '.hw', '.bp', '.wh', '.ch'):
                    continue
                if macro == '.pg':
                    emit()
                    continue
                if macro == '.lp':
                    # lp inside display
                    rest = line[3:].strip()
                    label = strip_quotes(rest) if rest else ''
                    label = process_inline(label)
                    if label:
                        emit(f'`{label}`')
                    continue

            # Strip font escapes from code block content (would show literally)
            if display_is_code and ('\\f' in line):
                line = re.sub(r'\\f\(CR', '', line)
                line = re.sub(r'\\f[IBPR]', '', line)

            # Check if this text line looks like config content
            # (BIND=, MENUCOLOR=, OPTIONS=, etc.) and auto-enable code block
            config_prefixes = ('BIND=', 'OPTIONS=', 'OPTION=', 'CHOOSE=',
                             'AUTOCOMPLETE=', 'SYMBOLS=', 'MSGTYPE=',
                             'MENUCOLOR=', 'SOUND=', 'SOUNDDIR=', 'WIZKIT=',
                             'autopickup_exception=', 'ROGUESYMBOLS=',
                             'SOUNDDIR=')
            stripped_line = line.strip()
            if (not display_is_code and
                    any(stripped_line.startswith(p) for p in config_prefixes)):
                emit('```')
                display_is_code = True

            # Regular text line in display
            if display_is_code:
                # In code blocks, output raw (but still expand strings/chars)
                text = expand_strings(line)
                text = process_special_chars(text)
                emit(text)
            else:
                text = process_inline(line)
                emit(text)
            continue

        # Handle title block
        if line == '.mt':
            in_title = True
            in_centered = True
            center_count = 1000  # .mt centers many lines
            continue

        if line == '.au':
            in_title = True
            in_author = True
            in_centered = True
            center_count = 1000
            continue

        if in_title and not title_done:
            # Handle title/author lines
            if line.startswith('.sp'):
                continue
            if line == '.pg' or line.startswith('.hn'):
                # End of title block
                title_done = True
                in_title = False
                in_author = False
                in_centered = False
                center_count = 0
                emit()
                emit('---')
                emit()
                # Fall through to handle the .hn
                if line == '.pg':
                    continue
                # else fall through to .hn handling below
            elif line.startswith('.'):
                continue
            else:
                text = process_inline(line)
                if not output:
                    # First line = main title
                    emit(f'# {text}')
                elif not in_author and text.startswith('(') and text.endswith(')'):
                    # Subtitle like "(Guidebook for NetHack)"
                    emit(f'\n<p style="text-align: center; font-style: italic; margin: 1.5em 0;">{text[1:-1]}</p>')
                    emit()
                elif in_author:
                    # Check if this looks like a date (last line before .hn)
                    if re.match(r'^[A-Z][a-z]+ \d', text):
                        # Date line - wrap in nobr span
                        emit(f'> <span class="nobr">{text}</span>')
                    else:
                        emit(f'> {text}')
                        emit('>')
                else:
                    emit(text)
                continue

        # Heading macros
        if line.startswith('.hn'):
            flush_pending_lp()
            rest = line[3:].strip()
            # Strip trailing comment
            cm = re.search(r'\s*\\"', rest)
            if cm:
                rest = rest[:cm.start()].strip()

            level = 1
            if rest:
                try:
                    level = int(rest.split()[0])
                except ValueError:
                    level = 1

            # Auto-numbering: increment counter at this level, reset lower levels
            h[level - 1] += 1
            for j in range(level, 4):
                h[j] = 0

            # Build section number string
            section_num = '.'.join(str(h[j]) for j in range(level))

            # Read the heading text from the next line
            if i < len(lines):
                heading_text = process_inline(lines[i].strip())
                i += 1
            else:
                heading_text = ''

            # Map level to markdown heading level (level 1 -> ##, level 2 -> ###, etc.)
            md_level = '#' * (level + 1)
            emit()
            emit(f'{md_level} {section_num}. {heading_text}')
            emit()
            prev_was_blank = True
            continue

        # Paragraph
        if line == '.pg':
            flush_pending_lp()
            emit()
            continue

        # Labeled paragraph
        if line.startswith('.lp'):
            flush_pending_lp()
            rest = line[3:].strip()
            # Strip inline comment from rest
            cm = re.search(r'\s*\\"', rest)
            if cm:
                rest = rest[:cm.start()].strip()
            # Parse arguments: .lp LABEL [INDENT]
            args = parse_macro_args(rest) if rest else []
            if len(args) >= 2 and re.match(r'^\d+$', args[-1]):
                # Last arg is indent level — separate from label
                indent_num = args[-1]
                label = ' '.join(args[:-1])
            else:
                label = strip_quotes(rest) if rest else ''
            label = label.strip()
            # Check if label ends with italic "and" — a continuation label
            # e.g. .lp "\f(CRa\fP-\f(CRz\fP\ \ \fIand\fP"
            if label.rstrip().endswith('\\fIand\\fP') or label.rstrip().endswith('\\fI and\\fP'):
                # Buffer this as a continuation label
                processed = format_lp_label(label)
                lp_continuations.append(processed)
                continue
            # .lp * N is a bullet list item (nroff \(bu)
            if label == '*' and len(args) >= 2:
                pending_lp = '\x04bullet'  # sentinel for bullet item
            else:
                # Defer output until we see what follows
                pending_lp = label
            continue

        # .op - option reference (inline code)
        if line.startswith('.op '):
            rest = line[4:].strip()
            # Strip comment
            cm = re.search(r'\s*\\"', rest)
            if cm:
                rest = rest[:cm.start()].strip()
            opt = process_inline(rest)
            # Strip any inner backtick code formatting before wrapping
            # (e.g. .op menustyle \f(CR:traditional\fP -> `menustyle:traditional`)
            opt = opt.replace('`', '')
            # This gets inserted inline with surrounding text
            # Typically used mid-sentence, so just emit as code
            flush_pending_lp()
            emit(f'`{opt}`')
            continue

        # Break/spacing
        if line.startswith('.BR'):
            # Just treat as blank line
            flush_pending_lp()
            emit()
            continue

        # Indent control
        if line.startswith('.si'):
            indent_level += 1
            continue
        if line.startswith('.ei'):
            indent_level = max(0, indent_level - 1)
            continue

        # Definition list macros .PS/.PL/.PE
        # Collect all items, then emit as a table
        if line.startswith('.PS'):
            flush_pending_lp()
            in_ps_list = True
            ps_items = []  # list of (label, definition) tuples
            continue

        if line.startswith('.PL'):
            rest = line[3:].strip()
            label = strip_quotes(rest) if rest else ''
            label = process_inline(label)
            # Read the definition text from following lines until next .PL or .PE
            defn_parts = []
            while i < len(lines):
                next_line = lines[i].strip()
                if next_line.startswith('.PL') or next_line.startswith('.PE'):
                    break
                if next_line.startswith('.'):
                    # Skip directives inside list items
                    i += 1
                    continue
                defn_parts.append(process_inline(next_line))
                i += 1
            defn = ' '.join(defn_parts)
            if in_ps_list:
                ps_items.append((label, defn))
            else:
                # Standalone .PL outside .PS/.PE
                emit()
                emit(f'`{label}` \u2014 {defn}')
            continue

        if line.startswith('.PE'):
            in_ps_list = False
            # Emit collected items as a table
            if ps_items:
                emit()
                emit(f'| Command | Description |')
                emit(f'| --- | --- |')
                for label, defn in ps_items:
                    # Escape pipe characters in content
                    defn_escaped = defn.replace('|', '\\|')
                    label_escaped = label.replace('|', '\\|')
                    emit(f'| `{label_escaped}` | {defn_escaped} |')
                emit()
                ps_items = []
            continue

        # CC outside display (shouldn't normally happen, but handle it)
        if line.startswith('.CC '):
            rest = line[4:]
            args = parse_macro_args(rest)
            if len(args) >= 2:
                key = process_inline(args[0])
                defn = process_inline(args[1])
                emit(f'`{key}` \u2014 {defn}')
            continue

        # URL
        if line.startswith('.UR '):
            rest = line[4:].strip()
            # Strip trailing punctuation/comment
            cm = re.search(r'\s*\\"', rest)
            if cm:
                rest = rest[:cm.start()].strip()
            # Remove trailing punctuation that's a separate argument
            url = rest.split()[0] if rest.split() else rest
            trailing = rest[len(url):].strip() if len(url) < len(rest) else ''
            # Clean up URL
            url = url.rstrip('.')
            if not url.startswith('http'):
                url_display = url
                url_full = 'https://' + url
            else:
                url_display = url
                url_full = url
            flush_pending_lp()
            # The text following .UR continues on next lines
            # Just emit the URL inline
            emit(f'[{url_display}]({url_full}){trailing}')
            continue

        # UX - Unix reference
        if line.startswith('.UX'):
            rest = line[3:].strip()
            # Strip comment
            cm = re.search(r'\s*\\"', rest)
            if cm:
                rest = rest[:cm.start()].strip()
            # Just emit "UNIX" plus any trailing punctuation
            trailing = rest.strip() if rest else ''
            emit(f'UNIX{trailing}')
            continue

        # .ce N - center next N lines
        if line.startswith('.ce'):
            rest = line[3:].strip()
            try:
                center_count = int(rest) if rest else 1
            except ValueError:
                center_count = 1
            in_centered = True
            continue

        # .sm - small text (just output as-is)
        if line.startswith('.sm '):
            rest = line[4:].strip()
            text = strip_quotes(rest)
            text = process_inline(text)
            emit()
            emit(f'*{text}*')
            continue

        # Font changes (standalone .ft)
        if line.startswith('.ft'):
            rest = line[3:].strip()
            if rest.startswith('CR') or rest.startswith('C'):
                in_code_font = True
            else:
                in_code_font = False
            continue

        # Handle .tr (character translation)
        if line.startswith('.tr '):
            rest = line[4:]
            # Strip comment
            cm = re.search(r'\s*\\"', rest)
            if cm:
                rest = rest[:cm.start()]
            # Parse pairs: from-char followed by to-char (or to-escape)
            char_translations = {}
            j = 0
            while j < len(rest):
                if j + 1 >= len(rest):
                    break
                from_char = rest[j]
                j += 1
                # Parse the "to" part (could be an escape sequence)
                if j < len(rest) and rest[j] == '\\':
                    if j + 1 < len(rest) and rest[j+1] == '(':
                        # \(xx - two-char special character
                        if j + 3 < len(rest):
                            code = rest[j+2:j+4]
                            to_str = process_special_chars(f'\\({code}')
                            char_translations[from_char] = to_str
                            j += 4
                        else:
                            j += 2
                    elif j + 1 < len(rest) and rest[j+1] == '-':
                        char_translations[from_char] = '-'
                        j += 2
                    elif j + 1 < len(rest):
                        char_translations[from_char] = rest[j+1]
                        j += 2
                    else:
                        j += 1
                else:
                    char_translations[from_char] = rest[j]
                    j += 1
            continue

        # Skip various nroff directives we don't handle
        if line.startswith('.'):
            macro = line.split()[0] if line.split() else line
            if macro in ('.nr', '.if', '.ie', '.el', '.de', '..',
                        '.so', '.in', '.ne', '.fi', '.nf', '.br',
                        '.sp', '.ns', '.rs', '.ta', '.ti',
                        '.bp', '.wh', '.ch', '.hw', '.po', '.ll',
                        '.lt', '.do', '.am', '.rm', '.rn',
                        '.di', '.da', '.rt', '.ev', '.mk',
                        '.ig', '.IX'):
                continue
            # Empty request (just a dot)
            if line == '.':
                continue
            # Skip unknown dot commands silently
            continue

        # Skip dummy/empty content lines (nroff "\ " = non-breaking space)
        if line.strip() in ('\\', '\\ '):
            continue

        # Regular text line
        text = process_inline(line)

        if pending_lp is not None:
            # Combine label with the first line of description
            label = pending_lp
            pending_lp = None
            prefix = _get_lp_prefix()
            if label == '':
                # Continuation paragraph (no label) - text flows
                # as continuation of previous entry (no blank line)
                if text.strip():
                    emit(prefix + text if prefix else text)
                elif prefix:
                    emit(prefix.rstrip())
            elif label == '\x04bullet':
                # Bullet list item - no blank line inside <li>
                if text.strip():
                    emit(f'- {text}')
                else:
                    emit('- ')
            else:
                formatted = prefix + format_lp_label(label)
                emit()
                if text.strip():
                    emit(f'{formatted}    {text}')
                else:
                    emit(formatted)
            continue

        if in_centered and center_count > 0:
            center_count -= 1
            if center_count <= 0:
                in_centered = False
            # Emit centered text using HTML div
            emit(f'<div style="text-align:center">{text}</div>')
            continue

        if text.strip():
            emit(text)

    # Flush any remaining state
    flush_pending_lp()

    # Post-process
    final_output = []
    in_code_block = False
    for line in output:
        # Fix "Jon W{tte" -> "Jon Wätte"
        line = line.replace('W{tte', 'Wätte')

        # Track code blocks to avoid processing their content
        if line.startswith('```'):
            in_code_block = not in_code_block
            final_output.append(line)
            continue
        if in_code_block:
            final_output.append(line)
            continue

        # Convert curly-quoted bold text to bold code: "**X**" -> **`X`**
        line = re.sub(
            r'[\u201c\u2018]\*\*([^*]+)\*\*[\u201d\u2019]',
            r'**`\1`**',
            line
        )

        # Convert quoted short strings to backtick code
        def _backtick_wrap(s):
            """Wrap s in backtick code span, using `` ` `` syntax if s contains backticks."""
            if '`' in s:
                return '`` ' + s + ' ``'
            return '`' + s + '`'

        # Single curly quotes around short strings (keystrokes, commands)
        line = re.sub(
            r'\u2018([^\u2019]{1,30})\u2019',
            lambda m: _backtick_wrap(m.group(1)) if _is_code_like(m.group(1)) else '\u2018' + m.group(1) + '\u2019',
            line
        )
        # Double curly quotes around short strings
        line = re.sub(
            r'\u201c([^\u201d]{1,30})\u201d',
            lambda m: _backtick_wrap(m.group(1)) if _is_code_like(m.group(1)) else '\u201c' + m.group(1) + '\u201d',
            line
        )
        # Longer double curly quotes that look like game prompts (contain [..?..])
        line = re.sub(
            r'\u201c([^\u201d]{1,80})\u201d',
            lambda m: '`' + m.group(1) + '`' if ('[' in m.group(1) and ']' in m.group(1)) else '\u201c' + m.group(1) + '\u201d',
            line
        )

        # Wrap bare <keyname> patterns in backtick code to prevent
        # pandoc from interpreting them as HTML tags (e.g. <del>)
        def _wrap_keyname(m):
            start, end = m.start(), m.end()
            before = line[start - 1] if start > 0 else ''
            after = line[end] if end < len(line) else ''
            if before == '`' and after == '`':
                return m.group(0)  # already inside backtick span
            backticks_before = line[:start].count('`')
            if backticks_before % 2 == 1:
                return m.group(0)  # inside code span, don't wrap
            return '`' + m.group(0) + '`'
        line = re.sub(r'<[A-Za-z][A-Za-z]+>', _wrap_keyname, line)

        # Merge adjacent code spans connected by hyphens: `a`-`z` -> `a-z`
        line = re.sub(r'`([^`]+)`-`([^`]+)`', r'`\1-\2`', line)
        # Split adjacent code spans that are jammed together: `X``Y` -> `X` `Y`
        line = re.sub(r'`([^`\s]+)``([^`\s]+)`', r'`\1` `\2`', line)

        final_output.append(line)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(final_output)

    print(f"Converted {input_file} -> {output_file}")
    print(f"Output: {len(final_output)} lines")


if __name__ == '__main__':
    import sys
    input_file = sys.argv[1] if len(sys.argv) > 1 else '../docs/reference/Guidebook.mn'
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'guidebook.md'
    convert_guidebook(input_file, output_file)
