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
import { generate as generateMedusa1 } from './levels/medusa-1.js';
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
import { generate as generateOracle } from './levels/oracle.js';
import { generate as generateRogue } from './levels/rogue.js';

// Medusa levels (4 variants) - medusa1-3 imported above
import { generate as generateMedusa4 } from './levels/medusa-4.js';

// Mine levels
import { generate as generateMinefill } from './levels/minefill.js';
import { generate as generateMinend1 } from './levels/minend-1.js';
import { generate as generateMinend2 } from './levels/minend-2.js';
import { generate as generateMinend3 } from './levels/minend-3.js';
import { generate as generateMinetn1 } from './levels/minetn-1.js';
import { generate as generateMinetn2 } from './levels/minetn-2.js';
import { generate as generateMinetn3 } from './levels/minetn-3.js';
import { generate as generateMinetn4 } from './levels/minetn-4.js';
import { generate as generateMinetn5 } from './levels/minetn-5.js';
import { generate as generateMinetn6 } from './levels/minetn-6.js';
import { generate as generateMinetn7 } from './levels/minetn-7.js';

// Elemental planes
import { generate as generateAir } from './levels/air.js';
import { generate as generateEarth } from './levels/earth.js';
import { generate as generateFire } from './levels/fire.js';
import { generate as generateWater } from './levels/water.js';
import { generate as generateAstral } from './levels/astral.js';

// Special room variants (all 13 bigrooms)
import { generate as generateBigroom1 } from './levels/bigrm-1.js';
import { generate as generateBigroom2 } from './levels/bigrm-2.js';
import { generate as generateBigroom3 } from './levels/bigrm-3.js';
import { generate as generateBigroom4 } from './levels/bigrm-4.js';
import { generate as generateBigroom5 } from './levels/bigrm-5.js';
import { generate as generateBigroom6 } from './levels/bigrm-6.js';
import { generate as generateBigroom7 } from './levels/bigrm-7.js';
import { generate as generateBigroom8 } from './levels/bigrm-8.js';
import { generate as generateBigroom9 } from './levels/bigrm-9.js';
import { generate as generateBigroom10 } from './levels/bigrm-10.js';
import { generate as generateBigroom11 } from './levels/bigrm-11.js';
import { generate as generateBigroom12 } from './levels/bigrm-12.js';
import { generate as generateBigroom13 } from './levels/bigrm-13.js';

// Sokoban levels
import { generate as generateSoko1a } from './levels/soko1-1.js';
import { generate as generateSoko1b } from './levels/soko1-2.js';
import { generate as generateSoko2a } from './levels/soko2-1.js';
import { generate as generateSoko2b } from './levels/soko2-2.js';
import { generate as generateSoko3a } from './levels/soko3-1.js';
import { generate as generateSoko3b } from './levels/soko3-2.js';
import { generate as generateSoko4a } from './levels/soko4-1.js';
import { generate as generateSoko4b } from './levels/soko4-2.js';

// Quest levels - Archeologist
import { generate as generateArcStrt } from './levels/Arc-strt.js';
import { generate as generateArcLoca } from './levels/Arc-loca.js';
import { generate as generateArcFila } from './levels/Arc-fila.js';
import { generate as generateArcFilb } from './levels/Arc-filb.js';
import { generate as generateArcGoal } from './levels/Arc-goal.js';

// Quest levels - Barbarian
import { generate as generateBarStrt } from './levels/Bar-strt.js';
import { generate as generateBarLoca } from './levels/Bar-loca.js';
import { generate as generateBarFila } from './levels/Bar-fila.js';
import { generate as generateBarFilb } from './levels/Bar-filb.js';
import { generate as generateBarGoal } from './levels/Bar-goal.js';

// Quest levels - Caveman
import { generate as generateCavStrt } from './levels/Cav-strt.js';
import { generate as generateCavLoca } from './levels/Cav-loca.js';
import { generate as generateCavFila } from './levels/Cav-fila.js';
import { generate as generateCavFilb } from './levels/Cav-filb.js';
import { generate as generateCavGoal } from './levels/Cav-goal.js';

