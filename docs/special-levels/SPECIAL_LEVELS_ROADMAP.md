# Special Levels Implementation Roadmap

Epic: `interface-3br` - Complete special level system for all dungeon branches

## Current Status

### ✓ COMPLETED (36 levels, 45%)
- **Sokoban** (8 levels): soko1-1/2, soko2-1/2, soko3-1/2, soko4-1/2 ✓ (variant selection implemented)
- **Tier 1: Simple Fixed Maps** (5 levels): tower1-3, valley, knox ✓
- **Tier 2: Intermediate Fixed Maps** (3 levels): wizard1-3 ✓
- **Tier 3: Complex Fixed Maps** (11 levels): castle, bigroom (8 variants), medusa (2 variants) ✓
- **Tier 4: Demon Lairs** (5 levels): asmodeus, baalz, juiblex, orcus, sanctum ✓
- **Integration** (complete): All 36 levels registered and playable via (dnum, dlevel) coordinates ✓
- **des.* API Foundation**: level_init, level_flags, map, terrain, stair, region, ladder, feature ✓
- **Random Placement System**: des.object(), des.monster(), des.trap() with no-argument support ✓
- **Object/Trap Placement**: Full coord/selection/class format support with intelligent defaults ✓
- **Selection API**: line(), area(), negate(), filter() for geometric operations ✓
- **Utility Functions**: shuffle(), percent(), objectNameToType(), trapNameToType() ✓
- **Wallification & Flipping**: Complete wall junction computation and random flipping ✓
- **C Traces Collected**: Sokoban, Mines, Ludios, Tower, Valley, Main dungeon specials ✓
- **Test Infrastructure**: 35/35 tests passing across 21 level implementations ✓
  - Tower (4), Knox (2), Valley (2), Sanctum (2), Medusa (2)
  - Wizard levels (4), Demon lairs (5)
  - Castle (5), Bigroom variants (9)
- **Comprehensive Documentation**: Full JSDoc for all API functions with examples ✓

### ◐ IN PROGRESS
- None currently

---

## Implementation Tiers

### TIER 1: Simple Fixed Maps ✓ COMPLETE
These levels use only des.map, des.object, des.trap - fully implemented and tested.

#### ✓ **Vlad's Tower** (`interface-sey`) - COMPLETE
- ✓ `tower1.js` - Upper stage with 6 shuffled niches
- ✓ `tower2.js` - Middle stage with demons
- ✓ `tower3.js` - Entry level with dragon guard
- **Tests**: 4/4 passing (terrain, objects, traps, shuffle randomness)
- **Implementation**: js/levels/tower{1,2,3}.js

#### ✓ **Fort Ludios** (`interface-ecx`) - COMPLETE
- ✓ `knox.js` - Fortress with treasury and soldiers
- **Tests**: 2/2 passing (terrain structure, C trace validation)
- **Implementation**: js/levels/knox.js
- **Fixes**: Replaced Math.random() with seeded rn2() for determinism

#### ✓ **Valley of the Dead** (`interface-u4r`) - COMPLETE
- ✓ `valley.js` - Gehennom entrance with graveyard
- **Tests**: 2/2 passing (terrain structure, C trace validation)
- **Implementation**: js/levels/valley.js

### TIER 2: Intermediate Fixed Maps
These need des.door, des.altar, des.fountain (stubs acceptable for now).

#### **Oracle** (`interface-1u3`) - Priority: MEDIUM
- `oracle.lua` - Fixed temple with oracle NPC
- **Blockers**: des.door (stub exists), des.altar (needs stub)
- **Complexity**: Medium - needs altars, fountains, special room
- **C Traces**: Available

#### **Gnomish Mines** (`interface-d0r`) - Priority: MEDIUM
- `minetown.lua` (variants: town, orcish, bazaar)
- `mineend-1.lua`, `mineend-2.lua`
- **Blockers**: des.door, des.altar, des.fountain (all need stubs)
- **Complexity**: Medium - shops, temples, variant selection
- **C Traces**: Available

#### **Wizard Levels** (`interface-53v`) - Priority: MEDIUM
- `wizard1.lua`, `wizard2.lua`, `wizard3.lua` - Wizard's lair
- **Blockers**: NONE (can stub monsters)
- **Complexity**: Medium - fixed maps with monster placement
- **C Traces**: Likely available (need to verify)

### TIER 3: Procedural/Complex Levels

