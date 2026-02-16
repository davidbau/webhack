// headless_runtime.js -- Shared headless runtime for session tests and selfplay.

import { setInputRuntime } from './input.js';
import { initRng, rn2, rnd, rn1, enableRngLog, getRngLog, disableRngLog } from './rng.js';
import { exercise, exerchk, initExerciseState } from './attrib_exercise.js';
import { initLevelGeneration, makelevel, setGameSeed } from './dungeon.js';
import { simulatePostLevelInit, mon_arrive } from './u_init.js';
import { Player, rankOf, roles } from './player.js';
import { rhack } from './commands.js';
import { makemon } from './makemon.js';
import { movemon, initrack, settrack } from './monmove.js';
import { FOV } from './vision.js';
import { getArrivalPosition } from './level_transition.js';
import { doname } from './mkobj.js';
import {
    COLNO, ROWNO, NORMAL_SPEED,
    A_STR, A_DEX, A_CON,
    A_LAWFUL, A_CHAOTIC,
    ROOMOFFSET, SHOPBASE,
    TERMINAL_COLS, TERMINAL_ROWS,
    MAP_ROW_START, STATUS_ROW_1, STATUS_ROW_2,
    STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, STAIRS,
    IS_WALL, SDOOR, SCORR, IRONBARS,
    CORR, ROOM, DOOR,
    ALTAR, FOUNTAIN, THRONE, SINK, GRAVE, POOL, MOAT, WATER, LAVAPOOL,
    LAVAWALL, ICE, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, AIR, CLOUD, TREE,
    D_ISOPEN, D_CLOSED, D_LOCKED,
} from './config.js';

const DEFAULT_GAME_FLAGS = {
    pickup: false,
    verbose: false,
    safe_wait: true,
};

const SELFPLAY_GAME_FLAGS = {
    pickup: true,
    pickup_types: '',
    showexp: true,
    color: true,
    time: false,
    safe_pet: true,
    confirm: true,
    verbose: true,
    tombstone: true,
    rest_on_space: false,
    number_pad: false,
    lit_corridor: false,
};

const INVENTORY_CLASS_NAMES = {
    1: 'Weapons', 2: 'Armor', 3: 'Rings', 4: 'Amulets',
    5: 'Tools', 6: 'Comestibles', 7: 'Potions', 8: 'Scrolls',
    9: 'Spellbooks', 10: 'Wands', 11: 'Coins', 12: 'Gems/Stones',
};

const INVENTORY_ORDER = [11, 4, 1, 2, 6, 8, 9, 7, 3, 10, 5, 12, 13, 14, 15];

export function buildInventoryLines(player) {
    if (!player || player.inventory.length === 0) {
        return ['Not carrying anything.'];
    }

    const groups = {};
    for (const item of player.inventory) {
        const cls = item.oclass;
        if (!groups[cls]) groups[cls] = [];
        groups[cls].push(item);
    }

    const lines = [];
    for (const cls of INVENTORY_ORDER) {
        if (!groups[cls]) continue;
        lines.push(` ${INVENTORY_CLASS_NAMES[cls] || 'Other'}`);
        for (const item of groups[cls]) {
            lines.push(` ${item.invlet} - ${doname(item, player)}`);
        }
    }
    lines.push(' (end)');
    return lines;
}

export function createHeadlessInput({ throwOnEmpty = false } = {}) {
    const queue = [];
    let resolver = null;
    return {
        pushInput(ch) {
            if (resolver) {
                const resolve = resolver;
                resolver = null;
                resolve(ch);
            } else {
                queue.push(ch);
            }
        },
        clearInputQueue() {
            queue.length = 0;
        },
        getDisplay() {
            return null;
        },
        pushKey(ch) {
            this.pushInput(ch);
        },
        async nhgetch() {
            if (queue.length > 0) {
                return queue.shift();
            }
            if (throwOnEmpty) {
                throw new Error('Input queue empty - test may be missing keystrokes');
            }
            return await new Promise((resolve) => {
                resolver = resolve;
            });
        },
    };
}
export class HeadlessGame {
    constructor(player, map, opts = {}) {
        this.input = opts.input || createHeadlessInput();
        setInputRuntime(this.input);
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
        this.occupation = null; // C ref: cmd.c go.occupation — multi-turn action
        this.flags = { ...DEFAULT_GAME_FLAGS, ...(opts.flags || {}) }; // Game flags for commands
        this.menuRequested = false; // 'm' prefix command state
        initrack(); // C ref: track.c — initialize player track buffer
        this.renderCurrentScreen();
    }

