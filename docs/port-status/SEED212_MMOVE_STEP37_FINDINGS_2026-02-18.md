# Seed212 m_move Step-37 Findings (2026-02-18)

This note records the current blocker for
`seed212_valkyrie_wizard.session.json` after the wall-mode and color
checkpoints.

## Current First Divergence

This note began as a step-37 `m_move` denominator mismatch investigation.
After the landed fixes below, that blocker is cleared. Current state:

- first screen divergence now appears later at gameplay `step 243`
  (`Never mind.` vs `You don't find anything here to loot.`)
- first RNG divergence now appears at gameplay `step 260`, RNG index `1157`:
  - JS: `rn2(3)=1 @ fill_ordinary_room(...)`
  - C: `rn2(5)=1 @ pick_room(mkroom.c:238)`

Compared with the pre-fix state (first RNG divergence at step 37),
this is a substantial forward shift in matched replay prefix.

## Verified C Semantics (source check)

Checked against local C source (`/tmp/nethack-verify-009/src/mon.c` and
`/tmp/nethack-verify-009/include/rm.h`):

- `IS_OBSTRUCTED(typ)` is `typ < POOL`.
- `IS_DOOR(typ)` is `typ == DOOR` (secret doors are not `IS_DOOR`).
- `mfndpos()` skips obstructed terrain unless passwall/dig permissions apply.
- `m_move()` uses `rn2(4 * (cnt - j))` for mtrack backtrack checks.

This confirms the `rn2(32)` denominator reflects a real C `mfndpos` count
of `8`, not a logging artifact.

## JS Trace At The Divergence

Instrumented JS `m_move` at replay step 37 shows:

- `jackal @ (47,5)` with `cnt=3` then `rn2(12)` (matches C sequence shape)
- `goblin @ (32,14)` with `cnt=5` then `rn2(20)` (divergent denominator)

The goblin candidate list in JS is five room tiles; the three excluded
adjacent tiles are blocked wall/secret-door terrain.

## Interpretation

The blocker is still an upstream hidden-state mismatch before this call
(monster position/type and/or local terrain evolution), not just the
`rn2(4*cnt)` formula itself.

## New Root-Cause Narrowing

Using C wizard `#dumpsnap` checkpoints captured at replayed gameplay steps:

- Step 9: C and JS monster positions match.
- Step 10: first hidden-state drift appears:
  - C goblin: `(32,13)`
  - JS goblin: `(32,14)`
  - jackal and pet positions still match.

This means the step-37 RNG mismatch is downstream of an earlier deterministic
movement-choice difference introduced at step 10 (no RNG divergence yet).

Added helper script to capture these C checkpoints directly from session
replays:

- `test/comparison/c-harness/capture_step_snapshot.py`

## Latest Refinement (same day)

Implemented a minimal `m_search_items` targeting subset in JS `m_move`
for collector monsters (C-style loot-interest retargeting, no extra RNG).

Observed effect:

- C/JS monster positions now align at the previously problematic checkpoints:
  - step 36: `jackal (47,5)`, `goblin (32,13)`, `dog (75,17)`
  - step 37: `jackal (47,4)`, `goblin (33,13)`, `dog (77,16)`
- first RNG divergence moved from step 37 denominator mismatch
  (`rn2(20)` vs `rn2(32)`) to a later step-38 mismatch involving an
  extra C `distfleeck` call during runmode-delay output handling.

This confirms the step-10 goblin drift was one real upstream contributor.

## Follow-on Replay Control Refinement (same day)

Two replay/input semantics fixes were added after the movement-target patch:

- `replay_core`: keep `cmdKey` aligned to the actual executed command key
  each step (matching moveloop repeat bookkeeping).
- `commands`: refine `Enter` (`\\n`/`\\r`) keypad-down handling so pet-
  displacement flows can continue in run-style movement, while defaulting
  to single-step movement outside that context.

Observed effect on `seed212_valkyrie_wizard`:

- RNG matched calls improved from `2305/11044` to `2475/10886`
- first RNG divergence moved from step 38 to step 90
- first screen divergence moved from step 38 to step 80

## Inventory Action-Menu Refinement (same day)

The step-80 screen drift was traced to inventory action-menu content for
oil lamps:

- missing `a - Light this light source`
- missing `R - Rub this oil lamp`
- stale right-side row tails due action rows not being cleared before redraw

Fixes landed in `js/commands.js`:

- add light-source and rub actions for lamp menu variants
- clear each action row before writing menu lines

Observed effect on `seed212_valkyrie_wizard`:

- screen matched frames improved `148/407` -> `150/407`
- first screen divergence moved from step 80 to step 121
- first RNG divergence remains step 90 (`rn2(24)` vs C `distfleeck rn2(5)`)

## Additional Fix Landed During This Pass

- Corrected a typo in `dog_move` candidate filtering:
  - `allowMdisp` -> `allowMDisp`
  - File: `js/monmove.js`

This is a correctness fix for displacement-aware occupancy checks in pet
path evaluation.

## New Correction (late pass, same day)

Implemented C-faithful `monflee()` side effects in JS combat paths:

- `js/combat.js`: surviving-hit morale flee now sets flee state/timer and
  clears `mtrack` history (C `mon_track_clear` behavior).
- `js/commands.js`: pet-blocking flee trigger now also clears `mtrack`.

Validation snapshot:

- `seed212_valkyrie_wizard` remains at current baseline:
  - RNG: `2475/10886`
  - screens: `150/407`
  - first RNG divergence: step `90` (`rn2(24)` vs C `distfleeck rn2(5)`)
- `seed42_gameplay` still fully passing.
- `seed5_gnomish_mines_gameplay` unchanged current profile.

