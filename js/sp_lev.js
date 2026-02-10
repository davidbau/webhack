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

import { GameMap } from './map.js';
import { rn2, rnd } from './rng.js';
import { mksobj, mkobj } from './mkobj.js';
import {
    STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, ROOM, CORR,
    DOOR, SDOOR, IRONBARS, TREE, FOUNTAIN, POOL, MOAT, WATER,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, LAVAPOOL, ICE, CLOUD, AIR,
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
let levelState = {
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
};

// Special level flags
let icedpools = false;
let Sokoban = false;

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
    };
    icedpools = false;
    Sokoban = false;
}

/**
 * Get the current level state (for testing/debugging)
 */
export function getLevelState() {
    return levelState;
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
    } else {
        // Other styles (rogue, mines) would need more complex generation
        // For now, default to solidfill behavior
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

    let mapStr, halign = 'center', valign = 'center', x, y, lit = false;

    if (typeof data === 'string') {
        mapStr = data;
    } else {
        mapStr = data.map || data;
        halign = data.halign || 'center';
        valign = data.valign || 'center';
        x = data.x;
        y = data.y;
        lit = data.lit || false;
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

    // Handle des.object() with no arguments - random object at random location
    if (name_or_opts === undefined) {
        const randClass = rn2(10);  // Random object class
        const obj = mkobj(randClass, true);
        if (obj) {
            obj.ox = rn2(60) + 10;
            obj.oy = rn2(15) + 3;
            levelState.map.objects.push(obj);
        }
        return;
    }

    if (typeof name_or_opts === 'string') {
        // Check if it's a single-character object class (e.g., '[', ')', '!', etc.)
        if (name_or_opts.length === 1 && x === undefined) {
            // des.object('[') - place random object from class at random location
            const objClass = objectClassToType(name_or_opts);
            if (objClass >= 0) {
                // Place random object from this class at random ROOM location
                // TODO: Implement proper random room location selection
                // For now, place at a semi-random location based on RNG
                const randX = rn2(60) + 10;  // Avoid edges
                const randY = rn2(15) + 3;
                const obj = mkobj(objClass, true);
                if (obj) {
                    obj.ox = randX;
                    obj.oy = randY;
                    levelState.map.objects.push(obj);
                }
            }
        } else if (x !== undefined && y !== undefined) {
            // des.object("boulder", x, y) - place named object at position
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
        // Handle various object placement formats
        let objId = name_or_opts.id;
        let coordX, coordY;

        // Get coordinates from various formats
        if (name_or_opts.coord) {
            coordX = name_or_opts.coord.x;
            coordY = name_or_opts.coord.y;
        } else if (name_or_opts.x !== undefined && name_or_opts.y !== undefined) {
            coordX = name_or_opts.x;
            coordY = name_or_opts.y;
        }

        // If no coordinates provided, use random placement
        if (coordX === undefined || coordY === undefined) {
            coordX = rn2(60) + 10;  // Avoid edges
            coordY = rn2(15) + 3;
        }

        if (objId) {
            // des.object({ id: 'chest', coord: {x, y} }) or des.object({ id: 'chest', x, y })
            // des.object({ id: 'corpse', montype: 'wizard' }) - corpse with monster type
            const otyp = objectNameToType(objId);
            if (otyp >= 0 && coordX >= 0 && coordX < 80 && coordY >= 0 && coordY < 21) {
                const obj = mksobj(otyp, true, false);
                if (obj) {
                    obj.ox = coordX;
                    obj.oy = coordY;
                    // Handle corpse with montype
                    if (name_or_opts.montype && objId.toLowerCase() === 'corpse') {
                        // Store montype for corpse generation
                        obj.corpsenm = name_or_opts.montype;
                    }
                    levelState.map.objects.push(obj);
                }
            }
        } else if (name_or_opts.class) {
            // des.object({ class: "%" }) - place random object from class
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

    let trapType, trapX, trapY;

    // Handle des.trap() with no arguments - random trap at random location
    if (type_or_opts === undefined) {
        trapType = undefined;  // Will be set to PIT later
        trapX = undefined;  // Will trigger random placement
        trapY = undefined;
    } else if (typeof type_or_opts === 'string') {
        // des.trap("pit", x, y)
        trapType = type_or_opts;
        trapX = x;
        trapY = y;
    } else if (type_or_opts && typeof type_or_opts === 'object') {
        // des.trap({ coord: {x, y} }) or des.trap({ type: "pit", coord: {x, y} })
        trapType = type_or_opts.type;
        if (type_or_opts.coord) {
            trapX = type_or_opts.coord.x;
            trapY = type_or_opts.coord.y;
        } else if (type_or_opts.x !== undefined && type_or_opts.y !== undefined) {
            trapX = type_or_opts.x;
            trapY = type_or_opts.y;
        }
    }

    // Random placement if no coordinates specified
    if (trapX === undefined || trapY === undefined) {
        trapX = rn2(60) + 10;  // Avoid edges
        trapY = rn2(15) + 3;
    }

    // If no trap type specified, use a random one (default to PIT for now)
    let ttyp;
    if (!trapType) {
        ttyp = PIT; // TODO: Implement random trap selection
    } else {
        ttyp = trapNameToType(trapType);
    }

    if (ttyp < 0 || trapX < 0 || trapX >= 80 || trapY < 0 || trapY >= 21) {
        return;
    }

    // Check if trap already exists at this position
    const existing = levelState.map.trapAt(trapX, trapY);
    if (existing) {
        return; // Don't overwrite existing trap
    }

    // Create trap structure matching dungeon.js maketrap()
    const newTrap = {
        ttyp: ttyp,
        tx: trapX,
        ty: trapY,
        tseen: (ttyp === HOLE), // Holes are always visible (unhideable_trap)
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

    // Handle des.monster() with no arguments - random monster at random location
    if (opts_or_class === undefined) {
        const randClass = String.fromCharCode(65 + rn2(26));  // Random letter A-Z
        if (!levelState.monsters) {
            levelState.monsters = [];
        }
        levelState.monsters.push({
            id: randClass,
            x: rn2(60) + 10,
            y: rn2(15) + 3
        });
        return;
    }

    // Handle different call formats:
    // 1. des.monster() - random monster at random location
    // 2. des.monster('V') - random monster from class at random location
    // 3. des.monster('vampire', x, y) - named monster at specific location
    // 4. des.monster({ id: 'vampire', x, y, ... }) - full options object

    let monsterId, coordX, coordY, opts;

    if (opts_or_class === undefined) {
        // des.monster() - completely random monster at random location
        monsterId = '@';  // Random monster (any class)
        coordX = rn2(60) + 10;  // Avoid edges
        coordY = rn2(15) + 3;
        opts = {};
    } else if (typeof opts_or_class === 'string') {
        if (x === undefined) {
            // des.monster('V') - random placement
            monsterId = opts_or_class;
            coordX = rn2(60) + 10;  // Avoid edges
            coordY = rn2(15) + 3;
            opts = {};
        } else {
            // des.monster('vampire', x, y) - specific placement
            monsterId = opts_or_class;
            coordX = x;
            coordY = y;
            opts = {};
        }
    } else if (opts_or_class && typeof opts_or_class === 'object') {
        // des.monster({ id: 'vampire', x, y, ... }) or des.monster({ class: 'S', x, y })
        // des.monster({ x, y }) - random monster at specific location
        opts = opts_or_class;
        monsterId = opts.id || opts.class || '@';  // Support 'id', 'class', or default to random

        if (opts.coord) {
            coordX = opts.coord.x;
            coordY = opts.coord.y;
        } else {
            coordX = opts.x;
            coordY = opts.y;
        }

        // Random placement if no coordinates
        if (coordX === undefined || coordY === undefined) {
            coordX = rn2(60) + 10;
            coordY = rn2(15) + 3;
        }
    }

    if (!monsterId || coordX === undefined || coordY === undefined ||
        coordX < 0 || coordX >= 80 || coordY < 0 || coordY >= 21) {
        return; // Invalid parameters
    }

    // Store monster request in levelState
    if (!levelState.monsters) {
        levelState.monsters = [];
    }

    levelState.monsters.push({
        id: monsterId,
        x: coordX,
        y: coordY,
        name: opts.name,
        waiting: opts.waiting || false,
        peaceful: opts.peaceful,
        asleep: opts.asleep,
        align: opts.align
    });

    // Note: Full implementation would call makemon() with appropriate parameters
    // and set monster properties like mtame, mpeaceful, msleeping, etc.
    // This requires the game to be fully initialized, which happens during
    // actual gameplay, not during level generation.
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
 * des.door(state, x, y)
 * Place a door at a location with specified state.
 * C ref: sp_lev.c lspo_door()
 *
 * @param {string} state - Door state: "open", "closed", "locked", "nodoor", "broken", "secret", "random"
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function door(state, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    if (x < 0 || x >= 80 || y < 0 || y >= 21) {
        return; // Out of bounds
    }

    const loc = levelState.map.locations[x][y];

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
    if (terrain !== undefined && x >= 0 && x < 80 && y >= 0 && y < 21) {
        levelState.map.locations[x][y].typ = terrain;
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
 * des.finalize_level()
 * Finalize level generation - must be called after all des.* calls.
 * C ref: sp_lev.c sp_level_loader()
 *
 * Performs post-processing steps:
 * 1. Copies monster requests from levelState to map.monsters
 * 2. Applies wallification (computes wall junction types)
 * 3. Applies random level flipping (horizontal/vertical)
 *
 * @returns {GameMap} The finalized map ready for gameplay
 */
export function finalize_level() {
    // Copy monster requests to map
    if (levelState.monsters && levelState.map) {
        if (!levelState.map.monsters) {
            levelState.map.monsters = [];
        }
        levelState.map.monsters.push(...levelState.monsters);
    }

    // Apply wallification first (before flipping)
    // C ref: sp_lev.c line 6028 - wallification before flip
    if (levelState.map) {
        wallification(levelState.map);
    }

    // Apply random flipping
    flipLevelRandom();

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
};

/**
 * Selection API - create rectangular selections
 */
export const selection = {
    /**
     * selection.area(x1, y1, x2, y2)
     * Create a rectangular selection.
     */
    area: (x1, y1, x2, y2) => {
        return { x1, y1, x2, y2 };
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
        return {
            coords,
            set: (x, y) => {
                coords.push({ x, y });
            },
        };
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

        // Convert back to coords array
        const coords = Array.from(coordSet).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
        return { coords };
    },

    /**
     * selection.negate(sel)
     * Return the complement of the selection (all map tiles NOT in selection).
     *
     * @param {Object} sel - Selection to negate
     * @returns {Object} Negated selection with coords array
     */
    negate: (sel) => {
        if (!sel) {
            // No selection means select everything
            const coords = [];
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    coords.push({ x, y });
                }
            }
            return { coords };
        }

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
        const coords = [];
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                if (!coordSet.has(`${x},${y}`)) {
                    coords.push({ x, y });
                }
            }
        }
        return { coords };
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
        if (!levelState.map) return { coords: [] };

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

        return { coords };
    },

    /**
     * selection.match(pattern)
     * Create selection of all map tiles matching a terrain type pattern.
     *
     * @param {string|number} pattern - Terrain type to match (ROOM, CORR, etc.)
     * @returns {Object} Selection with coords array
     */
    match: (pattern) => {
        if (!levelState.map) return { coords: [] };

        const coords = [];
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const loc = levelState.map.locations[x][y];
                if (loc && loc.typ === pattern) {
                    coords.push({ x, y });
                }
            }
        }
        return { coords };
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

        return { coords };
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
