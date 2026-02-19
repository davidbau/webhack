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
| `[~]` | dog.c | dog.js | Pet behavior |
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
| `[a]` | mon.c | mon.js | Monster lifecycle: movemon, mfndpos, mm_aggression, corpse_chance, passivemm, hider premove |
| `[a]` | mondata.c | mondata.js | Monster data queries: predicates, mon_knows_traps, passes_bars |
| `[a]` | monmove.c | monmove.js | Monster movement: dochug, m_move, m_move_aggress, set_apparxy, m_search_items |
| `[ ]` | monst.c | — | Monster data tables. JS: `monsters.js` |
| `[ ]` | mplayer.c | — | Player-like monster generation |
| `[a]` | mthrowu.c | mthrowu.js | Monster ranged attacks: m_throw, thrwmu, lined_up, select_rwep, monmulti |
| `[ ]` | muse.c | — | Monster item usage AI |
| `[ ]` | music.c | — | Musical instruments |
| `[~]` | nhlobj.c | — | Lua object utilities (place, container ops). JS: in `sp_lev.js` |
| `[~]` | nhlsel.c | — | Lua selection bindings (wrap selvar.c). JS: in `sp_lev.js` |
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
| `[~]` | rip.c | display.js | RIP screen. `genl_outrip` in display.js:1131, should extract to rip.js |
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
- **N/A (system/platform)**: 19
- **Game logic files**: 110
- **Complete (`[x]`)**: 4
- **Aligned (`[a]`)**: 14
- **Present (`[p]`)**: 1
- **Needs alignment (`[~]`)**: 16
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