// Quest levels - Healer
import { generate as generateHeaStrt } from './levels/Hea-strt.js';
import { generate as generateHeaLoca } from './levels/Hea-loca.js';
import { generate as generateHeaFila } from './levels/Hea-fila.js';
import { generate as generateHeaFilb } from './levels/Hea-filb.js';
import { generate as generateHeaGoal } from './levels/Hea-goal.js';

// Quest levels - Knight
import { generate as generateKniStrt } from './levels/Kni-strt.js';
import { generate as generateKniLoca } from './levels/Kni-loca.js';
import { generate as generateKniFila } from './levels/Kni-fila.js';
import { generate as generateKniFilb } from './levels/Kni-filb.js';
import { generate as generateKniGoal } from './levels/Kni-goal.js';

// Quest levels - Monk
import { generate as generateMonStrt } from './levels/Mon-strt.js';
import { generate as generateMonLoca } from './levels/Mon-loca.js';
import { generate as generateMonFila } from './levels/Mon-fila.js';
import { generate as generateMonFilb } from './levels/Mon-filb.js';
import { generate as generateMonGoal } from './levels/Mon-goal.js';

// Quest levels - Priest
import { generate as generatePriStrt } from './levels/Pri-strt.js';
import { generate as generatePriLoca } from './levels/Pri-loca.js';
import { generate as generatePriFila } from './levels/Pri-fila.js';
import { generate as generatePriFilb } from './levels/Pri-filb.js';
import { generate as generatePriGoal } from './levels/Pri-goal.js';

// Quest levels - Ranger
import { generate as generateRanStrt } from './levels/Ran-strt.js';
import { generate as generateRanLoca } from './levels/Ran-loca.js';
import { generate as generateRanFila } from './levels/Ran-fila.js';
import { generate as generateRanFilb } from './levels/Ran-filb.js';
import { generate as generateRanGoal } from './levels/Ran-goal.js';

// Quest levels - Rogue
import { generate as generateRogStrt } from './levels/Rog-strt.js';
import { generate as generateRogLoca } from './levels/Rog-loca.js';
import { generate as generateRogFila } from './levels/Rog-fila.js';
import { generate as generateRogFilb } from './levels/Rog-filb.js';
import { generate as generateRogGoal } from './levels/Rog-goal.js';

// Quest levels - Samurai
import { generate as generateSamStrt } from './levels/Sam-strt.js';
import { generate as generateSamLoca } from './levels/Sam-loca.js';
import { generate as generateSamFila } from './levels/Sam-fila.js';
import { generate as generateSamFilb } from './levels/Sam-filb.js';
import { generate as generateSamGoal } from './levels/Sam-goal.js';

// Quest levels - Tourist
import { generate as generateTouStrt } from './levels/Tou-strt.js';
import { generate as generateTouLoca } from './levels/Tou-loca.js';
import { generate as generateTouFila } from './levels/Tou-fila.js';
import { generate as generateTouFilb } from './levels/Tou-filb.js';
import { generate as generateTouGoal } from './levels/Tou-goal.js';

// Quest levels - Valkyrie
import { generate as generateValStrt } from './levels/Val-strt.js';
import { generate as generateValLoca } from './levels/Val-loca.js';
import { generate as generateValFila } from './levels/Val-fila.js';
import { generate as generateValFilb } from './levels/Val-filb.js';
import { generate as generateValGoal } from './levels/Val-goal.js';

// Quest levels - Wizard
import { generate as generateWizStrt } from './levels/Wiz-strt.js';
import { generate as generateWizLoca } from './levels/Wiz-loca.js';
import { generate as generateWizFila } from './levels/Wiz-fila.js';
import { generate as generateWizFilb } from './levels/Wiz-filb.js';
import { generate as generateWizGoal } from './levels/Wiz-goal.js';

// Additional special levels
import { generate as generateDungeon } from './levels/dungeon.js';
import { generate as generateHellfill } from './levels/hellfill.js';
import { generate as generateFakewiz1 } from './levels/fakewiz1.js';
import { generate as generateFakewiz2 } from './levels/fakewiz2.js';
// TEMP: Commented out due to Lua syntax error at line 119
// import { generate as generateThemerms } from './levels/themerms.js';
import { generate as generateTut1 } from './levels/tut-1.js';
import { generate as generateTut2 } from './levels/tut-2.js';