#### ✓ **Medusa** (`interface-060`) - COMPLETE
- ✓ `medusa.js` - Water moat surrounding central island
- **Tests**: 2/2 passing (terrain structure, monster placement)
- **Implementation**: js/levels/medusa.js
- **Features**: Extensive moat (1000+ cells), Medusa boss, Perseus statue, water monsters

#### **Castle** (`interface-6lq`) - Priority: MEDIUM
- `castle.lua` - Mix of fixed + procedural
- **Blockers**: Selection API (`interface-pnh`), des.drawbridge
- **Complexity**: High - procedural elements, drawbridges, moat
- **C Traces**: Available

#### **Medusa** (`interface-060`) - Priority: MEDIUM
- `medusa.lua` - Procedural with fixed boss
- **Blockers**: Procedural maze generation logic
- **Complexity**: High - procedural maze + fixed island
- **C Traces**: Available

#### **Rogue & Bigroom** (`interface-gjg`) - Priority: MEDIUM
- `rogue.lua` - Emulates Rogue game aesthetics
- `bigroom.lua` - Large open room variants
- **Blockers**: Rogue-specific rendering, bigroom algorithms
- **Complexity**: High - special generation algorithms
- **C Traces**: Available

### TIER 4: Gehennom Demon Lairs

#### ✓ **Sanctum** (`interface-mr1`) - COMPLETE
- ✓ `sanctum.js` - Moloch's temple (final Gehennom level)
- **Tests**: 2/2 passing (terrain structure, monster/object placement)
- **Implementation**: js/levels/sanctum.js
- **Features**: Fire trap ring (34 traps), temple region, 14+ monsters, 16 objects

#### **Demon Lairs** (`interface-t9m`) - Priority: LOW
- `juiblex.lua`, `baalzebub.lua`, `asmodeus.lua`, `orcus.lua`
- **Blockers**: des.mazewalk, complex selection operations
- **Complexity**: High - mazegrid levels with procedural maze generation
- **C Traces**: Available
- **C Traces**: Likely available

### TIER 5: Quest Levels (Large Scope)
Per-role customization (13 roles × 3 levels = 39 files).

#### **Quest Levels** (`interface-5cn`) - Priority: LOW
- Per-role: `<role>-start.lua`, `<role>-locate.lua`, `<role>-goal.lua`
- **Blockers**: NONE (can stub monsters/regions)
- **Complexity**: High - large volume, per-role testing
- **C Traces**: Need to collect (`interface-vc2`)

### TIER 6: Elemental Planes (End Game)
End-game levels with special mechanics.

#### **Elemental Planes** (`interface-858`) - Priority: LOWEST
- `astral.lua`, `water.lua`, `fire.lua`, `air.lua`, `earth.lua`
- **Blockers**: Special terrain, mechanics, end-game handling
- **Complexity**: Very High - special plane mechanics
- **C Traces**: Need to collect (`interface-kr2`) - requires endgame access

---

## des.* API Status

### Fully Implemented ✓
- `des.level_init()` - Level initialization (solidfill, maze, etc.)
- `des.level_flags()` - Level behavior flags
- `des.map()` - Place ASCII map regions with alignment
- `des.terrain()` - Set individual terrain cells
- `des.stair()` - Place stairs (up/down)
- `des.object()` - Full object placement with mksobj integration
- `des.trap()` - Full trap placement with duplicate prevention
- `des.region()` - Mark regions as lit/non-diggable
- `des.non_diggable()` - Set non-diggable flag
- `percent()` - Random percentage helper

