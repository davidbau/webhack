// headless_runtime.js -- Shared headless runtime for session tests and selfplay.

import { setInputRuntime } from './input.js';
import {
    initRng,
    rn2,
    rnd,
    rn1,
    rnl,
    rne,
    rnz,
    d,
    enableRngLog,
    getRngLog as readRngLog,
    setRngCallCount,
} from './rng.js';
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
import { enexto } from './dungeon.js';
import {
    COLNO, ROWNO, NORMAL_SPEED,
    A_STR, A_DEX, A_CON,
    A_LAWFUL, A_CHAOTIC,
    RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC,
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

const ROLE_INDEX = {};
for (let i = 0; i < roles.length; i++) ROLE_INDEX[roles[i].name] = i;

const ALIGN_INDEX = {
    lawful: 1,
    neutral: 0,
    chaotic: -1,
};

const RACE_INDEX = {
    human: RACE_HUMAN,
    elf: RACE_ELF,
    dwarf: RACE_DWARF,
    gnome: RACE_GNOME,
    orc: RACE_ORC,
};

function normalizeRoleIndex(role, fallback = 11) {
    if (Number.isInteger(role)) return role;
    if (typeof role === 'string' && Object.hasOwn(ROLE_INDEX, role)) {
        return ROLE_INDEX[role];
    }
    return fallback;
}

function normalizeGender(gender, fallback = 0) {
    if (Number.isInteger(gender)) return gender;
    if (typeof gender === 'string') {
        if (gender.toLowerCase() === 'female') return 1;
        if (gender.toLowerCase() === 'male') return 0;
    }
    return fallback;
}

function normalizeAlignment(align) {
    if (Number.isInteger(align)) return align;
    if (typeof align === 'string') {
        const key = align.toLowerCase();
        if (Object.hasOwn(ALIGN_INDEX, key)) return ALIGN_INDEX[key];
    }
    return undefined;
}

function normalizeRace(race, fallback = RACE_HUMAN) {
    if (Number.isInteger(race)) return race;
    if (typeof race === 'string') {
        const key = race.toLowerCase();
        if (Object.hasOwn(RACE_INDEX, key)) return RACE_INDEX[key];
    }
    return fallback;
}

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

function isMidlogEntry(entry) {
    return typeof entry === 'string' && entry.length > 0 && (entry[0] === '>' || entry[0] === '<');
}

function isCompositeEntry(entry) {
    return typeof entry === 'string'
        && (entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d('));
}

function toCompactRng(entry) {
    if (isMidlogEntry(entry)) return entry;
    return String(entry || '').replace(/^\d+\s+/, '');
}

function rngCallPart(entry) {
    const atIdx = String(entry || '').indexOf(' @ ');
    return atIdx >= 0 ? String(entry).substring(0, atIdx) : String(entry || '');
}

export function generateMapsWithCoreReplay(seed, maxDepth, options = {}) {
    const targetDepth = Number.isInteger(maxDepth) ? maxDepth : 0;
    const grids = {};
    const maps = {};
    const rngLogs = {};
    if (targetDepth <= 0) return { grids, maps, rngLogs };

    enableRngLog(!!options.rngWithTags);
    const game = HeadlessGame.start(seed, {
        wizard: true,
        roleIndex: Number.isInteger(options.roleIndex) ? options.roleIndex : 11,
        startDnum: options.startDnum,
        startDlevel: 1,
        startDungeonAlign: options.startDungeonAlign,
        flags: options.flags,
    });

    for (let depth = 1; depth <= targetDepth; depth++) {
        if (depth > 1) {
            game.teleportToLevel(depth);
        }
        grids[depth] = game.getTypGrid();
        maps[depth] = game.map;
        const compact = game.getRngLog().map(toCompactRng);
        const filtered = compact.filter((entry) => {
            const call = rngCallPart(entry);
            return !isMidlogEntry(entry) && !isCompositeEntry(call);
        });
        rngLogs[depth] = {
            rngCalls: filtered.length,
            rng: filtered,
        };
        game.clearRngLog();
    }
    return { grids, maps, rngLogs };
}

function extractCharacterFromSession(session = {}) {
    const opts = session.options || session.meta?.options || {};
    return {
        name: opts.name,
        role: opts.role,
        race: opts.race,
        gender: opts.gender,
        align: opts.align,
    };
}

function getPreStartupRngEntries(session = {}) {
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
        const confirmIndex = session.chargen.findIndex((s) => s.action === 'confirm-ok');
        for (let i = 0; i < confirmIndex && i < session.chargen.length; i++) {
            out.push(...(session.chargen[i].rng || []));
        }
        return out;
    }
    return [];
}

function consumeRngEntry(entry) {
    const call = rngCallPart(String(entry || ''));
    const match = call.match(/^([a-z0-9_]+)\(([^)]*)\)=/i);
    if (!match) return;
    const fn = match[1];
    const args = match[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number.parseInt(s, 10));
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

export function generateStartupWithCoreReplay(seed, session, options = {}) {
    const rawSession = session || {};
    const char = extractCharacterFromSession(rawSession);
    const preStartupEntries = getPreStartupRngEntries(rawSession);

    enableRngLog(!!options.rngWithTags);
    initRng(seed);
    setGameSeed(seed);
    consumeRngEntries(preStartupEntries);

    const roleIndex = normalizeRoleIndex(char.role, 11);
    const game = HeadlessGame.fromSeed(seed, roleIndex, {
        preserveRngState: true,
        wizard: options.wizard !== false,
        name: char.name || options.name || 'Wizard',
        gender: normalizeGender(char.gender, 0),
        alignment: normalizeAlignment(char.align),
        race: normalizeRace(char.race, RACE_HUMAN),
        startDnum: options.startDnum,
        startDlevel: Number.isInteger(options.startDlevel) ? options.startDlevel : 1,
        dungeonAlignOverride: Number.isInteger(options.startDungeonAlign)
            ? options.startDungeonAlign
            : options.dungeonAlignOverride,
        DECgraphics: options.symbolMode !== 'ascii' && options.DECgraphics !== false,
    });

    const fullLog = game.getRngLog().map(toCompactRng);
    const stripCount = rawSession.type === 'chargen' ? preStartupEntries.length : 0;
    const startupRng = fullLog.slice(stripCount);

    return {
        game,
        map: game.map,
        player: game.player,
        grid: game.getTypGrid(),
        rngCalls: startupRng.length,
        rng: startupRng,
    };
}

export class HeadlessGame {
    constructor(player, map, opts = {}) {
        this.input = opts.input || createHeadlessInput();
        setInputRuntime(this.input);
        this.hooks = opts.hooks || {};
        this.player = player;
        initExerciseState(this.player);
        this.map = map;
        this.display = new HeadlessDisplay();
        this.fov = new FOV();
        const depth = this.player?.dungeonLevel || 1;
        this.levels = { [depth]: map };
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
        this.player.showExp = !!this.flags.showexp;
        this.player.showScore = !!this.flags.showscore;
        this.player.showTime = !!this.flags.time;
        this.menuRequested = false; // 'm' prefix command state
        this.lastHP = this.player?.hp;
        initrack(); // C ref: track.c — initialize player track buffer
        this.renderCurrentScreen();
    }

    static start(seed, options = {}) {
        const character = options.character || {};
        const roleValue = character.role ?? options.role ?? options.roleIndex;
        const roleIndex = normalizeRoleIndex(roleValue, 11);
        const gender = normalizeGender(character.gender ?? options.gender, 0);
        const alignment = normalizeAlignment(character.align ?? options.align ?? options.alignment);
        const race = normalizeRace(character.race ?? options.race, RACE_HUMAN);
        const name = character.name ?? options.name ?? (options.wizard ? 'Wizard' : 'Agent');
        return HeadlessGame.fromSeed(seed, roleIndex, {
            ...options,
            name,
            gender,
            alignment,
            race,
            wizard: !!options.wizard,
            startDnum: Number.isInteger(options.startDnum) ? options.startDnum : undefined,
            startDlevel: Number.isInteger(options.startDlevel) ? options.startDlevel : 1,
            dungeonAlignOverride: Number.isInteger(options.startDungeonAlign)
                ? options.startDungeonAlign
                : options.dungeonAlignOverride,
            DECgraphics: options.symbolMode !== 'ascii' && options.DECgraphics !== false,
            hooks: options.hooks || {},
        });
    }

    renderCurrentScreen() {
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov, this.flags);
        this.display.renderStatus(this.player);
    }

    _renderAll() {
        this.renderCurrentScreen();
    }

    getTypGrid() {
        const grid = [];
        for (let y = 0; y < ROWNO; y++) {
            const row = [];
            for (let x = 0; x < COLNO; x++) {
                const loc = this.map?.at?.(x, y);
                row.push(loc ? loc.typ : 0);
            }
            grid.push(row);
        }
        return grid;
    }

    getScreen() {
        return this.display.getScreenLines();
    }

    getAnsiScreen() {
        // The headless runtime stores plain terminal cells today.
        // Keep this method as a stable contract for session tooling.
        return this.getScreen().join('\n');
    }

    enableRngLogging(withTags = false) {
        enableRngLog(withTags);
    }

    getRngLog() {
        return [...(readRngLog() || [])];
    }

    clearRngLog() {
        const log = readRngLog();
        if (!log) return;
        log.length = 0;
        setRngCallCount(0);
    }

    checkpoint(phase = 'checkpoint') {
        return {
            phase,
            level: this.player?.dungeonLevel || 0,
            turn: this.turnCount,
            player: {
                x: this.player?.x ?? 0,
                y: this.player?.y ?? 0,
                hp: this.player?.hp ?? 0,
                hpmax: this.player?.hpmax ?? 0,
            },
            rng: this.getRngLog(),
            typGrid: this.getTypGrid(),
            screen: this.getScreen(),
        };
    }

    static isCountPrefixDigit(key) {
        const ch = typeof key === 'string' ? key.charCodeAt(0) : key;
        return ch >= 48 && ch <= 57;
    }

    static parseCountPrefixDigit(key) {
        const ch = typeof key === 'string' ? key.charCodeAt(0) : key;
        if (ch >= 48 && ch <= 57) return ch - 48;
        return null;
    }

    static accumulateCountPrefix(currentCount, key) {
        const digit = HeadlessGame.parseCountPrefixDigit(key);
        if (digit !== null) {
            return {
                isDigit: true,
                newCount: Math.min(32767, (currentCount * 10) + digit),
            };
        }
        return { isDigit: false, newCount: currentCount };
    }

    async sendKey(key, replayContext = {}) {
        const raw = typeof key === 'string' ? key : String.fromCharCode(key);
        if (!raw) {
            throw new Error('sendKey requires a non-empty key');
        }
        for (let i = 1; i < raw.length; i++) {
            this.input.pushInput(raw.charCodeAt(i));
        }
        return this.executeReplayStep(raw[0], replayContext);
    }

    async sendKeys(keys, replayContext = {}) {
        const out = [];
        const seq = Array.isArray(keys) ? keys : String(keys || '').split('');
        for (const key of seq) {
            out.push(await this.sendKey(key, replayContext));
        }
        return out;
    }

    async replayStep(key, options = {}) {
        const ch = typeof key === 'string' ? key.charCodeAt(0) : key;
        if (options.countPrefix && options.countPrefix > 0) {
            this.commandCount = options.countPrefix;
            this.multi = options.countPrefix;
            if (this.multi > 0) this.multi--;
            this.cmdKey = ch;
        } else {
            this.commandCount = 0;
            this.multi = 0;
        }

        const result = await rhack(ch, this);
        if (result && result.tookTime && !options.skipTurnEnd) {
            if (!options.skipMonsterMove) {
                settrack(this.player);
                movemon(this.map, this.player, this.display, this.fov, this);
            }
            this.simulateTurnEnd();

            while (this.occupation) {
                const occ = this.occupation;
                let interruptedOcc = false;
                const cont = occ.fn(this);
                const finishedOcc = !cont ? occ : null;
                if (this.shouldInterruptMulti()) {
                    this.multi = 0;
                    if (occ?.occtxt === 'waiting') {
                        this.display.putstr_message(`You stop ${occ.occtxt}.`);
                    }
                    this.occupation = null;
                    interruptedOcc = true;
                } else
                if (!cont) {
                    if (occ?.occtxt === 'waiting') {
                        this.display.putstr_message(`You stop ${occ.occtxt}.`);
                    }
                    this.occupation = null;
                }
                if (interruptedOcc) continue;
                if (!options.skipMonsterMove) {
                    settrack(this.player);
                    movemon(this.map, this.player, this.display, this.fov, this);
                }
                this.simulateTurnEnd();
                if (finishedOcc && typeof finishedOcc.onFinishAfterTurn === 'function') {
                    finishedOcc.onFinishAfterTurn(this);
                }
            }

            while (this.multi > 0) {
                // C ref: allmain.c lookaround() before each repeated command:
                // interrupting here should stop repetition without consuming time.
                if (typeof this.shouldInterruptMulti === 'function'
                    && this.shouldInterruptMulti()) {
                    this.multi = 0;
                    break;
                }
                this.multi--;
                const repeated = await rhack(this.cmdKey, this);
                if (!repeated || !repeated.tookTime) break;
                if (!options.skipMonsterMove) {
                    settrack(this.player);
                    movemon(this.map, this.player, this.display, this.fov, this);
                }
                this.simulateTurnEnd();
                while (this.occupation) {
                    const occ = this.occupation;
                    let interruptedOcc = false;
                    const cont = occ.fn(this);
                    const finishedOcc = !cont ? occ : null;
                    if (this.shouldInterruptMulti()) {
                        this.multi = 0;
                        if (occ?.occtxt === 'waiting') {
                            this.display.putstr_message(`You stop ${occ.occtxt}.`);
                        }
                        this.occupation = null;
                        interruptedOcc = true;
                    } else
                    if (!cont) {
                        if (occ?.occtxt === 'waiting') {
                            this.display.putstr_message(`You stop ${occ.occtxt}.`);
                        }
                        this.occupation = null;
                    }
                    if (interruptedOcc) continue;
                    if (!options.skipMonsterMove) {
                        settrack(this.player);
                        movemon(this.map, this.player, this.display, this.fov, this);
                    }
                    this.simulateTurnEnd();
                    if (finishedOcc && typeof finishedOcc.onFinishAfterTurn === 'function') {
                        finishedOcc.onFinishAfterTurn(this);
                    }
                }
            }
        }

        this.renderCurrentScreen();
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
    }

    async executeReplayStep(key, replayContext = {}) {
        const raw = typeof key === 'string' ? key : String.fromCharCode(key);
        if (!raw) {
            throw new Error('executeReplayStep requires a key');
        }
        const beforeCount = readRngLog()?.length || 0;
        if (typeof this.hooks.onStepStart === 'function') {
            this.hooks.onStepStart({ game: this, key: raw, context: replayContext });
        }
        const result = await this.replayStep(raw, replayContext);
        if (typeof this.hooks.onCommandResult === 'function') {
            this.hooks.onCommandResult({ game: this, keyCode: raw.charCodeAt(0), result: result.result });
        }
        if (result.tookTime && typeof this.hooks.onTurnAdvanced === 'function') {
            this.hooks.onTurnAdvanced({ game: this, keyCode: raw.charCodeAt(0), result: result.result });
        }
        if (typeof this.hooks.onScreenRendered === 'function') {
            this.hooks.onScreenRendered({ game: this, keyCode: raw.charCodeAt(0) });
        }
        const fullLog = readRngLog() || [];
        const stepRng = fullLog.slice(beforeCount);
        if (typeof this.hooks.onReplayPrompt === 'function' && this.occupation) {
            this.hooks.onReplayPrompt({ game: this, key: raw, context: replayContext });
        }
        return {
            key: raw,
            result,
            rng: stepRng,
            typGrid: this.getTypGrid(),
            screen: this.getScreen(),
            level: this.player?.dungeonLevel || 0,
            turn: this.turnCount,
        };
    }

    teleportToLevel(depth) {
        if (!this.player?.wizard) {
            return { ok: false, reason: 'wizard-disabled' };
        }
        if (!Number.isInteger(depth) || depth <= 0) {
            return { ok: false, reason: 'invalid-depth' };
        }
        this.changeLevel(depth, 'teleport');
        this.renderCurrentScreen();
        if (typeof this.hooks.onLevelChange === 'function') {
            this.hooks.onLevelChange({ game: this, depth });
        }
        return { ok: true, depth };
    }

    revealMap() {
        if (!this.map) return;
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 0; x < COLNO; x++) {
                const loc = this.map.at(x, y);
                if (loc) {
                    loc.seenv = 0xFF;
                    loc.lit = true;
                }
            }
        }
        this.renderCurrentScreen();
    }

    // C ref: allmain.c interrupt_multi() — check if multi-count should be interrupted
    // Interrupts search/wait/etc count when hostile monster appears adjacent.
    shouldInterruptMulti() {
        if ((this.runMode || 0) > 0) return false;

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

        if (this.lastHP !== undefined && this.player.hp !== this.lastHP) {
            this.lastHP = this.player.hp;
            return true;
        }
        this.lastHP = this.player.hp;
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

        // C ref: allmain.c:238 u_calc_moveamt(wtcap) — player movement allocation.
        // Fast intrinsic (monks, samurai): gain extra turn 1/3 of the time via rn2(3).
        // Very Fast (speed boots + intrinsic): gain extra turn 2/3 of the time.
        if (this.player.veryFast) {
            if (rn2(3) !== 0) { /* 2/3 chance */ }
        } else if (this.player.fast) {
            if (rn2(3) === 0) { /* 1/3 chance */ }
        }

        // C ref: allmain.c:289-295 regen_hp()
        let reachedFullHealth = false;
        if (this.player.hp < this.player.hpmax) {
            const con = this.player.attributes ? this.player.attributes[A_CON] : 10;
            const heal = (this.player.level + con) > rn2(100) ? 1 : 0;
            if (heal) {
                this.player.hp = Math.min(this.player.hp + heal, this.player.hpmax);
                reachedFullHealth = (this.player.hp === this.player.hpmax);
            }
        }
        // C ref: allmain.c regen_hp() -> interrupt_multi("You are in full health.")
        if (reachedFullHealth
            && this.multi > 0
            && !this.travelPath?.length
            && !this.runMode) {
            this.multi = 0;
            if (this.flags?.verbose !== false) {
                this.display.putstr_message('You are in full health.');
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
    resolveArrivalCollision() {
        const mtmp = this.map?.monsterAt?.(this.player.x, this.player.y);
        if (!mtmp || mtmp === this.player?.usteed) return;

        const moveMonsterNearby = () => {
            const pos = enexto(this.player.x, this.player.y, this.map);
            if (pos) {
                mtmp.mx = pos.x;
                mtmp.my = pos.y;
            }
        };

        // C ref: do.c u_collide_m() -- randomize whether hero or monster moves.
        if (!rn2(2)) {
            const cc = enexto(this.player.x, this.player.y, this.map);
            if (cc && Math.abs(cc.x - this.player.x) <= 1 && Math.abs(cc.y - this.player.y) <= 1) {
                this.player.x = cc.x;
                this.player.y = cc.y;
            } else {
                moveMonsterNearby();
            }
        } else {
            moveMonsterNearby();
        }

        const still = this.map?.monsterAt?.(this.player.x, this.player.y);
        if (!still) return;
        const fallback = enexto(this.player.x, this.player.y, this.map);
        if (fallback) {
            still.mx = fallback.x;
            still.my = fallback.y;
        } else {
            this.map.removeMonster(still);
        }
    }

    changeLevel(depth, transitionDir = null) {
        const fromX = this.player?.x;
        const fromY = this.player?.y;
        if (this.map) {
            this.levels[this.player.dungeonLevel] = this.map;
        }
        const previousMap = this.levels[this.player.dungeonLevel];
        let created = false;
        if (this.levels[depth]) {
            this.map = this.levels[depth];
        } else {
            this.map = Number.isInteger(this.dnum)
                ? makelevel(depth, this.dnum, depth, { dungeonAlignOverride: this.dungeonAlignOverride })
                : makelevel(depth, undefined, undefined, { dungeonAlignOverride: this.dungeonAlignOverride });
            this.levels[depth] = this.map;
            created = true;
        }
        this.player.dungeonLevel = depth;
        this.placePlayerOnLevel(transitionDir);
        // C ref: do.c goto_level(): u_on_rndspot()/u_on_newpos happens
        // before losedogs()->mon_arrive(), so follower arrival sees the
        // final hero position on the destination level.
        if (created && depth > 1) {
            mon_arrive(previousMap, this.map, this.player, {
                sourceHeroX: fromX,
                sourceHeroY: fromY,
                heroX: this.player.x,
                heroY: this.player.y,
            });
            this.resolveArrivalCollision();
        }
        this.renderCurrentScreen();
        if (typeof this.hooks.onLevelChange === 'function') {
            this.hooks.onLevelChange({ game: this, depth });
        }
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
    if (!opts.preserveRngState) {
        initRng(seed);
    }
    setGameSeed(seed);
    initLevelGeneration(roleIndex);

    const startDlevel = Number.isInteger(opts.startDlevel) ? opts.startDlevel : 1;
    const map = Number.isInteger(opts.startDnum)
        ? makelevel(startDlevel, opts.startDnum, startDlevel, { dungeonAlignOverride: opts.dungeonAlignOverride })
        : makelevel(startDlevel, undefined, undefined, { dungeonAlignOverride: opts.dungeonAlignOverride });

    const player = new Player();
    player.initRole(roleIndex);
    player.name = opts.name || 'Agent';
    player.gender = Number.isInteger(opts.gender) ? opts.gender : 0;
    player.race = normalizeRace(opts.race, player.race);
    if (Number.isInteger(opts.alignment)) {
        player.alignment = opts.alignment;
    }

    if (map.upstair) {
        player.x = map.upstair.x;
        player.y = map.upstair.y;
    }
    player.dungeonLevel = startDlevel;

    const initResult = simulatePostLevelInit(player, map, startDlevel);

    const game = new HeadlessGame(player, map, {
        input,
        seerTurn: initResult?.seerTurn || 0,
        startDnum: opts.startDnum,
        dungeonAlignOverride: opts.dungeonAlignOverride,
        hooks: opts.hooks,
    });
    game.seed = seed;
    game.roleIndex = roleIndex;
    game.wizard = !!opts.wizard;
    player.wizard = game.wizard;
    game.flags = { ...DEFAULT_GAME_FLAGS, ...SELFPLAY_GAME_FLAGS, ...(opts.flags || {}) };
    game.display.flags.DECgraphics = opts.DECgraphics !== false;
    game.renderCurrentScreen();
    return game;
};

HeadlessGame.prototype.executeCommand = async function executeCommand(ch) {
    const code = typeof ch === 'string' ? ch.charCodeAt(0) : ch;
    const result = await rhack(code, this);
    if (typeof this.hooks.onCommandResult === 'function') {
        this.hooks.onCommandResult({ game: this, keyCode: code, result });
    }

    if (result && result.tookTime) {
        movemon(this.map, this.player, this.display, this.fov, this);
        this.simulateTurnEnd();
        if (typeof this.hooks.onTurnAdvanced === 'function') {
            this.hooks.onTurnAdvanced({ game: this, keyCode: code, result });
        }
    }

    this.fov.compute(this.map, this.player.x, this.player.y);
    this.display.renderMap(this.map, this.player, this.fov, this.flags);
    this.display.renderStatus(this.player);
    if (typeof this.hooks.onScreenRendered === 'function') {
        this.hooks.onScreenRendered({ game: this, keyCode: code });
    }

    if (this.player.hp <= 0) {
        this.gameOver = true;
        this.gameOverReason = 'died';
    }

    return result;
};

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
        if (player.showScore && player.score > 0) line1Parts.push(`S:${player.score}`);

        this.clearRow(STATUS_ROW_1);
        const line1 = `${title.padEnd(31)}${line1Parts.join(' ')}`;
        this.putstr(0, STATUS_ROW_1, line1.substring(0, this.cols), CLR_GRAY);

        const line2Parts = [];
        line2Parts.push(`Dlvl:${player.dungeonLevel}`);
        line2Parts.push(`$:${player.gold}`);
        line2Parts.push(`HP:${player.hp}(${player.hpmax})`);
        line2Parts.push(`Pw:${player.pw}(${player.pwmax})`);
        line2Parts.push(`AC:${player.ac}`);
        if (player.showExp) {
            line2Parts.push(`Xp:${player.level}`);
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
