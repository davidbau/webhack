// mklev.js -- Level generation: rooms, corridors, doors, traps, stairs, features
// cf. mklev.c — makelevel, mklev, makerooms, makecorridors, join, topologize,
//               add_room, add_subroom, do_room_or_subroom, sort_rooms,
//               finddpos, finddpos_shift, good_rm_wall_doorpos,
//               fill_ordinary_room, themerooms_post_level_generate,
//               alloc_doors, add_door, dosdoor, dodoor, okdoor, bydoor,
//               maybe_sdoor, chk_okdoor, cardinal_nextto_room,
//               place_niche, makeniche, make_niches, makevtele,
//               mktrap, mktrap_victim, traptype_rnd, traptype_roguelvl,
//               mkstairs, generate_stairs, generate_stairs_find_room,
//               generate_stairs_room_good, mkfount, mksink, mkaltar, mkgrave,
//               mkinvokearea, mkinvpos, mkinvk_check_wall,
//               mineralize, water_has_kelp, level_finalize_topology,
//               count_level_features, clear_level_structures,
//               find_okay_roompos, occupied, pos_to_room, find_branch_room,
//               place_branch, mk_knox_portal, mklev_sanity_check,
//               mkroom_cmp, free_luathemes, mkfount, mksink, mkaltar
//
// mklev.c is the main level generation orchestrator. makelevel() dispatches to
// either makemaz() (for maze/special levels) or the room-based generator
// (makerooms → makecorridors → fill_ordinary_room → mineralize).
//
// JS implementations: most level-generation functions are implemented in dungeon.js.
//   makelevel()          → dungeon.js:5009 (PARTIAL — main entry point)
//   makerooms()          → dungeon.js:1435 (PARTIAL — room placement)
//   makecorridors()      → dungeon.js:2016 (PARTIAL — corridor generation)
//   join()               → dungeon.js:1948 (PARTIAL — join two rooms with corridor)
//   sort_rooms()         → dungeon.js:777 (ALIGNED)
//   add_room()           → dungeon.js:574 as add_room_to_map (PARTIAL)
//   add_door()           → dungeon.js:1706 (PARTIAL)
//   dodoor()             → dungeon.js:1701 (PARTIAL)
//   somexy/somexyspace   → dungeon.js:2184,2234 (ALIGNED — in mkroom.js)
//   mkstairs()           → dungeon.js:1418 (PARTIAL)
//   mktrap()             → dungeon.js (PARTIAL via traptype_rnd)
//   traptype_rnd()       → dungeon.js:2837 (PARTIAL)
//   mktrap_victim()      → dungeon.js:2972 (PARTIAL)
//   mkfount()            → dungeon.js:3100 (PARTIAL)
//   mksink()             → dungeon.js:3114 (PARTIAL)
//   mkaltar()            → dungeon.js:3124 (PARTIAL)
//   mkgrave()            → dungeon.js:3137 (PARTIAL)
//   mineralize()         → dungeon.js:4706 (ALIGNED — full implementation)
//   fill_ordinary_room() → dungeon.js:3206 (PARTIAL)
//   wallification()      → dungeon.js:3467 (ALIGNED — from mkmaze.c)
//   find_okay_roompos()  → dungeon.js:3087 (PARTIAL)
// Remaining functions (topologize, level_finalize_topology, mkinvokearea,
//   place_branch, mklev_sanity_check) → not implemented in JS.

// cf. mklev.c:60 [static] — mkroom_cmp(vx, vy): qsort comparator for mkroom structs
// Sorts rooms left-to-right for door placement; used by sort_rooms().
// TODO: mklev.c:60 — mkroom_cmp(): room sort comparator

// cf. mklev.c:73 [static] — good_rm_wall_doorpos(x, y, dir, room): valid door wall pos?
// Checks that position on room wall is valid for door placement.
// TODO: mklev.c:73 — good_rm_wall_doorpos(): door wall position check

// cf. mklev.c:106 [static] — finddpos_shift(x, y, dir, aroom): find shifted door pos
// Scans along room edge from (x,y) in direction dir for a valid door site.
// TODO: mklev.c:106 — finddpos_shift(): door position search

// cf. mklev.c:147 [static] — finddpos(cc, dir, aroom): find door position on room edge
// Picks valid door location on specified edge (N/S/E/W) of room.
// TODO: mklev.c:147 — finddpos(): room edge door finder

// cf. mklev.c:210 — sort_rooms(): sort rooms left-to-right and update room numbers
// Called after room placement; updates roomno in levl[][] for corridor generation.
// JS equiv: dungeon.js:777 — sort_rooms().
// ALIGNED: mklev.c:210 — sort_rooms() ↔ sort_rooms (dungeon.js:777)

