# Development Guide

> *"Welcome, strider, to the Mazes of Development!  You fall through a trap
> door into a large room filled with source code."*

**See also:**
[DESIGN.md](DESIGN.md) (architecture) |
[DECISIONS.md](DECISIONS.md) (trade-offs) |
[PARITY_TEST_MATRIX.md](PARITY_TEST_MATRIX.md) (test suites & gates) |
[LORE.md](LORE.md) (porting lessons) |
[TESTING.md](TESTING.md) (test dashboard & workflows)

## Prerequisites

- **Node.js 25+** (see `.nvmrc`)
- **Python 3** (for `python3 -m http.server` and data generators)
- **Puppeteer** (`npm install` — used by E2E tests)

For C comparison testing (optional):
- **gcc, make, bison, flex** (build tools)
- **ncurses-dev** (`libncurses-dev` on Linux, Xcode command line tools on macOS)
- **tmux** (drives the C binary headlessly)

## Quick Start

```bash
# Install dependencies
npm install

# Run the game locally
npm run serve
# Open http://localhost:8080

# Run all fast tests (unit + session)
npm test

# Run everything (unit + session + e2e)
npm run test:all
```

## Project Structure

See [DESIGN.md](DESIGN.md) for the complete module architecture and C-to-JS correspondence mapping. This guide focuses on workflows and commands.

For a quick reference: the `js/` directory contains 32 ES6 modules organized by subsystem (Core, Display & I/O, RNG, World Generation, Creatures, Objects, etc.), each with comments linking to C source files. The `test/` directory contains unit tests, E2E browser tests, and C-comparison session tests.

## Running Tests

> *"You feel as if someone is testing you."*

### Fast Tests (no C binary needed)

```bash
# Unit tests — module-level correctness
npm run test:unit

# E2E tests — browser rendering via Puppeteer
npm run test:e2e

# Session comparison — replay C reference sessions
npm run test:session

# Everything at once
npm run test:all
```

Timeout policy (hang detection):
- `npm run test:unit` enforces a `1000ms` timeout per unit test.
- Single-session replay runs (`node test/comparison/session_test_runner.js <session>`) enforce a `10000ms` timeout per session by default.
- `session_test_runner` runs the full selected set by default; add `--fail-fast` only when you explicitly want to stop on first failure.

### Replay Boundary (Core vs Harness)

Keep gameplay and UI semantics in core runtime modules (`js/`), not in
comparison orchestration.

- Core runtime owns command behavior, modal flows, rendering, and state transitions.
- Replay/comparison harness owns input driving, capture, normalization, and diff reporting.
- If replay needs a special case, prefer a generic capture policy (for example,
  display-only acknowledgement frames) over per-command behavior forks.
- For gameplay screen text diffs, prefer ANSI-cell-derived plain rows when ANSI
  capture is available; avoid comparator-side column-shift heuristics. Use
  plain-line DEC decoding only as a legacy fallback when ANSI is unavailable.
- For interface screen text diffs, compare normalized rows directly (no
  left-shift fallback matching).

### Session Tests In Detail

The session runner auto-discovers all `*.session.json` files in
`test/comparison/sessions/` and `test/comparison/maps/` and verifies
JS output against C-captured reference data:

| Session Type | What It Tests | Example |
|---|---|---|
| `"map"` (source: c) | typGrid match + RNG traces + structural validation | `seed16_maps_c.session.json` |
| `"gameplay"` | Startup typGrid + per-step RNG traces + screen rendering | `seed42.session.json` |
| `"chargen"` | Character creation reference data (screens, RNG, inventory) | `seed42_chargen_valkyrie.session.json` |

