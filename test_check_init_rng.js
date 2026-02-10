// test_check_init_rng.js - Check RNG calls during initialization

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';

// Initialize RNG but not level generation yet
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);

const afterRngInit = getRngLog().length;
console.log(`After initRng(163): ${afterRngInit} RNG calls\\n`);

// Now init level generation
initLevelGeneration();

const afterLevelInit = getRngLog().length;
console.log(`After initLevelGeneration(): ${afterLevelInit} RNG calls`);
console.log(`RNG calls during initLevelGeneration: ${afterLevelInit - afterRngInit}\\n`);

if (afterLevelInit > 0) {
    console.log('First 20 RNG calls during initLevelGeneration:');
    const log = getRngLog();
    for (let i = afterRngInit; i < Math.min(afterLevelInit, afterRngInit + 20); i++) {
        console.log(`  [${i}] ${log[i]}`);
    }

    console.log('\\n...\\n');

    console.log('Last 20 RNG calls during initLevelGeneration:');
    for (let i = Math.max(afterRngInit, afterLevelInit - 20); i < afterLevelInit; i++) {
        console.log(`  [${i}] ${log[i]}`);
    }
}
