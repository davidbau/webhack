// test/comparison/session_helpers.js -- Shared utilities for session replay tests
//
// Provides grid comparison, structural validation, and sequential map generation
// used by session_runner.test.js.

import {
    COLNO, ROWNO, STONE, VWALL, HWALL, STAIRS, VAULT,
    IS_WALL, IS_DOOR, ACCESSIBLE, SDOOR, SCORR, IRONBARS,
    CORR, ROOM, DOOR, isok
} from '../../js/config.js';
import { initRng, enableRngLog, getRngLog, disableRngLog, rn2, rnd, rn1 } from '../../js/rng.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';
import { simulatePostLevelInit } from '../../js/u_init.js';
import { Player, roles } from '../../js/player.js';
import { NORMAL_SPEED, A_DEX, A_CON,
         RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC } from '../../js/config.js';
import { rhack } from '../../js/commands.js';
import { pushInput } from '../../js/input.js';
import { movemon, initrack, settrack } from '../../js/monmove.js';
import { FOV } from '../../js/vision.js';

// Terrain type names for readable diffs (matches C's levltyp[] in cmd.c)
export const TYP_NAMES = [
    'STONE', 'VWALL', 'HWALL', 'TLCORNER', 'TRCORNER', 'BLCORNER',
    'BRCORNER', 'CROSSWALL', 'TUWALL', 'TDWALL', 'TLWALL', 'TRWALL',
    'DBWALL', 'TREE', 'SDOOR', 'SCORR', 'POOL', 'MOAT', 'WATER',
    'DRAWBRIDGE_UP', 'LAVAPOOL', 'LAVAWALL', 'IRONBARS', 'DOOR', 'CORR',
    'ROOM', 'STAIRS', 'LADDER', 'FOUNTAIN', 'THRONE', 'SINK', 'GRAVE',
    'ALTAR', 'ICE', 'DRAWBRIDGE_DOWN', 'AIR', 'CLOUD',
];

export function typName(t) {
    return TYP_NAMES[t] || `UNKNOWN(${t})`;
}

// ---------------------------------------------------------------------------
// Grid comparison
// ---------------------------------------------------------------------------

// Parse a typ grid from text (21 lines of 80 space-separated integers)
export function parseTypGrid(text) {
    const lines = text.trim().split('\n');
    return lines.map(line => line.trim().split(/\s+/).map(Number));
}

// Parse a typ grid from session format (array of arrays of numbers)
export function parseSessionTypGrid(grid) {
    if (!grid || !Array.isArray(grid)) return null;
    // Already in array-of-arrays format
    return grid;
}

// Compare two 21x80 grids, return array of diffs
export function compareGrids(grid1, grid2) {
    const diffs = [];
    const rows = Math.min(grid1.length, grid2.length);
    for (let y = 0; y < rows; y++) {
        const cols = Math.min(grid1[y].length, grid2[y].length);
        for (let x = 0; x < cols; x++) {
            if (grid1[y][x] !== grid2[y][x]) {
                diffs.push({
                    x, y,
                    a: grid1[y][x],
                    b: grid2[y][x],
                    aName: typName(grid1[y][x]),
                    bName: typName(grid2[y][x]),
                });
            }
        }
    }
    return diffs;
}

// Format diffs for diagnostic output
export function formatDiffs(diffs, maxShow = 20) {
    if (diffs.length === 0) return 'PERFECT MATCH';
    const shown = diffs.slice(0, maxShow);
    let report = `${diffs.length} cells differ:`;
    for (const d of shown) {
        report += `\n  (${d.x},${d.y}): JS=${d.aName}(${d.a}) session=${d.bName}(${d.b})`;
    }
    if (diffs.length > maxShow) {
        report += `\n  ... and ${diffs.length - maxShow} more`;
    }
    return report;
}

// ---------------------------------------------------------------------------
// Sequential map generation (matching C's RNG stream)
// ---------------------------------------------------------------------------

// Extract a typ grid from a map object: 21 rows of 80 integers
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