Map sessions generate levels 1→5 sequentially on one RNG stream (matching
C's behavior). Each level is checked for:
- Cell-by-cell typGrid match against C
- RNG call count match (when `rngCalls` present)
- Per-call RNG trace match (when `rng` present)
- Wall completeness, corridor connectivity, stairs placement

### C Comparison (optional, slower)

```bash
# One-time setup: clone, patch, and build the C binary
bash test/comparison/c-harness/setup.sh

# Regenerate all C sessions and maps from seeds.json config
python3 test/comparison/c-harness/run_session.py --from-config
python3 test/comparison/c-harness/gen_map_sessions.py --from-config

# Generate character creation sessions for all 13 roles
python3 test/comparison/c-harness/gen_chargen_sessions.py --from-config

# Or capture a single seed/role manually
python3 test/comparison/c-harness/gen_map_sessions.py 42 5 --with-rng
python3 test/comparison/c-harness/gen_chargen_sessions.py 42 v h f n Valkyrie

# Session runner auto-discovers all C-captured files
npm run test:session
```

## Common Development Tasks

### Unified Backlog Intake

Use one project backlog for all work, with labels for classification.

1. Capture candidate issues from:
   - failing tests/sessions and CI regressions,
   - C-to-JS audit/coverage gaps,
   - manual playtesting findings,
   - selfplay findings,
   - release blockers and user/developer bug reports.
2. Classify every new issue with labels.
   - Use `parity` for C-vs-JS divergence/parity work.
   - Add other domain labels as appropriate (`selfplay`, `infra`, `docs`, etc.).
3. Keep new issues unowned by default.
   - Add `agent:<name>` only when an agent actively claims the issue.
4. Use evidence-first issue bodies for `parity` issues.
   - Include seed/session/command, first mismatch point, and expected vs actual behavior.

## C Parity Policy

When working on C-vs-JS parity, follow this rule:

- Use failing unit/session tests to decide what to work on next.
- Treat session replay results as the primary gameplay parity authority; use unit tests as focused guardrails.
- Use C source code (`nethack-c/src/*.c`) as the behavior spec.
- Do not "fix to the trace" with JS-only heuristics when C code disagrees.
- If a test reveals missing behavior, port the corresponding C logic path.
- Keep changes incremental and keep tests green after each port batch.

### Parity Backlog Intake Loop

Use this workflow whenever session tests are failing and backlog intake needs
to be refreshed:

1. Run the parity suites and capture failures:
   ```bash
   npm run test:session
   ```
2. Group failures by shared first-divergence signature (same subsystem/caller).
3. File one `parity` GitHub issue per systematic cluster with evidence-first body:
   - session filename(s)
   - first mismatch point (step/index/row)
   - JS vs C expected behavior
4. Prioritize issues by:
   - blast radius (how many sessions share it)
   - earliness (how soon divergence starts)
   - leverage (whether one fix likely collapses multiple failures)
5. Repeat after each landed fix; close stale/superseded issues immediately.

Evidence template for each issue:

```text
Session: seedXYZ_*.session.json
First mismatch: rng step=<...> index=<...> OR screen step=<...> row=<...>
JS: <actual>
C:  <expected>
Caller (if present): <function(file:line)>
```

### Tutorial Parity Notes

Recent parity work on tutorial sessions established a few stable rules:

- Tutorial status rows should use `Tutorial:<level>` instead of `Dlvl:<level>`.
- Tutorial startup/replay should expose `Xp`-style status output for parity with
  captured interface sessions.
- `nh.parse_config("OPTIONS=...")` options used by tutorial scripts now feed map
  flags (`mention_walls`, `mention_decor`, `lit_corridor`) so movement/rendering
  behavior follows script intent rather than ad-hoc tutorial checks.
- Blocked wall movement now keys off `mention_walls` behavior and matches C
  tutorial captures (`It's a wall.`).

With those in place, tutorial interface screen matching is now complete in the
manual tutorial session. The remaining first mismatch is RNG-only: an early
`nhl_random` (`rn2(100)`) divergence immediately after the first tutorial
`mktrap` call.

### Inventory-Letter Parity Notes

For C-faithful pickup lettering (`assigninvlet` behavior):

- A dropped item can keep its prior `invlet` when picked back up, as long as that letter is currently free in inventory.
- If that carried-over `invlet` collides with an in-use letter, inventory-letter assignment falls back to rotated `lastinvnr` allocation.
- This affects visible pickup messages (`<invlet> - <item>.`) even when RNG remains fully aligned.

### Tourist Session Parity Notes (seed6, non-wizard)

Recent work on `test/comparison/sessions/seed6_tourist_gameplay.session.json`
established these practical replay/parity rules:

- Throw prompt `?/*` in this trace is not generic help; it opens an in-prompt
  inventory overlay (right-side menu) and keeps prompt flow pending until an
  explicit dismiss key.
- Apply prompt `?/*` in this trace also behaves as an in-prompt modal list:
  while the list is open, non-listed keys are ignored and only listed apply
  candidate letters should be accepted as selection keys.
- Outside that `?/*` list mode, apply prompt letter selection is broader than
  the suggestion list; selecting non-suggested inventory letters can still hit
  C-style fallback text (`Sorry, I don't know how to use that.`).
- `FLINT` should not be treated as apply-eligible in normal prompt candidate
  filtering; this was causing false-positive apply prompts in wizard sessions.
- Tourist credit-card apply path is direction-driven (`In what direction?`);
  invalid non-wizard direction input must report
  `What a strange direction!  Never mind.`.
- In wizard mode, invalid direction input for that apply-direction path is
  silent (no `Never mind.` topline).
- `$` must route to C-style wallet reporting (`Your wallet contains N zorkmid(s).`).
- `:` on an empty square should report `You see no objects here.` in this trace.
- Throw prompt suggestion letters follow C's class-filtered set (coins always;
  weapons when not slinging; gems/stones when slinging; exclude worn/equipped
  items). This only affects prompt text; manual letter entry is still allowed.
