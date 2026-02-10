/**
 * Quick test for newly created arena and throne levels
 */

import { resetLevelState } from './js/sp_lev.js';
import { generate as generateArena } from './js/levels/arena.js';
import { generate as generateThrone } from './js/levels/throne.js';

console.log('Testing arena.js...');
resetLevelState();
const arena = generateArena();
console.log(`✓ Arena generated: ${arena.monsters.length} monsters, ${arena.objects.length} objects, ${arena.traps.length} traps`);

console.log('\nTesting throne.js...');
resetLevelState();
const throne = generateThrone();
console.log(`✓ Throne generated: ${throne.monsters.length} monsters, ${throne.objects.length} objects, ${throne.traps.length} traps`);

console.log('\n✓ Both levels generated successfully!');