// cf. mklev.c:231 [static] — do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, rtype, special, is_room)
// Helper that fills in mkroom struct fields; initializes door list.
// JS equiv: dungeon.js:574 as add_room_to_map (combined with add_room).
// PARTIAL: mklev.c:231 — do_room_or_subroom() ↔ add_room_to_map (dungeon.js:574)

// cf. mklev.c:304 — add_room(lowx, lowy, hix, hiy, lit, rtype, special): add room
// Allocates new mkroom slot; calls do_room_or_subroom(); sets levl[][] cell types.
// JS equiv: dungeon.js:574 as add_room_to_map.
// PARTIAL: mklev.c:304 — add_room() ↔ add_room_to_map (dungeon.js:574)

// cf. mklev.c:318 — add_subroom(proom, lowx, lowy, hix, hiy, lit, rtype, special): add subroom
// Links subroom into parent room's subroom list.
// TODO: mklev.c:318 — add_subroom(): subroom creation

// cf. mklev.c:335 — free_luathemes(theme_group): release Lua theme resources
// Frees theme strings loaded from Lua theme system for given group.
// N/A: mklev.c:335 — free_luathemes() (Lua interpreter not available)

// cf. mklev.c:357 — makerooms(): create rooms using Lua themes or random generation
// Main room placement loop: tries Lua themes first, falls back to random.
// JS equiv: dungeon.js:1435 — makerooms().
// PARTIAL: mklev.c:357 — makerooms() ↔ makerooms (dungeon.js:1435)

// cf. mklev.c:429 [static] — join(a, b, nxcor): join two rooms with a corridor
// Digs corridor between rooms a and b; nxcor=TRUE for extra corridors.
// JS equiv: dungeon.js:1948 — join().
// PARTIAL: mklev.c:429 — join() ↔ join (dungeon.js:1948)

// cf. mklev.c:518 — makecorridors(): create corridors between rooms
// Calls join() for each adjacent room pair; creates tree of corridors.
// JS equiv: dungeon.js:2016 — makecorridors().
// PARTIAL: mklev.c:518 — makecorridors() ↔ makecorridors (dungeon.js:2016)

// cf. mklev.c:552 [static] — alloc_doors(): allocate/reallocate door coordinate array
// Grows the global door position array as needed.
// TODO: mklev.c:552 — alloc_doors(): door array allocation

// cf. mklev.c:570 — add_door(x, y, aroom): add door position to room's list
// Records door location in room struct for later placement.
// JS equiv: dungeon.js:1706 — add_door().
// PARTIAL: mklev.c:570 — add_door() ↔ add_door (dungeon.js:1706)

// cf. mklev.c:611 [static] — dosdoor(x, y, aroom, type): create door at location
// Places DOOR or SDOOR (secret door) at (x,y); updates levl[][] and room door list.
// TODO: mklev.c:611 — dosdoor(): door/secret-door placement

// cf. mklev.c:677 [static] — cardinal_nextto_room(aroom, x, y): adjacent to room?
// Returns TRUE if any cardinal neighbor of (x,y) is inside room aroom.
// TODO: mklev.c:677 — cardinal_nextto_room(): room adjacency check

// cf. mklev.c:697 [static] — place_niche(aroom, dy, xx, yy): find niche position
// Finds location adjacent to room for a niche/alcove.
// TODO: mklev.c:697 — place_niche(): niche placement search

// cf. mklev.c:736 [static] — makeniche(trap_type): create niche with optional trap
// Creates alcove off main room; optionally places a trap inside.
// TODO: mklev.c:736 — makeniche(): niche creation

// cf. mklev.c:798 — make_niches(): generate multiple niches on level
// Creates up to several niches scattered around the level.
// TODO: mklev.c:798 — make_niches(): bulk niche generation

// cf. mklev.c:817 — makevtele(): create niche with teleport trap
// Shorthand for makeniche(TELEP_TRAP).
// TODO: mklev.c:817 — makevtele(): vault teleport niche

// cf. mklev.c:824 — count_level_features(): count fountains and sinks on level
// Returns counts for use in feature placement decisions.
// TODO: mklev.c:824 — count_level_features(): feature count

// cf. mklev.c:846 — clear_level_structures(): initialize level structures
// Zeros all level-gen data structures before new level generation.
// TODO: mklev.c:846 — clear_level_structures(): level-gen reset

// cf. mklev.c:934 — fill_ordinary_room(croom, bonus_items): populate room
// Adds monsters, objects, and features to a regular room based on rtype and depth.
// JS equiv: dungeon.js:3206 — fill_ordinary_room().
// PARTIAL: mklev.c:934 — fill_ordinary_room() ↔ fill_ordinary_room (dungeon.js:3206)