### Stub Implementations (Non-blocking)
- `des.monster()` - Monster placement (doesn't affect terrain)
- `des.door()` - Door placement (can be ignored for now)
- `des.engraving()` - Engraving placement (cosmetic)
- `des.non_passwall()` - Passwall prevention (non-critical)
- `des.levregion()` - Branch entry points (non-critical for now)
- `des.exclusion()` - Monster generation zones (non-critical)

### Needs Implementation
- `des.altar()` - Altar placement (needed for Oracle, Mines, Sanctum)
- `des.fountain()` - Fountain placement (needed for Oracle, Mines)
- `des.room()` - Room generation (needed for Castle, Rogue)
- `des.ladder()` - Ladder placement (rare, lower priority)
- `des.drawbridge()` - Drawbridge (Castle only)
- `selection.*` API - Full selection operations (needed for Castle, Medusa)
  - Currently have: `selection.area()`, `selection.new()`, `selection.rndcoord()`
  - Need: `selection.rect()`, `selection.line()`, `selection.grow()`, `selection.floodfill()`, etc.

---

## Recommended Work Order

### Phase 1: Quick Wins (1-2 days)
Port Tier 1 levels (Tower, Ludios, Valley) - all ready now, minimal dependencies.

**Benefits:**
- 5 new special levels working
- Validates level loading integration
- Builds confidence in approach

### Phase 2: API Extensions (1-2 days)
Add stub/simple implementations for:
- `des.altar()` - Simple: place ALTAR terrain, add to altars list
- `des.fountain()` - Simple: place FOUNTAIN terrain, add to fountains list
- `des.ladder()` - Simple: place LADDER terrain

**Benefits:**
- Unblocks Oracle, Mines, many other levels
- Small API surface, easy to implement

### Phase 3: Intermediate Levels (2-3 days)
Port Tier 2 levels (Oracle, Mines, Wizard) using extended API.

**Benefits:**
- Major gameplay areas (Mines, Oracle) working
- Tests variant selection logic (Minetown)
- 8+ new levels

### Phase 4: Complex Levels (3-5 days)
Implement Selection API and port Castle, Medusa, Rogue, Bigroom.

**Benefits:**
- Main dungeon special levels complete
- Most complex procedural logic working

### Phase 5: Gehennom & Quest (5-10 days)
Port demon lairs, sanctum, and quest levels (large volume).

**Benefits:**
- Mid-game and end-game content
- Quest system working

### Phase 6: Elemental Planes (2-3 days)
Port end-game planes (after C trace collection).

**Benefits:**
- Complete game playable to ascension

---

## Issue Dependencies

### Currently Ready (No blockers)
- `interface-sey` - Vlad's Tower ← START HERE
- `interface-ecx` - Fort Ludios ← START HERE
- `interface-u4r` - Valley ← START HERE
- `interface-53v` - Wizard levels
- `interface-t9m` - Demon lairs (can stub monsters)
- `interface-mr1` - Sanctum (needs altar API)

### Blocked by Selection API (`interface-pnh`)
- `interface-6lq` - Castle
- Some complex logic in Medusa, Rogue

### Blocked by API Extensions
- `interface-1u3` - Oracle (needs des.altar, des.fountain stubs)
- `interface-d0r` - Mines (needs des.altar, des.fountain, des.door stubs)

### Blocked by Trace Collection
- `interface-kr2` - Elemental Planes traces
- `interface-vc2` - Quest traces (for testing)

---

## Success Metrics

- **Phase 1 Complete**: 5 simple levels working (Tower 1-3, Ludios, Valley)
- **Phase 2 Complete**: API extended, 8 total branches have at least 1 working level
- **Phase 3 Complete**: All main dungeon branches functional (Mines, Oracle working)
- **Phase 4 Complete**: All main dungeon special levels working
- **Phase 5 Complete**: Gehennom and Quest playable
- **Phase 6 Complete**: Full game playable to ascension

**Current Progress**: ~45% ✓ Phase 1 Complete + Phase 2 In Progress!
- Sokoban: 8 levels ✓ (variant selection system implemented)
- Tier 1 Simple Fixed Maps: 5 levels ✓ (tower 1-3, knox, valley)
- Tier 2 Intermediate Fixed Maps: 3 levels ✓ (wizard 1-3)
- Tier 3 Complex Fixed Maps: 11 levels ✓ (castle, bigroom 1-8, medusa 1-2)
- Tier 4 Demon Lairs: 5 levels ✓ (asmodeus, baalz, juiblex, orcus, sanctum)
- Total: 36 of ~80 special levels implemented and tested (45%)
- **All 35/35 special level tests passing**
  - Original: Tower (4) + Knox (2) + Valley (2) + Sanctum (2) + Medusa (2) = 12
  - Added: Wizard (4) + Demon lairs (5) + Castle (5) + Bigroom (9) = 23
- **Integration complete**: All levels playable via (dnum, dlevel) coordinates

**Next Target**: ~35% (Complete Phase 2)
- Target levels: Oracle, Mines variants (minetown, mineend), Castle
- Requires: des.altar(), des.fountain(), des.door() stubs for Oracle/Mines
- Requires: des.room(), des.random_corridors() for Castle
