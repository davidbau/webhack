# Special-level parity progress (2026-02-15): mkobj/object-phase tracing

## Test status
- Baseline after this checkpoint remains unchanged: `18 pass / 68 fail` in `test/unit/special_levels_comparison.test.js`.
- No additional regression introduced by this checkpoint.

## What was added
- JS `mkobj` instrumentation (`WEBHACK_MKOBJ_TRACE=1`) in `js/mkobj.js`:
  - logs `mkobj` class selection and chosen `otyp`
  - logs `mkbox_cnts` count/class/item generation
  - logs food init branches (corpse/egg/tin) with RNG call index
  - logs statue/figurine init picks
  - logs caller-chain context to identify whether calls originate from des-object phase vs later generation
- C harness env passthrough in `test/comparison/c-harness/gen_special_sessions.py`:
  - passes `NETHACK_MKOBJ_TRACE` into generated C sessions for side-by-side traces

## Key findings from traces
- Castle remains the earliest special-level drift with first typ divergence in wallification phase (`after_wallification`, coord `(6,2)`, C=`2`, JS=`9`).
- Object-phase streams are still not call-by-call aligned before the first fill monster roll; tin/egg branch occurrence can swap between runs depending on upstream drift.
- Current instrumentation is sufficient to pin the first object-phase divergence by event index once C-side `create_object` event logging is added.

## Recommended next debugging step
1. Add C-side `create_object` event logs in `nethack-c/src/sp_lev.c` under `NETHACK_MKOBJ_TRACE`.
2. Add matching JS `des.object` event logs in `js/sp_lev.js`.
3. Diff event streams for castle object phase; fix first call-site mismatch before re-checking first `makemon(NULL,...)` alignment.
