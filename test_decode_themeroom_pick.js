// test_decode_themeroom_pick.js - Decode theme room pick from RNG trace

import { initRng, enableRngLog, getRngLog, rn2 } from './js/rng.js';
import { initLevelGeneration, makelevel, wallification, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { simulatePostLevelInit } from './js/u_init.js';
import { Player } from './js/player.js';

// THEMEROOM_ARGS from themerms.js (cumulative frequencies)
const THEMEROOM_ARGS = [
    1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007,
    1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015,
    1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023,
    1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031,
    1032, 1033, 1034, 1035, 1036
];

function decodeThemeRoomPick(rngCalls) {
    // Reservoir sampling: pick = 0, then for each i, if rn2(cumFreq[i]) < thisFreq, pick = i
    let pick = 0;
    let prevFreq = 0;

    for (let i = 0; i < THEMEROOM_ARGS.length && i < rngCalls.length; i++) {
        const cumFreq = THEMEROOM_ARGS[i];
        const thisFreq = cumFreq - prevFreq;
        const val = rngCalls[i]; // The value returned by rn2(cumFreq)

        if (thisFreq > 0 && val < thisFreq) {
            pick = i;
        }
        prevFreq = cumFreq;
    }

    return pick;
}

function extractRn2Value(entry) {
    const match = entry.match(/rn2\((\d+)\)=(\d+)/);
    return match ? parseInt(match[2]) : null;
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

// Find reservoir sampling sequences
// Pattern: consecutive rn2() calls with increasing arguments (1000, 1001, 1002, ...)
console.log('Searching for reservoir sampling sequences...\n');

let sequenceStart = -1;
for (let i = 0; i < depth2Log.length - 5; i++) {
    const entry = depth2Log[i];
    const match = entry.match(/rn2\((\d+)\)=(\d+)/);

    if (match && parseInt(match[1]) === 1000) {
        // Found potential start of reservoir sampling
        sequenceStart = i;
        console.log(`Found potential reservoir sampling at index ${i}:`);

        // Extract the next 30 calls (should be rn2(1000), rn2(1001), ..., rn2(1029), etc.)
        const rngValues = [];
        let j = i;
        let expectedArg = 1000;

        while (j < depth2Log.length && j < i + 40) {
            const e = depth2Log[j];
            const m = e.match(/rn2\((\d+)\)=(\d+)/);

            if (m && parseInt(m[1]) === expectedArg) {
                rngValues.push(parseInt(m[2]));
                console.log(`  [${j}] ${e}`);
                expectedArg++;
                j++;
            } else {
                break;
            }
        }

        if (rngValues.length >= 30) {
            const pick = decodeThemeRoomPick(rngValues);
            console.log(`\n  Decoded pick: ${pick}`);

            const pickNames = [
                '0: themeroom_default',
                '1: fakeDelphi',
                '2: roomInRoom',
                '3: hugeRoom',
                '4: nestingRooms',
                '5-7: desroom_fill',
                '8: pillars',
                '9: mausoleum',
                '10: randomFeature',
                '11-29: des.map() themerooms'
            ];

            let pickName = pickNames[pick];
            if (pick >= 11 && pick <= 29) {
                pickName = `${pick}: des.map() themeroom`;
            } else if (pick >= 5 && pick <= 7) {
                pickName = `${pick}: desroom_fill`;
            }

            console.log(`  Theme room: ${pickName}\n`);

            i = j; // Skip past this sequence
        }
    }
}

if (sequenceStart < 0) {
    console.log('❌ No reservoir sampling sequences found!\n');
}

console.log(`\nFinal: ${map2.nroom} rooms, ${map2.nsubroom || 0} subrooms`);
