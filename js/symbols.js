/**
 * symbols.js - NetHack 3.7 symbol and color definitions
 *
 * Ported from the following C source files:
 *   - include/color.h      (color constants)
 *   - include/defsym.h     (PCHAR, MONSYMS, OBJCLASS definitions)
 *   - include/sym.h        (symbol enums, warning symbols)
 *   - include/rm.h         (level location types)
 *   - include/trap.h       (trap type constants)
 *   - src/drawing.c        (drawing arrays, warning symbols)
 */

// ==========================================================================
// 1. Color Constants (from include/color.h, lines 14-30)
// ==========================================================================

export const CLR_BLACK          = 0;
export const CLR_RED            = 1;
export const CLR_GREEN          = 2;
export const CLR_BROWN          = 3;   // on IBM, low-intensity yellow is brown
export const CLR_BLUE           = 4;
export const CLR_MAGENTA        = 5;
export const CLR_CYAN           = 6;
export const CLR_GRAY           = 7;   // low-intensity white
export const NO_COLOR           = 8;
export const CLR_ORANGE         = 9;
export const CLR_BRIGHT_GREEN   = 10;
export const CLR_YELLOW         = 11;
export const CLR_BRIGHT_BLUE    = 12;
export const CLR_BRIGHT_MAGENTA = 13;
export const CLR_BRIGHT_CYAN    = 14;
export const CLR_WHITE          = 15;
export const CLR_MAX            = 16;

export const BRIGHT             = 8;   // half-way point for tty color systems

// Color aliases (from include/color.h, lines 37-55)
export const HI_DOMESTIC        = CLR_WHITE;          // for player + pets
export const HI_LORD            = CLR_MAGENTA;        // for high-end monsters
export const HI_OVERLORD        = CLR_BRIGHT_MAGENTA; // for few uniques

export const HI_OBJ             = CLR_MAGENTA;
export const HI_METAL           = CLR_CYAN;
export const HI_COPPER          = CLR_YELLOW;
export const HI_SILVER          = CLR_GRAY;
export const HI_GOLD            = CLR_YELLOW;
export const HI_LEATHER         = CLR_BROWN;
export const HI_CLOTH           = CLR_BROWN;
export const HI_ORGANIC         = CLR_BROWN;
export const HI_WOOD            = CLR_BROWN;
export const HI_PAPER           = CLR_WHITE;
export const HI_GLASS           = CLR_BRIGHT_CYAN;
export const HI_MINERAL         = CLR_GRAY;
export const DRAGON_SILVER      = CLR_BRIGHT_CYAN;
export const HI_ZAP             = CLR_BRIGHT_BLUE;

// ==========================================================================
// 2. PCHAR Symbol Enum Constants (S_*) (from include/defsym.h, lines 90-247)
//    Matches enum cmap_symbols in include/sym.h
// ==========================================================================

// Dungeon features: walls, stone
export const S_stone            = 0;
export const S_vwall            = 1;
export const S_hwall            = 2;
export const S_tlcorn           = 3;
export const S_trcorn           = 4;
export const S_blcorn           = 5;
export const S_brcorn           = 6;
export const S_crwall           = 7;
export const S_tuwall           = 8;
export const S_tdwall           = 9;
export const S_tlwall           = 10;
export const S_trwall           = 11;

// Doors, bars, trees, rooms, corridors (cmap A)
export const S_ndoor            = 12;
export const S_vodoor           = 13;
export const S_hodoor           = 14;
export const S_vcdoor           = 15;
export const S_hcdoor           = 16;
export const S_bars             = 17;
export const S_tree             = 18;
export const S_room             = 19;
export const S_darkroom         = 20;
export const S_engroom          = 21;
export const S_corr             = 22;
export const S_litcorr          = 23;
export const S_engrcorr         = 24;

// Stairs and ladders
export const S_upstair          = 25;
export const S_dnstair          = 26;
export const S_upladder         = 27;
export const S_dnladder         = 28;
export const S_brupstair        = 29;
export const S_brdnstair        = 30;
export const S_brupladder       = 31;
export const S_brdnladder       = 32;

// Altar
export const S_altar            = 33;

// Furniture (cmap B)
export const S_grave            = 34;
export const S_throne           = 35;
export const S_sink             = 36;
export const S_fountain         = 37;

// Water, lava, ice, drawbridges, air, cloud
export const S_pool             = 38;
export const S_ice              = 39;
export const S_lava             = 40;
export const S_lavawall         = 41;
export const S_vodbridge        = 42;
export const S_hodbridge        = 43;
export const S_vcdbridge        = 44;
export const S_hcdbridge        = 45;
export const S_air              = 46;
export const S_cloud            = 47;
export const S_water            = 48;

// Traps (defsym.h lines 157-183)
export const S_arrow_trap       = 49;
export const S_dart_trap        = 50;
export const S_falling_rock_trap = 51;
export const S_squeaky_board    = 52;
export const S_bear_trap        = 53;
export const S_land_mine        = 54;
export const S_rolling_boulder_trap = 55;
export const S_sleeping_gas_trap = 56;
export const S_rust_trap        = 57;
export const S_fire_trap        = 58;
export const S_pit              = 59;
export const S_spiked_pit       = 60;
export const S_hole             = 61;
export const S_trap_door        = 62;
export const S_teleportation_trap = 63;
export const S_level_teleporter = 64;
export const S_magic_portal     = 65;
export const S_web              = 66;
export const S_statue_trap      = 67;
export const S_magic_trap       = 68;
export const S_anti_magic_trap  = 69;
export const S_polymorph_trap   = 70;
export const S_vibrating_square = 71;
export const S_trapped_door     = 72;
export const S_trapped_chest    = 73;

// Special effects: beams (defsym.h lines 190-197)
export const S_vbeam            = 74;
export const S_hbeam            = 75;
export const S_lslant           = 76;
export const S_rslant           = 77;

