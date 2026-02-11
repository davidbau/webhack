// Screen comparison test: headless JS rendering vs C NetHack reference screens
// Loads reference data from sessions/seed42.session.json (see docs/SESSION_FORMAT.md)
// Compares map area (rows 1-21) for all game states in the session.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initRng, rn2, rnd, rn1 } from '../../js/rng.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';
import { Player } from '../../js/player.js';
import { simulatePostLevelInit } from '../../js/u_init.js';
import { movemon } from '../../js/monmove.js';
import { FOV } from '../../js/vision.js';
import { dosearch0 } from '../../js/commands.js';
import {
    COLNO, ROWNO, NORMAL_SPEED, A_DEX, A_CON,
    STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL,
    ROOM, CORR, DOOR, STAIRS, SDOOR, SCORR,
    FOUNTAIN, THRONE, SINK, GRAVE, ALTAR,
    POOL, MOAT, WATER, LAVAPOOL, ICE, IRONBARS, TREE,
    D_ISOPEN, D_CLOSED, D_LOCKED,
} from '../../js/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, '../comparison/sessions');

// Load session reference data (skip tests if file doesn't exist)
const sessionPath = join(SESSION_DIR, 'seed42.session.json');
const session = existsSync(sessionPath) ? JSON.parse(readFileSync(sessionPath, 'utf8')) : null;

// ========================================================================
// DEC Graphics -> Unicode mapping (for parsing C reference screens)
// Only applied to map rows (1-21), NOT message/status rows
// ========================================================================
const DEC_TO_UNICODE = {
    'l': '\u250c', // TL corner
    'q': '\u2500', // horizontal wall
    'k': '\u2510', // TR corner
    'x': '\u2502', // vertical wall
    'm': '\u2514', // BL corner
    'j': '\u2518', // BR corner
    'n': '\u253c', // cross wall
    't': '\u251c', // right T (from inside)
    'u': '\u2524', // left T (from inside)
    'v': '\u2534', // bottom T
    'w': '\u252c', // top T
    '~': '\u00b7', // room floor (middle dot)
};

// ========================================================================
// Headless terrain symbol (matches display.js terrainSymbol)
// ========================================================================
function terrainChar(loc) {
    const typ = loc.typ;

    if (typ === DOOR) {
        if (loc.flags & D_ISOPEN) return '\u00b7';
        if (loc.flags & (D_CLOSED | D_LOCKED)) return '+';
        return '\u00b7'; // doorway
    }
    if (typ === STAIRS) {
        return loc.flags === 1 ? '<' : '>';
    }
    if (typ === SDOOR) {
        return loc.horizontal ? '\u2500' : '\u2502';
    }
    if (typ === SCORR) return ' ';

    const CHARS = {
        [STONE]: ' ',
        [VWALL]: '\u2502',
        [HWALL]: '\u2500',
        [TLCORNER]: '\u250c',
        [TRCORNER]: '\u2510',
        [BLCORNER]: '\u2514',
        [BRCORNER]: '\u2518',
        [CROSSWALL]: '\u253c',
        [TUWALL]: '\u2534',
        [TDWALL]: '\u252c',
        [TLWALL]: '\u2524',
        [TRWALL]: '\u251c',
        [ROOM]: '\u00b7',
        [CORR]: '#',
        [FOUNTAIN]: '{',
        [THRONE]: '\\',
        [SINK]: '#',
        [GRAVE]: '\u2020',
        [ALTAR]: '_',
        [POOL]: '\u2248',
        [MOAT]: '\u2248',
        [WATER]: '\u2248',
        [LAVAPOOL]: '\u2248',
        [ICE]: '\u00b7',
        [IRONBARS]: '#',
        [TREE]: '#',
    };
    return CHARS[typ] || '?';
}

