// wizcmds.js -- Wizard-mode debug commands and sanity checks
// cf. wizcmds.c — wiz_wish, wiz_identify, wiz_makemap, wiz_map, wiz_genesis,
//                 wiz_where, wiz_detect, wiz_kill, wiz_load_lua, wiz_load_splua,
//                 wiz_level_tele, wiz_flip_level, wiz_level_change,
//                 wiz_telekinesis, wiz_panic, wiz_fuzzer, wiz_polyself,
//                 wiz_show_seenv, wiz_show_vision, wiz_show_wmodes,
//                 wiz_smell, wiz_intrinsic, wiz_rumor_check, wiz_show_stats,
//                 wiz_display_macros, wiz_mon_diff, wiz_migrate_mons,
//                 wiz_custom, wiz_timeout_queue (in timeout.c),
//                 sanity_check, you_sanity_check, levl_sanity_check,
//                 and static helpers
//
// Wizard mode provides debug-only commands (accessed via ^W prefix in NetHack).
// These commands are keyed in cmd.c and dispatched to wizcmds.c functions.
//
// JS implementations: several wizard debug commands are implemented in commands.js
//   as part of the game's wizard/debug mode support:
//   wiz_level_change() → commands.js:4750 (wizLevelChange) [PARTIAL]
//   wiz_map()          → commands.js:4776 (wizMap) [PARTIAL]
//   wiz_teleport()     → commands.js:4801 (wizTeleport) [PARTIAL]
//   wiz_genesis()      → commands.js:4863 (wizGenesis) [PARTIAL]
//   wiz_wish()         → commands.js (handleWizWish) [PARTIAL]
//   wiz_identify()     → commands.js (handleWizIdentify) [PARTIAL]
// Sanity checks, Lua-based commands, and advanced debug commands → not implemented.
//
// Note: wiz_load_lua/wiz_load_splua use the Lua interpreter (N/A for browser port).

// cf. wizcmds.c:32 — wiz_wish(): unlimited wishes for debug mode
// Asks for a wish via askfor_menu or getlin; processes via makewish().
// JS equiv: commands.js (handleWizWish) — partial wish granting.
// PARTIAL: wizcmds.c:32 — wiz_wish() ↔ handleWizWish (commands.js)

// cf. wizcmds.c:50 — wiz_identify(): reveal and identify hero's inventory
// Presents menu of items; calls makeknown/fully_identified for selected ones.
// JS equiv: commands.js (handleWizIdentify) — partial identification.
// PARTIAL: wizcmds.c:50 — wiz_identify() ↔ handleWizIdentify (commands.js)

// cf. wizcmds.c:73 [static] — makemap_unmakemon(mtmp, migratory): remove monster for regen
// Removes monster from level before discarding the old level incarnation.
// TODO: wizcmds.c:73 — makemap_unmakemon(): pre-regen monster removal

// cf. wizcmds.c:110 [static] — makemap_remove_mons(): remove all monsters for level regen
// Calls makemap_unmakemon on all active monsters.
// TODO: wizcmds.c:110 — makemap_remove_mons(): clear all monsters for regen

// cf. wizcmds.c:156 — wiz_makemap(): discard and regenerate current dungeon level
// Removes all monsters and objects; calls mklev() to create a fresh level.
// TODO: wizcmds.c:156 — wiz_makemap(): regenerate current level

// cf. wizcmds.c:176 — wiz_map(): reveal level map, traps, and engravings
// Sets seenv=full on all cells; calls do_mapping() equivalent.
// JS equiv: commands.js:4776 (wizMap) — reveals map via seenv, rerenders.
// PARTIAL: wizcmds.c:176 — wiz_map() ↔ wizMap (commands.js:4776)

// cf. wizcmds.c:203 — wiz_genesis(): generate monster(s) at hero's location
// Calls makemon() at hero position; respects count prefix for quantity.
// JS equiv: commands.js:4863 (wizGenesis) — partial monster creation.
// PARTIAL: wizcmds.c:203 — wiz_genesis() ↔ wizGenesis (commands.js:4863)

// cf. wizcmds.c:218 — wiz_where(): display dungeon layout
// Prints level number, branch, depth; lists nearby stairs and shops.
// TODO: wizcmds.c:218 — wiz_where(): dungeon location display

// cf. wizcmds.c:229 — wiz_detect(): detect secret doors, traps, hidden monsters
// Reveals all hidden features; prints count of found items.
// TODO: wizcmds.c:229 — wiz_detect(): wizard detection command