// Special effects: other (cmap C, defsym.h lines 194-207)
export const S_digbeam          = 78;
export const S_flashbeam        = 79;
export const S_boomleft         = 80;
export const S_boomright        = 81;

// Magic shield symbols
export const S_ss1              = 82;
export const S_ss2              = 83;
export const S_ss3              = 84;
export const S_ss4              = 85;

export const S_poisoncloud      = 86;
export const S_goodpos          = 87;

// Swallow symbols (defsym.h lines 221-228)
export const S_sw_tl            = 88;
export const S_sw_tc            = 89;
export const S_sw_tr            = 90;
export const S_sw_ml            = 91;
export const S_sw_mr            = 92;
export const S_sw_bl            = 93;
export const S_sw_bc            = 94;
export const S_sw_br            = 95;

// Explosion symbols (defsym.h lines 239-247)
export const S_expl_tl          = 96;
export const S_expl_tc          = 97;
export const S_expl_tr          = 98;
export const S_expl_ml          = 99;
export const S_expl_mc          = 100;
export const S_expl_mr          = 101;
export const S_expl_bl          = 102;
export const S_expl_bc          = 103;
export const S_expl_br          = 104;

export const MAXPCHARS          = 105;

// ==========================================================================
// 2b. defsyms[] array (from defsym.h PCHAR_DRAWING expansion + drawing.c)
//     Each entry: { ch, desc (explanation), color }
//     PCHAR(idx, ch, sym, desc, clr)  => { ch, desc, clr }
//     PCHAR2(idx, ch, sym, tilenm, desc, clr) => { ch, desc, clr }
// ==========================================================================