    renderCurrentScreen() {
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov, this.flags);
        this.display.renderStatus(this.player);
    }

    _renderAll() {
        this.renderCurrentScreen();
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

        // Minimal C-faithful wounded-legs timer (set_wounded_legs): while active,
        // DEX stays penalized; recover when timeout expires.
        if ((this.player.woundedLegsTimeout || 0) > 0) {
            this.player.woundedLegsTimeout--;
            if (this.player.woundedLegsTimeout <= 0 && this.player.attributes) {
                this.player.woundedLegsTimeout = 0;
                this.player.attributes[A_DEX] = Math.min(25, this.player.attributes[A_DEX] + 1);
                this.player.justHealedLegs = true;
            }
        }

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
        if (!rn2(70) && !(this.map?.flags?.nomongen) && !(this.map?.flags?.is_tutorial)) {
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

        // C ref: attrib.c exerper() — periodic exercise updates.
        // C's svm.moves starts at 1 and increments before exerper/exerchk.
        const moves = this.turnCount + 1;
        if (moves % 10 === 0) {
            // C ref: attrib.c exerper() hunger switch
            if (this.player.hunger > 1000) {
                exercise(this.player, A_DEX, false);
            } else if (this.player.hunger > 150) {
                exercise(this.player, A_CON, true);
            } else if (this.player.hunger > 50) { // HUNGRY
                // no exercise
            } else if (this.player.hunger > 0) {
                exercise(this.player, A_STR, false);
            } else {
                exercise(this.player, A_CON, false);
            }
            // C ref: attrib.c exerper() role/behavioral hooks.
            // Minimal subset for replay parity:
            // - searches/trap handling already exercise WIS at action sites.
            // - resting encourages strength.
            if (this.player.restingTurn) {
                exercise(this.player, A_STR, true);
            }
        }
        if (moves % 5 === 0 && (this.player.woundedLegsTimeout || 0) > 0) {
            exercise(this.player, A_DEX, false);
        }

        // C ref: attrib.c exerchk()
        exerchk(this.player, moves);

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
        const playerInShop = (() => {
            const loc = this.map?.at?.(this.player.x, this.player.y);
            if (!loc || !Number.isFinite(loc.roomno)) return false;
            const ridx = loc.roomno - ROOMOFFSET;
            const room = this.map?.rooms?.[ridx];
            return !!(room && Number.isFinite(room.rtype) && room.rtype >= SHOPBASE);
        })();
        const tendedShop = (this.map?.monsters || []).some((m) => m && !m.dead && m.isshk);
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
            // C ref: sounds.c has_shop branch:
            // only choose a message (rn2(2)) when in a tended shop and
            // hero isn't currently inside any shop room.
            if (tendedShop && !playerInShop) {
                const which = rn2(2);
                if (which === 0) {
                    this.display.putstr_message('You hear someone cursing shoplifters.');
                } else {
                    this.display.putstr_message('You hear the chime of a cash register.');
                }
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

    placePlayerOnLevel(transitionDir = null) {
        const pos = getArrivalPosition(this.map, this.player.dungeonLevel, transitionDir);
        this.player.x = pos.x;
        this.player.y = pos.y;
    }
}

// Replay a gameplay session and return per-step RNG results.
// Returns { startup: { rngCalls, rng }, steps: [{ rngCalls, rng }] }

HeadlessGame.fromSeed = function fromSeed(seed, roleIndex = 11, opts = {}) {
    const input = opts.input || createHeadlessInput();
    setInputRuntime(input);

    initrack();
    initRng(seed);
    setGameSeed(seed);
    initLevelGeneration(roleIndex);

    const map = makelevel(1);

    const player = new Player();
    player.initRole(roleIndex);
    player.name = opts.name || 'Agent';
    player.gender = Number.isInteger(opts.gender) ? opts.gender : 0;
    if (Number.isInteger(opts.alignment)) {
        player.alignment = opts.alignment;
    }

    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }

    const initResult = simulatePostLevelInit(player, map, 1);

    const game = new HeadlessGame(player, map, {
        input,
        seerTurn: initResult?.seerTurn || 0,
        startDnum: opts.startDnum,
        dungeonAlignOverride: opts.dungeonAlignOverride,
    });
    game.seed = seed;
    game.roleIndex = roleIndex;
    game.wizard = !!opts.wizard;
    player.wizard = game.wizard;
    game.flags = { ...SELFPLAY_GAME_FLAGS, ...(opts.flags || {}) };
    game.display.flags.DECgraphics = opts.DECgraphics !== false;
    game.renderCurrentScreen();
    return game;
};

HeadlessGame.prototype.executeCommand = async function executeCommand(ch) {
    const code = typeof ch === 'string' ? ch.charCodeAt(0) : ch;
    const result = await rhack(code, this);

    if (result && result.tookTime) {
        movemon(this.map, this.player, this.display, this.fov);
        this.simulateTurnEnd();
    }

    this.fov.compute(this.map, this.player.x, this.player.y);
    this.display.renderMap(this.map, this.player, this.fov, this.flags);
    this.display.renderStatus(this.player);

    if (this.player.hp <= 0) {
        this.gameOver = true;
        this.gameOverReason = 'died';
    }

    return result;
};

// ---------------------------------------------------------------------------
// Core Replay API (Phase 1)
// ---------------------------------------------------------------------------

// Canonical async initialization path for replay and tests.
// options: { role, race, gender, align, name, wizard, DECgraphics, startDnum, dungeonAlignOverride }
HeadlessGame.start = async function start(seed, options = {}) {
    const roleIndex = Number.isInteger(options.roleIndex) ? options.roleIndex : 11;
    const game = HeadlessGame.fromSeed(seed, roleIndex, {
        name: options.name || 'Player',
        gender: options.gender,
        alignment: options.alignment,
        wizard: options.wizard !== false,
        startDnum: options.startDnum,
        dungeonAlignOverride: options.dungeonAlignOverride,
        DECgraphics: options.DECgraphics,
        flags: options.flags,
    });
    return game;
};

// Send a single key and execute one command/turn.
// Returns the command result (same as executeCommand).
HeadlessGame.prototype.sendKey = async function sendKey(key) {
    return this.executeCommand(key);
};

// Send multiple keys sequentially.
// Returns array of command results.
HeadlessGame.prototype.sendKeys = async function sendKeys(keys) {
    const results = [];
    for (const key of keys) {
        results.push(await this.sendKey(key));
    }
    return results;
};

// Extract the current level's typ grid (21x80 array of terrain type integers).
HeadlessGame.prototype.getTypGrid = function getTypGrid() {
    const grid = [];
    for (let y = 0; y < ROWNO; y++) {
        const row = [];
        for (let x = 0; x < COLNO; x++) {
            const loc = this.map.at(x, y);
            row.push(loc ? loc.typ : 0);
        }
        grid.push(row);
    }
    return grid;
};

// Get the current terminal screen as 24 lines of text.
HeadlessGame.prototype.getScreen = function getScreen() {
    return this.display.getScreenLines();
};

// Get the current terminal screen with ANSI escape codes.
// Currently returns plain text; ANSI support can be added later.
HeadlessGame.prototype.getAnsiScreen = function getAnsiScreen() {
    // Placeholder: return plain screen for now
    return this.display.getScreenLines();
};

// RNG Instrumentation
// Enable RNG call logging for replay fidelity checking.
HeadlessGame.prototype.enableRngLogging = function enableRngLogging(withTags = false) {
    enableRngLog(withTags);
};

// Get the current RNG log (array of call strings).
HeadlessGame.prototype.getRngLog = function getRngLogMethod() {
    return getRngLog();
};

// Clear the RNG log (for per-step capture).
HeadlessGame.prototype.clearRngLog = function clearRngLog() {
    // getRngLog returns the array directly; clearing means starting fresh
    const log = getRngLog();
    log.length = 0;
};

// Wizard Mode Helpers

// Teleport to a specific dungeon level (Ctrl+V equivalent).
// Generates the level if it doesn't exist.
HeadlessGame.prototype.teleportToLevel = function teleportToLevel(depth) {
    if (!this.wizard) {
        throw new Error('teleportToLevel requires wizard mode');
    }
    this.changeLevel(depth);
};

// Reveal the entire map (Ctrl+F equivalent for wizard mode).
HeadlessGame.prototype.revealMap = function revealMap() {
    if (!this.wizard) {
        throw new Error('revealMap requires wizard mode');
    }
    // Mark all cells as seen
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 0; x < COLNO; x++) {
            const loc = this.map.at(x, y);
            if (loc) {
                loc.seenv = 0xFF;
            }
        }
    }
    this.renderCurrentScreen();
};

