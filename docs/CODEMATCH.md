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
| `[a]` | bones.c | bones.js | Bones file save/load. All 9 functions aligned; 3 static TODO (no_bones_level, goodfruit, fixuporacle) |
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
| `[a]` | dog.c | dog.js | Pet behavior. dogfood in dog.js; makedog/mon_arrive in u_init.js; losedogs/keepdogs/migrate TODO |
| `[a]` | dogmove.c | dogmove.js | Pet movement AI. All functions except `quickmimic` |
| `[ ]` | dokick.c | — | Kicking mechanics |
| `[ ]` | dothrow.c | — | Throwing mechanics |
| `[a]` | drawing.c | symbols.js | Symbol/glyph drawing tables and lookup functions. Data tables in symbols.js; 3 lookup functions implemented |
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
| `[a]` | hacklib.c | hacklib.js | String/char utilities. All C functions implemented; in-place string ops return new strings in JS |
| `[ ]` | iactions.c | — | Implicit actions |
| `[ ]` | insight.c | — | Player knowledge/enlightenment |
| `[ ]` | invent.c | — | Inventory management |
| `[x]` | isaac64.c | isaac64.js | ISAAC64 PRNG. All 8 functions matched |
| `[ ]` | light.c | — | Light source management |
| `[ ]` | lock.c | — | Lock picking and door opening |
| `[N/A]` | mail.c | — | In-game mail system (uses real mail on Unix) |
| `[a]` | makemon.c | makemon.js | Monster creation. Core functions aligned; clone_mon/propagate/mbirth_limit TODO |
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
| `[a]` | mon.c | mon.js | Monster lifecycle: movemon, mfndpos, mm_aggression, corpse_chance, passivemm, hider premove |
| `[a]` | mondata.c | mondata.js | Monster data queries: predicates, mon_knows_traps, passes_bars |
| `[a]` | monmove.c | monmove.js | Monster movement: dochug, m_move, m_move_aggress, set_apparxy, m_search_items |
| `[ ]` | monst.c | — | Monster data tables. JS: `monsters.js` |
| `[ ]` | mplayer.c | — | Player-like monster generation |
| `[a]` | mthrowu.c | mthrowu.js | Monster ranged attacks: m_throw, thrwmu, lined_up, select_rwep, monmulti |
| `[ ]` | muse.c | — | Monster item usage AI |
| `[ ]` | music.c | — | Musical instruments |
| `[N/A]` | nhlobj.c | — | Lua object bindings (l_obj_*). All 21 functions are Lua C API wrappers; JS port uses direct function calls (object(), monster() in sp_lev.js) with no Lua interpreter |
| `[N/A]` | nhlsel.c | — | Lua selection bindings (l_selection_*). All ~40 functions wrap selvar.c for Lua; JS port uses the `selection` object exported from sp_lev.js directly |
| `[N/A]` | nhlua.c | — | Lua interpreter integration |
| `[N/A]` | nhmd4.c | — | MD4 hash implementation |
| `[a]` | o_init.c | o_init.js | Object class initialization. Core shuffle functions aligned; discovery functions in `discovery.js` |
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
| `[a]` | rip.c | display.js | RIP screen. genl_outrip as Display.renderTombstone (method); center() inlined |
| `[x]` | rnd.c | rng.js | Random number generation |
| `[ ]` | role.c | — | Role/race/gender selection. JS: `player.js` |
| `[ ]` | rumors.c | — | Rumor system. JS: `rumor_data.js` (data only) |
| `[ ]` | save.c | — | Game save. JS: `storage.js` |
| `[a]` | selvar.c | — | Selection geometry. JS: `selection` object in `sp_lev.js`. Most geometry functions aligned; ellipse/gradient/is_irregular/size_description not yet implemented |
| `[N/A]` | sfbase.c | — | Save file base I/O routines |
| `[N/A]` | sfstruct.c | — | Save file structure definitions |
| `[~]` | shk.c | — | Shopkeeper behavior. JS: partially in `shknam.js` |
| `[a]` | shknam.c | shknam.js | Shop naming and stocking. All C functions aligned; hallucination in shkname/is_izchak and in_town() in is_izchak deferred |
| `[ ]` | sit.c | — | Sitting on things |
| `[ ]` | sounds.c | — | Monster sounds |
| `[~]` | sp_lev.c | sp_lev.js | Special level interpreter |
| `[ ]` | spell.c | — | Spell casting |
| `[ ]` | stairs.c | — | Stairway management. JS: partially in `level_transition.js` |
| `[ ]` | steal.c | — | Monster stealing |
| `[ ]` | steed.c | — | Riding steeds |
| `[N/A]` | strutil.c | — | String utilities (strbuf, pmatch). JS: native string ops |
| `[N/A]` | symbols.c | — | Terminal graphics mode management (ASCII/IBM/curses/UTF-8 symbol-set switching). Browser port uses static data in symbols.js; no runtime mode switching |
| `[N/A]` | sys.c | — | System-level interface |
| `[ ]` | teleport.c | — | Teleportation |
| `[ ]` | timeout.c | — | Timer-based effects |
| `[a]` | topten.c | topten.js | High score table. observable_depth implemented; I/O funcs N/A; encode/format funcs TODO |
| `[p]` | track.c | track.js | Player tracking for pets. save/rest not yet implemented |
| `[a]` | trap.c | trap.js | Trap mechanics: m_harmless_trap, floor_trigger, mintrap_postmove, mon_check_in_air |
| `[~]` | u_init.c | u_init.js | Player initialization |
| `[ ]` | uhitm.c | — | Player-vs-monster combat. JS: partially in `combat.js` |
| `[N/A]` | utf8map.c | — | UTF-8 glyph mapping for terminal |
| `[ ]` | vault.c | — | Vault guard behavior |
| `[N/A]` | version.c | — | Version info |
| `[a]` | vision.c | vision.js | FOV / LOS. Core algorithm (view_from, right_side, left_side, clear_path, do_clear_area) matches C. block_point/dig_point/rogue_vision TODO |
| `[ ]` | weapon.c | — | Weapon skills |
| `[a]` | were.c | were.js | Lycanthropy. 5 of 8 functions aligned, 3 TODO |
| `[ ]` | wield.c | — | Wielding weapons |
| `[N/A]` | windows.c | — | Windowing system interface. JS: `display.js`, `browser_input.js` |
| `[ ]` | wizard.c | — | Wizard of Yendor AI |
| `[ ]` | wizcmds.c | — | Wizard-mode debug commands |
| `[ ]` | worm.c | — | Long worm mechanics |
| `[ ]` | worn.c | — | Equipment slot management |
| `[a]` | write.c | write.js | Writing on scrolls. cost, write_ok, new_book_description implemented; dowrite TODO |
| `[~]` | zap.c | zap.js | Wand/spell zapping |