// cf. mklev.c:1169 — themerooms_post_level_generate(): post-gen theme room processing
// Finalizes theme rooms after main level generation pass.
// JS equiv: themerms.js handles theme room generation.
// PARTIAL: mklev.c:1169 — themerooms_post_level_generate() ↔ themerms.js

// cf. mklev.c:1193 [static] — chk_okdoor(x, y): door opens into solid terrain?
// Returns TRUE if a door at (x,y) has solid terrain on both sides.
// TODO: mklev.c:1193 — chk_okdoor(): door terrain validity

// cf. mklev.c:1218 — mklev_sanity_check(): validate level structure integrity
// Checks room bounds, door lists, and corridor connectivity.
// TODO: mklev.c:1218 — mklev_sanity_check(): level integrity validation

// cf. mklev.c:1246 — makelevel(): main level generation dispatcher
// Routes to makemaz() or room-based generator; calls mineralize, place_branch.
// JS equiv: dungeon.js:5009 — makelevel().
// PARTIAL: mklev.c:1246 — makelevel() ↔ makelevel (dungeon.js:5009)

// cf. mklev.c:1427 [static] — water_has_kelp(x, y, kelp_pool, kelp_moat): kelp check
// Determines if a water tile should receive kelp based on room type.
// TODO: mklev.c:1427 — water_has_kelp(): kelp placement predicate

// cf. mklev.c:1444 — mineralize(kelp_pool, kelp_moat, goldprob, gemprob, kelp_only)
// Deposits gold and gems in stone walls; places kelp in water.
// JS equiv: dungeon.js:4706 — mineralize().
// ALIGNED: mklev.c:1444 — mineralize() ↔ mineralize (dungeon.js:4706)

// cf. mklev.c:1539 — level_finalize_topology(): finalize level topology
// Post-processing after main generation: sets non-diggable walls, room numbers.
// TODO: mklev.c:1539 — level_finalize_topology(): topology finalization

// cf. mklev.c:1572 — mklev(): public entry point for level generation
// Called from goto_level; calls makelevel() then level_finalize_topology().
// JS equiv: dungeon.js:5009 — makelevel() (JS entry point).
// PARTIAL: mklev.c:1572 — mklev() ↔ makelevel (dungeon.js:5009)

// cf. mklev.c:1591 — topologize(croom, do_ordinary): set room numbers in levl[][]
// Fills levl[x][y].roomno with croom index for all cells in room (including walls).
// TODO: mklev.c:1591 — topologize(): room number assignment

// cf. mklev.c:1655 — find_branch_room(mp): find unused room for branch placement
// Returns a random non-special room suitable for branch stairs/portal.
// TODO: mklev.c:1655 — find_branch_room(): branch room selection

// cf. mklev.c:1672 — pos_to_room(x, y): find room containing position
// Returns pointer to mkroom containing (x,y), or NULL.
// TODO: mklev.c:1672 — pos_to_room(): position to room lookup

// cf. mklev.c:1686 — place_branch(br, x, y): place branch stairs or portal
// Places branch portal/stairs at (x,y); if (0,0) picks random location.
// JS equiv: dungeon.js:1002 (inlined in makelevel).
// PARTIAL: mklev.c:1686 — place_branch() ↔ dungeon.js:1002

// cf. mklev.c:1745 — bydoor(x, y): is position adjacent to a door?
// Returns TRUE if any neighbor of (x,y) is a DOOR or SDOOR.
// TODO: mklev.c:1745 — bydoor(): door adjacency check

// cf. mklev.c:1774 — okdoor(x, y): valid location for a door?
// Checks terrain and adjacency; returns TRUE if door placement is valid.
// TODO: mklev.c:1774 — okdoor(): door placement validity

// cf. mklev.c:1788 [static] — maybe_sdoor(chance): should this be a secret door?
// Returns TRUE with probability 1/chance (rn2-based).
// TODO: mklev.c:1788 — maybe_sdoor(): secret door probability

// cf. mklev.c:1795 — dodoor(x, y, aroom): create door at location in room
// Combines okdoor check + add_door + dosdoor.
// JS equiv: dungeon.js:1701 — dodoor().
// PARTIAL: mklev.c:1795 — dodoor() ↔ dodoor (dungeon.js:1701)

// cf. mklev.c:1801 — occupied(x, y): position occupied by trap/furniture/lava/pool?
// Returns TRUE if position has a trap, sink, fountain, altar, or lava.
// TODO: mklev.c:1801 — occupied(): position occupation check

