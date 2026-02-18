# Themerms Integration Plan

> Plan hierarchy: This is a subordinate subplan to root [`PROJECT_PLAN.md`](../PROJECT_PLAN.md).  
> If scope, priority, or milestone details conflict, `PROJECT_PLAN.md` is authoritative.

## Problem Summary

**Current Status:**
- themerms.lua fully ported to JavaScript (1069 lines) ✅
- Valid syntax and structure ✅
- **Blocker:** API mismatch between special level system and procedural generation ❌

**The Gap:**
- Themerms calls `des.room()` (declarative special level API)
- Dungeon.js uses `create_room()` (procedural generation API)
- These operate on different map objects with different contexts

## Architecture Understanding

### Special Level System (sp_lev.js)
```javascript
// Uses global levelState
let levelState = {
    map: null,  // GameMap instance
    currentRoom: null,
    roomStack: [],
    roomDepth: 0
};

// des.room() operates on levelState.map
export function room(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }
    // Creates room entry, marks tiles, pushes to levelState.map.rooms[]
    // Executes contents callback with levelState.currentRoom set
}
```

### Procedural Generation (dungeon.js)
```javascript
// Uses map parameter passed through call chain
function makerooms(map, depth) {
    // ...
    const result = themerooms_generate(map, depth);
    // Expects: boolean (success/failure)
    // Needs: room created on `map`, not levelState.map
}
```

## Solution Approaches

### Option A: Bridge Pattern (RECOMMENDED)
Set up levelState to reference dungeon.js's map during themed room generation.

**Pros:**
- Minimal changes to ported themerms code
- Uses existing des.* implementation
- Most faithful to original Lua behavior

**Cons:**
- Requires careful state management
- Need to ensure levelState cleanup between rooms

**Implementation:**
```javascript
// In dungeon.js before calling themerms
export function themerooms_generate(map, depth) {
    // Set up special level context for des.* functions
    import { initLevelState, finalizeLevelState } from './sp_lev.js';

    initLevelState(map, depth); // Make des.* functions use this map

    // Call themed room generation
    const result = themermsGenerate(map, depth); // From themerms.js

    // Clean up context
    finalizeLevelState();

    return result;
}
```

### Option B: Direct Translation
Rewrite themerms to call create_room() instead of des.room().

**Pros:**
- No special level dependency
- Direct procedural code
- Potentially faster

**Cons:**
- Requires rewriting all themerooms (~31 entries)
- Loses fidelity to original Lua
- More maintenance burden

### Option C: API Adapter Layer
Create wrapper functions that translate des.* calls to procedural equivalents.

**Pros:**
- Keeps themerms code unchanged
- Modular solution

**Cons:**
- Duplicate functionality
- Added complexity

## Recommended Plan: Bridge Pattern

### Phase 1: Expose sp_lev.js State Management (1 hour)

**Add to js/sp_lev.js:**
```javascript
// Export state management functions for dungeon.js integration
export function setLevelContext(map, depth) {
    levelState.map = map;
    levelState.depth = depth;
    levelState.roomStack = [];
    levelState.roomDepth = 0;
    levelState.currentRoom = null;
}

export function clearLevelContext() {
    levelState.map = null;
    levelState.depth = 1;
    levelState.roomStack = [];
    levelState.roomDepth = 0;
    levelState.currentRoom = null;
}

export function getLevelState() {
    return levelState;
}
```

### Phase 2: Fix des.room() Random Placement (2 hours)

**Current issue:** Lines 899-905 in sp_lev.js have stub random placement.

**Fix needed:**
```javascript
} else {
    // Random placement - use same logic as create_room
    // Call dungeon.js's create_room with -1 values
    const result = create_room(levelState.map, -1, -1, -1, -1,
                               xalign, yalign, rtype, false, levelState.depth);

    if (!result || levelState.map.nroom === 0) {
        return false;
    }

    // Get the newly created room from map.rooms
    const createdRoom = levelState.map.rooms[levelState.map.nroom - 1];
    roomX = createdRoom.lx;
    roomY = createdRoom.ly;
    roomW = createdRoom.hx - createdRoom.lx + 1;
    roomH = createdRoom.hy - createdRoom.ly + 1;
}
```

