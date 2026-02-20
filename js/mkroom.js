// mkroom.js -- Room generation: special rooms, shops, temples, zoos, and helpers
// cf. mkroom.c — isbig, do_mkroom, mkshop, pick_room, mkzoo, mk_zoo_thronemon,
//                fill_zoo, mkundead, morguemon, antholemon, mkswamp,
//                shrine_pos, mktemple, nexttodoor, has_dnstairs, has_upstairs,
//                somex, somey, inside_room, somexy, somexyspace, search_special,
//                courtmon, squadmon, save_room, save_rooms, rest_room, rest_rooms,
//                cmap_to_type, invalid_shop_shape
//
// mkroom.c provides:
//   - Special room types: mkshop, mktemple, mkzoo/fill_zoo, mkswamp, mkundead
//   - Room helper predicates: isbig, has_dnstairs, has_upstairs, inside_room
//   - Position helpers: somex, somey, somexy, somexyspace, nexttodoor
//   - Room type search: search_special, pick_room
//   - Monster generators for special rooms: morguemon, antholemon, courtmon, squadmon
//   - Save/restore: save_room, save_rooms, rest_room, rest_rooms (N/A — no save)
//   - Terrain mapping: cmap_to_type
//
// JS implementations: position helpers and some generators are in dungeon.js.
//   somex/somey           → dungeon.js:2169 (ALIGNED)
//   inside_room()         → dungeon.js:2173 (ALIGNED)
//   somexy()              → dungeon.js:2184 (ALIGNED)
//   somexyspace()         → dungeon.js:2234 (ALIGNED)
//   mktemple()            → dungeon.js (PARTIAL — via mkaltar)
//   mkshop()              → dungeon.js (PARTIAL — via shknam.js shop setup)
//   fill_zoo()            → dungeon.js (PARTIAL — ordinary room monster filling)
// Most special room creation functions → not fully implemented in JS.
// save_room/rest_room/save_rooms/rest_rooms → N/A (no save file system)

// cf. mkroom.c:42 — isbig(sroom): is room larger than 20 sq units?
// Returns TRUE if (hx-lx)*(hy-ly) > 20.
// TODO: mkroom.c:42 — isbig(): large room predicate

// cf. mkroom.c:52 — do_mkroom(roomtype): create and stock room of specified type
// Dispatches to mkshop/mktemple/mkzoo/mkswamp etc. based on roomtype.
// TODO: mkroom.c:52 — do_mkroom(): special room creation dispatcher

// cf. mkroom.c:95 — mkshop(): create shop room
// Selects shop type, stocks with items, creates shopkeeper.
// JS equiv: shknam.js + dungeon.js (PARTIAL — shop name/type selection implemented).
// PARTIAL: mkroom.c:95 — mkshop() ↔ shknam.js + dungeon.js shop setup

// cf. mkroom.c:220 [static] — pick_room(strict): select unused room for special type
// Returns random unused room; strict=TRUE requires non-corridor room.
// TODO: mkroom.c:220 — pick_room(): special room selection

// cf. mkroom.c:244 — mkzoo(type): create zoo/court/barracks type room
// Sets room type and calls fill_zoo() for monster/object population.
// TODO: mkroom.c:244 — mkzoo(): zoo/court/barracks creation

// cf. mkroom.c:257 [static] — mk_zoo_thronemon(x, y): create throne monster for court
// Places a throne monster (usually a king-type) in a court room.
// TODO: mkroom.c:257 — mk_zoo_thronemon(): court throne monster

// cf. mkroom.c:276 — fill_zoo(sroom): populate zoo with monsters and objects
// Creates appropriate monsters and treasure for room type (zoo, court, barracks,
//   beehive, morgue, anthole, leprechaun_hall, etc.).
// JS equiv: dungeon.js (PARTIAL — ordinary room monster placement).
// PARTIAL: mkroom.c:276 — fill_zoo() ↔ dungeon.js monster placement

// cf. mkroom.c:456 — mkundead(mm, revive_corpses, mm_flags): create undead swarm
// Creates a cluster of undead monsters around position mm.
// TODO: mkroom.c:456 — mkundead(): undead swarm creation

// cf. mkroom.c:478 [static] — morguemon(): generate monster type for morgue
// Returns appropriate undead monster type for morgue rooms.
// TODO: mkroom.c:478 — morguemon(): morgue monster type

// cf. mkroom.c:502 [static] — antholemon(): generate ant type for anthole
// Returns random ant species for anthole rooms.
// TODO: mkroom.c:502 — antholemon(): anthole monster type

// cf. mkroom.c:530 — mkswamp(): create swamp terrain in random rooms
// Converts floor tiles to pools/moats in selected rooms.
// TODO: mkroom.c:530 — mkswamp(): swamp terrain generation

