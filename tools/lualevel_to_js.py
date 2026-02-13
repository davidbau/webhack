#!/usr/bin/env python3
"""
Simple Lua to JavaScript converter for NetHack special level files.
Uses sequential regex replacements for reliability.

Based on fix_minetn.py approach with enhancements:
- Dynamic import detection
- Recursive nested array conversion
- Better math function handling
"""

import sys
import re
import os
from pathlib import Path

RISKY_LOOP_BOUND_FUNCS = ('rn2(', 'rnd(', 'd(', 'Math.random(')


class SimpleLuaConverter:
    def __init__(self):
        self.imports_needed = set(['des'])
        # Files that are not level generators and should be skipped or handled differently
        self.skip_files = {'nhcore', 'nhlib', 'quest', 'dungeon', 'themerms'}  # Library/data files, not level generators
        # Files where object shorthand conversion (Fix 2: = to :) causes problems
        self.skip_shorthand_conversion = set()  # Currently none - using postprocessing fixes instead

    def _preprocess_problematic_files(self, lua_content, filename):
        """Apply file-specific preprocessing for known problematic files."""
        basename = Path(filename).stem

        # bigrm-13: Add "local" before bare global assignments and handle floor division
        if basename == 'bigrm-13':
            # Fix: filters = { ... needs to be local filters = { ...
            lua_content = re.sub(r'^(filters\s*=\s*{)', r'local \1', lua_content, flags=re.MULTILINE)
            # Fix: idx = math.random needs to be local idx = math.random
            lua_content = re.sub(r'^(idx\s*=\s*math\.random)', r'local \1', lua_content, flags=re.MULTILINE)
            # Fix: Convert floor division (x+1)//3 to math.floor((x+1)/3)
            lua_content = lua_content.replace('((x+1)//3', '(math.floor((x+1)/3)')

        # bigrm-6: Remove extra 'end' statements that create unbalanced braces
        if basename == 'bigrm-6':
            lines = lua_content.split('\n')
            # Remove standalone 'end' at end of file before last few lines
            for i in range(len(lines) - 5, len(lines)):
                if i >= 0 and lines[i].strip() == 'end':
                    lines[i] = '-- removed extra end'
            lua_content = '\n'.join(lines)

        # themerms: Fix function declaration inside if statement
        if basename == 'themerms':
            # Convert problematic function declarations to function expressions
            lua_content = re.sub(
                r'(\s+)function\s+(\w+)\s*\(',
                r'\1local \2 = function(',
                lua_content
            )

        return lua_content

    def convert_file(self, lua_content, filename):
        """Convert Lua content to JavaScript."""
        js = lua_content

        # Step 0a: Apply file-specific preprocessing for problematic files
        js = self._preprocess_problematic_files(js, filename)

        # Step 0b: Extract and protect Lua long strings from conversion
        protected_strings = []
        def protect_long_string(match):
            content = match.group(1)
            placeholder = f'__LONGSTRING_{len(protected_strings)}__'
            protected_strings.append(content)
            return f'`{placeholder}`'

        # Match [[...]] long strings (non-greedy)
        js = re.sub(r'\[\[(.*?)\]\]', protect_long_string, js, flags=re.DOTALL)

        # Step 1: Convert Lua comments to JS comments
        js = self._convert_comments(js)

        # Step 3: Track what we need to import (before conversions)
        self._detect_imports(js)

        # Step 4: Convert object property syntax (in tables/objects)
        # Match after { or , to only catch object properties
        js = re.sub(r'([{,]\s*)(\w+)\s*=\s*', r'\1\2: ', js)

        # Step 5: Protect Lua varargs (...) from string concatenation conversion
        js = js.replace('...', '__VARARGS__')

        # Step 6: Convert function expressions (add opening brace)
        # Handle both named functions and anonymous functions
        js = re.sub(r'function\s+(\w+)\s*\(([^)]*)\)', r'function \1(\2) {', js)  # named
        js = re.sub(r'function\s*\(([^)]*)\)', r'function(\1) {', js)  # anonymous

        # Step 7: Convert local variable declarations to let (not const)
        js = re.sub(r'\blocal\s+(\w+)', r'let \1', js)

        # Step 8: Rename JavaScript reserved words
        js = re.sub(r'\bprotected\b', 'protected_region', js)

        # Step 9: Convert for loops
        # Numeric: for i = 1, 10 do  or  for i = 1, 10, 2 do
        # Need to handle complex expressions, so we'll do line-by-line
        js = self._convert_for_loops(js)

        # Step 10: Convert elseif FIRST (before if/then conversion)
        js = re.sub(r'\belseif\s+(.+?)\s+then', r'} else if (\1) {', js)

        # Step 11: Convert else
        js = re.sub(r'^(\s*)else\s*$', r'\1} else {', js, flags=re.MULTILINE)

        # Step 12: Convert if statements (after elseif)
        js = re.sub(r'if\s+(.+?)\s+then', r'if (\1) {', js)

        # Step 13: Convert 'end' keywords to '}'
        js = re.sub(r'\bend\b', '}', js)

        # Step 14: Convert method call syntax (obj:method() to obj.method())
        # Handle both word:method and ):method patterns
        js = re.sub(r'(\w+):(\w+)\(', r'\1.\2(', js)
        js = re.sub(r'(\)):(\w+)\(', r'\1.\2(', js)

        # Step 15: Convert Lua operators to JS
        js = self._convert_operators(js)

        # Step 16: Restore varargs as JavaScript rest parameters
        # In function parameters: __VARARGS__ → ...args
        # In function bodies: {__VARARGS__} → [...args] or just args
        js = re.sub(r'function\s*\(__VARARGS__\)', 'function(...args)', js)
        js = re.sub(r'function\s+(\w+)\s*\(__VARARGS__\)', r'function \1(...args)', js)
        # Inside bodies: { __VARARGS__ } → args  (simpler than [...args])
        js = js.replace('[ __VARARGS__]', 'args')
        js = js.replace('__VARARGS__', '...args')

        # Step 16: Convert math functions
        # math.random(a, b) => rn2((b) - (a) + 1) + a  (inclusive)
        def replace_math_random_range(m):
            self.imports_needed.add('rn2')
            a = m.group(1).strip()
            b = m.group(2).strip()
            return f'(rn2(({b}) - ({a}) + 1) + ({a}))'
        js = re.sub(r'\bmath\.random\s*\(\s*([^,()]+?)\s*,\s*([^)]+?)\s*\)', replace_math_random_range, js)

        # math.random(n) => rnd(n)
        def replace_math_random_single(m):
            self.imports_needed.add('rnd')
            n = m.group(1).strip()
            return f'rnd({n})'
        js = re.sub(r'\bmath\.random\s*\(\s*([^)]+?)\s*\)', replace_math_random_single, js)

        # Remaining zero-arg cases keep native random.
        js = re.sub(r'\bmath\.random\b', 'Math.random', js)
        js = re.sub(r'\bmath\.floor\b', 'Math.floor', js)
        js = re.sub(r'\bmath\.ceil\b', 'Math.ceil', js)
        js = re.sub(r'\bmath\.min\b', 'Math.min', js)
        js = re.sub(r'\bmath\.max\b', 'Math.max', js)
        js = re.sub(r'\bmath\.abs\b', 'Math.abs', js)

        # Step 17: Convert arrays (recursive for nested)
        js = self._convert_arrays(js)

        # Step 17b: Convert Lua 1-based table indexing to JS 0-based where safe
        js = self._convert_lua_indexing(js)

        # Step 18: Fix octal literals (08 -> 8, 09 -> 9)
        js = re.sub(r'\b0([0-9])\b', r'\1', js)

        # Step 19: Add semicolons to des.* calls
        js = self._add_semicolons(js)

        # hellfill defines hell_tweaks itself; avoid self-import.
        if Path(filename).stem == 'hellfill':
            self.imports_needed.discard('hell_tweaks')

        # Step 20: Wrap in module structure (before restoring long strings,
        # so map content doesn't get indented by _wrap_module)
        js = self._wrap_module(js, filename)

        # Step 21: Restore protected long strings (after wrapping, so map
        # lines stay at column 0 matching C's Lua [[...]] strings)
        for i, content in enumerate(protected_strings):
            placeholder = f'__LONGSTRING_{i}__'
            # Emit JS template literals safely: preserve literal backslashes,
            # backticks, and `${...}` sequences from Lua long strings.
            escaped = (content
                       .replace('\\', '\\\\')
                       .replace('`', '\\`')
                       .replace('${', '\\${'))
            if content.startswith('\n'):
                # Lua long strings skip the first newline after [[.
                rendered = f'`\\\n{escaped[1:]}`'
            else:
                rendered = f'`{escaped}`'
            js = js.replace(f'`{placeholder}`', rendered)

        # Step 22: Postprocessing fixes for problematic files
        js = self._postprocess_fixes(js, filename)

        return js

    def _convert_comments(self, js):
        """Convert Lua comments to JS comments."""
        lines = js.split('\n')
        result = []

        for line in lines:
            # Skip if line is inside a string or template literal (simple heuristic)
            if line.strip().startswith('--'):
                # Line comment
                result.append(re.sub(r'^(\s*)--\s*', r'\1// ', line))
            elif ' -- ' in line and not '[[' in line and not '`' in line:
                # Inline comment (but not in maps/templates)
                result.append(re.sub(r'(\s+)--\s+', r'\1// ', line))
            else:
                result.append(line)

        return '\n'.join(result)

    def _detect_imports(self, js):
        """Detect what needs to be imported."""
        if re.search(r'\bpercent\s*\(', js):
            self.imports_needed.add('percent')
        if re.search(r'\bselection[.(\s]', js):
            self.imports_needed.add('selection')
        if re.search(r'\bshuffle\s*\(', js):
            self.imports_needed.add('shuffle')
        if re.search(r'\bnh\.', js):
            self.imports_needed.add('nh')
        if re.search(r'\bu\.', js):
            self.imports_needed.add('u')
        if re.search(r'\bmonkfoodshop\s*\(', js):
            self.imports_needed.add('monkfoodshop')
        if re.search(r'\balign\s*\[', js):
            self.imports_needed.add('align_consts')
            self.imports_needed.add('shuffle')
        if re.search(r'\brn2\s*\(', js):
            self.imports_needed.add('rn2')
        if re.search(r'\brnd\s*\(', js):
            self.imports_needed.add('rnd')
        if re.search(r'\bd\s*\(', js):
            self.imports_needed.add('d')
        if re.search(r'\bhell_tweaks\s*\(', js):
            self.imports_needed.add('hell_tweaks')

    def _convert_for_loops(self, js):
        """Convert Lua for loops to JavaScript, handling complex expressions."""
        lines = js.split('\n')
        result = []

        for line in lines:
            # Match: for var = start, end do  or  for var = start, end, step do
            match = re.match(r'^(\s*)for\s+(\w+)\s*=\s*(.+)\s+do\s*$', line)
            if match:
                indent = match.group(1)
                var = match.group(2)
                range_expr = match.group(3)

                # Split by commas, but respect parentheses
                parts = self._split_by_comma(range_expr)

                if len(parts) >= 2:
                    start = parts[0].strip()
                    end = parts[1].strip()
                    step = parts[2].strip() if len(parts) > 2 else '1'
                    end_var = f'__end_{var}'
                    step_var = f'__step_{var}'

                    # Lua idiom: for i = 1, #arr do  -> JS: for (let i = 0; i < arr.length; i++)
                    # Keep i as zero-based so arr[i] works naturally after conversion.
                    if step == '1' and start == '1' and end.startswith('#'):
                        arr = end[1:].strip()
                        result.append(
                            f'{indent}for (let {var} = 0, {end_var} = {arr}.length; {var} < {end_var}; {var}++) {{'
                        )
                    elif step == '1':
                        result.append(
                            f'{indent}for (let {var} = {start}, {end_var} = {end}; {var} <= {end_var}; {var}++) {{'
                        )
                    else:
                        result.append(
                            f'{indent}for (let {var} = {start}, {end_var} = {end}, {step_var} = {step}; '
                            f'{step_var} >= 0 ? {var} <= {end_var} : {var} >= {end_var}; '
                            f'{var} += {step_var}) {{'
                        )
                else:
                    # Fallback - keep original
                    result.append(line)
            else:
                result.append(line)

        return '\n'.join(result)

    def _split_by_comma(self, expr):
        """Split expression by comma, respecting parentheses."""
        parts = []
        current = []
        depth = 0
        in_string = False
        string_char = None

        for i, char in enumerate(expr):
            if char in ['"', "'"] and (i == 0 or expr[i-1] != '\\'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
                current.append(char)
            elif not in_string:
                if char == '(':
                    depth += 1
                    current.append(char)
                elif char == ')':
                    depth -= 1
                    current.append(char)
                elif char == ',' and depth == 0:
                    parts.append(''.join(current))
                    current = []
                else:
                    current.append(char)
            else:
                current.append(char)

        if current:
            parts.append(''.join(current))

        return parts

    def _convert_operators(self, js):
        """Convert Lua operators to JavaScript."""
        # Note: Floor division (//) is handled in file-specific preprocessing for bigrm-13
        # General floor division conversion is tricky because by this point,
        # Lua comments (--) are already JS comments (//)

        # String concatenation
        js = re.sub(r'\s*\.\.\s*', ' + ', js)

        # Logical operators (use word boundaries to avoid partial matches)
        js = re.sub(r'\band\b', '&&', js)
        js = re.sub(r'\bor\b', '||', js)
        js = re.sub(r'\bnot\b', '!', js)

        # Comparison operators
        js = js.replace('~=', '!==')
        # Only convert = to === when it's a comparison (not <, >, !, ~ or in for loops)
        # Actually, skip this - JavaScript will handle it, and we risk breaking assignments
        # js = re.sub(r'([^=!<>~])=([^=])', r'\1===\2', js)

        # nil to null
        js = re.sub(r'\bnil\b', 'null', js)

        # Array/string length
        js = re.sub(r'#(\w+)', r'\1.length', js)

        return js

    def _convert_lua_indexing(self, js):
        """Convert common Lua 1-based indexing patterns to JS 0-based indexing."""
        # arr[math.random(1, #arr)] -> arr[rn2(arr.length)]
        # This is the highest-signal pattern for converted Lua tables.
        pattern_random_idx = re.compile(
            r'(\b[A-Za-z_][\w.]*)\s*\[\s*Math\.random\s*\(\s*1\s*,\s*([A-Za-z_][\w.]*)\.length\s*\)\s*\]'
        )
        if pattern_random_idx.search(js):
            self.imports_needed.add('rn2')
            js = pattern_random_idx.sub(r'\1[rn2(\2.length)]', js)

        # arr[(rn2((arr.length) - (1) + 1) + (1))] -> arr[rn2(arr.length)]
        # This comes from math.random(1, #arr) after expression conversion.
        pattern_rn2_plus_one_idx = re.compile(
            r'(\b[A-Za-z_][\w.]*)\s*\[\s*\(?\s*rn2\s*\(\s*\(\s*([A-Za-z_][\w.]*)\.length\s*\)\s*-\s*\(\s*1\s*\)\s*\+\s*1\s*\)\s*\+\s*\(\s*1\s*\)\s*\)?\s*\]'
        )
        if pattern_rn2_plus_one_idx.search(js):
            self.imports_needed.add('rn2')
            js = pattern_rn2_plus_one_idx.sub(r'\1[rn2(\2.length)]', js)

        # obj[1] -> obj[0], obj[2] -> obj[1], etc.
        # Restrict to direct identifier/member expressions to avoid touching array literals.
        def dec_literal_index(match):
            base = match.group(1)
            idx = int(match.group(2))
            return f'{base}[{idx - 1}]'

        js = re.sub(r'(\b[A-Za-z_][\w.]*)\s*\[\s*([1-9]\d*)\s*\]', dec_literal_index, js)

        # Lua selection set ops may survive expression conversion as bitwise
        # operators (for example: selection.area(...) & inside). Convert those
        # forms when at least one operand is a call expression.
        union_patterns = [
            re.compile(r'(\b[A-Za-z_][\w.()]*\([^)]*\))\s*\|\s*(\b[A-Za-z_][\w.()]*)'),
            re.compile(r'(\b[A-Za-z_][\w.()]*)\s*\|\s*(\b[A-Za-z_][\w.()]*\([^)]*\))')
        ]
        intersect_patterns = [
            re.compile(r'(\b[A-Za-z_][\w.()]*\([^)]*\))\s*&\s*(\b[A-Za-z_][\w.()]*)'),
            re.compile(r'(\b[A-Za-z_][\w.()]*)\s*&\s*(\b[A-Za-z_][\w.()]*\([^)]*\))')
        ]

        changed = True
        while changed:
            changed = False
            for pat in union_patterns:
                new_js = pat.sub(r'\1.union(\2)', js)
                if new_js != js:
                    js = new_js
                    changed = True
            for pat in intersect_patterns:
                new_js = pat.sub(r'\1.intersect(\2)', js)
                if new_js != js:
                    js = new_js
                    changed = True
        return js

    def _convert_arrays(self, js):
        """Convert Lua array/table literals to JavaScript arrays."""
        # This handles nested arrays recursively
        # BUT: skip block braces (those after ) or at start of line)

        def convert_array_literal(text):
            """Recursively convert {x,y} style arrays to [x,y]."""
            result = []
            i = 0

            while i < len(text):
                if text[i] == '{':
                    # Check if this is a block brace (after ) or after keywords like else/do)
                    is_block_brace = False
                    if i > 0:
                        # Look back for ) or keywords
                        j = i - 1
                        while j >= 0 and text[j] in [' ', '\t', '\n']:
                            j -= 1
                        # Block brace if preceded by )
                        if j >= 0 and text[j] == ')':
                            is_block_brace = True
                        # Or if preceded by keywords: else, do
                        elif j >= 3 and text[j-3:j+1] == 'else':
                            is_block_brace = True
                        elif j >= 1 and text[j-1:j+1] == 'do':
                            is_block_brace = True

                    if is_block_brace:
                        # Keep as block brace
                        result.append('{')
                        i += 1
                        continue

                    # Find matching closing brace
                    depth = 1
                    j = i + 1
                    in_string = False
                    string_char = None

                    while j < len(text) and depth > 0:
                        if text[j] in ['"', "'", '`'] and (j == 0 or text[j-1] != '\\'):
                            if not in_string:
                                in_string = True
                                string_char = text[j]
                            elif text[j] == string_char:
                                in_string = False
                        elif not in_string:
                            if text[j] == '{':
                                depth += 1
                            elif text[j] == '}':
                                depth -= 1
                        j += 1

                    # Extract the content
                    content = text[i+1:j-1]

                    # Check if it's an array (no key: value pairs)
                    # Object properties have already been converted to key: value
                    if ':' not in content or self._is_array_like(content):
                        # It's an array - recursively convert
                        converted_content = convert_array_literal(content)
                        result.append('[' + converted_content + ']')
                    else:
                        # It's an object - keep braces but recursively convert content
                        converted_content = convert_array_literal(content)
                        result.append('{' + converted_content + '}')

                    i = j
                elif text[i] == '}':
                    # Closing brace - keep as is
                    result.append('}')
                    i += 1
                else:
                    result.append(text[i])
                    i += 1

            return ''.join(result)

        return convert_array_literal(js)

    def _is_array_like(self, content):
        """Check if content is array-like (no key:value at depth 0)."""
        depth = 0
        in_string = False
        string_char = None

        for i, char in enumerate(content):
            if char in ['"', "'", '`'] and (i == 0 or content[i-1] != '\\'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
            elif not in_string:
                if char in ['{', '[']:
                    depth += 1
                elif char in ['}', ']']:
                    depth -= 1
                elif char == ':' and depth == 0:
                    # Found colon at top level - it's an object
                    return False

        return True

    def _add_semicolons(self, js):
        """Add semicolons to des.* function calls."""
        lines = js.split('\n')
        result = []

        for i, line in enumerate(lines):
            stripped = line.strip()
            # Add semicolon to des.* calls that don't have one
            if (stripped.startswith('des.') and
                not stripped.endswith((';', '{', '}', ',')) and
                ')' in stripped):
                line = line.rstrip() + ';'
            result.append(line)

        return '\n'.join(result)

    def _postprocess_fixes(self, js, filename):
        """Apply targeted fixes for known problematic patterns."""
        basename = Path(filename).stem

        # Fix 0: Handle duplicate variable declarations (let place, let sel)
        # Track seen variables and convert subsequent ones to assignments
        lines = js.split('\n')
        seen_vars = {}
        for i, line in enumerate(lines):
            match = re.match(r'^(\s*)let\s+(\w+)\s*=', line)
            if match:
                indent = match.group(1)
                varname = match.group(2)
                if varname in seen_vars:
                    # Already declared, convert to assignment
                    lines[i] = re.sub(r'^(\s*)let\s+', r'\1', line)
                else:
                    seen_vars[varname] = True
        js = '\n'.join(lines)

        # File-specific postprocessing (BEFORE Fix 2)
        basename = Path(filename).stem

        if basename == 'bigrm-13':
            # Convert filters object to array (contains anonymous functions)
            js = js.replace('let filters = {', 'let filters = [')
            # Find the closing }; that corresponds to filters and change to ];
            # Pattern: after the last function in filters (with Math.floor), before idx line
            js = re.sub(r'(function\(x, y\) \{ return \(Math\.floor\(\(x\+1\)/3\) == y\); \},?\s*\n\s*)};(\s*\n\s*let idx)',
                       r'\1];\2', js)

        # Fix 1: Remove extra ] after arrays containing string brackets
        # Pattern: [ "L", "T", "[", "."]]; → [ "L", "T", "[", "."];
        js = re.sub(r'(\[ [^\]]+\"\[\"+[^\]]*\])(\])', r'\1', js)
        js = re.sub(r'(\[ [^\]]+\"\{"+[^\]]*\])(\])', r'\1', js)

        # Fix 1b: Add missing declarations for first-time bare assignments
        # (e.g., "place = selection.new();") while preserving reassignments.
        lines = js.split('\n')
        seen = set()
        fixed_lines = []
        decl_pat = re.compile(r'^\s*(?:let|const|var)\s+([A-Za-z_]\w*)')
        bare_assign_pat = re.compile(r'^(\s*)([A-Za-z_]\w*)\s*=\s*(.+)$')
        for line in lines:
            decl_match = decl_pat.match(line)
            if decl_match:
                seen.add(decl_match.group(1))
                fixed_lines.append(line)
                continue

            assign_match = bare_assign_pat.match(line)
            if assign_match:
                indent, name, rhs = assign_match.groups()
                if ('==' not in line and '!=' not in line and '<=' not in line and
                    '>=' not in line and '=>' not in line and ':' not in line):
                    if name not in seen:
                        seen.add(name)
                        fixed_lines.append(f'{indent}let {name} = {rhs}')
                        continue
            fixed_lines.append(line)
        js = '\n'.join(fixed_lines)

        # Fix 2 removed: this brace-depth heuristic was converting normal
        # assignments into label syntax inside functions.

        # Fix 3: Remove illegal return statements at top level
        # Convert standalone return at module level to commented out
        # BUT: Don't comment out "return des.finalize_level();" - that's the function's actual return
        js = re.sub(r'^(\s*)return\s+(?!des\.finalize_level)', r'\1// return ', js, flags=re.MULTILINE)

        # Fix 4: Fix method calls that still have : (aggressive)
        # Find any remaining : followed by ( that's not in strings
        js = re.sub(r':(\w+)\(', r'.\1(', js)

        # Fix 4b: Undo accidental block-scope "name: [ ... ];" conversions
        # from broad table-field replacement.
        js = re.sub(r'^(\s*)([A-Za-z_]\w*)\s*:\s*(\[[^\n]*\])\s*;', r'\1\2 = \3;', js, flags=re.MULTILINE)

        # Fix 4c: Lua table shorthand "{ ..., random, ... }" appears in some
        # level files and should become an explicit boolean-like field.
        # In JS, bare "random" inside object literals becomes invalid when no
        # variable is in scope, so normalize to "random: 1".
        js = re.sub(r'([,{]\s*)random(\s*[,}])', r'\1random: 1\2', js)

        # Fix 5: Remove orphan return statements (return outside function)
        # Pattern: }\n    return des.finalize_level();\n}
        # OR: }\n    // return des.finalize_level();\n} (when Fix 3 commented it out)
        # These occur when there's an extra closing brace that ends the function early
        # Match: } + newline + (optional //) + return line + newline + }
        pattern_fix5 = r'}\s*\n\s+(//\s*)?return des\.finalize_level\(\);\s*\n}'
        js = re.sub(pattern_fix5, '\n    return des.finalize_level();\n}', js)

        # Fix 6: Complete unclosed objects/functions by counting braces
        # Skip for files where Fix 5 handles the brace issues differently
        if basename not in ['minend-3', 'minetn-5', 'minetn-6', 'orcus']:
            open_braces = js.count('{')
            close_braces = js.count('}')
            if open_braces > close_braces:
                # Add missing closing braces before final return
                missing = open_braces - close_braces
                if 'return des.finalize_level();' in js:
                    js = js.replace('return des.finalize_level();',
                                   '}\n' * missing + '    return des.finalize_level();')

        # File-specific postprocessing (AFTER all conversions)
        if basename == 'themerms':
            # Fix 1: Variable declarations "locs: ..." → "let locs = ..."
            js = re.sub(r'^(\s+)(locs|func):\s+', r'\1let \2 = ', js, flags=re.MULTILINE)

            # Fix 2: Object properties that weren't converted: "contents = function" → "contents: function"
            js = re.sub(r'^(\s+)contents\s*=\s*function', r'\1contents: function', js, flags=re.MULTILINE)

            # Fix 3: Multiple assignment → destructuring
            # "ltype,rtype: val1,val2" → "let ltype = val1, rtype = val2;"
            js = re.sub(r'(\s+)ltype,rtype:\s+"weapon shop","armor shop"',
                       r'\1let ltype = "weapon shop", rtype = "armor shop";', js)
            # "ltype,rtype: rtype,ltype" → "[ltype, rtype] = [rtype, ltype];"
            js = re.sub(r'(\s+)ltype,rtype:\s+rtype,ltype',
                       r'\1[ltype, rtype] = [rtype, ltype];', js)

            # Fix 4: "themeroom_fills: [" → "let themeroom_fills = ["
            js = re.sub(r'^\s*themeroom_fills:\s*\[', '    let themeroom_fills = [', js, flags=re.MULTILINE)

            # Fix 5: Close array with ] not };
            # Pattern: },\n\n    };\n\n    // store these at global scope
            js = re.sub(r'(       },)\s*\n\s*\};\s*\n\s*(// store these at global scope)',
                       r'\1\n\n    ];\n\n    \2', js)

            # Fix 6: Convert "for i, v in ipairs(postprocess) do" to JS for loop
            js = re.sub(r'for\s+i,\s*v\s+in\s+ipairs\(postprocess\)\s+do\s*\n',
                       'for (let i = 0; i < postprocess.length; i++) {\n          let v = postprocess[i];\n', js)

            # Fix 7: Convert "repeat...until" to "do...while"
            js = re.sub(r'repeat\s*\n(.*?)\n\s*until\s*\((.*?)\);',
                       r'do {\1\n          } while (!(\2));', js, flags=re.DOTALL)

            # Fix 8: Remove stray ] after post_level_generate function
            js = re.sub(r'(postprocess = \[ \];)\s*\n\s*\}\]',
                       r'\1\n    }', js)

            # Fix 9: Add missing semicolons - more comprehensive approach
            # Process line by line to add semicolons where needed
            lines = js.split('\n')
            fixed_lines = []
            for line in lines:
                stripped = line.rstrip()
                # Skip empty lines, comments, and lines that already end with ; or { or }
                if not stripped or stripped.startswith('//') or stripped.endswith((';', '{', '}')):
                    fixed_lines.append(line)
                    continue

                # Add semicolon to lines ending with ) that look like statements
                # But NOT if they're control structures or function definitions
                if stripped.endswith(')'):
                    # Check if it's a control structure or function definition
                    is_control = any(keyword in line for keyword in [
                        ' if (', ' for (', ' while (', ' do {', 'function(',
                        '} else', '}) {', ' => {', 'return '
                    ])
                    if not is_control:
                        fixed_lines.append(stripped + ';')
                        continue

                fixed_lines.append(line)

            js = '\n'.join(fixed_lines)

            # Fix 10: Add 'let' to bare variable assignments in function scope
            # Pattern: indented line starting with lowercase identifier followed by =
            # But NOT: object properties (has : before =), comparisons (==, !=, <=, >=),
            #          arrow functions (=>), or already declared (let/const/var)
            # This is a heuristic fix for ES6 strict mode compatibility
            lines = js.split('\n')
            fixed_lines = []
            for line in lines:
                # Skip if already has let/const/var, is a comment, or is blank
                if any(x in line for x in ['let ', 'const ', 'var ', '//', 'return ']) or not line.strip():
                    fixed_lines.append(line)
                    continue
                # Check if it's a bare assignment (starts with spaces, then lowercase var, then =)
                match = re.match(r'^(\s+)([a-z_][a-z_0-9]*)\s*=\s*(.+)$', line)
                if match and '==' not in line and '!=' not in line and '<=' not in line and '>=' not in line and '=>' not in line:
                    indent, varname, rest = match.groups()
                    # Skip object properties (they have : before the =) and reassignments
                    # For reassignments, we keep a list of commonly reassigned vars
                    # Most other bare assignments should get 'let' added
                    if varname in ['box', 'rmtyp', 'func', 'actualrm']:
                        # These are commonly reassigned after declaration
                        fixed_lines.append(line)
                    else:
                        # Add 'let' to first declarations
                        fixed_lines.append(f'{indent}let {varname} = {rest}')
                else:
                    fixed_lines.append(line)
            js = '\n'.join(fixed_lines)

        # Targeted syntax cleanup for known loop/brace edge cases.
        if basename == 'Rog-strt':
            js = js.replace(
                '       des.monster({ id: "chameleon", coord: streets.rndcoord(1), peaceful: 0 });\n    \n    return des.finalize_level();',
                '       des.monster({ id: "chameleon", coord: streets.rndcoord(1), peaceful: 0 });\n    }\n\n    return des.finalize_level();'
            )

        if basename in ['bigrm-8', 'bigrm-9']:
            js = js.replace(
                '      des.monster();\n    \n    return des.finalize_level();',
                '      des.monster();\n    }\n\n    return des.finalize_level();'
            )

        if basename in ['Val-strt', 'bigrm-6']:
            js = re.sub(
                r'\n\s*}\s*\n(\s*return des\.finalize_level\(\);)',
                r'\n\1',
                js,
                count=1
            )
        if basename == 'bigrm-6':
            js = js.replace('\n}\n    return des.finalize_level();', '\n    return des.finalize_level();')

        return js

    def _wrap_module(self, js, filename):
        """Wrap converted code in ES6 module structure."""
        level_name = Path(filename).stem
        lua_name = Path(filename).name

        # Generate imports
        imports = ['import * as des from \'../sp_lev.js\';']

        # Collect imports from sp_lev.js
        splev_imports = []
        if 'selection' in self.imports_needed:
            splev_imports.append('selection')
        if 'percent' in self.imports_needed:
            splev_imports.append('percent')
        if 'shuffle' in self.imports_needed:
            splev_imports.append('shuffle')
        if 'nh' in self.imports_needed:
            splev_imports.append('nh')
        if 'u' in self.imports_needed:
            splev_imports.append('u')

        if splev_imports:
            imports.append(f"import {{ {', '.join(splev_imports)} }} from '../sp_lev.js';")

        rng_imports = []
        if 'rn2' in self.imports_needed:
            rng_imports.append('rn2')
        if 'rnd' in self.imports_needed:
            rng_imports.append('rnd')
        if 'd' in self.imports_needed:
            rng_imports.append('d')
        if rng_imports:
            imports.append(f"import {{ {', '.join(rng_imports)} }} from '../rng.js';")
        if 'hell_tweaks' in self.imports_needed:
            imports.append("import { hell_tweaks } from './hellfill.js';")
        if 'align_consts' in self.imports_needed:
            imports.append("import { A_CHAOTIC, A_NEUTRAL, A_LAWFUL } from '../config.js';")

        # Build the module
        header = f'''/**
 * {level_name} - NetHack special level
 * Converted from: {lua_name}
 */

'''
        header += '\n'.join(imports)
        if level_name == 'hellfill':
            header += '''

// hell_tweaks - Add Gehennom-specific features to a selection
// C ref: Not in C - Lua runtime function for special level generation
export function hell_tweaks(protected_region) {
    // Stub implementation - adds Gehennom decorations
    // TODO: Implement full hell_tweaks logic when needed
    // (extra monsters, lava pools, themed decorations, etc.)
}
'''
        if 'monkfoodshop' in self.imports_needed:
            header += '''

// Helper function: returns shop type based on role.
function monkfoodshop() {
    return percent(50) ? "health food shop" : "food shop";
}
'''
        header += '\n\nexport function generate() {\n'

        body_prefix = ''
        if 'align_consts' in self.imports_needed:
            body_prefix += 'const align = [A_CHAOTIC, A_NEUTRAL, A_LAWFUL];\n'
            body_prefix += 'shuffle(align);\n\n'
        if body_prefix:
            js = body_prefix + js

        # Indent the body
        body_lines = []
        in_template = False
        for line in js.split('\n'):
            # Preserve multiline template literal contents exactly (no extra indentation).
            if in_template:
                body_lines.append(line)
            elif line.strip():
                body_lines.append('    ' + line)
            else:
                body_lines.append('')

            # Toggle template state based on unescaped backticks in this line.
            tick_count = 0
            escaped = False
            for ch in line:
                if ch == '\\' and not escaped:
                    escaped = True
                    continue
                if ch == '`' and not escaped:
                    tick_count += 1
                escaped = False
            if tick_count % 2 == 1:
                in_template = not in_template

        footer = '\n\n    return des.finalize_level();\n}\n'

        return header + '\n'.join(body_lines) + footer


def convert_lua_file(input_path, output_path=None):
    """Convert a single Lua file to JavaScript."""
    basename = os.path.splitext(os.path.basename(input_path))[0]

    # Skip library/data files that are not level generators
    converter = SimpleLuaConverter()
    if basename in converter.skip_files:
        print(f"Skipping {basename}.lua (library/data file, not a level generator)")
        return None

    with open(input_path, 'r', encoding='utf-8') as f:
        lua_content = f.read()

    js_content = converter.convert_file(lua_content, os.path.basename(input_path))
    for lineno, line in enumerate(js_content.splitlines(), start=1):
        if 'for (' not in line:
            continue
        m = re.search(r'for\s*\(([^;]*);([^;]*);([^)]*)\)', line)
        if not m:
            continue
        loop_cond = m.group(2)
        for token in RISKY_LOOP_BOUND_FUNCS:
            if token in loop_cond:
                raise RuntimeError(
                    f'Unsafe loop condition in converted output at line {lineno}: {line.strip()}'
                )

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(js_content)
        print(f"Converted {input_path} → {output_path}")
    else:
        print(js_content)

    return js_content


def main():
    if len(sys.argv) < 2:
        print("Usage: lualevel_to_js.py <input.lua> [output.js]")
        print("   or: lualevel_to_js.py --batch <input_dir> <output_dir>")
        sys.exit(1)

    if sys.argv[1] == '--batch':
        if len(sys.argv) < 4:
            print("Usage: lualevel_to_js.py --batch <input_dir> <output_dir>")
            sys.exit(1)

        input_dir = Path(sys.argv[2])
        output_dir = Path(sys.argv[3])
        output_dir.mkdir(exist_ok=True)

        lua_files = sorted(input_dir.glob('*.lua'))
        print(f"Found {len(lua_files)} Lua files to convert")

        success_count = 0
        for lua_file in lua_files:
            output_file = output_dir / (lua_file.stem + '.js')
            try:
                convert_lua_file(lua_file, output_file)
                success_count += 1
            except Exception as e:
                print(f"ERROR converting {lua_file}: {e}")

        print(f"\nConverted {success_count}/{len(lua_files)} files successfully")
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        convert_lua_file(input_file, output_file)


if __name__ == '__main__':
    main()
