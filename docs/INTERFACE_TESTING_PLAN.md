# Interface Testing Plan: Matching C NetHack UI Exactly

## Goal
Ensure the JS port matches C NetHack's user interface character-by-character, including:
- Startup sequence (tutorial prompt, copyright screen)
- Options menu (dense layout with [x] marks, multiple pages, ? help view)
- Terminal attributes (inverse video for headers/prompts, bold text, colors)

## Current Status

### ✅ Completed
1. Created `gen_interface_sessions.py` - Script to capture C NetHack UI (in progress)
2. Created `interface_test_runner.js` - Test framework for replay/comparison (skeleton)
3. Created task breakdown (#23-#27) for implementation

### ⚠️  In Progress
- Task #23: Fixing tmux capture to properly record C NetHack screens
- Researching exact attribute codes used by C NetHack

### ❌ Not Started
- Task #24: Terminal attribute support in JS Display class
- Task #25: JS interface replay system
- Task #26: Rewriting options menu to match C exactly
- Task #27: Adding tutorial prompt

## Key Differences Found (To Be Fixed)

### 1. **Inverse Video (Reverse Video)**
- **C NetHack**: Uses inverse video (white-on-black becomes black-on-white) for:
  - Menu headers ("Pick a role or profession")
  - Option page headers ("Current Options - page 1 of 2")
  - Some prompts
- **JS Port**: Never uses inverse video
- **Fix**: Add attribute support to Display class

### 2. **Options Menu Layout**
- **C NetHack**: Dense 2-column layout like:
  ```
  [x] autopickup      [ ] verbose
  [x] color           [x] DECgraphics
      name:Wizard     pickup_types:$
  ```
- **JS Port**: Simple list with "a) autopickup [enabled]"
- **Fix**: Completely rewrite options menu renderer

### 3. **Tutorial Prompt**
- **C NetHack**: Asks "Would you like a tutorial?" on first startup
- **JS Port**: No tutorial prompt
- **Fix**: Add tutorial prompt to startup sequence

### 4. **Options Navigation**
- **C NetHack**: `>` and `<` for pages, `?` for help, letter keys toggle
- **JS Port**: `>` `<` don't do anything, `?` not implemented
- **Fix**: Implement full navigation matching C

## Testing Infrastructure

### Session File Format (Version 2)
```json
{
  "version": 2,
  "type": "interface",
  "subtype": "startup" | "options",
  "steps": [
    {
      "key": "startup",
      "description": "Initial screen",
      "screen": [...24 lines...],
      "attrs": [...24 attribute lines...]
    }
  ]
}
```

**Attribute Encoding** (per character):
- `0` = normal
- `1` = inverse (reverse video)
- `2` = bold
- `4` = underline
- Colors: `r`=red, `g`=green, `b`=blue, `w`=white, etc.

### Capture Process
1. Run `python3 test/comparison/c-harness/gen_interface_sessions.py --startup`
2. Run `python3 test/comparison/c-harness/gen_interface_sessions.py --options`
3. Generates `interface_startup.session.json` and `interface_options.session.json`
4. Files stored in `test/comparison/sessions/`

### Test Process
1. Run `node --test test/comparison/interface_test_runner.js`
2. For each session file:
   - Initialize JS NetHack in headless mode
   - Send same keys as C session
   - Capture JS screen after each step
   - Compare character-by-character including attributes
   - Report any differences

## Implementation Order

1. **Phase 1: Capture System** (Task #23)
   - Fix tmux capture to properly record C NetHack screens
   - Enhance attribute parser to decode ANSI escape codes
   - Capture complete startup + options sequences

2. **Phase 2: Display Attributes** (Task #24)
   - Add attribute tracking to Display grid cells
   - Implement inverse video rendering in CSS
   - Add bold/underline support
   - Update menu renderers to use inverse for headers

3. **Phase 3: Options Menu** (Task #26)
   - Design dense 2-column layout
   - Implement [x]/[ ] checkbox rendering
   - Add page navigation (>, <)
   - Add help view (?)
   - Match exact spacing and positioning from C

4. **Phase 4: Tutorial** (Task #27)
   - Add tutorial prompt before character creation
   - Implement localStorage persistence for "don't show again"
   - Match exact prompt text from C

5. **Phase 5: Testing** (Task #25)
   - Implement headless mode for JS NetHack
   - Build session replay system
   - Create character-by-character comparison
   - Generate detailed diff reports

## Running the Tests

```bash
# Generate C NetHack interface traces
python3 test/comparison/c-harness/gen_interface_sessions.py --startup
python3 test/comparison/c-harness/gen_interface_sessions.py --options

# Run interface comparison tests
node --test test/comparison/interface_test_runner.js

# View detailed diffs
node --test test/comparison/interface_test_runner.js --verbose
```

## Success Criteria

- [ ] Startup sequence matches C NetHack exactly (24x80 grid, all characters)
- [ ] Options menu matches C NetHack layout (checkboxes, pages, navigation)
- [ ] Inverse video used for headers/prompts matching C exactly
- [ ] All interface tests pass (0 character differences)
- [ ] Tutorial prompt appears on first startup like C

## Notes

- C NetHack uses a 80x24 terminal (columns x rows)
- Inverse video is ANSI escape code `\x1b[7m` (SGR 7)
- Bold is `\x1b[1m` (SGR 1)
- Reset is `\x1b[0m` (SGR 0)
- tmux can capture both plain text and escape codes with `-e` flag

## References

- Existing session format: `test/comparison/sessions/seed*_chargen_*.session.json`
- Existing capture script: `test/comparison/c-harness/gen_chargen_sessions.py`
- C NetHack options code: `nethack-c/src/options.c`
- C NetHack display code: `nethack-c/win/tty/topl.c`, `nethack-c/win/tty/wintty.c`