### Summary

- **Total C files**: 129
- **N/A (system/platform)**: 21
- **Game logic files**: 108
- **Complete (`[x]`)**: 4
- **Aligned (`[a]`)**: 19
- **Present (`[p]`)**: 1
- **Needs alignment (`[~]`)**: 9
- **No JS file yet (`[ ]`)**: 75

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

### hacklib.c → hacklib.js

Note: C functions that modify strings in-place return new strings in JS (immutable strings).
`xcrypt(str, buf)` in C → `xcrypt(str)` in JS (no output buffer).
`nh_deterministic_qsort` takes a JS array directly rather than raw byte pointer.

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `nh_deterministic_qsort` | 36 | `nh_deterministic_qsort` | 504 | Match (exported; JS array API instead of void*) |
| `digit` | 126 | `digit` | 14 | Match (exported) |
| `letter` | 133 | `letter` | 19 | Match (exported) |
| `highc` | 140 | `highc` | 24 | Match (exported) |
| `lowc` | 147 | `lowc` | 31 | Match (exported) |
| `lcase` | 154 | `lcase` | 44 | Match (exported; returns new string) |
| `ucase` | 166 | `ucase` | 49 | Match (exported; returns new string) |
| `upstart` | 178 | `upstart` | 54 | Match (exported; returns new string) |
| `upwords` | 187 | `upwords` | 60 | Match (exported; returns new string) |
| `mungspaces` | 206 | `mungspaces` | 86 | Match (exported; returns new string) |
| `trimspaces` | 228 | `trimspaces` | 102 | Match (exported; returns new string) |
| `strip_newline` | 244 | `strip_newline` | 107 | Match (exported; returns new string) |
| `eos` | 258 | `eos` | 119 | Match (exported; returns length, not pointer) |
| `c_eos` | 267 | `c_eos` | 124 | Match (exported; returns length, not pointer) |
| `str_start_is` | 277 | `str_start_is` | 134 | Match (exported) |
| `str_end_is` | 305 | `str_end_is` | 141 | Match (exported) |
| `str_lines_maxlen` | 316 | `str_lines_maxlen` | 146 | Match (exported) |
| `strkitten` | 340 | `strkitten` | 162 | Match (exported; returns new string) |
| `copynchars` | 351 | `copynchars` | 168 | Match (exported; no dst arg, returns new string) |
| `chrcasecpy` | 365 | `chrcasecpy` | 177 | Match (exported) |
| `strcasecpy` | 387 | `strcasecpy` | 188 | Match (exported; returns new string) |
| `s_suffix` | 409 | `s_suffix` | 206 | Match (exported) |
| `ing_suffix` | 427 | `ing_suffix` | 215 | Match (exported) |
| `xcrypt` | 464 | `xcrypt` | 326 | Match (exported; JS takes str only, no buf arg) |
| `onlyspace` | 483 | `onlyspace` | 255 | Match (exported) |
| `tabexpand` | 493 | `tabexpand` | 264 | Match (exported; returns new string) |
| `visctrl` | 533 | `visctrl` | 281 | Match (exported; no rotating static buffers needed) |
| `stripchars` | 560 | `stripchars` | 308 | Match (exported; no bp arg, (orig, stuff_to_strip) → new string) |
| `stripdigits` | 584 | `stripdigits` | 317 | Match (exported; returns new string) |
| `strsubst` | 599 | `strsubst` | 329 | Match (exported; returns new string) |
| `strNsubst` | 619 | `strNsubst` | 338 | Match (exported; returns new string; C return count not preserved) |
| `findword` | 663 | `findword` | 369 | Match (exported; returns slice of list from match, or null) |
| `ordin` | 689 | `ordin` | 439 | Match (exported) |
| `sitoa` | 701 | `sitoa` | 446 | Match (exported) |
| `sgn` | 714 | `sgn` | 451 | Match (exported) |
| `distmin` | 720 | `distmin` | 461 | Match (exported) |
| `dist2` | 737 | `dist2` | 467 | Match (exported) |
| `isqrt` | 746 | `isqrt` | 473 | Match (exported; uses Math.sqrt) |
| `online2` | 768 | `online2` | 478 | Match (exported) |
| `strncmpi` | 781 | `strncmpi` | 397 | Match (exported) |
| `strstri` | 803 | `strstri` | 412 | Match (exported; returns slice from match, or null) |
| `fuzzymatch` | 848 | `fuzzymatch` | 419 | Match (exported) |
| `swapbits` | 894 | `swapbits` | 489 | Match (exported) |
| `nh_snprintf` | 917 | — | — | N/A — JS has native string formatting |
| `unicodeval_to_utf8str` | 944 | — | — | N/A — JS handles Unicode natively |
| `case_insensitive_comp` | 986 | — | — | N/A — use strncmpi or toLowerCase() |
| `copy_bytes` | 1004 | — | — | N/A — file I/O not applicable to browser port |
| `datamodel` | 1037 | — | — | N/A — platform data model detection not needed |

