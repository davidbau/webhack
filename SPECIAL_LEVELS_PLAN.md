# Special Levels Implementation Plan

> *"You feel the mass of scripted levels pressing on your mind."*

## Overview

NetHack 3.7 uses Lua scripts to define ~40 special level layouts across 8 dungeon
branches. Currently the JS port only generates procedural (random room/corridor)
levels via `makelevel()`. This plan covers:

1. **Collecting C traces** for every special level to use as ground truth
2. **Implementing the `des.*` API** (sp_lev.c equivalent) in JavaScript
3. **Porting Lua level definitions** to JS (per Decision 11)
4. **Branch-aware level generation** so the game knows when to use special vs procedural
5. **Testing** each special level against C traces for map fidelity

## Dungeon Structure

NetHack has 8 dungeon branches (+ Tutorial). Each has a set of named special levels:

| Branch | # | Special Levels |
|--------|---|----------------|
| Dungeons of Doom | 0 | rogue, oracle, bigroom, medusa, castle |
| Gehennom | 1 | valley, sanctum, juiblex, baalzebub, asmodeus, wizard1-3, orcus, fakewiz1-2 |
| Gnomish Mines | 2 | minetown (variants), mines end (variants) |
| The Quest | 3 | quest-start, quest-locate, quest-goal (per-role) |
| Sokoban | 4 | soko1-4 (each has 2 variants, random pick) |
| Fort Ludios | 5 | knox |
| Vlad's Tower | 6 | tower1, tower2, tower3 |
| Elemental Planes | 7 | astral, water, fire, air, earth |

Total: ~40 unique named levels, plus per-role quest variants (13 roles × 3 levels = 39).

## Phase 1: C Trace Collection

### 1a. Build C binary (if not already built)
Run `test/comparison/c-harness/setup.sh` to clone NetHack 3.7 C source and build.

### 1b. Extend gen_map_sessions.py for special levels
The current script uses wizard-mode `Ctrl+V` level teleport which only goes to depths
in the main dungeon. For special levels in branches, we need to:
- Teleport to the branch entry depth first
- Then use branch-specific teleport or `#goto` to reach the branch
- Capture the typGrid for each special level

Alternatively, create a new script `gen_special_sessions.py` that:
- For each seed, starts the game
- Uses wizard-mode commands to reach each special level
- Captures typGrid via `#dumpmap`
- Records the level identity (branch + level number + level name)

### 1c. Session format extension
Current session format has `levels[].depth` (integer). For special levels, extend to:
```json
{
  "depth": 6,
  "branch": "mines",
  "branchLevel": 3,
  "levelName": "minetown",
  "typGrid": [[...], ...]
}
```

### 1d. Seeds and coverage
- Use existing seeds (42, 1, 100, etc.) for variety
- Need multiple seeds per special level since some have random variants (Sokoban,
  Mines End, Minetown)
- Capture at least 3 seeds per special level for test coverage

## Phase 2: des.* API Foundation

The `des.*` API is the set of functions that Lua level scripts call to build levels.
These map to `sp_lev.c` functions in C. Create `js/sp_lev.js`:

### Core functions (priority order):
1. `des.level_init()` — Initialize level (mazewalk, solidfill, etc.)
2. `des.level_flags()` — Set level properties (noteleport, hardfloor, etc.)
3. `des.map()` — Place a fixed ASCII map region
4. `des.terrain()` — Set terrain at position(s)
5. `des.region()` — Define rectangular regions with properties
6. `des.room()` — Create rooms with contents callbacks
7. `des.door()` — Place doors
8. `des.stair()` — Place stairs (up/down, branch connections)
9. `des.ladder()` — Place ladders
10. `des.monster()` — Place monsters
11. `des.object()` — Place objects
12. `des.trap()` — Place traps
13. `des.altar()` — Place altars
14. `des.fountain()` — Place fountains
15. `des.gold()` — Place gold
16. `des.engraving()` — Place engravings
17. `des.grave()` — Place graves
18. `des.random_corridors()` — Connect regions with corridors
19. `des.wallify()` — Fix wall types
20. `des.mazewalk()` — Generate maze from a starting point
21. `des.non_diggable()` / `des.non_passwall()` — Mark regions

