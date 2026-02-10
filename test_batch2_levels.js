/**
 * Test second batch of newly created levels
 */

import { resetLevelState } from './js/sp_lev.js';
import { generate as generateVolcano } from './js/levels/volcano.js';
import { generate as generateCavern2 } from './js/levels/cavern2.js';
import { generate as generateNecropolis } from './js/levels/necropolis.js';
import { generate as generateBarracks } from './js/levels/barracks.js';
import { generate as generateFungus } from './js/levels/fungus.js';
import { generate as generateDragonLair } from './js/levels/dragon_lair.js';

const levels = [
    { name: 'volcano', generator: generateVolcano },
    { name: 'cavern2', generator: generateCavern2 },
    { name: 'necropolis', generator: generateNecropolis },
    { name: 'barracks', generator: generateBarracks },
    { name: 'fungus', generator: generateFungus },
    { name: 'dragon_lair', generator: generateDragonLair }
];

console.log('Testing 6 new levels...\n');

for (const { name, generator } of levels) {
    resetLevelState();
    const level = generator();
    console.log(`✓ ${name}: ${level.monsters.length} monsters, ${level.objects.length} objects, ${level.traps.length} traps`);
}

console.log('\n✓ All 6 levels generated successfully!');
