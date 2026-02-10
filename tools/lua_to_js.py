#!/usr/bin/env python3
"""
Lua to JavaScript converter for NetHack special level files.

Converts NetHack .lua special level files to JavaScript modules that work
with our des.* API implementation.
"""

import re
import sys
import os
from pathlib import Path


class LuaToJsConverter:
    def __init__(self):
        self.imports_needed = set()
        self.in_multiline_string = False
        self.multiline_string_lines = []
        self.indent_level = 0

    def convert_file(self, lua_content, filename):
        """Convert a Lua special level file to JavaScript."""
        self.imports_needed = set(['des'])

        js_lines = []

        # Add header comment
        level_name = Path(filename).stem
        js_lines.append(f"/**")
        js_lines.append(f" * {level_name} - NetHack special level")
        js_lines.append(f" * Converted from: {filename}")
        js_lines.append(f" */")
        js_lines.append("")

        # Convert the main content
        converted_body = self.convert_body(lua_content)

        # Add imports
        js_lines.extend(self.generate_imports())
        js_lines.append("")

        # Wrap in export function
        js_lines.append("export function generate() {")

        # Add converted body with indentation
        for line in converted_body.split('\n'):
            if line.strip():
                js_lines.append("    " + line)
            else:
                js_lines.append("")

        # Add finalize
        js_lines.append("")
        js_lines.append("    return des.finalize_level();")
        js_lines.append("}")

        return '\n'.join(js_lines)

    def generate_imports(self):
        """Generate import statements based on what's needed."""
        imports = []

        # Always import des
        imports.append("import * as des from '../sp_lev.js';")

        # Check if we need other imports
        if 'selection' in self.imports_needed:
            imports.append("import { selection } from '../sp_lev.js';")
        if 'percent' in self.imports_needed:
            imports.append("import { percent } from '../util.js';")

        rng_imports = []
        if 'rn2' in self.imports_needed:
            rng_imports.append('rn2')
        if 'rnd' in self.imports_needed:
            rng_imports.append('rnd')
        if 'd' in self.imports_needed:
            rng_imports.append('d')
        if rng_imports:
            imports.append(f"import {{ {', '.join(rng_imports)} }} from '../rng.js';")

        if 'nh' in self.imports_needed:
            imports.append("import * as nh from '../util.js';")
        if 'shuffle' in self.imports_needed:
            imports.append("import { shuffle } from '../util.js';")

        return imports

    def convert_body(self, lua_content):
        """Convert the main Lua code body."""
        lines = lua_content.split('\n')
        js_lines = []

        i = 0
        while i < len(lines):
            line = lines[i]

            # Handle multiline des.* calls with object literals FIRST
            # (before multiline strings, because des.* calls can contain multiline strings)
            # Check for both direct calls and assignments
            is_des_call = (line.strip().startswith('des.') and '({' in line) or \
                         (' = des.' in line and '({' in line)

            if is_des_call:
                # Check if the closing }) is on the same line
                paren_count = 0
                brace_count = 0
                has_complete_call = False
                in_string = False
                string_char = None

                # Track strings to avoid counting braces/parens inside them
                for j, char in enumerate(line):
                    if char in ['"', "'"] and (j == 0 or line[j-1] != '\\'):
                        if not in_string:
                            in_string = True
                            string_char = char
                        elif char == string_char:
                            in_string = False
                    elif not in_string:
                        if char == '(': paren_count += 1
                        elif char == ')': paren_count -= 1
                        elif char == '{': brace_count += 1
                        elif char == '}': brace_count -= 1

                # If braces/parens are balanced, it's a single-line call
                if paren_count == 0 and brace_count == 0:
                    has_complete_call = True

                if not has_complete_call:
                    # Multiline call - collect until we find the closing })
                    multiline_call = [line]
                    i += 1
                    while i < len(lines):
                        multiline_call.append(lines[i])
                        # Reset string tracking for each line
                        line_in_string = False
                        line_string_char = None
                        for j, char in enumerate(lines[i]):
                            if char in ['"', "'"] and (j == 0 or lines[i][j-1] != '\\'):
                                if not line_in_string:
                                    line_in_string = True
                                    line_string_char = char
                                elif char == line_string_char:
                                    line_in_string = False
                            elif not line_in_string:
                                if char == '(': paren_count += 1
                                elif char == ')': paren_count -= 1
                                elif char == '{': brace_count += 1
                                elif char == '}': brace_count -= 1

                        if paren_count == 0 and brace_count == 0:
                            break
                        i += 1

                    # Join the multiline call, but first convert [[ ]] to template literals
                    combined_text = '\n'.join(multiline_call)
                    # Convert [[ ... ]] to ` ... `
                    while '[[' in combined_text:
                        start_idx = combined_text.index('[[')
                        end_idx = combined_text.index(']]', start_idx)
                        before = combined_text[:start_idx]
                        template_content = combined_text[start_idx + 2:end_idx]
                        after = combined_text[end_idx + 2:]
                        # Escape backticks in template content
                        template_content = template_content.replace('`', '\\`')
                        combined_text = before + '`\n' + template_content + '\n`' + after

                    # Combine into one line but preserve newlines inside template literals
                    parts = []
                    in_template = False
                    for line in combined_text.split('\n'):
                        # Check if this line contains template literal markers
                        if '`' in line:
                            # Count backticks to track template state
                            for char in line:
                                if char == '`':
                                    in_template = not in_template

                        if in_template:
                            # Inside template - preserve the original line with newline
                            parts.append(line + '\n')
                        else:
                            # Outside template - strip and join with spaces
                            stripped = line.strip()
                            if stripped:
                                parts.append(stripped + ' ')

                    combined = ''.join(parts).rstrip()
                    converted = self.convert_line(combined)
                    if converted:
                        # Post-process to add line breaks and fix comments
                        converted = self.format_multiline_output(converted)
                        js_lines.append(converted)
                    i += 1
                    continue

            # Handle standalone multiline strings [[ ... ]]
            if '[[' in line and ']]' not in line and not is_des_call:
                self.in_multiline_string = True
                self.multiline_string_lines = []

                # Extract the part before [[
                before = line[:line.index('[[')]
                self.multiline_string_lines.append(line[line.index('[[') + 2:])

                # Collect lines until ]]
                i += 1
                while i < len(lines) and ']]' not in lines[i]:
                    self.multiline_string_lines.append(lines[i])
                    i += 1

                # Get the line with ]]
                if i < len(lines):
                    end_line = lines[i]
                    if ']]' in end_line:
                        last_part = end_line[:end_line.index(']]')]
                        self.multiline_string_lines.append(last_part)
                        after = end_line[end_line.index(']]') + 2:]
                    else:
                        after = ""
                else:
                    after = ""

                # Convert multiline string to JS template literal
                string_content = '\n'.join(self.multiline_string_lines)
                # Escape backticks in template content
                string_content = string_content.replace('`', '\\`')
                converted_line = before + '`\n' + string_content + '\n`' + after
                js_lines.append(self.convert_line(converted_line))
                self.in_multiline_string = False
                i += 1
                continue

            # Convert the line
            converted = self.convert_line(line)
            if converted is not None:
                js_lines.append(converted)

            i += 1

        return '\n'.join(js_lines)

    def format_multiline_output(self, js_code):
        """Post-process converted JavaScript to add proper line breaks."""
        # Simple approach: add line breaks after semicolons and around function braces
        result = []
        i = 0
        in_string = False
        string_char = None
        in_template = False
        depth = 0

        while i < len(js_code):
            char = js_code[i]

            # Track strings and templates
            if char == '`':
                in_template = not in_template
                result.append(char)
            elif char in ['"', "'"] and (i == 0 or js_code[i-1] != '\\'):
                if not in_string and not in_template:
                    in_string = True
                    string_char = char
                elif in_string and char == string_char:
                    in_string = False
                result.append(char)
            elif not in_string and not in_template:
                if char == ';':
                    # Check if this is a comment line (look back for //)
                    is_comment_line = False
                    result_str = ''.join(result)
                    last_newline = result_str.rfind('\n')
                    if last_newline >= 0:
                        current_line = result_str[last_newline + 1:]
                        if current_line.strip().startswith('//'):
                            is_comment_line = True
                    elif result_str.strip().startswith('//'):
                        # First line of function body
                        is_comment_line = True

                    # Don't output semicolon for comment lines
                    if not is_comment_line:
                        result.append(char)

                    # Look ahead - only add newline if next non-space char is not }
                    j = i + 1
                    while j < len(js_code) and js_code[j] == ' ':
                        j += 1
                    if j < len(js_code) and js_code[j] not in ['}', ')']:
                        result.append('\n' + '        ')
                        i = j - 1  # Skip the spaces
                elif char == '{' and i > 0 and js_code[i-1] == ')':
                    # Function body opening
                    result.append(' {\n        ')
                    depth += 1
                    # Skip the space after {  if any
                    if i + 1 < len(js_code) and js_code[i + 1] == ' ':
                        i += 1
                elif char == '}' and depth > 0:
                    # Function body closing
                    result.append('\n    }')
                    depth -= 1
                else:
                    result.append(char)
            else:
                result.append(char)

            i += 1

        return ''.join(result)

    def convert_line(self, line):
        """Convert a single line of Lua to JavaScript."""
        stripped = line.strip()
        indent = line[:len(line) - len(line.lstrip())]

        # Skip empty lines
        if not stripped:
            return ""

        # Skip Lua comments
        if stripped.startswith('--'):
            comment_text = stripped[2:].strip()
            return f"{indent}// {comment_text}"

        # Local variable declarations (check BEFORE inline comments to avoid false positives)
        if stripped.startswith('local '):
            var_decl = stripped[6:]  # Remove 'local '
            # Check if it's a des.* call assignment
            if 'des.' in var_decl and '({' in var_decl and ' = des.' in var_decl:
                # Use convert_statement to handle the object literal conversion
                result = self.convert_statement(var_decl)
                return indent + result
            return indent + 'const ' + self.convert_expression(var_decl)

        # Handle inline comments (but not -- inside strings or template literals)
        if '--' in stripped and not stripped.startswith('--'):
            # Find -- that's not inside a string or template literal
            comment_idx = -1
            in_string = False
            in_template = False
            string_char = None
            i = 0
            while i < len(stripped):
                char = stripped[i]
                if char == '`':
                    in_template = not in_template
                elif char in ['"', "'"] and (i == 0 or stripped[i-1] != '\\'):
                    if not in_string:
                        in_string = True
                        string_char = char
                    elif char == string_char:
                        in_string = False
                elif not in_string and not in_template:
                    if i < len(stripped) - 1 and stripped[i:i+2] == '--':
                        comment_idx = i
                        break
                i += 1

            if comment_idx >= 0:
                code_part = stripped[:comment_idx]
                comment_part = stripped[comment_idx + 2:]
                return indent + self.convert_expression(code_part) + ' // ' + comment_part

        # Function definitions
        if stripped.startswith('function '):
            return indent + self.convert_function_def(stripped)

        if stripped.startswith('local function '):
            return indent + self.convert_function_def(stripped.replace('local ', ''))

        # End keyword
        if stripped in ['end', 'end;', 'end,']:
            suffix = stripped[3:] if len(stripped) > 3 else ''
            return indent + '}' + suffix

        # If statements
        if stripped.startswith('if ') and ' then' in stripped:
            return indent + self.convert_if_statement(stripped)

        # Elseif
        if stripped.startswith('elseif '):
            condition = stripped[7:stripped.index(' then')]
            condition = self.convert_condition(condition)
            return f"{indent}}} else if ({condition}) {{"

        # Else
        if stripped == 'else':
            return f"{indent}}} else {{"

        # For loops
        if stripped.startswith('for '):
            return indent + self.convert_for_loop(stripped)

        # While loops
        if stripped.startswith('while ') and ' do' in stripped:
            condition = stripped[6:stripped.index(' do')]
            condition = self.convert_condition(condition)
            return f"{indent}while ({condition}) {{"

        # Repeat-until
        if stripped == 'repeat':
            return f"{indent}do {{"

        if stripped.startswith('until '):
            condition = self.convert_condition(stripped[6:])
            return f"{indent}}} while (!({condition}));"

        # Return statements
        if stripped.startswith('return '):
            expr = self.convert_expression(stripped[7:])
            return f"{indent}return {expr};"

        # Otherwise, convert as expression/statement
        return indent + self.convert_statement(stripped)

    def convert_function_def(self, func_str):
        """Convert function definition."""
        # function name(params) → function name(params) {
        if '(' in func_str:
            return func_str.rstrip() + ' {'
        else:
            return func_str + ' {'

    def convert_if_statement(self, if_str):
        """Convert if statement."""
        condition = if_str[3:if_str.index(' then')]
        condition = self.convert_condition(condition)
        suffix = if_str[if_str.index(' then') + 5:].strip()

        result = f"if ({condition}) {{"
        if suffix and suffix != 'end':
            result += ' ' + self.convert_expression(suffix)
        return result

    def convert_for_loop(self, for_str):
        """Convert for loop."""
        if ' in ' in for_str:
            # Iterator loop: for k,v in pairs(t) do
            return self.convert_iterator_loop(for_str)
        else:
            # Numeric loop: for i = 1,10 do
            return self.convert_numeric_loop(for_str)

    def convert_numeric_loop(self, for_str):
        """Convert numeric for loop."""
        # for i = 1,10 do → for (let i = 1; i <= 10; i++)
        loop_def = for_str[4:for_str.index(' do')]
        parts = loop_def.split('=')
        var_name = parts[0].strip()
        range_parts = [p.strip() for p in parts[1].split(',')]

        start = range_parts[0]
        end = range_parts[1]
        step = range_parts[2] if len(range_parts) > 2 else '1'

        if step == '1':
            return f"for (let {var_name} = {start}; {var_name} <= {end}; {var_name}++) {{"
        else:
            return f"for (let {var_name} = {start}; {var_name} <= {end}; {var_name} += {step}) {{"

    def convert_iterator_loop(self, for_str):
        """Convert iterator for loop."""
        # for k,v in pairs(t) do → for (const [k, v] of Object.entries(t)) {
        # for i,v in ipairs(t) do → for (const [i, v] of t.entries()) {
        match = re.match(r'for\s+([\w,\s]+)\s+in\s+(\w+)\(([\w.]+)\)\s+do', for_str)
        if match:
            vars_str = match.group(1).strip()
            iterator = match.group(2)
            collection = match.group(3)

            if iterator == 'pairs':
                return f"for (const [{vars_str}] of Object.entries({collection})) {{"
            elif iterator == 'ipairs':
                return f"for (let {vars_str.split(',')[0].strip()} = 0; {vars_str.split(',')[0].strip()} < {collection}.length; {vars_str.split(',')[0].strip()}++) {{"

        # Fallback
        return for_str.replace(' do', '') + ' {'

    def convert_statement(self, stmt):
        """Convert a statement (including des.* calls with object literals)."""
        stmt = stmt.rstrip(';')

        # Check for des.* API calls with object literals
        # Handle both direct calls (des.map(...)) and assignments (x = des.map(...))
        if 'des.' in stmt and '({' in stmt:
            # Check for assignment: look for " = des." pattern
            if ' = des.' in stmt and not stmt.startswith('des.'):
                # Find the " = des." and split there
                idx = stmt.index(' = des.')
                lhs = stmt[:idx].strip()
                rhs = stmt[idx + 3:].strip()  # Skip past " = "
                # Convert the RHS (which should start with "des.")
                converted_rhs = self.convert_des_call_with_object(rhs)
                # Remove 'local' from LHS if present
                if lhs.startswith('local '):
                    lhs = lhs[6:]
                # Add const if needed
                if not lhs.startswith(('const ', 'let ', 'var ')):
                    lhs = 'const ' + lhs
                return f"{lhs} = {converted_rhs};"

            # Direct des.* call
            if stmt.startswith('des.'):
                result = self.convert_des_call_with_object(stmt)
                # Add semicolon if not already present
                if not result.endswith(';'):
                    result += ';'
                return result

        # Otherwise convert as expression
        result = self.convert_expression(stmt)

        # Add semicolon if needed
        if result and not result.endswith(('{', '}', ';', ',')):
            if any(result.startswith(kw) for kw in ['const ', 'let ', 'var ', 'des.', 'return ', 'for ', 'if ', 'while ']):
                if not result.endswith(';'):
                    result += ';'

        return result

    def convert_des_call_with_object(self, stmt):
        """Convert des.* calls that have object literal parameters."""
        # Find the opening {
        obj_start = stmt.index('({') + 1

        # Find matching closing }
        brace_count = 0
        obj_end = obj_start
        for i in range(obj_start, len(stmt)):
            if stmt[i] == '{':
                brace_count += 1
            elif stmt[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    obj_end = i
                    break

        # Extract parts
        before = stmt[:obj_start]
        obj_literal = stmt[obj_start:obj_end + 1]
        after = stmt[obj_end + 1:]

        # Convert the object literal
        converted_obj = self.convert_object_literal(obj_literal)

        return before + converted_obj + self.convert_expression(after)

    def convert_object_literal(self, obj_str):
        """Convert a Lua table literal to JS object literal."""
        obj_str = obj_str.strip()

        # Handle empty object
        if obj_str in ['{}', '{ }']:
            return '{}'

        # Remove outer braces
        if obj_str.startswith('{') and obj_str.endswith('}'):
            inner = obj_str[1:-1].strip()
        else:
            inner = obj_str

        # Check if it's an array-like table (all values, no keys)
        if not '=' in inner:
            # Array literal
            return '{' + self.convert_expression(inner) + '}'

        # Convert key=value pairs to key: value
        result = []
        parts = self.split_object_fields(inner)

        for part in parts:
            part = part.strip()
            if not part:
                continue

            if '=' in part:
                # Check if it's assignment or object field
                # In object context, convert = to :
                key_val = part.split('=', 1)
                key = key_val[0].strip()
                value = key_val[1].strip()

                # Handle nested objects or arrays in value
                if value.startswith('{'):
                    value = self.convert_object_literal(value)
                elif value.startswith('function'):
                    value = self.convert_function_expression(value)
                elif value.startswith('`'):
                    # Template literal - preserve as-is
                    value = value
                else:
                    value = self.convert_expression(value)

                result.append(f"{key}: {value}")
            else:
                result.append(self.convert_expression(part))

        return '{ ' + ', '.join(result) + ' }'

    def split_object_fields(self, obj_inner):
        """Split object fields by comma, respecting nested braces, parens, and functions."""
        fields = []
        current = []
        brace_depth = 0
        paren_depth = 0
        in_string = False
        string_char = None

        i = 0
        while i < len(obj_inner):
            char = obj_inner[i]

            if char in ['"', "'"] and (i == 0 or obj_inner[i-1] != '\\'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
            elif not in_string:
                if char == '{':
                    brace_depth += 1
                elif char == '}':
                    brace_depth -= 1
                elif char == '(':
                    paren_depth += 1
                elif char == ')':
                    paren_depth -= 1
                elif char == ',' and brace_depth == 0 and paren_depth == 0:
                    fields.append(''.join(current))
                    current = []
                    i += 1
                    continue

            current.append(char)
            i += 1

        if current:
            fields.append(''.join(current))

        return fields

    def convert_function_expression(self, func_str):
        """Convert function expression in object literal."""
        func_str = func_str.strip()

        # Extract function body between function() and end
        if not func_str.startswith('function'):
            return func_str

        # Find the opening ( and )
        paren_start = func_str.index('(')
        paren_end = func_str.index(')', paren_start)

        # Extract parameters
        params = func_str[paren_start+1:paren_end].strip()

        # Find the body (everything after ) until 'end')
        body_start = paren_end + 1
        body = func_str[body_start:].strip()

        # Remove trailing 'end'
        if body.endswith('end'):
            body = body[:-3].strip()

        # Convert Lua comments to JS comments in the body
        # Replace all standalone -- comments (not inside strings)
        # Simple approach: replace all -- with //
        parts = []
        in_string = False
        string_char = None
        i = 0
        while i < len(body):
            if body[i] in ['"', "'"] and (i == 0 or body[i-1] != '\\'):
                if not in_string:
                    in_string = True
                    string_char = body[i]
                elif body[i] == string_char:
                    in_string = False
                parts.append(body[i])
                i += 1
            elif not in_string and i < len(body) - 1 and body[i:i+2] == '--':
                parts.append('//')
                i += 2
            else:
                parts.append(body[i])
                i += 1
        body = ''.join(parts)

        # Convert the body - split before each top-level 'des.' and '//'
        # Track depth to avoid splitting nested calls
        statements = []
        current = []
        paren_depth = 0
        brace_depth = 0
        in_string = False
        string_char = None
        i = 0

        while i < len(body):
            # Track string and depth
            if body[i] in ['"', "'"] and (i == 0 or body[i-1] != '\\'):
                if not in_string:
                    in_string = True
                    string_char = body[i]
                elif body[i] == string_char:
                    in_string = False
            elif not in_string:
                if body[i] == '(': paren_depth += 1
                elif body[i] == ')': paren_depth -= 1
                elif body[i] == '{': brace_depth += 1
                elif body[i] == '}': brace_depth -= 1

            # Check if we're at a top-level split point (depth 0)
            is_split_point = False
            if paren_depth == 0 and brace_depth == 0 and not in_string:
                if i > 0 and i + 4 <= len(body) and body[i:i+4] == 'des.' and body[i-1] in [' ', '\t']:
                    is_split_point = True
                elif i > 0 and i + 2 <= len(body) and body[i:i+2] == '//' and body[i-1] in [' ', '\t']:
                    is_split_point = True

            if is_split_point and current:
                # Save the current statement
                stmt = ''.join(current).strip()
                if stmt:
                    if stmt.startswith('//'):
                        statements.append(f"{stmt};")
                    else:
                        statements.append(self.convert_statement(stmt))
                current = []

            current.append(body[i])
            i += 1

        # Add the last statement
        if current:
            stmt = ''.join(current).strip()
            if stmt:
                if stmt.startswith('//'):
                    statements.append(f"{stmt};")
                else:
                    statements.append(self.convert_statement(stmt))

        # Join statements with spaces (formatting will be added later)
        converted_body = ' ' + ' '.join(statements) + ' ' if statements else ''

        # Return as function expression (formatting added by format_multiline_output)
        return f"function({params}) {{{converted_body}}}"

    def convert_expression(self, expr):
        """Convert a Lua expression to JavaScript."""
        expr = expr.strip()

        # Extract template literals to protect them from regex replacements
        template_literals = []
        def extract_templates(text):
            result = []
            i = 0
            while i < len(text):
                if text[i] == '`':
                    # Found start of template literal
                    template_start = i
                    i += 1
                    # Find the end, handling escaped backticks
                    while i < len(text):
                        if text[i] == '\\' and i + 1 < len(text):
                            i += 2  # Skip escaped character
                        elif text[i] == '`':
                            # Found end of template
                            template_literals.append(text[template_start:i+1])
                            result.append(f'__TEMPLATE_{len(template_literals)-1}__')
                            i += 1
                            break
                        else:
                            i += 1
                else:
                    result.append(text[i])
                    i += 1
            return ''.join(result)

        expr = extract_templates(expr)

        # Remove local keyword
        expr = re.sub(r'\blocal\s+', '', expr)

        # Track imports
        if 'percent(' in expr:
            self.imports_needed.add('percent')
        if 'selection.' in expr or 'selection(' in expr:
            self.imports_needed.add('selection')
        if re.search(r'\brn2\(', expr):
            self.imports_needed.add('rn2')
        if re.search(r'\brnd\(', expr):
            self.imports_needed.add('rnd')
        if re.search(r'\bd\(', expr):
            self.imports_needed.add('d')
        if 'nh.' in expr:
            self.imports_needed.add('nh')
        if re.search(r'\bshuffle\(', expr):
            self.imports_needed.add('shuffle')

        # Method call syntax: obj:method() → obj.method()
        expr = re.sub(r'(\w+):(\w+)\(', r'\1.\2(', expr)

        # String concatenation: .. → +
        expr = re.sub(r'\s*\.\.\s*', ' + ', expr)

        # Logical operators
        expr = re.sub(r'\band\b', '&&', expr)
        expr = re.sub(r'\bor\b', '||', expr)
        expr = re.sub(r'\bnot\b', '!', expr)

        # Inequality: ~= → !==
        expr = expr.replace('~=', '!==')

        # Comparison: == → ===
        expr = re.sub(r'([^=!])==([^=])', r'\1===\2', expr)

        # Math functions
        expr = re.sub(r'math\.random\(', 'Math.random(', expr)
        expr = re.sub(r'math\.floor\(', 'Math.floor(', expr)
        expr = re.sub(r'math\.ceil\(', 'Math.ceil(', expr)
        expr = re.sub(r'math\.min\(', 'Math.min(', expr)
        expr = re.sub(r'math\.max\(', 'Math.max(', expr)
        expr = re.sub(r'math\.abs\(', 'Math.abs(', expr)

        # Table/array length: # → .length
        expr = re.sub(r'#(\w+)', r'\1.length', expr)

        # Boolean/null values
        expr = re.sub(r'\bnil\b', 'null', expr)

        # Array literals: convert Lua array syntax
        # {1, 2, 3} stays the same
        # { {1,2}, {3,4} } stays but inner arrays need conversion
        expr = self.convert_array_syntax(expr)

        # Restore template literals
        for i, template in enumerate(template_literals):
            expr = expr.replace(f'__TEMPLATE_{i}__', template)

        return expr

    def convert_array_syntax(self, expr):
        """Convert Lua array syntax to JS."""
        # Lua arrays like { {1,2}, {3,4} } → [ [1,2], [3,4] ]
        # Only convert top-level {} to []
        if expr.strip().startswith('{') and expr.strip().endswith('}'):
            # Check if it's array-like (no = signs)
            inner = expr.strip()[1:-1]
            if '=' not in inner or self.is_array_like(inner):
                # Convert to array
                return '[' + inner + ']'
        return expr

    def is_array_like(self, content):
        """Check if table content is array-like (no key=value pairs)."""
        # Simple heuristic: if we see { and } at the same depth without =, it's array-like
        depth = 0
        for i, char in enumerate(content):
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
            elif char == '=' and depth == 0:
                # Check if it's in a nested context
                return False
        return True

    def convert_condition(self, condition):
        """Convert a Lua condition to JavaScript."""
        condition = condition.strip()

        # Convert operators
        condition = re.sub(r'\band\b', '&&', condition)
        condition = re.sub(r'\bor\b', '||', condition)
        condition = re.sub(r'\bnot\b', '!', condition)
        condition = condition.replace('~=', '!==')
        condition = re.sub(r'([^=!])==([^=])', r'\1===\2', condition)
        condition = re.sub(r'\bnil\b', 'null', condition)

        return condition


def convert_lua_file(input_path, output_path=None):
    """Convert a single Lua file to JavaScript."""
    with open(input_path, 'r', encoding='utf-8') as f:
        lua_content = f.read()

    converter = LuaToJsConverter()
    js_content = converter.convert_file(lua_content, os.path.basename(input_path))

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
        print("Usage: lua_to_js.py <input.lua> [output.js]")
        print("   or: lua_to_js.py --batch <input_dir> <output_dir>")
        sys.exit(1)

    if sys.argv[1] == '--batch':
        # Batch convert directory
        if len(sys.argv) < 4:
            print("Usage: lua_to_js.py --batch <input_dir> <output_dir>")
            sys.exit(1)

        input_dir = Path(sys.argv[2])
        output_dir = Path(sys.argv[3])
        output_dir.mkdir(exist_ok=True)

        lua_files = sorted(input_dir.glob('*.lua'))
        print(f"Found {len(lua_files)} Lua files to convert")

        for lua_file in lua_files:
            output_file = output_dir / (lua_file.stem + '.js')
            try:
                convert_lua_file(lua_file, output_file)
            except Exception as e:
                print(f"ERROR converting {lua_file}: {e}")
    else:
        # Single file
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        convert_lua_file(input_file, output_file)


if __name__ == '__main__':
    main()
