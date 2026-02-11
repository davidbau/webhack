/**
 * Special level generation (des.* Lua API)
 *
 * This module implements the des.* API functions used by NetHack's special
 * level Lua scripts. It provides a JavaScript equivalent of the C sp_lev.c
 * implementation, allowing direct porting of Lua level definition files.
 *
 * C reference: nethack-c/src/sp_lev.c
 *
 * Architecture:
 * - Each des.* function manipulates a global level state
 * - Level generation proceeds in phases: init → map placement → features → finalize
 * - The API is designed to be called from transpiled Lua → JS level files
 */

import { GameMap, FILL_NORMAL } from './map.js';
import { rn2, rnd, rn1, getRngCallCount } from './rng.js';
import { mksobj, mkobj } from './mkobj.js';
import { create_room, create_subroom, makecorridors, init_rect, rnd_rect, get_rect, check_room, add_doors_to_room, update_rect_pool_for_room, bound_digging, mineralize, fill_ordinary_room, litstate_rnd, isMtInitialized, setMtInitialized } from './dungeon.js';
import { seedFromMT } from './xoshiro256.js';
import {
    STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, ROOM, CORR,
    DOOR, SDOOR, IRONBARS, TREE, FOUNTAIN, POOL, MOAT, WATER,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, LAVAPOOL, LAVAWALL, ICE, CLOUD, AIR,
    STAIRS, LADDER, ALTAR, GRAVE, THRONE, SINK,
    PIT, SPIKED_PIT, HOLE, TRAPDOOR, ARROW_TRAP, DART_TRAP,
    SQKY_BOARD, BEAR_TRAP, LANDMINE, ROLLING_BOULDER_TRAP,
    SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP, TELEP_TRAP, LEVEL_TELEP,
    MAGIC_PORTAL, ANTI_MAGIC, POLY_TRAP, STATUE_TRAP, MAGIC_TRAP,
    VIBRATING_SQUARE,
    D_NODOOR, D_ISOPEN, D_CLOSED, D_LOCKED, D_BROKEN,
    COLNO, ROWNO
} from './config.js';
import {
    BOULDER, SCROLL_CLASS, FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS,
    POTION_CLASS, RING_CLASS, WAND_CLASS, TOOL_CLASS, AMULET_CLASS,
    GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS,
    SCR_EARTH, objectData
} from './objects.js';

// Aliases for compatibility with C naming
const STAIRS_UP = STAIRS;
const STAIRS_DOWN = STAIRS;
const LADDER_UP = LADDER;
const LADDER_DOWN = LADDER;

// Level generation state (equivalent to C's sp_level sp)
export let levelState = {
    map: null,              // GameMap instance being built
    flags: {
        noteleport: false,
        hardfloor: false,
        nommap: false,
        shortsighted: false,
        arboreal: false,
        is_maze_lev: false,
        hero_memory: false,
        graveyard: false,
        corrmaze: false,
        temperature: 0,     // 0=temperate, 1=hot, -1=cold
        rndmongen: true,
        deathdrops: true,
        noautosearch: false,
        fumaroles: false,
        stormy: false,
    },
    coder: {
        premapped: false,
        solidify: false,
        allow_flips: 3,     // bit 0=vertical flip, bit 1=horizontal flip
        check_inaccessibles: false,
    },
    init: {
        style: 'solidfill', // solidfill, mazegrid, maze, rogue, mines, swamp
        fg: ROOM,           // foreground fill character
        bg: STONE,          // background fill character
        smoothed: false,
        joined: false,
        lit: 0,
        walled: false,
    },
    xstart: 0,              // Map placement offset X
    ystart: 0,              // Map placement offset Y
    xsize: 0,               // Map fragment width
    ysize: 0,               // Map fragment height
    // Room tracking (for nested rooms in special levels)
    currentRoom: null,      // Current room being populated
    roomStack: [],          // Stack of nested rooms
    roomDepth: 0,           // Current nesting depth
    // Deferred execution queues (for RNG alignment with C)
    // C defers object/monster/trap placement until after corridor generation
    deferredObjects: [],    // Queued object placements
    deferredMonsters: [],   // Queued monster placements
    deferredTraps: [],      // Queued trap placements
};

// Special level flags
let icedpools = false;
let Sokoban = false;

// ========================================================================
// State Management API (for dungeon.js integration)
// These functions allow procedural generation to use des.* API
// ========================================================================

/**
 * Set the level context for des.* functions to operate on a procedural map.
 * Call this before invoking themed room generation from dungeon.js.
 *
 * @param {GameMap} map - The procedural dungeon map to operate on
 * @param {number} depth - Current dungeon depth (for level_difficulty)
 */
export function setLevelContext(map, depth) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';

    levelState.map = map;
    levelState.depth = depth || 1;
    levelState.roomStack = [];
    levelState.roomDepth = 0;
    levelState.currentRoom = null;

    // Lua RNG counter for themed rooms: Initialize to 0 ONLY on first call (undefined)
    // Once MT is initialized, preserve luaRngCounter across all themed rooms in this level
    // C ref: MT is initialized ONCE per level, not per themed room
    const oldCounter = levelState.luaRngCounter;
    if (levelState.luaRngCounter === undefined) {
        levelState.luaRngCounter = 0;  // First call - will trigger MT init on first Lua RNG usage
    }
    // else: keep existing luaRngCounter value (MT already initialized)

    // Callback for room creation failure (set by themed room generator)
    levelState.roomFailureCallback = null;

    if (DEBUG) {
        console.log(`\n[setLevelContext] depth=${depth}, luaRngCounter: ${oldCounter} → ${levelState.luaRngCounter}`);
    }
}

/**
 * Clear the level context after themed room generation completes.
 * Always call this to prevent state leakage between levels.
 */
export function clearLevelContext() {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';

    if (DEBUG) {
        console.log(`\n[clearLevelContext] Clearing map context, resetting MT flag (keeping luaRngCounter=${levelState.luaRngCounter})`);
    }

    levelState.map = null;
    levelState.depth = 1;
    levelState.roomStack = [];
    levelState.roomDepth = 0;
    levelState.currentRoom = null;

    // C ref: Each themed room gets fresh MT init. Reset flag between rooms.
    // luaRngCounter continues to increment across all themed rooms.
    resetMtInitFlag();
}

/**
 * Set the current room context for nested des.* calls.
 * Used by themeroom_fill to establish room context.
 *
 * @param {Object} room - Room object from map.rooms[]
 */
export function setCurrentRoom(room) {
    levelState.currentRoom = room;
}

// ========================================================================
// Helper Functions (sp_lev.c internal functions)
// ========================================================================

/**
 * Initialize Lua MT19937 RNG state (lazy initialization).
 * C ref: This happens when Lua's math.random() is first called from themed room code.
 * Pattern observed from C RNG trace: rn2(1000-1004), rn2(1010), rn2(1012), rn2(1014-1036)
 *
 * This is called lazily on the first Lua RNG use (des.object/des.monster) to match C behavior.
 */
// Internal flag to prevent double MT initialization
let _mtInitializedLocal = false;

let _mtCallCount = 0;

// Reset MT initialization flag (called between themed room generations)
export function resetMtInitFlag() {
    _mtInitializedLocal = false;
}

export function initLuaMT() {
    _mtCallCount++;
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';

    if (DEBUG) {
        const rngCount = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
        const stack = new Error().stack.split('\n').slice(2, 4).join('\n');
        console.log(`\n[RNG ${rngCount}] [initLuaMT call #${_mtCallCount}] flag=${_mtInitializedLocal}`);
        console.log(`Stack:\n${stack}`);
    }

    // Check if already initialized (prevent double init within same themed room)
    if (_mtInitializedLocal) {
        if (DEBUG) {
            console.log(`  → SKIPPING (already initialized)`);
        }
        return;
    }

    if (DEBUG) {
        console.log(`  → EXECUTING MT PATTERN NOW`);
        console.log(`luaRngCounter BEFORE init: ${levelState ? levelState.luaRngCounter : 'no levelState'}`);
    }

    // Capture MT init values to seed xoshiro for THIS themed room
    const mtInitValues = [];
    for (let i = 1000; i <= 1004; i++) mtInitValues.push(rn2(i));
    mtInitValues.push(rn2(1010));
    mtInitValues.push(rn2(1012));
    for (let i = 1014; i <= 1036; i++) mtInitValues.push(rn2(i));
    _mtInitializedLocal = true;

    // Seed xoshiro256** for THIS themed room's reservoir sampling
    // C ref: Each themed room might get fresh Lua state with fresh math.random seed
    if (typeof seedFromMT === 'function') {
        seedFromMT(mtInitValues);
    }

    if (DEBUG) {
        const rngCount = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
        console.log(`  → [RNG ${rngCount}] MT pattern completed, flag now=${_mtInitializedLocal}`);
    }
    // Advance luaRngCounter to account for MT init calls (30 RNG calls total)
    // MT init pattern: 1000-1004(5), 1010(1), 1012(1), 1014-1036(23) = 30 calls
    // BUT counter should be 37 because offsets continue: next calls use 1037+
    // C ref: seed 4 trace shows first object after MT uses same gap pattern
    if (levelState && levelState.luaRngCounter !== undefined) {
        levelState.luaRngCounter = 37;  // Offset after 1036, continuing the sequence
        if (DEBUG) {
            console.log(`luaRngCounter AFTER init: ${levelState.luaRngCounter}`);
        }
    } else if (DEBUG) {
        console.log(`luaRngCounter NOT updated (was undefined or no levelState)`);
    }
}

/**
 * Create a room for special levels using sp_lev.c's room placement algorithm.
 * C ref: sp_lev.c:1486-1650 create_room()
 *
 * This differs from procedural dungeon.js create_room() in RNG usage and placement logic.
 * Special level rooms use fixed grid positions (1-5 for x/y) with alignment, while
 * procedural rooms use BSP rectangle selection.
 *
 * @param {number} x - X grid position (1-5) or -1 for random
 * @param {number} y - Y grid position (1-5) or -1 for random
 * @param {number} w - Room width or -1 for random
 * @param {number} h - Room height or -1 for random
 * @param {number} xalign - Horizontal alignment: 1=left, 2=center, 3=right, -1=random
 * @param {number} yalign - Vertical alignment: 1=top, 2=center, 3=bottom, -1=random
 * @param {number} rtype - Room type (OROOM=0, shop types, etc.)
 * @param {number} rlit - Lighting: -1=random, 0=unlit, 1=lit
 * @param {number} depth - Current dungeon depth (for litstate_rnd)
 * @returns {Object|null} Room object {lx, ly, hx, hy, rtype, rlit} or null on failure
 */