export const defsyms = [
    // idx  0: S_stone
    { ch: ' ',  desc: "dark part of a room",           color: NO_COLOR },
    // idx  1: S_vwall
    { ch: '|',  desc: "vertical wall",                 color: CLR_GRAY },
    // idx  2: S_hwall
    { ch: '-',  desc: "horizontal wall",               color: CLR_GRAY },
    // idx  3: S_tlcorn
    { ch: '-',  desc: "top left corner wall",          color: CLR_GRAY },
    // idx  4: S_trcorn
    { ch: '-',  desc: "top right corner wall",         color: CLR_GRAY },
    // idx  5: S_blcorn
    { ch: '-',  desc: "bottom left corner wall",       color: CLR_GRAY },
    // idx  6: S_brcorn
    { ch: '-',  desc: "bottom right corner wall",      color: CLR_GRAY },
    // idx  7: S_crwall
    { ch: '-',  desc: "cross wall",                    color: CLR_GRAY },
    // idx  8: S_tuwall
    { ch: '-',  desc: "tuwall",                        color: CLR_GRAY },
    // idx  9: S_tdwall
    { ch: '-',  desc: "tdwall",                        color: CLR_GRAY },
    // idx 10: S_tlwall
    { ch: '|',  desc: "tlwall",                        color: CLR_GRAY },
    // idx 11: S_trwall
    { ch: '|',  desc: "trwall",                        color: CLR_GRAY },
    // --- start cmap A ---
    // idx 12: S_ndoor
    { ch: '.',  desc: "no door",                       color: CLR_GRAY },
    // idx 13: S_vodoor
    { ch: '-',  desc: "vertical open door",            color: CLR_BROWN },
    // idx 14: S_hodoor
    { ch: '|',  desc: "horizontal open door",          color: CLR_BROWN },
    // idx 15: S_vcdoor
    { ch: '+',  desc: "vertical closed door",          color: CLR_BROWN },
    // idx 16: S_hcdoor
    { ch: '+',  desc: "horizontal closed door",        color: CLR_BROWN },
    // idx 17: S_bars
    { ch: '#',  desc: "iron bars",                     color: HI_METAL },
    // idx 18: S_tree
    { ch: '#',  desc: "tree",                          color: CLR_GREEN },
    // idx 19: S_room
    { ch: '.',  desc: "floor of a room",               color: CLR_GRAY },
    // idx 20: S_darkroom
    { ch: '.',  desc: "dark part of a room",           color: CLR_BLACK },
    // idx 21: S_engroom
    { ch: '`',  desc: "engraving in a room",           color: CLR_BRIGHT_BLUE },
    // idx 22: S_corr
    { ch: '#',  desc: "dark corridor",                 color: CLR_GRAY },
    // idx 23: S_litcorr
    { ch: '#',  desc: "lit corridor",                  color: CLR_GRAY },
    // idx 24: S_engrcorr
    { ch: '#',  desc: "engraving in a corridor",       color: CLR_BRIGHT_BLUE },
    // idx 25: S_upstair
    { ch: '<',  desc: "up stairs",                     color: CLR_GRAY },
    // idx 26: S_dnstair
    { ch: '>',  desc: "down stairs",                   color: CLR_GRAY },
    // idx 27: S_upladder
    { ch: '<',  desc: "up ladder",                     color: CLR_BROWN },
    // idx 28: S_dnladder
    { ch: '>',  desc: "down ladder",                   color: CLR_BROWN },
    // idx 29: S_brupstair
    { ch: '<',  desc: "branch staircase up",           color: CLR_YELLOW },
    // idx 30: S_brdnstair
    { ch: '>',  desc: "branch staircase down",         color: CLR_YELLOW },
    // idx 31: S_brupladder
    { ch: '<',  desc: "branch ladder up",              color: CLR_YELLOW },
    // idx 32: S_brdnladder
    { ch: '>',  desc: "branch ladder down",            color: CLR_YELLOW },
    // --- end cmap A ---
    // idx 33: S_altar
    { ch: '_',  desc: "altar",                         color: CLR_GRAY },
    // --- start cmap B ---
    // idx 34: S_grave
    { ch: '|',  desc: "grave",                         color: CLR_WHITE },
    // idx 35: S_throne
    { ch: '\\', desc: "throne",                        color: HI_GOLD },
    // idx 36: S_sink
    { ch: '{',  desc: "sink",                          color: CLR_WHITE },
    // idx 37: S_fountain
    { ch: '{',  desc: "fountain",                      color: CLR_BRIGHT_BLUE },
    // idx 38: S_pool (used for both POOL terrain and MOAT terrain)
    { ch: '}',  desc: "pool",                          color: CLR_BLUE },
    // idx 39: S_ice
    { ch: '.',  desc: "ice",                           color: CLR_CYAN },
    // idx 40: S_lava
    { ch: '}',  desc: "molten lava",                   color: CLR_RED },
    // idx 41: S_lavawall
    { ch: '}',  desc: "wall of lava",                  color: CLR_ORANGE },
    // idx 42: S_vodbridge
    { ch: '.',  desc: "vertical open drawbridge",      color: CLR_BROWN },
    // idx 43: S_hodbridge
    { ch: '.',  desc: "horizontal open drawbridge",    color: CLR_BROWN },
    // idx 44: S_vcdbridge
    { ch: '#',  desc: "vertical closed drawbridge",    color: CLR_BROWN },
    // idx 45: S_hcdbridge
    { ch: '#',  desc: "horizontal closed drawbridge",  color: CLR_BROWN },
    // idx 46: S_air
    { ch: ' ',  desc: "air",                           color: CLR_CYAN },
    // idx 47: S_cloud
    { ch: '#',  desc: "cloud",                         color: CLR_GRAY },
    // idx 48: S_water (WATER terrain: wall of water / Plane of Water)
    { ch: '}',  desc: "water",                         color: CLR_BRIGHT_BLUE },
    // --- end dungeon characters, begin traps ---
    // idx 49: S_arrow_trap
    { ch: '^',  desc: "arrow trap",                    color: HI_METAL },
    // idx 50: S_dart_trap
    { ch: '^',  desc: "dart trap",                     color: HI_METAL },
    // idx 51: S_falling_rock_trap
    { ch: '^',  desc: "falling rock trap",             color: CLR_GRAY },
    // idx 52: S_squeaky_board
    { ch: '^',  desc: "squeaky board",                 color: CLR_BROWN },
    // idx 53: S_bear_trap
    { ch: '^',  desc: "bear trap",                     color: HI_METAL },
    // idx 54: S_land_mine
    { ch: '^',  desc: "land mine",                     color: CLR_RED },
    // idx 55: S_rolling_boulder_trap
    { ch: '^',  desc: "rolling boulder trap",          color: CLR_GRAY },
    // idx 56: S_sleeping_gas_trap
    { ch: '^',  desc: "sleeping gas trap",             color: HI_ZAP },
    // idx 57: S_rust_trap
    { ch: '^',  desc: "rust trap",                     color: CLR_BLUE },
    // idx 58: S_fire_trap
    { ch: '^',  desc: "fire trap",                     color: CLR_ORANGE },
    // idx 59: S_pit
    { ch: '^',  desc: "pit",                           color: CLR_BLACK },
    // idx 60: S_spiked_pit
    { ch: '^',  desc: "spiked pit",                    color: CLR_BLACK },
    // idx 61: S_hole
    { ch: '^',  desc: "hole",                          color: CLR_BROWN },
    // idx 62: S_trap_door
    { ch: '^',  desc: "trap door",                     color: CLR_BROWN },
    // idx 63: S_teleportation_trap
    { ch: '^',  desc: "teleportation trap",            color: CLR_MAGENTA },
    // idx 64: S_level_teleporter
    { ch: '^',  desc: "level teleporter",              color: CLR_MAGENTA },
    // idx 65: S_magic_portal
    { ch: '^',  desc: "magic portal",                  color: CLR_BRIGHT_MAGENTA },
    // idx 66: S_web
    { ch: '"',  desc: "web",                           color: CLR_GRAY },
    // idx 67: S_statue_trap
    { ch: '^',  desc: "statue trap",                   color: CLR_GRAY },
    // idx 68: S_magic_trap
    { ch: '^',  desc: "magic trap",                    color: HI_ZAP },
    // idx 69: S_anti_magic_trap
    { ch: '^',  desc: "anti magic trap",               color: HI_ZAP },
    // idx 70: S_polymorph_trap
    { ch: '^',  desc: "polymorph trap",                color: CLR_BRIGHT_GREEN },
    // idx 71: S_vibrating_square
    { ch: '~',  desc: "vibrating square",              color: CLR_MAGENTA },
    // idx 72: S_trapped_door
    { ch: '^',  desc: "trapped door",                  color: CLR_ORANGE },
    // idx 73: S_trapped_chest
    { ch: '^',  desc: "trapped chest",                 color: CLR_ORANGE },
    // --- end traps, end cmap B ---
    // --- begin special effects ---
    // idx 74: S_vbeam (zap colors changed by reset_glyphmap)
    { ch: '|',  desc: "vertical beam",                 color: CLR_GRAY },
    // idx 75: S_hbeam
    { ch: '-',  desc: "horizontal beam",               color: CLR_GRAY },
    // idx 76: S_lslant
    { ch: '\\', desc: "left slant beam",               color: CLR_GRAY },
    // idx 77: S_rslant
    { ch: '/',  desc: "right slant beam",              color: CLR_GRAY },
    // --- start cmap C ---
    // idx 78: S_digbeam
    { ch: '*',  desc: "dig beam",                      color: CLR_WHITE },
    // idx 79: S_flashbeam
    { ch: '!',  desc: "flash beam",                    color: CLR_WHITE },
    // idx 80: S_boomleft
    { ch: ')',  desc: "boom left",                     color: HI_WOOD },
    // idx 81: S_boomright
    { ch: '(',  desc: "boom right",                    color: HI_WOOD },
    // idx 82: S_ss1 (magic shield)
    { ch: '0',  desc: "shield1",                       color: HI_ZAP },
    // idx 83: S_ss2
    { ch: '#',  desc: "shield2",                       color: HI_ZAP },
    // idx 84: S_ss3
    { ch: '@',  desc: "shield3",                       color: HI_ZAP },
    // idx 85: S_ss4
    { ch: '*',  desc: "shield4",                       color: HI_ZAP },
    // idx 86: S_poisoncloud
    { ch: '#',  desc: "poison cloud",                  color: CLR_BRIGHT_GREEN },
    // idx 87: S_goodpos
    { ch: '$',  desc: "valid position",                color: HI_ZAP },
    // --- end cmap C ---
    // --- swallow symbols (do NOT separate) ---
    // Order: 1 2 3 / 4 5 6 / 7 8 9
    // idx 88: S_sw_tl  (1)
    { ch: '/',  desc: "swallow top left",              color: CLR_GREEN },
    // idx 89: S_sw_tc  (2)
    { ch: '-',  desc: "swallow top center",            color: CLR_GREEN },
    // idx 90: S_sw_tr  (3)
    { ch: '\\', desc: "swallow top right",             color: CLR_GREEN },
    // idx 91: S_sw_ml  (4)
    { ch: '|',  desc: "swallow middle left",           color: CLR_GREEN },
    // idx 92: S_sw_mr  (6)
    { ch: '|',  desc: "swallow middle right",          color: CLR_GREEN },
    // idx 93: S_sw_bl  (7)
    { ch: '\\', desc: "swallow bottom left",           color: CLR_GREEN },
    // idx 94: S_sw_bc  (8)
    { ch: '-',  desc: "swallow bottom center",         color: CLR_GREEN },
    // idx 95: S_sw_br  (9)
    { ch: '/',  desc: "swallow bottom right",          color: CLR_GREEN },
    // --- explosion symbols ---
    // idx 96: S_expl_tl
    { ch: '/',  desc: "explosion top left",            color: CLR_ORANGE },
    // idx 97: S_expl_tc
    { ch: '-',  desc: "explosion top center",          color: CLR_ORANGE },
    // idx 98: S_expl_tr
    { ch: '\\', desc: "explosion top right",           color: CLR_ORANGE },
    // idx 99: S_expl_ml
    { ch: '|',  desc: "explosion middle left",         color: CLR_ORANGE },
    // idx 100: S_expl_mc
    { ch: ' ',  desc: "explosion middle center",       color: CLR_ORANGE },
    // idx 101: S_expl_mr
    { ch: '|',  desc: "explosion middle right",        color: CLR_ORANGE },
    // idx 102: S_expl_bl
    { ch: '\\', desc: "explosion bottom left",         color: CLR_ORANGE },
    // idx 103: S_expl_bc
    { ch: '-',  desc: "explosion bottom center",       color: CLR_ORANGE },
    // idx 104: S_expl_br
    { ch: '/',  desc: "explosion bottom right",        color: CLR_ORANGE },
];