// cf. wizcmds.c:243 — wiz_kill(): pick targets and reduce HP to 0
// Presents targeting cursor; allows killing hero or monsters.
// TODO: wizcmds.c:243 — wiz_kill(): wizard kill command

// cf. wizcmds.c:353 — wiz_load_lua(): load arbitrary Lua file in sandbox
// Opens file dialog; loads Lua code via nhl_init with sandbox restrictions.
// N/A: browser port has no Lua interpreter.
// N/A: wizcmds.c:353 — wiz_load_lua() (Lua interpreter not available)

// cf. wizcmds.c:376 — wiz_load_splua(): load special-level Lua file
// Loads and executes a special-level definition Lua file via sp_lev interpreter.
// N/A: browser port has no Lua interpreter.
// N/A: wizcmds.c:376 — wiz_load_splua() (Lua interpreter not available)

// cf. wizcmds.c:399 — wiz_level_tele(): level teleportation wizard command
// Wrapper that calls level_tele(); returns ECMD_OK (time consumed).
// JS equiv: commands.js:4750 (wizLevelChange) — prompts for level number.
// PARTIAL: wizcmds.c:399 — wiz_level_tele() ↔ wizLevelChange (commands.js:4750)

// cf. wizcmds.c:412 — wiz_flip_level(): transpose current level
// Flips level vertically, horizontally, or randomly; adjusts all coordinates.
// TODO: wizcmds.c:412 — wiz_flip_level(): level transpose/mirror

// cf. wizcmds.c:446 — wiz_level_change(): adjust hero experience level
// Asks for target level; calls pluslvl() or losexp() to reach it.
// JS equiv: commands.js:4750 (wizLevelChange) — currently handles dungeon level,
//   not XL; full XL adjustment TODO.
// PARTIAL: wizcmds.c:446 — wiz_level_change() ↔ wizLevelChange (commands.js:4750)

// cf. wizcmds.c:494 — wiz_telekinesis(): pick monster to hurtle in a direction
// Interactive getpos(); applies hurl effect on target monster.
// TODO: wizcmds.c:494 — wiz_telekinesis(): wizard hurtle command

// cf. wizcmds.c:534 — wiz_panic(): test program panic handling
// Asks for confirmation; calls panic() to test crash handling.
// TODO: wizcmds.c:534 — wiz_panic(): panic test command

// cf. wizcmds.c:549 — wiz_fuzzer(): start fuzz testing mode
// Enables random keypress execution for automated testing.
// TODO: wizcmds.c:549 — wiz_fuzzer(): fuzz test mode

// cf. wizcmds.c:568 — wiz_polyself(): change hero's form
// Calls polyself() interactively for wizard testing.
// TODO: wizcmds.c:568 — wiz_polyself(): wizard polyself command

// cf. wizcmds.c:576 — wiz_show_seenv(): display seenv values in hex
// Shows per-cell seenv visibility tracking values as hex grid.
// TODO: wizcmds.c:576 — wiz_show_seenv(): seenv debug display

// cf. wizcmds.c:621 — wiz_show_vision(): display vision array flags
// Shows per-cell vision flags (could_see, in_sight, etc.) as grid.
// TODO: wizcmds.c:621 — wiz_show_vision(): vision array debug display

// cf. wizcmds.c:657 — wiz_show_wmodes(): display wall mode values
// Shows per-cell wall drawing mode values (bitmask for connected walls).
// TODO: wizcmds.c:657 — wiz_show_wmodes(): wall mode debug display

// cf. wizcmds.c:693 [static] — wiz_map_levltyp(): internal terrain type as base-36 grid
// Displays levl[][].typ values in base-36 encoding for wizard inspection.
// TODO: wizcmds.c:693 — wiz_map_levltyp(): terrain type debug map

// cf. wizcmds.c:841 [static] — wiz_levltyp_legend(): legend for wiz_map_levltyp()
// Prints explanation of base-36 terrain type encoding.
// TODO: wizcmds.c:841 — wiz_levltyp_legend(): terrain type legend

// cf. wizcmds.c:885 — wiz_smell(): test monster smell detection
// Allows wizard to smell a specific monster via usmellmon().
// TODO: wizcmds.c:885 — wiz_smell(): smell debug command

// cf. wizcmds.c:949 — wiz_intrinsic(): set intrinsics interactively
// Menu-driven interface to toggle player intrinsics for testing.
// TODO: wizcmds.c:949 — wiz_intrinsic(): intrinsic toggling

// cf. wizcmds.c:1102 — wiz_rumor_check(): verify all rumor file access
// Tests that each rumor can be retrieved without error.
// TODO: wizcmds.c:1102 — wiz_rumor_check(): rumor file integrity check

