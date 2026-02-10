/**
 * Special level registry and lookup
 *
 * Maps dungeon coordinates (dnum, dlevel) to special level generators.
 * C ref: sp_lev.c, dungeon.c
 */

import { rn2 } from './rng.js';

// Import special level generators
import { generate as generateKnox } from './levels/knox.js';
import { generate as generateMedusa } from './levels/medusa.js';
import { generate as generateMedusa2 } from './levels/medusa-2.js';
import { generate as generateMedusa3 } from './levels/medusa-3.js';
import { generate as generateMedusa4 } from './levels/medusa-4.js';
import { generate as generateSanctum } from './levels/sanctum.js';
import { generate as generateValley } from './levels/valley.js';
import { generate as generateTower1 } from './levels/tower1.js';
import { generate as generateTower2 } from './levels/tower2.js';
import { generate as generateTower3 } from './levels/tower3.js';
import { generate as generateWizard1 } from './levels/wizard1.js';
import { generate as generateWizard2 } from './levels/wizard2.js';
import { generate as generateWizard3 } from './levels/wizard3.js';

// Demon lair levels
// TODO: Fix converter issues in asmodeus.js
// import { generate as generateAsmodeus } from './levels/asmodeus.js';
import { generate as generateBaalz } from './levels/baalz.js';
import { generate as generateJuiblex } from './levels/juiblex.js';
import { generate as generateOrcus } from './levels/orcus.js';

// Main dungeon special levels
import { generate as generateCastle } from './levels/castle.js';
import { generate as generateOracle } from './levels/oracle.js';

// Special room variants
import { generate as generateBigroom } from './levels/bigroom.js';
import { generate as generateBigroom2 } from './levels/bigroom-2.js';
import { generate as generateBigroom3 } from './levels/bigroom-3.js';
import { generate as generateBigroom4 } from './levels/bigroom-4.js';
import { generate as generateBigroom5 } from './levels/bigroom-5.js';
import { generate as generateBigroom6 } from './levels/bigroom-6.js';
import { generate as generateBigroom7 } from './levels/bigroom-7.js';
import { generate as generateBigroom8 } from './levels/bigroom-8.js';
import { generate as generateBigroom9 } from './levels/bigroom-9.js';
import { generate as generateBigroom10 } from './levels/bigroom-10.js';
import { generate as generateBigroom11 } from './levels/bigroom-11.js';
import { generate as generateBigroom12 } from './levels/bigroom-12.js';
import { generate as generateBigroom13 } from './levels/bigroom-13.js';

// Gnomish Mines levels
import { generate as generateMinetn1 } from './levels/minetn-1.js';
// TODO: Fix converter issues in minetn-2.js through minetn-4.js and minetn-7.js
// import { generate as generateMinetn2 } from './levels/minetn-2.js';
// import { generate as generateMinetn3 } from './levels/minetn-3.js';
// import { generate as generateMinetn4 } from './levels/minetn-4.js';
import { generate as generateMinetn5 } from './levels/minetn-5.js';
import { generate as generateMinetn6 } from './levels/minetn-6.js';
// import { generate as generateMinetn7 } from './levels/minetn-7.js';
import { generate as generateMinend1 } from './levels/minend-1.js';
import { generate as generateMinend2 } from './levels/minend-2.js';
// TODO: Fix converter issues in minend-3.js
// import { generate as generateMinend3 } from './levels/minend-3.js';

// Sokoban levels
import { generate as generateSoko1a } from './levels/soko1-1.js';
import { generate as generateSoko1b } from './levels/soko1-2.js';
import { generate as generateSoko2a } from './levels/soko2-1.js';
import { generate as generateSoko2b } from './levels/soko2-2.js';
import { generate as generateSoko3a } from './levels/soko3-1.js';
import { generate as generateSoko3b } from './levels/soko3-2.js';
import { generate as generateSoko4a } from './levels/soko4-1.js';
import { generate as generateSoko4b } from './levels/soko4-2.js';

// Elemental Planes
import { generate as generateAir } from './levels/air.js';
// TODO: Fix converter issues in astral.js
// import { generate as generateAstral } from './levels/astral.js';
import { generate as generateEarth } from './levels/earth.js';
import { generate as generateFire } from './levels/fire.js';
import { generate as generateWater } from './levels/water.js';