- For throw/inventory overlay parity, cap right-side overlay offset at column
  `41` (`offx <= 41`) rather than pure `cols - maxcol - 2`; C tty commonly
  clamps here for these menu windows.
- For unresolved `i` inventory-menu steps, use captured screen frames as
  authoritative in replay; JS-only re-rendering can shift overlay columns when
  item detail text differs (`(being worn)`, tin contents, etc.).
- Overlay dismiss must clear the right-side menu region before re-showing the
  throw prompt, or stale menu rows leak into later captured frames.
- Read prompt `?/*` is a modal `--More--` listing flow; non-dismiss keys keep
  the listing frame until `space`/`enter`/`esc` returns to the prompt.
- In AT_WEAP melee flow, monsters can spend a turn wielding a carried weapon
  (`The goblin wields a crude dagger!`) before the first hit roll.
- In AT_WEAP melee hit/miss messaging, session parity expects the C-style
  pre-hit weapon phrase on the same topline as the hit result (for example
  `The goblin thrusts her crude dagger.  The goblin hits!`), so replay must
  preserve this pre-hit text in weapon attack flows.
- Correct AT_WEAP possessive phrasing depends on monster sex state from
  creation (`mon.female`), plus C-style object naming (`xname`) for the
  wielded weapon's appearance name (`crude dagger` vs discovered object name).
- AT_WEAP melee damage must include wielded-weapon `dmgval` (`rnd(sdam)`) after
  base `d(1,4)` damage; omitting that call shifts later knockback/runmode RNG.
- In AT_WEAP ranged flow, monster projectiles must consume `minvent` stacks and
  land on floor squares; otherwise later pet `dog_goal` object scans miss
  `dogfood()->obj_resists` calls and RNG diverges downstream.
- Potion quaff healing must follow C `healup()` overflow semantics: when healing
  exceeds current max HP, increase max HP by potion-specific `nxtra` and clamp
  current HP to the new max. Without this, full-HP `extra healing` quaffs show
  transient status-row HP drift even when message/RNG flow matches.
- `--More--`-split steps and extended-command (`#...`) typing frames in this
  session are best handled as capture-authoritative replay frames (screen parity
  first) when they carry no gameplay state progression.
