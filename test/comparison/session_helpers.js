// test/comparison/session_helpers.js -- Shared utilities for session replay tests
//
// Provides grid comparison, structural validation, and sequential map generation
// used by session_runner.test.js.

import {
    COLNO, ROWNO, STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, STAIRS, VAULT,
    IS_WALL, IS_DOOR, ACCESSIBLE, SDOOR, SCORR, IRONBARS,
    CORR, ROOM, DOOR, isok, TERMINAL_COLS, TERMINAL_ROWS,
    D_ISOPEN, D_CLOSED, D_LOCKED, D_NODOOR, A_NONE,
    ALTAR, FOUNTAIN, THRONE, SINK, GRAVE, POOL, MOAT, WATER, LAVAPOOL,
    LAVAWALL, ICE, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, AIR, CLOUD, TREE,
    MAP_ROW_START, STATUS_ROW_1, STATUS_ROW_2,
    A_LAWFUL, A_NEUTRAL, A_CHAOTIC
} from '../../js/config.js';
import { initRng, enableRngLog, getRngLog, disableRngLog, rn2, rnd, rn1, rnl, rne, rnz, d } from '../../js/rng.js';
import { initLevelGeneration, makelevel, setGameSeed, wallification, simulateDungeonInit } from '../../js/dungeon.js';
import { DUNGEONS_OF_DOOM, TUTORIAL } from '../../js/special_levels.js';
import { simulatePostLevelInit, mon_arrive } from '../../js/u_init.js';
import { init_objects } from '../../js/o_init.js';
import { Player, roles, rankOf } from '../../js/player.js';
import { NORMAL_SPEED, A_DEX, A_CON,
         RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC } from '../../js/config.js';
import { rhack } from '../../js/commands.js';
import { makemon } from '../../js/makemon.js';
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

// Strip ANSI escape/control sequences from a terminal line.
export function stripAnsiSequences(text) {
    if (!text) return '';
    return String(text)
        // CSI sequences (e.g. ESC[31m, ESC[0K)
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        // OSC sequences (e.g. ESC]...BEL or ESC]...ESC\)
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        // Single-character ESC sequences (e.g. ESC(0, ESC)0)
        .replace(/\x1b[@-Z\\-_]/g, '')
        // Remaining raw C1 CSI
        .replace(/\x9b[0-?]*[ -/]*[@-~]/g, '');
}

// Session screens may provide plain `screen`, richer `screenAnsi`, or both.
// Prefer ANSI when present, but normalize to plain text for existing comparisons.
export function getSessionScreenLines(screenHolder) {
    const raw = Array.isArray(screenHolder?.screenAnsi)
        ? screenHolder.screenAnsi
        : (Array.isArray(screenHolder?.screen) ? screenHolder.screen : []);
    return raw.map((line) => stripAnsiSequences(line));
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
    initrack(); // reset player track buffer between tests
    initRng(seed);
    setGameSeed(seed);

    // initLevelGeneration handles init_objects() and simulateDungeonInit() internally
    // Pass roleIndex=11 for Valkyrie (matches C map test harness)
    initLevelGeneration(11);
    const grids = {};
    const maps = {};
    for (let depth = 1; depth <= maxDepth; depth++) {
        const map = makelevel(depth);
        // Note: wallification and place_lregion are now called inside makelevel

        grids[depth] = extractTypGrid(map);
        maps[depth] = map;
    }
    return { grids, maps };
}

// ---------------------------------------------------------------------------
// RNG trace capture and comparison
// ---------------------------------------------------------------------------

// Check if a log entry is a mid-level function trace (>entry or <exit).
function isMidlogEntry(entry) {
    return entry.length > 0 && (entry[0] === '>' || entry[0] === '<');
}

// Check if a log entry is a composite RNG function whose individual
// random number consumptions are not visible as separate rn2/rnd entries.
// - rne/rnz: internal rn2 calls ARE logged separately by C, so these
//   wrapper entries would cause double-counting during comparison.
// - d(): internal RND() calls bypass rn2 and are NOT logged individually.
//   Both C and JS log d() as a single entry, but old C session files
//   may have d() filtered out.  Skip during comparison for compatibility.
function isCompositeEntry(entry) {
    return entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d(');
}

// Convert JS log entry to compact session format.
// JS format: "1 rn2(12)=2" or "1 rn2(12)=2 @ caller(file.js:45)"
// Compact:   "rn2(12)=2" or "rn2(12)=2 @ caller(file.js:45)"
// Mid-level trace entries (>/<) are passed through unchanged.
function toCompactRng(entry) {
    if (isMidlogEntry(entry)) return entry;
    // Strip leading count prefix: "1 rn2(...)=result ..." → "rn2(...)=result ..."
    return entry.replace(/^\d+\s+/, '');
}

// Extract the fn(arg)=result portion from a compact RNG entry, ignoring @ source tags.
function rngCallPart(entry) {
    const atIdx = entry.indexOf(' @ ');
    return atIdx >= 0 ? entry.substring(0, atIdx) : entry;
}

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
        case 'rn2':
            if (args.length >= 1) rn2(args[0]);
            break;
        case 'rnd':
            if (args.length >= 1) rnd(args[0]);
            break;
        case 'rn1':
            if (args.length >= 2) rn1(args[0], args[1]);
            break;
        case 'rnl':
            if (args.length >= 1) rnl(args[0]);
            break;
        case 'rne':
            if (args.length >= 1) rne(args[0]);
            break;
        case 'rnz':
            if (args.length >= 1) rnz(args[0]);
            break;
        case 'd':
            if (args.length >= 2) d(args[0], args[1]);
            break;
    }
}

function consumeRngEntries(entries) {
    for (const entry of entries || []) consumeRngEntry(entry);
}

// Compare two RNG trace arrays.
// Returns { index: -1 } on match, or { index, js, session } at first divergence.
// Compares fn(arg)=result portion only (ignores @ source:line tags).
// Mid-level trace entries (>/<) from C sessions are skipped during comparison
// since JS does not (yet) emit them.
export function compareRng(jsRng, sessionRng) {
    let si = 0; // session index
    let ji = 0; // js index
    while (ji < jsRng.length && si < sessionRng.length) {
        // Skip midlog entries in session trace
        if (isMidlogEntry(sessionRng[si])) { si++; continue; }
        // Skip midlog entries in JS trace (future-proofing)
        if (isMidlogEntry(jsRng[ji])) { ji++; continue; }
        // Skip composite RNG entries (rne/rnz/d) in JS trace — see isCompositeEntry().
        if (isCompositeEntry(rngCallPart(jsRng[ji]))) { ji++; continue; }
        if (isCompositeEntry(rngCallPart(sessionRng[si]))) { si++; continue; }
        if (rngCallPart(jsRng[ji]) !== rngCallPart(sessionRng[si])) {
            return { index: ji, js: jsRng[ji], session: sessionRng[si] };
        }
        ji++;
        si++;
    }
    // Skip trailing midlog/composite entries
    while (si < sessionRng.length && (isMidlogEntry(sessionRng[si]) || isCompositeEntry(rngCallPart(sessionRng[si])))) si++;
    while (ji < jsRng.length && (isMidlogEntry(jsRng[ji]) || isCompositeEntry(rngCallPart(jsRng[ji])))) ji++;
    if (ji < jsRng.length || si < sessionRng.length) {
        return {
            index: ji,
            js: jsRng[ji] || '(end)',
            session: sessionRng[si] || '(end)',
        };
    }
    return { index: -1 };
}

