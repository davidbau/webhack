#!/usr/bin/env python3
"""
Postprocess converted level files to fix common syntax errors.
Apply this after lua_to_js.py or lualevel_to_js.py conversion.
"""

import sys
import re
from pathlib import Path


def postprocess_level(content, filename=""):
    """Apply common fixes to converted level files."""

    # Fix 1: Remove premature closing brace before return statement
    # Pattern: }
    #          return des.finalize_level();
    # Common in minend-3, minetn-6
    content = re.sub(
        r'\n    // \}\n\}\n(    return des\.finalize_level\(\);)',
        r'\n\1',
        content
    )

    # Fix 2: Remove extra closing brace after hell_tweaks or similar
    # Pattern: hell_tweaks(protected_region);}
    content = re.sub(
        r'(hell_tweaks\([^)]+\));}\n',
        r'\1;\n',
        content
    )

    # Fix 3: Fix filters object → array
    # Pattern: filters: {
    #             // comment
    #             function(x, y) { ... },
    content = re.sub(
        r'\n(    )filters: \{\n(\s+// [^\n]+\n\s+)function\(',
        r'\n\1const filters = [\n\2function(',
        content
    )
    # And close with ]; - change }; to ]; after filters definition
    if 'const filters = [' in content:
        lines = content.split('\n')
        in_filters = False
        for i, line in enumerate(lines):
            if 'const filters = [' in line:
                in_filters = True
            elif in_filters and line.strip() == '};':
                lines[i] = line.replace('};', '];')
                in_filters = False
                break
        content = '\n'.join(lines)

    # Fix 4: Variable declarations with colon instead of equals
    # Pattern: locs: selection.room()
    # Should be: const locs = selection.room()
    content = re.sub(
        r'^(             )locs: (selection\.[^\n]+)$',
        r'\1const locs = \2',
        content,
        flags=re.MULTILINE
    )

    # Pattern: func: function(x,y)
    # Should be: const func = function(x,y)
    content = re.sub(
        r'^(             )func: (function\([^)]*\))$',
        r'\1const func = \2',
        content,
        flags=re.MULTILINE
    )

    # Pattern: idx: Math.random(...)
    # Should be: const idx = Math.random(...)
    content = re.sub(
        r'^(    )idx: (Math\.random\([^)]+\);)$',
        r'\1const idx = \2',
        content,
        flags=re.MULTILINE
    )

    # Fix 5: Python-style integer division // → Math.floor(x/y)
    # Pattern: (x+1)//3
    content = re.sub(
        r'\(([^)]+)\)//(\d+)',
        r'Math.floor((\1)/\2)',
        content
    )

    # Fix 6: Missing closing brace for for loops
    # Pattern: des.monster();
    #          // removed extra }
    # Should be: des.monster();
    #            }
    content = re.sub(
        r'(\n      des\.(monster|object|trap)\(\);)\n    // removed extra \}',
        r'\1\n    }',
        content
    )

    # Fix 6b: Missing closing brace for loops before return
    # Pattern: des.monster();
    #
    #          return des.finalize_level();
    # Should be: des.monster();
    #            }
    #
    #            return des.finalize_level();
    content = re.sub(
        r'(\n      des\.(monster|object|trap)\([^)]*\);)\n    \n(    return des\.finalize_level\(\);)',
        r'\1\n    }\n\n\3',
        content
    )

    # Fix 6c: Extra closing braces after "removed extra" comment
    # Pattern: }
    #          }
    #          }
    #              return des.finalize_level();
    # Should be: }
    #
    #            return des.finalize_level();
    content = re.sub(
        r'\n    // removed extra \n    \}\n\}\n\}\n(    return des\.finalize_level\(\);)',
        r'\n\n\1',
        content
    )

    # Fix 6d: Extra closing brace before return (quest files)
    # Pattern: });
    #
    #
    #
    #    }
    #    return des.finalize_level();
    # Should be: });
    #
    #    return des.finalize_level();
    content = re.sub(
        r'(\);)\n\n+\n    \}\n(    return des\.finalize_level\(\);)',
        r'\1\n\n\2',
        content
    )

    # Fix 7: Multiple variable declarations with comma (Lua multiple assignment)
    # Pattern: ltype,rtype: "weapon shop","armor shop"
    content = re.sub(
        r'^(\s+)(\w+),(\w+): "([^"]+)","([^"]+)"$',
        r'\1const \2 = "\4"; const \3 = "\5"',
        content,
        flags=re.MULTILINE
    )

    # Fix 8: Multiple reassignment with comma (swap)
    # Pattern: ltype,rtype: rtype,ltype
    content = re.sub(
        r'^(\s+)(\w+),(\w+): (\w+),(\w+)$',
        r'\1[\2, \3] = [\4, \5]',
        content,
        flags=re.MULTILINE
    )

    # Fix 9: Array literal should be object literal
    # Pattern: questtext: [
    #             msg_fallbacks: {
    # Should be: questtext: {
    if 'questtext: [' in content and 'msg_fallbacks:' in content:
        content = content.replace('questtext: [', 'questtext: {')
        content = re.sub(r'(\n       \},\n    )\}\](\n\n    // return)', r'\1}\2', content)

    return content


def process_file(input_file, output_file=None):
    """Process a single file."""
    if output_file is None:
        output_file = input_file

    with open(input_file, 'r') as f:
        content = f.read()

    original_content = content
    content = postprocess_level(content, filename=input_file)

    if content != original_content:
        with open(output_file, 'w') as f:
            f.write(content)
        print(f"Fixed: {input_file}")
        return True
    else:
        print(f"No changes: {input_file}")
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: postprocess_levels.py <file.js> [output.js]")
        print("   or: postprocess_levels.py --all  (process all js/levels/*.js)")
        sys.exit(1)

    if sys.argv[1] == '--all':
        # Process all level files
        level_dir = Path('js/levels')
        count = 0
        for level_file in sorted(level_dir.glob('*.js')):
            if process_file(level_file):
                count += 1
        print(f"\nProcessed {count} files")
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        process_file(input_file, output_file)


if __name__ == '__main__':
    main()