### Selection API:
- `selection.new()` — Create empty selection
- `selection.area(x1,y1,x2,y2)` — Rectangular selection
- `selection.rect(x1,y1,x2,y2)` — Perimeter of rectangle
- `selection.line(x1,y1,x2,y2)` — Line between points
- `selection.rndcoord(sel)` — Random coordinate from selection
- `selection.negate(sel)` — Complement
- `selection.percentage(sel, pct)` — Random subset
- `selection.grow(sel)` — Expand by one cell
- `selection.floodfill(x,y)` — Flood fill from point
- `selection.match(str)` — Match terrain pattern
- `selection.filter_mapchar(sel, ch)` — Filter by map character
- Set operations: `|` (union), `&` (intersection), `~` (complement)

### Helper functions:
- `percent(n)` — `rn2(100) < n`
- `d(n, sides)` — Roll n dice of given sides
- `nh.mon_generation_info()` — Monster class generation data
- `montype_from_name(name)` — Lookup monster by name

## Phase 3: Level File Porting (by branch)

Port each Lua level definition to JavaScript. Start with the simplest, build up:

### Tier 1 — Simple fixed maps (start here):
- **Sokoban** (soko1a/b, soko2a/b, soko3a/b, soko4a/b) — Pure ASCII maps, minimal logic
- **Vlad's Tower** (tower1, tower2, tower3) — Small fixed maps
- **Fort Ludios** (knox) — One fixed map

### Tier 2 — Medium complexity:
- **Oracle** — Fixed room layout with oracle NPC
- **Mines** (minetown variants: town, orcish, bazaar; mines end variants)
- **Valley of the Dead** — Fixed layout
- **Wizard levels** (wizard1, wizard2, wizard3)

### Tier 3 — Procedural special levels:
- **Castle** — Mix of fixed map + procedural elements
- **Medusa** — Procedural with fixed boss
- **Rogue level** — Emulates Rogue game aesthetics
- **Bigroom** — Large open room variants

### Tier 4 — Complex / Per-role:
- **Quest levels** (13 roles × 3 levels) — Role-specific maps and monsters
- **Gehennom demon levels** (juiblex, baalzebub, asmodeus, orcus)
- **Elemental Planes** (astral, water, fire, air, earth)
- **Sanctum** — Final temple

## Phase 4: Branch-Aware Level Generation

Modify the game to use special levels at appropriate depths:

### 4a. Level identity system
- `makelevel()` takes `(dnum, dlevel)` instead of just `depth`
- Lookup table: which `(dnum, dlevel)` maps to which special level file
- Fall through to procedural generation for non-special levels

### 4b. Branch connections
- Stairs/ladders that connect branches
- Branch entry points placed during main dungeon generation
- Level teleport recognizes branch structure

## Phase 5: Testing Strategy

### Per-level comparison tests
For each special level with a C trace:
1. Initialize RNG with same seed
2. Call the level generation function
3. Extract typGrid
4. Compare cell-by-cell against C trace
5. Report mismatches with terrain type names

### Structural validation
- All special levels have correct dimensions (COLNO×ROWNO)
- Stairs connect properly between levels
- Required features present (altars, fountains, monsters, etc.)

## Implementation Order

The recommended order prioritizes getting testable results quickly:

1. Build C binary and create trace collection script
2. Collect C traces for Sokoban (simplest special levels)
3. Implement minimal des.* API (des.map, des.terrain, des.level_init)
4. Port Sokoban levels and verify against traces
5. Collect C traces for remaining branches
6. Expand des.* API as needed for each level tier
7. Port levels tier by tier, testing against traces after each

## Lessons Learned

### Trace Collection via Wizard Mode

**Cross-branch teleport requires menu navigation, not name-based teleport:**
- C's `lev_by_name()` has `dlev_in_current_branch()` check that prevents teleporting by name to levels in other branches
- The `?` menu approach (Ctrl+V → ? → select letter) works for all branches
- Menu-based approach uses `print_dungeon(TRUE, ...)` with `force_dest = TRUE`, bypassing branch restrictions
- Implemented in `gen_special_sessions.py` as `wizard_teleport_to_level()` with pattern matching: `^([a-zA-Z])\s+-\s+[*]?\s*levelname:`