// Generate levels 1→maxDepth sequentially on one continuous RNG stream.
// Returns { grids: { depth: number[][] }, maps: { depth: GameMap } }
export function generateMapsSequential(seed, maxDepth) {
    initRng(seed);
    initLevelGeneration();
    const grids = {};
    const maps = {};
    for (let depth = 1; depth <= maxDepth; depth++) {
        const map = makelevel(depth);
        wallification(map);
        grids[depth] = extractTypGrid(map);
        maps[depth] = map;
    }
    return { grids, maps };
}

// ---------------------------------------------------------------------------
// RNG trace capture and comparison
// ---------------------------------------------------------------------------

// Convert JS log entry to compact session format.
// JS format: "1 rn2(12) = 2" or "1 rn2(12) = 2 @ caller(file.js:45)"
// Compact:   "rn2(12)=2" or "rn2(12)=2 @ caller(file.js:45)"
function toCompactRng(entry) {
    // Strip leading count prefix: "1 rn2(...) = result ..." → "rn2(...) = result ..."
    const noCount = entry.replace(/^\d+\s+/, '');
    // Compress " = " → "="
    return noCount.replace(' = ', '=');
}

// Extract the fn(arg)=result portion from a compact RNG entry, ignoring @ source tags.
function rngCallPart(entry) {
    const atIdx = entry.indexOf(' @ ');
    return atIdx >= 0 ? entry.substring(0, atIdx) : entry;
}

// Compare two RNG trace arrays.
// Returns { index: -1 } on match, or { index, js, session } at first divergence.
// Compares fn(arg)=result portion only (ignores @ source:line tags).
export function compareRng(jsRng, sessionRng) {
    const len = Math.min(jsRng.length, sessionRng.length);
    for (let i = 0; i < len; i++) {
        if (rngCallPart(jsRng[i]) !== rngCallPart(sessionRng[i])) {
            return { index: i, js: jsRng[i], session: sessionRng[i] };
        }
    }
    if (jsRng.length !== sessionRng.length) {
        return {
            index: len,
            js: jsRng[len] || '(end)',
            session: sessionRng[len] || '(end)',
        };
    }
    return { index: -1 };
}

// Generate levels 1→maxDepth with RNG trace capture.
// Returns { grids, maps, rngLogs } where rngLogs[depth] = { rngCalls, rng }.
export function generateMapsWithRng(seed, maxDepth) {
    enableRngLog();
    initRng(seed);
    initLevelGeneration();
    const grids = {};
    const maps = {};
    const rngLogs = {};
    let prevCount = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
        const map = makelevel(depth);
        wallification(map);
        grids[depth] = extractTypGrid(map);
        maps[depth] = map;
        const fullLog = getRngLog();
        const depthLog = fullLog.slice(prevCount);
        rngLogs[depth] = {
            rngCalls: depthLog.length,
            rng: depthLog.map(toCompactRng),
        };
        prevCount = fullLog.length;
    }
    disableRngLog();
    return { grids, maps, rngLogs };
}

// Map role name → roles[] index
const ROLE_INDEX = {};
for (let i = 0; i < roles.length; i++) ROLE_INDEX[roles[i].name] = i;

// Count RNG calls consumed during character selection menus before newgame().
// For chargen sessions, steps before "confirm-ok" may consume RNG (e.g., pick_align).
// For gameplay sessions, this returns 0.
function countPreStartupRng(session) {
    if (session.type !== 'chargen') return 0;
    let count = 0;
    for (const step of (session.steps || [])) {
        if (step.action === 'confirm-ok') break;
        count += (step.rng || []).length;
    }
    return count;
}

