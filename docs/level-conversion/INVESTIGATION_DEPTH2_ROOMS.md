# Depth 2 Room Count Divergence Investigation

## Problem
- JS creates 9 main rooms at depth 2
- C creates 7 main rooms at depth 2  
- generate_stairs_find_room calls rn2(9) in JS vs rn2(7) in C
- This causes RNG divergence at call 1336

## Key Findings

### RNG Alignment Before Divergence
- ALL 1336 RNG calls before divergence match perfectly (100%)
- This is an **algorithmic divergence**, not an RNG bug
- JS and C consume the same RNG sequence but interpret it differently

### Room Creation Pattern
- Only 2 rnd_rect() successes → makerooms loop runs exactly 2 iterations
- 7 total rn2(100) build_room checks observed
- All 9 rooms have rtype=OROOM (no THEMEROOM rooms)
- map.nsubroom = 0 (no subrooms created)

### Theme Room Analysis
Theme rooms call rn2(100) multiple times:
- nestingRooms: 3 calls (outer + middle + innermost)
- roomInRoom: 2 calls (outer + inner)
- hugeRoom: 2 calls (outer + optional inner)
- fakeDelphi: 2 calls (outer + inner)

7 total rn2(100) calls suggest theme rooms were invoked and created multiple rooms.

### Subroom Issue
Current code structure:
- `add_room_to_map()` pushes to map.rooms and sets `map.nroom = map.rooms.length`
- `add_subroom_to_map()` does NOT push to map.rooms
- Subrooms are stored only in parent's sbrooms[] array

This means:
- Subrooms are NOT in map.rooms array
- Code that iterates map.rooms can't access subrooms
- map.nroom only counts main rooms (correct)

### Attempted Fix & Blocker
Adding `map.rooms[roomIdx] = croom` to add_subroom_to_map causes:
- RNG desync from call 0 at depth 2
- C has 2565 RNG calls at depth 1, JS drops to 2474 (missing 91 calls)
- Changing `map.nroom = map.rooms.length` to increment breaks something

**Root cause of fix failure unknown** - adding subrooms to array shouldn't consume RNG.

## Hypothesis
The extra 2 main rooms (9 vs 7) may come from:
1. Theme rooms creating main rooms when they should create subrooms
2. floodFillAndRegister being called when it shouldn't be
3. Des.map() theme rooms (picks 11-29) creating multiple main rooms
4. Bug in how create_subroom fails and falls back to create_room

## Latest Findings (2026-02-09)

### Subroom Array Structure Fix Applied
Successfully fixed map.rooms array structure to match C:
- Main rooms stored at indices [0..nroom-1]
- Subrooms stored at indices [nroom..nroom+nsubroom-1]
- Fixed 5 loops to iterate only over main rooms (0..nroom-1)
- **RNG alignment improved**: 441 → 1172 matching calls (2.7x improvement!)

### Theme Room Generation Analysis
Created diagnostic scripts to trace theme room selection:
- **Reservoir sampling works correctly**: All 30 RNG calls executed
- **All picks select "0" (themeroom_default)**: 100% of attempts
- **themeroom_default creates OROOM main rooms**, NOT subrooms
- **create_room mostly succeeds**: Most attempts create rooms successfully
- **No subrooms expected**: Subrooms only created by picks 2-4 (roomInRoom, hugeRoom, nestingRooms)

### Root Cause of "Missing Subrooms"
**THERE ARE NO MISSING SUBROOMS!** The investigation was based on a false premise:
1. Theme room pick 0 (themeroom_default) creates OROOM main rooms, not subrooms
2. Subroom-creating picks (2=roomInRoom, 3=hugeRoom, 4=nestingRooms) are NOT selected
3. Reservoir sampling heavily favors pick 0 (frequency 1000 vs 1 for others)
4. At depth 2 with seed 163, RNG consistently selects pick 0

### Actual Problem: Room Count Divergence
- **JS depth 2**: 10 main rooms, 0 subrooms (after fixes)
- **C depth 2**: 7 main rooms (expected)
- **Divergence cause**: Unknown, but NOT related to subrooms
- RNG calls align for 1172 calls before diverging

## Next Steps
1. ~~Investigate why subrooms aren't being created~~ **RESOLVED**: No subrooms expected
2. Investigate why JS creates 10 rooms vs C's 7 at depth 2
3. Check makerooms loop termination conditions
4. Compare C's rnd_rect() success count with JS
5. Check if theme room failures affect loop continuation