// Derived constants (from include/sym.h, lines 91-94)
export const MAXDCHARS = S_water - S_stone + 1;            // mapped dungeon characters
export const MAXECHARS = S_expl_br - S_vbeam + 1;          // mapped effects characters
export const MAXEXPCHARS = 9;                               // number of explosion characters

// ==========================================================================
// 3. Level Type Constants (from include/rm.h, lines 55-97)
//    enum levl_typ_types
// ==========================================================================

export const STONE           = 0;
export const VWALL           = 1;
export const HWALL           = 2;
export const TLCORNER        = 3;
export const TRCORNER        = 4;
export const BLCORNER        = 5;
export const BRCORNER        = 6;
export const CROSSWALL       = 7;   // For pretty mazes and special levels
export const TUWALL          = 8;
export const TDWALL          = 9;
export const TLWALL          = 10;
export const TRWALL          = 11;
export const DBWALL          = 12;
export const TREE            = 13;
export const SDOOR           = 14;
export const SCORR           = 15;
export const POOL            = 16;
export const MOAT            = 17;   // pool that doesn't boil
export const WATER           = 18;
export const DRAWBRIDGE_UP   = 19;
export const LAVAPOOL        = 20;
export const LAVAWALL        = 21;
export const IRONBARS        = 22;
export const DOOR            = 23;
export const CORR            = 24;
export const ROOM            = 25;
export const STAIRS          = 26;
export const LADDER          = 27;
export const FOUNTAIN        = 28;
export const THRONE          = 29;
export const SINK            = 30;
export const GRAVE           = 31;
export const ALTAR           = 32;
export const ICE             = 33;
export const DRAWBRIDGE_DOWN = 34;
export const AIR             = 35;
export const CLOUD           = 36;
export const MAX_TYPE        = 37;
export const MATCH_WALL      = 38;
export const INVALID_TYPE    = 127;

// Level type utility macros (from include/rm.h, lines 104-128)
export function IS_WALL(typ)       { return typ !== 0 && typ <= DBWALL; }
export function IS_STWALL(typ)     { return typ <= DBWALL; }
export function IS_OBSTRUCTED(typ) { return typ < POOL; }
export function IS_SDOOR(typ)      { return typ === SDOOR; }
export function IS_DOOR(typ)       { return typ === DOOR; }
export function IS_TREE(typ)       { return typ === TREE; }
export function ACCESSIBLE(typ)    { return typ >= DOOR; }
export function IS_ROOM(typ)       { return typ >= ROOM; }
export function ZAP_POS(typ)       { return typ >= POOL; }
export function SPACE_POS(typ)     { return typ > DOOR; }
export function IS_POOL(typ)       { return typ >= POOL && typ <= DRAWBRIDGE_UP; }
export function IS_LAVA(typ)       { return typ === LAVAPOOL || typ === LAVAWALL; }
export function IS_THRONE(typ)     { return typ === THRONE; }
export function IS_FOUNTAIN(typ)   { return typ === FOUNTAIN; }
export function IS_SINK(typ)       { return typ === SINK; }
export function IS_GRAVE(typ)      { return typ === GRAVE; }
export function IS_ALTAR(typ)      { return typ === ALTAR; }
export function IS_DRAWBRIDGE(typ) { return typ === DRAWBRIDGE_UP || typ === DRAWBRIDGE_DOWN; }
export function IS_FURNITURE(typ)  { return typ >= STAIRS && typ <= ALTAR; }
export function IS_AIR(typ)        { return typ === AIR || typ === CLOUD; }
export function IS_SOFT(typ)       { return typ === AIR || typ === CLOUD || IS_POOL(typ); }
export function IS_WATERWALL(typ)  { return typ === WATER; }