// Generate full startup (map gen + post-level init) with RNG trace capture.
// Matches the C startup sequence: o_init → dungeon_init → makelevel → wallification
// → player placement → simulatePostLevelInit (pet, inventory, attributes, welcome).
// For chargen sessions, pre-startup menu RNG calls are consumed first.
// Returns { grid, map, rngCalls, rng }.
export function generateStartupWithRng(seed, session) {
    enableRngLog();
    initRng(seed);

    // Determine role before level generation (needed for role-specific RNG)
    const charOpts = session.character || {};
    const roleIndex = ROLE_INDEX[charOpts.role] ?? 11; // default Valkyrie

    // Chargen sessions have RNG consumed during character selection menus
    // (e.g., pick_align) before the newgame() startup. Consume those first.
    const preStartupCalls = countPreStartupRng(session);
    for (let i = 0; i < preStartupCalls; i++) rn2(1);

    initLevelGeneration(roleIndex);

    const map = makelevel(1);
    wallification(map);
    const grid = extractTypGrid(map);

    // Set up player matching the session's character configuration
    const player = new Player();
    player.initRole(roleIndex);
    player.name = charOpts.name || 'Wizard';
    player.gender = charOpts.gender === 'female' ? 1 : 0;

    // Override alignment if session specifies one (for non-default alignment variants)
    const alignMap = { lawful: 1, neutral: 0, chaotic: -1 };
    if (charOpts.align && alignMap[charOpts.align] !== undefined) {
        player.alignment = alignMap[charOpts.align];
    }

    // Set race from session (default Human)
    const raceMap = { human: RACE_HUMAN, elf: RACE_ELF, dwarf: RACE_DWARF, gnome: RACE_GNOME, orc: RACE_ORC };
    player.race = raceMap[charOpts.race] ?? RACE_HUMAN;

    // Place player at upstair (matching C's u_on_upstairs)
    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }

    // Capture pre-chargen RNG count for isolating chargen calls
    const preChargenCount = getRngLog().length;

    // Post-level init: pet creation, inventory, attributes, welcome
    simulatePostLevelInit(player, map, 1);

    const fullLog = getRngLog();
    disableRngLog();

    // Strip pre-startup menu RNG calls from the log
    const startupLog = fullLog.slice(preStartupCalls);

    // Isolate chargen-only RNG (post-map: pet + inventory + attributes + welcome)
    const chargenLog = fullLog.slice(preChargenCount);

    return {
        grid,
        map,
        player,
        rngCalls: startupLog.length,
        rng: startupLog.map(toCompactRng),
        chargenRngCalls: chargenLog.length,
        chargenRng: chargenLog.map(toCompactRng),
    };
}

// ---------------------------------------------------------------------------
// Headless game replay for gameplay session testing
// ---------------------------------------------------------------------------

// Null display that swallows all output (for headless testing)
const nullDisplay = {
    putstr_message() {},
    putstr() {},
    clearRow() {},
    renderMap() {},
    renderStatus() {},
};

// A minimal game object that can be driven by rhack() and movemon() without DOM.
// Mirrors NetHackGame from nethack.js but strips browser dependencies.
class HeadlessGame {
    constructor(player, map, opts = {}) {
        this.player = player;
        this.map = map;
        this.display = nullDisplay;
        this.fov = new FOV();
        this.levels = { 1: map };
        this.gameOver = false;
        this.turnCount = 0;
        this.wizard = true;
        this.flags = { pickup: false, safe_pet: true, confirm: true, verbose: true };
        this.seerTurn = opts.seerTurn || 0;
        initrack(); // C ref: track.c — initialize player track buffer
    }

    // C ref: mon.c mcalcmove() — random rounding of monster speed
    mcalcmove(mon) {
        let mmove = mon.speed;
        const mmoveAdj = mmove % NORMAL_SPEED;
        mmove -= mmoveAdj;
        if (rn2(NORMAL_SPEED) < mmoveAdj) mmove += NORMAL_SPEED;
        return mmove;
    }

    // C ref: allmain.c moveloop_core() — per-turn effects
    simulateTurnEnd() {
        // C ref: allmain.c:239 — settrack() called after movemon, before moves++
        settrack(this.player);
        this.turnCount++;
        this.player.turns = this.turnCount;

        for (const mon of this.map.monsters) {
            if (mon.dead) continue;
            mon.movement += this.mcalcmove(mon);
        }

        rn2(70);   // monster spawn check

        // C ref: allmain.c:289-295 regen_hp()
        if (this.player.hp < this.player.hpmax) {
            const con = this.player.attributes ? this.player.attributes[A_CON] : 10;
            const heal = (this.player.level + con) > rn2(100) ? 1 : 0;
            if (heal) {
                this.player.hp = Math.min(this.player.hp + heal, this.player.hpmax);
            }
        }

        this.dosounds();
        rn2(20);   // gethungry
        this.player.hunger--;

        // C ref: attrib.c exerchk() → exerper()
        // exerper fires hunger checks every 10 moves, status checks every 5 moves
        // exercise(attr, TRUE) consumes rn2(19), exercise(attr, FALSE) consumes rn2(2)
        // C ref: attrib.c exerchk() → exerper()
        // C's svm.moves starts at 1 and increments before exerchk
        // JS turnCount starts at 0, so use turnCount + 1 to match
        const moves = this.turnCount + 1;
        if (moves % 10 === 0) {
            // Hunger check: NOT_HUNGRY → exercise(A_CON, TRUE) → rn2(19)
            rn2(19); // exercise(A_CON, TRUE)
        }
        // Status checks every 5 moves: none apply in early game (no intrinsics/conditions)

        const dex = this.player.attributes ? this.player.attributes[A_DEX] : 14;
        rn2(40 + dex * 3); // engrave wipe

        // C ref: allmain.c:414 seer_turn check
        // C's svm.moves is +1 ahead of turnCount (same offset as exerchk)
        if (moves >= this.seerTurn) {
            this.seerTurn = moves + rn1(31, 15);
        }
    }

