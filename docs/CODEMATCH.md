# Code Match: NetHack C to JS Correspondence

This document tracks the mapping between NetHack C source files (`nethack-c/src/*.c`)
and corresponding JavaScript files (`js/*.js`) in this JS port.

**See also:** [C_PARITY_WORKLIST.md](C_PARITY_WORKLIST.md) tracks active parity
debugging by domain (which functions are diverging and which issues track them).
This document tracks structural coverage (which C files/functions have JS counterparts).

**Goal**: Every C file containing game logic should have a corresponding JS file with
the same name, and every function in the C file should have a corresponding function
with the same name in the JS file (where applicable).

**Status legend**:
- `[ ]` No JS file yet
- `[~]` JS file exists but needs alignment (function names/structure don't match C)
- `[a]` Aligned — JS file matches C naming, but some functions not yet implemented
- `[p]` Present — all functions exist, some with partial implementations
- `[x]` Complete — all functions fully implemented at parity
- `[N/A]` Not applicable (system/platform code with no JS equivalent)

**Note on .h files**: C header files define types, constants, and function prototypes.
In JS, these are handled by module exports. Constants and data structures from headers
are documented in the corresponding .js file rather than in separate files.

**Note on .lua files**: NetHack uses Lua for special level definitions. The JS port
handles these via `js/levels/` and `js/special_levels.js`. These are data-driven and
don't follow the same 1:1 C→JS mapping pattern.

---

## C Source Files

### Game Core

| Status | C File | JS File | Notes |
|--------|--------|---------|-------|
| `[ ]` | allmain.c | — | Main game loop, newgame, moveloop. JS: split across `nethack.js`, `menace.js` |
| `[N/A]` | alloc.c | — | Memory allocation (nhalloc, nhfree). JS uses GC |
| `[ ]` | apply.c | — | Applying items (doapply, dojump, dorub). JS: partially in `commands.js` |
| `[ ]` | artifact.c | — | Artifact creation and effects |
| `[ ]` | attrib.c | — | Attribute system. JS: partially in `attrib_exercise.js` |
| `[ ]` | ball.c | — | Ball & chain handling |
| `[~]` | bones.c | bones.js | Bones file save/load |
| `[ ]` | botl.c | — | Bottom status line |
| `[x]` | calendar.c | calendar.js | Time, moon phase, Friday 13th, night/midnight. Affects gameplay |
| `[N/A]` | cfgfiles.c | — | Config file parsing. JS: `storage.js` handles config differently |
| `[ ]` | cmd.c | — | Command dispatch. JS: `commands.js`, `input.js` |
| `[N/A]` | coloratt.c | — | Terminal color attribute mapping |
| `[N/A]` | date.c | — | Build date/version stamps |
| `[ ]` | dbridge.c | — | Drawbridge mechanics |
| `[ ]` | decl.c | — | Global variable declarations. JS: spread across modules |
| `[ ]` | detect.c | — | Detection spells and scrolls |
| `[ ]` | dig.c | — | Digging mechanics |
| `[~]` | display.c | display.js | Display/rendering. JS file exists but may diverge |
| `[N/A]` | dlb.c | — | Data librarian (file bundling). Not needed in JS |
| `[ ]` | do.c | — | Miscellaneous actions (drop, down, up) |
| `[ ]` | do_name.c | — | Naming things (docallcmd, do_mgivenname) |
| `[ ]` | do_wear.c | — | Wearing/removing armor and accessories |
| `[~]` | dog.c | dog.js | Pet behavior |
| `[ ]` | dogmove.c | — | Pet movement AI. JS: partially in `monmove.js` |
| `[ ]` | dokick.c | — | Kicking mechanics |
| `[ ]` | dothrow.c | — | Throwing mechanics |
| `[ ]` | drawing.c | — | Symbol/glyph drawing tables. JS: `symbols.js` |
| `[~]` | dungeon.c | dungeon.js | Dungeon structure and level management |
| `[ ]` | eat.c | — | Eating mechanics |
| `[ ]` | end.c | — | Game over, death, scoring |
| `[ ]` | engrave.c | — | Engraving mechanics. JS: `engrave_data.js` is data only |
| `[ ]` | exper.c | — | Experience and leveling |
| `[ ]` | explode.c | — | Explosion effects |
| `[ ]` | extralev.c | — | Special level generation helpers |
| `[N/A]` | files.c | — | File I/O operations. JS: `storage.js` |
| `[ ]` | fountain.c | — | Fountain effects |
| `[ ]` | getpos.c | — | Position selection UI |
| `[ ]` | glyphs.c | — | Glyph system. JS: partially in `display.js`, `symbols.js` |
| `[~]` | hack.c | — | Core movement and actions. JS: split across multiple files |
| `[~]` | hacklib.c | hacklib.js | Utility functions |
| `[ ]` | iactions.c | — | Implicit actions |
| `[ ]` | insight.c | — | Player knowledge/enlightenment |
| `[ ]` | invent.c | — | Inventory management |
| `[x]` | isaac64.c | isaac64.js | ISAAC64 PRNG. All 8 functions matched |
| `[ ]` | light.c | — | Light source management |
| `[ ]` | lock.c | — | Lock picking and door opening |
| `[N/A]` | mail.c | — | In-game mail system (uses real mail on Unix) |
| `[~]` | makemon.c | makemon.js | Monster creation |
| `[ ]` | mcastu.c | — | Monster spellcasting |
| `[N/A]` | mdlib.c | — | Metadata library utilities |
| `[ ]` | mhitm.c | — | Monster-vs-monster combat |
| `[ ]` | mhitu.c | — | Monster-vs-player combat. JS: partially in `combat.js` |
| `[ ]` | minion.c | — | Minion summoning (angels, demons) |
| `[ ]` | mklev.c | — | Level generation. JS: partially in `sp_lev.js`, `map.js` |
| `[ ]` | mkmap.c | — | Map generation algorithms. JS: in `sp_lev.js` |
| `[ ]` | mkmaze.c | — | Maze generation |
| `[~]` | mkobj.c | mkobj.js | Object creation |
| `[ ]` | mkroom.c | — | Room generation. JS: partially in `sp_lev.js` |
| `[ ]` | mon.c | — | Monster management (big file: damage, death, etc.) |
| `[~]` | mondata.c | mondata.js | Monster data queries (flags, predicates) |
| `[~]` | monmove.c | monmove.js | Monster movement |
| `[ ]` | monst.c | — | Monster data tables. JS: `monsters.js` |
| `[ ]` | mplayer.c | — | Player-like monster generation |
| `[ ]` | mthrowu.c | — | Monster ranged attacks. JS: partially in `monmove.js` |
| `[ ]` | muse.c | — | Monster item usage AI |
| `[ ]` | music.c | — | Musical instruments |
| `[~]` | nhlobj.c | — | Lua object utilities (place, container ops). JS: in `sp_lev.js` |
| `[~]` | nhlsel.c | — | Lua selection bindings (wrap selvar.c). JS: in `sp_lev.js` |
| `[N/A]` | nhlua.c | — | Lua interpreter integration |
| `[N/A]` | nhmd4.c | — | MD4 hash implementation |
| `[~]` | o_init.c | o_init.js | Object class initialization |
| `[ ]` | objects.c | — | Object data tables. JS: `objects.js` (data), `objdata.js` (queries) |
| `[ ]` | objnam.c | — | Object naming (xname, doname). JS: partially in `mkobj.js` |
| `[ ]` | options.c | — | Game options. JS: `options_menu.js`, `storage.js` |
| `[~]` | pager.c | pager.js | Help and look commands |
| `[ ]` | pickup.c | — | Picking up items |
| `[ ]` | pline.c | — | Message output (pline, You, etc.) |
| `[ ]` | polyself.c | — | Polymorphing |
| `[ ]` | potion.c | — | Potion effects |
| `[ ]` | pray.c | — | Prayer mechanics |
| `[ ]` | priest.c | — | Priest behavior |
| `[ ]` | quest.c | — | Quest mechanics |
| `[ ]` | questpgr.c | — | Quest text/pager |
| `[ ]` | read.c | — | Reading scrolls/spellbooks |
| `[x]` | rect.c | rect.js | Rectangle allocation for room placement |
| `[ ]` | region.c | — | Region effects (gas clouds, etc.) |
| `[N/A]` | report.c | — | Bug reporting, panic trace |
| `[ ]` | restore.c | — | Game restore. JS: `storage.js` |
| `[ ]` | rip.c | — | RIP screen |
| `[x]` | rnd.c | rng.js | Random number generation |
| `[ ]` | role.c | — | Role/race/gender selection. JS: `player.js` |
| `[ ]` | rumors.c | — | Rumor system. JS: `rumor_data.js` (data only) |
| `[ ]` | save.c | — | Game save. JS: `storage.js` |
| `[~]` | selvar.c | — | Selection geometry (flood, ellipse, gradient, line). JS: in `sp_lev.js` |
| `[N/A]` | sfbase.c | — | Save file base I/O routines |
| `[N/A]` | sfstruct.c | — | Save file structure definitions |
| `[~]` | shk.c | — | Shopkeeper behavior. JS: partially in `shknam.js` |
| `[~]` | shknam.c | shknam.js | Shop naming and stocking |
| `[ ]` | sit.c | — | Sitting on things |
| `[ ]` | sounds.c | — | Monster sounds |
| `[~]` | sp_lev.c | sp_lev.js | Special level interpreter |
| `[ ]` | spell.c | — | Spell casting |
| `[ ]` | stairs.c | — | Stairway management. JS: partially in `level_transition.js` |
| `[ ]` | steal.c | — | Monster stealing |
| `[ ]` | steed.c | — | Riding steeds |
| `[N/A]` | strutil.c | — | String utilities (strbuf, pmatch). JS: native string ops |
| `[~]` | symbols.c | symbols.js | Symbol/glyph definitions |
| `[N/A]` | sys.c | — | System-level interface |
| `[ ]` | teleport.c | — | Teleportation |
| `[ ]` | timeout.c | — | Timer-based effects |
| `[~]` | topten.c | topten.js | High score table |
| `[p]` | track.c | track.js | Player tracking for pets. save/rest not yet implemented |
| `[ ]` | trap.c | — | Trap mechanics |
| `[~]` | u_init.c | u_init.js | Player initialization |
| `[ ]` | uhitm.c | — | Player-vs-monster combat. JS: partially in `combat.js` |
| `[N/A]` | utf8map.c | — | UTF-8 glyph mapping for terminal |
| `[ ]` | vault.c | — | Vault guard behavior |
| `[N/A]` | version.c | — | Version info |
| `[~]` | vision.c | vision.js | Field of view / line of sight |
| `[ ]` | weapon.c | — | Weapon skills |
| `[a]` | were.c | were.js | Lycanthropy. 3 of 8 functions aligned, 5 TODO |
| `[ ]` | wield.c | — | Wielding weapons |
| `[N/A]` | windows.c | — | Windowing system interface. JS: `display.js`, `browser_input.js` |
| `[ ]` | wizard.c | — | Wizard of Yendor AI |
| `[ ]` | wizcmds.c | — | Wizard-mode debug commands |
| `[ ]` | worm.c | — | Long worm mechanics |
| `[ ]` | worn.c | — | Equipment slot management |
| `[ ]` | write.c | — | Writing on scrolls |
| `[~]` | zap.c | zap.js | Wand/spell zapping |

### Summary

- **Total C files**: 129
- **N/A (system/platform)**: 18
- **Game logic files**: 111
- **Complete (`[x]`)**: 1
- **Aligned (`[a]`)**: 1
- **Needs alignment (`[~]`)**: 25
- **No JS file yet (`[ ]`)**: 84

### JS Files Without C Counterparts

These JS files don't directly correspond to a single C file:

| JS File | Purpose | C Counterparts |
|---------|---------|----------------|
| animation_examples.js | Animation demo data | None (JS-only) |
| animations.js | Visual animations | None (JS-only) |
| attrib_exercise.js | Attribute exercise tracking | attrib.c |
| browser_input.js | Browser keyboard/mouse input | None (JS-only) |
| combat.js | Combat mechanics | uhitm.c, mhitu.c, mhitm.c |
| commands.js | Command dispatch | cmd.c, apply.c, do.c, etc. |
| config.js | Game configuration | decl.c, options.c |
| delay.js | Delay/animation timing | None (JS-only) |
| discovery.js | Object identification | o_init.c, invent.c |
| display_rng.js | Display-layer RNG | rnd.c |
| engrave_data.js | Engraving text data | engrave.c |
| epitaph_data.js | Epitaph text data | engrave.c |
| floor_objects.js | Floor object display | pickup.c, invent.c |
| headless_runtime.js | Headless test runtime | None (JS-only) |
| input.js | Input handling/replay | None (JS-only) |
| keylog.js | Keystroke logging | None (JS-only) |
| level_transition.js | Level change logic | do.c, stairs.c |
| map.js | Map data structure | hack.c, mklev.c |
| menace.js | Main game entry point | allmain.c |
| monsters.js | Monster data tables | monst.c |
| nethack.js | Game orchestration | allmain.c |
| objdata.js | Object property queries | objnam.c, mkobj.c |
| options_menu.js | Options UI | options.c |
| player.js | Player state and roles | role.c, decl.c |
| replay_core.js | Session replay/comparison | None (JS-only, test infra) |
| rumor_data.js | Rumor text data | rumors.c |
| special_levels.js | Special level registry | sp_lev.c, extralev.c |
| storage.js | Save/load/config | save.c, restore.c, files.c |
| xoshiro256.js | Xoshiro256 PRNG | None (JS-only, display RNG) |

---

## Function-Level Details

### isaac64.c → isaac64.js

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `lower_bits` | 39 | `lower_bits` | 14 | Match |
| `upper_bits` | 45 | `upper_bits` | 20 | Match |
| `isaac64_update` | 50 | `isaac64_update` | 39 | Match |
| `isaac64_mix` | 103 | `isaac64_mix` | 25 | Match |
| `isaac64_init` | 118 | `isaac64_init` | 111 | Match (exported) |
| `isaac64_reseed` | 124 | `isaac64_reseed` | 126 | Match (exported) |
| `isaac64_next_uint64` | 161 | `isaac64_next_uint64` | 178 | Match (exported) |
| `isaac64_next_uint` | 166 | `isaac64_next_uint` | 184 | Match (exported, added) |

### were.c → were.js

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `were_change` | 9 | `were_change` | 95 | Match (exported, renamed from `runWereTurnEnd`) |
| `counter_were` | 48 | `counter_were` | 17 | Match (exported, renamed from `counterWere`) |
| `were_beastie` | 70 | — | — | TODO |
| `new_were` | 96 | `new_were` | 72 | Match (exported, renamed from `applyWereFormChange`) |
| `were_summon` | 142 | — | — | TODO |
| `you_were` | 192 | — | — | TODO |
| `you_unwere` | 213 | — | — | TODO |
| `set_ulycn` | 232 | — | — | TODO |
