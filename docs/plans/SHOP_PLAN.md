# Shop Implementation Plan — Remaining Work

## What's Done

### mkobj.js — m_id counter tracking
- `next_ident()` returns monotonic counter, consumes `rnd(2)`, exported
- `getIdentCounter()` exported for external reads
- `newobj()` stores `o_id` on every object

### makemon.js — Shopkeeper creation prerequisites
- **PM_SHOPKEEPER in m_initinv**: SKELETON_KEY + `rn2(4)` fall-through switch
  for WAN_MAGIC_MISSILE, POT_EXTRA_HEALING, POT_HEALING, WAN_STRIKING
- **rnd_offensive_item**: Full implementation replacing TODO stub.
  `rn2(75)` always consumed; if passed, `rn2(35)` for WAN_DEATH check,
  then `rn2(range)` switch for 13 possible items. `mksobj()` creates result.
- **m_id on monsters**: `makemon()` calls `next_ident()`, stores `m_id` on mon object

### dungeon.js — mkshop() room selection
- `mkshop(map)`: Finds eligible room (OROOM, no stairs, 1 door, valid shape),
  lights it, picks shop type via `rnd(100)` + shtypes probability walk
- Helpers: `isbig()`, `has_dnstairs_room()`, `has_upstairs_room()`,
  `invalid_shop_shape()`
- **Not yet wired up** — needs `shtypes` import from shknam.js

---

## What Remains

### 1. Create `js/shknam.js` (largest piece)

New file mirroring C's `shknam.c`. Exports: `shtypes`, `stock_room`.

#### 1a. `shtypes[]` probability table
C ref: `shknam.c:209-354`. Array of 11 shop types + 1 lighting (prob=0) + sentinel.

Each entry: `{ name, symb, prob, iprobs: [{iprob, itype}...], shknms }`.
Probabilities sum to 100:
- general(42), armor(14), scroll(10), potion(10), weapon(5), food(5),
  ring(3), wand(3), tool(3), book(3), health(2)

Negative `itype` = specific object (use `mksobj`), positive = class (use `mkobj`).
`VEGETARIAN_CLASS = 19` (MAXOCLASSES + 1, where MAXOCLASSES=18 in config.js).

#### 1b. Shopkeeper name lists
All 12 arrays verbatim from C (`shknam.c:32-188`):
`shkgeneral`, `shkarmors`, `shkbooks`, `shkliquors`, `shkwands`, `shkrings`,
`shkfoods`, `shkweapons`, `shktools`, `shklight`, `shkhealthfoods`.

#### 1c. `get_shop_item(type)` — C ref: `shknam.c:829-839`
```javascript
function get_shop_item(type) {
    const shp = shtypes[type];
    let j = rnd(100);  // 1 RNG call per item
    for (let i = 0; i < shp.iprobs.length; i++) {
        if ((j -= shp.iprobs[i].iprob) <= 0) return shp.iprobs[i].itype;
    }
    return RANDOM_CLASS;
}
```

#### 1d. `shkveg()` + `mkveggy_at()` — C ref: `shknam.c:407-450`
`shkveg()`: Build list of vegetarian food items (material === VEGGY || name === 'egg'),
sum their probabilities, call `rnd(maxprob)`, walk the list.
`mkveggy_at(sx, sy)`: Calls `mksobj(shkveg(), TRUE, TRUE)`.

Veggy check: `objectData[i].oc_class === FOOD_CLASS && (objectData[i].material === VEGGY || i === EGG)`.

#### 1e. `good_shopdoor(sroom, map)` — C ref: `shknam.c:581-624`
Find door and compute shopkeeper position just inside the room. Returns
`{ di, sx, sy }` or null. No RNG.

For non-irregular rooms: if door is at `lx-1` → `sx = lx`, if at `hx+1` → `sx = hx`, etc.
Our rooms are all regular (no irregular flag needed initially).

#### 1f. `stock_room_goodpos(sroom, sh, sx, sy, map)` — C ref: `shknam.c:694-714`
Check if position is valid for stock placement. For regular rooms, exclude the
row/column adjacent to the shop door. Must be ROOM type. No RNG.