    // C ref: sounds.c:202-339 dosounds() — ambient level sounds
    dosounds() {
        const f = this.map.flags;
        if (f.nfountains && !rn2(400)) { rn2(3); }
        if (f.nsinks && !rn2(300)) { rn2(2); }
        if (f.has_court && !rn2(200)) { return; }
        if (f.has_swamp && !rn2(200)) { rn2(2); return; }
        if (f.has_vault && !rn2(200)) { rn2(2); return; }
        if (f.has_beehive && !rn2(200)) { return; }
        if (f.has_morgue && !rn2(200)) { return; }
        if (f.has_barracks && !rn2(200)) { rn2(3); return; }
        if (f.has_zoo && !rn2(200)) { return; }
        if (f.has_shop && !rn2(200)) { rn2(2); return; }
        if (f.has_temple && !rn2(200)) { return; }
    }

    // Generate or retrieve a level (for stair traversal)
    changeLevel(depth) {
        if (this.map) {
            this.levels[this.player.dungeonLevel] = this.map;
        }
        if (this.levels[depth]) {
            this.map = this.levels[depth];
        } else {
            this.map = makelevel(depth);
            wallification(this.map);
            this.levels[depth] = this.map;
        }
        this.player.dungeonLevel = depth;
        this.placePlayerOnLevel();
    }

    placePlayerOnLevel() {
        const hasUpstair = this.map.upstair.x > 0 && this.map.upstair.y > 0;
        if (hasUpstair && this.player.dungeonLevel > 1) {
            this.player.x = this.map.upstair.x;
            this.player.y = this.map.upstair.y;
        }
    }
}