**Elemental Planes cannot be reached via wizard teleport:**
- `In_endgame(&u.uz)` check in `level_tele()` blocks all wizard teleport once in endgame
- Alternative approaches needed: C binary modification, save file manipulation, or scripted gameplay to reach endgame
- Deferred to later (tracked in bd issue interface-kr2)

**Sokoban has 2 variants per level, selected by RNG:**
- `dungeon.lua` specifies `nlevels=2` for each Sokoban level (soko1 through soko4)
- C randomly picks between variant 1 (`soko1-1.lua`) and variant 2 (`soko1-2.lua`)
- Each variant can be horizontally/vertically flipped at generation time
- Collected 5 seeds × 4 levels = 20 traces to ensure coverage of all variants and flips

### Wall Type Computation (wall_extends Algorithm)

**NetHack's wall junction algorithm is directional:**
- Horizontal walls (`─` HWALL) extend only east/west, not north/south
- Vertical walls (`│` VWALL) extend only north/south, not east/west
- Corners and junctions extend in their specific directions (e.g., `┌` extends south and east only)
- The algorithm must be iterative: changing a wall to a junction changes what extends from that cell
- Some configurations can oscillate without convergence limits (e.g., narrow `|.|` corridors in soko4-2)

**Directional extension rules:**
- extends_north: VWALL, BLCORNER, BRCORNER, TUWALL, CROSSWALL, TRWALL, TLWALL
- extends_south: VWALL, TLCORNER, TRCORNER, TDWALL, CROSSWALL, TRWALL, TLWALL
- extends_east: HWALL, TLCORNER, BLCORNER, TUWALL, TDWALL, CROSSWALL, TRWALL
- extends_west: HWALL, TRCORNER, BRCORNER, TUWALL, TDWALL, CROSSWALL, TLWALL

**Spoiler guide DECgraphics inaccuracies:**
- Analyzed all 8 Sokoban maps: found 67 total mismatches across variants
- 51 junction errors: spoiler uses plain `│`/`─` where C generates T-junctions (`├`, `┤`, `┬`, `┴`)
- 4 corner-vs-junction errors: spoiler has T-junction where C generates corner
- 12 staircase discrepancies: extra upstairs or shifted positions
- Root cause: spoiler maps drawn visually without applying wall_extends() algorithm
- Created bd issue interface-llb to fix after debugging convergence issues in wall computation script

### des.* API Implementation

**GameMap coordinate system:**
- C uses `level.locations[x][y]` (column-major indexing)
- JS GameMap also uses `locations[x][y]`, NOT `grid[y][x]` (row-major)
- Always index as `map.locations[x][y]` where x=0..79, y=0..20

**Core des.* functions implemented (js/sp_lev.js):**
- `des.level_init(opts)`: Initializes level with fill style (solidfill, mazegrid, maze, rogue, mines, swamp)
- `des.level_flags(...flags)`: Sets level behavior flags (noteleport, hardfloor, mazelevel, premapped, solidify, etc.)
- `des.map(data)`: Places ASCII map with alignment (halign: left/center/right, valign: top/center/bottom) or explicit x,y coords
- `des.terrain(x, y, type)`: Sets individual terrain at coordinate

**Map character to terrain type mapping:**
- Space → STONE, `-` → HWALL, `|` → VWALL, `.` → ROOM, `#` → CORR
- `+` → DOOR, `<` → STAIRS_UP, `>` → STAIRS_DOWN
- `{` → FOUNTAIN, `}` → MOAT, `P` → POOL, `L` → LAVAPOOL
- `I` → ICE, `W` → WATER, `T` → TREE, `F` → IRONBARS
- `C` → CLOUD, `A` → AIR, `\\` → THRONE, `K` → SINK

**Level state management:**
- Global `levelState` tracks: map, flags, coder options, init parameters, placement offsets
- `resetLevelState()` clears state between level generations
- `getLevelState()` provides access for testing/debugging

**Test coverage:**
- 6 unit tests in test/unit/sp_lev.test.js
- Verified: solidfill init, flag setting, map placement, terrain setting, alignment, explicit coords