#### 1g. `shkinit(shp, sroom, map, depth)` — C ref: `shknam.c:628-692`
Create shopkeeper. **RNG sequence**:
1. `good_shopdoor()` — no RNG
2. `makemon(PM_SHOPKEEPER, sx, sy, 0, depth, map)` — this consumes:
   - `next_ident()` → `rnd(2)` for m_id
   - `newmonhp()` RNG (shopkeeper level=12, so `rnd(d(12,8))` or similar)
   - gender: shopkeeper is M2_HUMAN, not M2_MALE/FEMALE/NEUTER → `rn2(2)`
   - `m_initweap()`: shopkeeper has AT_WEAP, so armed:
     - Generic weapon: `rnd(14)` → weapon selection + `mksobj()`
     - `rn2(75)` for offensive item check (level=12, always consumed)
     - If `12 > rn2(75)` passes: `rn2(35)` + `rn2(13)` + `mksobj()`
   - `m_initinv()`: PM_SHOPKEEPER branch (SKELETON_KEY + rn2(4) switch)
   - `rn2(100)` for saddle check (always consumed)
3. `mkmonmoney(shk, 1000 + 30 * rnd(100))`:
   - `rnd(100)` for capital amount
   - `mksobj(GOLD_PIECE, ...)` → `rnd(2)` for newobj
4. Conditional mongets (RNG for rn2 checks):
   - If `shp.shknms === shkrings`: `mksobj(TOUCHSTONE, true, false)`
   - If `shktools || shkwands || (shkrings && rn2(2)) || (shkgeneral && rn2(5))`:
     `mksobj(SCR_CHARGING, true, false)`
5. `nameshk(shk, shp.shknms)` — see 1h

**Key detail**: `mkmonmoney` in C calls `mksobj(GOLD_PIECE, FALSE, FALSE)` which
creates gold via newobj → `rnd(2)`. Then sets quantity. In JS, replicate with
`mksobj(GOLD_PIECE, false, false)`.

#### 1h. `nameshk(shk, nlp)` — C ref: `shknam.c:487-554`
RNG depends on shop type and m_id:
- Compute `nseed = Math.floor(ubirthday / 257)`
  - `ubirthday` = game seed (the original seed value, available from nethack.js)
- `name_wanted = m_id + ledger_no + (nseed % 13) - (nseed % 5)`
  - `ledger_no` for regular dungeon = depth + 1 (surface is ledger 0, level 1 is ledger 2, etc.)
  - Actually: `ledger_no(&u.uz)` = `dnum * (maxledger/n_dgns) + dlevel` but for main dungeon
    dnum=0, so `ledger_no = dlevel` where dlevel = 1-indexed depth within branch.
    More precisely, the C macro is: `ledger_no(&u.uz)` =
    `svd.dungeons[u.uz.dnum].ledger_start + u.uz.dlevel` where ledger_start for
    the Dungeons of Doom is typically 0. So `ledger_no = depth` for main dungeon.
- `name_wanted = name_wanted % names_avail`
- If `nlp === shktools`: always `rn2(names_avail)` (1 RNG call)
- Else if `name_wanted < names_avail`: direct lookup (0 RNG calls)
- Else: `rn2(names_avail)` fallback (1 RNG call)
- First shopkeeper on a level typically gets name directly (no collision loop)

**Needs**: `ubirthday` accessible from shknam.js. Could export from nethack.js
or pass as parameter. Simplest: pass `seed` and `depth` to `shkinit`.

#### 1i. `mkshobj_at(shp, shpIndex, sx, sy, mkspecl, map, depth)`
C ref: `shknam.c:453-483`. **RNG per tile**:
1. Tribute novel check (bookstores only, first special spot):
   `mksobj(SPE_NOVEL, FALSE, FALSE)` → `rnd(2)` for newobj
2. `rn2(100)` — mimic chance (always consumed)
3. If `rn2(100) < depth` AND no monster at (sx,sy):
   `mkclass(S_MIMIC, 0)` → class selection RNG
   `makemon(ptr, sx, sy, NO_MM_FLAGS)` → full makemon RNG
4. If no mimic: `get_shop_item()` → `rnd(100)`, then:
   - `VEGETARIAN_CLASS`: `mkveggy_at()` → `rnd(maxprob)` + `mksobj()`
   - Negative type: `mksobj(-atype, TRUE, TRUE)` → item RNG
   - Positive class: `mkobj(atype, TRUE)` → class selection + item RNG

**Mimic check detail**: C uses short-circuit `&&`:
```c
if (rn2(100) < depth(&u.uz) && !MON_AT(sx, sy)
    && (ptr = mkclass(S_MIMIC, 0)) != 0
    && (mtmp = makemon(ptr, sx, sy, NO_MM_FLAGS)) != 0)
```
`rn2(100)` is ALWAYS consumed. If condition fails, remaining ops are skipped.
`mkclass` and `makemon` only called if mimic chance passes AND no monster at pos.

