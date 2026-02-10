// test_decode_pick_correctly.js - Correctly decode theme room pick

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, wallification, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { simulatePostLevelInit } from './js/u_init.js';
import { Player } from './js/player.js';

// THEMEROOM_ARGS from themerms.js
const THEMEROOM_ARGS = [
    1000, 1001, 1002, 1003, 1004, 1010, 1012, 1014,
    1015, 1016, 1017, 1018, 1019, 1020, 1021, 1022,
    1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030,
    1031, 1032, 1033, 1034, 1035, 1036
];

function decodeThemeRoomPick(rngValues) {
    // Reservoir sampling: pick = 0, then for each i, if rn2(cumFreq[i]) < thisFreq, pick = i
    let pick = 0;
    let prevFreq = 0;

    for (let i = 0; i < THEMEROOM_ARGS.length && i < rngValues.length; i++) {
        const cumFreq = THEMEROOM_ARGS[i];
        const thisFreq = cumFreq - prevFreq;
        const val = rngValues[i];

        if (thisFreq > 0 && val < thisFreq) {
            pick = i;
        }
        prevFreq = cumFreq;
    }

    return pick;
}

// Initialize
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();

// Generate depth 1
const map1 = makelevel(1);
wallification(map1);
const player = new Player();
player.initRole(11);
if (map1.upstair) {
    player.x = map1.upstair.x;
    player.y = map1.upstair.y;
}
simulatePostLevelInit(player, map1, 1);

console.log('=== Decoding Theme Room Picks at Depth 2 ===\n');

const beforeDepth2 = getRngLog().length;
const map2 = makelevel(2);

const fullLog = getRngLog();
const depth2Log = fullLog.slice(beforeDepth2);

// Find all reservoir sampling sequences
let attempt = 0;
for (let i = 0; i < depth2Log.length - 30; i++) {
    const entry = depth2Log[i];
    const match = entry.match(/rn2\(1000\)=(\d+)/);

    if (match) {
        attempt++;
        console.log(`\nAttempt ${attempt}: Reservoir sampling at index ${i}`);

        // Extract 30 RNG values matching THEMEROOM_ARGS
        const rngValues = [];
        let j = i;

        for (let k = 0; k < THEMEROOM_ARGS.length; k++) {
            const expectedArg = THEMEROOM_ARGS[k];
            const e = depth2Log[j];
            const m = e && e.match(/rn2\((\d+)\)=(\d+)/);

            if (m && parseInt(m[1]) === expectedArg) {
                rngValues.push(parseInt(m[2]));
                j++;
            } else {
                console.log(`  ⚠️  Expected rn2(${expectedArg}) at index ${j}, got: ${e || 'undefined'}`);
                break;
            }
        }

        if (rngValues.length === THEMEROOM_ARGS.length) {
            const pick = decodeThemeRoomPick(rngValues);

            const pickNames = {
                0: 'themeroom_default',
                1: 'fakeDelphi',
                2: 'roomInRoom',
                3: 'hugeRoom',
                4: 'nestingRooms',
                5: 'desroom_fill (case 5)',
                6: 'desroom_fill (case 6)',
                7: 'desroom_fill (case 7)',
                8: 'pillars',
                9: 'mausoleum',
                10: 'randomFeature'
            };

            let pickName = pickNames[pick];
            if (pick >= 11 && pick <= 29) {
                pickName = `des.map() themeroom (pick ${pick})`;
            }

            console.log(`  ✓ Decoded pick: ${pick} → ${pickName}`);
            console.log(`    First 3 RNG values: [${rngValues.slice(0, 3).join(', ')}]`);

            i = j - 1; // Skip past this sequence
        }
    }
}

console.log(`\n\nFinal: ${map2.nroom} rooms, ${map2.nsubroom || 0} subrooms`);