// Capture a checkpoint of the current game state for debugging.
HeadlessGame.prototype.checkpoint = function checkpoint(phase = 'unknown') {
    return {
        phase,
        seed: this.seed,
        turnCount: this.turnCount,
        dungeonLevel: this.player.dungeonLevel,
        playerPos: { x: this.player.x, y: this.player.y },
        hp: this.player.hp,
        hpmax: this.player.hpmax,
        rngLog: this.getRngLog().slice(),
        typGrid: this.getTypGrid(),
        screen: this.getScreen(),
    };
};

// Generate multiple levels (1 to maxDepth) using wizard mode teleport.
// Returns { grids, rngLogs } where grids[depth] and rngLogs[depth] contain level data.
// This is the core path for map session testing, replacing generateMapsWithRng.
HeadlessGame.prototype.generateLevels = function generateLevels(maxDepth) {
    if (!this.wizard) {
        throw new Error('generateLevels requires wizard mode');
    }

    this.enableRngLogging();
    const grids = {};
    const rngLogs = {};
    let prevRngCount = this.getRngLog().length;

    for (let depth = 1; depth <= maxDepth; depth++) {
        // Use teleportToLevel which generates the level if needed
        this.teleportToLevel(depth);

        // Capture the typGrid for this level
        grids[depth] = this.getTypGrid();

        // Capture RNG log for this level
        const fullLog = this.getRngLog();
        const depthLog = fullLog.slice(prevRngCount);
        rngLogs[depth] = {
            rngCalls: depthLog.length,
            rng: depthLog.map((entry) => {
                // Strip count prefix: "1 rn2(...)=result" → "rn2(...)=result"
                if (typeof entry === 'string') {
                    return entry.replace(/^\d+\s+/, '');
                }
                return entry;
            }),
        };
        prevRngCount = fullLog.length;
    }

    return { grids, rngLogs };
};