### o_init.c → o_init.js (and discovery.js)

The core object-shuffle functions live in `o_init.js` under C-matching names.
Discovery/identification functions split into `discovery.js` (camelCase, noted below).

| C Function | C Line | JS File | JS Function | JS Line | Status |
|------------|--------|---------|-------------|---------|--------|
| `shuffle_tiles` | 34 | — | — | — | N/A — tile graphics not in JS port |
| `setgemprobs` | 53 | — | — | — | TODO — level-depth gem probability init |
| `randomize_gem_colors` | 84 | o_init.js | `randomize_gem_colors` | 79 | Match (private) |
| `shuffle` | 112 | o_init.js | `shuffle` | 107 | Match (private) |
| `init_objects` | 150 | o_init.js | `init_objects` | 204 | Match (exported) |
| `init_oclass_probs` | 239 | objects.js | `initObjectData` | 9183 | Split — merged with `bases[]` init; C ref noted |
| `obj_shuffle_range` | 268 | — | — | — | TODO — needed for wand-direction reveal etc. |
| `shuffle_all` | 321 | o_init.js | `shuffle_all` | 154 | Match (private) |
| `objdescr_is` | 351 | — | — | — | TODO |
| `oinit` | 368 | — | — | — | Subsumed — `init_objects` covers; `setgemprobs` is TODO |
| `savenames` | 374 | discovery.js | `getDiscoveryState` | 163 | Renamed — save/restore via JSON |
| `restnames` | 410 | discovery.js | `setDiscoveryState` | 171 | Renamed — save/restore via JSON |
| `observe_object` | 441 | discovery.js | `observeObject` | 75 | Renamed (camelCase) |
| `discover_object` | 448 | discovery.js | `discoverObject` | 64 | Renamed (camelCase) |
| `undiscover_object` | 492 | — | — | — | TODO |
| `interesting_to_discover` | 520 | discovery.js | `interestingToDiscover` | 82 | Renamed (private, camelCase) |
| `discovered_cmp` | 543 | — | — | — | N/A — JS sort uses closures |
| `sortloot_descr` | 557 | — | — | — | N/A — merged into menu output |
| `choose_disco_sort` | 602 | — | — | — | TODO — sort-order menu not yet implemented |
| `disco_typename` | 652 | discovery.js | `discoveryTypeName` | 88 | Renamed (private) |
| `disco_append_typename` | 684 | — | — | — | Subsumed into `discoveryTypeName` |
| `disco_output_sorted` | 708 | — | — | — | Subsumed into `getDiscoveriesMenuLines` |
| `dodiscovered` | 731 | discovery.js | `getDiscoveriesMenuLines` | 123 | Renamed |
| `oclass_to_name` | 833 | — | — | — | Subsumed into `getDiscoveriesMenuLines` |
| `doclassdisco` | 845 | — | — | — | TODO — class-filtered discoveries command |
| `rename_disco` | 1062 | — | — | — | TODO — rename identified objects |

### were.c → were.js

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `were_change` | 9 | `were_change` | 95 | Match (exported, renamed from `runWereTurnEnd`) |
| `counter_were` | 48 | `counter_were` | 17 | Match (exported, renamed from `counterWere`) |
| `were_beastie` | 70 | `were_beastie` | 36 | Match |
| `new_were` | 96 | `new_were` | 72 | Match (exported, renamed from `applyWereFormChange`) |
| `were_summon` | 142 | — | — | TODO (needs makemon) |
| `you_were` | 192 | — | — | TODO (needs polymon) |
| `you_unwere` | 213 | — | — | TODO (needs rehumanize) |
| `set_ulycn` | 232 | `set_ulycn` | 134 | Match (partial — needs set_uasmon) |

### dogmove.c → dogmove.js

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `dog_nutrition` | 155 | `dog_nutrition` | 114 | Match (internal, moved from dog.js) |
| `dog_eat` | 217 | `dog_eat` | 229 | Match (exported, moved from dog.js) |
| `dog_starve` | 342 | `dog_starve` | 291 | Match (internal) |
| `dog_hunger` | 356 | `dog_hunger` | 311 | Match (internal) |
| `cursed_object_at` | 144 | `cursed_object_at` | 381 | Match (internal) |
| `could_reach_item` | 1353 | `could_reach_item` | 392 | Match (exported) |
| `can_reach_location` | 1371 | `can_reach_location` | 417 | Match (internal) |
| `droppables` | 344 | `droppables` | 443 | Match (internal) |
| `dog_invent` | 392 | `dog_invent` | 525 | Match (internal) |
| `dog_goal` | 500 | (inlined in `dog_move`) | — | Inlined |
| `find_targ` | 654 | `find_targ` | 644 | Match (internal) |
| `find_friends` | 698 | `find_friends` | 676 | Match (internal) |
| `score_targ` | 742 | `score_targ` | 714 | Match (internal) |
| `best_target` | 842 | `best_target` | 775 | Match (internal) |
| `pet_ranged_attk` | 892 | `pet_ranged_attk` | 806 | Match (exported) |
| `dog_move` | 1016 | `dog_move` | 830 | Match (exported) |
| `finish_meating` | 1442 | `finish_meating` | 347 | Match (exported) |
| `mnum_leashable` | 1456 | `mnum_leashable` | 359 | Match (internal) |
| `quickmimic` | 1466 | — | — | TODO (needs mimic appearance system) |
| `max_mon_load` | 1908 | `max_mon_load` | 151 | Match (internal, moved from dog.js) |
| `curr_mon_load` | 1894 | `curr_mon_load` | 173 | Match (internal, moved from dog.js) |
| `can_carry` | 1971 | `can_carry` | 186 | Match (exported, moved from dog.js) |

