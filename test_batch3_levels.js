/**
 * Test third batch of newly created levels
 */

import { resetLevelState } from './js/sp_lev.js';
import { generate as generateCathedral } from './js/levels/cathedral.js';
import { generate as generateMines } from './js/levels/mines.js';
import { generate as generateWorkshop } from './js/levels/workshop.js';
import { generate as generateChasm } from './js/levels/chasm.js';
import { generate as generatePillars } from './js/levels/pillars.js';
import { generate as generateMenagerie } from './js/levels/menagerie.js';

const levels = [
    { name: 'cathedral', generator: generateCathedral },
    { name: 'mines', generator: generateMines },
    { name: 'workshop', generator: generateWorkshop },
    { name: 'chasm', generator: generateChasm },
    { name: 'pillars', generator: generatePillars },
    { name: 'menagerie', generator: generateMenagerie }
];

console.log('Testing 6 new levels...\n');

for (const { name, generator } of levels) {
    resetLevelState();
    const level = generator();
    console.log(`✓ ${name}: ${level.monsters.length} monsters, ${level.objects.length} objects, ${level.traps.length} traps`);
}

console.log('\n✓ All 6 levels generated successfully!');