#### 1j. `stock_room(shp_indx, sroom, map, depth)`
C ref: `shknam.c:718-801`.
1. `shkinit()` — create shopkeeper (big RNG sequence, see 1g)
2. Fix door: if D_NODOOR → D_ISOPEN, if SDOOR → DOOR, remove D_TRAPPED
3. If tribute enabled AND not bookstock: count good positions → `rnd(stockcount)` for tribute spot
   - We probably don't have tribute system, so skip this (no RNG)
   - **Check**: Does C always call `rnd(stockcount)` here? Only if
     `svc.context.tribute.enabled && !svc.context.tribute.bookstock`.
     Tribute is enabled by default in 3.7 (`tribute.enabled = TRUE` in
     `initoptions_init()`). So YES, `rnd(stockcount)` is consumed.
   - Need to confirm: is tribute always enabled during mklev? Check C init.
4. Loop all room tiles, check `stock_room_goodpos()`, call `mkshobj_at()` per valid spot
5. Set `map.flags.has_shop = true`

### 2. Wire up mkshop() call in dungeon.js

At the shop creation stub (currently line ~3044):
```javascript
if (depth > 1 && map.nroom >= room_threshold && rn2(depth) < 3) {
    mkshop(map);  // replace comment stub
}
```

**Also** add `import { shtypes, stock_room } from './shknam.js'` at top.

### 3. Wire fill_special_room for shops in dungeon.js

In the second fill pass (currently only handles VAULT), add shop dispatch
**before** the vault loop:
```javascript
for (const croom of map.rooms) {
    if (croom.rtype >= SHOPBASE && croom.needfill === FILL_NORMAL) {
        stock_room(croom.rtype - SHOPBASE, croom, map, depth);
    }
}
// existing vault handling...
```

### 4. Handle ubirthday / game seed

`nameshk()` needs `ubirthday` (the game seed). Options:
- Pass `seed` as parameter through `stock_room → shkinit → nameshk`
- Set a module-level variable in shknam.js at game init time
- Import from a shared game state module

Simplest: pass seed through the call chain. `makelevel()` doesn't currently
receive the seed, but we can add it or use a module-level setter similar
to `setLevelDepth()`.

### 5. Tribute system check

Need to verify whether `context.tribute.enabled` is always true during mklev
in NetHack 3.7. If so, `rnd(stockcount)` is always consumed in `stock_room()`.
If not, we skip it and only consume RNG when tribute is enabled.

From C init: `svc.context.tribute.enabled = 1` in `initoptions_init()`.
So yes, it's always true. The `bookstock` flag is set by `mkshobj_at` when
a novel is placed in a bookstore. For the first shop on a level, bookstock
starts false, so `rnd(stockcount)` IS consumed.

### 6. mongets() pattern

C's `mongets(shk, otyp)` = `mksobj(otyp, TRUE, FALSE)` + demon/alignment checks.
For shopkeepers (S_HUMAN, not demon, not lminion), it's just `mksobj(otyp, TRUE, FALSE)`.
So we can use `mksobj()` directly, which is what we already do.

### 7. mkmonmoney() pattern

C's `mkmonmoney(shk, amount)` creates a gold object:
- `mksobj(GOLD_PIECE, FALSE, FALSE)` → newobj → `rnd(2)` for o_id
- Sets `obj->quan = amount`
- Gives to monster

For RNG alignment: `mksobj(GOLD_PIECE, false, false)` consumes `rnd(2)` via newobj.
The `init=FALSE` means `mksobj_init` is skipped, so only `rnd(2)` + `mksobj_postinit`.

---

## Implementation Order

1. **Create `js/shknam.js`** with shtypes table + name lists + all helper functions
2. **Wire mkshop() call** in dungeon.js (replace stub comment)
3. **Wire fill_special_room** for shops
4. **Handle seed/ubirthday** passing
5. **Test incrementally** against C trace at each step

## Verification

1. `npm test` — unit tests pass (466+ tests)
2. `node --test test/comparison/session_runner.test.js` — measure improvement
   - Current: 617 pass, 83 fail (approximate)
   - Target: seed1 step 66 should advance past call 1309 (mkshop)
   - Ideally: full step 66 alignment (~2615 RNG calls matching C)
3. No regression in seed42, seed42_items, chargen sessions

## Key RNG Call Count Estimate for stock_room

For a typical shop room (~20 tiles, ~15 valid stock positions):
- shkinit: ~10-20 RNG calls (makemon + money + accessories + nameshk)
- tribute spot: 1 RNG call (rnd(stockcount))
- per stock position: ~3-5 RNG calls each (rn2(100) mimic + get_shop_item + mksobj)
- Total: ~60-100 RNG calls for a fully stocked shop

This should account for the ~600 missing calls between JS (2006) and C (2615)
at step 66.