// cf. wizcmds.c:1117 [static] — size_obj(otmp): calculate object memory size
// Returns byte size of object struct including extensions.
// TODO: wizcmds.c:1117 — size_obj(): object memory size calculation

// cf. wizcmds.c:1135 [static] — count_obj(chain, total_count, total_size, top, recurse)
// Recursively counts objects and calculates total size for stat display.
// TODO: wizcmds.c:1135 — count_obj(): object chain statistics

// cf. wizcmds.c:1156 [static] — obj_chain(win, src, chain, force, total_count, total_size)
// Displays object chain statistics to wizard window.
// TODO: wizcmds.c:1156 — obj_chain(): object chain stat display

// cf. wizcmds.c:1177 [static] — mon_invent_chain(win, src, chain, total_count, total_size)
// Displays monster inventory chain statistics.
// TODO: wizcmds.c:1177 — mon_invent_chain(): monster inventory stat display

// cf. wizcmds.c:1199 [static] — contained_stats(win, src, total_count, total_size)
// Displays nested container object statistics.
// TODO: wizcmds.c:1199 — contained_stats(): container object stats

// cf. wizcmds.c:1228 [static] — size_monst(mtmp, incl_wsegs): monster memory size
// Returns byte size of monster struct including worm segments if applicable.
// TODO: wizcmds.c:1228 — size_monst(): monster memory size

// cf. wizcmds.c:1257 [static] — mon_chain(win, src, chain, force, total_count, total_size)
// Displays monster chain statistics to wizard window.
// TODO: wizcmds.c:1257 — mon_chain(): monster chain stat display

// cf. wizcmds.c:1284 [static] — misc_stats(win, total_count, total_size)
// Displays miscellaneous stats: traps, engravings, timers, regions.
// TODO: wizcmds.c:1284 — misc_stats(): miscellaneous memory stats

// cf. wizcmds.c:1402 [static] — you_sanity_check(): sanity check hero state
// Validates hero position, inventory, and attribute consistency.
// Called by sanity_check().
// TODO: wizcmds.c:1402 — you_sanity_check(): hero sanity check

// cf. wizcmds.c:1444 [static] — levl_sanity_check(): level vision consistency check
// Validates that vision blocking flags match terrain types.
// Called by sanity_check().
// TODO: wizcmds.c:1444 — levl_sanity_check(): level terrain sanity check

// cf. wizcmds.c:1460 — sanity_check(): master sanity check
// Calls you_sanity_check, levl_sanity_check, and timer_sanity_check.
// Called periodically in debug builds.
// TODO: wizcmds.c:1460 — sanity_check(): master sanity check

// cf. wizcmds.c:1485 [static] — migrsort_cmp(vptr1, vptr2): qsort for migrating monsters
// Comparison function by dungeon level for migrating monster sort.
// TODO: wizcmds.c:1485 — migrsort_cmp(): migrating monster sort comparator

// cf. wizcmds.c:1506 [static] — list_migrating_mons(nextlevl): display migrating monsters
// Shows count and details of monsters in transit to the next level.
// TODO: wizcmds.c:1506 — list_migrating_mons(): migrating monster listing

// cf. wizcmds.c:1616 — wiz_show_stats(): display all monster and object memory usage
// Opens a window; calls obj_chain, mon_chain, misc_stats to build report.
// TODO: wizcmds.c:1616 — wiz_show_stats(): memory usage report

// cf. wizcmds.c:1705 — wiz_display_macros(): verify display macro sanity (debug build)
// Tests that display macros return valid glyph indices.
// TODO: wizcmds.c:1705 — wiz_display_macros(): display macro validation

// cf. wizcmds.c:1784 — wiz_mon_diff(): review monster difficulty ratings (debug build)
// Displays computed difficulty for all monster types.
// TODO: wizcmds.c:1784 — wiz_mon_diff(): monster difficulty review

// cf. wizcmds.c:1827 — wiz_migrate_mons(): display/test migrating monsters
// Shows migrating monster list; calls list_migrating_mons().
// TODO: wizcmds.c:1827 — wiz_migrate_mons(): migrating monster debug display

// cf. wizcmds.c:1885 — wiz_custom(): display glyph map customizations
// Shows all glyph customizations currently applied via wizcustom_callback().
// TODO: wizcmds.c:1885 — wiz_custom(): glyph customization display

// cf. wizcmds.c:1938 — wizcustom_callback(win, glyphnum, id): glyph customization callback
// Callback for each glyph in wizcustom display; shows customization details.
// TODO: wizcmds.c:1938 — wizcustom_callback(): glyph detail display callback
