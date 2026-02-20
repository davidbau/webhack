// mkmaze.js -- Maze generation, wall spine fixing, special level regions, water plane
// cf. mkmaze.c — iswall, iswall_or_stone, is_solid, set_levltyp, set_levltyp_lit,
//                extend_spine, wall_cleanup, fix_wall_spines, wallification,
//                okay, maze0xy, is_exclusion_zone, bad_location, place_lregion,
//                put_lregion_here, baalz_fixup, fixup_special, check_ransacked,
//                migrate_orc, shiny_orc_stuff, migr_booty_item, stolen_booty,
//                maze_inbounds, maze_remove_deadends, create_maze,
//                pick_vibrasquare_location, populate_maze, makemaz,
//                walkfrom, mazexy, bound_digging, mkportal, fumaroles,
//                movebubbles, water_friction, save_waterlevel, restore_waterlevel,
//                set_wportal, setup_waterlevel, unsetup_waterlevel,
//                mk_bubble, maybe_adjust_hero_bubble, mv_bubble
//
// mkmaze.c covers three subsystems:
//   1. Maze generation: makemaz() dispatches; create_maze() carves corridors
//      via walkfrom() (recursive DFS); maze_remove_deadends() optionally
//      fills dead ends; populate_maze() adds monsters/objects.
//   2. Wall processing: wallification() = wall_cleanup() + fix_wall_spines()
//      post-processes all wall cells to set correct wall types for display.
//   3. Water/Air planes: setup_waterlevel() initializes bubble structures;
//      movebubbles() / mv_bubble() animate them per turn.
//   Special: fixup_special() processes LR_TELE/LR_XLEV regions from sp_lev.c;
//      place_lregion()/put_lregion_here() place portals and teleport zones.
//
// JS implementations:
//   wallification()        → dungeon.js:3467 (ALIGNED — full implementation)
//   wall_cleanup()         → dungeon.js:3431 (ALIGNED)
//   fix_wall_spines()      → dungeon.js (ALIGNED — part of wallification)
//   makemaz()              → dungeon.js:1054 (PARTIAL — dispatch + create_maze)
//   create_maze()          → dungeon.js:1214 (PARTIAL — maze carving)
//   maze_remove_deadends() → dungeon.js:1301 (PARTIAL)
//   populate_maze()        → dungeon.js:1172 (PARTIAL)
//   mazexy()               → dungeon.js:1396 (PARTIAL)
//   pick_vibrasquare_location() → dungeon.js:1129 (PARTIAL)
//   place_lregion()        → level_transition.js:50 (PARTIAL)
// Water plane (movebubbles, setup_waterlevel, etc.) → not implemented in JS.
// save_waterlevel/restore_waterlevel → N/A (no save file system).

// cf. mkmaze.c:44 [static] — iswall(x, y): is location a wall type?
// Returns TRUE for VWALL, HWALL, TLCORNER, etc.
// TODO: mkmaze.c:44 — iswall(): wall type check

// cf. mkmaze.c:58 [static] — iswall_or_stone(x, y): is location wall or stone?
// Returns TRUE for iswall(x,y) or STONE type.
// TODO: mkmaze.c:58 — iswall_or_stone(): wall-or-stone check

// cf. mkmaze.c:69 [static] — is_solid(x, y): out of bounds or wall?
// Returns TRUE if !isok(x,y) or iswall_or_stone(x,y).
// TODO: mkmaze.c:69 — is_solid(): solid terrain predicate

// cf. mkmaze.c:76 — set_levltyp(x, y, newtyp): set terrain type with special handling
// Sets levl[x][y].typ; handles special conversion rules (e.g., STONE→CORR clears lit).
// TODO: mkmaze.c:76 — set_levltyp(): terrain type setter

// cf. mkmaze.c:125 — set_levltyp_lit(x, y, typ, lit): set terrain and lit state
// Combines set_levltyp with lit flag assignment.
// TODO: mkmaze.c:125 — set_levltyp_lit(): terrain type and lighting setter

// cf. mkmaze.c:165 [static] — extend_spine(locale, wall_there, dx, dy): wall spine direction
// Determines the correct wall spine extension for connectivity given neighbor map.
// Used by fix_wall_spines().
// TODO: mkmaze.c:165 — extend_spine(): wall spine direction logic

// cf. mkmaze.c:197 — wall_cleanup(x1, y1, x2, y2): remove isolated walls
// Converts isolated wall cells (no corridor neighbors) back to STONE.
// JS equiv: dungeon.js:3431 — wall_cleanup().
// ALIGNED: mkmaze.c:197 — wall_cleanup() ↔ wall_cleanup (dungeon.js:3431)

// cf. mkmaze.c:228 — fix_wall_spines(x1, y1, x2, y2): correct wall types
// Sets VWALL/HWALL/corner types based on neighboring cells.
// JS equiv: dungeon.js (part of wallification).
// ALIGNED: mkmaze.c:228 — fix_wall_spines() ↔ wallification (dungeon.js:3467)