/**
 * Dungeon branch numbers
 * C ref: include/dungeon.h
 */
export const DUNGEONS_OF_DOOM = 0;
export const GNOMISH_MINES = 1;
export const SOKOBAN = 2;
export const QUEST = 3;
export const KNOX = 4;  // Fort Ludios
export const GEHENNOM = 5;
export const VLADS_TOWER = 6;
export const ELEMENTAL_PLANES = 7;

/**
 * Special level lookup table
 * Maps (dnum, dlevel) to generator function(s)
 *
 * Note: This is a simplified version for the levels we've ported.
 * Full implementation would use C's sp_lev.c level selection logic.
 */
const specialLevels = new Map();

/**
 * Cache for variant selections (so the same variant is used consistently)
 * Maps "dnum:dlevel" to chosen variant index
 */
const variantCache = new Map();

/**
 * Register a special level at a specific dungeon location
 * @param {number} dnum - Dungeon number
 * @param {number} dlevel - Dungeon level (1-based)
 * @param {Function|Array<Function>} generator - Level generator function or array of variant generators
 * @param {string|Array<string>} name - Level name(s) for debugging
 */
function registerSpecialLevel(dnum, dlevel, generator, name) {
    const key = `${dnum}:${dlevel}`;
    specialLevels.set(key, { generator, name, dnum, dlevel });
}

/**
 * Get special level generator for a dungeon location
 * @param {number} dnum - Dungeon number
 * @param {number} dlevel - Dungeon level (1-based)
 * @returns {Object|null} - { generator, name } or null if no special level
 */
export function getSpecialLevel(dnum, dlevel) {
    const key = `${dnum}:${dlevel}`;
    const entry = specialLevels.get(key);

    if (!entry) {
        return null;
    }

    // Handle variant arrays
    if (Array.isArray(entry.generator)) {
        // Check cache first
        let variantIndex = variantCache.get(key);

        // If not cached, pick a variant using RNG
        if (variantIndex === undefined) {
            variantIndex = rn2(entry.generator.length);
            variantCache.set(key, variantIndex);
        }

        return {
            generator: entry.generator[variantIndex],
            name: Array.isArray(entry.name) ? entry.name[variantIndex] : entry.name,
            dnum: entry.dnum,
            dlevel: entry.dlevel
        };
    }

    // Single generator
    return entry;
}

/**
 * Reset variant cache (called when starting a new game)
 */
export function resetVariantCache() {
    variantCache.clear();
}

/**
 * Check if a location has a special level
 * @param {number} dnum - Dungeon number
 * @param {number} dlevel - Dungeon level (1-based)
 * @returns {boolean}
 */
export function hasSpecialLevel(dnum, dlevel) {
    return specialLevels.has(`${dnum}:${dlevel}`);
}

// Register Fort Ludios (Knox)
// Fort Ludios is its own branch, accessed via magic portal
registerSpecialLevel(KNOX, 1, generateKnox, 'knox');

// Register Vlad's Tower (3 levels)
// Tower is in its own branch, levels 1-3
registerSpecialLevel(VLADS_TOWER, 1, generateTower1, 'tower1');
registerSpecialLevel(VLADS_TOWER, 2, generateTower2, 'tower2');
registerSpecialLevel(VLADS_TOWER, 3, generateTower3, 'tower3');

// Register Gehennom levels
// Valley is the entrance to Gehennom (level 1)
// Demon lairs are scattered throughout Gehennom (levels 3-6)
// Sanctum is the final level (level 10 in a typical game)
// Wizard's Tower appears after getting the Amulet (levels 11-13)
registerSpecialLevel(GEHENNOM, 1, generateValley, 'valley');
// TODO: Fix converter issues in asmodeus.js
// registerSpecialLevel(GEHENNOM, 3, generateAsmodeus, 'asmodeus');
registerSpecialLevel(GEHENNOM, 4, generateBaalz, 'baalz');
registerSpecialLevel(GEHENNOM, 5, generateJuiblex, 'juiblex');
registerSpecialLevel(GEHENNOM, 6, generateOrcus, 'orcus');
registerSpecialLevel(GEHENNOM, 10, generateSanctum, 'sanctum');
registerSpecialLevel(GEHENNOM, 11, generateWizard1, 'wizard1');
registerSpecialLevel(GEHENNOM, 12, generateWizard2, 'wizard2');
registerSpecialLevel(GEHENNOM, 13, generateWizard3, 'wizard3');

