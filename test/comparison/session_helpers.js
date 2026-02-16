// test/comparison/session_helpers.js -- Shared utilities for session replay tests
//
// Phase 4 refactored: This module now re-exports from comparators.js and
// session_loader.js for backwards compatibility, and contains only the
// essential game generation/replay logic needed for session testing.

import {
    COLNO, ROWNO, TERMINAL_COLS, TERMINAL_ROWS,
    MAP_ROW_START, STATUS_ROW_1, STATUS_ROW_2,
    A_LAWFUL, A_NEUTRAL, A_CHAOTIC,
    NORMAL_SPEED, A_STR, A_DEX, A_CON, A_WIS,
    RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC,
    SHOPBASE, ROOMOFFSET,
} from '../../js/config.js';
import { initRng, enableRngLog, getRngLog, disableRngLog, rn2, rnd, rn1, rnl, rne, rnz, d } from '../../js/rng.js';
import { exercise, exerchk, initExerciseState } from '../../js/attrib_exercise.js';
import { initLevelGeneration, makelevel, setGameSeed } from '../../js/dungeon.js';
import { simulatePostLevelInit, mon_arrive } from '../../js/u_init.js';
import { Player, roles, rankOf } from '../../js/player.js';
import { rhack } from '../../js/commands.js';
import { makemon } from '../../js/makemon.js';
import { movemon, initrack, settrack } from '../../js/monmove.js';
import { FOV } from '../../js/vision.js';
import { getArrivalPosition } from '../../js/level_transition.js';
import { HeadlessDisplay } from '../../js/headless_runtime.js';

// Re-export from comparators.js for backwards compatibility
export {
    TYP_NAMES,
    typName,
    parseTypGrid,
    parseSessionTypGrid,
    compareGrids,
    formatDiffs,
    isMidlogEntry,
    isCompositeEntry,
    stripRngSourceTag,
    toCompactRng,
    rngCallPart,
    compareRng,
    compareRngArrays,
    matchingJsPrefixLength,
    firstComparableEntry,
    compareScreens,
    checkWallCompleteness,
    checkConnectivity,
    checkStairs,
    checkDimensions,
    checkValidTypValues,
} from './comparators.js';

// Re-export from session_loader.js for backwards compatibility
export {
    stripAnsiSequences,
    getSessionScreenLines,
    getSessionStartup,
    getSessionCharacter,
    getSessionGameplaySteps,
    hasStartupBurstInFirstStep,
    getPreStartupRngEntries,
    classifySession,
    createTypedSessionResult,
    loadSessions,
    loadSession,
    normalizeSession,
} from './session_loader.js';

export { HeadlessDisplay };

import {
    toCompactRng,
    rngCallPart,
    isMidlogEntry,
    isCompositeEntry,
} from './comparators.js';
import { getPreStartupRngEntries } from './session_loader.js';

// Grid extraction: 21 rows of 80 integers
export function extractTypGrid(map) {
    const grid = [];
    for (let y = 0; y < ROWNO; y++) {
        const row = [];
        for (let x = 0; x < COLNO; x++) {
            const loc = map.at(x, y);
            row.push(loc ? loc.typ : 0);
        }
        grid.push(row);
    }
    return grid;
}

// RNG consumption for replaying session RNG
function consumeRngEntry(entry) {
    const call = rngCallPart(entry);
    const match = call.match(/^([a-z0-9_]+)\(([^)]*)\)=/i);
    if (!match) return;
    const fn = match[1];
    const args = match[2]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => Number.parseInt(s, 10));

    switch (fn) {
        case 'rn2': if (args.length >= 1) rn2(args[0]); break;
        case 'rnd': if (args.length >= 1) rnd(args[0]); break;
        case 'rn1': if (args.length >= 2) rn1(args[0], args[1]); break;
        case 'rnl': if (args.length >= 1) rnl(args[0]); break;
        case 'rne': if (args.length >= 1) rne(args[0]); break;
        case 'rnz': if (args.length >= 1) rnz(args[0]); break;
        case 'd': if (args.length >= 2) d(args[0], args[1]); break;
    }
}

function consumeRngEntries(entries) {
    for (const entry of entries || []) consumeRngEntry(entry);
}