function create_room_splev(x, y, w, h, xalign, yalign, rtype, rlit, depth, skipLitstate = false, forceRandomize = false, deferCreateRoom = false) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_ROOMS === '1';
    const DEBUG_BUILD = typeof process !== 'undefined' && process.env.DEBUG_BUILD_ROOM === '1';
    if (DEBUG || DEBUG_BUILD) {
        const rngBefore = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
        console.log(`[RNG ${rngBefore}] create_room_splev: x=${x}, y=${y}, w=${w}, h=${h}, xalign=${xalign}, yalign=${yalign}, skipLitstate=${skipLitstate}, deferCreateRoom=${deferCreateRoom}`);
    }

    // C ref: sp_lev.c:1498 — -1 means OROOM (ordinary room)
    if (rtype === -1) {
        rtype = 0; // OROOM
    }

    // C ref: sp_lev.c:1510 — Call litstate_rnd FIRST, before any path checks
    // C calls litstate_rnd for top-level rooms, but nested rooms skip it HERE
    // Nested rooms will call litstate_rnd later during room finalization
    let lit;
    if (skipLitstate) {
        // Nested rooms: keep lit undetermined so litstate_rnd will be called during finalization
        lit = rlit;  // Keep original value (usually -1 for undetermined)
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev skipping litstate_rnd, keeping lit=${lit}`);
        }
    } else {
        if (DEBUG_BUILD) {
            const rngBefore = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
            console.log(`  [RNG ${rngBefore}] create_room_splev calling litstate_rnd(${rlit}, ${depth})`);
        }
        lit = litstate_rnd(rlit, depth);
        if (DEBUG_BUILD) {
            const rngAfter = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
            console.log(`  [RNG ${rngAfter}] create_room_splev litstate_rnd returned ${lit}`);
        }
    }

    // C ref: sp_lev.c:1530-1572 — Check which placement path to use
    // Path 1: "Totally random" — ALL params -1 or vault → uses rnd_rect() + BSP
    // Path 2: "Some params random" — grid placement with alignment

    const fullyRandom = (x < 0 && y < 0 && w < 0 && xalign < 0 && yalign < 0);
    if (DEBUG) console.log(`  fullyRandom=${fullyRandom}`);

    if (fullyRandom) {
        // C ref: sp_lev.c:1534 — totally random uses procedural rnd_rect() + BSP
        // Use dungeon.js create_room which implements this path

        if (!levelState.map) {
            return null; // No map available for BSP room placement
        }

        // If deferCreateRoom is true, return room parameters without actually creating the room
        // This allows caller to call build_room + litstate_rnd before calling create_room
        // C ref: build_room() calls litstate_rnd THEN create_room, not before
        if (deferCreateRoom) {
            if (DEBUG_BUILD) {
                console.log(`  create_room_splev: deferCreateRoom=true, returning params without calling create_room`);
            }
            // Return stub object with parameters for later create_room call
            return {
                _deferredRoom: true,
                x, y, w, h, xalign, yalign,
                rtype, rlit: lit, depth
            };
        }

        // NOTE: MT initialization for room CONTENTS happens AFTER room creation,
        // not before. des.object/des.monster will trigger MT init when needed.
        // Do NOT call initLuaMT() here - it would happen too early in the sequence.

        // Call dungeon.create_room with map - it modifies map directly
        // Returns false if no space available, true on success
        // Pass `lit` (already resolved) instead of `rlit` to avoid double litstate_rnd call
        const success = create_room(levelState.map, x, y, w, h, xalign, yalign,
                                     rtype, lit, depth, false);

        if (!success) {
            return null;
        }

        // Extract the last room that was added to map.rooms
        const room = levelState.map.rooms[levelState.map.rooms.length - 1];

        // C ref: mklev.c - OROOM and THEMEROOM rooms get needfill=FILL_NORMAL
        const OROOM_LOCAL = 0;
        const THEMEROOM_LOCAL = 1;
        if (rtype === OROOM_LOCAL || rtype === THEMEROOM_LOCAL) {
            room.needfill = FILL_NORMAL;
        }

        // Mark this room as already added to map so caller knows to skip duplicate work
        room._alreadyAdded = true;

        return room; // Return the room object for caller
    }

    // C ref: sp_lev.c:1522-1649 — Retry loop for room creation (up to 100 attempts)
    // The loop retries if get_rect or check_room fails
    let r1 = null;
    let trycnt = 0;
    let xabs, yabs, dx, dy;
    let roomValid = false; // Track if room passed check_room

    do {
        // C ref: sp_lev.c:1525-1530 — Reset parameters at start of each retry
        roomValid = false; // Reset for each iteration
        let xtmp = x;
        let ytmp = y;
        let wtmp = w;
        let htmp = h;
        let xaltmp = xalign;
        let yaltmp = yalign;

    // C ref: sp_lev.c:1587-1590 — Position is RANDOM (x < 0 && y < 0)
    // For nested rooms with forceRandomize, ALWAYS randomize position regardless of input
    if (forceRandomize || (xtmp < 0 && ytmp < 0)) {
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev calling rnd(5) for x, rnd(5) for y ${forceRandomize ? '(forced)' : ''}`);
        xtmp = rnd(5);  // Grid position 1-5
        ytmp = rnd(5);
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev got xtmp=${xtmp}, ytmp=${ytmp}`);
    }

    // C ref: sp_lev.c:1592-1594 — Size is RANDOM (w < 0 || h < 0)
    if (wtmp < 0 || htmp < 0) {
        wtmp = rn1(15, 3);  // rnd(15) + 3-1 = 3-17
        htmp = rn1(8, 2);   // rnd(8) + 2-1 = 2-9
    }

    // C ref: sp_lev.c:1596-1597 — Horizontal alignment is RANDOM
    // For nested rooms with forceRandomize, ALWAYS randomize alignment regardless of input
    if (forceRandomize || xaltmp === -1) {
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev calling rnd(3) for xalign ${forceRandomize ? '(forced)' : ''}`);
        xaltmp = rnd(3);  // 1=left, 2=center, 3=right
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev got xaltmp=${xaltmp}`);
    }

    // C ref: sp_lev.c:1598-1599 — Vertical alignment is RANDOM
    // For nested rooms with forceRandomize, ALWAYS randomize alignment regardless of input
    if (forceRandomize || yaltmp === -1) {
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev calling rnd(3) for yalign ${forceRandomize ? '(forced)' : ''}`);
        yaltmp = rnd(3);  // 1=top, 2=center, 3=bottom
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev got yaltmp=${yaltmp}`);
    }

        // C ref: sp_lev.c:1601-1622 — Calculate absolute coordinates from grid position
        // Grid divides map into 5×5 sections: COLNO/5 = 16, ROWNO/5 = 4.2 ≈ 4
        const COLNO_DIV5 = Math.floor(COLNO / 5);  // 16
        const ROWNO_DIV5 = Math.floor(ROWNO / 5);  // 4

        xabs = Math.floor(((xtmp - 1) * COLNO) / 5) + 1;
        yabs = Math.floor(((ytmp - 1) * ROWNO) / 5) + 1;

    // Apply alignment
    switch (xaltmp) {
        case 1: // LEFT
            break;
        case 3: // RIGHT
            xabs += COLNO_DIV5 - wtmp;
            break;
        case 2: // CENTER
            xabs += Math.floor((COLNO_DIV5 - wtmp) / 2);
            break;
    }

    switch (yaltmp) {
        case 1: // TOP
            break;
        case 3: // BOTTOM
            yabs += ROWNO_DIV5 - htmp;
            break;
        case 2: // CENTER
            yabs += Math.floor((ROWNO_DIV5 - htmp) / 2);
            break;
    }

    // C ref: sp_lev.c:1626-1633 — Clamp to map bounds
    if (xabs + wtmp - 1 > COLNO - 2) {
        xabs = COLNO - wtmp - 3;
    }
    if (xabs < 2) {
        xabs = 2;
    }
    if (yabs + htmp - 1 > ROWNO - 2) {
        yabs = ROWNO - htmp - 3;
    }
    if (yabs < 2) {
        yabs = 2;
    }

        // C ref: sp_lev.c:1637-1641 — Create r2 rectangle and find containing rect
        // rndpos is 1 if position was random (original x/y were -1), else 0
        const rndpos = (x < 0 && y < 0) ? 1 : 0;
        const r2 = {
            lx: xabs - 1,
            ly: yabs - 1,
            hx: xabs + wtmp + rndpos,
            hy: yabs + htmp + rndpos
        };

        r1 = get_rect(r2);
        if (!r1) {
            continue; // No rectangle found, retry
        }

        // C ref: sp_lev.c:1642-1647 — Set dx/dy and call check_room to validate
        dx = wtmp;
        dy = htmp;

        // C ref: sp_lev.c:1645 — Call check_room to validate placement
        // check_room may shrink the room if overlaps detected, or fail entirely
        // It calls rn2(3) when overlap is detected
        const vault = false; // Special levels don't create vaults in this path
        const inThemerooms = false; // We're not in themerooms mode here

        const checkResult = check_room(levelState.map, xabs, dx, yabs, dy, vault, inThemerooms);
        if (!checkResult) {
            r1 = null; // C ref: sp_lev.c:1646 — Set r1=0 to retry
            continue;
        }

        // Update dimensions if check_room shrunk the room
        xabs = checkResult.lowx;
        yabs = checkResult.lowy;
        dx = checkResult.ddx;
        dy = checkResult.ddy;
        roomValid = true; // Room successfully validated

    } while (++trycnt <= 100 && !roomValid); // C ref: sp_lev.c:1649 (loop until valid)

    // C ref: sp_lev.c:1650-1652 — If all retries failed, return null
    if (!roomValid) {
        return null;
    }

    // C ref: Must initialize sbrooms array for potential nested rooms
    return {
        lx: xabs,
        ly: yabs,
        hx: xabs + dx,
        hy: yabs + dy,
        rtype: rtype,
        rlit: lit,  // Use resolved `lit` value from litstate_rnd
        irregular: false,
        nsubrooms: 0,      // C ref: mkroom.h — number of subrooms
        sbrooms: []        // C ref: mkroom.h — subroom array
    };
}

/**
 * Reset level state for new level generation
 */
export function resetLevelState() {
    levelState = {
        map: null,
        flags: {
            noteleport: false,
            hardfloor: false,
            nommap: false,
            shortsighted: false,
            arboreal: false,
            is_maze_lev: false,
            hero_memory: false,
            graveyard: false,
            corrmaze: false,
            temperature: 0,
            rndmongen: true,
            deathdrops: true,
            noautosearch: false,
            fumaroles: false,
            stormy: false,
        },
        coder: {
            premapped: false,
            solidify: false,
            allow_flips: 3,
            check_inaccessibles: false,
        },
        init: {
            style: 'solidfill',
            fg: ROOM,
            bg: STONE,
            smoothed: false,
            joined: false,
            lit: 0,
            walled: false,
        },
        xstart: 0,
        ystart: 0,
        xsize: 0,
        ysize: 0,
        currentRoom: null,
        roomStack: [],
        roomDepth: 0,
        deferredObjects: [],
        deferredMonsters: [],
        deferredTraps: [],
        // luaRngCounter is NOT initialized here - only set explicitly for levels that need it
    };
    icedpools = false;
    Sokoban = false;

    // Initialize BSP rectangle pool for random room placement
    // C ref: sp_lev.c special level generation requires rect pool initialization
    init_rect();
}

/**
 * Get the current level state (for testing/debugging)
 */
export function getLevelState() {
    return levelState;
}

/**
 * Get the terrain grid (typGrid) from the current map
 * Returns a 21×80 array of terrain type codes (0-based indexing)
 * Compatible with C dumpmap format for comparison testing
 */
export function getTypGrid() {
    if (!levelState.map || !levelState.map.locations) {
        return null;
    }

    const grid = [];
    for (let y = 0; y < ROWNO; y++) {
        const row = [];
        for (let x = 0; x < COLNO; x++) {
            const cell = levelState.map.locations[x]?.[y];
            row.push(cell?.typ ?? 0);
        }
        grid.push(row);
    }
    return grid;
}

/**
 * des.level_init({ style = "solidfill", fg = " " })
 *
 * Initialize level generation style and fill characters.
 * C ref: sp_lev.c lspo_level_init()
 *
 * @param {Object} opts - Initialization options
 * @param {string} opts.style - "solidfill", "mazegrid", "maze", "rogue", "mines", "swamp"
 * @param {string} opts.fg - Foreground fill character (default: ".")
 * @param {string} opts.bg - Background fill character (default: " ")
 * @param {boolean} opts.smoothed - Smooth walls (default: false)
 * @param {boolean} opts.joined - Join rooms (default: false)
 * @param {number} opts.lit - Lighting (default: 0)
 * @param {boolean} opts.walled - Add walls (default: false)
 */
export function level_init(opts = {}) {
    const style = opts.style || 'solidfill';
    const validStyles = ['solidfill', 'mazegrid', 'maze', 'rogue', 'mines', 'swamp'];
    if (!validStyles.includes(style)) {
        throw new Error(`Invalid level_init style: ${style}`);
    }

    levelState.init.style = style;
    levelState.init.fg = mapchrToTerrain(opts.fg || '.');
    levelState.init.bg = opts.bg !== undefined ? mapchrToTerrain(opts.bg) : -1;
    levelState.init.smoothed = opts.smoothed || false;
    levelState.init.joined = opts.joined || false;
    levelState.init.lit = opts.lit !== undefined ? opts.lit : 0;
    levelState.init.walled = opts.walled || false;

    // Apply the initialization - always create fresh map and clear entity arrays
    levelState.map = new GameMap();
    levelState.monsters = [];
    levelState.objects = [];
    levelState.traps = [];

    if (style === 'solidfill') {
        // Fill entire map with foreground character
        const fillChar = levelState.init.fg;
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                levelState.map.locations[x][y].typ = fillChar;
            }
        }
    } else if (style === 'mazegrid' || style === 'maze') {
        // Fill entire map with background character (typically walls for mazes)
        // The actual maze/structure is overlaid by subsequent des.map() calls
        const fillChar = levelState.init.bg !== -1 ? levelState.init.bg : STONE;
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                levelState.map.locations[x][y].typ = fillChar;
            }
        }
    } else if (style === 'swamp') {
        // Swamp level - procedurally generate mixture of land, water, and pools
        // The map will be mostly land with scattered pools and water
        // Subsequent des.map() calls overlay specific terrain features
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const roll = rn2(100);
                if (roll < 70) {
                    // 70% land
                    levelState.map.locations[x][y].typ = ROOM;
                } else if (roll < 90) {
                    // 20% water/moat
                    levelState.map.locations[x][y].typ = POOL;
                } else {
                    // 10% deep water
                    levelState.map.locations[x][y].typ = MOAT;
                }
            }
        }
    } else if (style === 'mines' || style === 'rogue') {
        // Mines/rogue styles need complex cavern generation (not yet implemented)
        // For now, fill with STONE background and let des.map() overlay the structure
        // C ref: NetHack mines use cellular automata for cave generation
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                levelState.map.locations[x][y].typ = STONE;
            }
        }
    } else {
        // Unknown style - default to solidfill behavior
        console.warn(`Level init style "${style}" using default solidfill behavior`);
        const fillChar = levelState.init.fg;
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                levelState.map.locations[x][y].typ = fillChar;
            }
        }
    }
}

/**
 * des.level_flags("noteleport", "hardfloor", ...)
 *
 * Set level flags that control various level behaviors.
 * C ref: sp_lev.c lspo_level_flags()
 *
 * @param {...string} flags - Variable number of flag names
 */
export function level_flags(...flags) {
    for (const flag of flags) {
        const lc = flag.toLowerCase();

        switch (lc) {
            case 'noteleport':
                levelState.flags.noteleport = true;
                break;
            case 'hardfloor':
                levelState.flags.hardfloor = true;
                break;
            case 'nommap':
                levelState.flags.nommap = true;
                break;
            case 'shortsighted':
                levelState.flags.shortsighted = true;
                break;
            case 'arboreal':
                levelState.flags.arboreal = true;
                break;
            case 'mazelevel':
                levelState.flags.is_maze_lev = true;
                break;
            case 'shroud':
                levelState.flags.hero_memory = true;
                break;
            case 'graveyard':
                levelState.flags.graveyard = true;
                break;
            case 'icedpools':
                icedpools = true;
                break;
            case 'corrmaze':
                levelState.flags.corrmaze = true;
                break;
            case 'premapped':
                levelState.coder.premapped = true;
                break;
            case 'solidify':
                levelState.coder.solidify = true;
                break;
            case 'sokoban':
                Sokoban = true;
                break;
            case 'inaccessibles':
                levelState.coder.check_inaccessibles = true;
                break;
            case 'noflipx':
                levelState.coder.allow_flips &= ~2;
                break;
            case 'noflipy':
                levelState.coder.allow_flips &= ~1;
                break;
            case 'noflip':
                levelState.coder.allow_flips = 0;
                break;
            case 'temperate':
                levelState.flags.temperature = 0;
                break;
            case 'hot':
                levelState.flags.temperature = 1;
                break;
            case 'cold':
                levelState.flags.temperature = -1;
                break;
            case 'nomongen':
                levelState.flags.rndmongen = false;
                break;
            case 'nodeathdrops':
                levelState.flags.deathdrops = false;
                break;
            case 'noautosearch':
                levelState.flags.noautosearch = true;
                break;
            case 'fumaroles':
                levelState.flags.fumaroles = true;
                break;
            case 'stormy':
                levelState.flags.stormy = true;
                break;
            default:
                throw new Error(`Unknown level flag: ${flag}`);
        }
    }
}

/**
 * Apply random flipping to the entire level after all maps are placed.
 * This matches C's flip_level_rnd() which is called at the end of level loading.
 * C ref: sp_lev.c flip_level_rnd() and flip_level()
 */
function flipLevelRandom() {
    const allowFlips = levelState.coder.allow_flips;
    let flipBits = 0;

    // Determine which flips to apply using RNG (matching C's flip_level_rnd)
    // Bit 0: vertical flip (up/down)
    // Bit 1: horizontal flip (left/right)
    if ((allowFlips & 1) && rn2(2)) {
        flipBits |= 1;
    }
    if ((allowFlips & 2) && rn2(2)) {
        flipBits |= 2;
    }

    if (flipBits === 0) {
        return; // No flips applied
    }

    const map = levelState.map;
    if (!map) return;

    // Find the bounds of non-STONE terrain
    let minX = 80, minY = 21, maxX = -1, maxY = -1;
    for (let x = 0; x < 80; x++) {
        for (let y = 0; y < 21; y++) {
            if (map.locations[x][y].typ !== STONE) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (maxX < 0) return; // No terrain to flip

    // C uses FlipX(val) = (maxx - val) + minx and FlipY(val) = (maxy - val) + miny
    const flipX = (x) => (maxX - x) + minX;
    const flipY = (y) => (maxY - y) + minY;

    // Apply flips by swapping cells
    // Vertical flip: swap rows
    if (flipBits & 1) {
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y < minY + Math.floor((maxY - minY + 1) / 2); y++) {
                const ny = flipY(y);
                const temp = map.locations[x][y];
                map.locations[x][y] = map.locations[x][ny];
                map.locations[x][ny] = temp;
            }
        }
    }

    // Horizontal flip: swap columns
    if (flipBits & 2) {
        for (let x = minX; x < minX + Math.floor((maxX - minX + 1) / 2); x++) {
            for (let y = minY; y <= maxY; y++) {
                const nx = flipX(x);
                const temp = map.locations[x][y];
                map.locations[x][y] = map.locations[nx][y];
                map.locations[nx][y] = temp;
            }
        }
    }
}

/**
 * des.map([[...]])
 *
 * Place an ASCII map at the specified location or alignment.
 * C ref: sp_lev.c lspo_map()
 *
 * @param {string|Object} data - Map string or options object
 * @param {string} data.map - Map data (for object form)
 * @param {string} data.halign - "left", "center", "right" (default: "center")
 * @param {string} data.valign - "top", "center", "bottom" (default: "center")
 * @param {number} data.x - Explicit X coordinate
 * @param {number} data.y - Explicit Y coordinate
 * @param {boolean} data.lit - Whether to light the map (default: false)
 */
export function map(data) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let mapStr, halign = 'center', valign = 'center', x, y, lit = false, contents;

    if (typeof data === 'string') {
        mapStr = data;
    } else {
        mapStr = data.map || data;
        halign = data.halign || 'center';
        valign = data.valign || 'center';
        // Support both x/y and coord formats
        if (data.coord) {
            x = data.coord[0];
            y = data.coord[1];
        } else {
            x = data.x;
            y = data.y;
        }
        lit = data.lit || false;
        contents = data.contents;
    }

    // Parse map string into 2D array
    const lines = mapStr.split('\n').filter(line => line.length > 0);
    const height = lines.length;
    const width = Math.max(...lines.map(line => line.length));

    levelState.xsize = width;
    levelState.ysize = height;

    // Determine placement coordinates
    if (x === undefined || y === undefined) {
        // Use alignment
        if (halign === 'left') {
            x = 1;
        } else if (halign === 'center') {
            x = Math.floor((80 - width) / 2);
        } else if (halign === 'right') {
            x = 80 - width - 1;
        } else if (halign === 'half-left') {
            x = Math.floor((80 - width) / 4);
        } else if (halign === 'half-right') {
            x = Math.floor(3 * (80 - width) / 4);
        }

        if (valign === 'top') {
            y = 1;
        } else if (valign === 'center') {
            y = Math.floor((21 - height) / 2);
        } else if (valign === 'bottom') {
            y = 21 - height - 1;
        }
    }

    levelState.xstart = x;
    levelState.ystart = y;

    // Place the map
    for (let ly = 0; ly < lines.length; ly++) {
        const line = lines[ly];
        for (let lx = 0; lx < line.length; lx++) {
            const ch = line[lx];
            const gx = x + lx;
            const gy = y + ly;

            if (gx >= 0 && gx < 80 && gy >= 0 && gy < 21) {
                const terrain = mapchrToTerrain(ch);
                if (terrain !== -1) {
                    levelState.map.locations[gx][gy].typ = terrain;
                    if (lit) {
                        levelState.map.locations[gx][gy].lit = 1;
                    }
                }
            }
        }
    }

    // Apply wall_extends() to compute correct junction types
    if (levelState.coder.solidify) {
        wallification(levelState.map);
    }

    // Execute contents callback if provided
    // C ref: Lua des.map() calls the contents function after placing the map
    if (contents && typeof contents === 'function') {
        // Create a room-like object for compatibility with room-based contents
        const mapRegion = {
            lx: x,
            ly: y,
            hx: x + width - 1,
            hy: y + height - 1,
            width: width,
            height: height
        };
        contents(mapRegion);
    }
}

/**
 * des.terrain(x, y, type)
 *
 * Set terrain at a specific coordinate.
 * C ref: sp_lev.c lspo_terrain()
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} type - Terrain character
 */
export function terrain(x_or_opts, y_or_type, type) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // Handle different formats:
    // des.terrain(x, y, type)
    // des.terrain({x, y, typ})
    // des.terrain(selection, type)

    if (typeof x_or_opts === 'object') {
        if (Array.isArray(x_or_opts)) {
            // selection.line() returns array of coords
            const terrainType = mapchrToTerrain(y_or_type);
            if (terrainType !== -1) {
                for (const coord of x_or_opts) {
                    if (coord.x >= 0 && coord.x < 80 && coord.y >= 0 && coord.y < 21) {
                        levelState.map.locations[coord.x][coord.y].typ = terrainType;
                    }
                }
            }
        } else if (x_or_opts.x !== undefined && x_or_opts.y !== undefined) {
            // {x, y, typ} format
            const terrainType = mapchrToTerrain(x_or_opts.typ);
            if (terrainType !== -1 && x_or_opts.x >= 0 && x_or_opts.x < 80 &&
                x_or_opts.y >= 0 && x_or_opts.y < 21) {
                levelState.map.locations[x_or_opts.x][x_or_opts.y].typ = terrainType;
            }
        }
    } else if (typeof x_or_opts === 'number') {
        // (x, y, type) format
        if (x_or_opts >= 0 && x_or_opts < 80 && y_or_type >= 0 && y_or_type < 21) {
            const terrainType = mapchrToTerrain(type);
            if (terrainType !== -1) {
                levelState.map.locations[x_or_opts][y_or_type].typ = terrainType;
            }
        }
    }
}

/**
 * des.replace_terrain(opts)
 * Replace all occurrences of one terrain type with another.
 * C ref: sp_lev.c spo_replace_terrain()
 *
 * @param {Object} opts - Options
 *   - fromterrain: Source terrain character/type
 *   - toterrain: Destination terrain character/type
 *   - region: Optional selection/region to limit replacement (default: whole map)
 *   - chance: Optional percentage chance for each replacement (0-100, default: 100)
 */
export function replace_terrain(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const fromType = mapchrToTerrain(opts.fromterrain);
    const toType = mapchrToTerrain(opts.toterrain);

    if (fromType === -1 || toType === -1) return;

    const chance = opts.chance !== undefined ? opts.chance : 100;

    // Determine region to replace in
    let x1 = 0, y1 = 0, x2 = COLNO - 1, y2 = ROWNO - 1;

    if (opts.region) {
        if (opts.region.x1 !== undefined) {
            // Rectangle format
            x1 = opts.region.x1;
            y1 = opts.region.y1;
            x2 = opts.region.x2;
            y2 = opts.region.y2;
        } else if (opts.region.coords) {
            // Selection format - replace only those coords
            for (const coord of opts.region.coords) {
                if (coord.x >= 0 && coord.x < COLNO && coord.y >= 0 && coord.y < ROWNO) {
                    const loc = levelState.map.locations[coord.x][coord.y];
                    if (loc.typ === fromType && (chance >= 100 || rn2(100) < chance)) {
                        loc.typ = toType;
                    }
                }
            }
            return;
        }
    }

    // Replace in rectangular region
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            if (x >= 0 && x < COLNO && y >= 0 && y < ROWNO) {
                const loc = levelState.map.locations[x][y];
                if (loc.typ === fromType && (chance >= 100 || rn2(100) < chance)) {
                    loc.typ = toType;
                }
            }
        }
    }
}

/**
 * Convert ASCII map character to terrain type constant.
 * C ref: sp_lev.c get_table_mapchr_opt()
 *
 * @param {string} ch - Single character or terrain name
 * @returns {number} Terrain type constant or -1 for unknown
 */
function mapchrToTerrain(ch) {
    if (typeof ch !== 'string' || ch.length === 0) {
        return -1;
    }

    const c = ch[0];

    // Single character terrain codes (from C sp_lev.c)
    switch (c) {
        case ' ': return STONE;
        case '-': return HWALL;
        case '|': return VWALL;
        case '.': return ROOM;
        case '#': return CORR;
        case '+': return DOOR;
        case '<': return STAIRS_UP;
        case '>': return STAIRS_DOWN;
        case '{': return FOUNTAIN;
        case '\\': return THRONE;
        case 'K': return SINK;
        case '}': return MOAT;
        case 'P': return POOL;
        case 'L': return LAVAPOOL;
        case 'Z': return LAVAWALL;
        case 'I': return ICE;
        case 'W': return WATER;
        case 'T': return TREE;
        case 'F': return IRONBARS;
        case 'C': return CLOUD;
        case 'A': return AIR;
        // Other characters that appear in maps
        case '^': return ROOM; // trap placeholder, will be replaced
        case '@': return ROOM; // player position placeholder
        default:
            // Unknown character - treat as stone
            return STONE;
    }
}

/**
 * Check if a terrain type is any kind of wall.
 */
function isWall(typ) {
    return typ >= VWALL && typ <= TRWALL;
}

/**
 * Directional extension checks for wall types.
 * These determine which directions a wall type connects to neighboring walls.
 */
function extendsNorth(typ) {
    // Types that have north-going connectivity
    return typ === VWALL || typ === BLCORNER || typ === BRCORNER ||
           typ === TUWALL || typ === CROSSWALL || typ === TRWALL || typ === TLWALL;
}

function extendsSouth(typ) {
    // Types that have south-going connectivity
    return typ === VWALL || typ === TLCORNER || typ === TRCORNER ||
           typ === TDWALL || typ === CROSSWALL || typ === TRWALL || typ === TLWALL;
}

function extendsEast(typ) {
    // Types that have east-going connectivity
    return typ === HWALL || typ === TLCORNER || typ === BLCORNER ||
           typ === TUWALL || typ === TDWALL || typ === CROSSWALL || typ === TRWALL;
}

function extendsWest(typ) {
    // Types that have west-going connectivity
    return typ === HWALL || typ === TRCORNER || typ === BRCORNER ||
           typ === TUWALL || typ === TDWALL || typ === CROSSWALL || typ === TLWALL;
}

/**
 * Apply wall_extends() algorithm to compute correct wall junction types.
 * This implements NetHack's wallification logic for special levels.
 * C ref: sp_lev.c set_wall_state() and wallification()
 *
 * The algorithm checks 4 cardinal neighbors of each wall cell to determine
 * directional connectivity, then assigns the appropriate junction type.
 * Must be applied iteratively until wall types stabilize.
 *
 * @param {GameMap} map - The map to wallify
 */
function wallification(map) {
    const maxIterations = 100;
    let iteration = 0;

    while (iteration < maxIterations) {
        let changed = false;
        iteration++;

        // Create a copy of terrain types to avoid modifying while iterating
        const newTypes = [];
        for (let x = 0; x < 80; x++) {
            newTypes[x] = [];
            for (let y = 0; y < 21; y++) {
                newTypes[x][y] = map.locations[x][y].typ;
            }
        }

        // Process each cell
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                const typ = map.locations[x][y].typ;
                if (!isWall(typ)) {
                    continue;
                }

                // Check four neighbors for wall connectivity
                // North: does the cell to the north extend south?
                const hasNorth = y > 0 && isWall(map.locations[x][y-1].typ) &&
                                extendsSouth(map.locations[x][y-1].typ);

                // South: does the cell to the south extend north?
                const hasSouth = y < 20 && isWall(map.locations[x][y+1].typ) &&
                                extendsNorth(map.locations[x][y+1].typ);

                // East: does the cell to the east extend west?
                const hasEast = x < 79 && isWall(map.locations[x+1][y].typ) &&
                               extendsWest(map.locations[x+1][y].typ);

                // West: does the cell to the west extend east?
                const hasWest = x > 0 && isWall(map.locations[x-1][y].typ) &&
                               extendsEast(map.locations[x-1][y].typ);

                // Determine new type based on connectivity
                let newType;
                if (hasNorth && hasSouth && hasEast && hasWest) {
                    newType = CROSSWALL;
                } else if (hasSouth && hasEast && hasWest && !hasNorth) {
                    newType = TDWALL;
                } else if (hasNorth && hasEast && hasWest && !hasSouth) {
                    newType = TUWALL;
                } else if (hasNorth && hasSouth && hasEast && !hasWest) {
                    newType = TRWALL;
                } else if (hasNorth && hasSouth && hasWest && !hasEast) {
                    newType = TLWALL;
                } else if (hasSouth && hasEast && !hasNorth && !hasWest) {
                    newType = TLCORNER;
                } else if (hasSouth && hasWest && !hasNorth && !hasEast) {
                    newType = TRCORNER;
                } else if (hasNorth && hasEast && !hasSouth && !hasWest) {
                    newType = BLCORNER;
                } else if (hasNorth && hasWest && !hasSouth && !hasEast) {
                    newType = BRCORNER;
                } else if (hasEast && hasWest) {
                    newType = HWALL;
                } else if (hasNorth && hasSouth) {
                    newType = VWALL;
                } else {
                    // Only one direction or none - keep original
                    newType = typ;
                }

                newTypes[x][y] = newType;
                if (newType !== typ) {
                    changed = true;
                }
            }
        }

        // Apply the new types
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                map.locations[x][y].typ = newTypes[x][y];
            }
        }

        if (!changed) {
            break; // Converged
        }
    }

    if (iteration >= maxIterations) {
        console.warn('wallification did not converge after', maxIterations, 'iterations');
    }
}

/**
 * des.room(opts)
 *
 * Creates a room with optional nested subrooms and contents.
 * C ref: sp_lev.c lspo_room()
 *
 * Options:
 * - x, y: Room position (default: -1 for random)
 * - w, h: Room size (default: -1 for automatic)
 * - xalign, yalign: Alignment within parent ("left", "center", "right"/"top", "bottom"; default: "random")
 * - type: Room type ("ordinary", "delphi", "temple", "shop", etc.; default: "ordinary")
 * - lit: Lighting (1=lit, 0=dark, -1=random; default: -1)
 * - filled: Whether room is filled with floor (default: 1)
 * - joined: Whether room is joined to others via corridors (default: true)
 * - chance: Percentage chance room is created (default: 100)
 * - contents: Function to execute inside room context for placing features
 *
 * @param {Object} opts - Room options
 * @returns {boolean} - True if room was created successfully
 */
export function room(opts = {}) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // Parse alignment strings - C ref: sp_lev.c defines LEFT=1, CENTER=2, RIGHT=3, TOP=1, BOTTOM=3
    // Note: C uses same constants for vertical (TOP=1=LEFT, BOTTOM=3=RIGHT)
    const alignMap = {
        'left': 1, 'center': 2, 'right': 3,
        'top': 1, 'bottom': 3,
        'half-left': -2, 'half-right': -2,  // Not standard C values
        'random': -1
    };

    // Parse room type strings
    const roomTypeMap = {
        'ordinary': 0,  // OROOM
        'themed': 1,    // THEMEROOM
        'delphi': 9,    // DELPHI
        'temple': 10,   // TEMPLE
        'shop': 14,     // SHOPBASE
        'tool shop': 14, 'candle shop': 14, 'wand shop': 14,
        'food shop': 14, 'armor shop': 14, 'weapon shop': 14,
    };

    // Extract and normalize options
    const x = opts.x ?? -1;
    const y = opts.y ?? -1;
    const w = opts.w ?? -1;
    const h = opts.h ?? -1;
    const xalign = alignMap[opts.xalign] ?? -1;
    const yalign = alignMap[opts.yalign] ?? -1;
    const type = opts.type ?? 'ordinary';
    let lit = opts.lit ?? -1;  // let: modified by litstate_rnd()
    const filled = opts.filled ?? 1;
    const chance = opts.chance ?? 100;
    const contents = opts.contents;

    // C ref: sp_lev.c:2803 build_room() — calls rn2(100) ONLY for fixed-position rooms
    // If roll >= chance, room becomes OROOM (ordinary) instead of requested type.
    // For chance=100, the roll doesn't matter (room always gets requested type),
    // but C still makes the rn2(100) call for RNG alignment.
    // Random-placement rooms (no x/y/w/h) do NOT call rn2(100) for chance check.
    const requestedRtype = roomTypeMap[type] ?? 0;

    // Validate x,y pair (both must be -1 or both must be specified)
    if ((x === -1 || y === -1) && x !== y) {
        console.error('Room must have both x and y, or neither');
        return false;
    }

    // Validate w,h pair
    if ((w === -1 || h === -1) && w !== h) {
        console.error('Room must have both w and h, or neither');
        return false;
    }

    // Check nesting depth (max 10 levels deep to prevent infinite recursion)
    if (levelState.roomDepth > 10) {
        console.error('Too deeply nested rooms');
        return false;
    }

    // For special levels, we create rooms differently than procedural dungeons
    // Special levels use fixed coordinates, not BSP rectangle selection
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_ROOMS === '1';
    const DEBUG_BUILD = typeof process !== 'undefined' && process.env.DEBUG_BUILD_ROOM === '1';

    // C ref: sp_lev.c — build_room() RNG ordering differs based on room type:
    // Fixed-position rooms: build_room rn2(100) → litstate_rnd → create_room
    // Random-placement rooms: create_room (alignment) → build_room rn2(100)
    // Nested rooms (depth > 0): create_room → build_room rn2(100)
    // We'll call build_room's rn2(100) at the appropriate time based on room type
    let rtype; // Will be set at the right time depending on room type

    // Check if this is a random-placement room (x/y not specified)
    // The key distinction is whether x/y coordinates are fixed, not whether w/h are specified
    // e.g., des.room({ w: 10, h: 10 }) with x=-1, y=-1 is still random-placement
    const isRandomPlacement = (x === -1 && y === -1);

    // For top-level FIXED-POSITION rooms, call build_room's rn2(100) FIRST
    // Random-placement rooms skip this and call rn2(100) later (after create_room alignment)
    if (levelState.roomDepth === 0 && !isRandomPlacement) {
        if (DEBUG_BUILD) {
            const before = getRngCallCount();
            console.log(`\n=== [RNG ${before}] des.room() build_room chance check (TOP-LEVEL FIXED) ===`);
            console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
        }
        rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
        }
    }

    // Calculate actual room position and size
    // If x, y are specified, use them directly (special level fixed position)
    // If -1, would need random placement (not implemented yet)
    let roomX, roomY, roomW, roomH;

    if (x >= 0 && y >= 0 && w > 0 && h > 0 && levelState.roomDepth > 0) {
        // Nested room with fixed coordinates
        // C's create_room makes dimension RNG calls even for fixed-coord nested rooms
        // Nested rooms skip litstate_rnd (lighting already determined by parent)
        if (DEBUG) {
            console.log(`des.room(): NESTED room with fixed coords, using create_room_splev: x=${x}, y=${y}, w=${w}, h=${h}`);
        }

        const roomCalc = create_room_splev(x, y, w, h, xalign, yalign,
                                           rtype, lit, levelState.depth || 1, true, true); // skipLitstate=true, forceRandomize=true for nested

        if (!roomCalc) {
            if (DEBUG) {
                console.log(`des.room(): create_room_splev failed for nested room`);
            }
            return false;
        }

        // Extract coordinates from calculated room
        roomX = roomCalc.lx;
        roomY = roomCalc.ly;
        roomW = roomCalc.hx - roomCalc.lx + 1;
        roomH = roomCalc.hy - roomCalc.ly + 1;
        lit = roomCalc.rlit;

        if (DEBUG) {
            console.log(`des.room(): nested room via create_room_splev at (${roomX},${roomY}) size ${roomW}x${roomH}`);
        }

        // Skip to nested room build_room call and room creation below
    } else if (x >= 0 && y >= 0 && w > 0 && h > 0) {
        // Top-level fixed position room - use direct coordinate conversion

        if (DEBUG) {
            console.log(`des.room(): FIXED position x=${x}, y=${y}, w=${w}, h=${h}, xalign=${xalign}, yalign=${yalign}, rtype=${rtype}, lit=${lit}, depth=${levelState.roomDepth}`);
        }

        // C ref: sp_lev.c:1510 — litstate_rnd called with r->rlit from room template
        // C ref: sp_lev.c:2803 — build_room passes r->rlit to create_room
        // If rlit >= 0, litstate_rnd returns immediately without calling RNG
        // If rlit < 0, litstate_rnd calls rnd() and rn2(77) to determine lighting
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] Calling litstate_rnd(${lit}, ${levelState.depth || 1})`);
        }
        lit = litstate_rnd(lit, levelState.depth || 1);
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] litstate_rnd -> ${lit}`);
        }

        // C ref: sp_lev.c — special levels call rnd_rect() to select from rect pool
        // Top-level rooms (depth 0) need to select a rect from the BSP pool
        // Nested rooms don't use the rect pool
        if (levelState.roomDepth === 0) {
            const rect = rnd_rect();
            if (!rect) {
                console.warn('des.room(): No rects available in pool');
                // Signal failure to themed room generator
                if (levelState.roomFailureCallback) {
                    levelState.roomFailureCallback();
                }
                return; // Can't place room without a rect
            }

            // Lazy MT initialization for themed rooms
            // C ref: MT init happens AFTER rnd_rect() but BEFORE create_room()
            // This is the first des.* API call that needs Lua RNG for object/monster placement
            const DEBUG_LUA_RNG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';
            if (levelState && levelState.luaRngCounter !== undefined && levelState.luaRngCounter === 0) {
                if (DEBUG_LUA_RNG) {
                    console.log(`\n[des.room] Triggering lazy MT init after rnd_rect (luaRngCounter=0)`);
                }
                initLuaMT();
            }
        }

        // C ref: sp_lev.c:1598-1619 — Convert grid coordinates to absolute map coordinates
        // Top-level rooms use grid coordinates (1-5) that get converted to map positions
        // Nested rooms use relative coordinates within parent (no conversion)
        if (levelState.roomDepth === 0) {
            // Grid to absolute conversion (C: xabs = (((xtmp - 1) * COLNO) / 5) + 1)
            roomX = Math.floor(((x - 1) * COLNO) / 5) + 1;
            roomY = Math.floor(((y - 1) * ROWNO) / 5) + 1;

            // Apply alignment offset (C ref: sp_lev.c:1605-1619)
            const COLNO_DIV5 = Math.floor(COLNO / 5);  // 16
            const ROWNO_DIV5 = Math.floor(ROWNO / 5);  // 4

            // xalign/yalign already converted by alignMap: 1=LEFT/TOP, 2=CENTER, 3=RIGHT/BOTTOM
            // Apply horizontal alignment
            if (xalign === 3) { // RIGHT
                roomX += COLNO_DIV5 - w;
            } else if (xalign === 2) { // CENTER
                roomX += Math.floor((COLNO_DIV5 - w) / 2);
            }
            // LEFT (1) needs no offset

            // Apply vertical alignment
            if (yalign === 3) { // BOTTOM
                roomY += ROWNO_DIV5 - h;
            } else if (yalign === 2) { // CENTER
                roomY += Math.floor((ROWNO_DIV5 - h) / 2);
            }
            // TOP (1) needs no offset

            roomW = w;
            roomH = h;

            if (DEBUG) {
                console.log(`  Grid conversion: (${x},${y}) -> absolute (${roomX},${roomY}), align=${xalign},${yalign}`);
            }
        } else {
            // Nested room uses relative coordinates within parent
            // C ref: sp_lev.c create_subroom() - x,y are relative to parent room
            const parentRoom = levelState.currentRoom;
            if (parentRoom) {
                roomX = parentRoom.lx + x;
                roomY = parentRoom.ly + y;
            } else {
                // Fallback if no parent (shouldn't happen for nested rooms)
                roomX = x;
                roomY = y;
            }
            roomW = w;
            roomH = h;

            if (DEBUG) {
                console.log(`  Nested room: relative (${x},${y}) -> absolute (${roomX},${roomY}) within parent`);
            }
        }
    } else {
        // Random placement - use sp_lev.c's create_room algorithm
        // C ref: sp_lev.c:1530-1649 — create_room handles dimension/position randomization
        // via rnd(5), rnd(5), rnd(3), rnd(3) calls

        if (DEBUG) {
            console.log(`des.room(): RANDOM placement x=${x}, y=${y}, w=${w}, h=${h}, xalign=${xalign}, yalign=${yalign}, rtype=${rtype}, lit=${lit}`);
        }

        // For random-placement rooms, defer create_room call to match C's build_room structure
        // C ref: build_room() does: rn2(100) → litstate_rnd() → create_room()
        // We'll skip litstate_rnd AND defer create_room, then call both at the right time
        const roomCalc = create_room_splev(x, y, w, h, xalign, yalign,
                                           rtype, lit, levelState.depth || 1, true, false, true); // skipLitstate=true, forceRandomize=false, deferCreateRoom=true

        if (!roomCalc) {
            if (DEBUG) {
                console.log(`des.room(): create_room_splev failed, no space available`);
            }
            // Signal failure to themed room generator
            if (levelState.roomFailureCallback) {
                levelState.roomFailureCallback();
            }
            return false;
        }

        // Check if this is a deferred room (create_room not called yet)
        if (roomCalc._deferredRoom) {
            if (DEBUG_BUILD) {
                console.log(`des.room(): deferred room, calling build_room → litstate_rnd → create_room`);
            }

            // C ref: build_room() does rn2(100), litstate_rnd(), then create_room()
            // 1. build_room rn2(100) chance check
            if (DEBUG_BUILD) {
                const before = getRngCallCount();
                console.log(`\n=== [RNG ${before}] des.room() build_room chance check (deferred room) ===`);
                console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
            }
            rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
            if (DEBUG_BUILD) {
                console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
            }
            roomCalc.rtype = rtype; // Update room type based on chance roll

            // 2. litstate_rnd()
            if (DEBUG_BUILD) {
                const before = getRngCallCount();
                console.log(`  [RNG ${before}] des.room() calling litstate_rnd(${lit}, ${levelState.depth || 1})`);
            }
            lit = litstate_rnd(lit, levelState.depth || 1);
            if (DEBUG_BUILD) {
                console.log(`  [RNG ${getRngCallCount()}] litstate_rnd returned ${lit}`);
            }

            // 3. create_room() - NOW make the dimension randomization calls
            if (!levelState.map) {
                console.error('des.room(): no map available for deferred create_room');
                return false;
            }

            if (DEBUG_BUILD) {
                const before = getRngCallCount();
                console.log(`  [RNG ${before}] des.room() calling create_room() for deferred room`);
            }
            const success = create_room(levelState.map, roomCalc.x, roomCalc.y, roomCalc.w, roomCalc.h,
                                       roomCalc.xalign, roomCalc.yalign, roomCalc.rtype, lit,
                                       roomCalc.depth, false);
            if (DEBUG_BUILD) {
                console.log(`  [RNG ${getRngCallCount()}] create_room() done, success=${success}`);
            }

            if (!success) {
                if (DEBUG) {
                    console.log(`des.room(): deferred create_room failed`);
                }
                // Signal failure to themed room generator
                if (levelState.roomFailureCallback) {
                    levelState.roomFailureCallback();
                }
                return false;
            }

            // Extract the room that was just added
            const room = levelState.map.rooms[levelState.map.rooms.length - 1];

            // Set needfill for OROOM and THEMEROOM
            const OROOM_LOCAL = 0;
            const THEMEROOM_LOCAL = 1;
            if (rtype === OROOM_LOCAL || rtype === THEMEROOM_LOCAL) {
                room.needfill = FILL_NORMAL;
            }

            // Continue with room contents execution below
            roomX = room.lx;
            roomY = room.ly;
            roomW = room.hx - room.lx + 1;
            roomH = room.hy - room.ly + 1;

            if (DEBUG) {
                console.log(`des.room(): deferred room created at (${roomX},${roomY}) size ${roomW}x${roomH}`);
            }

            // Execute room contents callback if provided
            if (contents && typeof contents === 'function') {
                const parentRoom = levelState.currentRoom;
                levelState.roomStack.push(parentRoom);
                levelState.roomDepth++;

                // Add width/height for compatibility
                room.width = roomW;
                room.height = roomH;
                levelState.currentRoom = room;

                if (DEBUG) {
                    console.log(`des.room(): EXECUTING contents callback for deferred room at (${roomX},${roomY})`);
                }

                try {
                    contents(room);
                } finally {
                    levelState.currentRoom = levelState.roomStack.pop();
                    levelState.roomDepth--;
                }
            }

            // Update rect pool for random-placement room
            if (levelState.roomDepth === 0 && isRandomPlacement) {
                update_rect_pool_for_room(room);
            }

            return true; // Early return - deferred room created and processed
        }

        // Check if create_room_splev already added the room to the map (fully random path)
        if (roomCalc._alreadyAdded) {
            if (DEBUG) {
                console.log(`des.room(): room already added by create_room (fully random), executing contents callback`);
            }

            // For top-level random-placement rooms, call build_room's rn2(100) now
            // (after create_room's alignment randomization)
            // C ref: For random-placement rooms, C does: create_room (alignment) → build_room rn2(100) → litstate_rnd
            if (levelState.roomDepth === 0) {
                if (DEBUG_BUILD) {
                    const before = getRngCallCount();
                    console.log(`\n=== [RNG ${before}] des.room() build_room chance check (TOP-LEVEL random-placement) ===`);
                    console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
                }
                rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
                if (DEBUG_BUILD) {
                    console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
                }
                // Update room type if chance roll changed it
                roomCalc.rtype = rtype;

                // Now call litstate_rnd (after build_room's rn2(100))
                if (DEBUG_BUILD) {
                    const before = getRngCallCount();
                    console.log(`  [RNG ${before}] des.room() calling litstate_rnd(${lit}, ${levelState.depth || 1}) after build_room`);
                }
                lit = litstate_rnd(lit, levelState.depth || 1);
                roomCalc.rlit = lit; // Update room's lighting
                if (DEBUG_BUILD) {
                    console.log(`  [RNG ${getRngCallCount()}] litstate_rnd returned ${lit}`);
                }
            }

            // For nested rooms on the fully-random path, call build_room's rn2(100) now
            // (after create_room dimensions were calculated)
            if (levelState.roomDepth > 0) {
                if (DEBUG_BUILD) {
                    const before = getRngCallCount();
                    console.log(`\n=== [RNG ${before}] des.room() build_room chance check (NESTED fully-random, depth=${levelState.roomDepth}) ===`);
                    console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
                }
                rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
                if (DEBUG_BUILD) {
                    console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
                }
                // Update room type if chance roll changed it
                roomCalc.rtype = rtype;
            }

            // Room is already in map, just execute contents callback if needed
            if (contents && typeof contents === 'function') {
                const parentRoom = levelState.currentRoom;
                levelState.roomStack.push(parentRoom);
                levelState.roomDepth++;

                // Add width/height for compatibility
                roomCalc.width = roomCalc.hx - roomCalc.lx + 1;
                roomCalc.height = roomCalc.hy - roomCalc.ly + 1;
                levelState.currentRoom = roomCalc;

                try {
                    contents(roomCalc);
                } finally {
                    levelState.currentRoom = levelState.roomStack.pop();
                    levelState.roomDepth--;
                }
            }

            return true; // Early return - room already created
        }

        // Extract coordinates from calculated room
        roomX = roomCalc.lx;
        roomY = roomCalc.ly;
        roomW = roomCalc.hx - roomCalc.lx + 1;
        roomH = roomCalc.hy - roomCalc.ly + 1;
        // Use calculated rlit from litstate_rnd (already processed)
        lit = roomCalc.rlit;

        if (DEBUG) {
            console.log(`des.room(): used create_room_splev, got room at (${roomX},${roomY}) size ${roomW}x${roomH}, lit=${lit}`);
        }

        // Continue to manual room creation below (don't early return)
        // Room needs to be added to map.rooms[] and tiles marked
    }

    // For nested rooms, call build_room's rn2(100) AFTER dimensions are calculated
    if (levelState.roomDepth > 0) {
        if (DEBUG_BUILD) {
            const before = getRngCallCount();
            console.log(`\n=== [RNG ${before}] des.room() build_room chance check (NESTED, depth=${levelState.roomDepth}) ===`);
            console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
        }
        rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
        }
    }

    // Create room entry in map.rooms array
    const OROOM_LOCAL = 0;
    const THEMEROOM_LOCAL = 1;
    // C ref: mkroom.c — Always call litstate_rnd for room finalization
    // Even if lit was already determined, C calls litstate_rnd again
    // This is because litstate_rnd returns immediately (without RNG) if litstate >= 0
    if (DEBUG_BUILD) {
        console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] Room finalization: calling litstate_rnd(${lit}, ${levelState.depth || 1})`);
    }
    const finalLit = litstate_rnd(lit, levelState.depth || 1);
    if (DEBUG_BUILD) {
        console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] Room finalization: litstate_rnd returned ${finalLit}`);
    }

    const room = {
        lx: roomX,
        ly: roomY,
        hx: roomX + roomW - 1,
        hy: roomY + roomH - 1,
        rtype: rtype,
        rlit: finalLit,
        irregular: false,
        // C ref: mklev.c - OROOM and THEMEROOM get needfill=FILL_NORMAL by default
        needfill: (rtype === OROOM_LOCAL || rtype === THEMEROOM_LOCAL) ? FILL_NORMAL : undefined,
        // Lua compatibility: region property for accessing room bounds
        region: { x1: roomX, y1: roomY, x2: roomX + roomW - 1, y2: roomY + roomH - 1 }
    };

    // Mark floor tiles for the room
    if (DEBUG || typeof process !== 'undefined' && process.env.DEBUG_ROOM_TILES === '1') {
        console.log(`Marking room tiles: (${roomX},${roomY})-(${roomX+roomW-1},${roomY+roomH-1})`);
    }
    for (let ry = roomY; ry < roomY + roomH; ry++) {
        for (let rx = roomX; rx < roomX + roomW; rx++) {
            if (rx >= 0 && rx < COLNO && ry >= 0 && ry < ROWNO) {
                levelState.map.locations[rx][ry].typ = ROOM;
                levelState.map.locations[rx][ry].lit = room.rlit;
            }
        }
    }

    // Add room to map's room list
    levelState.map.rooms.push(room);
    levelState.map.nroom = levelState.map.rooms.length;

    // C ref: rect.c split_rects() — Split BSP rectangle pool around this room
    // This is needed for randomly-placed rooms (procedural and themed)
    // C behavior: Rooms with random placement (x=-1,y=-1) split the rectangle pool
    // Fixed-position rooms (like oracle's x=3,y=3) do NOT split - they bypass BSP entirely
    // Nested rooms (subrooms) also do NOT split - C ref: create_subroom() has no split_rects call
    // Themed rooms have x=-1,y=-1 (random placement) but may specify w,h (fixed size)
    // Use isRandomPlacement variable already defined at top of function
    if (levelState.roomDepth === 0 && isRandomPlacement) {
        update_rect_pool_for_room(room);
    }

    if (DEBUG) {
        console.log(`des.room(): created room at (${roomX},${roomY}) size ${roomW}x${roomH}, map.nroom=${levelState.map.nroom}`);
    }

    // If room creation succeeded and there's a contents callback, execute it
    if (contents && typeof contents === 'function') {
        if (DEBUG) {
            console.log(`des.room(): EXECUTING contents callback for room at (${roomX},${roomY})`);
        }
        // Save current room state
        const parentRoom = levelState.currentRoom;
        levelState.roomStack.push(parentRoom);
        levelState.roomDepth++;

        // Set current room - use the actual room object just created
        // Add width/height for themerms compatibility
        room.width = roomW;
        room.height = roomH;
        levelState.currentRoom = room;

        try {
            // Execute contents callback
            contents(room);  // Pass room as parameter for Lua compatibility
            if (DEBUG) {
                console.log(`des.room(): FINISHED contents callback for room at (${roomX},${roomY})`);
            }
        } finally {
            // Restore parent room state
            levelState.currentRoom = levelState.roomStack.pop();
            levelState.roomDepth--;
        }
    }

    // C ref: sp_lev.c lspo_room line 78 — Add doors to room after contents
    if (levelState.map) {
        add_doors_to_room(levelState.map, room);
    }

    return true;
}

/**
 * des.stair(direction, x, y)
 *
 * Place a staircase at the specified location.
 * C ref: sp_lev.c lspo_stair()
 *
 * @param {string} direction - "up" or "down"
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function stair(direction, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    if (x >= 0 && x < 80 && y >= 0 && y < 21) {
        const stairType = direction === 'up' ? STAIRS_UP : STAIRS_DOWN;
        levelState.map.locations[x][y].typ = stairType;
    }
}

/**
 * Map object name to object type constant.
 * C ref: sp_lev.c get_table_mapchr_opt() for objects
 */
function objectNameToType(name) {
    const lowerName = name.toLowerCase();

    // Quick checks for common objects
    if (lowerName === 'boulder') return BOULDER;
    if (lowerName === 'scroll of earth') return SCR_EARTH;

    // Search objectData for matching name
    for (let i = 0; i < objectData.length; i++) {
        if (objectData[i].name && objectData[i].name.toLowerCase() === lowerName) {
            return i; // Object type index
        }
    }

    // Not found
    return -1;
}

/**
 * Map object class character to class constant.
 */
function objectClassToType(classChar) {
    switch (classChar) {
        case '%': return FOOD_CLASS;
        case '?': return SCROLL_CLASS;
        case '/': return WAND_CLASS;
        case '=': return RING_CLASS;
        case '!': return POTION_CLASS;
        case '[': return ARMOR_CLASS;
        case ')': return WEAPON_CLASS;
        case '(': return TOOL_CLASS;
        case '"': return AMULET_CLASS;
        case '*': return GEM_CLASS;
        default: return -1;
    }
}

/**
 * des.object(name_or_opts, x, y)
 *
 * Place an object at the specified location.
 * C ref: sp_lev.c lspo_object()
 *
 * @param {string|Object} name_or_opts - Object name or options object
 * @param {number} x - X coordinate (if name_or_opts is string)
 * @param {number} y - Y coordinate (if name_or_opts is string)
 */
/**
 * des.object(name_or_opts, x, y)
 * Place an object on the level.
 * C ref: sp_lev.c spobject()
 *
 * Supported formats:
 * 1. des.object('[') - Random armor at random location (object class)
 * 2. des.object('!') - Random potion at random location (object class)
 * 3. des.object('boulder', x, y) - Named object at specific location
 * 4. des.object({ id: 'chest', x, y }) - Object with options
 * 5. des.object({ id: 'chest', coord: {x, y} }) - Object with coord format
 *
 * Object classes: '[' (armor), ')' (weapon), '!' (potion), '?' (scroll),
 *                 '*' (gem/rock), '%' (food), '+' (spellbook), etc.
 *
 * @param {string|Object} name_or_opts - Object name, class symbol, or options object
 * @param {number} [x] - X coordinate (if name_or_opts is string)
 * @param {number} [y] - Y coordinate (if name_or_opts is string)
 */
export function object(name_or_opts, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // C ref: nhlua.c nhl_rn2() — Lua object generation calls rn2(1000+) for properties
    // Even though actual object placement is deferred, RNG calls happen immediately
    // C pattern is complex: first object uses 5 calls (1000-1004), second uses 3 (1010,1012,1014 with gaps),
    // rest use 4-5 each. Without exact Lua code, approximate with 4 calls average
    // TODO: Implement exact C Lua pattern once we understand the state machine
    const DEBUG_LUA_RNG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';

    if (DEBUG_LUA_RNG) {
        console.log(`\n[des.object] luaRngCounter check: ${levelState ? levelState.luaRngCounter : 'no levelState'}`);
    }

    if (levelState && levelState.luaRngCounter !== undefined) {
        // Lazy MT initialization on first Lua RNG use
        // C ref: MT init happens when Lua's math.random() is first called from themed room code
        if (levelState.luaRngCounter === 0) {
            if (DEBUG_LUA_RNG) {
                console.log(`\n[des.object] Triggering lazy MT init (luaRngCounter=0)`);
            }
            initLuaMT();
            // luaRngCounter is now 37 after MT init
        }

        const baseOffset = levelState.luaRngCounter;

        if (DEBUG_LUA_RNG) {
            const stack = new Error().stack.split('\n').slice(2, 6).join('\n');
            console.log(`\n=== Lua RNG triggered for des.object() ===`);
            console.log(`Counter: ${baseOffset}, object: ${JSON.stringify(name_or_opts).slice(0, 80)}`);
            console.log(`Call stack:\n${stack}`);
        }

        // Generate Lua RNG pattern for object properties
        // C ref: nhlua.c nhl_rn2() with varying offsets
        const numRngCalls = 4;
        for (let i = 0; i < numRngCalls; i++) {
            rn2(1000 + baseOffset + i);
        }
        levelState.luaRngCounter = baseOffset + numRngCalls;

        if (DEBUG_LUA_RNG) {
            console.log(`Counter after: ${levelState.luaRngCounter}`);
        }
    } else if (DEBUG_LUA_RNG) {
        console.log(`[des.object] Skipping Lua RNG (counter is undefined)`);
    }

    // Convert relative coordinates to absolute if inside a nested room
    // C ref: Lua automatically handles coordinate conversion based on room context
    let absX = x;
    let absY = y;
    if (levelState.currentRoom && x !== undefined && y !== undefined) {
        // Coordinates are relative to room interior (excluding walls)
        absX = levelState.currentRoom.lx + 1 + x;
        absY = levelState.currentRoom.ly + 1 + y;
    }

    // DEFERRED EXECUTION: Queue object placement for later (after corridors)
    // Store absolute coordinates since currentRoom context will be lost
    // Actual placement happens in executeDeferredObjects()
    levelState.deferredObjects.push({ name_or_opts, x: absX, y: absY });
}

/**
 * Map trap name to trap type constant.
 * C ref: sp_lev.c get_trap_type()
 */
function trapNameToType(name) {
    const lowerName = name.toLowerCase();

    // Map trap names to constants
    switch (lowerName) {
        case 'arrow': return ARROW_TRAP;
        case 'dart': return DART_TRAP;
        // Note: FALLING_ROCK_TRAP (type 3) not exported from config.js
        case 'squeaky board': case 'squeaky_board': case 'board': return SQKY_BOARD;
        case 'bear': return BEAR_TRAP;
        case 'land mine': case 'landmine': return LANDMINE;
        case 'rolling boulder': case 'rolling_boulder': return ROLLING_BOULDER_TRAP;
        case 'sleeping gas': case 'sleeping_gas': case 'sleep gas': case 'sleep_gas':
            return SLP_GAS_TRAP;
        case 'rust': return RUST_TRAP;
        case 'fire': return FIRE_TRAP;
        case 'pit': return PIT;
        case 'spiked pit': case 'spiked_pit': return SPIKED_PIT;
        case 'hole': return HOLE;
        case 'trap door': case 'trapdoor': return TRAPDOOR;
        case 'teleport': case 'teleportation': return TELEP_TRAP;
        case 'level teleport': case 'level_teleport': return LEVEL_TELEP;
        case 'magic portal': case 'magic_portal': return MAGIC_PORTAL;
        case 'anti-magic': case 'anti_magic': case 'anti magic': return ANTI_MAGIC;
        case 'polymorph': case 'poly': return POLY_TRAP;
        case 'statue': return STATUE_TRAP;
        case 'magic': return MAGIC_TRAP;
        case 'vibrating square': case 'vibrating_square': return VIBRATING_SQUARE;
        default: return -1;
    }
}

/**
 * des.trap(type, x, y)
 *
 * Place a trap at the specified location.
 * C ref: sp_lev.c lspo_trap()
 *
 * @param {string} type - Trap type name
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
/**
 * des.trap(type_or_opts, x, y)
 * Place a trap on the level.
 * C ref: sp_lev.c sptrap()
 *
 * Supported formats:
 * 1. des.trap('fire') - Fire trap at random location
 * 2. des.trap('fire', x, y) - Fire trap at specific location
 * 3. des.trap({ type: 'pit', x, y }) - Trap with options
 * 4. des.trap({ type: 'pit', coord: {x, y} }) - Trap with coord format
 * 5. des.trap() - Random trap type at random location
 *
 * Trap types: 'arrow', 'dart', 'pit', 'spiked pit', 'hole', 'trap door',
 *             'teleport', 'fire', 'rust', 'anti magic', 'magic', 'sleep gas',
 *             'land mine', 'bear', 'squeaky board', 'rolling boulder', 'level teleport'
 *
 * @param {string|Object} [type_or_opts] - Trap type name or options object
 * @param {number} [x] - X coordinate (if type_or_opts is string)
 * @param {number} [y] - Y coordinate (if type_or_opts is string)
 */
export function trap(type_or_opts, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // Convert relative coordinates to absolute if inside a nested room
    // C ref: Lua automatically handles coordinate conversion based on room context
    let absX = x;
    let absY = y;
    if (levelState.currentRoom && x !== undefined && y !== undefined) {
        // Coordinates are relative to room interior (excluding walls)
        absX = levelState.currentRoom.lx + 1 + x;
        absY = levelState.currentRoom.ly + 1 + y;
    }

    // DEFERRED EXECUTION: Queue trap placement instead of executing immediately
    // Store absolute coordinates since currentRoom context will be lost
    // This matches C's behavior which defers trap creation until after corridor generation
    levelState.deferredTraps.push({ type_or_opts, x: absX, y: absY });
}

/**
 * des.region(selection, type)
 *
 * Define a region with properties.
 * C ref: sp_lev.c lspo_region()
 *
 * @param {Object} selection - Selection object (from selection.area())
 * @param {string} type - Region type (e.g., "lit")
 */
/**
 * des.region(opts)
 * Define a region with special properties (lighting, room type, etc.).
 * C ref: sp_lev.c spregion()
 *
 * Supported formats:
 * - des.region({ region: [x1, y1, x2, y2], lit: true, type: 'temple' })
 * - des.region({ region: {x1, y1, x2, y2}, lit: false, type: 'morgue', filled: 2 })
 *
 * Region types: 'temple', 'morgue', 'zoo', 'beehive', 'ordinary'
 * Properties: lit (boolean), type (string), filled (number), irregular (boolean)
 *
 * @param {Object} opts - Region options
 * @param {Array|Object} opts.region - Region coordinates [x1,y1,x2,y2] or {x1,y1,x2,y2}
 * @param {boolean} [opts.lit] - Whether region is lit
 * @param {string} [opts.type] - Region type (temple, morgue, etc.)
 * @param {number} [opts.filled] - Fill density for monsters/objects
 * @param {boolean} [opts.irregular] - Whether region has irregular shape
 */
export function region(opts_or_selection, type) {
    if (!levelState.map) {
        return;
    }

    // Handle two formats:
    // 1. des.region(selection.area(x1,y1,x2,y2), "lit") - old format
    // 2. des.region({ region: [x1,y1,x2,y2], lit: true }) - new format

    let x1, y1, x2, y2, lit, opts;

    if (typeof type === 'string') {
        // Old format: des.region(selection, "lit" | "unlit")
        x1 = opts_or_selection.x1;
        y1 = opts_or_selection.y1;
        x2 = opts_or_selection.x2;
        y2 = opts_or_selection.y2;
        lit = (type === 'lit');
        opts = {};
    } else {
        // New format: des.region({ region: ..., lit: ..., type: ... })
        opts = opts_or_selection;
        if (opts.region) {
            if (Array.isArray(opts.region)) {
                [x1, y1, x2, y2] = opts.region;
            } else {
                x1 = opts.region.x1;
                y1 = opts.region.y1;
                x2 = opts.region.x2;
                y2 = opts.region.y2;
            }
        } else {
            return; // No region specified
        }
        lit = opts.lit !== undefined ? opts.lit : false;
    }

    // Mark all cells in region as lit/unlit
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            if (x >= 0 && x < 80 && y >= 0 && y < 21) {
                levelState.map.locations[x][y].lit = lit ? 1 : 0;
            }
        }
    }

    // Other region properties (type, filled, irregular) are stubs for now
    // They would affect room generation, monster spawning, etc.
}

/**
 * des.non_diggable(selection)
 *
 * Make an area non-diggable.
 * C ref: sp_lev.c lspo_non_diggable()
 *
 * @param {Object} selection - Selection object
 */
export function non_diggable(selection) {
    if (!levelState.map || !selection) {
        return;
    }

    for (let x = selection.x1; x <= selection.x2; x++) {
        for (let y = selection.y1; y <= selection.y2; y++) {
            if (x >= 0 && x < 80 && y >= 0 && y < 21) {
                levelState.map.locations[x][y].nondiggable = true;
            }
        }
    }
}

/**
 * des.non_passwall(selection)
 *
 * Make an area non-passwallable.
 * C ref: sp_lev.c lspo_non_passwall()
 *
 * @param {Object} selection - Selection object
 */
export function non_passwall(selection) {
    // Stub - would set W_NONPASSWALL flag on walls
    // For now, just ignore
}

/**
 * des.levregion(opts)
 *
 * Define level region (e.g., branch entry point).
 * C ref: sp_lev.c lspo_levregion()
 *
 * @param {Object} opts - Region options
 */
export function levregion(opts) {
    // Stub - would register branch entry point
    // For now, just ignore
}

/**
 * des.exclusion(opts)
 *
 * Define monster generation exclusion zone.
 * C ref: sp_lev.c lspo_exclusion()
 *
 * @param {Object} opts - Exclusion options
 */
export function exclusion(opts) {
    // Stub - would mark exclusion zones for monster generation
    // For now, just ignore
}

/**
 * des.monster(opts)
 * Place a monster at a location.
 * C ref: sp_lev.c lspo_monster()
 *
 * @param {Object} opts - Monster options
 *   - id: Monster name (e.g., "Vlad the Impaler", "vampire", "V")
 *   - x, y: Coordinates, or
 *   - coord: {x, y} coordinate object
 *   - name: Custom name for the monster
 *   - waiting: If true, monster waits (doesn't move)
 *   - peaceful: Monster is peaceful
 *   - asleep: Monster is asleep
 */
/**
 * des.monster(opts_or_class, x, y)
 * Place a monster on the level.
 * C ref: sp_lev.c spmonster()
 *
 * Supported formats:
 * 1. des.monster('V') - Random vampire at random location (monster class)
 * 2. des.monster('L') - Random lich at random location (monster class)
 * 3. des.monster('vampire', x, y) - Named monster at specific location
 * 4. des.monster({ id: 'vampire', x, y }) - Monster with options
 * 5. des.monster({ id: 'Vlad the Impaler', x, y, asleep: 1 }) - Named boss with properties
 *
 * Monster classes: 'V' (vampire), 'L' (lich), '&' (demon), 'D' (dragon),
 *                  'H' (giant humanoid), etc.
 *
 * Options: id, x, y, coord, peaceful, asleep, waiting, align, name
 *
 * @param {string|Object} opts_or_class - Monster name, class symbol, or options object
 * @param {number} [x] - X coordinate (if opts_or_class is string)
 * @param {number} [y] - Y coordinate (if opts_or_class is string)
 */
export function monster(opts_or_class, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const DEBUG_LUA_RNG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';

    // C ref: nhlua.c nhl_rn2() — Lua monster generation calls rn2(1000+) for properties
    // Similar to des.object(), RNG calls happen immediately even though placement is deferred
    if (levelState && levelState.luaRngCounter !== undefined) {
        // Lazy MT initialization on first Lua RNG use
        if (levelState.luaRngCounter === 0) {
            if (DEBUG_LUA_RNG) {
                console.log(`\n[des.monster] Triggering lazy MT init (luaRngCounter=0)`);
            }
            initLuaMT();
        }

        const numRngCalls = 4;  // Approximate - actual pattern varies
        const baseOffset = levelState.luaRngCounter;

        if (DEBUG_LUA_RNG) {
            console.log(`\n[des.monster] luaRngCounter: ${baseOffset} → ${baseOffset + numRngCalls}`);
        }

        for (let i = 0; i < numRngCalls; i++) {
            rn2(1000 + baseOffset + i);
        }
        levelState.luaRngCounter = baseOffset + numRngCalls;
    }

    // Convert relative coordinates to absolute if inside a nested room
    // C ref: Lua automatically handles coordinate conversion based on room context
    let absX = x;
    let absY = y;
    if (levelState.currentRoom && x !== undefined && y !== undefined) {
        // Coordinates are relative to room interior (excluding walls)
        absX = levelState.currentRoom.lx + 1 + x;
        absY = levelState.currentRoom.ly + 1 + y;
    }

    // DEFERRED EXECUTION: Queue monster placement for later (after corridors)
    // Store absolute coordinates since currentRoom context will be lost
    levelState.deferredMonsters.push({ opts_or_class, x: absX, y: absY });
}

/**
 * des.door(state, x, y)
 * Place a door at a location.
 * C ref: sp_lev.c spdoor_to_tmap()
 *
 * @param {string} state - Door state ("open", "closed", "locked", "nodoor", "random")
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
/**
 * des.door(state_or_opts, x, y)
 * Place a door at a location with specified state.
 * Can be called as:
 * - des.door("open", x, y) - place door at specific location
 * - des.door({ state: "nodoor", wall: "all" }) - place doors on room walls
 *
 * C ref: sp_lev.c lspo_door()
 *
 * @param {string|Object} state_or_opts - Door state string OR options object
 * @param {number} x - X coordinate (if first param is string)
 * @param {number} y - Y coordinate (if first param is string)
 */
export function door(state_or_opts, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let state, doorX, doorY, wall;

    // Handle both calling styles
    if (typeof state_or_opts === 'object') {
        // Options object style: des.door({ state: "nodoor", wall: "all" })
        state = state_or_opts.state || 'closed';
        wall = state_or_opts.wall;
        doorX = state_or_opts.x ?? -1;
        doorY = state_or_opts.y ?? -1;

        // If wall is specified, place doors on room walls
        if (wall && levelState.currentRoom) {
            placeDoorOnWall(levelState.currentRoom, state, wall);
            return;
        }
    } else {
        // String style: des.door("open", x, y)
        state = state_or_opts;
        doorX = x;
        doorY = y;
    }

    // Validate coordinates
    if (doorX < 0 || doorX >= COLNO || doorY < 0 || doorY >= ROWNO) {
        return; // Out of bounds or unspecified
    }

    const loc = levelState.map.locations[doorX][doorY];

    // Map state string to door flags
    // C ref: sp_lev.c doorstates2i[]
    let doorFlags;
    switch (state.toLowerCase()) {
        case 'open':
            doorFlags = D_ISOPEN;
            break;
        case 'closed':
            doorFlags = D_CLOSED;
            break;
        case 'locked':
            doorFlags = D_LOCKED;
            break;
        case 'nodoor':
            doorFlags = D_NODOOR;
            break;
        case 'broken':
            doorFlags = D_BROKEN || D_NODOOR; // Broken is like nodoor if constant not defined
            break;
        case 'secret':
            // Secret doors are SDOOR terrain type, not DOOR
            loc.typ = SDOOR;
            return;
        case 'random':
            // Random door state - C uses rnddoor()
            doorFlags = rn2(3) === 0 ? D_ISOPEN : (rn2(2) === 0 ? D_CLOSED : D_LOCKED);
            break;
        default:
            doorFlags = D_CLOSED; // Default to closed
    }

    // Set terrain type and flags
    loc.typ = DOOR;
    loc.flags = doorFlags;
}

/**
 * Helper: Place doors on room walls
 * @param {Object} room - Room object with lx, ly, hx, hy
 * @param {string} state - Door state
 * @param {string} wall - Which walls ("north", "south", "east", "west", "all", "random")
 */
function placeDoorOnWall(room, state, wall) {
    // For "nodoor" state with "all" walls, this typically means
    // the room should have no doors (open passages). In C this is
    // handled by setting NODOOR flag. For special levels, we just skip
    // creating actual door terrain.
    if (state === 'nodoor') {
        // No doors to place - subrooms in special levels often have nodoor
        // to create open passages
        return;
    }

    // TODO: Implement actual door placement on walls for other states
    // This would place doors at random or specific positions on the specified walls
}

/**
 * des.engraving(opts)
 * Place an engraving at a location.
 * C ref: sp_lev.c spengraving()
 *
 * @param {Object} opts - Engraving options (coord, type, text)
 */
export function engraving(opts) {
    // Stub - would create engraving at coord
    // For now, just ignore
}

/**
 * des.ladder(direction, x, y)
 * Place a ladder at a location.
 * C ref: sp_lev.c spladder()
 *
 * @param {string} direction - "up" or "down"
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function ladder(direction, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    if (x >= 0 && x < 80 && y >= 0 && y < 21) {
        // Place LADDER terrain
        levelState.map.locations[x][y].typ = LADDER;

        // Note: In C, ladders have additional metadata (up vs down)
        // For now, just place the terrain
    }
}

/**
 * des.altar(opts)
 * Place an altar at a location.
 * C ref: sp_lev.c spaltar()
 *
 * @param {Object} opts - Altar options (x, y, align, type)
 */
export function altar(opts) {
    // Stub - would place ALTAR terrain and add to altars list
    // For now, just ignore
}

/**
 * des.gold(opts)
 * Place gold at a location.
 * C ref: sp_lev.c spgold()
 *
 * @param {Object} opts - Gold options (x, y, amount)
 */
export function gold(opts) {
    // Stub - would create gold object with specified amount
    // For now, just ignore
}

/**
 * des.feature(type, x, y)
 * Place a map feature (fountain, sink, throne, etc.).
 * C ref: sp_lev.c sp_feature()
 *
 * @param {string} type - Feature type ("fountain", "sink", "throne", etc.)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function feature(type, x, y) {
    const terrainMap = {
        'fountain': FOUNTAIN,
        'sink': SINK,
        'throne': THRONE,
        'altar': ROOM, // Altar is handled by des.altar()
        'grave': ROOM  // Grave is a special object
    };

    const terrain = terrainMap[type];
    if (terrain === undefined) return;

    // Convert relative coordinates to absolute if inside a nested room
    // C ref: Lua automatically handles coordinate conversion based on room context
    let absX = x;
    let absY = y;
    if (levelState.currentRoom && x !== undefined && y !== undefined) {
        // Coordinates are relative to room interior (excluding walls)
        absX = levelState.currentRoom.lx + 1 + x;
        absY = levelState.currentRoom.ly + 1 + y;
    }

    if (absX >= 0 && absX < 80 && absY >= 0 && absY < 21) {
        levelState.map.locations[absX][absY].typ = terrain;
    }
}

/**
 * des.teleport_region(opts)
 * Define a teleportation region.
 * C ref: sp_lev.c sp_teleport_region()
 *
 * @param {Object} opts - Region options (region, dir)
 */
export function teleport_region(opts) {
    // Stub - would mark region for teleportation behavior
    // For now, just ignore
}

/**
 * des.random_corridors()
 *
 * Generate random corridors connecting rooms.
 * C ref: sp_lev.c lspo_random_corridors() -> mklev.c makecorridors()
 *
 * Connects all rooms in the current level with corridors and doors.
 * Uses the full makecorridors() algorithm from dungeon.js:
 * - Phase 1: Join consecutive rooms
 * - Phase 2: Join rooms 2 apart
 * - Phase 3: Connect all disconnected components
 * - Phase 4: Add random extra corridors
 */
export function random_corridors() {
    if (!levelState.map) {
        return; // No map to add corridors to
    }

    // Mark all rooms as needing joining
    // (Special levels create rooms but don't set needjoining)
    for (const room of levelState.map.rooms) {
        if (room.needjoining === undefined) {
            room.needjoining = true;
        }
    }

    // Call the full corridor generation algorithm
    // Depth is used for trap generation - use 1 as default for special levels
    const depth = 1;
    makecorridors(levelState.map, depth);
}

/**
 * Execute all deferred object placements
 * Called from finalize_level() after corridor generation
 */
function executeDeferredObjects() {
    for (const deferred of levelState.deferredObjects) {
        const { name_or_opts, x, y } = deferred;

        // Execute the original object() logic
        // Handle des.object() with no arguments - random object at random location
        if (name_or_opts === undefined) {
            const randClass = rn2(10);  // Random object class
            const obj = mkobj(randClass, true);
            if (obj) {
                obj.ox = rn2(60) + 10;
                obj.oy = rn2(15) + 3;
                levelState.map.objects.push(obj);
            }
            continue;
        }

        if (typeof name_or_opts === 'string') {
            // Check if it's a single-character object class
            if (name_or_opts.length === 1 && x === undefined) {
                const objClass = objectClassToType(name_or_opts);
                if (objClass >= 0) {
                    const randX = rn2(60) + 10;
                    const randY = rn2(15) + 3;
                    const obj = mkobj(objClass, true);
                    if (obj) {
                        obj.ox = randX;
                        obj.oy = randY;
                        levelState.map.objects.push(obj);
                    }
                }
            } else if (x !== undefined && y !== undefined) {
                const otyp = objectNameToType(name_or_opts);
                if (otyp >= 0 && x >= 0 && x < 80 && y >= 0 && y < 21) {
                    const obj = mksobj(otyp, true, false);
                    if (obj) {
                        obj.ox = x;
                        obj.oy = y;
                        levelState.map.objects.push(obj);
                    }
                }
            }
        } else if (name_or_opts && typeof name_or_opts === 'object') {
            let objId = name_or_opts.id;
            let coordX, coordY;

            if (name_or_opts.coord) {
                coordX = name_or_opts.coord.x;
                coordY = name_or_opts.coord.y;
            } else if (name_or_opts.x !== undefined && name_or_opts.y !== undefined) {
                coordX = name_or_opts.x;
                coordY = name_or_opts.y;
            }

            if (coordX === undefined || coordY === undefined) {
                coordX = rn2(60) + 10;
                coordY = rn2(15) + 3;
            }

            if (objId) {
                const otyp = objectNameToType(objId);
                if (otyp >= 0 && coordX >= 0 && coordX < 80 && coordY >= 0 && coordY < 21) {
                    const obj = mksobj(otyp, true, false);
                    if (obj) {
                        obj.ox = coordX;
                        obj.oy = coordY;
                        if (name_or_opts.montype && objId.toLowerCase() === 'corpse') {
                            obj.corpsenm = name_or_opts.montype;
                        }
                        levelState.map.objects.push(obj);
                    }
                }
            } else if (name_or_opts.class) {
                const objClass = objectClassToType(name_or_opts.class);
                if (objClass >= 0 && coordX >= 0 && coordX < 80 && coordY >= 0 && coordY < 21) {
                    const obj = mkobj(objClass, true);
                    if (obj) {
                        obj.ox = coordX;
                        obj.oy = coordY;
                        levelState.map.objects.push(obj);
                    }
                }
            }
        }
    }
}

/**
 * Execute all deferred monster placements
 * Called from finalize_level() after corridor generation
 */
function executeDeferredMonsters() {
    for (const deferred of levelState.deferredMonsters) {
        const { opts_or_class, x, y } = deferred;

        // Execute the original monster() logic
        let monsterId, coordX, coordY, opts;

        if (opts_or_class === undefined) {
            const randClass = String.fromCharCode(65 + rn2(26));
            if (!levelState.monsters) {
                levelState.monsters = [];
            }
            levelState.monsters.push({
                id: randClass,
                x: rn2(60) + 10,
                y: rn2(15) + 3
            });
            continue;
        }

        if (typeof opts_or_class === 'string') {
            if (x === undefined) {
                monsterId = opts_or_class;
                coordX = rn2(60) + 10;
                coordY = rn2(15) + 3;
                opts = {};
            } else {
                monsterId = opts_or_class;
                coordX = x;
                coordY = y;
                opts = {};
            }
        } else if (opts_or_class && typeof opts_or_class === 'object') {
            opts = opts_or_class;
            monsterId = opts.id || opts.class || '@';

            if (opts.coord) {
                coordX = opts.coord.x;
                coordY = opts.coord.y;
            } else {
                coordX = opts.x;
                coordY = opts.y;
            }

            if (coordX === undefined || coordY === undefined) {
                coordX = rn2(60) + 10;
                coordY = rn2(15) + 3;
            }
        }

        if (!monsterId || coordX === undefined || coordY === undefined ||
            coordX < 0 || coordX >= 80 || coordY < 0 || coordY >= 21) {
            continue;
        }

        if (!levelState.monsters) {
            levelState.monsters = [];
        }

        levelState.monsters.push({
            id: monsterId,
            x: coordX,
            y: coordY,
            name: opts?.name,
            waiting: opts?.waiting || false,
            peaceful: opts?.peaceful,
            asleep: opts?.asleep,
            align: opts?.align
        });
    }
}

/**
 * Execute all deferred trap placements
 * Called from finalize_level() after corridor generation
 */
function executeDeferredTraps() {
    for (const deferred of levelState.deferredTraps) {
        const { type_or_opts, x, y } = deferred;

        // Execute the original trap() logic
        let trapType, trapX, trapY;

        if (type_or_opts === undefined) {
            trapType = undefined;
            trapX = undefined;
            trapY = undefined;
        } else if (typeof type_or_opts === 'string') {
            trapType = type_or_opts;
            trapX = x;
            trapY = y;
        } else if (type_or_opts && typeof type_or_opts === 'object') {
            trapType = type_or_opts.type;
            if (type_or_opts.coord) {
                trapX = type_or_opts.coord.x;
                trapY = type_or_opts.coord.y;
            } else if (type_or_opts.x !== undefined && type_or_opts.y !== undefined) {
                trapX = type_or_opts.x;
                trapY = type_or_opts.y;
            }
        }

        if (trapX === undefined || trapY === undefined) {
            trapX = rn2(60) + 10;
            trapY = rn2(15) + 3;
        }

        let ttyp;
        if (!trapType) {
            ttyp = PIT;
        } else {
            ttyp = trapNameToType(trapType);
        }

        if (ttyp < 0 || trapX < 0 || trapX >= 80 || trapY < 0 || trapY >= 21) {
            continue;
        }

        const existing = levelState.map.trapAt(trapX, trapY);
        if (existing) {
            continue;
        }

        const newTrap = {
            ttyp: ttyp,
            tx: trapX,
            ty: trapY,
            tseen: (ttyp === HOLE),
            launch: { x: -1, y: -1 },
            launch2: { x: -1, y: -1 },
            dst: { dnum: -1, dlevel: -1 },
            tnote: 0,
            once: 0,
            madeby_u: 0,
            conjoined: 0,
        };

        levelState.map.traps.push(newTrap);
    }
}

/**
 * des.finalize_level()
 * Finalize level generation - must be called after all des.* calls.
 * C ref: sp_lev.c sp_level_loader()
 *
 * Performs post-processing steps:
 * 1. Execute all deferred placements (objects, monsters, traps)
 * 2. Copies monster requests from levelState to map.monsters
 * 3. Applies wallification (computes wall junction types)
 * 4. Applies random level flipping (horizontal/vertical)
 *
 * @returns {GameMap} The finalized map ready for gameplay
 */

/**
 * des.wallify()
 * Explicitly wallify the current map (compute wall junction types).
 * Usually called automatically by finalize_level(), but some levels call it explicitly.
 * C ref: sp_lev.c spo_wallify()
 */
export function wallify() {
    if (!levelState.map) {
        console.warn('wallify called but no map exists');
        return;
    }
    wallification(levelState.map);
}

export function finalize_level() {
    // CRITICAL: Execute deferred placements BEFORE wallification
    // This matches C's execution order: rooms → corridors → entities → wallify
    executeDeferredObjects();
    executeDeferredMonsters();
    executeDeferredTraps();

    // Copy monster requests to map
    if (levelState.monsters && levelState.map) {
        if (!levelState.map.monsters) {
            levelState.map.monsters = [];
        }
        levelState.map.monsters.push(...levelState.monsters);
    }

    // C ref: mklev.c:1388-1422 — Fill ordinary rooms with random content
    // This happens AFTER deferred content but BEFORE wallification
    if (levelState.map) {
        const map = levelState.map;
        const depth = levelState.levelDepth || 1;
        const OROOM = 0;
        const THEMEROOM = 1;
        const DEBUG = false;

        // Count fillable rooms (only top-level rooms, not subrooms)
        const isFillable = (r) => (r.rtype === OROOM || r.rtype === THEMEROOM)
                                  && r.needfill === FILL_NORMAL;
        let fillableCount = 0;
        for (let i = 0; i < map.nroom; i++) {
            const croom = map.rooms[i];
            if (DEBUG) console.log(`  Room ${i}: rtype=${croom.rtype}, needfill=${croom.needfill}, fillable=${isFillable(croom)}`);
            if (isFillable(croom)) fillableCount++;
        }

        if (DEBUG) console.log(`fillable_level: ${fillableCount} fillable rooms, depth=${depth}`);

        // One random fillable room gets bonus items
        let bonusCountdown = fillableCount > 0 ? rn2(fillableCount) : -1;

        for (let i = 0; i < map.nroom; i++) {
            const croom = map.rooms[i];
            const fillable = isFillable(croom);
            if (DEBUG && fillable) console.log(`  Filling room ${i}, bonus=${bonusCountdown === 0}`);
            fill_ordinary_room(map, croom, depth,
                               fillable && bonusCountdown === 0);
            if (fillable) bonusCountdown--;
        }
    }

    // Apply wallification first (before flipping)
    // C ref: sp_lev.c line 6028 - wallification before flip
    if (levelState.map) {
        wallification(levelState.map);
    }

    // Apply random flipping
    flipLevelRandom();

    // C ref: mklev.c:1533-1539 — level_finalize_topology()
    // bound_digging marks boundary stone as non-diggable before mineralize
    if (levelState.map) {
        bound_digging(levelState.map);
        // Get depth from level state or default to 1
        const depth = levelState.levelDepth || 1;
        mineralize(levelState.map, depth);
    }

    // TODO: Add other finalization steps (solidify_map, premapping, etc.)

    // Return the generated map
    return levelState.map;
}

/**
 * percent(n)
 * Returns true n% of the time.
 * C ref: sp_lev.c percent() macro
 *
 * @param {number} n - Percentage (0-100)
 * @returns {boolean} True if rn2(100) < n
 */
export function percent(n) {
    return rn2(100) < n;
}

/**
 * shuffle(array)
 * Fisher-Yates shuffle - randomize array order in place.
 * Used by Lua level scripts for random placement.
 *
 * @param {Array} arr - Array to shuffle
 */
export function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = rn2(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/**
 * nh object - NetHack game state queries
 * Stub implementations for Lua level compatibility
 */
export const nh = {
    /**
     * nh.is_genocided(monster_class)
     * Check if a monster class has been genocided.
     * Stub: always returns false (no genocide in basic game)
     */
    is_genocided: (monClass) => false,

    /**
     * nh.debug_themerm(is_fill)
     * Returns the value of THEMERM or THEMERMFILL environment variable for debug mode.
     * This is used to force selection of a specific themed room or fill during testing.
     *
     * C ref: nhlua.c:993 nhl_get_debug_themerm_name()
     *
     * Behavior:
     * - if is_fill is false, checks THEMERM env var (room selector)
     * - if is_fill is true, checks THEMERMFILL env var (fill selector)
     * - Returns null if not set or empty (normal reservoir sampling mode)
     * - Returns the env var value if set (debug mode - skips reservoir sampling)
     *
     * Note: In C, this only works in wizard mode. We don't enforce that restriction
     * in JS since our test harness may replay sessions that were generated in wizard mode.
     */
    debug_themerm: (is_fill) => {
        // Check if we're running in Node.js environment
        if (typeof process === 'undefined' || !process.env) {
            return null;
        }

        const varName = is_fill ? 'THEMERMFILL' : 'THEMERM';
        const value = typeof process !== 'undefined' ? process.env[varName] : undefined;

        // Return null if not set or empty (matching C behavior)
        if (!value || value === '') {
            return null;
        }

        return value;
    },
};

/**
 * Selection API - create rectangular selections
 */
export const selection = {
    /**
     * selection.room()
     * Create a selection containing all cells in the current room.
     * Used in themed room contents callbacks.
     * C ref: nhlua.c selection_room()
     */
    room: () => {
        // Get the current room being generated from levelState
        const currentRoom = levelState.currentRoom;
        if (!currentRoom) {
            // Fallback: return empty selection
            return selection.new();
        }

        // Create a selection with all cells in the room (excluding walls)
        const sel = selection.new();
        for (let y = currentRoom.ly + 1; y < currentRoom.hy; y++) {
            for (let x = currentRoom.lx + 1; x < currentRoom.hx; x++) {
                sel.set(x, y);
            }
        }
        return sel;
    },

    /**
     * selection.area(x1, y1, x2, y2)
     * Create a rectangular selection (filled rectangle).
     * Returns an object with both coords array and x1/y1/x2/y2 properties for compatibility.
     */
    area: (x1, y1, x2, y2) => {
        const coords = [];
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                coords.push({ x, y });
            }
        }

        return {
            coords,
            x1, y1, x2, y2, // Keep these for des.region compatibility
            set: (x, y) => coords.push({ x, y }),
            numpoints: () => coords.length,
            percentage: (pct) => {
                const newSel = selection.new();
                for (const coord of coords) {
                    if (rn2(100) < pct) {
                        newSel.set(coord.x, coord.y);
                    }
                }
                return newSel;
            },
            rndcoord: (filterValue) => {
                if (coords.length === 0) return undefined;
                const idx = rn2(coords.length);
                return coords[idx];
            },
            iterate: (func) => {
                for (const coord of coords) {
                    func(coord.x, coord.y);
                }
            },
            filter_mapchar: (ch) => {
                return selection.filter_mapchar({ coords, x1, y1, x2, y2 }, ch);
            },
            negate: () => {
                return selection.negate({ coords, x1, y1, x2, y2 });
            },
            grow: (iterations = 1) => {
                return selection.grow({ coords, x1, y1, x2, y2 }, iterations);
            },
            union: (other) => {
                const coordSet = new Set();
                coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                if (other && other.coords) {
                    other.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                }
                const result = selection.new();
                coordSet.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    result.set(x, y);
                });
                return result;
            },
            intersect: (other) => {
                if (!other || !other.coords) {
                    return selection.new();
                }
                const otherSet = new Set();
                other.coords.forEach(c => otherSet.add(`${c.x},${c.y}`));
                const result = selection.new();
                coords.forEach(c => {
                    const key = `${c.x},${c.y}`;
                    if (otherSet.has(key)) {
                        result.set(c.x, c.y);
                    }
                });
                return result;
            },
        };
    },

    /**
     * selection.line(x1, y1, x2, y2)
     * Create a line selection between two points using Bresenham's algorithm.
     */
    line: (x1, y1, x2, y2) => {
        const coords = [];
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        let x = x1;
        let y = y1;

        while (true) {
            coords.push({ x, y });
            if (x === x2 && y === y2) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
        return coords;
    },

    /**
     * selection.new()
     * Create a new empty selection (set of coordinates).
     */
    new: () => {
        const coords = [];
        const sel = {
            coords,
            set: (x, y) => {
                coords.push({ x, y });
            },
            /**
             * numpoints()
             * Get the number of points in this selection.
             */
            numpoints: () => {
                return coords.length;
            },
            /**
             * percentage(pct)
             * Return a new selection with randomly selected percentage of coordinates.
             * C ref: nhlua.c selection_filter_percent()
             */
            percentage: (pct) => {
                const newSel = selection.new();
                for (const coord of coords) {
                    if (rn2(100) < pct) {
                        newSel.set(coord.x, coord.y);
                    }
                }
                return newSel;
            },
            // Add rndcoord as a method for Lua compatibility
            rndcoord: (filterValue) => {
                // filterValue parameter is for Lua compatibility, usually unused
                if (coords.length === 0) return undefined;
                const idx = rn2(coords.length);
                return coords[idx];
            },
            /**
             * iterate(func)
             * Call a function for each coordinate in the selection.
             * The function receives (x, y) as parameters.
             */
            iterate: (func) => {
                for (const coord of coords) {
                    func(coord.x, coord.y);
                }
            },
            /**
             * filter_mapchar(ch)
             * Filter this selection to only include tiles matching a map character.
             * Returns a new selection.
             */
            filter_mapchar: (ch) => {
                return selection.filter_mapchar(sel, ch);
            },
            /**
             * negate()
             * Return a new selection with all map tiles NOT in this selection.
             */
            negate: () => {
                return selection.negate(sel);
            },
            /**
             * grow(iterations)
             * Expand selection by N cells in all 8 directions.
             */
            grow: (iterations = 1) => {
                return selection.grow(sel, iterations);
            },
            /**
             * union(other)
             * Return a new selection containing all coords from this selection and another.
             */
            union: (other) => {
                const coordSet = new Set();
                coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                if (other && other.coords) {
                    other.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                }
                const result = selection.new();
                coordSet.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    result.set(x, y);
                });
                return result;
            },
            /**
             * intersect(other)
             * Return a new selection containing only coords present in both selections.
             * C ref: Lua operator & for selections
             */
            intersect: (other) => {
                if (!other || !other.coords) {
                    return selection.new();
                }
                const otherSet = new Set();
                other.coords.forEach(c => otherSet.add(`${c.x},${c.y}`));
                const result = selection.new();
                coords.forEach(c => {
                    const key = `${c.x},${c.y}`;
                    if (otherSet.has(key)) {
                        result.set(c.x, c.y);
                    }
                });
                return result;
            },
        };
        return sel;
    },

    /**
     * selection.rndcoord(sel)
     * Get a random coordinate from a selection.
     *
     * @param {Object} sel - Selection object with coords array
     * @returns {Object} Random coordinate {x, y} or undefined if empty
     */
    rndcoord: (sel) => {
        if (!sel || !sel.coords || sel.coords.length === 0) {
            return undefined;
        }
        const idx = rn2(sel.coords.length);
        return sel.coords[idx];
    },

    /**
     * selection.rect(x1, y1, x2, y2)
     * Create a rectangular perimeter selection (border only, not filled).
     *
     * @returns {Object} Selection with coords array
     */
    rect: (x1, y1, x2, y2) => {
        const coords = [];
        // Top and bottom edges
        for (let x = x1; x <= x2; x++) {
            coords.push({ x, y: y1 });
            if (y2 !== y1) {
                coords.push({ x, y: y2 });
            }
        }
        // Left and right edges (excluding corners already added)
        for (let y = y1 + 1; y < y2; y++) {
            coords.push({ x: x1, y });
            if (x2 !== x1) {
                coords.push({ x: x2, y });
            }
        }
        return { coords };
    },

    /**
     * selection.grow(sel, iterations = 1)
     * Expand selection by N cells in all 8 directions.
     *
     * @param {Object} sel - Selection (coords array or rectangle)
     * @param {number} iterations - Number of times to grow (default 1)
     * @returns {Object} Expanded selection with coords array
     */
    grow: (sel, iterations = 1) => {
        if (!sel) return { coords: [] };

        // Convert to coord set
        let coordSet = new Set();
        if (sel.coords) {
            sel.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
        } else if (sel.x1 !== undefined) {
            // Rectangle format
            for (let y = sel.y1; y <= sel.y2; y++) {
                for (let x = sel.x1; x <= sel.x2; x++) {
                    coordSet.add(`${x},${y}`);
                }
            }
        }

        // Grow by adding neighbors
        for (let i = 0; i < iterations; i++) {
            const newCoords = new Set(coordSet);
            for (const key of coordSet) {
                const [x, y] = key.split(',').map(Number);
                // Add all 8 neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < COLNO && ny >= 0 && ny < ROWNO) {
                            newCoords.add(`${nx},${ny}`);
                        }
                    }
                }
            }
            coordSet = newCoords;
        }

        // Convert back to coords array and return proper selection object
        const coords = Array.from(coordSet).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
        const result = selection.new();
        coords.forEach(c => result.set(c.x, c.y));
        return result;
    },

    /**
     * selection.negate(sel)
     * Return the complement of the selection (all map tiles NOT in selection).
     *
     * @param {Object} sel - Selection to negate
     * @returns {Object} Negated selection with coords array
     */
    negate: (sel) => {
        let coords;
        if (!sel) {
            // No selection means select everything
            coords = [];
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    coords.push({ x, y });
                }
            }
        } else {
            // Convert to coord set for fast lookup
            const coordSet = new Set();
            if (sel.coords) {
                sel.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
            } else if (sel.x1 !== undefined) {
                // Rectangle format
                for (let y = sel.y1; y <= sel.y2; y++) {
                    for (let x = sel.x1; x <= sel.x2; x++) {
                        coordSet.add(`${x},${y}`);
                    }
                }
            }

            // Select all tiles NOT in the set
            coords = [];
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    if (!coordSet.has(`${x},${y}`)) {
                        coords.push({ x, y });
                    }
                }
            }
        }

        // Return a proper selection object with all methods
        const result = selection.new();
        coords.forEach(c => result.set(c.x, c.y));
        return result;
    },

    /**
     * selection.percentage(sel, pct)
     * Randomly select a percentage of coordinates from the selection.
     *
     * @param {Object} sel - Selection to filter
     * @param {number} pct - Percentage to keep (0-100)
     * @returns {Object} Filtered selection with coords array
     */
    percentage: (sel, pct) => {
        if (!sel || pct <= 0) return { coords: [] };
        if (pct >= 100) return sel;

        // Get all coords
        let allCoords = [];
        if (sel.coords) {
            allCoords = sel.coords;
        } else if (sel.x1 !== undefined) {
            // Rectangle format
            for (let y = sel.y1; y <= sel.y2; y++) {
                for (let x = sel.x1; x <= sel.x2; x++) {
                    allCoords.push({ x, y });
                }
            }
        }

        // Randomly keep pct% of coords
        const coords = allCoords.filter(() => rn2(100) < pct);
        return { coords };
    },

    /**
     * selection.floodfill(x, y, matchFn)
     * Flood fill from a starting point, selecting all connected cells matching a condition.
     *
     * @param {number} x - Starting X coordinate
     * @param {number} y - Starting Y coordinate
     * @param {Function} matchFn - Function(loc) that returns true if cell should be included
     * @returns {Object} Selection with coords array
     */
    floodfill: (x, y, matchFn) => {
        if (!levelState.map) {
            return selection.new();
        }

        const coords = [];
        const visited = new Set();
        const queue = [{ x, y }];

        while (queue.length > 0) {
            const pos = queue.shift();
            const key = `${pos.x},${pos.y}`;

            if (visited.has(key)) continue;
            if (pos.x < 0 || pos.x >= COLNO || pos.y < 0 || pos.y >= ROWNO) continue;

            visited.add(key);

            const loc = levelState.map.locations[pos.x][pos.y];
            if (!matchFn || matchFn(loc)) {
                coords.push({ x: pos.x, y: pos.y });

                // Add 4-connected neighbors
                queue.push({ x: pos.x - 1, y: pos.y });
                queue.push({ x: pos.x + 1, y: pos.y });
                queue.push({ x: pos.x, y: pos.y - 1 });
                queue.push({ x: pos.x, y: pos.y + 1 });
            }
        }

        // Return a proper selection object with all methods
        const sel = selection.new();
        coords.forEach(c => sel.set(c.x, c.y));
        return sel;
    },

    /**
     * selection.match(pattern)
     * Create selection of all map tiles matching a terrain type pattern.
     *
     * @param {string|number} pattern - Terrain type to match (ROOM, CORR, etc.)
     * @returns {Object} Selection with coords array
     */
    match: (pattern) => {
        if (!levelState.map) {
            const emptyBounds = () => ({ lx: 0, ly: 0, hx: 0, hy: 0 });
            const emptyNegate = function() { return selection.negate(this); };
            const emptyUnion = function(other) { return other || this; };
            return {
                coords: [],
                bounds: emptyBounds,
                negate: emptyNegate,
                union: emptyUnion
            };
        }

        const coords = [];
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const loc = levelState.map.locations[x][y];
                if (loc && loc.typ === pattern) {
                    coords.push({ x, y });
                }
            }
        }

        const sel = {
            coords,
            bounds: function() {
                if (coords.length === 0) return { lx: 0, ly: 0, hx: 0, hy: 0 };
                let lx = coords[0].x, hx = coords[0].x;
                let ly = coords[0].y, hy = coords[0].y;
                for (const c of coords) {
                    if (c.x < lx) lx = c.x;
                    if (c.x > hx) hx = c.x;
                    if (c.y < ly) ly = c.y;
                    if (c.y > hy) hy = c.y;
                }
                return { lx, ly, hx, hy };
            },
            negate: function() {
                return selection.negate(this);
            },
            union: function(other) {
                const coordSet = new Set();
                this.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                if (other && other.coords) {
                    other.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                }
                const unionCoords = Array.from(coordSet).map(s => {
                    const [x, y] = s.split(',').map(Number);
                    return { x, y };
                });
                return {
                    coords: unionCoords,
                    bounds: sel.bounds,
                    negate: sel.negate,
                    union: sel.union
                };
            }
        };
        return sel;
    },

    /**
     * selection.fillrect(x1, y1, x2, y2)
     * Create a filled rectangle selection.
     *
     * @param {number} x1 - Left x coordinate
     * @param {number} y1 - Top y coordinate
     * @param {number} x2 - Right x coordinate
     * @param {number} y2 - Bottom y coordinate
     * @returns {Object} Selection with coords array and bounds method
     */
    fillrect: (x1, y1, x2, y2) => {
        const coords = [];
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                coords.push({ x, y });
            }
        }
        const sel = {
            coords,
            bounds: () => ({ lx: x1, ly: y1, hx: x2, hy: y2 }),
            negate: function() {
                return selection.negate(this);
            },
            union: function(other) {
                const coordSet = new Set();
                this.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                if (other && other.coords) {
                    other.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                }
                const unionCoords = Array.from(coordSet).map(s => {
                    const [x, y] = s.split(',').map(Number);
                    return { x, y };
                });
                return {
                    coords: unionCoords,
                    bounds: sel.bounds,
                    negate: sel.negate,
                    union: sel.union
                };
            }
        };
        return sel;
    },

    /**
     * selection.filter_mapchar(sel, ch)
     * Filter selection to only include tiles matching a map character.
     *
     * @param {Object} sel - Selection to filter (or null for all tiles)
     * @param {string} ch - Map character to match (".", "#", "-", etc.)
     * @returns {Object} Filtered selection with coords array
     */
    filter_mapchar: (sel, ch) => {
        if (!levelState.map) return { coords: [] };

        // Map character to terrain type
        const charToType = {
            '.': ROOM,
            '#': CORR,
            '-': HWALL,
            '|': VWALL,
            '+': DOOR,
        };
        const targetType = charToType[ch];

        // Get coords to check
        let checkCoords = [];
        if (!sel) {
            // No selection = check all tiles
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    checkCoords.push({ x, y });
                }
            }
        } else if (sel.coords) {
            checkCoords = sel.coords;
        } else if (sel.x1 !== undefined) {
            // Rectangle format
            for (let y = sel.y1; y <= sel.y2; y++) {
                for (let x = sel.x1; x <= sel.x2; x++) {
                    checkCoords.push({ x, y });
                }
            }
        }

        // Filter to matching tiles
        const coords = checkCoords.filter(c => {
            const loc = levelState.map.locations[c.x]?.[c.y];
            return loc && loc.typ === targetType;
        });

        // Return a proper selection object with methods
        const result = selection.new();
        coords.forEach(c => result.set(c.x, c.y));
        return result;
    },
};

/**
 * des.drawbridge(opts)
 *
 * Create a drawbridge.
 * C ref: sp_lev.c lspo_drawbridge()
 *
 * @param {Object} opts - Drawbridge options
 *   - dir: Direction ("north", "south", "east", "west")
 *   - state: State ("open", "closed")
 *   - x, y: Coordinates
 */
export function drawbridge(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const { dir, state, x, y } = opts;

    if (x === undefined || y === undefined || x < 0 || x >= 80 || y < 0 || y >= 21) {
        return;
    }

    // For now, just place the drawbridge terrain
    // In C, drawbridges are complex: they can be opened/closed, have portcullises, etc.
    // For simplicity, we'll treat closed drawbridge as a door and open as floor
    const loc = levelState.map.locations[x][y];

    if (state === 'closed') {
        // Closed drawbridge - treat as a closed door
        loc.typ = DOOR;
        loc.doormask = D_CLOSED;
    } else {
        // Open drawbridge - treat as floor/corridor
        loc.typ = CORR;
    }

    // TODO: Implement full drawbridge mechanics (portcullis, opening/closing, etc.)
}

/**
 * des.mazewalk(x, y, direction)
 *
 * Create a maze passage starting from (x, y) going in the specified direction.
 * C ref: sp_lev.c lspo_mazewalk()
 *
 * @param {number} x - Starting X coordinate
 * @param {number} y - Starting Y coordinate
 * @param {string} direction - Direction to walk ("north", "south", "east", "west")
 */
export function mazewalk(x, y, direction) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    if (x === undefined || y === undefined) {
        return;
    }

    // Mazewalk creates a winding passage from the given point
    // For now, stub - in full implementation this would:
    // 1. Start at (x, y)
    // 2. Randomly walk in the general direction, carving CORR terrain
    // 3. Continue until hitting the edge or another passage

    // Simple stub: just ensure the starting point is passable
    if (x >= 0 && x < 80 && y >= 0 && y < 21) {
        const loc = levelState.map.locations[x][y];
        if (loc.typ === STONE || loc.typ === 0) {
            loc.typ = CORR;
        }
    }

    // TODO: Implement full mazewalk algorithm
}

// Export the des.* API
export const des = {
    level_init,
    level_flags,
    map,
    terrain,
    stair,
    ladder,
    altar,
    gold,
    object,
    trap,
    region,
    non_diggable,
    non_passwall,
    levregion,
    feature,
    teleport_region,
    exclusion,
    monster,
    door,
    engraving,
    drawbridge,
    mazewalk,
    finalize_level,
};