// cf. mklev.c:1810 — mktrap_victim(ttmp): generate corpse/items on trap
// Places appropriate loot/corpses near or on the trap.
// JS equiv: dungeon.js:2972 — mktrap_victim().
// PARTIAL: mklev.c:1810 — mktrap_victim() ↔ mktrap_victim (dungeon.js:2972)

// cf. mklev.c:1933 — traptype_rnd(mktrapflags): select random trap type
// Returns random trap type respecting flags (avoid magic traps, prefer simple, etc.).
// JS equiv: dungeon.js:2837 — traptype_rnd().
// PARTIAL: mklev.c:1933 — traptype_rnd() ↔ traptype_rnd (dungeon.js:2837)

// cf. mklev.c:1997 — traptype_roguelvl(): select trap type for Rogue level
// Returns trap type appropriate for the special Rogue level.
// TODO: mklev.c:1997 — traptype_roguelvl(): Rogue level trap type

// cf. mklev.c:2031 — mktrap(num, mktrapflags, croom, tm): create trap
// Places a trap of type num (or random) at location tm or random in croom.
// JS equiv: dungeon.js (PARTIAL — via traptype_rnd and mktrap_victim).
// PARTIAL: mklev.c:2031 — mktrap() ↔ dungeon.js trap placement

// cf. mklev.c:2154 — mkstairs(x, y, up, croom, force): create stairs at location
// Sets UPSTAIR or DNSTAIR terrain; records in level stairway list.
// JS equiv: dungeon.js:1418 — mkstairs().
// PARTIAL: mklev.c:2154 — mkstairs() ↔ mkstairs (dungeon.js:1418)

// cf. mklev.c:2196 [static] — generate_stairs_room_good(croom, phase): validate stair room
// Returns TRUE if room is suitable for stair placement in given generation phase.
// TODO: mklev.c:2196 — generate_stairs_room_good(): stair room validation

// cf. mklev.c:2214 [static] — generate_stairs_find_room(): find room for stairs
// Picks a suitable room for stair generation.
// TODO: mklev.c:2214 — generate_stairs_find_room(): stair room selection

// cf. mklev.c:2245 — generate_stairs(): generate up and down stairs
// Calls mkstairs() for both directions in appropriate rooms.
// TODO: mklev.c:2245 — generate_stairs(): stair generation

// cf. mklev.c:2280 — mkfount(croom): create fountain in room
// Places FOUNTAIN terrain in a valid room position.
// JS equiv: dungeon.js:3100 — mkfount().
// PARTIAL: mklev.c:2280 — mkfount() ↔ mkfount (dungeon.js:3100)

// cf. mklev.c:2298 — find_okay_roompos(croom, crd): find acceptable room position
// Finds position in room that is not occupied or adjacent to door.
// JS equiv: dungeon.js:3087 — find_okay_roompos().
// PARTIAL: mklev.c:2298 — find_okay_roompos() ↔ find_okay_roompos (dungeon.js:3087)

// cf. mklev.c:2312 — mksink(croom): create sink in room
// Places SINK terrain at a valid room position.
// JS equiv: dungeon.js:3114 — mksink().
// PARTIAL: mklev.c:2312 — mksink() ↔ mksink (dungeon.js:3114)

// cf. mklev.c:2327 — mkaltar(croom): create altar in room
// Places ALTAR terrain; sets alignment; optionally generates priest (mktemple).
// JS equiv: dungeon.js:3124 — mkaltar().
// PARTIAL: mklev.c:2327 — mkaltar() ↔ mkaltar (dungeon.js:3124)

// cf. mklev.c:2348 — mkgrave(croom): create grave in room
// Places GRAVE terrain; writes inscription; optionally places ghost.
// JS equiv: dungeon.js:3137 — mkgrave().
// PARTIAL: mklev.c:2348 — mkgrave() ↔ mkgrave (dungeon.js:3137)

// cf. mklev.c:2405 — mkinvokearea(): create Invocation level pentagram area
// Creates the pentagram geometry around the vibrating square on level 1 of Gehennom.
// TODO: mklev.c:2405 — mkinvokearea(): invocation pentagram layout

// cf. mklev.c:2498 [static] — mkinvpos(x, y, dist): transform invocation area position
// Adjusts terrain around the invocation area.
// TODO: mklev.c:2498 — mkinvpos(): invocation position setup

// cf. mklev.c:2598 [static] — mkinvk_check_wall(x, y): invocation area wall check
// Checks if position contains a wall for invocation area generation.
// TODO: mklev.c:2598 — mkinvk_check_wall(): invocation wall check

// cf. mklev.c:2619 — mk_knox_portal(x, y): create Fort Ludios portal
// Places the magic portal to Fort Ludios at (x,y).
// TODO: mklev.c:2619 — mk_knox_portal(): Fort Ludios portal