// Sequential map generation: levels 1→maxDepth on one continuous RNG stream
export function generateMapsSequential(seed, maxDepth) {
    initrack();
    initRng(seed);
    setGameSeed(seed);
    initLevelGeneration(11); // Valkyrie

    const grids = {};
    const maps = {};
    for (let depth = 1; depth <= maxDepth; depth++) {
        const map = makelevel(depth);
        grids[depth] = extractTypGrid(map);
        maps[depth] = map;
    }
    return { grids, maps };
}

// Generate levels 1→maxDepth with RNG trace capture.
export function generateMapsWithRng(seed, maxDepth) {
    initrack();
    initRng(seed);
    setGameSeed(seed);
    enableRngLog();
    initLevelGeneration(11); // Valkyrie

    const grids = {};
    const maps = {};
    const rngLogs = {};
    let harnessPlayer = null;
    let prevCount = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
        const previousMap = depth > 1 ? maps[depth - 1] : null;
        const map = makelevel(depth);

        grids[depth] = extractTypGrid(map);
        maps[depth] = map;

        if (depth === 1) {
            harnessPlayer = new Player();
            harnessPlayer.initRole(11);
            if (map.upstair) {
                harnessPlayer.x = map.upstair.x;
                harnessPlayer.y = map.upstair.y;
            }
            simulatePostLevelInit(harnessPlayer, map, 1);
        } else if (harnessPlayer && previousMap) {
            mon_arrive(previousMap, map, harnessPlayer, {
                heroX: map.upstair.x,
                heroY: map.upstair.y,
            });
        }

        if (harnessPlayer) {
            if (map.upstair) {
                harnessPlayer.x = map.upstair.x;
                harnessPlayer.y = map.upstair.y;
            }
            harnessPlayer.dungeonLevel = depth;
        }

        const fullLog = getRngLog();
        const depthLog = fullLog.slice(prevCount);
        const compactRng = depthLog.map(toCompactRng);
        const filteredRng = compactRng.filter(e => {
            const call = rngCallPart(e);
            return !isCompositeEntry(call) && !isMidlogEntry(e);
        });
        rngLogs[depth] = { rngCalls: filteredRng.length, rng: filteredRng };
        prevCount = fullLog.length;
    }

    disableRngLog();
    return { grids, maps, rngLogs };
}

// Startup generation with RNG
const ROLE_INDEX = {};
for (let i = 0; i < roles.length; i++) ROLE_INDEX[roles[i].name] = i;

export function generateStartupWithRng(seed, session) {
    const opts = session.options || {};
    const roleIndex = typeof opts.role === 'string'
        ? ROLE_INDEX[opts.role] ?? 11
        : (opts.role ?? 11);

    initrack();
    initRng(seed);
    setGameSeed(seed);
    enableRngLog();

    // Consume pre-startup chargen RNG
    const preStartupRng = getPreStartupRngEntries(session);
    consumeRngEntries(preStartupRng);
    const chargenLog = getRngLog().slice();

    initLevelGeneration(roleIndex);
    const map = makelevel(1);

    const player = new Player();
    player.initRole(roleIndex);
    player.name = opts.name || 'Agent';
    player.gender = opts.gender ?? 0;
    if (opts.align !== undefined) player.alignment = opts.align;

    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }

    simulatePostLevelInit(player, map, 1);

    const startupLog = getRngLog().slice(chargenLog.length);
    disableRngLog();

    return {
        grid: extractTypGrid(map),
        map,
        player,
        rngCalls: startupLog.length,
        rng: startupLog.map(toCompactRng),
        chargenRngCalls: chargenLog.length,
        chargenRng: chargenLog.map(toCompactRng),
    };
}

// HeadlessGame for session replay
class HeadlessGame {
    constructor(player, map, opts = {}) {
        this.player = player;
        initExerciseState(this.player);
        this.map = map;
        this.display = new HeadlessDisplay();
        this.fov = new FOV();
        this.levels = { 1: map };
        this.gameOver = false;
        this.turnCount = 0;
        this.wizard = true;
        this.dnum = Number.isInteger(opts.startDnum) ? opts.startDnum : undefined;
        this.dungeonAlignOverride = Number.isInteger(opts.dungeonAlignOverride)
            ? opts.dungeonAlignOverride
            : undefined;
        this.seerTurn = opts.seerTurn || 0;
        this.occupation = null;
        this.flags = { pickup: false, verbose: false, safe_wait: true };
        this.menuRequested = false;
        initrack();
        this.renderCurrentScreen();
    }

