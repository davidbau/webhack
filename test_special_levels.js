/**
 * Test special level registry
 */

import { listSpecialLevels, getSpecialLevel, GEHENNOM } from './js/special_levels.js';

console.log('=== All Registered Special Levels ===\n');

const levels = listSpecialLevels();
console.log(`Total: ${levels.length} levels\n`);

// Group by branch
const byBranch = {};
for (const level of levels) {
    if (!byBranch[level.dnum]) {
        byBranch[level.dnum] = [];
    }
    byBranch[level.dnum].push(level);
}

const branchNames = {
    0: 'Dungeons of Doom',
    1: 'Gnomish Mines',
    2: 'Sokoban',
    3: 'Quest',
    4: 'Fort Ludios',
    5: 'Gehennom',
    6: "Vlad's Tower"
};

for (const [dnum, branchLevels] of Object.entries(byBranch)) {
    console.log(`${branchNames[dnum]} (Branch ${dnum}):`);
    branchLevels.sort((a, b) => a.dlevel - b.dlevel);
    for (const level of branchLevels) {
        console.log(`  Level ${level.dlevel}: ${level.name}`);
    }
    console.log();
}

// Test demon lair lookups
console.log('=== Testing Demon Lair Lookups ===\n');
const demonLairs = [
    { dnum: GEHENNOM, dlevel: 3, expected: 'asmodeus' },
    { dnum: GEHENNOM, dlevel: 4, expected: 'baalz' },
    { dnum: GEHENNOM, dlevel: 5, expected: 'juiblex' },
    { dnum: GEHENNOM, dlevel: 6, expected: 'orcus' },
];

for (const { dnum, dlevel, expected } of demonLairs) {
    const special = getSpecialLevel(dnum, dlevel);
    if (special && special.name === expected) {
        console.log(`✓ Gehennom:${dlevel} = ${special.name}`);
    } else {
        console.error(`✗ Gehennom:${dlevel} expected ${expected}, got ${special?.name || 'null'}`);
    }
}