### write.c → write.js

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `cost` | 14 | `cost` | 30 | Match (private — returns base charge cost for scroll/spellbook) |
| `write_ok` | 61 | `write_ok` | 46 | Match (private — getobj callback) |
| `dowrite` | 74 | `dowrite` | 62 | TODO (needs getobj, getlin, mksobj, useup, and full message system) |
| `new_book_description` | 395 | `new_book_description` | 71 | Match (private — JS returns string directly; no output-buffer argument) |

### bones.c → bones.js

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `no_bones_level` | 18 | — | — | TODO (static — check for special/quest/vibrating/astral levels) |
| `goodfruit` | 42 | — | — | TODO (static — check if fruit id usable on bones level) |
| `resetobjs` | 51 | `resetobjs` | 57 | Match (exported — cancel objects on save, rebuild displayChar on restore) |
| `sanitize_name` | 198 | `sanitize_name` | 193 | Match (exported — renamed from `sanitizeName`) |
| `give_to_nearby_mon` | 226 | `give_to_nearby_mon` | 128 | Match (exported — renamed from `giveToNearbyMon`) |
| `drop_upon_death` | 259 | `drop_upon_death` | 80 | Match (exported — renamed from `dropUponDeath`) |
| `fixuporacle` | 308 | — | — | TODO (static — restore oracle monster after bones load) |
| `can_make_bones` | 356 | `can_make_bones` | 40 | Match (exported — renamed from `canMakeBones`) |
| `remove_mon_from_bones` | 390 | `remove_mon_from_bones` | 172 | Match (exported — renamed from `removeMonFromBones`) |
| `savebones` | 403 | `savebones` | 207 | Match (exported) |
| `getbones` | 629 | `getbones` | 278 | Match (exported) |
| `set_ghostly_objlist` | 751 | `set_ghostly_objlist` | 157 | Match (exported — renamed from `setGhostlyObjlist`) |

### topten.c → topten.js

Notes:
- File I/O functions (readentry, writeentry, writexlentry, discardexcess) are N/A — JS uses localStorage.
- Terminal output functions (topten_print, topten_print_bold, outheader, outentry) are renamed in JS.
- CLI-mode functions (score_wanted, prscore, classmon) are N/A — browser port has no argv mode.
- `topten()` is split across buildEntry + saveScore + loadScores in JS.
- JS-only functions: `loadScores`, `saveScore`, `getPlayerRank`, `capitalize` (localStorage abstraction).

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `formatkiller` | 90 | — | — | TODO (needs killer format constants, an(), and game state svk.killer/gm.multi) |
| `topten_print` | 165 | — | — | N/A (terminal output — no terminal in JS port) |
| `topten_print_bold` | 174 | — | — | N/A (terminal output — no terminal in JS port) |
| `observable_depth` | 183 | `observable_depth` | 129 | Match (exported — endgame depth negative encoding deferred) |
| `discardexcess` | 208 | — | — | N/A (file I/O — JS uses JSON localStorage) |
| `readentry` | 220 | — | — | N/A (file I/O — JS uses `loadScores`) |
| `writeentry` | 301 | — | — | N/A (file I/O — JS uses `saveScore`) |
| `writexlentry` | 340 | — | — | N/A (xlogfile I/O — no xlogfile in browser) |
| `encodexlogflags` | 394 | — | — | TODO (needs wizard/discover/roleplay flags on player object) |
| `encodeconduct` | 411 | — | — | TODO (needs u.uconduct, num_genocides(), sokoban_in_play()) |
| `encodeachieve` | 455 | — | — | TODO (needs u.uachieved achievements array) |
| `add_achieveX` | 480 | — | — | TODO (static helper for encode_extended_achievements) |
| `encode_extended_achievements` | 491 | — | — | TODO (needs u.uachieved) |
| `encode_extended_conducts` | 584 | — | — | TODO (needs u.uconduct) |
| `free_ttlist` | 615 | — | — | N/A (GC handles memory in JS) |
| `topten` | 628 | `buildEntry` + `saveScore` + `loadScores` | 78,44,28 | Split — entry building + localStorage persistence |
| `outheader` | 929 | `formatTopTenHeader` | 115 | Renamed (JS returns string; no terminal I/O) |
| `outentry` | 946 | `formatTopTenEntry` | 105 | Renamed (JS returns lines array; no terminal I/O) |
| `score_wanted` | 1112 | — | — | N/A (CLI score query mode not in browser) |
| `prscore` | 1194 | — | — | N/A (CLI argc/argv scoring mode) |
| `classmon` | 1356 | — | — | N/A (CLI helper for prscore) |

### drawing.c → symbols.js

Notes:
- drawing.c is primarily data tables (defsyms[], def_monsyms[], def_oc_syms[]) embedded in symbols.js.
- Three lookup utility functions are implemented in symbols.js under C-matching names.

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `def_char_to_objclass` | 91 | `def_char_to_objclass` | 997 | Match (exported — searches def_oc_syms[]) |
| `def_char_to_monclass` | 108 | `def_char_to_monclass` | 1005 | Match (exported — searches def_monsyms[]) |
| `def_char_is_furniture` | 120 | `def_char_is_furniture` | 1014 | Match (exported — uses S_upstair..S_fountain constants instead of scanning explanations) |

