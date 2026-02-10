/**
 * Test batch of newly created levels
 */

import { resetLevelState } from './js/sp_lev.js';
import { generate as generateDesert } from './js/levels/desert.js';
import { generate as generateSwamp } from './js/levels/swamp.js';
import { generate as generateCrystal } from './js/levels/crystal.js';
import { generate as generateRuins } from './js/levels/ruins.js';
import { generate as generateLaboratory } from './js/levels/laboratory.js';
import { generate as generateHedgemaze } from './js/levels/hedgemaze.js';

const levels = [
    { name: 'desert', generator: generateDesert },
    { name: 'swamp', generator: generateSwamp },
    { name: 'crystal', generator: generateCrystal },
    { name: 'ruins', generator: generateRuins },
    { name: 'laboratory', generator: generateLaboratory },
    { name: 'hedgemaze', generator: generateHedgemaze }
];

console.log('Testing 6 new levels...\n');

for (const { name, generator } of levels) {
    resetLevelState();
    const level = generator();
    console.log(`✓ ${name}: ${level.monsters.length} monsters, ${level.objects.length} objects, ${level.traps.length} traps`);
}

console.log('\n✓ All 6 levels generated successfully!');
