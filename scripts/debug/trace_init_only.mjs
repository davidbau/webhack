#!/usr/bin/env node
// See how many RNG calls initialization makes

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration} from './js/dungeon.js';

initRng(3);
enableRngLog(false);

const before = getRngLog().length;
rn2(1); // chargen
console.log(`After chargen: ${getRngLog().length - before} calls`);

const beforeInit = getRngLog().length;
initLevelGeneration(11);
console.log(`After initLevelGeneration(11): ${getRngLog().length - beforeInit} calls`);

console.log(`\nTotal: ${getRngLog().length} calls`);
