// config.js -- Game constants and configuration
// Mirrors constants from include/hack.h, include/global.h, include/rm.h

// Version (patchlevel.h)
export const VERSION_MAJOR = 3;
export const VERSION_MINOR = 7;
export const PATCHLEVEL = 0;
export const VERSION_STRING = `NetHack JS Version ${VERSION_MAJOR}.${VERSION_MINOR}.${PATCHLEVEL}`;

// Map dimensions (global.h)
export const COLNO = 80;   // number of columns
export const ROWNO = 21;   // number of rows (map area)

// Display dimensions
export const TERMINAL_COLS = 80;
export const TERMINAL_ROWS = 24;  // message + map + 2 status lines
export const MESSAGE_ROW = 0;
export const MAP_ROW_START = 1;
export const STATUS_ROW_1 = 22;
export const STATUS_ROW_2 = 23;

// Level location types (rm.h:55-97)
export const STONE = 0;
export const VWALL = 1;
export const HWALL = 2;
export const TLCORNER = 3;
export const TRCORNER = 4;
export const BLCORNER = 5;
export const BRCORNER = 6;
export const CROSSWALL = 7;
export const TUWALL = 8;
export const TDWALL = 9;
export const TLWALL = 10;
export const TRWALL = 11;
export const DBWALL = 12;
export const TREE = 13;
export const SDOOR = 14;
export const SCORR = 15;
export const POOL = 16;
export const MOAT = 17;
export const WATER = 18;
export const DRAWBRIDGE_UP = 19;
export const LAVAPOOL = 20;
export const LAVAWALL = 21;
export const IRONBARS = 22;
export const DOOR = 23;
export const CORR = 24;
export const ROOM = 25;
export const STAIRS = 26;
export const LADDER = 27;
export const FOUNTAIN = 28;
export const THRONE = 29;
export const SINK = 30;
export const GRAVE = 31;
export const ALTAR = 32;
export const ICE = 33;
export const DRAWBRIDGE_DOWN = 34;
export const AIR = 35;
export const CLOUD = 36;
export const MAX_TYPE = 37;

// Door states (rm.h)
export const D_NODOOR = 0;
export const D_BROKEN = 1;
export const D_ISOPEN = 2;
export const D_CLOSED = 4;
export const D_LOCKED = 8;
export const D_TRAPPED = 16;
export const D_SECRET = 32;

// Movement speed (hack.h)
export const NORMAL_SPEED = 12;

// Direction arrays (decl.h, hack.c)
// Index: 0=W, 1=NW, 2=N, 3=NE, 4=E, 5=SE, 6=S, 7=SW, 8=up, 9=down
export const xdir = [-1, -1,  0,  1,  1,  1,  0, -1, 0,  0];
export const ydir = [ 0, -1, -1, -1,  0,  1,  1,  1, 0,  0];
export const zdir = [0, 0, 0, 0, 0, 0, 0, 0, 1, -1];

// Direction constants
export const DIR_W = 0;
export const DIR_NW = 1;
export const DIR_N = 2;
export const DIR_NE = 3;
export const DIR_E = 4;
export const DIR_SE = 5;
export const DIR_S = 6;
export const DIR_SW = 7;
export const DIR_UP = 8;
export const DIR_DOWN = 9;
export const N_DIRS = 8;
export function DIR_180(dir) { return (dir + 4) % N_DIRS; }

// Encumbrance levels (hack.h)
export const UNENCUMBERED = 0;
export const SLT_ENCUMBER = 1;
export const MOD_ENCUMBER = 2;
export const HVY_ENCUMBER = 3;
export const EXT_ENCUMBER = 4;
export const OVERLOADED = 5;

// Alignment (align.h)
export const A_NONE = -128;
export const A_CHAOTIC = -1;
export const A_NEUTRAL = 0;
export const A_LAWFUL = 1;

// Gender
export const MALE = 0;
export const FEMALE = 1;
export const NEUTER = 2;

// Races
export const RACE_HUMAN = 0;
export const RACE_ELF = 1;
export const RACE_DWARF = 2;
export const RACE_GNOME = 3;
export const RACE_ORC = 4;

// Roles (role.c) - just the basic set for initial implementation
export const PM_ARCHEOLOGIST = 0;
export const PM_BARBARIAN = 1;
export const PM_CAVEMAN = 2;
export const PM_HEALER = 3;
export const PM_KNIGHT = 4;
export const PM_MONK = 5;
export const PM_PRIEST = 6;
export const PM_RANGER = 7;
export const PM_ROGUE = 8;
export const PM_SAMURAI = 9;
export const PM_TOURIST = 10;
export const PM_VALKYRIE = 11;
export const PM_WIZARD = 12;