// cf. mkmaze.c:289 — wallification(x1, y1, x2, y2): post-process wall cells
// Calls wall_cleanup() then fix_wall_spines() on bounded region.
// JS equiv: dungeon.js:3467 — wallification().
// ALIGNED: mkmaze.c:289 — wallification() ↔ wallification (dungeon.js:3467)

// cf. mkmaze.c:296 [static] — okay(x, y, dir): valid maze generation direction?
// Checks that 2 steps in direction dir from (x,y) stays in bounds and is STONE.
// TODO: mkmaze.c:296 — okay(): maze carving direction check

// cf. mkmaze.c:308 [static] — maze0xy(cc): find random maze starting point
// Picks random odd-coordinate position in maze for carving start.
// TODO: mkmaze.c:308 — maze0xy(): maze start position

// cf. mkmaze.c:316 [static] — is_exclusion_zone(type, x, y): position in exclusion zone?
// Returns TRUE if (x,y) is in an LR_TELE or LR_XLEV region (no overwriting).
// TODO: mkmaze.c:316 — is_exclusion_zone(): exclusion zone check

// cf. mkmaze.c:340 [static] — bad_location(x, y, nlx, nly, nhx, nhy): unsuitable placement?
// Returns TRUE if (x,y) outside narrow bounds or in exclusion zone.
// TODO: mkmaze.c:340 — bad_location(): placement validity check

// cf. mkmaze.c:355 — place_lregion(lx, ly, hx, hy, nlx, nly, nhx, nhy, rtype, lev)
// Places teleport region/stairs/portal within area [lx..hx, ly..hy].
// JS equiv: level_transition.js:50 (PARTIAL — placement logic).
// PARTIAL: mkmaze.c:355 — place_lregion() ↔ level_transition.js:50

// cf. mkmaze.c:412 [static] — put_lregion_here(x, y, nlx, nly, nhx, nhy, rtype, oneshot, lev)
// Places a single lregion element at (x,y) with given type and destination.
// TODO: mkmaze.c:412 — put_lregion_here(): single lregion element placement

// cf. mkmaze.c:474 — baalz_fixup(): special fixup for Baalzebub's lair level
// Adjusts the lair map for Baalzebub's special level geometry.
// TODO: mkmaze.c:474 — baalz_fixup(): Baalzebub lair fixup

// cf. mkmaze.c:569 — fixup_special(): process special level regions after generation
// Processes LR_TELE/LR_XLEV/portal regions from sp_lev definitions.
// Called after sp_lev level loading.
// TODO: mkmaze.c:569 — fixup_special(): special level region processing

// cf. mkmaze.c:707 [static] — check_ransacked(s): is level ransacked?
// Checks if the orctown/special level has been looted already.
// TODO: mkmaze.c:707 — check_ransacked(): ransack status check

// cf. mkmaze.c:717 [static] — migrate_orc(mtmp, mflags): migrate orc to other level
// Moves an orc from orctown to another level (for ransacking behavior).
// TODO: mkmaze.c:717 — migrate_orc(): orctown orc migration

// cf. mkmaze.c:748 [static] — shiny_orc_stuff(mtmp): give treasure to orc
// Equips an orc with shiny treasure for orctown.
// TODO: mkmaze.c:748 — shiny_orc_stuff(): orc treasure

// cf. mkmaze.c:780 [static] — migr_booty_item(otyp, gang): migrate booty item
// Moves a specific treasure item to another level for orctown ransacking.
// TODO: mkmaze.c:780 — migr_booty_item(): booty item migration

// cf. mkmaze.c:799 [static] — stolen_booty(): create stolen booty from orctown
// Generates orctown loot on another level based on ransack history.
// TODO: mkmaze.c:799 — stolen_booty(): orctown booty generation

// cf. mkmaze.c:894 [static] — maze_inbounds(x, y): position within maze bounds?
// Returns TRUE if (x,y) is within [2..x_maze_max-1, 2..y_maze_max-1].
// TODO: mkmaze.c:894 — maze_inbounds(): maze boundary check

// cf. mkmaze.c:904 — maze_remove_deadends(typ): remove dead ends from maze
// Fills dead-end corridors with terrain type typ (usually STONE or WALL).
// JS equiv: dungeon.js:1301 — maze_remove_deadends().
// PARTIAL: mkmaze.c:904 — maze_remove_deadends() ↔ dungeon.js:1301

// cf. mkmaze.c:950 — create_maze(corrwid, wallthick, rmdeadends): generate maze
// Carves maze corridors from random start via walkfrom(); optional dead-end removal.
// JS equiv: dungeon.js:1214 — create_maze().
// PARTIAL: mkmaze.c:950 — create_maze() ↔ create_maze (dungeon.js:1214)