// Door flags (from include/rm.h, lines 220-227)
export const D_NODOOR  = 0x00;
export const D_BROKEN  = 0x01;
export const D_ISOPEN  = 0x02;
export const D_CLOSED  = 0x04;
export const D_LOCKED  = 0x08;
export const D_TRAPPED = 0x10;
export const D_SECRET  = 0x20;

// ==========================================================================
// 4. Monster Class Symbols (from include/defsym.h, lines 295-367)
//    MONSYM(idx, ch, basename, sym, desc)
//    Drawing form: { DEF_basename, "", desc }
//    We store: { sym (character), name (empty string), explain (desc) }
// ==========================================================================

// Monster class S_* enum values (from MONSYMS_S_ENUM)
export const S_ANT         = 1;
export const S_BLOB        = 2;
export const S_COCKATRICE  = 3;
export const S_DOG         = 4;
export const S_EYE         = 5;
export const S_FELINE      = 6;
export const S_GREMLIN     = 7;
export const S_HUMANOID    = 8;
export const S_IMP         = 9;
export const S_JELLY       = 10;
export const S_KOBOLD      = 11;
export const S_LEPRECHAUN  = 12;
export const S_MIMIC       = 13;
export const S_NYMPH       = 14;
export const S_ORC         = 15;
export const S_PIERCER     = 16;
export const S_QUADRUPED   = 17;
export const S_RODENT      = 18;
export const S_SPIDER      = 19;
export const S_TRAPPER     = 20;
export const S_UNICORN     = 21;
export const S_VORTEX      = 22;
export const S_WORM        = 23;
export const S_XAN         = 24;
export const S_LIGHT       = 25;
export const S_ZRUTY       = 26;
export const S_ANGEL       = 27;
export const S_BAT         = 28;
export const S_CENTAUR     = 29;
export const S_DRAGON      = 30;
export const S_ELEMENTAL   = 31;
export const S_FUNGUS      = 32;
export const S_GNOME       = 33;
export const S_GIANT       = 34;
export const S_invisible   = 35;
export const S_JABBERWOCK  = 36;
export const S_KOP         = 37;
export const S_LICH        = 38;
export const S_MUMMY       = 39;
export const S_NAGA        = 40;
export const S_OGRE        = 41;
export const S_PUDDING     = 42;
export const S_QUANTMECH   = 43;
export const S_RUSTMONST   = 44;
export const S_SNAKE       = 45;
export const S_TROLL       = 46;
export const S_UMBER       = 47;
export const S_VAMPIRE     = 48;
export const S_WRAITH      = 49;
export const S_XORN        = 50;
export const S_YETI        = 51;
export const S_ZOMBIE      = 52;
export const S_HUMAN       = 53;
export const S_GHOST       = 54;
export const S_GOLEM       = 55;
export const S_DEMON       = 56;
export const S_EEL         = 57;
export const S_LIZARD      = 58;
export const S_WORM_TAIL   = 59;
export const S_MIMIC_DEF   = 60;
export const MAXMCLASSES   = 61;  // number of monster classes