### symbols.c — N/A

All functions in symbols.c manage runtime terminal graphics mode switching
(ASCII / IBM PC graphics / curses / UTF-8 symbol sets). The browser JS port
uses static symbol data in symbols.js with no mode switching at runtime.

| C Function | C Line | Status |
|------------|--------|--------|
| `init_symbols` | 85 | N/A — symbol data is static in symbols.js |
| `init_showsyms` | 95 | N/A — no showsyms/primary_syms distinction in JS |
| `init_ov_rogue_symbols` | 113 | N/A — no rogue mode in JS |
| `init_ov_primary_symbols` | 122 | N/A — no primary symset in JS |
| `get_othersym` | 131 | N/A — no alternative symbol sets in JS |
| `init_primary_symbols` | 167 | N/A — static data |
| `init_rogue_symbols` | 187 | N/A — no rogue mode in JS |
| `assign_graphics` | 217 | N/A — no terminal graphics mode in JS |
| `switch_symbols` | 253 | N/A — no mode switching in JS |
| `update_ov_primary_symset` | 295 | N/A — no override symbol sets |
| `update_ov_rogue_symset` | 301 | N/A — no rogue symbol set |
| `update_primary_symset` | 307 | N/A — no primary symset |
| `update_rogue_symset` | 313 | N/A — no rogue symbol set |
| `clear_symsetentry` | 319 | N/A — no runtime symbol sets |
| `symset_is_compatible` | 353 | N/A — no symbol set loading |
| `proc_symset_line` | 431 | N/A — no config file parsing |
| `parse_sym_line` | 438 | N/A — no config file parsing |
| `set_symhandling` | 657 | N/A — no terminal handling modes |
| `load_symset` | 673 | N/A — no external symbol files in browser |
| `free_symsets` | 693 | N/A — GC handles memory |
| `savedsym_free` | 712 | N/A — GC handles memory |
| `savedsym_find` | 726 | N/A — no saved symbol overrides |
| `savedsym_add` | 739 | N/A — no saved symbol overrides |
| `savedsym_strbuf` | 757 | N/A — no saved symbol overrides |
| `parsesymbols` | 773 | N/A — no config file option parsing |
| `match_sym` | 852 | N/A — no config file option parsing |
| `do_symset` | 909 | N/A — no interactive options menu in JS |

### rip.c → display.js

Notes:
- rip.c has only 2 functions. `genl_outrip` is implemented as `Display.renderTombstone` (a class method).
- `center()` is a static helper that centers text — inlined in `renderTombstone`.
- The JS implementation correctly renders the tombstone ASCII art (C ref: rip.c rip[] template).

| C Function | C Line | JS Location | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `center` | 75 | — (inlined) | — | Inlined into `Display.renderTombstone` |
| `genl_outrip` | 85 | `Display.renderTombstone` | 1135 | Match (class method; winid/how/when replaced by name/gold/deathLines/year params) |

### dog.c → dog.js (and u_init.js)

Notes:
- `newedog`/`free_edog` are N/A (no edog struct in JS — edog fields set inline on monster).
- `makedog`, `mon_arrive`, `mon_catchup_elapsed_time` are in `u_init.js` (level transition module).
- `dogfood` is in `dog.js` under the C name.
- Many `mondata.h` predicates included in dog.js are from mondata.c (documented separately).
- `losedogs`, `keepdogs`, `migrate_to_level`, `discard_migrations` are partially in `u_init.js` (inlined into mon_arrive).
- JS-only helpers in dog.js: re-exports of dogmove.js functions, mondata predicates.

| C Function | C Line | JS File | JS Function | JS Line | Status |
|------------|--------|---------|-------------|---------|--------|
| `newedog` | 23 | — | — | — | N/A (no edog struct — fields inline on monster object) |
| `free_edog` | 35 | — | — | — | N/A (GC handles memory) |
| `initedog` | 45 | — | — | — | TODO (edog initialization; partially inlined in shkinit/nameshk) |
| `pet_type` | 91 | u_init.js | `pet_type` | 176 | Match (private — in u_init.js where makedog is called) |
| `pick_familiar_pm` | 104 | — | — | — | TODO (wizard familiar selection not yet implemented) |
| `make_familiar` | 138 | — | — | — | TODO (familiar creation for wizard) |
| `makedog` | 219 | u_init.js | `makedog` | 236 | Split (private in u_init.js — pet placed during newgame) |
| `set_mon_lastmove` | 287 | — | — | — | TODO (monster last-move tracking not yet needed) |
| `update_mlstmv` | 295 | — | — | — | TODO (mlstmv update) |
| `losedogs` | 304 | — | — | — | TODO (check for pets lost on level; partially in mon_arrive) |
| `mon_arrive` | 420 | u_init.js | `mon_arrive` | 390 | Split (exported from u_init.js — handles level transition for pets) |
| `mon_catchup_elapsed_time` | 623 | u_init.js | (inlined) | 484 | Split (inlined in mon_arrive — catch-up for time in limbo) |
| `mon_leave` | 725 | — | — | — | TODO (monster leaving level) |
| `keep_mon_accessible` | 764 | — | — | — | TODO (accessibility check for keepdogs) |
| `keepdogs` | 785 | — | — | — | TODO (partially inlined in mon_arrive; full version needed for keep/follow logic) |
| `migrate_to_level` | 883 | — | — | — | TODO (pending migration tracking) |
| `discard_migrations` | 934 | — | — | — | TODO (discard queued migrations) |
| `dogfood` | 991 | dog.js | `dogfood` | 115 | Match (exported) |
| `tamedog` | 1139 | — | — | — | TODO (taming a monster) |
| `wary_dog` | 1288 | — | — | — | TODO (make pet wary after death) |
| `abuse_dog` | 1358 | — | — | — | TODO (abuse pet — decrease tameness) |