**Key insight:** `create_room()` already handles random placement using BSP rectangles. We just need to call it and extract the created room's coordinates.

### Phase 3: Update dungeon.js Integration (30 min)

**In js/dungeon.js, replace stub themerooms_generate:**
```javascript
import { setLevelContext, clearLevelContext } from './sp_lev.js';
import { themerooms_generate as themermsGenerate } from './levels/themerms.js';

function themerooms_generate(map, depth) {
    const DEBUG = process.env.DEBUG_THEMEROOMS === '1';

    try {
        // Set up des.* API to use procedural map
        setLevelContext(map, depth);

        // Call ported themerms function
        const result = themermsGenerate(map, depth);

        if (DEBUG) {
            console.log(`themerooms_generate: result=${result}, nroom=${map.nroom}`);
        }

        return result;
    } finally {
        // Always clean up, even if error
        clearLevelContext();
    }
}
```

### Phase 4: Fix themerms.js Issues (1 hour)

**Current issues to fix:**

1. **Remove duplicate map parameter** - themerms_generate already gets map via levelState
   ```javascript
   // Change:
   export function themerooms_generate(map, depth) {
   // To:
   export function themerooms_generate() {
       const map = getLevelState().map;
       const depth = getLevelState().depth;
   ```

2. **Fix room reference in themeroom_fill**
   ```javascript
   export function themeroom_fill(rm) {
       // rm is the room object from map.rooms[]
       // Set as currentRoom so des.* functions can reference it
       setCurrentRoom(rm);
       // ... rest of function
   }
   ```

3. **Update helper functions** - ensure they use levelState.map

### Phase 5: Test & Validate (1 hour)

**Test progression:**
1. Unit test: Call des.room() with setLevelContext
2. Integration test: Single themed room generation
3. Full test: Run test suite, expect 90.2% pass rate

**Expected results:**
- des.room() creates rooms on procedural map ✅
- Themed room contents execute correctly ✅
- RNG alignment improves (222 tests → near 0 failures) ✅

## Critical Implementation Details

### Map Object Compatibility
Both sp_lev and dungeon.js use GameMap, but need to verify:
- `map.rooms[]` array structure matches
- `map.nroom` counter updates correctly
- Room objects have same fields: `{lx, ly, hx, hy, rtype, rlit, irregular}`

### RNG State
- Themerms calls rn2(), percent(), shuffle() which consume RNG
- Must ensure these use the same RNG stream as C
- Current imports in themerms.js are correct

### Global Dependencies
Already stubbed in themerms.js:
- `nh.level_difficulty()` → uses _levelDepth (set from depth parameter)
- `align[]` → stub array
- `obj.new()` → stub object creation

May need real implementations for:
- `nh.start_timer_at()` - timer system (can stub for now)
- `obj.new()` - object metadata (needed for "Buried treasure")

## Estimated Timeline

| Phase | Task | Hours |
|-------|------|-------|
| 1 | Expose sp_lev state management | 1 |
| 2 | Fix des.room() random placement | 2 |
| 3 | Update dungeon.js integration | 0.5 |
| 4 | Fix themerms.js issues | 1 |
| 5 | Test & validate | 1 |
| **Total** | | **5.5 hours** |

## Success Criteria

- ✅ Test suite pass rate: 90.2% (from current 81.6%)
- ✅ All 222 currently failing tests pass
- ✅ No regression in currently passing tests
- ✅ Themed rooms actually generate (visual inspection)
- ✅ RNG traces match C implementation

## Fallback Plan

If Bridge Pattern fails:
1. Identify specific blocking issues
2. Consider hybrid: Bridge for simple rooms, Direct Translation for complex ones
3. Worst case: Keep stub, document themerms as "future work"

But given the architecture analysis, Bridge Pattern should work cleanly.
