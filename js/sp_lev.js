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
import {
    STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, ROOM, CORR,
    DOOR, SDOOR, IRONBARS, TREE, FOUNTAIN, POOL, MOAT, WATER,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, LAVAPOOL, ICE, CLOUD, AIR,
    STAIRS, LADDER, ALTAR, GRAVE, THRONE, SINK
} from './config.js';

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

    // Apply the initialization
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    if (style === 'solidfill') {
        // Fill entire map with foreground character
        const fillChar = levelState.init.fg;
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                levelState.map.locations[x][y].typ = fillChar;
            }
        }
    } else {
        throw new Error(`Level init style "${style}" not yet implemented`);
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
export function terrain(x, y, type) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    if (x >= 0 && x < 80 && y >= 0 && y < 21) {
        const terrainType = mapchrToTerrain(type);
        if (terrainType !== -1) {
            levelState.map.locations[x][y].typ = terrainType;
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
 * des.object(name_or_opts, x, y)
 *
 * Place an object at the specified location.
 * C ref: sp_lev.c lspo_object()
 *
 * @param {string|Object} name_or_opts - Object name or options object
 * @param {number} x - X coordinate (if name_or_opts is string)
 * @param {number} y - Y coordinate (if name_or_opts is string)
 */
export function object(name_or_opts, x, y) {
    // Stub implementation - just track that object was requested
    // Full implementation needs object placement system
    if (typeof name_or_opts === 'string') {
        // des.object("boulder", x, y)
        // TODO: Place object in map.objects array
    } else {
        // des.object({ class = "%" }) - random object
        // TODO: Place random object
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
export function trap(type, x, y) {
    // Stub implementation - just track that trap was requested
    // Full implementation needs trap placement system
    // TODO: Place trap in map.traps array
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
export function region(selection, type) {
    if (!levelState.map) {
        return;
    }

    // Handle "lit" type - mark all cells in selection as lit
    if (type === 'lit' && selection) {
        for (let x = selection.x1; x <= selection.x2; x++) {
            for (let y = selection.y1; y <= selection.y2; y++) {
                if (x >= 0 && x < 80 && y >= 0 && y < 21) {
                    levelState.map.locations[x][y].lit = 1;
                }
            }
        }
    }
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
 * Finalize level generation.
 * This should be called after all des.* calls to apply flipping and other
 * post-processing.
 * C ref: sp_lev.c sp_level_loader() calls wallification(), flip_level_rnd(), solidify_map(), etc.
 */
export function finalize_level() {
    // Apply wallification first (before flipping)
    // C ref: sp_lev.c line 6028 - wallification before flip
    if (levelState.map) {
        wallification(levelState.map);
    }

    // Apply random flipping
    flipLevelRandom();

    // TODO: Add other finalization steps (solidify_map, premapping, etc.)
}

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
};

// Export the des.* API
export const des = {
    level_init,
    level_flags,
    map,
    terrain,
    stair,
    object,
    trap,
    region,
    non_diggable,
    non_passwall,
    levregion,
    exclusion,
};