// Factory for creating a game specifically for map generation testing.
// Initializes game in wizard mode with RNG logging enabled.
HeadlessGame.forMapGeneration = async function forMapGeneration(seed, roleIndex = 11) {
    const game = await HeadlessGame.start(seed, {
        roleIndex,
        wizard: true,
        name: 'MapTest',
    });
    return game;
};

// ---------------------------------------------------------------------------
// Map Generation API (Phase 2)
// ---------------------------------------------------------------------------

// Generate levels 1→maxDepth with RNG trace capture.
// This is the canonical core path for map session testing.
// Matches the C map test harness behavior: initRng → initLevelGeneration →
// makelevel sequence with pet arrival on depth > 1.
// Returns { grids, maps, rngLogs } where rngLogs[depth] = { rngCalls, rng }.
HeadlessGame.generateMapsWithRng = function generateMapsWithRng(seed, maxDepth, roleIndex = 11) {
    initrack(); // reset player track buffer between tests
    initRng(seed);
    setGameSeed(seed);
    enableRngLog();

    initLevelGeneration(roleIndex);
    const grids = {};
    const maps = {};
    const rngLogs = {};
    let harnessPlayer = null;
    let prevCount = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
        const previousMap = depth > 1 ? maps[depth - 1] : null;
        const map = makelevel(depth);

        grids[depth] = extractTypGridFromMap(map);
        maps[depth] = map;

        // C map harness runs a full game as Valkyrie. Depth 1 includes
        // post-level init (pet creation, hero inventory, attributes, welcome).
        // Depth 2+ includes pet arrival via wizard_level_teleport.
        if (depth === 1) {
            harnessPlayer = new Player();
            harnessPlayer.initRole(roleIndex);
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

        // Keep player position synchronized for adjacency checks.
        if (harnessPlayer) {
            if (map.upstair) {
                harnessPlayer.x = map.upstair.x;
                harnessPlayer.y = map.upstair.y;
            }
            harnessPlayer.dungeonLevel = depth;
        }

        const fullLog = getRngLog();
        const depthLog = fullLog.slice(prevCount);
        // Strip count prefix: "1 rn2(...)=result" → "rn2(...)=result"
        const compactRng = depthLog.map((entry) =>
            typeof entry === 'string' ? entry.replace(/^\d+\s+/, '') : entry
        );
        rngLogs[depth] = {
            rngCalls: compactRng.length,
            rng: compactRng,
        };
        prevCount = fullLog.length;
    }

    disableRngLog();
    return { grids, maps, rngLogs };
};

