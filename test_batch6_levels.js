/**
 * Test sixth batch of newly created levels
 */

import { resetLevelState } from './js/sp_lev.js';
import { generate as generateColosseum } from './js/levels/colosseum.js';
import { generate as generateObservatory } from './js/levels/observatory.js';
import { generate as generateSewers } from './js/levels/sewers.js';
import { generate as generateBeehive } from './js/levels/beehive.js';
import { generate as generateFoundry } from './js/levels/foundry.js';
import { generate as generateSanctum2 } from './js/levels/sanctum2.js';

const levels = [
    { name: 'colosseum', generator: generateColosseum },
    { name: 'observatory', generator: generateObservatory },
    { name: 'sewers', generator: generateSewers },
    { name: 'beehive', generator: generateBeehive },
    { name: 'foundry', generator: generateFoundry },
    { name: 'sanctum2', generator: generateSanctum2 }
];

console.log('Testing 6 new levels...\n');

for (const { name, generator } of levels) {
    resetLevelState();
    const level = generator();
    console.log(`✓ ${name}: ${level.monsters.length} monsters, ${level.objects.length} objects, ${level.traps.length} traps`);
}

console.log('\n✓ All 6 levels generated successfully!');