So this was a correctness-hardening change for hidden flee state, but it does
not by itself resolve the current step-90 blocker.

## Additional Correction (sp_lev fleeing state)

Implemented a targeted special-level monster-state fix:

- `js/sp_lev.js`: `des.monster({ fleeing: N })` now initializes runtime
  `flee`/`fleetim` fields (and keeps `mflee`/`mfleetim` aliases in sync).

Added regression coverage:

- `test/unit/sp_lev.test.js`: new unit test verifying that a monster created
  via `des.monster` with `fleeing` set has `flee === true` and expected
  `fleetim`.

Validation snapshot after this change:

- Unit tests: `sp_lev`, `monmove`, `combat`, `safe_pet` passing.
- `seed42_gameplay`: still full pass (`3017/3017`, `12/12`).
- `seed212_valkyrie_wizard`: unchanged current baseline
  (`2475/10886`, `150/407`, first RNG divergence step `90`).

## Additional Narrowing (turn-8 goblin backtrack roll)

Using temporary JS-only `m_move` tracing on the current baseline run:

- The step-90/91 RNG divergence maps to goblin movement at **turn 8**.
- Goblin pre-move state in JS:
  - position `(33,12)`
  - `mtrack`: `(33,13) (32,13) (31,14) (0,0)`
  - `cnt=6` candidate positions:
    `(32,12) (32,13) (33,11) (33,13) (34,12) (34,13)`
- JS consumes two backtrack checks in that move:
  - `rn2(20)=9` on `(32,13)` vs `mtrack[1]`
  - `rn2(24)=23` on `(33,13)` vs `mtrack[0]`  ← divergence point

C midlog at the same point reports:

- `<mfndpos=5 ...>`
- one backtrack roll `rn2(20)=9`
- then immediately `distfleeck rn2(5)=3` (where JS still has the extra `rn2(24)`).

Interpretation:

- There is still a pre-turn hidden-state mismatch feeding this call:
  candidate-space size and/or goblin `mtrack` contents are not yet aligned
  at turn 8, even though later visible screens are still matching.

## Faithful `m_search_items` / `mpickstuff` Port (2026-02-19)

To avoid heuristic-only behavior and follow C movement intent more closely,
JS monster item logic was updated in `js/monmove.js`:

- replaced broad "any carryable object" retargeting with C-style item-affinity
  gates (load-threshold + likes-gold/gems/objects/magic class filters)
- added C in-shop `m_search_items` short-circuit behavior (`rn2(25)` path)
- added `MMOVE_DONE`-style early stop when an item target is under the monster
- implemented `mpickstuff`-style pickup handling (including partial-stack carry)
- applied C-like `MMOVE_MOVED -> MMOVE_DONE` suppression semantics for the same
  turn's follow-on attack handling after pickup

Observed effect on `seed212_valkyrie_wizard`:

- previously divergent goblin hidden-state checkpoints now align:
  - gameplay step 39: goblin `(34,14)` (C and JS)
  - gameplay step 91: goblin `(35,14)` (C and JS)
- first RNG divergence moved from step 90 to step 260
- first screen divergence moved from step 121 to step 181

Related issue sessions after this pass:

- `seed103_caveman_selfplay200`: pass
- `seed112_valkyrie_selfplay200`: pass
- `seed42_items_gameplay`: pass
- `seed5_gnomish_mines_gameplay`: still fails (first screen divergence step 46)

## 2026-02-19 follow-up: C-faithful eatfood turn completion fixed seed42-items

Additional parity fix (outside `monmove` itself, but directly affecting this
issue's tracked session set):

- in `js/commands.js`, inventory-food occupation completion now follows C
  `eatfood()` semantics (`done when ++usedtime > reqtime`, not `>= reqtime`).
- This restores the final timed-turn cycle during eating, including the
  expected trailing `distfleeck`/monster turn block in replay traces.

Validation:

- `seed42_items_gameplay.session.json`: full pass (`3186/3186` RNG,
  `23/23` screens, `552/552` colors).
- `seed103_caveman_selfplay200.session.json`: pass.
- `seed112_valkyrie_selfplay200.session.json`: pass.
- `seed212_valkyrie_wizard.session.json`: improved current profile
  (first RNG divergence step 260; first screen divergence step 243).
- `seed5_gnomish_mines_gameplay.session.json`: unchanged first divergence
  profile (screen step 46, RNG anchor step 205).

## 2026-02-19 follow-up: replay prompt/menu parity pass

Additional C-faithful replay/prompt fixes landed in `commands`/headless input:

- `js/headless_runtime.js`: headless input now exposes the active display to
  `nhgetch()`, so keypresses clear topline concatenation state (same as tty).
- `js/commands.js` `handleFire()`:
  - removed non-weapon wielded item from fire prompt candidates
  - added C-style wielded-item confirmation prompt:
    `You are wielding that.  Ready it instead? [ynq] (q)`
- `js/commands.js` inventory submenu:
  - added worn-armor action set with `T - Take off this armor`
  - narrowed submenu row clearing and redraw order to preserve underlying map
    rows while replacing inventory list rows.

Observed effect on `seed212_valkyrie_wizard`:

- screens matched: `248/407` -> `257/407`
- colors matched: `7475/9768` -> `7494/9768`
- first screen divergence: step `181` -> step `243`
- first RNG divergence: unchanged at step `260`

Regression anchors after this pass:

- `seed42_items_gameplay.session.json`: pass (`3186/3186`, `23/23`, `552/552`)
- `seed103_caveman_selfplay200.session.json`: pass
- `seed112_valkyrie_selfplay200.session.json`: pass
- `seed5_gnomish_mines_gameplay.session.json`: unchanged first-divergence
  profile (`screen step 46`, `RNG step 205`)