// The def_monsyms[] array (from drawing.c lines 32-37 + defsym.h MONSYMS)
// Each entry: { sym, name, explain }
// Index 0 is the placeholder for "random class"
export const def_monsyms = [
    // idx  0: placeholder
    { sym: '\0', name: "",  explain: "" },
    // idx  1: S_ANT
    { sym: 'a',  name: "",  explain: "ant or other insect" },
    // idx  2: S_BLOB
    { sym: 'b',  name: "",  explain: "blob" },
    // idx  3: S_COCKATRICE
    { sym: 'c',  name: "",  explain: "cockatrice" },
    // idx  4: S_DOG
    { sym: 'd',  name: "",  explain: "dog or other canine" },
    // idx  5: S_EYE
    { sym: 'e',  name: "",  explain: "eye or sphere" },
    // idx  6: S_FELINE
    { sym: 'f',  name: "",  explain: "cat or other feline" },
    // idx  7: S_GREMLIN
    { sym: 'g',  name: "",  explain: "gremlin" },
    // idx  8: S_HUMANOID (hobbit, dwarf)
    { sym: 'h',  name: "",  explain: "humanoid" },
    // idx  9: S_IMP
    { sym: 'i',  name: "",  explain: "imp or minor demon" },
    // idx 10: S_JELLY
    { sym: 'j',  name: "",  explain: "jelly" },
    // idx 11: S_KOBOLD
    { sym: 'k',  name: "",  explain: "kobold" },
    // idx 12: S_LEPRECHAUN
    { sym: 'l',  name: "",  explain: "leprechaun" },
    // idx 13: S_MIMIC
    { sym: 'm',  name: "",  explain: "mimic" },
    // idx 14: S_NYMPH
    { sym: 'n',  name: "",  explain: "nymph" },
    // idx 15: S_ORC
    { sym: 'o',  name: "",  explain: "orc" },
    // idx 16: S_PIERCER
    { sym: 'p',  name: "",  explain: "piercer" },
    // idx 17: S_QUADRUPED (excludes horses)
    { sym: 'q',  name: "",  explain: "quadruped" },
    // idx 18: S_RODENT
    { sym: 'r',  name: "",  explain: "rodent" },
    // idx 19: S_SPIDER
    { sym: 's',  name: "",  explain: "arachnid or centipede" },
    // idx 20: S_TRAPPER
    { sym: 't',  name: "",  explain: "trapper or lurker above" },
    // idx 21: S_UNICORN (unicorn, horses)
    { sym: 'u',  name: "",  explain: "unicorn or horse" },
    // idx 22: S_VORTEX
    { sym: 'v',  name: "",  explain: "vortex" },
    // idx 23: S_WORM
    { sym: 'w',  name: "",  explain: "worm" },
    // idx 24: S_XAN
    { sym: 'x',  name: "",  explain: "xan or other mythical/fantastic insect" },
    // idx 25: S_LIGHT (yellow light, black light)
    { sym: 'y',  name: "",  explain: "light" },
    // idx 26: S_ZRUTY
    { sym: 'z',  name: "",  explain: "zruty" },
    // idx 27: S_ANGEL
    { sym: 'A',  name: "",  explain: "angelic being" },
    // idx 28: S_BAT
    { sym: 'B',  name: "",  explain: "bat or bird" },
    // idx 29: S_CENTAUR
    { sym: 'C',  name: "",  explain: "centaur" },
    // idx 30: S_DRAGON
    { sym: 'D',  name: "",  explain: "dragon" },
    // idx 31: S_ELEMENTAL (includes invisible stalker)
    { sym: 'E',  name: "",  explain: "elemental" },
    // idx 32: S_FUNGUS
    { sym: 'F',  name: "",  explain: "fungus or mold" },
    // idx 33: S_GNOME
    { sym: 'G',  name: "",  explain: "gnome" },
    // idx 34: S_GIANT (giant, ettin, minotaur)
    { sym: 'H',  name: "",  explain: "giant humanoid" },
    // idx 35: S_invisible
    { sym: 'I',  name: "",  explain: "invisible monster" },
    // idx 36: S_JABBERWOCK
    { sym: 'J',  name: "",  explain: "jabberwock" },
    // idx 37: S_KOP
    { sym: 'K',  name: "",  explain: "Keystone Kop" },
    // idx 38: S_LICH
    { sym: 'L',  name: "",  explain: "lich" },
    // idx 39: S_MUMMY
    { sym: 'M',  name: "",  explain: "mummy" },
    // idx 40: S_NAGA
    { sym: 'N',  name: "",  explain: "naga" },
    // idx 41: S_OGRE
    { sym: 'O',  name: "",  explain: "ogre" },
    // idx 42: S_PUDDING
    { sym: 'P',  name: "",  explain: "pudding or ooze" },
    // idx 43: S_QUANTMECH
    { sym: 'Q',  name: "",  explain: "quantum mechanic" },
    // idx 44: S_RUSTMONST
    { sym: 'R',  name: "",  explain: "rust monster or disenchanter" },
    // idx 45: S_SNAKE
    { sym: 'S',  name: "",  explain: "snake" },
    // idx 46: S_TROLL
    { sym: 'T',  name: "",  explain: "troll" },
    // idx 47: S_UMBER
    { sym: 'U',  name: "",  explain: "umber hulk" },
    // idx 48: S_VAMPIRE
    { sym: 'V',  name: "",  explain: "vampire" },
    // idx 49: S_WRAITH
    { sym: 'W',  name: "",  explain: "wraith" },
    // idx 50: S_XORN
    { sym: 'X',  name: "",  explain: "xorn" },
    // idx 51: S_YETI (apelike creature includes owlbear, monkey)
    { sym: 'Y',  name: "",  explain: "apelike creature" },
    // idx 52: S_ZOMBIE
    { sym: 'Z',  name: "",  explain: "zombie" },
    // idx 53: S_HUMAN
    { sym: '@',  name: "",  explain: "human or elf" },
    // idx 54: S_GHOST
    { sym: ' ',  name: "",  explain: "ghost" },
    // idx 55: S_GOLEM
    { sym: '\'', name: "",  explain: "golem" },
    // idx 56: S_DEMON
    { sym: '&',  name: "",  explain: "major demon" },
    // idx 57: S_EEL (fish/sea monster)
    { sym: ';',  name: "",  explain: "sea monster" },
    // idx 58: S_LIZARD (reptiles)
    { sym: ':',  name: "",  explain: "lizard" },
    // idx 59: S_WORM_TAIL
    { sym: '~',  name: "",  explain: "long worm tail" },
    // idx 60: S_MIMIC_DEF
    { sym: ']',  name: "",  explain: "mimic" },
];

// ==========================================================================
// 5. Object Class Symbols (from include/defsym.h, lines 466-484)
//    OBJCLASS(idx, ch, basename, sym, name, explain)
//    Drawing form: { basename_SYM, name, explain }
// ==========================================================================

// Object class S_* enum values (from OBJCLASS_S_ENUM)
export const S_strange_obj = 1;
export const S_weapon      = 2;
export const S_armor       = 3;
export const S_ring        = 4;
export const S_amulet      = 5;
export const S_tool        = 6;
export const S_food        = 7;
export const S_potion      = 8;
export const S_scroll      = 9;
export const S_book        = 10;
export const S_wand        = 11;
export const S_coin        = 12;
export const S_gem         = 13;
export const S_rock        = 14;
export const S_ball        = 15;
export const S_chain       = 16;
export const S_venom       = 17;
export const MAXOCLASSES   = 18;  // number of object classes (17 + placeholder)

// Object class *_CLASS enum values (from OBJCLASS_CLASS_ENUM)
export const ILLOBJ_CLASS   = 1;
export const WEAPON_CLASS   = 2;
export const ARMOR_CLASS    = 3;
export const RING_CLASS     = 4;
export const AMULET_CLASS   = 5;
export const TOOL_CLASS     = 6;
export const FOOD_CLASS     = 7;
export const POTION_CLASS   = 8;
export const SCROLL_CLASS   = 9;
export const SPBOOK_CLASS   = 10;
export const WAND_CLASS     = 11;
export const COIN_CLASS     = 12;
export const GEM_CLASS      = 13;
export const ROCK_CLASS     = 14;
export const BALL_CLASS     = 15;
export const CHAIN_CLASS    = 16;
export const VENOM_CLASS    = 17;