### makemon.c → makemon.js

Notes:
- C's `mextra` struct (extra per-monster data) has no JS equivalent; fields are set inline on the monster object.
- `rndmonst()` renamed to `rndmonnum()` in JS (clearer name; wraps `rndmonst_adj(0,0,depth)`).
- JS-only: many `mondata.h` predicates (is_mercenary, is_lord, etc.) included locally. Also: rndmonnum_adj, runtimeDecideToShapeshift, group/newcham helpers.
- `monhp_per_lvl` inlined into `newmonhp` logic (not a separate function).
- Debugging functions (dump_mongen, check_mongen_order, cmp_init_mongen_order) are N/A.

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `is_home_elemental` | 35 | — | — | TODO (elemental home types not yet tracked) |
| `wrong_elem_type` | 58 | — | — | TODO (depends on is_home_elemental) |
| `m_initgrp` | 81 | — | — | TODO (group spawn not yet implemented) |
| `m_initthrow` | 150 | `m_initthrow` | 617 | Match (private) |
| `m_initweap` | 163 | `m_initweap` | 629 | Match (private) |
| `mkmonmoney` | 578 | `mkmonmoney` | 1041 | Match (private) |
| `m_initinv` | 591 | `m_initinv` | 1050 | Match (private) |
| `clone_mon` | 839 | — | — | TODO (needed for level transfer and polymorph) |
| `propagate` | 960 | — | — | TODO (spawning copies of unique monsters) |
| `monhp_per_lvl` | 988 | — | — | Inlined — logic embedded in `newmonhp` |
| `newmonhp` | 1014 | `newmonhp` | 580 | Match (exported) |
| `init_mextra` | 1061 | — | — | N/A (no mextra struct in JS — fields set inline) |
| `newmextra` | 1068 | — | — | N/A (no mextra struct in JS) |
| `makemon_rnd_goodpos` | 1078 | `makemon_rnd_goodpos` | 1548 | Match (private) |
| `makemon` | 1149 | `makemon` | 1648 | Match (exported) |
| `unmakemon` | 1511 | — | — | TODO (remove monster from map; not yet needed) |
| `mbirth_limit` | 1539 | — | — | TODO (birth limit not yet tracked) |
| `create_critters` | 1553 | — | — | TODO (special level monster creation) |
| `uncommon` | 1590 | `uncommon` | 286 | Match (private) |
| `align_shift` | 1608 | `align_shift` | 297 | Match (private) |
| `temperature_shift` | 1638 | `temperature_shift` | 312 | Match (private) |
| `rndmonst` | 1649 | `rndmonnum` | 397 | Renamed (exported; `rndmonnum()` wraps `rndmonst_adj(0,0,depth)`) |
| `rndmonst_adj` | 1656 | `rndmonst_adj` | 317 | Match (exported) |
| `mk_gen_ok` | 1733 | `mk_gen_ok` | 430 | Match (private) |
| `cmp_init_mongen_order` | 1757 | — | — | N/A (JS sort uses closure comparator) |
| `check_mongen_order` | 1778 | — | — | N/A (debugging utility) |
| `init_mongen_order` | 1801 | `init_mongen_order` | 442 | Match (private) |
| `dump_mongen` | 1829 | — | — | N/A (debugging utility) |
| `mkclass` | 1867 | `mkclass` | 483 | Match (exported) |
| `mkclass_aligned` | 1874 | — | — | TODO (alignment-filtered class pick; merged into mkclass atyp param partially) |

### shknam.c → shknam.js

Notes:
- The JS port stores shopkeeper name as `shk.shknam` field (set by `nameshk`); `shk.shoptype` stores shop type.
- `veggy_item(obj, otyp)` simplified to `veggy_item(otyp)` — obj parameter dropped (TIN/CORPSE species not tracked).
- `neweshk`/`free_eshk` are N/A (JS has no struct allocation/deallocation).
- `shkname`/`is_izchak` skip hallucination support (needs game state) and `is_izchak` skips `in_town()` (not yet in JS).
- JS-only functions: `mkmonmoney` (gold helper), `mon_at` (position lookup), `pointInShop`/`monsterInShop` (display helpers).