// cf. mkroom.c:577 [static] — shrine_pos(roomno): center position of room for shrine
// Returns center coordinate of given room (for altar placement).
// TODO: mkroom.c:577 — shrine_pos(): shrine center position

// cf. mkroom.c:598 — mktemple(): create temple with priest and altar
// Calls priestini() to set up shrine; selects co-aligned altar.
// TODO: mkroom.c:598 — mktemple(): temple creation with priest

// cf. mkroom.c:623 [static] — nexttodoor(sx, sy): adjacent to a door?
// Returns TRUE if (sx,sy) neighbors a DOOR or SDOOR tile.
// TODO: mkroom.c:623 — nexttodoor(): door adjacency predicate

// cf. mkroom.c:640 — has_dnstairs(sroom): room has down stairs?
// Returns TRUE if down staircase is inside sroom.
// TODO: mkroom.c:640 — has_dnstairs(): downstairs presence check

// cf. mkroom.c:653 — has_upstairs(sroom): room has up stairs?
// Returns TRUE if up staircase is inside sroom.
// TODO: mkroom.c:653 — has_upstairs(): upstairs presence check

// cf. mkroom.c:666 — somex(croom): random x within room
// Returns rn1(croom.hx - croom.lx + 1, croom.lx).
// JS equiv: dungeon.js:2169 — somex().
// ALIGNED: mkroom.c:666 — somex() ↔ somex (dungeon.js:2169)

// cf. mkroom.c:672 — somey(croom): random y within room
// Returns rn1(croom.hy - croom.ly + 1, croom.ly).
// JS equiv: dungeon.js:2170 — somey().
// ALIGNED: mkroom.c:672 — somey() ↔ somey (dungeon.js:2170)

// cf. mkroom.c:678 — inside_room(croom, x, y): is (x,y) inside room bounds?
// Returns x in [lx,hx] and y in [ly,hy] (includes walls).
// JS equiv: dungeon.js:2173 — inside_room().
// ALIGNED: mkroom.c:678 — inside_room() ↔ inside_room (dungeon.js:2173)

// cf. mkroom.c:694 — somexy(croom, c): random coordinate in room
// Picks random position; for irregular rooms avoids subroom cells.
// JS equiv: dungeon.js:2184 — somexy().
// ALIGNED: mkroom.c:694 — somexy() ↔ somexy (dungeon.js:2184)

// cf. mkroom.c:744 — somexyspace(croom, c): random accessible coordinate in room
// Returns ACCESSIBLE terrain position in room (not wall/occupied).
// JS equiv: dungeon.js:2234 — somexyspace().
// ALIGNED: mkroom.c:744 — somexyspace() ↔ somexyspace (dungeon.js:2234)

// cf. mkroom.c:765 — search_special(type): find room or subroom of given type
// Scans all rooms and subrooms; returns first matching schar rtype.
// TODO: mkroom.c:765 — search_special(): special room type search

// cf. mkroom.c:783 [static] — courtmon(): generate monster for court room
// Returns random court-appropriate monster type (nobles, guards, etc.).
// TODO: mkroom.c:783 — courtmon(): court monster type

// cf. mkroom.c:817 [static] — squadmon(): generate soldier type for barracks
// Returns random soldier/guard type for barracks rooms.
// TODO: mkroom.c:817 — squadmon(): barracks monster type

// cf. mkroom.c:844 — save_room(nhfp, r): save room structure recursively
// Writes mkroom struct and subrooms to save file.
// N/A: mkroom.c:844 — save_room() (no save file system)

// cf. mkroom.c:863 — save_rooms(nhfp): save all rooms to file
// Writes room count and each room via save_room().
// N/A: mkroom.c:863 — save_rooms() (no save file system)

// cf. mkroom.c:875 — rest_room(nhfp, r): restore room structure recursively
// Reads mkroom struct and subrooms from save file.
// N/A: mkroom.c:875 — rest_room() (no save file system)

// cf. mkroom.c:893 — rest_rooms(nhfp): restore all rooms from file
// Reads room count and each room via rest_room().
// N/A: mkroom.c:893 — rest_rooms() (no save file system)

// cf. mkroom.c:912 — cmap_to_type(sym): display symbol to terrain type
// Converts a cmap[] display symbol index to levl terrain type constant.
// TODO: mkroom.c:912 — cmap_to_type(): symbol to terrain type

// cf. mkroom.c:1050 [static] — invalid_shop_shape(sroom): shop shape validity check
// Returns TRUE if room geometry is invalid for a shop (non-rectangular, etc.).
// TODO: mkroom.c:1050 — invalid_shop_shape(): shop geometry validation
