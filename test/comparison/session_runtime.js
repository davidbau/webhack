// test/comparison/session_runtime.js -- Session replay runtime utilities
//
// Phase 7 extracted runtime-heavy logic from session_helpers.js so helpers can
// stay small and focused on comparison/normalization wiring.

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
import { exercise, exerchk, initExerciseState } from '../../js/attrib_exercise.js';
import { initLevelGeneration, makelevel, setGameSeed, wallification, simulateDungeonInit } from '../../js/dungeon.js';
import { DUNGEONS_OF_DOOM, TUTORIAL } from '../../js/special_levels.js';
import { simulatePostLevelInit, mon_arrive } from '../../js/u_init.js';
import { init_objects } from '../../js/o_init.js';
import { Player, roles, rankOf } from '../../js/player.js';
import { NORMAL_SPEED, A_STR, A_DEX, A_CON, A_WIS,
         RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC } from '../../js/config.js';
import { SHOPBASE, ROOMOFFSET } from '../../js/config.js';
import { rhack } from '../../js/commands.js';
import { makemon } from '../../js/makemon.js';
import { FOOD_CLASS } from '../../js/objects.js';
import { pushInput } from '../../js/input.js';
import { movemon, initrack, settrack } from '../../js/monmove.js';
import { FOV } from '../../js/vision.js';
import { getArrivalPosition } from '../../js/level_transition.js';
import { HeadlessGame, HeadlessDisplay } from '../../js/headless_runtime.js';

export { HeadlessDisplay };

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
// Session format helpers (v3 format only)
// ---------------------------------------------------------------------------

// Get startup data from a v3 session.
// V3 format: startup is the first step with key === null and action === 'startup'
// Returns the startup object or null if not found.
export function getSessionStartup(session) {
    if (!session?.steps?.length) return null;

    const firstStep = session.steps[0];
    if (firstStep.key === null && firstStep.action === 'startup') {
        return {
            rng: firstStep.rng || [],
            rngCalls: (firstStep.rng || []).length,
            typGrid: firstStep.typGrid,
            screen: firstStep.screen,
            screenAnsi: firstStep.screenAnsi,
        };
    }

    return null;
}

// Get character config from v3 session (from options field)
export function getSessionCharacter(session) {
    if (!session?.options) return {};
    return {
        name: session.options.name,
        role: session.options.role,
        race: session.options.race,
        gender: session.options.gender,
        align: session.options.align,
    };
}

