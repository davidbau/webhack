# CRITICAL FINDING: Map-Relative Coordinate System

## Discovery (2026-02-11)

**Root Cause of ALL Special Level Terrain Mismatches**

In NetHack Lua special levels, coordinates for doors, ladders, objects, and monsters are **RELATIVE to the map origin** after `des.map()` is called, not absolute screen coordinates.

## Evidence

### Lua Code (tower1.lua)
```lua
des.map({ halign = "half-left", valign = "center", map = [[
  --- --- ---  
  |.| |.| |.|  
---S---S---S---
...
]] });

des.door("closed",08,03)  -- Row 3 OF THE MAP, not screen row 3
```

### C Behavior
- Map placed at screen (17, 5)
- `des.door("closed",08,03)` places door at absolute (17+8, 5+3) = (25, 8)

### JS Behavior (INCORRECT)
- Map placed at screen (16, 5)  
- `des.door("closed",08,03)` places door at absolute (8, 3) ❌
- This creates terrain 2 rows ABOVE the map!

## Impact

- **ALL special level comparison tests failing** due to misplaced terrain
- Doors, ladders, monsters, objects placed at wrong absolute coordinates
- Map appears correct, but everything else is offset

## Required Fix

1. **Add coordinate context tracking**:
   ```javascript
   levelState.mapCoordMode = true;  // Set after des.map()
   levelState.mapOriginX = xstart;
   levelState.mapOriginY = ystart;
   ```

2. **Update coordinate-using functions**:
   - `door(x, y)` → convert to `(xstart + x, ystart + y)` if mapCoordMode
   - `ladder(x, y)` → same conversion
   - `object(x, y)` → same conversion
   - `monster(x, y)` → same conversion
   - `trap(x, y)` → same conversion

3. **Reset on new map**:
   - Each `des.map()` call resets the origin

4. **Handle special cases**:
   - Absolute coords still needed for some functions (mazewalk, region, etc.)
   - May need explicit `des.absolute_coords()` or similar

## Test Validation

After implementing, tower1 test should show:
- C: terrain at rows 5-15
- JS: terrain at rows 5-15 (currently at rows 3-13)

## Priority

**CRITICAL** - This blocks accurate replication of all special levels.
Must be implemented before special level comparison tests can pass.

## Files Affected

- `js/sp_lev.js`:
  - `map()` - set coordinate context
  - `door()` - convert coords
  - `ladder()` - convert coords
  - `object()` - convert coords (already has currentRoom conversion, extend)
  - `monster()` - convert coords
  - `trap()` - convert coords

- ALL `js/levels/*.js` files:
  - Currently use Lua coordinates (unchanged)
  - Will work correctly once JS implements conversion
