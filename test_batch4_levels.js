/**
 * Test fourth batch of newly created levels
 */

import { resetLevelState } from './js/sp_lev.js';
import { generate as generateMaze2 } from './js/levels/maze2.js';
import { generate as generateOasis } from './js/levels/oasis.js';
import { generate as generateGlacier } from './js/levels/glacier.js';
import { generate as generateStronghold } from './js/levels/stronghold.js';
import { generate as generateCrypt } from './js/levels/crypt.js';
import { generate as generateAnthill } from './js/levels/anthill.js';

const levels = [
    { name: 'maze2', generator: generateMaze2 },
    { name: 'oasis', generator: generateOasis },
    { name: 'glacier', generator: generateGlacier },
    { name: 'stronghold', generator: generateStronghold },
    { name: 'crypt', generator: generateCrypt },
    { name: 'anthill', generator: generateAnthill }
];

console.log('Testing 6 new levels...\n');

for (const { name, generator } of levels) {
    resetLevelState();
    const level = generator();
    console.log(`✓ ${name}: ${level.monsters.length} monsters, ${level.objects.length} objects, ${level.traps.length} traps`);
}

console.log('\n✓ All 6 levels generated successfully!');