// Library files (nhcore, nhlib, quest, bigroom are support files, not level generators)

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
export const TUTORIAL = 8;

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
    if (Array.isArray(generator)) {
        const wrappedGenerators = generator.map((gen) => () => gen());
        specialLevels.set(key, { generator: wrappedGenerators, name, dnum, dlevel });
    } else {
        const wrapped = () => generator();
        specialLevels.set(key, { generator: wrapped, name, dnum, dlevel });
    }
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
// registerSpecialLevel(KNOX, 1, generateKnox, 'knox');

// Register Vlad's Tower (3 levels)
// Tower is in its own branch, levels 1-3
// registerSpecialLevel(VLADS_TOWER, 1, generateTower1, 'tower1');
// registerSpecialLevel(VLADS_TOWER, 2, generateTower2, 'tower2');
// registerSpecialLevel(VLADS_TOWER, 3, generateTower3, 'tower3');

// Register Gehennom levels
// Valley is the entrance to Gehennom (level 1)
// Demon lairs are scattered throughout Gehennom (levels 3-6)
// Sanctum is the final level (level 10 in a typical game)
// Wizard's Tower appears after getting the Amulet (levels 11-13)
// registerSpecialLevel(GEHENNOM, 1, generateValley, 'valley');
// registerSpecialLevel(GEHENNOM, 3, generateAsmodeus, 'asmodeus');
// registerSpecialLevel(GEHENNOM, 4, generateBaalz, 'baalz');
// registerSpecialLevel(GEHENNOM, 5, generateJuiblex, 'juiblex');
// registerSpecialLevel(GEHENNOM, 6, generateOrcus, 'orcus');
// registerSpecialLevel(GEHENNOM, 10, generateSanctum, 'sanctum');
// registerSpecialLevel(GEHENNOM, 11, generateWizard1, 'wizard1');
// registerSpecialLevel(GEHENNOM, 12, generateWizard2, 'wizard2');
// registerSpecialLevel(GEHENNOM, 13, generateWizard3, 'wizard3');

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

// Tutorial levels (optional early game levels)
registerSpecialLevel(TUTORIAL, 1, generateTut1, 'tut-1');
registerSpecialLevel(TUTORIAL, 2, generateTut2, 'tut-2');

// Oracle level (typically depth 5-7 in Dungeons of Doom)
registerSpecialLevel(DUNGEONS_OF_DOOM, 5, generateOracle, 'oracle');

// Castle (Stronghold) level (typically depth 17 in Dungeons of Doom)
registerSpecialLevel(DUNGEONS_OF_DOOM, 17, generateCastle, 'castle');

// Rogue branch placeholder level (Dungeons of Doom depth 15 in harness parity checks)
registerSpecialLevel(DUNGEONS_OF_DOOM, 15, generateRogue, 'rogue');

// Medusa level (4 variants, typically depth 20 in Dungeons of Doom)
registerSpecialLevel(DUNGEONS_OF_DOOM, 20, [
    generateMedusa1,
    generateMedusa2,
    generateMedusa3,
    generateMedusa4
], ['medusa-1', 'medusa-2', 'medusa-3', 'medusa-4']);

// Fort Ludios (Knox's Fort) - bonus level accessed via magic portal
registerSpecialLevel(KNOX, 1, generateKnox, 'knox');

// Register Gehennom levels
// Valley of the Dead (first level of Gehennom)
registerSpecialLevel(GEHENNOM, 1, generateValley, 'valley');

// Demon lairs in Gehennom
registerSpecialLevel(GEHENNOM, 3, generateAsmodeus, 'asmodeus');
registerSpecialLevel(GEHENNOM, 4, generateBaalz, 'baalz');
registerSpecialLevel(GEHENNOM, 5, generateJuiblex, 'juiblex');
registerSpecialLevel(GEHENNOM, 6, generateOrcus, 'orcus');

// Moloch's Sanctum (final level of Gehennom)
registerSpecialLevel(GEHENNOM, 10, generateSanctum, 'sanctum');