    renderCurrentScreen() {
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov);
        this.display.renderStatus(this.player);
    }

    shouldInterruptMulti() {
        const { x, y } = this.player;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const mon = this.map.monsterAt(x + dx, y + dy);
                if (mon && !mon.dead && !mon.tame && !mon.peaceful) {
                    return true;
                }
            }
        }
        return false;
    }

    mcalcmove(mon) {
        let mmove = mon.speed;
        const mmoveAdj = mmove % NORMAL_SPEED;
        mmove -= mmoveAdj;
        if (rn2(NORMAL_SPEED) < mmoveAdj) mmove += NORMAL_SPEED;
        return mmove;
    }

    simulateTurnEnd() {
        settrack(this.player);
        this.turnCount++;
        this.player.turns = this.turnCount;

        if ((this.player.woundedLegsTimeout || 0) > 0) {
            this.player.woundedLegsTimeout--;
            if (this.player.woundedLegsTimeout <= 0 && this.player.attributes) {
                this.player.woundedLegsTimeout = 0;
                this.player.attributes[A_DEX] = Math.min(25, this.player.attributes[A_DEX] + 1);
                this.player.justHealedLegs = true;
            }
        }

        for (const mon of this.map.monsters) {
            if (mon.dead) continue;
            if (mon.fleetim > 0 && --mon.fleetim <= 0) { mon.fleetim = 0; mon.flee = false; }
            mon.movement += this.mcalcmove(mon);
        }
        if (!rn2(70) && !(this.map?.flags?.nomongen) && !(this.map?.flags?.is_tutorial)) {
            makemon(null, 0, 0, 0, this.player.dungeonLevel, this.map);
        }
        if (this.player.hp < this.player.hpmax) {
            const con = this.player.attributes ? this.player.attributes[A_CON] : 10;
            const heal = (this.player.level + con) > rn2(100) ? 1 : 0;
            if (heal) {
                this.player.hp = Math.min(this.player.hp + heal, this.player.hpmax);
            }
        }

        this.dosounds();
        rn2(20);
        this.player.hunger--;

        const moves = this.turnCount + 1;
        if (moves % 10 === 0) {
            const h = this.player.hunger;
            if (h > 1000) exercise(this.player, A_DEX, false);
            else if (h > 150) exercise(this.player, A_CON, true);
            else if (h > 50) { /* no exercise */ }
            else if (h > 0) exercise(this.player, A_STR, false);
            else exercise(this.player, A_CON, false);
            if (this.player.restingTurn) exercise(this.player, A_STR, true);
        }
        if (moves % 5 === 0 && (this.player.woundedLegsTimeout || 0) > 0) exercise(this.player, A_DEX, false);
        exerchk(this.player, moves);
        const dex = this.player.attributes ? this.player.attributes[A_DEX] : 14;
        if (!rn2(40 + dex * 3)) rnd(3);
        if (moves >= this.seerTurn) this.seerTurn = moves + rn1(31, 15);
    }

    dosounds() {
        const f = this.map.flags;
        if (f.nfountains && !rn2(400)) rn2(3);
        if (f.nsinks && !rn2(300)) rn2(2);
        if (f.has_court && !rn2(200)) return;
        if (f.has_swamp && !rn2(200)) { rn2(2); return; }
        if (f.has_vault && !rn2(200)) { rn2(2); return; }
        if (f.has_beehive && !rn2(200)) return;
        if (f.has_morgue && !rn2(200)) return;
        if (f.has_barracks && !rn2(200)) { rn2(3); return; }
        if (f.has_zoo && !rn2(200)) return;
        if (f.has_shop && !rn2(200)) {
            const loc = this.map?.at?.(this.player.x, this.player.y);
            const ridx = loc && Number.isFinite(loc.roomno) ? loc.roomno - ROOMOFFSET : -1;
            const room = ridx >= 0 ? this.map?.rooms?.[ridx] : null;
            const playerInShop = room && Number.isFinite(room.rtype) && room.rtype >= SHOPBASE;
            const tendedShop = (this.map?.monsters || []).some(m => m && !m.dead && m.isshk);
            if (tendedShop && !playerInShop) rn2(2);
            return;
        }
        if (f.has_temple && !rn2(200)) return;
    }

    changeLevel(depth) {
        if (this.map) {
            this.levels[this.player.dungeonLevel] = this.map;
        }
        const previousMap = this.levels[this.player.dungeonLevel];
        if (this.levels[depth]) {
            this.map = this.levels[depth];
        } else {
            this.map = Number.isInteger(this.dnum)
                ? makelevel(depth, this.dnum, depth, { dungeonAlignOverride: this.dungeonAlignOverride })
                : makelevel(depth, undefined, undefined, { dungeonAlignOverride: this.dungeonAlignOverride });
            this.levels[depth] = this.map;

            if (depth > 1) {
                mon_arrive(previousMap, this.map, this.player, {
                    heroX: this.map.upstair.x,
                    heroY: this.map.upstair.y,
                });
            }
        }
        this.player.dungeonLevel = depth;
        this.placePlayerOnLevel();
        this.renderCurrentScreen();
    }

    placePlayerOnLevel(transitionDir = null) {
        const pos = getArrivalPosition(this.map, this.player.dungeonLevel, transitionDir);
        this.player.x = pos.x;
        this.player.y = pos.y;
    }
}

