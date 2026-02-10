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

// Main dungeon special levels
import { generate as generateCastle } from './levels/castle.js';

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
import { generate as generateBigroom12 } from './levels/bigroom-12.js';
import { generate as generateBigroom13 } from './levels/bigroom-13.js';

// Themed special levels
import { generate as generateWater } from './levels/water.js';
import { generate as generateLava } from './levels/lava.js';
import { generate as generateGraveyard } from './levels/graveyard.js';
import { generate as generateVault } from './levels/vault.js';
import { generate as generateIce } from './levels/ice.js';
import { generate as generateForest } from './levels/forest.js';
import { generate as generateClouds } from './levels/clouds.js';
import { generate as generateGarden } from './levels/garden.js';
import { generate as generateTemple } from './levels/temple.js';
import { generate as generatePrison } from './levels/prison.js';
import { generate as generateLibrary } from './levels/library.js';
import { generate as generateCavern } from './levels/cavern.js';
import { generate as generateArena } from './levels/arena.js';
import { generate as generateThrone } from './levels/throne.js';
import { generate as generateDesert } from './levels/desert.js';
import { generate as generateSwamp } from './levels/swamp.js';
import { generate as generateCrystal } from './levels/crystal.js';
import { generate as generateRuins } from './levels/ruins.js';
import { generate as generateLaboratory } from './levels/laboratory.js';
import { generate as generateHedgemaze } from './levels/hedgemaze.js';
import { generate as generateVolcano } from './levels/volcano.js';
import { generate as generateCavern2 } from './levels/cavern2.js';
import { generate as generateNecropolis } from './levels/necropolis.js';
import { generate as generateBarracks } from './levels/barracks.js';
import { generate as generateFungus } from './levels/fungus.js';
import { generate as generateDragonLair } from './levels/dragon_lair.js';
import { generate as generateCathedral } from './levels/cathedral.js';
import { generate as generateMines } from './levels/mines.js';
import { generate as generateWorkshop } from './levels/workshop.js';
import { generate as generateChasm } from './levels/chasm.js';
import { generate as generatePillars } from './levels/pillars.js';
import { generate as generateMenagerie } from './levels/menagerie.js';
import { generate as generateMaze2 } from './levels/maze2.js';
import { generate as generateOasis } from './levels/oasis.js';
import { generate as generateGlacier } from './levels/glacier.js';
import { generate as generateStronghold } from './levels/stronghold.js';
import { generate as generateCrypt } from './levels/crypt.js';
import { generate as generateAnthill } from './levels/anthill.js';
import { generate as generateAbyss } from './levels/abyss.js';
import { generate as generateCoral } from './levels/coral.js';
import { generate as generateQuarry } from './levels/quarry.js';
import { generate as generateSpiderNest } from './levels/spider_nest.js';
import { generate as generateBazaar } from './levels/bazaar.js';
import { generate as generateArmory } from './levels/armory.js';
import { generate as generateColosseum } from './levels/colosseum.js';
import { generate as generateObservatory } from './levels/observatory.js';
import { generate as generateSewers } from './levels/sewers.js';
import { generate as generateBeehive } from './levels/beehive.js';
import { generate as generateFoundry } from './levels/foundry.js';
import { generate as generateSanctum2 } from './levels/sanctum2.js';

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
// Variant selection happens at first access using RNG, then cached
registerSpecialLevel(SOKOBAN, 1, [generateSoko1a, generateSoko1b], ['soko1-1', 'soko1-2']);
registerSpecialLevel(SOKOBAN, 2, [generateSoko2a, generateSoko2b], ['soko2-1', 'soko2-2']);
registerSpecialLevel(SOKOBAN, 3, [generateSoko3a, generateSoko3b], ['soko3-1', 'soko3-2']);
registerSpecialLevel(SOKOBAN, 4, [generateSoko4a, generateSoko4b], ['soko4-1', 'soko4-2']);