// Attributes (attrib.h)
export const A_STR = 0;
export const A_INT = 1;
export const A_WIS = 2;
export const A_DEX = 3;
export const A_CON = 4;
export const A_CHA = 5;
export const NUM_ATTRS = 6;

// Room types (mkroom.h)
export const OROOM = 0;
export const THEMEROOM = 1;
export const COURT = 2;
export const SWAMP = 3;
export const VAULT = 4;
export const BEEHIVE = 5;
export const MORGUE = 6;
export const BARRACKS = 7;
export const ZOO = 8;
export const DELPHI = 9;
export const TEMPLE = 10;
export const LEPREHALL = 11;
export const COCKNEST = 12;
export const ANTHOLE = 13;
export const SHOPBASE = 14;

// Window types (wintype.h)
export const NHW_MESSAGE = 1;
export const NHW_STATUS = 2;
export const NHW_MAP = 3;
export const NHW_MENU = 4;
export const NHW_TEXT = 5;

// Maximum values
export const MAXNROFROOMS = 40;
export const MAXDUNGEON = 16;
export const MAXLEVEL = 32;
export const MAXOCLASSES = 18;
export const MAXMCLASSES = 34;
export const ROOMOFFSET = 3;

// Check if position is within map bounds (global.h)
export function isok(x, y) {
    return x >= 1 && x < COLNO - 1 && y >= 0 && y < ROWNO;
}

// Check terrain type helpers (rm.h)
export function IS_WALL(typ) {
    return typ >= VWALL && typ <= TRWALL;
}
export function IS_STWALL(typ) {
    return typ <= DBWALL; // includes STONE and all wall types
}
export function IS_ROCK(typ) {
    return typ < POOL;
}
export function IS_DOOR(typ) {
    return typ === DOOR;
}
export function IS_ROOM(typ) {
    // C ref: rm.h -- #define IS_ROOM(typ) ((typ) >= ROOM)
    return typ >= ROOM;
}
export function IS_FURNITURE(typ) {
    return typ >= STAIRS && typ <= ALTAR;
}
export function ACCESSIBLE(typ) {
    // C ref: rm.h -- #define ACCESSIBLE(typ) ((typ) >= DOOR)
    return typ >= DOOR;
}
export function IS_POOL(typ) {
    return typ === POOL || typ === MOAT || typ === WATER;
}
export function IS_LAVA(typ) {
    return typ === LAVAPOOL;
}
export function IS_OBSTRUCTED(typ) {
    return IS_STWALL(typ) || typ === TREE || typ === IRONBARS;
}

// Trap types (trap.h)
export const NO_TRAP = 0;
export const ARROW_TRAP = 1;
export const DART_TRAP = 2;
export const ROCKTRAP = 3;
export const SQKY_BOARD = 4;
export const BEAR_TRAP = 5;
export const LANDMINE = 6;
export const ROLLING_BOULDER_TRAP = 7;
export const SLP_GAS_TRAP = 8;
export const RUST_TRAP = 9;
export const FIRE_TRAP = 10;
export const PIT = 11;
export const SPIKED_PIT = 12;
export const HOLE = 13;
export const TRAPDOOR = 14;
export const TELEP_TRAP = 15;
export const LEVEL_TELEP = 16;
export const MAGIC_PORTAL = 17;
export const WEB = 18;
export const STATUE_TRAP = 19;
export const MAGIC_TRAP = 20;
export const ANTI_MAGIC = 21;
export const POLY_TRAP = 22;
export const VIBRATING_SQUARE = 23;
export const TRAPPED_DOOR = 24;
export const TRAPPED_CHEST = 25;
export const TRAPNUM = 26;

// Trap helpers (trap.h)
export function is_pit(ttyp) { return ttyp === PIT || ttyp === SPIKED_PIT; }
export function is_hole(ttyp) { return ttyp === HOLE || ttyp === TRAPDOOR; }

// Trap flags for mktrap
export const MKTRAP_NOFLAGS = 0;
export const MKTRAP_SEEN = 0x01;
export const MKTRAP_MAZEFLAG = 0x02;
export const MKTRAP_NOSPIDERONWEB = 0x04;
export const MKTRAP_NOVICTIM = 0x08;