// Wizard's Tower levels (in Gehennom, typically depths 11-13)
registerSpecialLevel(GEHENNOM, 11, generateWizard1, 'wizard1');
registerSpecialLevel(GEHENNOM, 12, generateWizard2, 'wizard2');
registerSpecialLevel(GEHENNOM, 13, generateWizard3, 'wizard3');

// Vlad's Tower (vampire tower in Gehennom)
registerSpecialLevel(VLADS_TOWER, 1, generateTower1, 'tower1');
registerSpecialLevel(VLADS_TOWER, 2, generateTower2, 'tower2');
registerSpecialLevel(VLADS_TOWER, 3, generateTower3, 'tower3');

// Register Gnomish Mines levels
// Mines Town can have multiple variants (7 variants)
// Mine End has 3 variants
// Minefill is a generic procedural mines level
// Note: Actual level placement is determined at runtime by dungeon generation
registerSpecialLevel(GNOMISH_MINES, 3, generateMinefill, 'minefill');

registerSpecialLevel(GNOMISH_MINES, 5, [
    generateMinetn1,
    generateMinetn2,
    generateMinetn3,
    generateMinetn4,
    generateMinetn5,
    generateMinetn6,
    generateMinetn7
], ['minetn-1', 'minetn-2', 'minetn-3', 'minetn-4', 'minetn-5', 'minetn-6', 'minetn-7']);

registerSpecialLevel(GNOMISH_MINES, 8, [
    generateMinend1,
    generateMinend2,
    generateMinend3
], ['minend-1', 'minend-2', 'minend-3']);

// Register Elemental Planes (accessed at end game via negative depths)
// These are the final 5 levels before ascending
registerSpecialLevel(DUNGEONS_OF_DOOM, -1, generateAir, 'air');
registerSpecialLevel(DUNGEONS_OF_DOOM, -2, generateEarth, 'earth');
registerSpecialLevel(DUNGEONS_OF_DOOM, -3, generateFire, 'fire');
registerSpecialLevel(DUNGEONS_OF_DOOM, -4, generateWater, 'water');
registerSpecialLevel(DUNGEONS_OF_DOOM, -5, generateAstral, 'astral');

// Register Quest levels
// Each role has 5 quest levels: start, locate, fill-a, fill-b, goal
// Actual quest assignment depends on player role
// These are registered at fixed positions in the QUEST branch

// Archeologist quest
registerSpecialLevel(QUEST, 1, generateArcStrt, 'Arc-strt');
registerSpecialLevel(QUEST, 2, generateArcLoca, 'Arc-loca');
registerSpecialLevel(QUEST, 3, [generateArcFila, generateArcFilb], ['Arc-fila', 'Arc-filb']);
registerSpecialLevel(QUEST, 5, generateArcGoal, 'Arc-goal');

// Note: In the actual game, only ONE role's quest levels are used per game.
// The following registrations are examples. A full implementation would
// dynamically select quest levels based on the player's role.
// For now, these are registered but won't be used unless explicitly called.

// Additional quest levels are loaded but not registered to specific coordinates
// since only one role's quest is active per game:
// - Barbarian: Bar-strt, Bar-loca, Bar-fila/filb, Bar-goal
// - Caveman: Cav-strt, Cav-loca, Cav-fila/filb, Cav-goal
// - Healer: Hea-strt, Hea-loca, Hea-fila/filb, Hea-goal
// - Knight: Kni-strt, Kni-loca, Kni-fila/filb, Kni-goal
// - Monk: Mon-strt, Mon-loca, Mon-fila/filb, Mon-goal
// - Priest: Pri-strt, Pri-loca, Pri-fila/filb, Pri-goal
// - Ranger: Ran-strt, Ran-loca, Ran-fila/filb, Ran-goal
// - Rogue: Rog-strt, Rog-loca, Rog-fila/filb, Rog-goal
// - Samurai: Sam-strt, Sam-loca, Sam-fila/filb, Sam-goal
// - Tourist: Tou-strt, Tou-loca, Tou-fila/filb, Tou-goal
// - Valkyrie: Val-strt, Val-loca, Val-fila/filb, Val-goal
// - Wizard: Wiz-strt, Wiz-loca, Wiz-fila/filb, Wiz-goal