// Session replay
export async function replaySession(seed, session, opts = {}) {
    const verbose = opts.verbose || false;
    const sessionOpts = session.options || {};
    const roleIndex = typeof sessionOpts.role === 'string'
        ? ROLE_INDEX[sessionOpts.role] ?? 11
        : (sessionOpts.role ?? 11);

    initrack();
    initRng(seed);
    setGameSeed(seed);
    enableRngLog();

    // Consume pre-startup chargen RNG
    const preStartupRng = getPreStartupRngEntries(session);
    consumeRngEntries(preStartupRng);
    const chargenRngCount = getRngLog().length;

    initLevelGeneration(roleIndex);
    const map = makelevel(1);

    const player = new Player();
    player.initRole(roleIndex);
    player.name = sessionOpts.name || 'Agent';
    player.gender = sessionOpts.gender ?? 0;
    if (sessionOpts.align !== undefined) player.alignment = sessionOpts.align;

    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }

    const initResult = simulatePostLevelInit(player, map, 1);
    const seerTurn = initResult?.seerTurn || 0;

    const startupRngCount = getRngLog().length;
    const startupRng = getRngLog().slice(chargenRngCount).map(toCompactRng);

    const game = new HeadlessGame(player, map, { seerTurn });
    game.seed = seed;
    game.roleIndex = roleIndex;

    const steps = session.steps || [];
    const startIdx = (steps.length > 0 && steps[0].key === null) ? 1 : 0;
    const gameplaySteps = steps.slice(startIdx);

    const stepResults = [];
    let prevRngCount = startupRngCount;

    for (let i = 0; i < gameplaySteps.length; i++) {
        const step = gameplaySteps[i];
        const key = step.key;

        if (key !== null && key !== undefined) {
            const code = typeof key === 'string' ? key.charCodeAt(0) : key;
            const result = await rhack(code, game);

            if (result && result.tookTime) {
                movemon(game.map, game.player, game.display, game.fov);
                game.simulateTurnEnd();
            }

            game.renderCurrentScreen();
        }

        const currentRngCount = getRngLog().length;
        const stepRng = getRngLog().slice(prevRngCount).map(toCompactRng);
        const filteredRng = stepRng.filter(e => {
            const call = rngCallPart(e);
            return !isCompositeEntry(call) && !isMidlogEntry(e);
        });

        stepResults.push({
            step: i,
            key,
            rngCalls: filteredRng.length,
            rng: filteredRng,
        });

        prevRngCount = currentRngCount;

        if (game.player.hp <= 0) {
            game.gameOver = true;
            break;
        }
    }

    disableRngLog();

    return {
        startupRngCalls: startupRng.length,
        startupRng,
        stepResults,
        game,
        player: game.player,
        map: game.map,
    };
}