- `session_test_runner` gameplay divergence `step` values are 1-based (same
  indexing used by `rng_step_diff --step N`), so step numbers can be copied
  directly between tools without adding/subtracting 1.
- Extended-command shorthand Enter synthesis should only apply to letter keys;
  treating control keys (for example `Esc`) as shorthand can leak a stray
  `Enter` into the input queue and misalign subsequent command prompts.
- Double `m` prefix should cancel silently (clear `menuRequested` with no
  message) to match C command-prefix behavior.
- Some C captures mix left-side map glyphs and right-side overlay text on the
  same row (for example inventory category headers). Preserve raw column
  alignment from core rendering; do not apply tmux col-0 compensation in the
  comparator.

Measured progress in the latest pass:
- First divergence moved from early AT_WEAP messaging drift (`step 605`) to a
  late monster-turn RNG boundary (`step 760`, `distfleeck` context).
- Current metrics: `rng=10447/14063`, `screens=1071/1284`, `colors=29988/30776`.
- Current frontier is late-turn monster/replay boundary alignment in the
  tourist non-wizard session (first visible map drift at step `761`).

### Modifying the dungeon generator

1. Make your changes in `js/dungeon.js` (or related modules)
2. Run `npm run test:session` — failures
   show exactly which cells changed and at which seed/depth
3. If the change is intentional and matches C, the C reference data
   doesn't change. If the C binary also changed, regenerate:
   ```bash
   python3 test/comparison/c-harness/run_session.py --from-config
   python3 test/comparison/c-harness/gen_map_sessions.py --from-config
   ```

### Debugging C-vs-JS divergence

> *"You are hit by a divergent RNG stream! You feel disoriented."*

C map sessions with RNG traces are pre-generated for difficult seeds
(configured in `test/comparison/seeds.json`). The traces include caller
function names for readability:
```
rn2(2)=0 @ randomize_gem_colors(o_init.c:88)
rn2(11)=9 @ shuffle(o_init.c:128)
```

When a map doesn't match C:

```bash
# The session runner compares per-call and reports the first mismatch:
#   RNG diverges at call 1449: JS="rn2(100)=37" session="rn2(1000)=377"
npm run test:session

# To regenerate C traces after a patch change:
python3 test/comparison/c-harness/gen_map_sessions.py --from-config
```

#### Diagnostic Tools for RNG Divergence

Two specialized tools help isolate RNG divergence at specific game turns:

**First-response workflow (recommended):**

```bash
# 1) Reproduce one failing session with caller context on JS RNG entries.
node test/comparison/session_test_runner.js --verbose \
  test/comparison/sessions/seed202_barbarian_wizard.session.json

# 2) Drill into the exact divergent step with a local windowed diff.
node test/comparison/rng_step_diff.js \
  test/comparison/sessions/seed202_barbarian_wizard.session.json \
  --step 16 --window 8
```

Notes:
- Caller tags are on by default in replay/session tooling (`@ caller(file:line)`).
- Parent/grandparent context (`<= ... <= ...`) is on by default with caller tags.
- Set `RNG_LOG_TAGS=0` to disable caller tags (faster, shorter logs).
- Set `RNG_LOG_PARENT=0` to disable parent/grandparent context for shorter lines.
- `rng_step_diff.js` already forces caller tags; export `RNG_LOG_TAGS=1` explicitly only when using other runners that override it.

**`test/comparison/rng_step_diff.js`** — Step-level C-vs-JS RNG caller diff

Replays a session in JS and compares RNG stream against captured C data. By
default it compares a specific step; use `--phase startup` to compare startup
RNG (useful when the first step already starts divergent).

```bash
# Inspect first divergence on tutorial accept step
node test/comparison/rng_step_diff.js \
  test/comparison/sessions/manual/interface_tutorial.session.json \
  --step 1 --window 3

# Inspect startup-phase divergence (pre-step RNG drift)
node test/comparison/rng_step_diff.js \
  test/comparison/sessions/manual/interface_tutorial.session.json \
  --phase startup --window 5

# Example output:
# first divergence index=5
# >> [5] JS=rn2(100)=27 | C=rn2(100)=97
#      JS raw: rn2(100)=27 @ percent(sp_lev.js:6607)
#      C  raw: rn2(100)=97 @ nhl_random(nhlua.c:948)
```