// Export quest level generators for dynamic selection based on player role
export const questLevels = {
    Arc: {
        strt: generateArcStrt,
        loca: generateArcLoca,
        fila: [generateArcFila, generateArcFilb],
        goal: generateArcGoal
    },
    Bar: {
        strt: generateBarStrt,
        loca: generateBarLoca,
        fila: [generateBarFila, generateBarFilb],
        goal: generateBarGoal
    },
    Cav: {
        strt: generateCavStrt,
        loca: generateCavLoca,
        fila: [generateCavFila, generateCavFilb],
        goal: generateCavGoal
    },
    Hea: {
        strt: generateHeaStrt,
        loca: generateHeaLoca,
        fila: [generateHeaFila, generateHeaFilb],
        goal: generateHeaGoal
    },
    Kni: {
        strt: generateKniStrt,
        loca: generateKniLoca,
        fila: [generateKniFila, generateKniFilb],
        goal: generateKniGoal
    },
    Mon: {
        strt: generateMonStrt,
        loca: generateMonLoca,
        fila: [generateMonFila, generateMonFilb],
        goal: generateMonGoal
    },
    Pri: {
        strt: generatePriStrt,
        loca: generatePriLoca,
        fila: [generatePriFila, generatePriFilb],
        goal: generatePriGoal
    },
    Ran: {
        strt: generateRanStrt,
        loca: generateRanLoca,
        fila: [generateRanFila, generateRanFilb],
        goal: generateRanGoal
    },
    Rog: {
        strt: generateRogStrt,
        loca: generateRogLoca,
        fila: [generateRogFila, generateRogFilb],
        goal: generateRogGoal
    },
    Sam: {
        strt: generateSamStrt,
        loca: generateSamLoca,
        fila: [generateSamFila, generateSamFilb],
        goal: generateSamGoal
    },
    Tou: {
        strt: generateTouStrt,
        loca: generateTouLoca,
        fila: [generateTouFila, generateTouFilb],
        goal: generateTouGoal
    },
    Val: {
        strt: generateValStrt,
        loca: generateValLoca,
        fila: [generateValFila, generateValFilb],
        goal: generateValGoal
    },
    Wiz: {
        strt: generateWizStrt,
        loca: generateWizLoca,
        fila: [generateWizFila, generateWizFilb],
        goal: generateWizGoal
    }
};

// Export bigroom variants for random selection
export const bigroomVariants = [
    generateBigroom1,
    generateBigroom2,
    generateBigroom3,
    generateBigroom4,
    generateBigroom5,
    generateBigroom6,
    generateBigroom7,
    generateBigroom8,
    generateBigroom9,
    generateBigroom10,
    generateBigroom11,
    generateBigroom12,
    generateBigroom13
];

// Export medusa variants for random selection
export const medusaVariants = [
    generateMedusa1,
    generateMedusa2,
    generateMedusa3,
    generateMedusa4
];

// Export elemental plane generators
export const elementalPlanes = {
    air: generateAir,
    earth: generateEarth,
    fire: generateFire,
    water: generateWater,
    astral: generateAstral
};

// Export other special level generators
export const otherSpecialLevels = {
    oracle: generateOracle,
    rogue: generateRogue,
    castle: generateCastle,
    dungeon: generateDungeon,
    hellfill: generateHellfill,
    minefill: generateMinefill,
    fakewiz1: generateFakewiz1,
    fakewiz2: generateFakewiz2,
    // themerms: generateThemerms,  // Commented out due to Lua syntax error
    tut1: generateTut1,
    tut2: generateTut2
};

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

/**
 * Resolve a special level by its textual name used in des.levregion portal specs.
 * Returns { dnum, dlevel } or null when unknown.
 */
export function findSpecialLevelByName(levelName) {
    if (typeof levelName !== 'string' || !levelName.length) return null;
    const target = levelName.toLowerCase();

    for (const entry of specialLevels.values()) {
        const names = Array.isArray(entry.name) ? entry.name : [entry.name];
        if (names.some(n => typeof n === 'string' && n.toLowerCase() === target)) {
            return { dnum: entry.dnum, dlevel: entry.dlevel };
        }
    }
    return null;
}
