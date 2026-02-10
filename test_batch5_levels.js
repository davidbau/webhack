/**
 * Test fifth batch of newly created levels
 */

import { resetLevelState } from './js/sp_lev.js';
import { generate as generateAbyss } from './js/levels/abyss.js';
import { generate as generateCoral } from './js/levels/coral.js';
import { generate as generateQuarry } from './js/levels/quarry.js';
import { generate as generateSpiderNest } from './js/levels/spider_nest.js';
import { generate as generateBazaar } from './js/levels/bazaar.js';
import { generate as generateArmory } from './js/levels/armory.js';

const levels = [
    { name: 'abyss', generator: generateAbyss },
    { name: 'coral', generator: generateCoral },
    { name: 'quarry', generator: generateQuarry },
    { name: 'spider_nest', generator: generateSpiderNest },
    { name: 'bazaar', generator: generateBazaar },
    { name: 'armory', generator: generateArmory }
];

console.log('Testing 6 new levels...\n');

for (const { name, generator } of levels) {
    resetLevelState();
    const level = generator();
    console.log(`✓ ${name}: ${level.monsters.length} monsters, ${level.objects.length} objects, ${level.traps.length} traps`);
}

console.log('\n✓ All 6 levels generated successfully!');