**Use when**: `session_test_runner` reports a mismatch and you need exact
call-site context at the first divergent RNG call within a specific step.

For tutorial-specific RNG drift, two debug env flags are available:

```bash
# Log non-counted raw PRNG advances in JS RNG log output.
WEBHACK_LOG_RAW_ADVANCES=1 \
node test/comparison/rng_step_diff.js \
  test/comparison/sessions/manual/interface_tutorial.session.json \
  --step 1 --window 8

# Override raw draws before first tutorial percent() call.
# Default is N=2; set this env var to compare other values.
WEBHACK_TUT_EXTRA_RAW_BEFORE_PERCENT=0 \
node test/comparison/rng_step_diff.js \
  test/comparison/sessions/manual/interface_tutorial.session.json \
  --step 1 --window 3
```

**`selfplay/runner/pet_rng_probe.js`** — Per-turn RNG delta comparison

Compares RNG call counts between C and JS implementations on a per-turn basis,
with filtering for specific subsystems (e.g., dog movement). Runs both C (via
tmux) and JS (headless) simultaneously and shows where RNG consumption diverges.

```bash
# Compare first 9 turns for seed 13296
node selfplay/runner/pet_rng_probe.js --seed 13296 --turns 9

# Show detailed RNG logs for specific turns
node selfplay/runner/pet_rng_probe.js --seed 13296 --turns 20 --show-turn 7 --show-turn 8

# Output shows per-turn RNG call counts and dog_move specific calls:
# Turn | C rng calls | JS rng calls
#    1 |   37         |   37
#    7 |   12         |   16    <- divergence detected
```

**Use when**: RNG traces show divergence but you need to pinpoint exactly which
turn and which subsystem (monster movement, item generation, etc.) is responsible.

#### Throw-Replay Lore (Pet/Throw Parity)

For monster thrown-weapon parity, do not assume one `thrwmu()` is fully
resolved inside one captured input step.

- In C sessions, a throw often appears as a multi-step sequence:
  - an initial step with top line `"The <monster> throws ..."` and one
    `rn2(5)` at `m_throw(mthrowu.c:772)`,
  - later key steps that continue the projectile (`rn2(5)` again, and
    sometimes `thitu()`/`dmgval()` rolls).
- This pattern is easy to see in
  `seed110_samurai_selfplay200.session.json` and
  `seed206_monk_wizard.session.json`.
- Practical implication: if JS resolves full projectile flight/hit/drop in a
  single turn, it can create false-looking RNG and map glyph drift even when
  the message text seems close.

**`selfplay/runner/trace_compare.js`** — C trace vs JS behavior comparison

Replays a captured C selfplay trace in JS headless mode and compares turn-by-turn
behavior (actions, position, HP, dungeon level). Supports position offsets for
cases where maps differ slightly but gameplay is similar.

```bash
# Compare C trace against JS headless replay
node selfplay/runner/trace_compare.js --trace traces/captured/trace_13296_valkyrie_score43.json

# Compare with position offset adjustment
node selfplay/runner/trace_compare.js --trace traces/captured/trace_79.json --dx 1 --dy 0

# Ignore position mismatches (focus on actions/HP)
node selfplay/runner/trace_compare.js --trace traces/captured/trace_79.json --ignore-position

# Save JS trace for later inspection
node selfplay/runner/trace_compare.js --trace traces/captured/trace_79.json --output /tmp/js_trace.json

# Output shows first 20 mismatches:
# turn 7: diffs=action,position C={"action":"explore","position":{"x":40,"y":11},"hp":14,"hpmax":14,"dlvl":1} JS={"action":"rest","position":{"x":40,"y":12},"hp":14,"hpmax":14,"dlvl":1}
```