// Generate levels 1→maxDepth with RNG trace capture.
// Returns { grids, maps, rngLogs } where rngLogs[depth] = { rngCalls, rng }.
export function generateMapsWithRng(seed, maxDepth) {
    initrack(); // reset player track buffer between tests
    initRng(seed);
    setGameSeed(seed);
    enableRngLog(); // Start logging RNG calls

    // initLevelGeneration handles init_objects() and simulateDungeonInit() internally
    // Pass roleIndex=11 for Valkyrie (matches C map test harness)
    initLevelGeneration(11);
    const grids = {};
    const maps = {};
    const rngLogs = {};
    let harnessPlayer = null;
    let prevCount = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
        const previousMap = depth > 1 ? maps[depth - 1] : null;
        const map = makelevel(depth);
        // Note: wallification and place_lregion are now called inside makelevel

        grids[depth] = extractTypGrid(map);
        maps[depth] = map;

        // C map harness runs a full game as Valkyrie. Depth 1 includes
        // post-level init (pet creation, hero inventory, attributes, welcome).
        // Depth 2+ includes pet arrival via wizard_level_teleport.
        if (depth === 1) {
            harnessPlayer = new Player();
            harnessPlayer.initRole(11); // Valkyrie
            if (map.upstair) {
                harnessPlayer.x = map.upstair.x;
                harnessPlayer.y = map.upstair.y;
            }
            simulatePostLevelInit(harnessPlayer, map, 1);
        } else {
            // C ref: dog.c:474 mon_arrive — use real migration path.
            if (harnessPlayer && previousMap) {
                mon_arrive(previousMap, map, harnessPlayer, {
                    heroX: map.upstair.x,
                    heroY: map.upstair.y,
                });
            }
        }

        // Keep player position synchronized so subsequent level changes use
        // C-like adjacency checks for follower migration eligibility.
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
        // Filter out composite entries (rne, rnz, d) and midlog markers (>, <)
        // to match C map session comparison format.
        // Note: C session files contain midlog markers, but we filter them for comparison
        // since JS doesn't generate them (JS suppresses nested RNG logging instead).
        const filteredRng = compactRng.filter(e => {
            const call = rngCallPart(e);
            return !isCompositeEntry(call) && !isMidlogEntry(e);
        });
        const rngCalls = filteredRng.length;
        rngLogs[depth] = { rngCalls, rng: filteredRng };
        prevCount = fullLog.length;
    }
    disableRngLog();
    return { grids, maps, rngLogs };
}

// Map role name → roles[] index
const ROLE_INDEX = {};
for (let i = 0; i < roles.length; i++) ROLE_INDEX[roles[i].name] = i;

// Collect RNG calls consumed during character selection menus before newgame().
// For chargen sessions, steps before "confirm-ok" may consume RNG (e.g., pick_align).
// For gameplay sessions with chargen data, collect RNG from chargen steps before confirm-ok.
// C ref: role.c pick_gend() — happens during role selection BEFORE initLevelGeneration.
function getPreStartupRngEntries(session) {
    if (session.type === 'chargen') {
        const out = [];
        for (const step of (session.steps || [])) {
            if (step.action === 'confirm-ok') break;
            out.push(...(step.rng || []));
        }
        return out;
    }
    if (session.chargen && session.chargen.length > 0) {
        const out = [];
        const confirmIndex = session.chargen.findIndex(s => s.action === 'confirm-ok');
        for (let i = 0; i < confirmIndex && i < session.chargen.length; i++) {
            out.push(...(session.chargen[i].rng || []));
        }
        return out;
    }
    return [];
}

// Some keylog-derived gameplay sessions record startup RNG in step[0].rng
// instead of startup.rng (which is empty). Detect that format so replay output
// can be normalized for strict per-step comparison.
export function hasStartupBurstInFirstStep(session) {
    if (!session) return false;
    const startupCalls = session.startup?.rngCalls ?? 0;
    if (startupCalls !== 0) return false;
    if ((session.startup?.rng?.length ?? 0) !== 0) return false;
    const firstStepRngLen = session.steps?.[0]?.rng?.length ?? 0;
    return firstStepRngLen > 0;
}

function isTutorialPromptScreen(screen) {
    if (!Array.isArray(screen) || screen.length === 0) return false;
    return screen.some(line => typeof line === 'string' && line.includes('Do you want a tutorial?'));
}

// Generate full startup (map gen + post-level init) with RNG trace capture.
// Matches the C startup sequence: o_init → dungeon_init → makelevel → wallification
// → player placement → simulatePostLevelInit (pet, inventory, attributes, welcome).
// For chargen sessions, pre-startup menu RNG calls are consumed first.
// Returns { grid, map, rngCalls, rng }.
export function generateStartupWithRng(seed, session) {
    initrack(); // reset player track buffer between tests
    enableRngLog();
    initRng(seed);
    setGameSeed(seed);

    // Determine role before level generation (needed for role-specific RNG)
    const charOpts = session.character || {};
    const roleIndex = ROLE_INDEX[charOpts.role] ?? 11; // default Valkyrie

    // Chargen sessions have RNG consumed during character selection menus
    // (e.g., pick_align) before the newgame() startup. Consume those first.
    const preStartupEntries = getPreStartupRngEntries(session);
    consumeRngEntries(preStartupEntries);

    console.log(`After preStartup: ${getRngLog().length} RNG calls`);
    initLevelGeneration(roleIndex);
    console.log(`After initLevelGeneration: ${getRngLog().length} RNG calls`);

    const map = makelevel(1);
    console.log(`After makelevel: ${getRngLog().length} RNG calls`);
    // Note: wallification is now called inside makelevel

    // NOTE: Wizard mode (-D flag) enables omniscience for the PLAYER,
    // but does NOT make pets aware of trap locations (trap.tseen).
    // Traps are only seen when discovered during gameplay.
    // Removed automatic trap revelation here.

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

    // Strip pre-startup menu RNG calls from the log.
    // For chargen-type sessions, session.startup.rng excludes chargen steps, so strip them.
    // For gameplay sessions with chargen, session.startup.rng INCLUDES chargen RNG, so keep them.
    const stripCount = session.type === 'chargen' ? preStartupEntries.length : 0;
    const startupLog = fullLog.slice(stripCount);

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
    cols: TERMINAL_COLS,
    rows: TERMINAL_ROWS,
    putstr_message() {},
    putstr() {},
    clearRow() {},
    clearScreen() {},
    setCell() {},
    renderMap() {},
    renderStatus() {},
    renderChargenMenu() {}, // For inventory and modal menus
};