| C Function | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `init_shop_selection` | 360 | — | — | TODO (not yet needed — no interactive shop selection in JS) |
| `veggy_item` | 380 | `veggy_item` | 305 | Partial (private — obj param dropped; TIN/CORPSE species not checked) |
| `shkveg` | 408 | `shkveg` | 311 | Match (private) |
| `mkveggy_at` | 443 | `mkveggy_at` | 332 | Match (private) |
| `mkshobj_at` | 454 | `mkshobj_at` | 540 | Match (private — extra shpIndex/map/depth params in JS) |
| `nameshk` | 487 | `nameshk` | 431 | Match (private — extra ubirthday/ledgerNo params replace C globals) |
| `neweshk` | 557 | — | — | N/A (no struct allocation in JS — eshk fields set inline on monster object) |
| `free_eshk` | 569 | — | — | N/A (GC handles memory) |
| `good_shopdoor` | 582 | `good_shopdoor` | 345 | Match (private — returns {di,sx,sy} instead of output pointers) |
| `shkinit` | 628 | `shkinit` | 490 | Match (private — extra shp_indx/map/depth/ubirthday/ledgerNo params; stores shk.shoptype) |
| `stock_room_goodpos` | 695 | `stock_room_goodpos` | 389 | Match (private — rmno param dropped, map added) |
| `stock_room` | 718 | `stock_room` | 597 | Match (exported — extra map/depth/ubirthday/ledgerNo params) |
| `saleable` | 805 | `saleable` | 695 | Match (exported — checks shk.shoptype against shop iprobs table) |
| `get_shop_item` | 829 | `get_shop_item` | 288 | Match (exported) |
| `Shknam` | 843 | `Shknam` | 731 | Match (exported — returns upstart(shkname(shk))) |
| `shkname` | 856 | `shkname` | 719 | Match (exported — strips prefix char; hallucination omitted) |
| `shkname_is_pname` | 900 | `shkname_is_pname` | 741 | Match (exported — checks for '-', '+', or '=' prefix) |
| `is_izchak` | 908 | `is_izchak` | 753 | Match (exported — hallucination and in_town() checks omitted) |

### vision.c → vision.js

Notes:
- C's global state (viz_array, viz_clear, left_ptrs, right_ptrs) is encapsulated in the JS `FOV` class.
- Algorithm C quadrant functions (right_side, left_side, view_from, clear_path) match C names.
- JS-only functions: q1_path..q4_path (Bresenham path checks), is_clear_map, clear_path_map.
- C macros `m_cansee`, `couldsee` are ported as exported JS functions.
- `doesBlock` renamed to `does_block` (C: vision.c:153).

| C Function / Concept | C Line | JS Function | JS Line | Status |
|------------|--------|-------------|---------|--------|
| `does_block` | 153 | `does_block` | 40 | Match (private — renamed from `doesBlock`) |
| `vision_init` | 121 | `FOV` constructor | 409 | Encapsulated (FOV class owns vision arrays) |
| `vision_reset` | 211 | `FOV.visionReset` | 420 | Encapsulated (builds viz_clear, left/right ptrs) |
| `get_unused_cs` | 274 | (inlined in `FOV.compute`) | — | Inlined (cs_rows/cs_left/cs_right are module-level) |
| `rogue_vision` | 314 | — | — | TODO (rogue level mode not yet in JS) |
| `new_angle` | 414 | — | — | Inlined (angle logic inside `view_from` scanner) |
| `vision_recalc` | 512 | `FOV.compute` | 474 | Encapsulated (renamed; takes px/py instead of control flag) |
| `block_point` | 854 | — | — | TODO (not yet needed — no dynamic blocking in JS) |
| `unblock_point` | 888 | — | — | TODO (not yet needed) |
| `recalc_block_point` | 900 | — | — | TODO (not yet needed) |
| `dig_point` | 956 | — | — | TODO (digging not yet in JS) |
| `fill_point` | 1040 | — | — | TODO (fill actions not yet in JS) |
| `clear_path` | 1602 | `clear_path` | 176 | Match (exported) |
| `view_init` | 1640 | — | — | Subsumed into `FOV` constructor |
| `right_side` | 1655 | `right_side` | 191 | Match (private) |
| `left_side` | 1847 | `left_side` | 280 | Match (private) |
| `view_from` | 1991 | `view_from` | 362 | Match (private) |
| `do_clear_area` | 2096 | `do_clear_area` | 695 | Match (exported) |
| `howmonseen` | 2141 | — | — | TODO (monster perception flags not yet in JS) |
| `couldsee` (macro) | vision.h | `couldsee` | 665 | Ported as function (exported) |
| `m_cansee` (macro) | vision.h | `m_cansee` | 658 | Ported as function (exported) |


### nhlobj.c — N/A (Lua bindings)

All 21 functions in nhlobj.c are Lua C API wrappers (`l_obj_*` / `nhl_*`). The JS port has no Lua
interpreter; object manipulation is handled by direct JS function calls (`object()`, `monster()`, etc.)
exported from `sp_lev.js`. No function-level mapping exists.

| C Function | Notes |
|---|---|
| `l_obj_check` | Lua type check helper — N/A |
| `l_obj_gc` | Lua GC finalizer — N/A |
| `l_obj_push` | Push obj onto Lua stack — N/A |
| `nhl_push_obj` | Public push (called from nhlua.c) — N/A |
| `nhl_obj_u_giveobj` | Give obj to player via Lua — N/A |
| `l_obj_getcontents` | Iterate container contents — N/A |
| `l_obj_add_to_container` | Place obj into container — N/A |
| `l_obj_objects_to_table` | Serialize obj list to Lua table — N/A |
| `l_obj_to_table` | Serialize single obj to Lua table — N/A |
| `l_obj_new_readobjnam` | Create obj from name string — N/A |
| `l_obj_at` | Get obj at map location — N/A |
| `l_obj_placeobj` | Place obj at coordinates — N/A |
| `l_obj_nextobj` | Iterator: next obj in list — N/A |
| `l_obj_container` | Get containing obj — N/A |
| `l_obj_isnull` | Null check — N/A |
| `l_obj_timer_has` | Check obj timer — N/A |
| `l_obj_timer_peek` | Read obj timer value — N/A |
| `l_obj_timer_stop` | Stop obj timer — N/A |
| `l_obj_timer_start` | Start obj timer — N/A |
| `l_obj_bury` | Bury obj in floor — N/A |
| `l_obj_register` | Register Lua metatable — N/A |

### nhlsel.c — N/A (Lua selection bindings)