**Use when**: You have a C selfplay trace showing interesting behavior (combat,
prayer, item usage) and want to verify JS reproduces the same decision-making
and outcomes.

**Typical workflow**:
1. Capture C selfplay trace showing the divergence or interesting behavior
2. Run `trace_compare.js` to see when JS behavior diverges from C
3. Use `pet_rng_probe.js` to identify which turn RNG consumption differs
4. Add targeted RNG logging around the suspicious code path
5. Compare RNG logs to find the extra/missing call

### ANSI/Color Parity Gotchas

Recent gameplay color parity work surfaced a few high-impact pitfalls:

- For session comparisons, preserve true ANSI source lines.
  - `test/comparison/session_loader.js:getSessionScreenAnsiLines()` must prefer
    `screenAnsi` when both `screen` and `screenAnsi` are present.
  - If this regresses, color checks silently compare against plain text and
    report misleading `fg=7` mismatches.
- Headless ANSI export must map color index `8` (NO_COLOR) to SGR `90`
  (and bg `100`), not fall back to `37`.
  - Missing this mapping produces persistent `7 -> 8` color deltas even when
    the in-memory screen color grid is correct.
- Overlay inventory category headers are inverse-video in C captures.
  - Render `Weapons/Armor/...` heading rows with `attr=1` in overlay menus.
- Up-stairs (`<`) use yellow/gold color in captures, while down-stairs (`>`)
  remain gray in these flows.
- Remembered room floor cells are compared as NO_COLOR tone, while remembered
  walls/doors retain terrain colors.

### CORE vs DISP RNG Audits

For display-only RNG investigations (C `rn2_on_display_rng` / `newsym_rn2` paths),
follow the focused playbook in:

- `docs/plans/RNG_DISPRNG_AUDIT_PLAN.md`

Use that workflow before adding any new RNG infrastructure. The default policy is:
- port C logic first;
- add DISP-specific tracing only when repeated first-divergence evidence points to display paths.

### Adding a new test seed

1. Add the seed to `test/comparison/seeds.json`:
   - `map_seeds.with_rng.c` for C map sessions with RNG traces
   - `session_seeds.sessions` for full gameplay sessions
   - `chargen_seeds.sessions` for character creation sessions
2. Regenerate: `python3 test/comparison/c-harness/gen_map_sessions.py --from-config`
3. `npm run test:session` auto-discovers the new file

### Character creation sessions

Chargen sessions capture the full interactive character creation sequence
for all 13 roles, recording every keystroke (including `--More--` as space),
screen state, RNG traces, and starting inventory. Configuration is in
`seeds.json` under `chargen_seeds`:

```bash
# Generate all 13 roles
python3 test/comparison/c-harness/gen_chargen_sessions.py --from-config

# Or a single role
python3 test/comparison/c-harness/gen_chargen_sessions.py 42 v h f n Valkyrie
```

The script adaptively navigates the character creation menus, handling
cases where menus are auto-skipped (e.g., Knight has only one valid race
and alignment). Each session includes the typGrid and inventory display
for comparison with JS.

### Regenerating monster/object data

The monster and object tables are auto-generated from C headers:

```bash
python3 gen_monsters.py > js/monsters.js
python3 gen_objects.py > js/objects.js
```

### Converting Lua special levels to JavaScript

NetHack 3.7 uses Lua scripts for special level generation (Castle, Asmodeus, Oracle,
etc.). The `tools/lua_to_js.py` converter translates these to JavaScript modules:

```bash
# Convert a single level
python3 tools/lua_to_js.py nethack-c/dat/asmodeus.lua > js/levels/asmodeus.js

# Regenerate all converted levels (131 Lua files → 38 active JS files)
for lua_file in nethack-c/dat/*.lua; do
    base=$(basename "$lua_file" .lua)
    # Convert names: bigrm-XX to bigroom-XX
    js_name=$(echo "$base" | sed 's/^bigrm-/bigroom-/')
    python3 tools/lua_to_js.py "$lua_file" > "js/levels/$js_name.js"
done
```