// A minimal game object that can be driven by rhack() and movemon() without DOM.
// Mirrors NetHackGame from nethack.js but strips browser dependencies.
class HeadlessGame {
    constructor(player, map, opts = {}) {
        this.player = player;
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
        this.occupation = null; // C ref: cmd.c go.occupation — multi-turn action
        this.flags = { pickup: false, verbose: false, safe_wait: true }; // Game flags for commands
        this.menuRequested = false; // 'm' prefix command state
        initrack(); // C ref: track.c — initialize player track buffer
        this.renderCurrentScreen();
    }

    renderCurrentScreen() {
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov);
        this.display.renderStatus(this.player);
    }

    // C ref: allmain.c interrupt_multi() — check if multi-count should be interrupted
    // Interrupts search/wait/etc count when hostile monster appears adjacent.
    shouldInterruptMulti() {
        const { x, y } = this.player;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const mon = this.map.monsterAt(x + dx, y + dy);
                if (mon && !mon.dead && !mon.tame && !mon.peaceful) {
                    return true; // Hostile monster nearby
                }
            }
        }
        return false;
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

        // C ref: mon.c m_calcdistress() — temporary flee timeout handling.
        for (const mon of this.map.monsters) {
            if (mon.dead) continue;
            if (mon.fleetim && mon.fleetim > 0) {
                mon.fleetim--;
                if (mon.fleetim <= 0) {
                    mon.fleetim = 0;
                    mon.flee = false;
                }
            }
        }

        for (const mon of this.map.monsters) {
            if (mon.dead) continue;
            mon.movement += this.mcalcmove(mon);
        }

        // C ref: allmain.c moveloop_core() — occasional random spawn.
        if (!rn2(70)) {
            // Spawn at random valid location; new monster misses its first turn
            // because movement allocation already happened above.
            makemon(null, 0, 0, 0, this.player.dungeonLevel, this.map);
        }

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
        // C's svm.moves starts at 1 and increments before exerchk
        // JS turnCount starts at 0, so use turnCount + 1 to match
        const moves = this.turnCount + 1;
        if (moves % 10 === 0) {
            // C ref: attrib.c exerper() hunger switch (with break per case)
            if (this.player.hunger > 1000) {
                // SATIATED: exercise(A_DEX, FALSE) → rn2(2)
                rn2(2);
            } else if (this.player.hunger > 150) {
                // NOT_HUNGRY: exercise(A_CON, TRUE) → rn2(19)
                rn2(19);
            } else if (this.player.hunger > 50) {
                // HUNGRY: no exercise call
            } else if (this.player.hunger > 0) {
                // WEAK: exercise(A_STR, FALSE) → rn2(2)
                rn2(2);
            } else {
                // FAINTING: exercise(A_CON, FALSE) → rn2(2)
                rn2(2);
            }
        }
        // Status checks every 5 moves: none apply in early game (no intrinsics/conditions)

        const dex = this.player.attributes ? this.player.attributes[A_DEX] : 14;
        if (!rn2(40 + dex * 3)) {
            rnd(3); // C ref: allmain.c u_wipe_engr(rnd(3))
        }

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
        if (f.has_shop && !rn2(200)) {
            const which = rn2(2);
            if (which === 0) {
                this.display.putstr_message('You hear someone cursing shoplifters.');
            } else {
                this.display.putstr_message('You hear the chime of a cash register.');
            }
            return;
        }
        if (f.has_temple && !rn2(200)) { return; }
    }

    // Generate or retrieve a level (for stair traversal)
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

            // C ref: dog.c:474 mon_arrive — pet arrival on level change
            // Use real migration logic to preserve startup/replay fidelity.
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
export async function replaySession(seed, session, opts = {}) {
    if (typeof globalThis.window === 'undefined') {
        globalThis.window = {};
    }
    initrack(); // clear hero track buffer between sessions
    enableRngLog();
    initRng(seed);
    setGameSeed(seed);
    const replayRoleIndex = ROLE_INDEX[session.character?.role] ?? 11;

    // Consume pre-map character generation RNG calls if session has chargen data
    // C ref: role.c pick_gend() — happens during role selection BEFORE initLevelGeneration
    // Map generation happens in the "confirm-ok" step, so we consume RNG only
    // from steps before that (typically just pick-role with pick_gend call)
    let mapGenStepIndex = -1;
    if (session.chargen && session.chargen.length > 0) {
        // Find the confirm-ok step (map generation)
        mapGenStepIndex = session.chargen.findIndex(s => s.action === 'confirm-ok');

        // Consume RNG from steps before map generation (pick_gend, etc.)
        for (let i = 0; i < mapGenStepIndex && i < session.chargen.length; i++) {
            consumeRngEntries(session.chargen[i].rng || []);
        }
    }

    // Now initialize level generation (this may consume RNG for dungeon structure)
    initLevelGeneration(replayRoleIndex);

    const startDnum = Number.isInteger(opts.startDnum) ? opts.startDnum : undefined;
    const startDlevel = Number.isInteger(opts.startDlevel) ? opts.startDlevel : 1;
    const startDungeonAlign = Number.isInteger(opts.startDungeonAlign) ? opts.startDungeonAlign : undefined;
    const map = Number.isInteger(startDnum)
        ? makelevel(startDlevel, startDnum, startDlevel, { dungeonAlignOverride: startDungeonAlign })
        : makelevel(startDlevel, undefined, undefined, { dungeonAlignOverride: startDungeonAlign });
    // Note: wallification is now called inside makelevel, no need to call it here

    // Consume post-map character generation RNG calls (moveloop_preamble, etc.)
    // These happen after map gen but before gameplay starts
    if (mapGenStepIndex >= 0 && session.chargen) {
        for (let i = mapGenStepIndex + 1; i < session.chargen.length; i++) {
            consumeRngEntries(session.chargen[i].rng || []);
        }
    }

    // NOTE: Wizard mode (-D flag) enables omniscience for the PLAYER,
    // but does NOT make pets aware of trap locations (trap.tseen).
    // Traps are only seen when discovered during gameplay.
    // Removed automatic trap revelation here.

    const player = new Player();
    player.initRole(replayRoleIndex);
    player.wizard = true;
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
    const screen = getSessionScreenLines(session.startup || {});
    for (const line of screen) {
        if (!line) continue;
        const m = line.match(/St:([0-9/*]+)\s+Dx:(\d+)\s+Co:(\d+)\s+In:(\d+)\s+Wi:(\d+)\s+Ch:(\d+)/);
        if (m) {
            player._screenStrength = m[1];
            player.attributes[0] = m[1].includes('/') ? 18 : parseInt(m[1]); // A_STR
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

    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }

    const initResult = simulatePostLevelInit(player, map, 1);

    const startupLog = getRngLog();
    const startupRng = startupLog.map(toCompactRng);

    const game = new HeadlessGame(player, map, {
        seerTurn: initResult.seerTurn,
        startDnum,
        dungeonAlignOverride: startDungeonAlign,
    });
    game.display.flags.DECgraphics = session.screenMode === 'decgraphics';
    const firstStepScreen = getSessionScreenLines(session.steps?.[0] || {});
    let inTutorialPrompt = isTutorialPromptScreen(firstStepScreen);
    if (inTutorialPrompt && firstStepScreen.length > 0) {
        game.display.setScreenLines(firstStepScreen);
    }

    // Replay each step
    // C ref: allmain.c moveloop_core() step boundary analysis:
    //   Each step captures: rhack(player action) + context.move block (movemon + turnEnd)
    //   The context.move block runs AFTER rhack in the same moveloop_core iteration.
    //   This matches the JS ordering: rhack → movemon → turnEnd.
    //
    // One turn per keystroke: The C harness sends each character as a separate
    // tmux keystroke and captures RNG delta between keystrokes. Between captures,
    // execute_dumpmap sends '#dumpmap' which C's parse() treats as the command for
    // any accumulated count prefix — consuming it. So commands always execute with
    // multi=0, and each keystroke produces at most one turn of game effects.
    // Digit keystrokes ('0'-'9') are captured as separate steps with 0 RNG.
    const allSteps = session.steps || [];
    const maxSteps = Number.isInteger(opts.maxSteps)
        ? Math.max(0, Math.min(opts.maxSteps, allSteps.length))
        : allSteps.length;
    const stepResults = [];
    let pendingCommand = null;
    let pendingKind = null;
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
        const step = allSteps[stepIndex];
        const prevCount = getRngLog().length;
        const stepScreen = getSessionScreenLines(step);
        const stepMsg = stepScreen[0] || '';
        const isCapturedDipPrompt = stepMsg.startsWith('What do you want to dip into one of the potions of water?')
            && ((step.rng && step.rng.length) || 0) === 0;

        if (isCapturedDipPrompt && !pendingCommand) {
            game.display.setScreenLines(stepScreen);
            stepResults.push({
                rngCalls: 0,
                rng: [],
                screen: opts.captureScreens ? game.display.getScreenLines() : undefined,
            });
            continue;
        }

        // Keep blocking prompts/messages visible while waiting for more input.
        if (!pendingCommand) {
            game.display.clearRow(0);
            game.display.topMessage = null;
        }

        // C ref: startup tutorial yes/no prompt blocks normal gameplay input.
        // Invalid keys are ignored (no RNG/time). 'y' accepts tutorial and
        // generates tut-1 as a DoD special level.
        if (inTutorialPrompt) {
            const key = (step.key || '').toLowerCase();
            if (key === 'y') {
                const tutorialAlign = Number.isInteger(opts.tutorialDungeonAlign)
                    ? opts.tutorialDungeonAlign
                    : A_NONE;
                game.map = makelevel(1, TUTORIAL, 1, {
                    dungeonAlignOverride: tutorialAlign,
                });
                game.levels[1] = game.map;
                game.player.dungeonLevel = 1;
                game.placePlayerOnLevel();
                game.renderCurrentScreen();
                inTutorialPrompt = false;
            } else if (key === 'n') {
                inTutorialPrompt = false;
            } else if (stepScreen.length > 0) {
                // Keep the yes/no prompt UI visible across ignored keys.
                game.display.setScreenLines(stepScreen);
            }

            const fullLog = getRngLog();
            const stepLog = fullLog.slice(prevCount);
            stepResults.push({
                rngCalls: stepLog.length,
                rng: stepLog.map(toCompactRng),
                screen: opts.captureScreens ? game.display.getScreenLines() : undefined,
            });
            continue;
        }

        // C ref: cmd.c:4958 — digit keys start count prefix accumulation
        // In the session file, digits are recorded as separate steps with 0 RNG.
        // The count prefix is consumed by execute_dumpmap between steps, so the
        // actual command always runs with multi=0 (one turn per keystroke).
        const ch0 = step.key.charCodeAt(0);
        if (step.key.length === 1 && ch0 >= 48 && ch0 <= 57) { // '0'-'9'
            // Digit steps consume no RNG — just record empty result
            stepResults.push({
                rngCalls: 0,
                rng: [],
            });
            continue;
        }

        const ch = step.key.charCodeAt(0);
        let result = null;
        let capturedScreenOverride = null;

        if (pendingCommand) {
            // A previous command is blocked on nhgetch(); this step's key feeds it.
            for (let i = 0; i < step.key.length; i++) {
                pushInput(step.key.charCodeAt(i));
            }
            // C ref: doextcmd() accepts single-key shorthand after '#'.
            // Trace captures '#', then one key (e.g. 'O') without explicit Enter.
            if (pendingKind === 'extended-command' && step.key.length === 1) {
                pushInput(13);
            }
            const settled = await Promise.race([
                pendingCommand.then(v => ({ done: true, value: v })),
                new Promise(resolve => setTimeout(() => resolve({ done: false }), 0)),
            ]);
            if (!settled.done) {
                result = { moved: false, tookTime: false };
            } else {
                result = settled.value;
                pendingCommand = null;
                pendingKind = null;
            }
        } else {
            // Feed the key to the game engine
            // For multi-char keys (e.g. "wb" = wield item b), push trailing chars
            // into input queue so nhgetch() returns them immediately
            if (step.key.length > 1) {
                for (let i = 1; i < step.key.length; i++) {
                    pushInput(step.key.charCodeAt(i));
                }
            }

            // Execute the command once (one turn per keystroke)
            const commandPromise = rhack(ch, game);
            const settled = await Promise.race([
                commandPromise.then(v => ({ done: true, value: v })),
                new Promise(resolve => setTimeout(() => resolve({ done: false }), 0)),
            ]);

            if (!settled.done) {
                // Inventory display: capture shown menu screen for this step,
                // then dismiss it with SPACE like the C harness does after capture.
                const needsDismissal = ['i', 'I'].includes(String.fromCharCode(ch));
                if (needsDismissal) {
                    if (opts.captureScreens) {
                        capturedScreenOverride = game.display.getScreenLines();
                    }
                    pushInput(32);
                    const dismissed = await commandPromise;
                    result = dismissed || { moved: false, tookTime: false };
                } else {
                    // Command is waiting for additional input (direction/item/etc.).
                    // Defer resolution to subsequent captured step(s).
                    pendingCommand = commandPromise;
                    pendingKind = (ch === 35) ? 'extended-command' : null;
                    result = { moved: false, tookTime: false };
                }
            } else {
                result = settled.value;
            }
        }

        // C ref: cmd.c prefix commands (F=fight, G=run, g=rush) return without
        // consuming time or reading further input. For multi-char keys like "Fh",
        // the prefix is processed first, then we need to send the remaining char
        // as a separate command to actually perform the action.
        // Note: only actual prefix commands need this — other multi-char commands
        // like "oj" (open-south) or "wb" (wield-b) consume trailing chars via
        // nhgetch() internally.
        const PREFIX_CMDS = new Set(['F', 'G', 'g']);
        if (result && !result.tookTime && step.key.length > 1
            && PREFIX_CMDS.has(String.fromCharCode(ch))) {
            const nextCh = step.key.charCodeAt(1);
            result = await rhack(nextCh, game);
        }

        // If the command took time, run monster movement and turn effects
        if (result && result.tookTime) {
            settrack(game.player); // C ref: allmain.c — record hero position before movemon
            // C trace behavior: stair transitions consume time but do not run
            // immediate monster movement on the destination level in the same step.
            const isLevelTransition = step.action === 'descend' || step.action === 'ascend';
            if (!isLevelTransition) {
                movemon(game.map, game.player, game.display, game.fov);
            }
            game.simulateTurnEnd();

            // Run occupation continuation turns (multi-turn eating, etc.)
            // C ref: allmain.c moveloop_core() — occupation runs before next input
            while (game.occupation) {
                const cont = game.occupation.fn(game);
                if (!cont) {
                    game.occupation = null;
                }
                settrack(game.player);
                movemon(game.map, game.player, game.display, game.fov);
                game.simulateTurnEnd();

                // Sync HP each occupation turn (monsters may attack)
                const stepScreen = getSessionScreenLines(step);
                if (stepScreen.length > 0) {
                    for (const line of stepScreen) {
                        const hpm = line.match(/HP:(\d+)\((\d+)\)/);
                        if (hpm) {
                            game.player.hp = parseInt(hpm[1]);
                            game.player.hpmax = parseInt(hpm[2]);
                        }
                    }
                }
            }
        }

        // Sync player stats from session screen data.
        // JS doesn't fully model monster-to-player combat damage or healing,
        // so we use the authoritative screen state to keep HP/attributes in sync.
        if (stepScreen.length > 0) {
            for (const line of stepScreen) {
                const hpm = line.match(/HP:(\d+)\((\d+)\)/);
                if (hpm) {
                    game.player.hp = parseInt(hpm[1]);
                    game.player.hpmax = parseInt(hpm[2]);
                }
                const hpmPw = line.match(/HP:(\d+)\((\d+)\)\s+Pw:(\d+)\((\d+)\)\s+AC:([-]?\d+)/);
                if (hpmPw) {
                    game.player.hp = parseInt(hpmPw[1]);
                    game.player.hpmax = parseInt(hpmPw[2]);
                    game.player.pw = parseInt(hpmPw[3]);
                    game.player.pwmax = parseInt(hpmPw[4]);
                    game.player.ac = parseInt(hpmPw[5]);
                }
                const attrm = line.match(/St:([0-9/*]+)\s+Dx:(\d+)\s+Co:(\d+)\s+In:(\d+)\s+Wi:(\d+)\s+Ch:(\d+)/);
                if (attrm) {
                    game.player._screenStrength = attrm[1];
                    game.player.attributes[0] = attrm[1].includes('/') ? 18 : parseInt(attrm[1]); // A_STR
                    game.player.attributes[1] = parseInt(attrm[4]); // A_INT (In)
                    game.player.attributes[2] = parseInt(attrm[5]); // A_WIS (Wi)
                    game.player.attributes[3] = parseInt(attrm[2]); // A_DEX (Dx)
                    game.player.attributes[4] = parseInt(attrm[3]); // A_CON (Co)
                    game.player.attributes[5] = parseInt(attrm[6]); // A_CHA (Ch)
                }
            }
        }

        game.renderCurrentScreen();

        if (typeof opts.onStep === 'function') {
            opts.onStep({ stepIndex, step, game });
        }

        const fullLog = getRngLog();
        const stepLog = fullLog.slice(prevCount);
        stepResults.push({
            rngCalls: stepLog.length,
            rng: stepLog.map(toCompactRng),
            screen: opts.captureScreens ? (capturedScreenOverride || game.display.getScreenLines()) : undefined,
        });
    }

    // If session ends while a command is waiting for input, cancel it with ESC.
    if (pendingCommand) {
        pushInput(27);
        await pendingCommand;
    }

    const startupBurstInStep0 = hasStartupBurstInFirstStep(session);
    let normalizedStartup = { rngCalls: startupRng.length, rng: startupRng };
    if (startupBurstInStep0) {
        normalizedStartup = { rngCalls: 0, rng: [] };
        if (stepResults.length > 0) {
            stepResults[0] = {
                rngCalls: startupRng.length + stepResults[0].rngCalls,
                rng: startupRng.concat(stepResults[0].rng),
                screen: stepResults[0].screen,
            };
        }
    }

    disableRngLog();

    return {
        startup: normalizedStartup,
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

// ---------------------------------------------------------------------------
// HeadlessDisplay — grid-based display matching Display without DOM
// ---------------------------------------------------------------------------

const CLR_BLACK = 0;
const CLR_BROWN = 3;
const CLR_GRAY = 7;
const CLR_CYAN = 6;
const CLR_WHITE = 15;
const CLR_MAGENTA = 5;
const CLR_ORANGE = 9;
const CLR_RED = 1;

const TERRAIN_SYMBOLS_ASCII = {
    [STONE]:   { ch: ' ', color: CLR_GRAY },
    [VWALL]:   { ch: '|', color: CLR_GRAY },
    [HWALL]:   { ch: '-', color: CLR_GRAY },
    [TLCORNER]: { ch: '-', color: CLR_GRAY },
    [TRCORNER]: { ch: '-', color: CLR_GRAY },
    [BLCORNER]: { ch: '-', color: CLR_GRAY },
    [BRCORNER]: { ch: '-', color: CLR_GRAY },
    [CROSSWALL]: { ch: '-', color: CLR_GRAY },
    [TUWALL]:  { ch: '-', color: CLR_GRAY },
    [TDWALL]:  { ch: '-', color: CLR_GRAY },
    [TLWALL]:  { ch: '|', color: CLR_GRAY },
    [TRWALL]:  { ch: '|', color: CLR_GRAY },
    [DOOR]:    { ch: '+', color: CLR_BROWN },
    [CORR]:    { ch: '#', color: CLR_GRAY },
    [ROOM]:    { ch: '.', color: CLR_GRAY },
    [STAIRS]:  { ch: '<', color: CLR_GRAY },
    [FOUNTAIN]: { ch: '{', color: 12 },
    [THRONE]:  { ch: '\\', color: 11 },
    [SINK]:    { ch: '#', color: CLR_GRAY },
    [GRAVE]:   { ch: '|', color: CLR_WHITE },
    [ALTAR]:   { ch: '_', color: CLR_GRAY },
    [POOL]:    { ch: '}', color: 4 },
    [MOAT]:    { ch: '}', color: 4 },
    [WATER]:   { ch: '}', color: 12 },
    [LAVAPOOL]: { ch: '}', color: CLR_RED },
    [LAVAWALL]: { ch: '}', color: CLR_ORANGE },
    [ICE]:     { ch: '.', color: CLR_CYAN },
    [IRONBARS]: { ch: '#', color: CLR_CYAN },
    [TREE]:    { ch: '#', color: 2 },
    [DRAWBRIDGE_UP]:   { ch: '#', color: CLR_BROWN },
    [DRAWBRIDGE_DOWN]: { ch: '.', color: CLR_BROWN },
    [AIR]:     { ch: ' ', color: CLR_CYAN },
    [CLOUD]:   { ch: '#', color: CLR_GRAY },
    [SDOOR]:   { ch: '|', color: CLR_GRAY },
    [SCORR]:   { ch: ' ', color: CLR_GRAY },
};

const TERRAIN_SYMBOLS_DEC = {
    [STONE]:   { ch: ' ', color: CLR_GRAY },
    [VWALL]:   { ch: '\u2502', color: CLR_GRAY },
    [HWALL]:   { ch: '\u2500', color: CLR_GRAY },
    [TLCORNER]: { ch: '\u250c', color: CLR_GRAY },
    [TRCORNER]: { ch: '\u2510', color: CLR_GRAY },
    [BLCORNER]: { ch: '\u2514', color: CLR_GRAY },
    [BRCORNER]: { ch: '\u2518', color: CLR_GRAY },
    [CROSSWALL]: { ch: '\u253c', color: CLR_GRAY },
    [TUWALL]:  { ch: '\u2534', color: CLR_GRAY },
    [TDWALL]:  { ch: '\u252c', color: CLR_GRAY },
    [TLWALL]:  { ch: '\u2524', color: CLR_GRAY },
    [TRWALL]:  { ch: '\u251c', color: CLR_GRAY },
    [DOOR]:    { ch: '+', color: CLR_BROWN },
    [CORR]:    { ch: '#', color: CLR_GRAY },
    [ROOM]:    { ch: '\u00b7', color: CLR_GRAY },
    [STAIRS]:  { ch: '<', color: CLR_GRAY },
    [FOUNTAIN]: { ch: '{', color: 12 },
    [THRONE]:  { ch: '\\', color: 11 },
    [SINK]:    { ch: '#', color: CLR_GRAY },
    [GRAVE]:   { ch: '\u2020', color: CLR_WHITE },
    [ALTAR]:   { ch: '_', color: CLR_GRAY },
    [POOL]:    { ch: '\u2248', color: 4 },
    [MOAT]:    { ch: '\u2248', color: 4 },
    [WATER]:   { ch: '\u2248', color: 12 },
    [LAVAPOOL]: { ch: '\u2248', color: CLR_RED },
    [LAVAWALL]: { ch: '\u2248', color: CLR_ORANGE },
    [ICE]:     { ch: '\u00b7', color: CLR_CYAN },
    [IRONBARS]: { ch: '#', color: CLR_CYAN },
    [TREE]:    { ch: '#', color: 2 },
    [DRAWBRIDGE_UP]:   { ch: '#', color: CLR_BROWN },
    [DRAWBRIDGE_DOWN]: { ch: '\u00b7', color: CLR_BROWN },
    [AIR]:     { ch: ' ', color: CLR_CYAN },
    [CLOUD]:   { ch: '#', color: CLR_GRAY },
    [SDOOR]:   { ch: '\u2502', color: CLR_GRAY },
    [SCORR]:   { ch: ' ', color: CLR_GRAY },
};

// Headless display for testing chargen screen rendering.
// Same grid-based rendering as Display but without any DOM dependency.
// Now supports terminal attributes (inverse video, bold, underline).
export class HeadlessDisplay {
    constructor() {
        this.cols = TERMINAL_COLS;
        this.rows = TERMINAL_ROWS;
        this.grid = [];
        this.attrs = []; // Parallel grid for attributes
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            this.attrs[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = ' ';
                this.attrs[r][c] = 0; // 0 = normal
            }
        }
        this.topMessage = null; // Track current message for concatenation
        this.messages = []; // Message history
        this.flags = { msg_window: false, DECgraphics: false, lit_corridor: false }; // Default flags
        this.messageNeedsMore = false; // For message concatenation
    }

    setCell(col, row, ch, color = CLR_GRAY, attr = 0) {
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            this.grid[row][col] = ch;
            this.attrs[row][col] = attr;
        }
    }

    clearRow(row) {
        for (let c = 0; c < this.cols; c++) {
            this.grid[row][c] = ' ';
            this.attrs[row][c] = 0;
        }
    }

    clearScreen() {
        for (let r = 0; r < this.rows; r++) {
            this.clearRow(r);
        }
    }

    putstr(col, row, str, color = CLR_GRAY, attr = 0) {
        for (let i = 0; i < str.length; i++) {
            this.setCell(col + i, row, str[i], color, attr);
        }
    }

    putstr_message(msg) {
        // Add to message history
        if (msg.trim()) {
            this.messages.push(msg);
            if (this.messages.length > 20) {
                this.messages.shift();
            }
        }

        // C ref: win/tty/topl.c:264-267 — Concatenate messages if they fit
        const notDied = !msg.startsWith('You die');
        if (this.topMessage && this.messageNeedsMore && notDied) {
            const combined = this.topMessage + '  ' + msg;
            if (combined.length < this.cols) {
                this.clearRow(0);
                this.putstr(0, 0, combined.substring(0, this.cols));
                this.topMessage = combined;
                this.messageNeedsMore = true;
                return;
            }
        }

        this.clearRow(0);
        this.putstr(0, 0, msg.substring(0, this.cols));
        this.topMessage = msg;
        this.messageNeedsMore = true;
    }

    // Matches Display.renderChargenMenu() — always clears screen, applies offset
    // C ref: win/tty/wintty.c - menu headers use inverse video
    renderChargenMenu(lines, isFirstMenu) {
        let maxcol = 0;
        for (const line of lines) {
            if (line.length > maxcol) maxcol = line.length;
        }

        let offx = Math.max(10, Math.min(41, this.cols - maxcol - 2));
        if (isFirstMenu || offx === 10 || lines.length >= this.rows) {
            offx = 0;
        }

        this.clearScreen();

        // Render each line at the offset
        // C ref: role.c - headers like " Pick a role or profession" use inverse
        for (let i = 0; i < lines.length && i < this.rows; i++) {
            const line = lines[i];
            // First line (menu header) gets inverse video if it starts with space and contains text
            const isHeader = (i === 0 && line.trim().length > 0 && line.startsWith(' '));
            const attr = isHeader ? 1 : 0;  // 1 = inverse video
            this.putstr(offx, i, line, CLR_GRAY, attr);
        }

        return offx;
    }

    // Matches Display.renderOverlayMenu()
    renderOverlayMenu(lines) {
        let maxcol = 0;
        for (const line of lines) {
            if (line.length > maxcol) maxcol = line.length;
        }
        const offx = Math.max(10, Math.min(41, this.cols - maxcol - 2));

        // Clear only the overlay area.
        for (let r = 0; r < this.rows; r++) {
            for (let c = offx; c < this.cols; c++) {
                this.grid[r][c] = ' ';
                this.attrs[r][c] = 0;
            }
        }

        for (let i = 0; i < lines.length && i < this.rows; i++) {
            this.putstr(offx, i, lines[i], CLR_GRAY, 0);
        }
        return offx;
    }

    // Matches Display.renderLoreText()
    renderLoreText(lines, offx) {
        for (let i = 0; i < lines.length && i < this.rows; i++) {
            for (let c = offx; c < this.cols; c++) {
                this.grid[i][c] = ' ';
            }
            this.putstr(offx, i, lines[i]);
        }
        for (let i = lines.length; i < this.rows - 2; i++) {
            for (let c = offx; c < this.cols; c++) {
                this.grid[i][c] = ' ';
            }
        }
    }

    // Return 24-line string array matching C TTY screen format
    getScreenLines() {
        const result = [];
        for (let r = 0; r < this.rows; r++) {
            // Join chars, trim trailing spaces to match session format
            let line = this.grid[r].join('');
            // Right-trim spaces (C session screens are right-trimmed)
            line = line.replace(/ +$/, '');
            result.push(line);
        }
        return result;
    }

    // Overwrite the terminal grid from captured 24-line session text.
    setScreenLines(lines) {
        this.clearScreen();
        const src = Array.isArray(lines) ? lines : [];
        for (let r = 0; r < this.rows && r < src.length; r++) {
            const line = src[r] || '';
            for (let c = 0; c < this.cols && c < line.length; c++) {
                this.grid[r][c] = line[c];
                this.attrs[r][c] = 0;
            }
        }
    }

    // Return 24-line attribute array matching session format
    // Each line is 80 chars where each char is an attribute code:
    // '0' = normal, '1' = inverse, '2' = bold, '4' = underline
    getAttrLines() {
        const result = [];
        for (let r = 0; r < this.rows; r++) {
            // Convert numeric attrs to string, pad to 80 chars
            const attrLine = this.attrs[r].map(a => String(a)).join('').padEnd(80, '0');
            result.push(attrLine);
        }
        return result;
    }

    renderMap(gameMap, player, fov, flags = {}) {
        this.flags = { ...this.flags, ...flags };
        const mapOffset = this.flags.msg_window ? 3 : MAP_ROW_START;

        for (let y = 0; y < ROWNO; y++) {
            for (let x = 0; x < COLNO; x++) {
                const row = y + mapOffset;
                const col = x;

                if (!fov || !fov.canSee(x, y)) {
                    const loc = gameMap.at(x, y);
                    if (loc && loc.seenv) {
                        const sym = this.terrainSymbol(loc, gameMap, x, y);
                        this.setCell(col, row, sym.ch, CLR_BLACK);
                    } else {
                        this.setCell(col, row, ' ', CLR_GRAY);
                    }
                    continue;
                }

                const loc = gameMap.at(x, y);
                if (!loc) {
                    this.setCell(col, row, ' ', CLR_GRAY);
                    continue;
                }

                loc.seenv = 0xFF;

                if (player && x === player.x && y === player.y) {
                    this.setCell(col, row, '@', CLR_WHITE);
                    continue;
                }

                const mon = gameMap.monsterAt(x, y);
                if (mon) {
                    this.setCell(col, row, mon.displayChar, mon.displayColor);
                    continue;
                }

                const objs = gameMap.objectsAt(x, y);
                if (objs.length > 0) {
                    const topObj = objs[objs.length - 1];
                    this.setCell(col, row, topObj.displayChar, topObj.displayColor);
                    continue;
                }

                const trap = gameMap.trapAt(x, y);
                if (trap && trap.tseen) {
                    this.setCell(col, row, '^', CLR_MAGENTA);
                    continue;
                }

                const sym = this.terrainSymbol(loc, gameMap, x, y);
                this.setCell(col, row, sym.ch, sym.color);
            }
        }
    }

    renderStatus(player) {
        if (!player) return;

        const level = player.level || 1;
        const female = player.gender === 1;
        const rank = rankOf(level, player.roleIndex, female);
        const title = `${player.name} the ${rank}`;
        const strDisplay = player._screenStrength || player.strDisplay;
        const line1Parts = [];
        line1Parts.push(`St:${strDisplay}`);
        line1Parts.push(`Dx:${player.attributes[3]}`);
        line1Parts.push(`Co:${player.attributes[4]}`);
        line1Parts.push(`In:${player.attributes[1]}`);
        line1Parts.push(`Wi:${player.attributes[2]}`);
        line1Parts.push(`Ch:${player.attributes[5]}`);
        const alignStr = player.alignment < 0 ? 'Chaotic'
            : player.alignment > 0 ? 'Lawful' : 'Neutral';
        line1Parts.push(alignStr);
        if (player.score > 0) line1Parts.push(`S:${player.score}`);

        this.clearRow(STATUS_ROW_1);
        const line1 = `${title.padEnd(31)}${line1Parts.join(' ')}`;
        this.putstr(0, STATUS_ROW_1, line1.substring(0, this.cols), CLR_GRAY);

        const line2Parts = [];
        line2Parts.push(`Dlvl:${player.dungeonLevel}`);
        line2Parts.push(`$:${player.gold}`);
        line2Parts.push(`HP:${player.hp}(${player.hpmax})`);
        line2Parts.push(`Pw:${player.pw}(${player.pwmax})`);
        line2Parts.push(`AC:${player.ac}`);
        const expValue = Number.isFinite(player.exp) ? player.exp : 0;
        if (player.showExp) {
            line2Parts.push(expValue > 0 ? `Xp:${player.level}/${expValue}` : `Xp:${player.level}`);
        } else {
            line2Parts.push(`Exp:${player.level}`);
        }
        if (player.showTime) line2Parts.push(`T:${player.turns}`);
        if (player.hunger <= 50) line2Parts.push('Fainting');
        else if (player.hunger <= 150) line2Parts.push('Weak');
        else if (player.hunger <= 300) line2Parts.push('Hungry');
        if (player.blind) line2Parts.push('Blind');
        if (player.confused) line2Parts.push('Conf');
        if (player.stunned) line2Parts.push('Stun');
        if (player.hallucinating) line2Parts.push('Hallu');

        this.clearRow(STATUS_ROW_2);
        const line2 = line2Parts.join(' ');
        this.putstr(0, STATUS_ROW_2, line2.substring(0, this.cols), CLR_GRAY);

        const hpPct = player.hpmax > 0 ? player.hp / player.hpmax : 1;
        const hpColor = hpPct <= 0.15 ? CLR_RED
            : hpPct <= 0.33 ? CLR_ORANGE
                : CLR_GRAY;
        const hpStr = `HP:${player.hp}(${player.hpmax})`;
        const hpIdx = line2.indexOf(hpStr);
        if (hpIdx >= 0) {
            for (let i = 0; i < hpStr.length; i++) {
                this.setCell(hpIdx + i, STATUS_ROW_2, hpStr[i], hpColor);
            }
        }
    }

    // Render message window (for testing msg_window option)
    renderMessageWindow() {
        const MSG_WINDOW_ROWS = 3;
        // Clear message window area
        for (let r = 0; r < MSG_WINDOW_ROWS; r++) {
            this.clearRow(r);
        }

        // Show last 3 messages (most recent at bottom)
        if (!this.messages) this.messages = [];
        const recentMessages = this.messages.slice(-MSG_WINDOW_ROWS);
        for (let i = 0; i < recentMessages.length; i++) {
            const msg = recentMessages[i];
            const row = MSG_WINDOW_ROWS - recentMessages.length + i;
            if (msg.length <= this.cols) {
                this.putstr(0, row, msg.substring(0, this.cols));
            } else {
                // Truncate long messages
                this.putstr(0, row, msg.substring(0, this.cols - 3) + '...');
            }
        }
    }

    // Door orientation helper
    // C ref: display.c glyph_at() - door orientation affects symbol choice
    _isDoorHorizontal(gameMap, x, y) {
        if (!gameMap || x < 0 || y < 0) return false;

        // Check for walls to east and west (makes door horizontal)
        const hasWallEast = x + 1 < COLNO && IS_WALL(gameMap.at(x + 1, y)?.typ || 0);
        const hasWallWest = x - 1 >= 0 && IS_WALL(gameMap.at(x - 1, y)?.typ || 0);

        // If walls E/W, door is horizontal; otherwise vertical
        return hasWallEast || hasWallWest;
    }

    _determineWallType(gameMap, x, y) {
        if (!gameMap || x < 0 || y < 0) return VWALL;

        const N = y - 1 >= 0 && IS_WALL(gameMap.at(x, y - 1)?.typ || 0);
        const S = y + 1 < ROWNO && IS_WALL(gameMap.at(x, y + 1)?.typ || 0);
        const E = x + 1 < COLNO && IS_WALL(gameMap.at(x + 1, y)?.typ || 0);
        const W = x - 1 >= 0 && IS_WALL(gameMap.at(x - 1, y)?.typ || 0);

        if (N && W && !S && !E) return TLCORNER;
        if (N && E && !S && !W) return TRCORNER;
        if (S && W && !N && !E) return BLCORNER;
        if (S && E && !N && !W) return BRCORNER;
        if (N && S && E && !W) return TLWALL;
        if (N && S && W && !E) return TRWALL;
        if (E && W && N && !S) return TUWALL;
        if (E && W && S && !N) return TDWALL;
        if (N && S && E && W) return CROSSWALL;
        // Match C orientation semantics used by rm.horizontal:
        // E/W neighbors render as vertical walls, N/S as horizontal walls.
        if ((N || S) && !E && !W) return HWALL;
        if ((E || W) && !N && !S) return VWALL;
        return VWALL;
    }

    // Terrain symbol rendering for testing
    // C ref: defsym.h PCHAR definitions
    terrainSymbol(loc, gameMap = null, x = -1, y = -1) {
        const typ = loc.typ;
        const useDEC = this.flags.DECgraphics || false;
        const TERRAIN_SYMBOLS = useDEC ? TERRAIN_SYMBOLS_DEC : TERRAIN_SYMBOLS_ASCII;

        // Handle door states
        if (typ === DOOR) {
            if (loc.flags & D_ISOPEN) {
                // C ref: defsym.h:13-14 - Open doors use different symbols for vertical vs horizontal
                // S_vodoor (vertical open door): '-'  (walls N/S)
                // S_hodoor (horizontal open door): '|' (walls E/W)
                const isHorizontalDoor = this._isDoorHorizontal(gameMap, x, y);
                return useDEC
                    ? { ch: '\u00b7', color: CLR_BROWN }  // Middle dot for both in DECgraphics
                    : { ch: isHorizontalDoor ? '|' : '-', color: CLR_BROWN };
            } else if (loc.flags & D_CLOSED || loc.flags & D_LOCKED) {
                return { ch: '+', color: CLR_BROWN };
            } else {
                // Doorway: MIDDLE DOT for DEC, '.' for ASCII
                return useDEC
                    ? { ch: '\u00b7', color: CLR_GRAY }
                    : { ch: '.', color: CLR_GRAY };
            }
        }

        if (typ === STAIRS) {
            return loc.flags === 1
                ? { ch: '<', color: CLR_GRAY }
                : { ch: '>', color: CLR_GRAY };
        }

        // Handle altar alignment colors
        // C ref: display.h altar_color enum
        if (typ === ALTAR) {
            const align = loc.altarAlign !== undefined ? loc.altarAlign : 0;
            let altarColor;
            if (align === A_LAWFUL) {
                altarColor = 15;  // CLR_WHITE
            } else if (align === A_CHAOTIC) {
                altarColor = 0;   // CLR_BLACK
            } else {
                altarColor = CLR_GRAY;   // neutral or unaligned
            }
            return { ch: '_', color: altarColor };
        }

        // Handle secret doors (appear as walls)
        // C ref: display.c - secret doors render as walls in their orientation
        if (typ === SDOOR) {
            const wallType = this._determineWallType(gameMap, x, y);
            return TERRAIN_SYMBOLS[wallType] || TERRAIN_SYMBOLS[VWALL];
        }

        if (typ === CORR && this.flags.lit_corridor) {
            return { ch: '#', color: CLR_CYAN };
        }

        return TERRAIN_SYMBOLS[typ] || { ch: '?', color: CLR_MAGENTA };
    }
}