// Replay a gameplay session and return per-step RNG results.
// Returns { startup: { rngCalls, rng }, steps: [{ rngCalls, rng }] }
export async function replaySession(seed, session) {
    enableRngLog();
    initRng(seed);
    const replayRoleIndex = ROLE_INDEX[session.character?.role] ?? 11;
    initLevelGeneration(replayRoleIndex);

    const map = makelevel(1);
    wallification(map);

    const player = new Player();
    player.initRole(replayRoleIndex);
    player.name = session.character?.name || 'Wizard';
    player.gender = session.character?.gender === 'female' ? 1 : 0;

    // Override alignment if session specifies one (for non-default alignment variants)
    const replayAlignMap = { lawful: 1, neutral: 0, chaotic: -1 };
    if (session.character?.align && replayAlignMap[session.character.align] !== undefined) {
        player.alignment = replayAlignMap[session.character.align];
    }

    // Set race from session (default Human)
    const replayRaceMap = { human: RACE_HUMAN, elf: RACE_ELF, dwarf: RACE_DWARF, gnome: RACE_GNOME, orc: RACE_ORC };
    player.race = replayRaceMap[session.character?.race] ?? RACE_HUMAN;

    // Parse actual attributes from session screen (u_init randomizes them)
    // Screen format: "St:18 Dx:11 Co:18 In:11 Wi:9 Ch:8"
    const screen = session.startup?.screen || [];
    for (const line of screen) {
        if (!line) continue;
        const m = line.match(/St:(\d+)\s+Dx:(\d+)\s+Co:(\d+)\s+In:(\d+)\s+Wi:(\d+)\s+Ch:(\d+)/);
        if (m) {
            player.attributes[0] = parseInt(m[1]); // A_STR
            player.attributes[1] = parseInt(m[4]); // A_INT (In)
            player.attributes[2] = parseInt(m[5]); // A_WIS (Wi)
            player.attributes[3] = parseInt(m[2]); // A_DEX (Dx)
            player.attributes[4] = parseInt(m[3]); // A_CON (Co)
            player.attributes[5] = parseInt(m[6]); // A_CHA (Ch)
        }
        const hpm = line.match(/HP:(\d+)\((\d+)\)\s+Pw:(\d+)\((\d+)\)\s+AC:(\d+)/);
        if (hpm) {
            player.hp = parseInt(hpm[1]);
            player.hpmax = parseInt(hpm[2]);
            player.pw = parseInt(hpm[3]);
            player.pwmax = parseInt(hpm[4]);
            player.ac = parseInt(hpm[5]);
        }
    }

    // C ref: 3.7 Valkyrie starts with spear (+1), not long sword
    // spear: oc_wsdam=6, oc_wldam=8
    player.weapon = { name: 'spear', wsdam: 6, wldam: 8, enchantment: 1 };

    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }

    const initResult = simulatePostLevelInit(player, map, 1);

    const startupLog = getRngLog();
    const startupRng = startupLog.map(toCompactRng);

    const game = new HeadlessGame(player, map, { seerTurn: initResult.seerTurn });

    // Replay each step
    const stepResults = [];
    for (const step of (session.steps || [])) {
        const prevCount = getRngLog().length;

        // Feed the key to the game engine
        // For multi-char keys (e.g. "wb" = wield item b), push trailing chars
        // into input queue so nhgetch() returns them immediately
        if (step.key.length > 1) {
            for (let i = 1; i < step.key.length; i++) {
                pushInput(step.key.charCodeAt(i));
            }
        }
        const ch = step.key.charCodeAt(0);
        const result = await rhack(ch, game);

        // If the command took time, run monster movement and turn effects
        if (result && result.tookTime) {
            movemon(game.map, game.player, game.display, game.fov);
            game.simulateTurnEnd();
        }

        // Sync player HP from session screen data so regen_hp fires correctly.
        // JS doesn't fully model monster-to-player combat damage or healing,
        // so we use the authoritative screen state to keep HP in sync.
        if (step.screen) {
            for (const line of step.screen) {
                const hpm = line.match(/HP:(\d+)\((\d+)\)/);
                if (hpm) {
                    game.player.hp = parseInt(hpm[1]);
                    game.player.hpmax = parseInt(hpm[2]);
                }
            }
        }

        const fullLog = getRngLog();
        const stepLog = fullLog.slice(prevCount);
        stepResults.push({
            rngCalls: stepLog.length,
            rng: stepLog.map(toCompactRng),
        });
    }

    disableRngLog();

    return {
        startup: { rngCalls: startupRng.length, rng: startupRng },
        steps: stepResults,
    };
}

// ---------------------------------------------------------------------------
// Structural validation tests (extracted from map_compare.test.js)
// ---------------------------------------------------------------------------

// Check that all rooms have complete wall borders
export function checkWallCompleteness(map, label) {
    const errors = [];
    for (const room of map.rooms) {
        // Top edge
        for (let x = room.lx - 1; x <= room.hx + 1; x++) {
            const y = room.ly - 1;
            if (!isok(x, y)) continue;
            const loc = map.at(x, y);
            if (!IS_WALL(loc.typ) && !IS_DOOR(loc.typ) && loc.typ !== CORR &&
                loc.typ !== SDOOR && loc.typ !== SCORR && loc.typ !== IRONBARS) {
                errors.push(`Gap in top wall at (${x},${y}): typ=${loc.typ}`);
            }
        }
        // Bottom edge
        for (let x = room.lx - 1; x <= room.hx + 1; x++) {
            const y = room.hy + 1;
            if (!isok(x, y)) continue;
            const loc = map.at(x, y);
            if (!IS_WALL(loc.typ) && !IS_DOOR(loc.typ) && loc.typ !== CORR &&
                loc.typ !== SDOOR && loc.typ !== SCORR && loc.typ !== IRONBARS) {
                errors.push(`Gap in bottom wall at (${x},${y}): typ=${loc.typ}`);
            }
        }
        // Left edge
        for (let y = room.ly - 1; y <= room.hy + 1; y++) {
            const x = room.lx - 1;
            if (!isok(x, y)) continue;
            const loc = map.at(x, y);
            if (!IS_WALL(loc.typ) && !IS_DOOR(loc.typ) && loc.typ !== CORR &&
                loc.typ !== SDOOR && loc.typ !== SCORR && loc.typ !== IRONBARS) {
                errors.push(`Gap in left wall at (${x},${y}): typ=${loc.typ}`);
            }
        }
        // Right edge
        for (let y = room.ly - 1; y <= room.hy + 1; y++) {
            const x = room.hx + 1;
            if (!isok(x, y)) continue;
            const loc = map.at(x, y);
            if (!IS_WALL(loc.typ) && !IS_DOOR(loc.typ) && loc.typ !== CORR &&
                loc.typ !== SDOOR && loc.typ !== SCORR && loc.typ !== IRONBARS) {
                errors.push(`Gap in right wall at (${x},${y}): typ=${loc.typ}`);
            }
        }
    }
    return errors;
}

