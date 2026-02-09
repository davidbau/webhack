# Special Levels Implementation Roadmap

Epic: `interface-3br` - Complete special level system for all dungeon branches

## Current Status

### ✓ COMPLETED
- **Sokoban** (8 levels): soko1-1/2, soko2-1/2, soko3-1/2, soko4-1/2 ✓
- **des.* API Foundation**: level_init, level_flags, map, terrain, stair, region ✓
- **Object/Trap Placement**: des.object, des.trap with full integration ✓
- **Wallification & Flipping**: Complete wall junction computation and random flipping ✓
- **C Traces Collected**: Sokoban, Mines, Ludios, Tower, Valley, Main dungeon specials ✓

### ◐ IN PROGRESS
- **Branch-aware level generation** (`interface-9a0`): Integrate special levels into makelevel()

---

## Implementation Tiers

### TIER 1: Simple Fixed Maps (Ready Now)
These levels use only des.map, des.object, des.trap - already supported.

#### **Vlad's Tower** (`interface-sey`) - Priority: HIGH
- `tower1.lua` - 3 level tower with fixed maps
- `tower2.lua`
- `tower3.lua`
- **Blockers**: NONE (ready to port)
- **Complexity**: Low - pure ASCII maps, minimal features
- **C Traces**: Available

#### **Fort Ludios** (`interface-ecx`) - Priority: HIGH
- `knox.lua` - Single fixed fortress map
- **Blockers**: NONE (ready to port)
- **Complexity**: Low - fixed map with soldiers/guards (stub monsters OK)
- **C Traces**: Available

#### **Valley of the Dead** (`interface-u4r`) - Priority: HIGH
- `valley.lua` - Gehennom entrance level
- **Blockers**: NONE (ready to port)
- **Complexity**: Low - fixed map with graveyard theme
- **C Traces**: Available

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
These need more des.* API functions or procedural logic.

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
Fixed maps but need monster/region features.

#### **Demon Lairs** (`interface-t9m`) - Priority: LOW
- `juiblex.lua`, `baalzebub.lua`, `asmodeus.lua`, `orcus.lua`
- **Blockers**: NONE (can stub monsters/regions)
- **Complexity**: Medium - fixed maps with special monsters
- **C Traces**: Likely available

#### **Sanctum** (`interface-mr1`) - Priority: LOW
- `sanctum.lua` - Final temple level
- **Blockers**: des.altar, special region handling
- **Complexity**: High - end-game temple, special mechanics
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

**Current Progress**: ~10% (Sokoban complete, infrastructure ready)
**Phase 1 Target**: ~25% (add Tower, Ludios, Valley)
