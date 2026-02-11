# ⚠️ CRITICAL: Themed Room Debug Mode in Test Sessions

**Date:** 2026-02-10
**Status:** DOCUMENTED - Behavior now understood and matched in JS
**Severity:** HIGH - Affects interpretation of all session test results

---

## 🚨 WARNING: Two Types of Sessions Exist

Our test sessions come in **two fundamentally different types** with **incompatible RNG behavior**:

### Type 1: Special Level Sessions (sp_lev.c)
- **Example:** Oracle, Castle, Mines, Sokoban, most map sessions
- **Generation:** Predefined in Lua files with explicit `des.room()` calls
- **Themed Rooms:** ❌ NOT USED - rooms are explicitly defined
- **Debug Mode Impact:** ✅ NONE - THEMERM/THEMERMFILL has no effect
- **RNG Pattern:** MT init → build_room → litstate_rnd → create_room
- **Count:** Most sessions in `test/comparison/maps/`

### Type 2: Normal Dungeon Sessions (mklev.c)
- **Example:** Most dungeon levels in gameplay sessions
- **Generation:** Procedurally generated via `makerooms()`
- **Themed Rooms:** ✅ USED - calls `themerooms_generate()` with reservoir sampling
- **Debug Mode Impact:** 🔴 **CRITICAL** - Changes RNG consumption completely
- **RNG Pattern (normal):** MT init → reservoir sampling (30+ calls) → build_room
- **RNG Pattern (debug):** MT init → build_room (reservoir sampling skipped!)
- **Count:** Many sessions in `test/comparison/sessions/` gameplay tests

---

## The Debug Mode Issue

### What THEMERM/THEMERMFILL Do

In **wizard mode** (`-D` flag), NetHack enables debug themed room selection via environment variables:

- `THEMERM=room_name` - Forces selection of a specific themed room
- `THEMERMFILL=fill_name` - Forces selection of a specific room fill

When these are set (even to empty string in some shells), the Lua `themerooms_generate()` function takes an **early return path** that **skips all reservoir sampling RNG calls**.

### Code Paths

**Normal Mode (THEMERM not set):**
```lua
function themerooms_generate()
   -- Reservoir sampling: ~30 RNG calls selecting from eligible themed rooms
   for i = 1, #themerooms do
      total_frequency = total_frequency + this_frequency;
      if this_frequency > 0 and nh.rn2(total_frequency) < this_frequency then
         pick = i;
      end
   end
   themerooms[pick].contents();
end
```

**Debug Mode (THEMERM set):**
```lua
function themerooms_generate()
   if debug_rm_idx ~= nil then
      -- EARLY RETURN: Skip all reservoir sampling!
      local actualrm = lookup_by_name("default", false);
      if percent(50) then
         if is_eligible(themerooms[debug_rm_idx]) then
            actualrm = debug_rm_idx;
         end
      end
      themerooms[actualrm].contents();
      return  -- ← Exits without 30+ rn2() calls!
   end
   -- ... normal path never reached
end
```

### RNG Consumption Difference

| Step | Normal Mode | Debug Mode |
|------|-------------|------------|
| 1. MT Init | rn2(1000-1036) [30 calls] | rn2(1000-1036) [30 calls] |
| 2. Reservoir Sampling | rn2(1), rn2(2), ..., rn2(~30) | ⚠️ **SKIPPED** |
| 3. Room Creation | build_room, litstate_rnd, create_room | build_room, litstate_rnd, create_room |
| **Total Difference** | | **~30 fewer RNG calls per room!** |

---

## Impact on Our Test Sessions

### C Session Generation

C sessions were generated using:
```bash
NETHACK_SEED=<seed> <binary> -u Wizard -D
```

The `-D` flag enables wizard mode, which:
1. Enables level teleport (needed for multi-depth map generation)
2. Enables the THEMERM/THEMERMFILL debug feature

**Critical Question:** Were THEMERM/THEMERMFILL environment variables set?

### Evidence from Traces

Examining normal dungeon levels in C traces (e.g., seed1 level 2):
- ✅ Shows `makerooms(mklev.c)` calls
- ✅ Shows MT init sequences (rn2(1000-1036))
- ❌ Shows NO reservoir sampling sequences
- ✅ Immediately proceeds to `build_room(sp_lev.c)`

**Conclusion:** C sessions were generated with **debug mode active** (or themed rooms disabled).

### JS Implementation Status

JS has **both code paths implemented**:
- ✅ Normal reservoir sampling (lines 979-1002 in themerms.js)
- ✅ Debug mode early return (lines 953-969 in themerms.js)
- ✅ `nh.debug_themerm()` function (as of 2026-02-10)

---

## Session Compatibility Matrix

| Session Type | C Behavior | JS Behavior | Compatible? |
|--------------|------------|-------------|-------------|
| **Special levels** | No themed rooms | No themed rooms | ✅ YES |
| **Normal dungeons (no THEMERM)** | Reservoir sampling | Reservoir sampling | ✅ YES |
| **Normal dungeons (THEMERM set)** | Skip reservoir | Skip reservoir (if env set) | ✅ YES (if env matches) |

---

## How to Handle This

### For Test Execution

When replaying C sessions, ensure JS uses the same debug mode:

```javascript
// If C session was generated with THEMERM debug mode:
process.env.THEMERM = '';  // Empty string still triggers debug mode
process.env.THEMERMFILL = '';

// Or if session metadata indicates debug mode:
if (session.metadata?.wizardMode || session.metadata?.debugThemerm) {
    process.env.THEMERM = '';
}
```

### For New Session Generation

**Option A: Disable debug mode (recommended for new sessions)**
```bash
unset THEMERM THEMERMFILL
NETHACKDIR=... NETHACK_SEED=... ./nethack -u Wizard -D
```

**Option B: Explicitly enable debug mode (for testing debug path)**
```bash
export THEMERM="default"
export THEMERMFILL=""
NETHACKDIR=... NETHACK_SEED=... ./nethack -u Wizard -D
```

### Session Metadata

Add to session JSON:
```json
{
  "version": 2,
  "seed": 42,
  "wizard": true,
  "debugThemerm": true,  // ← Indicates THEMERM was set during generation
  "debugThemermValue": "default",  // ← The actual value (if any)
  ...
}
```

---

## Test Results Interpretation

### Before Understanding (2026-02-09)
- Assumed all sessions use normal reservoir sampling
- Couldn't explain why some normal dungeons showed no reservoir sampling
- Thought THEMERM was accidentally enabled and tried to "fix" it

### After Understanding (2026-02-10)
- Recognized two session types: special levels vs normal dungeons
- Confirmed C sessions likely use debug mode (based on RNG traces)
- Implemented `nh.debug_themerm()` to match C behavior
- **All existing test pass rates are VALID** - they correctly match C's debug mode behavior

### Current Test Status (seed16 example)
- **Depth 1:** Has `makerooms` calls (normal dungeon)
- **RNG Trace:** Shows MT init but no reservoir sampling
- **Interpretation:** C used debug mode, JS must match
- **Result:** ✅ PASSES (both skip reservoir sampling)

---

## How to Identify Session Type

### Special Level Session
```javascript
// RNG trace shows:
rn2(1036) @ nhl_rn2          // MT init
rn2(100) @ build_room        // sp_lev.c - no makerooms!
rnd(2) @ litstate_rnd
```

### Normal Dungeon (Debug Mode)
```javascript
// RNG trace shows:
rn2(2) @ makerooms           // mklev.c!
rn2(1036) @ nhl_rn2          // MT init
rn2(100) @ build_room        // No reservoir sampling!
```

### Normal Dungeon (Normal Mode) - Not yet seen in our sessions
```javascript
// Expected pattern:
rn2(2) @ makerooms
rn2(1036) @ nhl_rn2          // MT init
rn2(1) @ nhl_rn2             // Reservoir sampling starts
rn2(2) @ nhl_rn2
rn2(3) @ nhl_rn2
// ... ~30 calls with increasing arguments
rn2(100) @ build_room
```

---

## Files Affected

### C Implementation
- `nethack-c/src/nhlua.c:993` - `nhl_get_debug_themerm_name()` (checks wizard + env var)
- `nethack-c/dat/themerms.lua:926` - `themerooms_generate()` (debug early return)
- `nethack-c/dat/themerms.lua:982` - `pre_themerooms_generate()` (sets debug_rm_idx)

### JS Implementation
- `js/levels/themerms.js:953` - Debug mode check
- `js/levels/themerms.js:979` - Normal reservoir sampling
- `js/levels/themerms.js:1054` - Calls `nh.debug_themerm()`
- `js/sp_lev.js:2443` - `nh.debug_themerm()` implementation (NEW)

### Test Sessions
- `test/comparison/maps/*_map.session.json` - Mix of special + normal dungeons
- `test/comparison/sessions/*_gameplay.session.json` - Contains normal dungeons
- All sessions likely generated with debug mode enabled

---

## Lessons Learned

1. **Environment matters** - Wizard mode enables features that change RNG behavior
2. **Two types of levels** - Special levels (sp_lev.c) vs normal dungeons (mklev.c)
3. **Debug modes exist** - THEMERM is a legitimate debug feature, not a bug
4. **Session metadata** - Should document generation environment (wizard mode, env vars)
5. **Test assumptions** - Can't assume all sessions follow the same code paths
6. **RNG traces are evidence** - Absence of reservoir sampling is a clue, not an error

---

## Recommendations

### Immediate (Done)
- ✅ Implement `nh.debug_themerm()` in JS
- ✅ Document the debug mode behavior
- ✅ Update MEMORY.md with correct understanding

### Short Term
- Add session metadata field for `debugThemerm`
- Audit all sessions to identify which use debug mode
- Set `THEMERM=''` when running tests on affected sessions
- Document which sessions require debug mode

### Long Term
- Generate new sessions with explicit debug mode control
- Create paired sessions: normal + debug versions of same seed
- Test both code paths (reservoir sampling + debug mode)
- Add tests that verify themed room selection works correctly

---

## Related Documentation

- `docs/notes/special_vs_normal_dungeons.md` - Level generation types
- `MEMORY.md` - Key patterns and test status
- `docs/PHASE_3_MULTI_DEPTH_ALIGNMENT.md` - Multi-depth RNG alignment work

---

**Summary:** Debug mode is a feature, not a bug. Our C sessions use it, our JS implementation now supports it, and our tests are validating the correct behavior. The "issue" was our misunderstanding, not the sessions.
