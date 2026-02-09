# Test Status Summary

**Last Updated**: 2026-02-09
**Test Results**: 1052 pass / 112 fail (90.4% pass rate)
**Recent Change**: +32 tests from trap avoidance implementation

## Passing Tests (1052)

### Gameplay Sessions ✓
- seed42: ALL 12 steps pass
- seed2_wizard_fountains: ALL 37 steps pass (wizard mode, fountains, trap avoidance)

### Character Generation ✓
All 13 roles × multiple variants pass:
- Archeologist, Barbarian, Caveman, Healer, Knight, Monk, Priest
- Ranger, Rogue, Samurai, Tourist, Valkyrie, Wizard
- Race variants (dwarf, elf, gnome, orc)
- Alignment variants (lawful, neutral, chaotic)

**Total**: ~1000 chargen tests passing

## Failing Tests (112)

### 1. Special Levels (36 tests)
**Status**: Not Implemented
**Sessions**: All seed*_special_* files
**Types**: bigroom, castle, gehennom, knox, medusa, mines, oracle, rogue, sokoban, valley, vlad, wizard

**Failure**: `unknown session type` - test harness doesn't recognize special level sessions

**Requires**:
- des.* API implementation (des.room, des.door, des.stair, des.monster, des.object, des.trap, etc.)
- Selection API for geometric map operations
- Port of special level Lua scripts to JavaScript

**Tracked**: Beads issues interface-0yz through interface-53v (P2 tasks)

### 2. Map Sessions - Depth 2+ (50 tests)
**Status**: Complex RNG Misalignment
**Sessions**: seed16, seed72, seed119, seed163, seed306 (5 seeds × ~10 tests each)

**Pattern**:
```
Depth 1: ✓✓ typGrid matches, RNG matches (perfect)
Depth 2: ✓✗ typGrid matches, RNG diverges (late: calls 900-2300)
Depth 3: ✗✗ typGrid wrong, RNG diverges (early: call 0-1)
Depth 4: ✗✗ typGrid wrong, RNG diverges (call 0, getbones)
Depth 5: ✗✗ typGrid wrong, RNG diverges (call 0, getbones)
```

**Examples**:
- seed16 depth 2: JS=2436 calls, C=2476 calls (-40 difference)
- seed119 depth 2: Diverges at call 2345
- seed163 depth 2: Diverges at call 1336

**Root Cause**: C uses `wizard_level_teleport` between depths (includes teleport RNG + on-arrival level gen). JS regenerates each level independently with fresh makelevel call. The teleport process consumes RNG differently, causing cascading mismatches.

**Note**: Depth 1 is perfect because both C and JS start from scratch (full initialization + makelevel).

### 3. seed1 Level 2 Generation (5 tests)
**Status**: Algorithmic Divergence
**Session**: seed1.session.json steps 67-71

**Pattern**:
```
Steps 0-66: ✓✓ ALL PASS (perfect RNG sync through descent)
Step 66 (descend): ✓ RNG trace for level 2 gen matches exactly
Steps 67-71: ✗ RNG diverges at distfleeck (monster movement)
```

**Root Cause**: Level 2 generation consumes identical RNG but produces different results
- JS generates: large mimic, shopkeeper, grid bug, kobold zombie (shop, rtype=14)
- C generates: jackal, grid bug×3 (regular rooms, rtype=0)

This is NOT an RNG consumption bug - it's an algorithmic difference in how the level generator interprets the same RNG sequence. Room/monster placement logic differs subtly.

**Evidence**: Step 66 RNG trace matches C exactly (all rn2/rnd calls identical), yet level differs.

### 4. Inventory Sessions (4 tests)
**Status**: Not Implemented
**Sessions**: seed42_inventory_wizard, seed42_inventory_wizard_pickup

**Failure**: Inventory commands not implemented

**Requires**:
- Inventory display command
- Pickup/drop commands
- Item selection UI

## Test Categories Breakdown

| Category | Pass | Fail | Total | Pass Rate |
|----------|------|------|-------|-----------|
| Chargen | ~1000 | 0 | ~1000 | 100% |
| Gameplay | 2 | 1 | 3 | 67% |
| Maps | 5 | 50 | 55 | 9% |
| Inventory | 0 | 4 | 4 | 0% |
| Special | 0 | 36 | 36 | 0% |
| Structural | 45 | 21 | 66 | 68% |
| **Total** | **1052** | **112** | **1164** | **90.4%** |

## Recent Progress

### Session 2026-02-09: Trap Avoidance (+32 tests)
- Implemented m_harmless_trap() function
- Extended mfndpos() with ALLOW_TRAPS flagging
- Fixed wizard mode trap revelation bug
- Fixed makedog() mndx/mnum fields

**Impact**: seed42 gameplay now fully passing (12 steps)

### Previous Sessions
- Vision system test isolation fix (+11 tests)
- Pet movement and FOV system implementation
- Character generation for all 13 roles
- Basic gameplay commands (movement, look, wait, search)

## Next Steps (Priority Order)

1. **Special Levels** (36 tests) - Biggest impact
   - Implement des.* API infrastructure
   - Port special level definitions
   - Moderate effort, clear requirements

2. **Map Sessions Depth 2** (50 tests) - High value
   - Debug depth 2 late divergence (~call 1000-2000)
   - Root cause likely in room/monster generation ordering
   - High effort, requires deep investigation

3. **Inventory** (4 tests) - Quick win
   - Implement basic inventory commands
   - Low-moderate effort, clear requirements

4. **seed1 Level 2 Divergence** (5 tests) - Low priority
   - Requires deep level generation algorithm analysis
   - High effort, unclear benefit (may not fix other tests)

## Statistics

- **Lines of Code**: ~50,000 (JS port)
- **Test Coverage**: 90.4% of golden traces pass
- **RNG Fidelity**: Steps that pass have 100% RNG match
- **Commits**: 40+ over development period
- **Documentation**: Comprehensive (MEMORY.md, TRAP_AVOIDANCE_IMPLEMENTATION.md)
