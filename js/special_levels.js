/**
 * Special level registry and lookup
 *
 * Maps dungeon coordinates (dnum, dlevel) to special level generators.
 * C ref: sp_lev.c, dungeon.c
 */

// Import special level generators
import { generate as generateKnox } from './levels/knox.js';
import { generate as generateMedusa } from './levels/medusa.js';
import { generate as generateSanctum } from './levels/sanctum.js';
import { generate as generateValley } from './levels/valley.js';
import { generate as generateTower1 } from './levels/tower1.js';
import { generate as generateTower2 } from './levels/tower2.js';
import { generate as generateTower3 } from './levels/tower3.js';
import { generate as generateWizard1 } from './levels/wizard1.js';
import { generate as generateWizard2 } from './levels/wizard2.js';
import { generate as generateWizard3 } from './levels/wizard3.js';

// Demon lair levels
import { generate as generateAsmodeus } from './levels/asmodeus.js';
import { generate as generateBaalz } from './levels/baalz.js';
import { generate as generateJuiblex } from './levels/juiblex.js';
import { generate as generateOrcus } from './levels/orcus.js';

// Sokoban levels
import { generate as generateSoko1a } from './levels/soko1-1.js';
import { generate as generateSoko1b } from './levels/soko1-2.js';
import { generate as generateSoko2a } from './levels/soko2-1.js';
import { generate as generateSoko2b } from './levels/soko2-2.js';
import { generate as generateSoko3a } from './levels/soko3-1.js';
import { generate as generateSoko3b } from './levels/soko3-2.js';
import { generate as generateSoko4a } from './levels/soko4-1.js';
import { generate as generateSoko4b } from './levels/soko4-2.js';

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

/**
 * Special level lookup table
 * Maps (dnum, dlevel) to generator function
 *
 * Note: This is a simplified version for the levels we've ported.
 * Full implementation would use C's sp_lev.c level selection logic.
 */
const specialLevels = new Map();

/**
 * Register a special level at a specific dungeon location
 * @param {number} dnum - Dungeon number
 * @param {number} dlevel - Dungeon level (1-based)
 * @param {Function} generator - Level generator function
 * @param {string} name - Level name (for debugging)
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
    return specialLevels.get(key) || null;
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
registerSpecialLevel(GEHENNOM, 3, generateAsmodeus, 'asmodeus');
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
// For now, using 'a' variants as default
registerSpecialLevel(SOKOBAN, 1, generateSoko1a, 'soko1a');
registerSpecialLevel(SOKOBAN, 2, generateSoko2a, 'soko2a');
registerSpecialLevel(SOKOBAN, 3, generateSoko3a, 'soko3a');
registerSpecialLevel(SOKOBAN, 4, generateSoko4a, 'soko4a');

// Register Medusa's lair
// In Dungeons of Doom, at a depth that varies by dungeon generation
// Using depth 20 as a typical location (actual depth determined at runtime)
registerSpecialLevel(DUNGEONS_OF_DOOM, 20, generateMedusa, 'medusa');

/**
 * Get list of all registered special levels
 * @returns {Array} Array of { dnum, dlevel, name }
 */
export function listSpecialLevels() {
    return Array.from(specialLevels.values()).map(({ dnum, dlevel, name }) => ({
        dnum,
        dlevel,
        name
    }));
}