// Extract a typ grid from a map object: 21 rows of 80 integers.
// This is a static helper that can be used without a game instance.
function extractTypGridFromMap(map) {
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

// Export the helper for external use
export { extractTypGridFromMap };

// ---------------------------------------------------------------------------
// Startup Generation API (Phase 3)
// ---------------------------------------------------------------------------

// Build role name → index map
const ROLE_INDEX = {};
for (let i = 0; i < roles.length; i++) {
    ROLE_INDEX[roles[i].name] = i;
}

// Look up role index by name (returns 11/Valkyrie as default)
HeadlessGame.getRoleIndex = function getRoleIndex(roleName) {
    return ROLE_INDEX[roleName] ?? 11;
};

// Generate full startup with RNG trace capture.
// This is the canonical core path for chargen/startup session testing.
// Options: { roleIndex, name, gender, alignment, race, preStartupRngEntries }
// Returns { grid, map, player, rngCalls, rng }.
HeadlessGame.generateStartupWithRng = function generateStartupWithRng(seed, options = {}) {
    initrack(); // reset player track buffer between tests
    enableRngLog();
    initRng(seed);
    setGameSeed(seed);

    const roleIndex = options.roleIndex ?? 11; // default Valkyrie

    // Chargen sessions may have RNG consumed during character selection menus
    // (e.g., pick_align) before newgame() startup. Consume those first.
    const preStartupEntries = options.preStartupRngEntries || [];
    for (const entry of preStartupEntries) {
        consumeRngEntryHelper(entry);
    }

    initLevelGeneration(roleIndex);
    const map = makelevel(1);
    const grid = extractTypGridFromMap(map);

    // Set up player matching the character configuration
    const player = new Player();
    player.initRole(roleIndex);
    player.name = options.name || 'Wizard';
    player.gender = options.gender === 'female' ? 1 : (options.gender === 1 ? 1 : 0);

    // Set alignment if specified
    if (options.alignment !== undefined) {
        player.alignment = options.alignment;
    }

    // Set race if specified (default Human = 0)
    if (options.race !== undefined) {
        player.race = options.race;
    }

    // Place player at upstair
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

    // Strip pre-startup entries from the log
    const stripCount = preStartupEntries.length;
    const startupLog = fullLog.slice(stripCount);

    // Isolate chargen-only RNG (post-map: pet + inventory + attributes + welcome)
    const chargenLog = fullLog.slice(preChargenCount);

    // Compact the RNG entries (strip count prefix)
    const toCompact = (entry) =>
        typeof entry === 'string' ? entry.replace(/^\d+\s+/, '') : entry;

    return {
        grid,
        map,
        player,
        rngCalls: startupLog.length,
        rng: startupLog.map(toCompact),
        chargenRngCalls: chargenLog.length,
        chargenRng: chargenLog.map(toCompact),
    };
};

// ---------------------------------------------------------------------------
// Replay Step API (Phase 4)
// ---------------------------------------------------------------------------

// Execute a replay step with count prefix and continuation handling.
// This encapsulates the command execution semantics that belong in core.
// options: { countPrefix, skipMonsterMove, skipTurnEnd }
// Returns: { tookTime, result, screen, typGrid }
HeadlessGame.prototype.replayStep = async function replayStep(key, options = {}) {
    const ch = typeof key === 'string' ? key.charCodeAt(0) : key;

    // Handle count prefix if provided
    if (options.countPrefix && options.countPrefix > 0) {
        this.commandCount = options.countPrefix;
        this.multi = options.countPrefix;
        if (this.multi > 0) this.multi--;
        this.cmdKey = ch;
    } else {
        this.commandCount = 0;
        this.multi = 0;
    }

    // Execute the command
    const result = await rhack(ch, this);

    // Handle timed actions (monster movement and turn end)
    if (result && result.tookTime && !options.skipTurnEnd) {
        if (!options.skipMonsterMove) {
            settrack(this.player);
            movemon(this.map, this.player, this.display, this.fov);
        }
        this.simulateTurnEnd();

        // Handle occupation continuation (multi-turn actions like eating)
        while (this.occupation) {
            const occ = this.occupation;
            const cont = occ.fn(this);
            const finishedOcc = !cont ? occ : null;
            if (!cont) {
                this.occupation = null;
            }
            if (!options.skipMonsterMove) {
                settrack(this.player);
                movemon(this.map, this.player, this.display, this.fov);
            }
            this.simulateTurnEnd();
            if (finishedOcc && typeof finishedOcc.onFinishAfterTurn === 'function') {
                finishedOcc.onFinishAfterTurn(this);
            }
        }

        // Handle multi-count repeats (e.g., "10s" for 10 searches)
        while (this.multi > 0) {
            this.multi--;
            const repeated = await rhack(this.cmdKey, this);
            if (!repeated || !repeated.tookTime) break;
            if (!options.skipMonsterMove) {
                settrack(this.player);
                movemon(this.map, this.player, this.display, this.fov);
            }
            this.simulateTurnEnd();

            // Handle occupation in repeated commands
            while (this.occupation) {
                const occ = this.occupation;
                const cont = occ.fn(this);
                const finishedOcc = !cont ? occ : null;
                if (!cont) {
                    this.occupation = null;
                }
                if (!options.skipMonsterMove) {
                    settrack(this.player);
                    movemon(this.map, this.player, this.display, this.fov);
                }
                this.simulateTurnEnd();
                if (finishedOcc && typeof finishedOcc.onFinishAfterTurn === 'function') {
                    finishedOcc.onFinishAfterTurn(this);
                }
            }
        }
    }

    // Update display
    this.renderCurrentScreen();

    // Check for game over
    if (this.player.hp <= 0) {
        this.gameOver = true;
        this.gameOverReason = 'died';
    }

    return {
        tookTime: result?.tookTime || false,
        moved: result?.moved || false,
        result,
        screen: this.getScreen(),
        typGrid: this.getTypGrid(),
    };
};

// Check if a key is a count prefix digit (0-9)
HeadlessGame.isCountPrefixDigit = function isCountPrefixDigit(key) {
    const ch = typeof key === 'string' ? key.charCodeAt(0) : key;
    return ch >= 48 && ch <= 57; // '0'-'9'
};

// Parse count prefix from a key
HeadlessGame.parseCountPrefixDigit = function parseCountPrefixDigit(key) {
    const ch = typeof key === 'string' ? key.charCodeAt(0) : key;
    if (ch >= 48 && ch <= 57) {
        return ch - 48;
    }
    return null;
};

// Accumulate count prefix (used when building up multi-digit counts)
// Returns: { newCount, isDigit }
HeadlessGame.accumulateCountPrefix = function accumulateCountPrefix(currentCount, key) {
    const digit = HeadlessGame.parseCountPrefixDigit(key);
    if (digit !== null) {
        return {
            newCount: Math.min(32767, (currentCount * 10) + digit),
            isDigit: true,
        };
    }
    return { newCount: currentCount, isDigit: false };
};

// Helper to consume an RNG entry (replay RNG call from session)
function consumeRngEntryHelper(entry) {
    const atIdx = entry.indexOf(' @ ');
    const call = atIdx >= 0 ? entry.substring(0, atIdx) : entry;
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
    }
}