// Register Sokoban levels (4 levels, 2 variants each)
// Sokoban is accessed from Dungeons of Doom around depth 6-9
// Player gets one of two variants per level (a or b)
// Variant selection happens at first access using RNG, then cached
registerSpecialLevel(SOKOBAN, 1, [generateSoko1a, generateSoko1b], ['soko1-1', 'soko1-2']);
registerSpecialLevel(SOKOBAN, 2, [generateSoko2a, generateSoko2b], ['soko2-1', 'soko2-2']);
registerSpecialLevel(SOKOBAN, 3, [generateSoko3a, generateSoko3b], ['soko3-1', 'soko3-2']);
registerSpecialLevel(SOKOBAN, 4, [generateSoko4a, generateSoko4b], ['soko4-1', 'soko4-2']);

// Register Gnomish Mines levels
// Minetown appears at a random depth in the Mines (7 variants)
// Mines' End is at the bottom of the Mines (3 variants)
// Note: In actual C NetHack, these are selected randomly, not registered at fixed depths
// For now, registering Minetown at depth 3 and Mines' End at depth 5 for testing
// TODO: Add minetn-2, minetn-3, minetn-4, and minetn-7 once converter issues are fixed
registerSpecialLevel(GNOMISH_MINES, 3, [generateMinetn1, generateMinetn5, generateMinetn6], ['minetn-1', 'minetn-5', 'minetn-6']);
// TODO: Add minend-3 once converter issues are fixed
registerSpecialLevel(GNOMISH_MINES, 5, [generateMinend1, generateMinend2], ['minend-1', 'minend-2']);

// Register Elemental Planes (endgame)
// Planes are accessed after getting the Amulet of Yendor
registerSpecialLevel(ELEMENTAL_PLANES, 1, generateEarth, 'earth');
registerSpecialLevel(ELEMENTAL_PLANES, 2, generateAir, 'air');
registerSpecialLevel(ELEMENTAL_PLANES, 3, generateFire, 'fire');
registerSpecialLevel(ELEMENTAL_PLANES, 4, generateWater, 'water');
// TODO: Fix converter issues in astral.js
// registerSpecialLevel(ELEMENTAL_PLANES, 5, generateAstral, 'astral');

// Register special levels in main dungeon
// In Dungeons of Doom, at depths that vary by dungeon generation
// Using specific depths for testing (actual depths determined at runtime)

// Oracle (appears around depth 5-9)
registerSpecialLevel(DUNGEONS_OF_DOOM, 5, generateOracle, 'oracle');

// Medusa (4 variants, appears around depth 20)
registerSpecialLevel(DUNGEONS_OF_DOOM, 20, [generateMedusa, generateMedusa2, generateMedusa3, generateMedusa4], ['medusa-1', 'medusa-2', 'medusa-3', 'medusa-4']);

// Castle (appears around depth 25)
registerSpecialLevel(DUNGEONS_OF_DOOM, 25, generateCastle, 'castle');

// Big Room (13 variants, can appear at various depths)
registerSpecialLevel(DUNGEONS_OF_DOOM, 10, [generateBigroom, generateBigroom2, generateBigroom3, generateBigroom4, generateBigroom5, generateBigroom6, generateBigroom7, generateBigroom8, generateBigroom9, generateBigroom10, generateBigroom11, generateBigroom12, generateBigroom13], ['bigroom-1', 'bigroom-2', 'bigroom-3', 'bigroom-4', 'bigroom-5', 'bigroom-6', 'bigroom-7', 'bigroom-8', 'bigroom-9', 'bigroom-10', 'bigroom-11', 'bigroom-12', 'bigroom-13']);

/**
 * Get list of all registered special levels
 * @returns {Array} Array of { dnum, dlevel, name, variants }
 */
export function listSpecialLevels() {
    return Array.from(specialLevels.values()).map(({ dnum, dlevel, name, generator }) => {
        const isVariant = Array.isArray(generator);
        return {
            dnum,
            dlevel,
            name: isVariant ? name.join(' / ') : name,
            variants: isVariant ? name.length : 1
        };
    });
}