### First Level Port: Sokoban soko4-1

**Successfully ported soko4-1.lua to JavaScript:**
- js/levels/soko4-1.js: Direct 1:1 port from Lua
- All des.* function calls work correctly
- Map generates with correct structure, lighting, and flags
- Test validates against C trace data

**Additional des.* functions implemented:**
- `des.stair(direction, x, y)`: Places STAIRS_UP or STAIRS_DOWN terrain
- `des.region(selection, "lit")`: Marks cells as lit=1
- `des.non_diggable(selection)`: Sets nondiggable=true flag
- `selection.area(x1, y1, x2, y2)`: Creates rectangular selection object

**Stub implementations (need full support later):**
- `des.object()`: Object placement (needs object system integration)
- `des.trap()`: Trap placement (needs trap system integration)
- `des.levregion()`: Branch entry points
- `des.exclusion()`: Monster generation exclusion zones
- `des.non_passwall()`: Passwall prevention

**Map flipping implemented:**
- C NetHack randomly flips entire level after all maps placed
- `flip_level_rnd()` called at end of sp_level_loader (not per-map)
- Uses `rn2(2)` to decide each flip: vertical (bit 0), horizontal (bit 1)
- Controlled by `allow_flips` coder flag: 3=both, 2=horiz only, 1=vert only, 0=none
- JS implementation in `flipLevelRandom()`:
  - Finds bounds of non-STONE terrain
  - Applies FlipX(val) = (maxx - val) + minx for horizontal
  - Applies FlipY(val) = (maxy - val) + miny for vertical
  - Swaps cells in-place within flip area
- Called via `finalize_level()` at end of level generation
- Tested with seed1 soko4 (vertical flip case) - works correctly

**Next steps identified:**
1. ~~Implement wall_extends() for proper junction types~~ ✓ DONE
2. ~~Implement map flipping (horizontal/vertical)~~ ✓ DONE
3. ~~Add object placement system~~ ✓ DONE
4. ~~Add trap placement system~~ ✓ DONE
5. ~~Port all 8 Sokoban levels (soko1-1/2, soko2-1/2, soko3-1/2, soko4-1/2)~~ ✓ DONE
6. Integrate special level loading into makelevel() flow

### Wall Junction Computation (wall_extends)

**Implemented complete wallification system:**
- `wallification(map)`: Main algorithm applying iterative wall junction computation
- `isWall(typ)`: Checks if terrain is any wall type (VWALL through TRWALL)
- Directional extension functions: `extendsNorth/South/East/West(typ)`
  - Based on box-drawing character geometry
  - ┌ (TLCORNER) extends south + east
  - ┐ (TRCORNER) extends south + west
  - └ (BLCORNER) extends north + east
  - ┘ (BRCORNER) extends north + west
  - ├ (TRWALL) extends north + south + east
  - ┤ (TLWALL) extends north + south + west
  - ┬ (TDWALL) extends south + east + west
  - ┴ (TUWALL) extends north + east + west
  - ┼ (CROSSWALL) extends all four directions
  - │ (VWALL) extends north + south
  - ─ (HWALL) extends east + west

**Algorithm:**
1. For each wall cell, check 4 cardinal neighbors
2. Determine connectivity: does neighbor extend toward this cell?
3. Assign junction type based on N/S/E/W connectivity pattern
4. Iterate until no changes (convergence)
5. Max 100 iterations to prevent infinite loops

**Integration:**
- Called in `finalize_level()` before flipping
- Respects original wall placement from ASCII maps
- Isolated walls keep their original type

**Test coverage:**
- 4 tests in wallification.test.js
- Validates corners, T-junctions, convergence, isolated walls
- All 20 sp_lev tests passing

### Object and Trap Placement

**Implemented full object and trap placement systems:**
- `des.object(name, x, y)`: Places objects at specific coordinates
- `des.trap(type, x, y)`: Places traps at specific coordinates
- Both functions integrate with existing GameMap.objects and GameMap.traps arrays

**Object placement implementation:**
- `objectNameToType(name)`: Converts object names to otyp constants
  - Supports named objects: "boulder" → BOULDER, "scroll of earth" → SCR_EARTH
  - Supports class symbols: '%' → FOOD_CLASS, '?' → SCROLL_CLASS, etc.