// cf. mkmaze.c:1042 [static] — pick_vibrasquare_location(): vibrating square location
// Picks random valid location for the Invocation vibrating square.
// JS equiv: dungeon.js:1129 — pick_vibrasquare_location().
// PARTIAL: mkmaze.c:1042 — pick_vibrasquare_location() ↔ dungeon.js:1129

// cf. mkmaze.c:1097 — populate_maze(): add monsters and objects to maze
// Places appropriate monsters, objects, and gold in maze corridors and dead ends.
// JS equiv: dungeon.js:1172 — populate_maze().
// PARTIAL: mkmaze.c:1097 — populate_maze() ↔ populate_maze (dungeon.js:1172)

// cf. mkmaze.c:1127 — makemaz(s): main maze generation dispatcher
// If s non-empty: loads special level from sp_lev; else generates procedural maze.
// Calls create_maze → maze_remove_deadends → populate_maze → fixup_special.
// JS equiv: dungeon.js:1054 — makemaz().
// PARTIAL: mkmaze.c:1127 — makemaz() ↔ makemaz (dungeon.js:1054)

// cf. mkmaze.c:1232/1279 — walkfrom(x, y, typ): recursive maze carving (DFS)
// Carves corridors from (x,y) in random order; two variants (MICRO/standard).
// JS equiv: dungeon.js (PARTIAL — integrated into create_maze).
// PARTIAL: mkmaze.c:1232 — walkfrom() ↔ dungeon.js create_maze

// cf. mkmaze.c:1316 — mazexy(cc): find random point in maze corridors
// Returns random CORR position within the maze.
// JS equiv: dungeon.js:1396 — mazexy().
// PARTIAL: mkmaze.c:1316 — mazexy() ↔ mazexy (dungeon.js:1396)

// cf. mkmaze.c:1440 — bound_digging(): create non-diggable boundary
// Sets NODIGG flag on all wall/stone cells at level boundary.
// TODO: mkmaze.c:1440 — bound_digging(): boundary non-dig setup

// cf. mkmaze.c:1458 — mkportal(x, y, todnum, todlevel): create portal at location
// Places magic portal at (x,y) with destination dungeon:level.
// TODO: mkmaze.c:1458 — mkportal(): portal creation

// cf. mkmaze.c:1478 — fumaroles(): create fire vents on Plane of Fire
// Places fire vent terrain on the Fire plane level.
// TODO: mkmaze.c:1478 — fumaroles(): fire plane vents

// cf. mkmaze.c:1533 — movebubbles(): move air/water bubbles per turn
// Updates all bubble positions; handles collisions and hero enclosure.
// Called each turn on Plane of Water/Air.
// TODO: mkmaze.c:1533 — movebubbles(): per-turn bubble movement

// cf. mkmaze.c:1683 — water_friction(): apply water friction to movement
// Applies movement penalties for hero moving in water.
// TODO: mkmaze.c:1683 — water_friction(): water movement penalty

// cf. mkmaze.c:1717 — save_waterlevel(nhfp): save water level bubble state
// Serializes bubble positions and bubble-contains-hero state to save file.
// N/A: mkmaze.c:1717 — save_waterlevel() (no save file system)

// cf. mkmaze.c:1744 — restore_waterlevel(nhfp): restore water level bubble state
// Reads bubble state from save file.
// N/A: mkmaze.c:1744 — restore_waterlevel() (no save file system)

// cf. mkmaze.c:1796 — set_wportal(): set magic portal on water level
// Places water portal for Plane of Water.
// TODO: mkmaze.c:1796 — set_wportal(): water plane portal

// cf. mkmaze.c:1806 — setup_waterlevel(): initialize water level
// Allocates bubble structures; sets up initial bubble positions.
// TODO: mkmaze.c:1806 — setup_waterlevel(): water plane initialization

// cf. mkmaze.c:1854 — unsetup_waterlevel(): clean up water level
// Frees bubble structures on level change.
// TODO: mkmaze.c:1854 — unsetup_waterlevel(): water plane cleanup

// cf. mkmaze.c:1867 — mk_bubble(x, y, n): create bubble structure
// Allocates and initializes a bubble at (x,y) with size n.
// TODO: mkmaze.c:1867 — mk_bubble(): bubble creation

// cf. mkmaze.c:1923 — maybe_adjust_hero_bubble(): adjust bubble if hero inside
// When hero is in a bubble, adjusts bubble movement direction.
// TODO: mkmaze.c:1923 — maybe_adjust_hero_bubble(): hero bubble adjustment

// cf. mkmaze.c:1946 — mv_bubble(b, dx, dy, ini): move bubble
// Moves bubble b by (dx,dy); handles boundary bouncing and content relocation.
// TODO: mkmaze.c:1946 — mv_bubble(): bubble movement