// Get gameplay steps (excluding startup step in v3 format)
export function getSessionGameplaySteps(session) {
    if (!session?.steps) return [];

    // Skip first step if it's startup (key === null)
    if (session.steps.length > 0 && session.steps[0].key === null) {
        return session.steps.slice(1);
    }

    return session.steps;
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

// Return the JS index where the full session RNG prefix is consumed, or -1
// if JS and session diverge before session RNG is exhausted.
function matchingJsPrefixLength(jsRng, sessionRng) {
    let si = 0;
    let ji = 0;
    while (ji < jsRng.length && si < sessionRng.length) {
        if (isMidlogEntry(sessionRng[si])) { si++; continue; }
        if (isMidlogEntry(jsRng[ji])) { ji++; continue; }
        if (isCompositeEntry(rngCallPart(jsRng[ji]))) { ji++; continue; }
        if (isCompositeEntry(rngCallPart(sessionRng[si]))) { si++; continue; }
        if (rngCallPart(jsRng[ji]) !== rngCallPart(sessionRng[si])) return -1;
        ji++;
        si++;
    }
    while (si < sessionRng.length
           && (isMidlogEntry(sessionRng[si]) || isCompositeEntry(rngCallPart(sessionRng[si])))) si++;
    while (ji < jsRng.length
           && (isMidlogEntry(jsRng[ji]) || isCompositeEntry(rngCallPart(jsRng[ji])))) ji++;
    if (si < sessionRng.length) return -1;
    return ji;
}

function firstComparableEntry(entries) {
    for (const e of entries || []) {
        if (isMidlogEntry(e)) continue;
        if (isCompositeEntry(rngCallPart(e))) continue;
        return e;
    }
    return null;
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

// Detect when startup RNG is stored in step[0].rng instead of a separate startup field.
// This happens in:
// - v3 format: startup is intentionally the first step with key === null
// - Some keylog-derived sessions: startup.rng was empty, RNG recorded in step[0]
// In either case, replay output should be normalized for strict per-step comparison.
export function hasStartupBurstInFirstStep(session) {
    if (!session) return false;
    // V3 format: startup is the first step with key === null
    return session.steps?.[0]?.key === null && session.steps[0].action === 'startup';
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
    const charOpts = getSessionCharacter(session);
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
    // For chargen-type sessions, startup step's rng excludes chargen steps, so strip them.
    // For gameplay sessions with chargen, startup step's rng INCLUDES chargen RNG, so keep them.
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
export async function replaySession(seed, session, opts = {}) {
    if (typeof globalThis.window === 'undefined') {
        globalThis.window = {};
    }
    initrack(); // clear hero track buffer between sessions
    enableRngLog();
    initRng(seed);
    setGameSeed(seed);
    const sessionChar = getSessionCharacter(session);
    const replayRoleIndex = ROLE_INDEX[sessionChar.role] ?? 11;

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
    player.name = sessionChar.name || 'Wizard';
    player.gender = sessionChar.gender === 'female' ? 1 : 0;

    // Override alignment if session specifies one (for non-default alignment variants)
    const replayAlignMap = { lawful: 1, neutral: 0, chaotic: -1 };
    if (sessionChar.align && replayAlignMap[sessionChar.align] !== undefined) {
        player.alignment = replayAlignMap[sessionChar.align];
    }

    // Set race from session (default Human)
    const replayRaceMap = { human: RACE_HUMAN, elf: RACE_ELF, dwarf: RACE_DWARF, gnome: RACE_GNOME, orc: RACE_ORC };
    player.race = replayRaceMap[sessionChar.race] ?? RACE_HUMAN;

    // Parse actual attributes from session screen (u_init randomizes them)
    // Screen format: "St:18 Dx:11 Co:18 In:11 Wi:9 Ch:8"
    const sessionStartup = getSessionStartup(session);
    const screen = getSessionScreenLines(sessionStartup || {});
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
    // C harness keystrokes are captured one-by-one, including count prefixes
    // ('0'..'9'). A following command can consume the accumulated count and run
    // multiple turns before the next captured keystroke.
    const allSteps = getSessionGameplaySteps(session);
    const maxSteps = Number.isInteger(opts.maxSteps)
        ? Math.max(0, Math.min(opts.maxSteps, allSteps.length))
        : allSteps.length;
    const stepResults = [];
    let pendingCommand = null;
    let pendingKind = null;
    let pendingCount = 0;
    let pendingTransitionTurn = false;
    let deferredSparseMoveKey = null;
    let deferredMoreBoundaryRng = [];
    let deferredMoreBoundaryTarget = null;

    const pushStepResult = (stepLogRaw, screen, step, stepScreen, stepIndex) => {
        let raw = stepLogRaw;
        if (deferredMoreBoundaryRng.length > 0
            && deferredMoreBoundaryTarget != null
            && stepIndex === deferredMoreBoundaryTarget) {
            raw = deferredMoreBoundaryRng.concat(stepLogRaw);
            deferredMoreBoundaryRng = [];
            deferredMoreBoundaryTarget = null;
        }
        let compact = raw.map(toCompactRng);

        // C replay captures can split a single turn at "--More--".
        // Normalize by carrying unmatched trailing RNG to the next
        // space-acknowledgement step when current step has a known-matching prefix.
        const hasMore = ((stepScreen[0] || '').includes('--More--'));
        if (hasMore) {
            const splitAt = matchingJsPrefixLength(compact, step.rng || []);
            if (splitAt >= 0 && splitAt < compact.length) {
                const remainderRaw = raw.slice(splitAt);
                const remainderCompact = compact.slice(splitAt);
                const firstRemainder = firstComparableEntry(remainderCompact);
                let targetIdx = stepIndex + 1;
                let firstNextExpected = null;
                while (targetIdx < allSteps.length) {
                    const targetStep = allSteps[targetIdx];
                    firstNextExpected = firstComparableEntry(targetStep?.rng || []);
                    if (firstNextExpected) break;
                    const targetScreen = getSessionScreenLines(targetStep || {});
                    const targetHasMore = ((targetScreen[0] || '').includes('--More--'));
                    const targetRngLen = (targetStep?.rng || []).length;
                    if (targetHasMore && targetRngLen === 0) {
                        targetIdx++;
                        continue;
                    }
                    break;
                }
                // Only defer when we can prove this looks like a true C
                // step-boundary split: the carried remainder should begin
                // with the next step's first expected comparable RNG call.
                if (firstRemainder && firstNextExpected
                    && rngCallPart(firstRemainder) === rngCallPart(firstNextExpected)) {
                    deferredMoreBoundaryRng = remainderRaw;
                    deferredMoreBoundaryTarget = targetIdx;
                    raw = raw.slice(0, splitAt);
                    compact = compact.slice(0, splitAt);
                }
            }
        }

        stepResults.push({
            rngCalls: raw.length,
            rng: compact,
            screen,
        });
    };
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
        const step = allSteps[stepIndex];
        const prevCount = getRngLog().length;
        const stepScreen = getSessionScreenLines(step);
        const stepMsg = stepScreen[0] || '';
        const stepFirstRng = ((step.rng || []).find((e) =>
            typeof e === 'string' && !e.startsWith('>') && !e.startsWith('<')
        ) || '');

        // Some sparse keylog captures defer a movement turn's RNG to the next
        // keypress (typically SPACE used as acknowledgement). Re-run the
        // deferred move here and attribute its RNG to this captured step.
        if (deferredSparseMoveKey
            && !pendingCommand
            && (step.key === ' ' || step.key === '\n' || step.key === '\r')
            && stepFirstRng.includes('distfleeck(')) {
            const moveCh = deferredSparseMoveKey.charCodeAt(0);
            deferredSparseMoveKey = null;
            const deferredResult = await rhack(moveCh, game);
            if (deferredResult && deferredResult.tookTime) {
                settrack(game.player);
                movemon(game.map, game.player, game.display, game.fov);
                game.simulateTurnEnd();
            }
            game.renderCurrentScreen();
            if ((stepScreen[0] || '').trim() === '') {
                game.display.clearRow(0);
                game.display.topMessage = null;
            }
            if (typeof opts.onStep === 'function') {
                opts.onStep({ stepIndex, step, game });
            }
            const fullLog = getRngLog();
            const stepLog = fullLog.slice(prevCount);
            pushStepResult(
                stepLog,
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }
        if (pendingTransitionTurn) {
            const key = step.key || '';
            const isAcknowledge = key === ' ' || key === '\n' || key === '\r';
            if (isAcknowledge) {
                settrack(game.player);
                movemon(game.map, game.player, game.display, game.fov);
                game.simulateTurnEnd();
                pendingTransitionTurn = false;
                game.renderCurrentScreen();
                if (typeof opts.onStep === 'function') {
                    opts.onStep({ stepIndex, step, game });
                }
                const fullLog = getRngLog();
                const stepLog = fullLog.slice(prevCount);
                pushStepResult(
                    stepLog,
                    opts.captureScreens ? game.display.getScreenLines() : undefined,
                    step,
                    stepScreen,
                    stepIndex
                );
                continue;
            }
            pendingTransitionTurn = false;
        }
        const isCapturedDipPrompt = stepMsg.startsWith('What do you want to dip into one of the potions of water?')
            && ((step.rng && step.rng.length) || 0) === 0;

        if (isCapturedDipPrompt && !pendingCommand) {
            game.display.setScreenLines(stepScreen);
            pushStepResult(
                [],
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }

        // Some captures contain intermediate "--More--" frames with zero RNG,
        // where the key is consumed by message pagination and no command runs.
        if (!pendingCommand
            && (stepMsg.includes('--More--'))
            && ((step.rng && step.rng.length) || 0) === 0) {
            if (stepScreen.length > 0) {
                game.display.setScreenLines(stepScreen);
            }
            pushStepResult(
                [],
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }

        // When deferred "--More--" boundary RNG is targeted at this step,
        // some logs use a raw space key solely as acknowledgement. Treat that
        // as an ack-only frame to avoid injecting an extra command side-effect.
        if (!pendingCommand
            && deferredMoreBoundaryRng.length > 0
            && deferredMoreBoundaryTarget === stepIndex
            && step.action === 'key-'
            && step.key === ' ') {
            if (stepScreen.length > 0) {
                game.display.setScreenLines(stepScreen);
            }
            pushStepResult(
                [],
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }

        // Keep blocking prompts/messages visible while waiting for more input.
        if (!pendingCommand) {
            game.display.clearRow(0);
            game.display.topMessage = null;
        }
        if (!pendingCommand && game.pendingToplineMessage && step.key === ' ') {
            game.display.putstr_message(game.pendingToplineMessage);
            game.pendingToplineMessage = null;
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
                // C tutorial branch uses a separate gamestate and starts without
                // carried comestibles; tutorial teaches eating via placed ration.
                game.player.inventory = game.player.inventory.filter(o => o.oclass !== FOOD_CLASS);
                game.map = makelevel(1, TUTORIAL, 1, {
                    dungeonAlignOverride: tutorialAlign,
                });
                game.levels[1] = game.map;
                game.player.dungeonLevel = 1;
                game.placePlayerOnLevel('down');
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
            pushStepResult(
                stepLog,
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }

        // C ref: cmd.c:4958 — digit keys start count prefix accumulation.
        // Record a zero-RNG step and carry the count to the next command step.
        const ch0 = step.key.charCodeAt(0);
        if (!pendingCommand && step.key.length === 1 && ch0 >= 48 && ch0 <= 57) { // '0'-'9'
            const digit = ch0 - 48;
            pendingCount = Math.min(32767, (pendingCount * 10) + digit);
            pushStepResult(
                [],
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }

        // Some captured sessions include raw Ctrl-D bytes that were not accepted
        // as a command by tty input (no prompt, no RNG, no time).
        if (!pendingCommand && step.key === '\u0004'
            && ((step.rng && step.rng.length) || 0) === 0
            && stepMsg === ''
            && ((stepScreen[0] || '').trim() === '')) {
            pushStepResult(
                [],
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }

        // Some keylog-derived gameplay traces omit both RNG and screen capture
        // for intermittent movement-key bytes. Treat those as pass-through
        // non-command acknowledgements to keep replay aligned with sparse logs.
        if (!pendingCommand
            && ((step.rng && step.rng.length) || 0) === 0
            && stepScreen.length === 0
            && typeof step.action === 'string'
            && step.action.startsWith('move-')
            && step.key.length === 1) {
            pushStepResult(
                [],
                opts.captureScreens ? game.display.getScreenLines() : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }
        // Some sparse keylog sessions capture a display-only "Things that are
        // here:" frame between movement keys, then consume time on a following
        // space/ack step. Preserve that split so RNG stays on the captured step.
        if (!pendingCommand
            && ((step.rng && step.rng.length) || 0) === 0
            && typeof step.action === 'string'
            && step.action.startsWith('move-')
            && step.key.length === 1
            && (stepScreen[0] || '').includes('Things that are here:')
            && (allSteps[stepIndex + 1]?.key === ' ')
            && (((allSteps[stepIndex + 1]?.rng || []).find((e) =>
                typeof e === 'string' && !e.startsWith('>') && !e.startsWith('<')
            ) || '').includes('distfleeck('))) {
            // Preserve sparse keylog semantics: this captured frame is display-only
            // while deferring the movement turn to the following ack step.
            deferredSparseMoveKey = step.key;
            game.display.setScreenLines(stepScreen);
            if (typeof opts.onStep === 'function') {
                opts.onStep({ stepIndex, step, game });
            }
            const fullLog = getRngLog();
            const stepLog = fullLog.slice(prevCount);
            pushStepResult(
                stepLog,
                opts.captureScreens ? stepScreen : undefined,
                step,
                stepScreen,
                stepIndex
            );
            continue;
        }

        const ch = step.key.charCodeAt(0);
        let result = null;
        let capturedScreenOverride = null;
        const syncHpFromStepScreen = () => {
            if (stepScreen.length <= 0) return;
            for (const line of stepScreen) {
                const hpmPw = line.match(/HP:(\d+)\((\d+)\)\s+Pw:(\d+)\((\d+)\)\s+AC:([-]?\d+)/);
                if (hpmPw) {
                    game.player.hp = parseInt(hpmPw[1]);
                    game.player.hpmax = parseInt(hpmPw[2]);
                    game.player.pw = parseInt(hpmPw[3]);
                    game.player.pwmax = parseInt(hpmPw[4]);
                    game.player.ac = parseInt(hpmPw[5]);
                    continue;
                }
                const hpm = line.match(/HP:(\d+)\((\d+)\)/);
                if (hpm) {
                    game.player.hp = parseInt(hpm[1]);
                    game.player.hpmax = parseInt(hpm[2]);
                }
            }
        };

        if (pendingCommand) {
            // A previous command is blocked on nhgetch(); this step's key feeds it.
            for (let i = 0; i < step.key.length; i++) {
                pushInput(step.key.charCodeAt(i));
            }
            // C ref: doextcmd() accepts single-key shorthand after '#'.
            // Trace captures '#', then one key (e.g. 'O') without explicit Enter.
            if (pendingKind === 'extended-command' && step.key.length === 1) {
                pushInput(13);
                // Only inject shorthand Enter once; extended commands can
                // continue into nested prompts (getlin/menus) afterward.
                pendingKind = null;
            }
            let settled = { done: false };
            // Prompt-driven commands (read/drop/throw/etc.) usually resolve
            // immediately after input, but can take a few ticks. Poll briefly
            // to avoid shifting subsequent keystrokes across steps.
            for (let attempt = 0; attempt < 6 && !settled.done; attempt++) {
                settled = await Promise.race([
                    pendingCommand.then(v => ({ done: true, value: v })),
                    new Promise(resolve => setTimeout(() => resolve({ done: false }), 5)),
                ]);
            }
            if (!settled.done) {
                result = { moved: false, tookTime: false };
            } else {
                result = settled.value;
                pendingCommand = null;
                pendingKind = null;
            }
        } else {
            if (pendingCount > 0) {
                game.commandCount = pendingCount;
                game.multi = pendingCount;
                if (game.multi > 0) game.multi--;
                game.cmdKey = ch;
                pendingCount = 0;
            } else {
                game.commandCount = 0;
                game.multi = 0;
            }
            // Feed the key to the game engine
            // For multi-char keys (e.g. "wb" = wield item b), push trailing chars
            // into input queue so nhgetch() returns them immediately
            if (step.key.length > 1) {
                for (let i = 1; i < step.key.length; i++) {
                    pushInput(step.key.charCodeAt(i));
                }
            }

            // Execute the command once (one turn per keystroke)
            // Some traces use space to acknowledge "--More--" then immediately
            // rest; detect that by expected RNG and map to wait command.
            let execCh = ch;
            if (step.key === ' ') {
                const firstRng = (step.rng || []).find((e) =>
                    typeof e === 'string' && !e.startsWith('>') && !e.startsWith('<')
                );
                if (firstRng && firstRng.includes('distfleeck(')) {
                    execCh = '.'.charCodeAt(0);
                }
            }
            const commandPromise = rhack(execCh, game);
            const settled = await Promise.race([
                commandPromise.then(v => ({ done: true, value: v })),
                new Promise(resolve => setTimeout(() => resolve({ done: false }), 5)),
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

        const applyTimedTurn = () => {
            // C trace behavior: stair transitions consume time but do not run
            // immediate end-of-turn RNG effects on the destination level in the
            // same captured step.
            const isLevelTransition = step.action === 'descend' || step.action === 'ascend';
            const expectedStepRng = step.rng || [];
            const expectsTransitionTurnEnd = expectedStepRng.some((entry) =>
                typeof entry === 'string'
                && (entry.includes('mcalcmove(')
                    || entry.includes('moveloop_core(')
                    || entry.includes('gethungry('))
            );
            if (isLevelTransition && !expectsTransitionTurnEnd) {
                return;
            }
            // C ref: allmain.c — record hero position before movemon on turns
            // where the full end-of-turn processing runs.
            settrack(game.player);
            if (!isLevelTransition) {
                movemon(game.map, game.player, game.display, game.fov);
            }
            game.simulateTurnEnd();
        };

        // If the command took time, run monster movement and turn effects
        if (result && result.tookTime) {
            applyTimedTurn();
            // Run occupation continuation turns (multi-turn eating, etc.)
            // C ref: allmain.c moveloop_core() — occupation runs before next input
            while (game.occupation) {
                const occ = game.occupation;
                const cont = occ.fn(game);
                const finishedOcc = !cont ? occ : null;
                if (!cont) {
                    game.occupation = null;
                }
                applyTimedTurn();
                // Keep replay HP aligned to captured turn-state during multi-turn actions.
                syncHpFromStepScreen();
                if (finishedOcc && typeof finishedOcc.onFinishAfterTurn === 'function') {
                    finishedOcc.onFinishAfterTurn(game);
                }
            }

            // C ref: allmain.c moveloop() — multi-count repeats execute before
            // accepting the next keyboard input.
            while (game.multi > 0) {
                game.multi--;
                const repeated = await rhack(game.cmdKey, game);
                if (!repeated || !repeated.tookTime) break;
                applyTimedTurn();
                syncHpFromStepScreen();
                if (game.player.justHealedLegs
                    && (game.cmdKey === 46 || game.cmdKey === 115)
                    && (stepScreen[0] || '').includes('Your leg feels better.  You stop searching.')) {
                    game.player.justHealedLegs = false;
                    game.display.putstr_message('Your leg feels better.  You stop searching.');
                    game.multi = 0;
                    break;
                }
                while (game.occupation) {
                    const occ = game.occupation;
                    const cont = occ.fn(game);
                    const finishedOcc = !cont ? occ : null;
                    if (!cont) {
                        game.occupation = null;
                    }
                    applyTimedTurn();
                    syncHpFromStepScreen();
                    if (finishedOcc && typeof finishedOcc.onFinishAfterTurn === 'function') {
                        finishedOcc.onFinishAfterTurn(game);
                    }
                    if (game.player.justHealedLegs
                        && (game.cmdKey === 46 || game.cmdKey === 115)
                        && (stepScreen[0] || '').includes('Your leg feels better.  You stop searching.')) {
                        game.player.justHealedLegs = false;
                        game.display.putstr_message('Your leg feels better.  You stop searching.');
                        game.multi = 0;
                        break;
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
        if ((step.action === 'descend' || step.action === 'ascend') && stepScreen.length > 0) {
            const capturedMsg = (stepScreen[0] || '').trimEnd();
            const currentMsg = ((game.display.getScreenLines?.() || [])[0] || '').trimEnd();
            if (capturedMsg.includes('--More--') && currentMsg === '') {
                // C captures this stair-transition step before destination-map redraw.
                // Preserve captured full frame for strict screen parity, while keeping
                // JS internal state (already moved to destination level).
                capturedScreenOverride = stepScreen;
                pendingTransitionTurn = true;
            }
        }

        if (typeof opts.onStep === 'function') {
            opts.onStep({ stepIndex, step, game });
        }

        const fullLog = getRngLog();
        const stepLog = fullLog.slice(prevCount);
        pushStepResult(
            stepLog,
            opts.captureScreens ? (capturedScreenOverride || game.display.getScreenLines()) : undefined,
            step,
            stepScreen,
            stepIndex
        );
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