// ========================================================================
// Headless screen renderer -- produces 80-char map rows matching display.js
// ========================================================================
function renderMapRow(map, player, fov, y) {
    let row = '';
    for (let x = 0; x < COLNO; x++) {
        if (!fov || !fov.canSee(x, y)) {
            const loc = map.at(x, y);
            if (loc && loc.seenv) {
                const rObjs = map.objectsAt(x, y);
                if (rObjs.length > 0 && loc._lastObjChar) {
                    row += loc._lastObjChar;
                } else {
                    row += terrainChar(loc);
                }
            } else {
                row += ' ';
            }
            continue;
        }

        const loc = map.at(x, y);
        if (!loc) { row += ' '; continue; }

        loc.seenv = 0xFF;

        if (player && x === player.x && y === player.y) {
            row += '@';
            continue;
        }

        const mon = map.monsterAt(x, y);
        if (mon) {
            row += mon.displayChar;
            continue;
        }

        const objs = map.objectsAt(x, y);
        if (objs.length > 0) {
            const topObj = objs[objs.length - 1];
            row += topObj.displayChar;
            loc._lastObjChar = topObj.displayChar;
            continue;
        }

        const trap = map.trapAt(x, y);
        if (trap && trap.tseen) {
            row += '^';
            continue;
        }

        row += terrainChar(loc);
    }
    return row;
}

// ========================================================================
// Parse C reference screen from session data
// ========================================================================
function parseCScreenFromSession(screenLines) {
    // Session screen is 24 lines (rows 0-23)
    // Row 0: message line
    // Rows 1-21: map (y=0..20) — uses DEC graphics
    // Row 22-23: status lines
    //
    // tmux capture is shifted 1 column left (column 0 not captured),
    // so prepend a space to each map row to realign.
    const result = [];
    for (let row = 0; row < 24; row++) {
        let line = (screenLines[row] || '').replace(/\r$/, '');
        if (row >= 1 && row <= 21) {
            line = ' ' + line;
        }
        line = line.padEnd(80);
        if (row >= 1 && row <= 21) {
            let mapped = '';
            for (const ch of line) {
                mapped += DEC_TO_UNICODE[ch] || ch;
            }
            line = mapped;
        }
        result.push(line);
    }
    return result;
}

// ========================================================================
// Game setup and turn simulation
// ========================================================================

function mcalcmove(mon) {
    let mmove = mon.speed;
    const mmoveAdj = mmove % NORMAL_SPEED;
    mmove -= mmoveAdj;
    if (rn2(NORMAL_SPEED) < mmoveAdj) mmove += NORMAL_SPEED;
    return mmove;
}

function exercise(player, attrIndex, inc_or_dec) {
    if (attrIndex === 1 || attrIndex === 5) return;
    if (inc_or_dec) { rn2(19); } else { rn2(2); }
}

function exerper(game) {
    const { player } = game;
    const moves = game.turnCount + 1;
    if (!(moves % 10)) {
        if (player.hunger > 1000) {
            exercise(player, A_DEX, false);
        } else if (player.hunger > 150) {
            exercise(player, A_CON, true);
        }
    }
}

function simulateTurnEnd(game) {
    const { player, map } = game;
    game.turnCount++;
    player.turns = game.turnCount;
    for (const mon of map.monsters) {
        if (mon.dead) continue;
        mon.movement += mcalcmove(mon);
    }
    rn2(70); rn2(400); rn2(20);
    exerper(game);
    const dex = player.attributes ? player.attributes[A_DEX] : 14;
    rn2(40 + dex * 3);
    if (game.turnCount >= game.seerTurn) {
        game.seerTurn = game.turnCount + 15 + rn2(31);
    }
}

function setupGame() {
    if (!session) throw new Error('Session data not loaded');
    initRng(session.seed);
    initLevelGeneration();
    const player = new Player();
    player.initRole(11);
    player.name = session.character.name;
    player.gender = 1;
    const map = makelevel(1);
    wallification(map);
    player.x = map.upstair.x;
    player.y = map.upstair.y;
    player.dungeonLevel = 1;
    simulatePostLevelInit(player, map, 1);
    const fov = new FOV();
    fov.compute(map, player.x, player.y);
    return { player, map, fov, display: { putstr_message: () => {} }, turnCount: 0, seerTurn: 0 };
}