#### What the converter handles

The converter performs careful syntax translation to preserve game semantics:

**String handling:**
- Lua multiline strings `[[ ... ]]` → JavaScript template literals `` `...` ``
- Backticks inside multiline strings are escaped: `` `liberated` `` → `` \`liberated\` ``
- Template literals are protected from regex replacements during expression conversion
- Regular quoted strings (`"..."`, `'...'`) are preserved as-is

**Comments:**
- Lua comments `--` → JavaScript comments `//`
- Comment detection uses string tracking to avoid false matches inside strings

**Expression conversion:**
- String concatenation: `..` → `+`
- Logical operators: `and` → `&&`, `or` → `||`, `not` → `!`
- Method calls: `obj:method()` → `obj.method()`
- Inequality: `~=` → `!==`
- Equality: `==` → `===`
- Table length: `#tbl` → `tbl.length`
- Boolean/null: `nil` → `null`

**Control flow:**
- `for i = 1, n do ... end` → `for (let i = 1; i <= n; i++) { ... }`
- `if ... then ... end` → `if (...) { ... }`
- `function name() ... end` → `function name() { ... }`

**Data structures:**
- Arrays: `{ 1, 2, 3 }` → `[ 1, 2, 3 ]` (simple arrays only)
- Objects: `{ key = value }` → `{ key: value }`

**Special level DSL:**
- Preserves `des.*` calls as-is (same API between Lua and JS)
- Handles nested `des.map({ ..., contents: function() { ... } })` structures
- Maintains proper statement boundaries with depth tracking

#### Known limitations

- Template literals with `${}` interpolation syntax would break (none found in NetHack Lua)
- Complex nested table expressions may need manual adjustment
- Assumes `des.*` functions have identical signatures between Lua and JS

#### Debugging converter issues

When a converted file has problems:

1. **Check ASCII maps** — dots becoming `+` means template literal protection failed
2. **Check comments** — comments eating code means statement splitting is wrong
3. **Check syntax errors** — unbalanced braces usually means multiline collection broke
4. **Run all Lua files** — `for f in nethack-c/dat/*.lua; do python3 tools/lua_to_js.py "$f" > /tmp/test.js || echo "FAILED: $f"; done`

The converter tracks several state machines simultaneously:
- String tracking (single/double quote detection)
- Brace/paren depth (for multiline call collection)
- Template literal extraction (to protect from regex corruption)
- Comment context (to avoid converting `--` inside strings)

### Adding a new C patch

Patches live in `test/comparison/c-harness/patches/` and are applied by
`setup.sh`. To add one:

1. Make changes under `nethack-c/`.
2. Export a numbered patch into `test/comparison/c-harness/patches/`, e.g.
   `cd nethack-c && git diff > ../test/comparison/c-harness/patches/012-your-patch.patch`
3. Run `bash test/comparison/c-harness/setup.sh` to verify apply/build/install.

## The C Harness

> *"You hear the rumble of distant compilation."*

The C harness builds a patched NetHack 3.7 binary for ground-truth comparison.
The C source is **frozen at commit `79c688cc6`** and never modified directly —
only numbered patches in `test/comparison/c-harness/patches/` are applied on top
(`001` through `011` as of 2026-02-19).

Core harness capabilities come from:

**`001-deterministic-seed.patch`** — Seed control via `NETHACK_SEED`.

**`002-fixed-datetime-for-replay.patch`** and
**`011-fix-ubirthday-with-getnow.patch`** — Fixed datetime support for replay
determinism, including shopkeeper-name `ubirthday` parity.

**`003-map-dumper.patch`** — `#dumpmap` wizard command for raw typ grids.

**`004-prng-logging.patch`**, **`009-midlog-infrastructure.patch`**, and
**`010-lua-rnglog-caller-context.patch`** — high-fidelity RNG tracing with
caller context.

**`005-obj-dumper.patch`** and **`008-checkpoint-snapshots.patch`** — object
and full-checkpoint state dumps for step-local divergence debugging.

