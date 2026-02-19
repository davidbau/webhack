# C-to-JS Correspondence Ledger (Core Gameplay)

**See also:**
[CODEMATCH.md](CODEMATCH.md) (structural C↔JS file/function mapping, [issues #32–#138](https://github.com/davidbau/menace/issues?q=label%3Acodematch)) |
[DESIGN.md](DESIGN.md) (architecture) |
[DEVELOPMENT.md](DEVELOPMENT.md) (dev workflow) |
[PARITY_TEST_MATRIX.md](PARITY_TEST_MATRIX.md) (test reference) |
[DECISIONS.md](DECISIONS.md) (design choices)

Last updated: 2026-02-18

This document tracks **active parity debugging** by domain: which functions are
diverging from C behavior and which issues track them (PROJECT_PLAN Phase 2–3).
For **structural coverage** (complete C↔JS file/function mapping and refactoring
status), see [CODEMATCH.md](CODEMATCH.md).

## Status Legend

- `ported`: JS function path exists and no active known parity issue is scoped to it.
- `partial`: JS function path exists, but active parity gaps are tracked in open issues.
- `unstarted`: No direct JS counterpart is mapped yet.

## Maintenance Rules

1. Add/modify rows when parity work lands; do not defer ledger updates.
2. Keep statuses evidence-based (link open issue numbers or passing test commands).
3. Prefer function-level mapping for first-divergence call paths.
4. When a `partial` path reaches parity and has no active tracker, promote to `ported`.

## File-Level Correspondence (Core Domains)

| Domain | C Source Files | JS Counterparts | Status | Active Signals |
| --- | --- | --- | --- | --- |
| RNG core | `rnd.c`, `isaac64.c` | `js/rng.js`, `js/isaac64.js` | `ported` | No open RNG-engine issue; divergence is in gameplay call ordering. |
| Dungeon + special generation | `mklev.c`, `mkroom.c`, `mkmaze.c`, `sp_lev.c`, `dungeon.c`, trap-gen portions of `trap.c` | `js/dungeon.js`, `js/sp_lev.js`, `js/special_levels.js`, `js/levels/themerms.js` | `partial` | #9, #13 |
| Monster movement + pet AI | `monmove.c`, `dogmove.c`, movement portions of `mon.c`, targeting portions of `mhitm.c` | `js/monmove.js` | `partial` | #8, #11 |
| Monster generation + startup entities | `makemon.c`, `u_init.c` | `js/makemon.js`, `js/u_init.js` | `partial` | #10 |
| Object generation + naming | `mkobj.c`, `objnam.c`, `o_init.c`, `objects.c` | `js/mkobj.js`, `js/o_init.js`, `js/objects.js` | `partial` | #10 |
| Combat + XP progression | `uhitm.c`, `mhitu.c`, `exper.c`, parts of `weapon.c`, `mon.c` kill paths | `js/combat.js`, `js/commands.js`, `js/monmove.js` | `partial` | #8, #11 |
| Command flow + turn loop | `allmain.c`, `cmd.c`, `hack.c`, `do.c`, `pickup.c`, `invent.c`, `read.c` | `js/nethack.js`, `js/headless_runtime.js`, `js/commands.js`, `js/player.js` | `partial` | #6, #7, #11 |

## Function-Level Correspondence (High Priority)

### A) Dungeon + Special-Level Generation

| C Function(s) | JS Function(s) | Status | Notes |
| --- | --- | --- | --- |
| `makelevel` (`mklev.c`) | `makelevel` (`js/dungeon.js`) | `partial` | Core generator exists; early RNG ordering still diverges (#9, #13). |
| `makerooms`, `sort_rooms`, `makecorridors`, `fill_ordinary_room` (`mklev.c`) | `makecorridors`, `fill_ordinary_room` and related room builders (`js/dungeon.js`) | `partial` | Implemented with C refs, but special/wizard sessions still drift (#9). |
| `mktrap`, `traptype_rnd`, `mktrap_victim` (`mklev.c`) | `mktrap`, `traptype_rnd`, `mktrap_victim` (`js/dungeon.js`) | `partial` | Implemented; tutorial/special parity not yet exact (#13). |
| `mineralize` (`mklev.c`) | `mineralize` (`js/dungeon.js`) | `partial` | Implemented; ordering interacts with broader makelevel drift. |
| `create_room`, `create_subroom`, `dig_corridor` (`sp_lev.c`) | `create_room`, `create_subroom` (`js/dungeon.js`), `corridor` (`js/sp_lev.js`) | `partial` | Corridor candidate-space sizing mismatch still open (#9). |
| `splev_initlev` (`sp_lev.c`) | `level_init` (`js/sp_lev.js`) | `partial` | Implemented with tutorial shims; strict tutorial replay still divergent (#13). |
| `lspo_room`, `lspo_door`, `lspo_trap`, `lspo_monster`, `lspo_object`, `lspo_levregion` (`sp_lev.c`) | `room`, `door`, `trap`, `monster`, `object`, `levregion` (`js/sp_lev.js`) | `partial` | Lua special-level bridge present; parity closure still in progress (#9, #13). |
| `percent` macro + `shuffle` usage (`sp_lev.c`) | `percent`, `shuffle` (`js/sp_lev.js`) | `partial` | Tutorial default shim improved replay but not complete (#13). |

### B) Monster Movement + Pet AI

| C Function(s) | JS Function(s) | Status | Notes |
| --- | --- | --- | --- |
| `movemon` (`monmove.c`) | `movemon` (`js/monmove.js`) | `partial` | Main movement loop exists; gameplay drift remains (#11). |
| `dochug` (`monmove.c`) | `dochug` (`js/monmove.js`) | `partial` | Conditional flow ported incrementally; still not fully aligned in affected sessions (#11). |
| `m_move`, `mfndpos`, `m_search_items` (`monmove.c`) | `m_move`, `mfndpos` and item-search path (`js/monmove.js`) | `partial` | Position/glyph side effects still diverge (#11). |
| `dog_move` (`dogmove.c`) | `dog_move` (`js/monmove.js`) | `partial` | Primary open parity hotspot for RNG + messaging (#8, #11). |
| `dog_invent`, goal selection, ranged-attack path (`dogmove.c`) | `dog_invent`, `best_target`, `pet_ranged_attk` (`js/monmove.js`) | `partial` | Ordering and side-effect parity gaps tracked in #8. |

### C) Monster Generation + Startup

| C Function(s) | JS Function(s) | Status | Notes |
| --- | --- | --- | --- |
| `makemon`, position selection (`makemon.c`) | `makemon`, `makemon_rnd_goodpos` (`js/makemon.js`) | `partial` | Core path present; startup/equipment ordering still diverges (#10). |
| `mkclass`, `rndmonst`, `rndmonst_adj` (`makemon.c`) | `mkclass`, `rndmonst_adj` (`js/makemon.js`) | `partial` | Implemented with C refs; affected by broader generation ordering issues (#10). |
| `newmonhp`, `m_initweap`, `m_initinv`, `peace_minded` (`makemon.c`) | `newmonhp`, `m_initweap`, `m_initinv`, `peace_minded` (`js/makemon.js`) | `partial` | `m_initweap` ordering mismatch explicitly tracked (#10). |
| `makedog`, `u_init` startup logic (`u_init.c`) | `makedog` path + `simulatePostLevelInit` (`js/u_init.js`) | `partial` | Startup parity still coupled to object-generation drift (#10). |

### D) Object Generation + Naming

| C Function(s) | JS Function(s) | Status | Notes |
| --- | --- | --- | --- |
| `mkobj`, `mksobj`, `mksobj_init` (`mkobj.c`) | `mkobj`, `mksobj`, `mksobj_init` path (`js/mkobj.js`) | `partial` | Active RNG-order divergence in startup/wizard sessions (#10). |
| `set_corpsenm`, `mkcorpstat`, corpse timeout paths (`mkobj.c`) | `set_corpsenm`, `mkcorpstat`, `start_corpse_timeout_rng` (`js/mkobj.js`) | `partial` | Implemented; still part of object-order audit (#10). |
| `doname`/`xname` naming paths (`objnam.c`) | `doname` naming stack (`js/mkobj.js`) | `partial` | Naming generally implemented; parity work focuses on generation order first. |
| `init_objects` and object shuffle (`o_init.c`) | `init_objects` (`js/o_init.js`) | `partial` | Used in startup parity; monitor with object-generation tracker (#10). |

### E) Combat + Experience

| C Function(s) | JS Function(s) | Status | Notes |
| --- | --- | --- | --- |
| Hero attack path (`uhitm.c`) | `playerAttackMonster` (`js/combat.js`) | `partial` | Hit/miss, passive probes, and kill side effects still under parity work (#8, #11). |
| Monster attack path (`mhitu.c`) | `monsterAttackPlayer` (`js/combat.js`) | `partial` | Message sequencing and side effects still divergent in mixed combat traces (#8). |
| XP + level-up (`exper.c`) | `checkLevelUp` and XP updates (`js/combat.js`) | `partial` | Functional but still coupled to combat parity closure. |

### F) Command Flow + Turn Loop

| C Function(s) | JS Function(s) | Status | Notes |
| --- | --- | --- | --- |
| `rhack` (`cmd.c`) | `rhack` (`js/commands.js`) | `partial` | Direction prompt/modal cancellation mismatch tracked in #6. |
| Core movement/action dispatch (`hack.c`, `do.c`) | `handleMovement`, `handleDownstairs`, `handleUpstairs`, `handleOpen`, `handleClose` (`js/commands.js`) | `partial` | Counted no-op and prompt interactions still diverge (#6, #7). |
| Pickup/search/read command paths (`pickup.c`, `invent.c`, `read.c`, `do.c`) | `handlePickup`, `dosearch0`, `handleRead` (`js/commands.js`) | `partial` | Wait/search safety timing mismatch tracked in #7. |
| `moveloop_core` turn sequencing (`allmain.c`) | `processTurnEnd` / `simulateTurnEnd` (`js/nethack.js`, `js/headless_runtime.js`) | `partial` | Turn loop exists; downstream divergence depends on command/AI parity gaps. |

## PRNG Timing Parity (#143)

PRNG calls must happen at the same step as C. Screen parity forces this for
99%+ of calls. Calls may happen *later* only for invisible state; calls must
**never** happen *earlier* (always a bug). See [DECISIONS.md — Decision 13](DECISIONS.md#decision-13-prng-timing-parity).

**Diagnostic tool:** `node test/comparison/rng_shift_analysis.js` identifies
time-shifts (extra/missing calls) vs value diffs across sessions, and ranks
functions by shift frequency. Use this to find the highest-impact code paths.

**Shift categories:**
- **JS extra** → premature/misplaced JS computation (always a bug)
- **C extra** → missing JS implementation (expected during porting)
- **Value diff** → accumulated drift from earlier shifts (fix earliest shift first)

## Active Priority Queue (Issue-Driven)

1. #13 tutorial strict replay after first `nhl_random` divergence.
2. #9 special-level generation parity (`dig_corridor`/`somex`/`makelevel`).
3. #8 pet combat + dog movement sequencing/messaging.
4. #10 object-generation RNG ordering (`mkobj`/`mksobj`/`rnd_attr`/`m_initweap`).
5. #11 gameplay glyph/map drift tied to movement interaction state.
6. #6 command-flow modal/direction cancellation parity.
7. #7 wait/search safety timing parity.

## Update Template

When adding a new correspondence row, include:

- C file + function name
- JS file + function name
- Status (`ported`/`partial`/`unstarted`)
- Evidence: issue number and/or exact test command used