// Default character symbols for object classes (from OBJCLASS_DEFCHAR_ENUM)
export const ILLOBJ_SYM = ']'.charCodeAt(0);
export const WEAPON_SYM = ')'.charCodeAt(0);
export const ARMOR_SYM  = '['.charCodeAt(0);
export const RING_SYM   = '='.charCodeAt(0);
export const AMULET_SYM = '"'.charCodeAt(0);
export const TOOL_SYM   = '('.charCodeAt(0);
export const FOOD_SYM   = '%'.charCodeAt(0);
export const POTION_SYM = '!'.charCodeAt(0);
export const SCROLL_SYM = '?'.charCodeAt(0);
export const SPBOOK_SYM = '+'.charCodeAt(0);
export const WAND_SYM   = '/'.charCodeAt(0);
export const GOLD_SYM   = '$'.charCodeAt(0);  // OBJCLASS2 special case
export const GEM_SYM    = '*'.charCodeAt(0);
export const ROCK_SYM   = '`'.charCodeAt(0);
export const BALL_SYM   = '0'.charCodeAt(0);
export const CHAIN_SYM  = '_'.charCodeAt(0);
export const VENOM_SYM  = '.'.charCodeAt(0);

// The def_oc_syms[] array (from drawing.c lines 24-29 + defsym.h OBJCLASS_DRAWING)
// Each entry: { sym, name, explain }
// Index 0 is the placeholder for the "random class"
export const def_oc_syms = [
    // idx  0: placeholder for "random class"
    { sym: '\0', name: "",               explain: "" },
    // idx  1: ILLOBJ_CLASS
    { sym: ']',  name: "illegal objects", explain: "strange object" },
    // idx  2: WEAPON_CLASS
    { sym: ')',  name: "weapons",         explain: "weapon" },
    // idx  3: ARMOR_CLASS
    { sym: '[',  name: "armor",           explain: "suit or piece of armor" },
    // idx  4: RING_CLASS
    { sym: '=',  name: "rings",           explain: "ring" },
    // idx  5: AMULET_CLASS
    { sym: '"',  name: "amulets",         explain: "amulet" },
    // idx  6: TOOL_CLASS
    { sym: '(',  name: "tools",           explain: "useful item (pick-axe, key, lamp...)" },
    // idx  7: FOOD_CLASS
    { sym: '%',  name: "food",            explain: "piece of food" },
    // idx  8: POTION_CLASS
    { sym: '!',  name: "potions",         explain: "potion" },
    // idx  9: SCROLL_CLASS
    { sym: '?',  name: "scrolls",         explain: "scroll" },
    // idx 10: SPBOOK_CLASS
    { sym: '+',  name: "spellbooks",      explain: "spellbook" },
    // idx 11: WAND_CLASS
    { sym: '/',  name: "wands",           explain: "wand" },
    // idx 12: COIN_CLASS (uses GOLD_SYM)
    { sym: '$',  name: "coins",           explain: "pile of coins" },
    // idx 13: GEM_CLASS
    { sym: '*',  name: "rocks",           explain: "gem or rock" },
    // idx 14: ROCK_CLASS
    { sym: '`',  name: "large stones",    explain: "boulder or statue" },
    // idx 15: BALL_CLASS
    { sym: '0',  name: "iron balls",      explain: "iron ball" },
    // idx 16: CHAIN_CLASS
    { sym: '_',  name: "chains",          explain: "iron chain" },
    // idx 17: VENOM_CLASS
    { sym: '.',  name: "venoms",          explain: "splash of venom" },
];

// ==========================================================================
// 6. Trap Type Constants (from include/trap.h, lines 57-94)
//    enum trap_types
// ==========================================================================

export const ALL_TRAPS              = -1;  // mon_knows_traps(), mon_learns_traps()
export const NO_TRAP                = 0;
export const ARROW_TRAP             = 1;
export const DART_TRAP              = 2;
export const ROCKTRAP               = 3;
export const SQKY_BOARD             = 4;
export const BEAR_TRAP              = 5;
export const LANDMINE               = 6;
export const ROLLING_BOULDER_TRAP   = 7;
export const SLP_GAS_TRAP           = 8;
export const RUST_TRAP              = 9;
export const FIRE_TRAP              = 10;
export const PIT                    = 11;
export const SPIKED_PIT             = 12;
export const HOLE                   = 13;
export const TRAPDOOR               = 14;
export const TELEP_TRAP             = 15;
export const LEVEL_TELEP            = 16;
export const MAGIC_PORTAL           = 17;
export const WEB                    = 18;
export const STATUE_TRAP            = 19;
export const MAGIC_TRAP             = 20;
export const ANTI_MAGIC             = 21;
export const POLY_TRAP              = 22;
export const VIBRATING_SQUARE       = 23;
export const TRAPPED_DOOR           = 24;
export const TRAPPED_CHEST          = 25;
export const TRAPNUM                = 26;

// Trap utility macros (from include/trap.h)
export function is_pit(ttyp)  { return ttyp === PIT || ttyp === SPIKED_PIT; }
export function is_hole(ttyp) { return ttyp === HOLE || ttyp === TRAPDOOR; }
export function is_magical_trap(ttyp) {
    return ttyp === TELEP_TRAP || ttyp === LEVEL_TELEP
        || ttyp === MAGIC_TRAP || ttyp === ANTI_MAGIC
        || ttyp === POLY_TRAP;
}
export function is_xport(ttyp) { return ttyp >= TELEP_TRAP && ttyp <= MAGIC_PORTAL; }

// Trap <-> defsym conversion (from include/rm.h, lines 483-484)
export function trap_to_defsym(t) { return S_arrow_trap + t - 1; }
export function defsym_to_trap(d) { return d - S_arrow_trap + 1; }

// MAXTCHARS: number of trap characters (from include/sym.h, line 92)
export const MAXTCHARS = TRAPNUM - 1;

// ==========================================================================
// 7. Warning Symbols (from src/drawing.c, lines 39-52)
//    6 warning levels (WARNCOUNT = 6)
// ==========================================================================

export const WARNCOUNT = 6;

