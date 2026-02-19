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
| `[a]` | dogmove.c | dogmove.js | Pet movement AI. All functions except `quickmimic` |
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
| `[~]` | symbols.c | symbols.js | Symbol/glyph definitions |
| `[N/A]` | sys.c | — | System-level interface |
| `[ ]` | teleport.c | — | Teleportation |
| `[ ]` | timeout.c | — | Timer-based effects |
| `[~]` | topten.c | topten.js | High score table |
| `[p]` | track.c | track.js | Player tracking for pets. save/rest not yet implemented |
| `[a]` | trap.c | trap.js | Trap mechanics: m_harmless_trap, floor_trigger, mintrap_postmove, mon_check_in_air |
| `[~]` | u_init.c | u_init.js | Player initialization |
| `[ ]` | uhitm.c | — | Player-vs-monster combat. JS: partially in `combat.js` |
| `[N/A]` | utf8map.c | — | UTF-8 glyph mapping for terminal |
| `[ ]` | vault.c | — | Vault guard behavior |
| `[N/A]` | version.c | — | Version info |
| `[~]` | vision.c | vision.js | Field of view / line of sight |
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
- **N/A (system/platform)**: 18
- **Game logic files**: 111
- **Complete (`[x]`)**: 4
- **Aligned (`[a]`)**: 9
- **Present (`[p]`)**: 1
- **Needs alignment (`[~]`)**: 21
- **No JS file yet (`[ ]`)**: 76

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