// Register special levels in main dungeon
// In Dungeons of Doom, at depths that vary by dungeon generation
// Using specific depths for testing (actual depths determined at runtime)
registerSpecialLevel(DUNGEONS_OF_DOOM, 4, generateWater, 'water');
registerSpecialLevel(DUNGEONS_OF_DOOM, 5, generateLava, 'lava');
registerSpecialLevel(DUNGEONS_OF_DOOM, 6, generateGraveyard, 'graveyard');
registerSpecialLevel(DUNGEONS_OF_DOOM, 7, generateVault, 'vault');
registerSpecialLevel(DUNGEONS_OF_DOOM, 8, generateBigroom9, 'bigroom-9');
registerSpecialLevel(DUNGEONS_OF_DOOM, 9, generateBigroom5, 'bigroom-5');
registerSpecialLevel(DUNGEONS_OF_DOOM, 10, generateBigroom6, 'bigroom-6');
registerSpecialLevel(DUNGEONS_OF_DOOM, 11, generateBigroom7, 'bigroom-7');
registerSpecialLevel(DUNGEONS_OF_DOOM, 12, generateBigroom8, 'bigroom-8');
registerSpecialLevel(DUNGEONS_OF_DOOM, 13, generateBigroom3, 'bigroom-3');
registerSpecialLevel(DUNGEONS_OF_DOOM, 14, generateBigroom4, 'bigroom-4');
registerSpecialLevel(DUNGEONS_OF_DOOM, 15, generateBigroom, 'bigroom');
registerSpecialLevel(DUNGEONS_OF_DOOM, 16, generateBigroom2, 'bigroom-2');
registerSpecialLevel(DUNGEONS_OF_DOOM, 17, generateCastle, 'castle');
registerSpecialLevel(DUNGEONS_OF_DOOM, 18, generateBigroom10, 'bigroom-10');
registerSpecialLevel(DUNGEONS_OF_DOOM, 19, generateBigroom12, 'bigroom-12');
// Note: bigroom-11 not yet implemented (requires selection.match with patterns, iterate())
registerSpecialLevel(DUNGEONS_OF_DOOM, 20, generateBigroom13, 'bigroom-13');
registerSpecialLevel(DUNGEONS_OF_DOOM, 21, generateMedusa, 'medusa');
registerSpecialLevel(DUNGEONS_OF_DOOM, 22, generateMedusa2, 'medusa-2');
registerSpecialLevel(DUNGEONS_OF_DOOM, 23, generateMedusa3, 'medusa-3');
registerSpecialLevel(DUNGEONS_OF_DOOM, 24, generateIce, 'ice');
registerSpecialLevel(DUNGEONS_OF_DOOM, 25, generateForest, 'forest');
registerSpecialLevel(DUNGEONS_OF_DOOM, 26, generateClouds, 'clouds');
registerSpecialLevel(DUNGEONS_OF_DOOM, 27, generateGarden, 'garden');
registerSpecialLevel(DUNGEONS_OF_DOOM, 27, generateTemple, 'temple');
registerSpecialLevel(DUNGEONS_OF_DOOM, 28, generatePrison, 'prison');
registerSpecialLevel(DUNGEONS_OF_DOOM, 29, generateLibrary, 'library');
registerSpecialLevel(DUNGEONS_OF_DOOM, 30, generateCavern, 'cavern');
registerSpecialLevel(DUNGEONS_OF_DOOM, 31, generateArena, 'arena');
registerSpecialLevel(DUNGEONS_OF_DOOM, 32, generateThrone, 'throne');
registerSpecialLevel(DUNGEONS_OF_DOOM, 33, generateDesert, 'desert');
registerSpecialLevel(DUNGEONS_OF_DOOM, 34, generateSwamp, 'swamp');
registerSpecialLevel(DUNGEONS_OF_DOOM, 35, generateCrystal, 'crystal');
registerSpecialLevel(DUNGEONS_OF_DOOM, 36, generateRuins, 'ruins');
registerSpecialLevel(DUNGEONS_OF_DOOM, 37, generateLaboratory, 'laboratory');
registerSpecialLevel(DUNGEONS_OF_DOOM, 38, generateHedgemaze, 'hedgemaze');
registerSpecialLevel(DUNGEONS_OF_DOOM, 39, generateVolcano, 'volcano');
registerSpecialLevel(DUNGEONS_OF_DOOM, 40, generateCavern2, 'cavern2');
registerSpecialLevel(DUNGEONS_OF_DOOM, 41, generateNecropolis, 'necropolis');
registerSpecialLevel(DUNGEONS_OF_DOOM, 42, generateBarracks, 'barracks');
registerSpecialLevel(DUNGEONS_OF_DOOM, 43, generateFungus, 'fungus');
registerSpecialLevel(DUNGEONS_OF_DOOM, 44, generateDragonLair, 'dragon_lair');
registerSpecialLevel(DUNGEONS_OF_DOOM, 45, generateCathedral, 'cathedral');
registerSpecialLevel(DUNGEONS_OF_DOOM, 46, generateMines, 'mines');
registerSpecialLevel(DUNGEONS_OF_DOOM, 47, generateWorkshop, 'workshop');
registerSpecialLevel(DUNGEONS_OF_DOOM, 48, generateChasm, 'chasm');
registerSpecialLevel(DUNGEONS_OF_DOOM, 49, generatePillars, 'pillars');
registerSpecialLevel(DUNGEONS_OF_DOOM, 50, generateMenagerie, 'menagerie');
registerSpecialLevel(DUNGEONS_OF_DOOM, 51, generateMaze2, 'maze2');
registerSpecialLevel(DUNGEONS_OF_DOOM, 52, generateOasis, 'oasis');
registerSpecialLevel(DUNGEONS_OF_DOOM, 53, generateGlacier, 'glacier');
registerSpecialLevel(DUNGEONS_OF_DOOM, 54, generateStronghold, 'stronghold');
registerSpecialLevel(DUNGEONS_OF_DOOM, 55, generateCrypt, 'crypt');
registerSpecialLevel(DUNGEONS_OF_DOOM, 56, generateAnthill, 'anthill');
registerSpecialLevel(DUNGEONS_OF_DOOM, 57, generateAbyss, 'abyss');
registerSpecialLevel(DUNGEONS_OF_DOOM, 58, generateCoral, 'coral');
registerSpecialLevel(DUNGEONS_OF_DOOM, 59, generateQuarry, 'quarry');
registerSpecialLevel(DUNGEONS_OF_DOOM, 60, generateSpiderNest, 'spider_nest');
registerSpecialLevel(DUNGEONS_OF_DOOM, 61, generateBazaar, 'bazaar');
registerSpecialLevel(DUNGEONS_OF_DOOM, 62, generateArmory, 'armory');
registerSpecialLevel(DUNGEONS_OF_DOOM, 63, generateColosseum, 'colosseum');
registerSpecialLevel(DUNGEONS_OF_DOOM, 64, generateObservatory, 'observatory');
registerSpecialLevel(DUNGEONS_OF_DOOM, 65, generateSewers, 'sewers');
registerSpecialLevel(DUNGEONS_OF_DOOM, 66, generateBeehive, 'beehive');
registerSpecialLevel(DUNGEONS_OF_DOOM, 67, generateFoundry, 'foundry');
registerSpecialLevel(DUNGEONS_OF_DOOM, 68, generateSanctum2, 'sanctum2');

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