// Check that all non-vault rooms are reachable from the first non-vault room
export function checkConnectivity(map) {
    const nonVaultRooms = map.rooms.filter(r => r.rtype !== VAULT);
    if (nonVaultRooms.length <= 1) return [];

    const start = nonVaultRooms[0];
    const sx = Math.floor((start.lx + start.hx) / 2);
    const sy = Math.floor((start.ly + start.hy) / 2);

    const visited = [];
    for (let x = 0; x < COLNO; x++) {
        visited[x] = new Uint8Array(ROWNO);
    }

    const queue = [[sx, sy]];
    visited[sx][sy] = 1;

    while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!isok(nx, ny)) continue;
            if (visited[nx][ny]) continue;
            const t = map.at(nx, ny).typ;
            if (ACCESSIBLE(t) || t === SDOOR || t === SCORR) {
                visited[nx][ny] = 1;
                queue.push([nx, ny]);
            }
        }
    }

    const errors = [];
    for (let i = 1; i < map.rooms.length; i++) {
        const room = map.rooms[i];
        if (room.rtype === VAULT) continue;
        const rx = Math.floor((room.lx + room.hx) / 2);
        const ry = Math.floor((room.ly + room.hy) / 2);
        if (!visited[rx][ry]) {
            errors.push(`Room ${i} (center ${rx},${ry}) is not reachable from room 0`);
        }
    }
    return errors;
}

// Check stairs are placed correctly
export function checkStairs(map, depth) {
    const errors = [];

    if (!map.dnstair || (map.dnstair.x === 0 && map.dnstair.y === 0)) {
        errors.push('No downstairs placed');
    } else {
        const loc = map.at(map.dnstair.x, map.dnstair.y);
        if (loc.typ !== STAIRS) {
            errors.push(`Downstairs at (${map.dnstair.x},${map.dnstair.y}) is not STAIRS, typ=${loc.typ}`);
        }
    }

    if (depth > 1) {
        if (!map.upstair || (map.upstair.x === 0 && map.upstair.y === 0)) {
            errors.push('No upstairs placed for depth > 1');
        } else {
            const loc = map.at(map.upstair.x, map.upstair.y);
            if (loc.typ !== STAIRS) {
                errors.push(`Upstairs at (${map.upstair.x},${map.upstair.y}) is not STAIRS, typ=${loc.typ}`);
            }
        }
    }

    return errors;
}

// Check grid dimensions
export function checkDimensions(grid) {
    const errors = [];
    if (grid.length !== ROWNO) {
        errors.push(`Expected ${ROWNO} rows, got ${grid.length}`);
    }
    for (let y = 0; y < grid.length; y++) {
        if (grid[y].length !== COLNO) {
            errors.push(`Row ${y} has ${grid[y].length} cols, expected ${COLNO}`);
        }
    }
    return errors;
}

// Check all typ values are valid
export function checkValidTypValues(grid) {
    const errors = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (grid[y][x] < 0 || grid[y][x] >= TYP_NAMES.length) {
                errors.push(`Invalid typ ${grid[y][x]} at (${x},${y})`);
            }
        }
    }
    return errors;
}