export function createHeadlessGame(seed, roleIndex = 11, opts = {}) {
    return HeadlessGame.fromSeed(seed, roleIndex, opts);
}

const CLR_BLACK = 0;
const CLR_BROWN = 3;
const CLR_GRAY = 7;
const CLR_CYAN = 6;
const CLR_WHITE = 15;
const CLR_MAGENTA = 5;
const CLR_ORANGE = 9;
const CLR_RED = 1;
const CLR_BRIGHT_BLUE = 12;

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
        this.colors = [];
        this.attrs = []; // Parallel grid for attributes
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            this.colors[r] = [];
            this.attrs[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = ' ';
                this.colors[r][c] = CLR_GRAY;
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
            this.colors[row][col] = color;
            this.attrs[row][col] = attr;
        }
    }

    clearRow(row) {
        for (let c = 0; c < this.cols; c++) {
            this.grid[row][c] = ' ';
            this.colors[row][c] = CLR_GRAY;
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

    async morePrompt(nhgetch) {
        const msg = this.topMessage || '';
        const moreStr = '--More--';
        const col = Math.min(msg.length, Math.max(0, this.cols - moreStr.length));
        this.putstr(col, 0, moreStr);
        await nhgetch();
        this.clearRow(0);
        this.messageNeedsMore = false;
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

        // Clear only the overlay area above status lines.
        for (let r = 0; r < STATUS_ROW_1; r++) {
            for (let c = offx; c < this.cols; c++) {
                this.grid[r][c] = ' ';
                this.colors[r][c] = CLR_GRAY;
                this.attrs[r][c] = 0;
            }
        }

        for (let i = 0; i < lines.length && i < STATUS_ROW_1; i++) {
            this.putstr(offx, i, lines[i], CLR_GRAY, 0);
        }
        return offx;
    }

    // Matches Display.renderLoreText()
    renderLoreText(lines, offx) {
        for (let i = 0; i < lines.length && i < this.rows; i++) {
            for (let c = offx; c < this.cols; c++) {
                this.grid[i][c] = ' ';
                this.colors[i][c] = CLR_GRAY;
            }
            this.putstr(offx, i, lines[i]);
        }
        for (let i = lines.length; i < this.rows - 2; i++) {
            for (let c = offx; c < this.cols; c++) {
                this.grid[i][c] = ' ';
                this.colors[i][c] = CLR_GRAY;
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
                this.colors[r][c] = CLR_GRAY;
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
                        if (loc.mem_obj) {
                            this.setCell(col, row, loc.mem_obj, CLR_BLACK);
                            continue;
                        }
                        if (loc.mem_trap) {
                            this.setCell(col, row, loc.mem_trap, CLR_BLACK);
                            continue;
                        }
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
                    const underObjs = gameMap.objectsAt(x, y);
                    if (underObjs.length > 0) {
                        const underTop = underObjs[underObjs.length - 1];
                        loc.mem_obj = underTop.displayChar || 0;
                    } else {
                        loc.mem_obj = 0;
                    }
                    this.setCell(col, row, mon.displayChar, mon.displayColor);
                    continue;
                }

                const objs = gameMap.objectsAt(x, y);
                if (objs.length > 0) {
                    const topObj = objs[objs.length - 1];
                    loc.mem_obj = topObj.displayChar || 0;
                    this.setCell(col, row, topObj.displayChar, topObj.displayColor);
                    continue;
                }
                loc.mem_obj = 0;

                const trap = gameMap.trapAt(x, y);
                if (trap && trap.tseen) {
                    loc.mem_trap = '^';
                    this.setCell(col, row, '^', CLR_MAGENTA);
                    continue;
                }
                loc.mem_trap = 0;

                // C ref: display.c back_to_glyph() — wizard mode shows
                // engravings with S_engroom ('`') / S_engrcorr ('#').
                if (player?.wizard) {
                    const engr = gameMap.engravingAt(x, y);
                    if (engr) {
                        const engrCh = (loc.typ === CORR || loc.typ === SCORR) ? '#' : '`';
                        loc.mem_obj = engrCh;
                        this.setCell(col, row, engrCh, CLR_BRIGHT_BLUE);
                        continue;
                    }
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
        // Straight wall orientation for secret-door rendering.
        // E/W neighbors => horizontal wall, N/S => vertical wall.
        if ((N || S) && !E && !W) return VWALL;
        if ((E || W) && !N && !S) return HWALL;
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
