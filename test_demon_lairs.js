/**
 * Test demon lair level generation
 */

import { generate as generateAsmodeus } from './js/levels/asmodeus.js';
import { generate as generateBaalz } from './js/levels/baalz.js';
import { generate as generateJuiblex } from './js/levels/juiblex.js';
import { generate as generateOrcus } from './js/levels/orcus.js';
import { resetLevelState } from './js/sp_lev.js';

const levels = [
    { name: 'Asmodeus', generator: generateAsmodeus },
    { name: 'Baalzebub', generator: generateBaalz },
    { name: 'Juiblex', generator: generateJuiblex },
    { name: 'Orcus', generator: generateOrcus },
];

for (const { name, generator } of levels) {
    console.log(`\n=== Testing ${name} ===`);
    try {
        resetLevelState();
        const map = generator();

        if (!map) {
            console.error(`  ❌ Generator returned null/undefined`);
            continue;
        }

        // Count entities
        const monsterCount = map.monsters?.length || 0;
        const objectCount = map.objects?.length || 0;
        const trapCount = map.traps?.length || 0;

        console.log(`  ✓ Generated successfully`);
        console.log(`    Monsters: ${monsterCount}`);
        console.log(`    Objects: ${objectCount}`);
        console.log(`    Traps: ${trapCount}`);

        // Check for the demon lord
        const bossMonster = map.monsters?.find(m =>
            m.id === name ||
            m.id === 'Asmodeus' ||
            m.id === 'Baalzebub' ||
            m.id === 'Juiblex' ||
            m.id === 'Orcus'
        );
        if (bossMonster) {
            console.log(`    Boss: ${bossMonster.id} at (${bossMonster.x}, ${bossMonster.y})`);
        } else {
            console.warn(`    ⚠ No boss monster found`);
        }
    } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
        console.error(err.stack);
    }
}

console.log('\n=== All tests complete ===\n');