All ~40 functions in nhlsel.c are Lua C API wrappers (`l_selection_*`) that expose `selvar.c`
selection geometry to Lua scripts. The JS port uses the `selection` object exported from `sp_lev.js`
directly. See selvar.c section below for the geometry function mapping.

| C Function | Notes |
|---|---|
| `l_selection_check` | Lua type check — N/A |
| `l_selection_push_new` | Lua stack alloc — N/A |
| `l_selection_push_copy` | Lua stack copy — N/A |
| `l_selection_to` | Lua type coerce — N/A |
| `l_selection_gc` | Lua GC finalizer — N/A |
| `l_selection_new` | Wraps `selection_new` → `selection.new()` in JS |
| `l_selection_clone` | Wraps `selection_clone` → N/A in JS (GC, create new) |
| `l_selection_numpoints` | `sel.numpoints()` |
| `l_selection_getpoint` | Access coords array directly in JS |
| `l_selection_setpoint` | `sel.set(x, y)` |
| `l_selection_not` | `sel.negate()` |
| `l_selection_and` | `sel.intersect(other)` |
| `l_selection_or` | `sel.union(other)` |
| `l_selection_xor` | N/A (not yet in JS) |
| `l_selection_sub` | N/A (not yet in JS) |
| `l_selection_filter_percent` | `sel.percentage(pct)` |
| `l_selection_rndcoord` | `sel.rndcoord()` |
| `l_selection_room` | `selection.room()` |
| `l_selection_getbounds` | `sel.bounds()` |
| `params_sel_2coords` | Internal helper — N/A |
| `l_selection_line` | `selection.line(x1, y1, x2, y2)` |
| `l_selection_randline` | `selection.randline(x1, y1, x2, y2, roughness)` |
| `l_selection_rect` | `selection.rect(x1, y1, x2, y2)` |
| `l_selection_fillrect` | `selection.fillrect(x1, y1, x2, y2)` |
| `l_selection_grow` | `sel.grow(iterations)` |
| `l_selection_filter_mapchar` | `sel.filter_mapchar(ch)` |
| `l_selection_match` | `selection.match(pattern)` |
| `l_selection_flood` | `selection.floodfill(x, y, matchFn)` |
| `l_selection_circle` | N/A (not yet in JS) |
| `l_selection_ellipse` | N/A (not yet in JS) |
| `l_selection_gradient` | N/A (not yet in JS) |
| `l_selection_iterate` | `sel.iterate(func)` |
| `l_selection_size_description` | N/A (not yet in JS) |
| `l_selection_ipairs` | Lua ipairs protocol — N/A |
| `l_selection_register` | Lua metatable registration — N/A |

### selvar.c → sp_lev.js (`selection` object)

Selection geometry functions are implemented as methods of the `selection` object exported from
`sp_lev.js` (line 6813). The Lua-specific memory management (`selection_free`, `selection_clear`,
`selection_clone`) is handled by GC. The Lua binding wrapper functions are in nhlsel.c (N/A).

| C Function | C Line | JS Equivalent | JS Line | Notes |
|---|---|---|---|---|
| `selection_new` | 15 | `selection.new()` | 7081 | Match |
| `selection_free` | 33 | N/A | — | GC handles memory |
| `selection_clear` | 48 | N/A | — | GC — create new instead |
| `selection_clone` | 65 | N/A | — | GC — create new and copy |
| `selection_getbounds` | 77 | `sel.bounds()` | 7159 | Match |
| `selection_recalc_bounds` | 99 | N/A | — | Bounds recalculated on demand |
| `selection_getpoint` | 168 | (coords array) | — | Access coords directly |
| `selection_setpoint` | 181 | `sel.set(x, y)` | 7105 | Match |
| `selection_not` | 211 | `sel.negate()` | 7183 | Match (also `selection.negate(sel)` at 7335) |
| `selection_filter_percent` | 224 | `sel.percentage(pct)` | 7121 | Match (also `selection.percentage(sel, pct)` at 7384) |
| `selection_filter_mapchar` | 248 | `sel.filter_mapchar(ch)` | 7176 | Match (also `selection.filter_mapchar(sel, ch)` at 7555) |
| `selection_rndcoord` | 284 | `sel.rndcoord()` | 7131 | Match (also `selection.rndcoord(sel)` at 7241) |
| `selection_do_grow` | 321 | `sel.grow(n)` | 7190 | Match (also `selection.grow(sel, n)` at 7282) |
| `set_selection_floodfillchk` | 372 | N/A | — | JS closures capture matchFn directly |
| `sel_flood_havepoint` | 379 | N/A | — | Internal staticfn helper |
| `selection_floodfill` | 395 | `selection.floodfill(x, y, matchFn)` | 7415 | Match |
| `selection_do_ellipse` | 456 | N/A | — | TODO (not yet in JS) |
| `line_dist_coord` | 542 | N/A | — | Internal helper for gradient |
| `selection_do_gradient` | 570 | N/A | — | TODO (not yet in JS) |
| `selection_do_line` | 626 | `selection.line(x1, y1, x2, y2)` | 6980 | Match (Bresenham) |
| `selection_do_randline` | 683 | `selection.randline(...)` | 7011 | Match |
| `selection_iterate` | 726 | `sel.iterate(func)` | 7149 | Match |
| `selection_is_irregular` | 747 | N/A | — | Not yet in JS |
| `selection_size_description` | 764 | N/A | — | Not yet in JS |
| `selection_from_mkroom` | 781 | `selection.room()` | 6824 | Match (C ref comment present in JS) |
| `selection_force_newsyms` | 802 | N/A | — | Display concern — not needed in JS |