### Why raw terrain grids instead of terminal output?

A `|` on screen could be VWALL, TLWALL, TRWALL, or GRAVE. The raw typ integers
are unambiguous. Terminal output also depends on FOV (the player can't see most
of the map), and requires ANSI escape stripping. Integer grids are faster,
simpler, and definitive.

### Setup gotchas

- **Lua is required** — NetHack 3.7 embeds Lua. `setup.sh` runs `make fetch-lua`.
- **Wizard mode** — `sysconf` must have `WIZARDS=*`. The script sets this.
- **Stale game state** — Lock files (`501wizard.0`), saves, and bones from
  crashed tmux sessions cause "Destroy old game?" prompts. All harness scripts
  clean these up before each run.
- **Parallel Lua build race** — `make -j` can race on `liblua.a`. The script
  builds Lua separately first.

## Architecture in 60 Seconds

> *"You read a blessed scroll of enlightenment."*

**Game loop**: `js/nethack.js` runs an async loop. Player input uses
`await getChar()` which yields to the browser event loop. Every function
that might need input must be `async`.

**PRNG**: `js/isaac64.js` produces bit-identical uint64 sequences to C.
`js/rng.js` wraps it with `rn2()`, `rnd()`, `d()`, etc. The RNG log
(`enableRngLog()` / `getRngLog()`) captures every call for comparison.

**Level generation**: `initRng(seed) → initLevelGeneration() → makelevel(depth) → wallification(map)`. One continuous RNG stream across depths.

**Display**: `<pre>` element with per-cell `<span>` tags. DEC graphics
symbols mapped to Unicode box-drawing characters. No canvas, no WebGL.

**Testing philosophy**: Two layers of truth —
1. ISAAC64 produces identical sequences (golden reference files)
2. JS matches C cell-for-cell (C-captured sessions with RNG traces)

## Code Conventions

- **C references**: Every ported function has `// C ref: filename.c:function_name()`
- **ES6 modules**: No build step, no bundler. Import directly in browser.
- **No frameworks**: Vanilla JS, vanilla DOM. The game ran in 1987 without React.
- **Constants match C**: `STONE`, `VWALL`, `ROOM`, etc. are identical values.
  See `js/config.js`.

## Current Parity Findings (2026-02-18)

- `npm run test:session` currently reports a concentrated gameplay/wizard
  failure set (26 gameplay-session failures in the latest intake pass).
- Initial backlog intake from that pass is tracked in parity issues:
  - #6 wizard command-flow prompt cancellation/modal consumption
  - #7 wait/search safety counted no-op timing and messaging
  - #8 pet combat sequencing/messages/RNG (dog_move/mattackm)
  - #9 special-level generation RNG drift (dig_corridor/somex/makelevel)
  - #10 object generation RNG ordering (rnd_attr/mksobj/mkobj/m_initweap)
  - #11 gameplay map/glyph drift tied to pet/interactions
- Working rule: treat each issue above as a cluster root; avoid ad-hoc
  one-session fixes unless evidence shows it is truly isolated.

## Further Reading

- **[DESIGN.md](DESIGN.md)** — Detailed architecture and module design
- **[DECISIONS.md](DECISIONS.md)** — Design decision log with rationale
- **[SESSION_FORMAT.md](archive/SESSION_FORMAT.md)** — Session JSON format specification
- **[COLLECTING_SESSIONS.md](COLLECTING_SESSIONS.md)** — How to capture C reference sessions
- **[PHASE_1_PRNG_ALIGNMENT.md](PHASE_1_PRNG_ALIGNMENT.md)** — The story of achieving bit-exact C-JS parity
- **[PHASE_2_GAMEPLAY_ALIGNMENT.md](PHASE_2_GAMEPLAY_ALIGNMENT.md)** — Gameplay session alignment goals & progress

---

> *"You ascend to the next level of understanding. The strident call of
> a test suite echoes through the Mazes of Development. All tests pass!"*
