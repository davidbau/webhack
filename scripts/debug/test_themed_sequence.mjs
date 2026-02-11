#!/usr/bin/env node
import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration, init_rect} from './js/dungeon.js';
import {GameMap} from './js/map.js';
import {setLevelContext, clearLevelContext} from './js/sp_lev.js';
import {themerooms_generate as themermsGenerate} from './js/levels/themerms.js';

initRng(3);
enableRngLog(false);
rn2(1);
initLevelGeneration(11);

const map = new GameMap();
init_rect();

for (let i = 0; i < 10; i++) {
    const before = getRngLog().length;
    try {
        setLevelContext(map, 1);
        const result = themermsGenerate(map, 1);
        clearLevelContext();
        const consumed = getRngLog().length - before;
        console.log(`Room ${i + 1}: ${consumed} RNG calls, total=${getRngLog().length}, nroom=${map.nroom}`);
    } catch (e) {
        console.log(`Room ${i + 1}: ERROR - ${e.message}`);
        clearLevelContext();
        break;
    }
}