function doTurn(game) {
    movemon(game.map, game.player, game.display, game.fov);
    simulateTurnEnd(game);
    game.fov.compute(game.map, game.player.x, game.player.y);
}

// Direction vectors for movement keys
const KEY_DIRS = {
    'h': [-1, 0], 'l': [1, 0], 'j': [0, 1], 'k': [0, -1],
    'y': [-1, -1], 'u': [1, -1], 'b': [-1, 1], 'n': [1, 1],
};

// Keys that don't consume a game turn
const NON_TURN_KEYS = new Set([':', 'i', '@']);

describe('Screen comparison (seed 42)', () => {
    it('map rendering matches C for all session states', { skip: !session }, () => {
        if (!session) return;  // Skip if reference data not available
        const game = setupGame();
        let totalDiffs = 0;
        let totalDataDiffs = 0;
        let totalFovDiffs = 0;

        // Compare startup screen + all steps
        const allStates = [
            { screen: session.startup.screen, label: 'startup', key: null },
            ...session.steps.map((s, i) => ({ screen: s.screen, label: `step ${i + 1} (${s.key}/${s.action})`, key: s.key, step: s })),
        ];

        for (const state of allStates) {
            // Apply action for non-startup states
            if (state.step) {
                const dir = KEY_DIRS[state.step.key];
                if (dir) {
                    game.player.x += dir[0];
                    game.player.y += dir[1];
                } else if (state.step.key === 's') {
                    dosearch0(game.player, game.map, game.display);
                }

                if (!NON_TURN_KEYS.has(state.step.key)) {
                    doTurn(game);
                    game.fov.compute(game.map, game.player.x, game.player.y);
                }
            }

            // Parse C reference screen from session data
            const cScreen = parseCScreenFromSession(state.screen);

            // Render JS map rows (1-21 = y=0..20)
            const diffs = [];
            for (let mapY = 0; mapY < ROWNO; mapY++) {
                const screenRow = mapY + 1;
                const jsRow = renderMapRow(game.map, game.player, game.fov, mapY);
                const cRow = cScreen[screenRow];

                for (let x = 0; x < COLNO; x++) {
                    const jsChar = jsRow[x] || ' ';
                    const cChar = cRow[x] || ' ';
                    if (jsChar !== cChar) {
                        diffs.push({ y: mapY, x, jsChar, cChar, row: screenRow });
                    }
                }
            }

            // Classify diffs as FOV vs DATA
            const fovDiffs = [];
            const dataDiffs = [];
            for (const d of diffs) {
                const cIsSpace = d.cChar === ' ';
                const jsIsMon = d.jsChar.match(/^[a-zA-Z]$/);
                const cIsTerrain = d.cChar.match(/^[·#<>+\u2500\u2502\u250c\u2510\u2514\u2518\u253c\u2534\u252c\u2524\u251c{%?)(\[=\/"!\/\$\*`_]$/);
                if (cIsSpace || (jsIsMon && cIsTerrain)) {
                    fovDiffs.push(d);
                } else {
                    dataDiffs.push(d);
                }
            }

            if (dataDiffs.length > 0) {
                console.log(`\n${state.label}: ${dataDiffs.length} DATA differences`);
                for (const d of dataDiffs.slice(0, 20)) {
                    const jsHex = d.jsChar.codePointAt(0).toString(16);
                    const cHex = d.cChar.codePointAt(0).toString(16);
                    console.log(`  row=${d.row} x=${d.x}: JS='${d.jsChar}' (U+${jsHex}) C='${d.cChar}' (U+${cHex})`);
                }
            }

            totalDiffs += diffs.length;
            totalDataDiffs += dataDiffs.length;
            totalFovDiffs += fovDiffs.length;
        }

        console.log(`\nTotal: ${totalDiffs} differences (${totalFovDiffs} FOV, ${totalDataDiffs} data)`);
        assert.equal(totalDataDiffs, 0,
            `Expected 0 non-FOV differences, got ${totalDataDiffs} (plus ${totalFovDiffs} FOV diffs)`);
    });
});