export const def_warnsyms = [
    // level 0: white warning
    { ch: '0', desc: "unknown creature causing you worry",    color: CLR_WHITE },
    // level 1: pink warning
    { ch: '1', desc: "unknown creature causing you concern",  color: CLR_RED },
    // level 2: red warning
    { ch: '2', desc: "unknown creature causing you anxiety",  color: CLR_RED },
    // level 3: ruby warning
    { ch: '3', desc: "unknown creature causing you disquiet", color: CLR_RED },
    // level 4: purple warning
    { ch: '4', desc: "unknown creature causing you alarm",    color: CLR_MAGENTA },
    // level 5: black warning
    { ch: '5', desc: "unknown creature causing you dread",    color: CLR_BRIGHT_MAGENTA },
];

// ==========================================================================
// 8. CSS Color Mapping for Browser Rendering
//    Maps NetHack CLR_* constants to CSS color strings
// ==========================================================================

const cssColorMap = [
    /* CLR_BLACK          0 */ "#555",   // dark gray (pure black invisible on black bg)
    /* CLR_RED            1 */ "#a00",
    /* CLR_GREEN          2 */ "#0a0",
    /* CLR_BROWN          3 */ "#a50",
    /* CLR_BLUE           4 */ "#00a",
    /* CLR_MAGENTA        5 */ "#a0a",
    /* CLR_CYAN           6 */ "#0aa",
    /* CLR_GRAY           7 */ "#ccc",
    /* NO_COLOR           8 */ "#f80",   // bright orange (NO_COLOR / CLR_ORANGE alias)
    /* CLR_ORANGE         9 */ "#f80",
    /* CLR_BRIGHT_GREEN  10 */ "#0f0",
    /* CLR_YELLOW        11 */ "#ff0",
    /* CLR_BRIGHT_BLUE   12 */ "#55f",
    /* CLR_BRIGHT_MAGENTA 13 */ "#f5f",
    /* CLR_BRIGHT_CYAN   14 */ "#0ff",
    /* CLR_WHITE         15 */ "#fff",
];

/**
 * Convert a NetHack color constant to a CSS color string suitable
 * for browser rendering on a dark background.
 *
 * @param {number} color - A CLR_* constant (0-15) or NO_COLOR (8)
 * @returns {string} CSS color string (hex)
 */
export function colorToCSS(color) {
    if (color >= 0 && color < cssColorMap.length) {
        return cssColorMap[color];
    }
    return cssColorMap[CLR_GRAY]; // fallback to gray
}

// ==========================================================================
// Misc Symbol Constants (from include/sym.h, lines 111-118)
// ==========================================================================

export const SYM_NOTHING       = 0;
export const SYM_UNEXPLORED    = 1;
export const SYM_BOULDER       = 2;
export const SYM_INVISIBLE     = 3;
export const SYM_PET_OVERRIDE  = 4;
export const SYM_HERO_OVERRIDE = 5;
export const MAXOTHER          = 6;

// Symbol parse range (from include/sym.h, lines 58-65)
export const SYM_INVALID       = 0;
export const SYM_CONTROL       = 1;
export const SYM_PCHAR         = 2;
export const SYM_OC            = 3;
export const SYM_MON           = 4;
export const SYM_OTH           = 5;

// Cmap classification helpers (from include/sym.h, lines 98-108)
export function is_cmap_trap(i)       { return i >= S_arrow_trap && i < S_arrow_trap + MAXTCHARS; }
export function is_cmap_drawbridge(i) { return i >= S_vodbridge && i <= S_hcdbridge; }
export function is_cmap_door(i)       { return i >= S_vodoor && i <= S_hcdoor; }
export function is_cmap_wall(i)       { return i >= S_stone && i <= S_trwall; }
export function is_cmap_room(i)       { return i >= S_room && i <= S_darkroom; }
export function is_cmap_corr(i)       { return i >= S_corr && i <= S_litcorr; }
export function is_cmap_furniture(i)  { return i >= S_upstair && i <= S_fountain; }
export function is_cmap_water(i)      { return i === S_pool || i === S_water; }
export function is_cmap_lava(i)       { return i === S_lava || i === S_lavawall; }
export function is_cmap_stairs(i)     { return i >= S_upstair && i <= S_brdnladder; }
export function is_cmap_engraving(i)  { return i === S_engroom || i === S_engrcorr; }

// ==========================================================================
// DECgraphics Symbol Set
// C ref: dat/symbols DECgraphics symset
// Uses Unicode box-drawing characters for walls and corners
// ==========================================================================

export const decgraphics = [
    // Walls and corners (matching defsyms indices 1-11)
    '│',  // S_vwall (1)   - \xf8 meta-x, vertical rule
    '─',  // S_hwall (2)   - \xf1 meta-q, horizontal rule
    '┌',  // S_tlcorn (3)  - \xec meta-l, top left corner
    '┐',  // S_trcorn (4)  - \xeb meta-k, top right corner
    '└',  // S_blcorn (5)  - \xed meta-m, bottom left
    '┘',  // S_brcorn (6)  - \xea meta-j, bottom right
    '┼',  // S_crwall (7)  - \xee meta-n, cross
    '┴',  // S_tuwall (8)  - \xf6 meta-v, T up
    '┬',  // S_tdwall (9)  - \xf7 meta-w, T down
    '┤',  // S_tlwall (10) - \xf5 meta-u, T left
    '├',  // S_trwall (11) - \xf4 meta-t, T right
];

/**
 * Get the display character for a symbol index
 * @param {number} idx - Symbol index (S_* constant)
 * @param {boolean} useDECgraphics - Whether to use DECgraphics box-drawing chars
 * @returns {string} The character to display
 */
export function getSymbolChar(idx, useDECgraphics = false) {
    // Use DECgraphics for wall symbols (indices 1-11) if enabled
    if (useDECgraphics && idx >= S_vwall && idx <= S_trwall) {
        return decgraphics[idx - 1];  // decgraphics[0] maps to S_vwall (1)
    }
    // Otherwise use default ASCII from defsyms
    return defsyms[idx].ch;
}