- Uses `mksobj(otyp, init, artif)` to create object instances
- Sets ox, oy coordinates and pushes to map.objects array
- Objects have properties: {otyp, ox, oy, quan, spe, blessed, etc.}

**Trap placement implementation:**
- `trapNameToType(name)`: Converts trap names to ttyp constants
  - Maps "pit" → PIT, "arrow" → ARROW_TRAP, "fire" → FIRE_TRAP, etc.
  - Supports both "trap door" and "trapdoor" naming variants
- Creates trap structures with full properties:
  - {ttyp, tx, ty, tseen, launch, launch2, dst, tnote, once, madeby_u, conjoined}
- Prevents duplicate traps at same location (checks via map.trapAt())
- Uses GameMap.traps array for storage
- Note: FALLING_ROCK_TRAP (type 3) not exported from config.js, commented out in trapNameToType()

**Integration with level generation:**
- Called during level definition phase (after des.map, before finalize_level)
- Objects and traps placed at exact coordinates specified in Lua
- Supports Sokoban-style placement: multiple boulders + scrolls of earth + pit traps

**Test coverage:**
- 5 tests in object_trap_placement.test.js
- Validates: named object placement, scroll of earth, trap placement, no duplicates, Sokoban scenario
- All tests passing

### Sokoban Level Ports (Complete ✓)

**All 8 Sokoban levels ported to JavaScript:**
- `js/levels/soko1-1.js`: Level 1 variant A (18 boulders, 16 holes, 4 doors, 2 mimics, reward region)
- `js/levels/soko1-2.js`: Level 1 variant B (20 boulders, 18 holes, 4 doors, 2 mimics, reward region)
- `js/levels/soko2-1.js`: Level 2 variant A (13 boulders, 10 holes, 1 door)
- `js/levels/soko2-2.js`: Level 2 variant B (16 boulders, 11 holes, 1 door)
- `js/levels/soko3-1.js`: Level 3 variant A (18 boulders, 15 holes, 1 door)
- `js/levels/soko3-2.js`: Level 3 variant B (15 boulders, 12 holes, 1 door)
- `js/levels/soko4-1.js`: Level 4 variant A (11 boulders, 2 scrolls of earth, 10 pits, upstairs)
- `js/levels/soko4-2.js`: Level 4 variant B (12 boulders, 2 scrolls of earth, 10 pits, upstairs)

**Porting approach:**
- Direct 1:1 translation from Lua to JavaScript
- All des.* calls preserved exactly as in original
- Stub implementations for features not affecting terrain (monsters, doors, engravings, regions)
- All levels call finalize_level() for wallification and flipping

**Additional des.* functions added (stubs):**
- `des.monster(opts)`: Monster placement (stub - ignored for now)
- `des.door(state, x, y)`: Door placement (stub - ignored for now)
- `des.engraving(opts)`: Engraving placement (stub - ignored for now)

**Helper functions:**
- `percent(n)`: Returns true n% of the time via rn2(100) < n
- `selection.new()`: Creates selection object with coords array and set() method
- `selection.rndcoord(sel)`: Returns random coordinate from selection

**Level complexity:**
- Simple levels (soko2/3/4-2): Just boulders, traps, basic features
- Complex levels (soko1-1/2): Include monsters, doors, reward regions, random object selection

**Known issues:**
- Wallification convergence warnings on some levels (narrow corridors cause oscillation)
- Doesn't affect terrain generation, just junction type refinement

**Testing:**
- Verified soko2-1 generates successfully (13 objects, 10 traps, 80x21 map)
- All levels use existing object/trap placement systems
- Ready for integration into level loader

---

## Reference

- C source: `nethack-c/dat/*.lua` (special level Lua files)
- C API: `nethack-c/src/sp_lev.c` (des.* implementation)
- JS dungeon: `js/dungeon.js` (current level generation)
- JS display: `js/display.js` (rendering)
- Test infra: `test/comparison/` (session comparison framework)
- Decision 11: `docs/DECISIONS.md` (Lua porting rationale)
