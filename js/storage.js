// storage.js -- Browser localStorage persistence
// Mirrors C NetHack's save.c / restore.c function hierarchy.
// All save/restore functions live here so they can be compared
// side-by-side with their C counterparts.
//
// Save hierarchy (C ref):              Restore hierarchy (C ref):
// ─────────────────────                ──────────────────────────
// buildSaveData (dosave0)              restoreFromSave (dorecover)
//  ├─ saveLev (savelev)                 ├─ restLev (getlev)
//  │   ├─ saveMonChn (savemonchn)       │   ├─ restMonChn
//  │   │   └─ saveMon (savemon)         │   │   └─ restMon
//  │   │       └─ saveObjChn            │   │       └─ restObjChn
//  │   ├─ saveTrapChn (savetrapchn)     │   ├─ restTrapChn
//  │   └─ saveObjChn (saveobjchn)       │   └─ restObjChn
//  │       └─ saveObj (saveobj)         │       └─ restObj
//  └─ saveGameState (savegamestate)     └─ restGameState (restgamestate)
//      ├─ saveYou (Sfo_you)                 ├─ restYou (Sfi_you)
//      └─ saveObjChn (inventory)            └─ restObjChn (inventory)

import { mons } from './monsters.js';
import { def_monsyms } from './symbols.js';
import { CLASS_SYMBOLS } from './objects.js';
import { COLNO, ROWNO } from './config.js';
import { Player } from './player.js';
import { GameMap, makeRoom } from './map.js';

const SAVE_KEY = 'webhack-save';
const BONES_KEY_PREFIX = 'webhack-bones-';
const OPTIONS_KEY = 'webhack-options';
const TOPTEN_KEY = 'webhack-topten';
const SAVE_VERSION = 2;

// Safe localStorage access -- returns null when unavailable (e.g. Node.js tests)
function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; }
    catch (e) { return null; }
}

// ========================================================================
// Object save/restore -- C ref: save.c saveobj() / restore.c restobj()
// ========================================================================

// C ref: saveobj() — strip derived display fields, recurse contents
export function saveObj(obj) {
    const data = { ...obj };
    delete data.displayChar;
    if (data.contents && data.contents.length > 0) {
        data.contents = saveObjChn(data.contents);
    }
    return data;
}

// C ref: saveobjchn() — save a chain of objects
export function saveObjChn(list) {
    return (list || []).map(saveObj);
}

// C ref: restobj() — rebuild displayChar from oclass, recurse contents
export function restObj(data) {
    const obj = { ...data };
    obj.displayChar = CLASS_SYMBOLS[obj.oclass] || '?';
    if (obj.contents && obj.contents.length > 0) {
        obj.contents = restObjChn(obj.contents);
    }
    return obj;
}

// C ref: restobjchn() — restore a chain of objects
export function restObjChn(list) {
    return (list || []).map(restObj);
}

// ========================================================================
// Monster save/restore -- C ref: save.c savemon() / restore.c restmon()
// ========================================================================

// C ref: savemon() — strip derived references, save inventory chain
export function saveMon(mon) {
    const data = { ...mon };
    // Remove derived references -- rebuilt from mndx on restore
    delete data.type;
    delete data.attacks;
    delete data.displayChar;
    delete data.displayColor;
    // Save monster inventory (pets carry items)
    if (data.minvent && data.minvent.length > 0) {
        data.minvent = saveObjChn(data.minvent);
    }
    return data;
}

// C ref: savemonchn() — save a chain of monsters
export function saveMonChn(list) {
    return (list || []).map(saveMon);
}

// C ref: restmon() — rebuild type/attacks/display from mndx, restore inventory
export function restMon(data) {
    const mon = { ...data };
    const ptr = mons[mon.mndx];
    mon.type = ptr;
    mon.attacks = ptr.attacks;
    const symEntry = def_monsyms[ptr.symbol];
    mon.displayChar = symEntry ? symEntry.sym : '?';
    mon.displayColor = ptr.color;
    // Restore monster inventory
    if (mon.minvent && mon.minvent.length > 0) {
        mon.minvent = restObjChn(mon.minvent);
    }
    // Reconstruct mtrack if missing
    if (!mon.mtrack) {
        mon.mtrack = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
    }
    return mon;
}

// C ref: restmonchn() — restore a chain of monsters
export function restMonChn(list) {
    return (list || []).map(restMon);
}

// ========================================================================
// Trap save/restore -- C ref: save.c savetrapchn()
// ========================================================================

// C ref: savetrapchn() — save a chain of traps
export function saveTrapChn(list) {
    return (list || []).map(t => ({ ...t }));
}

// Restore a chain of traps
export function restTrapChn(list) {
    return (list || []).map(t => ({ ...t }));
}

// ========================================================================
// Level save/restore -- C ref: save.c savelev() / restore.c getlev()
// ========================================================================

// C ref: savelev() — save a complete level
export function saveLev(map) {
    // Grid: shallow copy each location
    const locations = [];
    for (let x = 0; x < COLNO; x++) {
        const col = [];
        for (let y = 0; y < ROWNO; y++) {
            col.push({ ...map.locations[x][y] });
        }
        locations.push(col);
    }
    // Rooms: shallow copy, skip sbrooms (object references)
    const rooms = map.rooms.map(r => {
        const copy = { ...r };
        delete copy.sbrooms;
        return copy;
    });
    return {
        locations,
        rooms,
        nroom: map.nroom,
        doors: map.doors.map(d => ({ ...d })),
        doorindex: map.doorindex,
        upstair: { ...map.upstair },
        dnstair: { ...map.dnstair },
        smeq: [...map.smeq],
        flags: { ...map.flags },
        monsters: saveMonChn(map.monsters),
        objects: saveObjChn(map.objects),
        traps: saveTrapChn(map.traps),
        isBones: map.isBones || false,
    };
}

// C ref: getlev() — restore a complete level into a GameMap
export function restLev(data) {
    const map = new GameMap();
    // Restore locations
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (data.locations[x] && data.locations[x][y]) {
                Object.assign(map.locations[x][y], data.locations[x][y]);
            }
        }
    }
    // Restore rooms
    map.rooms = (data.rooms || []).map(r => {
        const room = makeRoom();
        Object.assign(room, r);
        room.sbrooms = [];
        return room;
    });
    map.nroom = data.nroom || map.rooms.length;
    // Restore doors
    map.doors = (data.doors || []).map(d => ({ ...d }));
    map.doorindex = data.doorindex || 0;
    // Stairs
    map.upstair = data.upstair ? { ...data.upstair } : { x: 0, y: 0 };
    map.dnstair = data.dnstair ? { ...data.dnstair } : { x: 0, y: 0 };
    // smeq
    map.smeq = data.smeq ? [...data.smeq] : [];
    // Flags
    if (data.flags) map.flags = { ...map.flags, ...data.flags };
    // Monsters
    map.monsters = restMonChn(data.monsters);
    // Objects
    map.objects = restObjChn(data.objects);
    // Traps
    map.traps = restTrapChn(data.traps);
    // Bones flag
    if (data.isBones) map.isBones = true;
    return map;
}

// ========================================================================
// RNG state serialization (internal to saveGameState/restGameState)
// ========================================================================

// Serialize ISAAC64 context (BigInt fields -> hex strings for JSON)
export function serializeRng(ctx) {
    return {
        a: ctx.a.toString(16),
        b: ctx.b.toString(16),
        c: ctx.c.toString(16),
        n: ctx.n,
        r: ctx.r.map(v => v.toString(16)),
        m: ctx.m.map(v => v.toString(16)),
    };
}

// Deserialize ISAAC64 context (hex strings -> BigInt)
export function deserializeRng(data) {
    return {
        a: BigInt('0x' + data.a),
        b: BigInt('0x' + data.b),
        c: BigInt('0x' + data.c),
        n: data.n,
        r: data.r.map(v => BigInt('0x' + v)),
        m: data.m.map(v => BigInt('0x' + v)),
    };
}

// ========================================================================
// Player save/restore -- C ref: save.c Sfo_you() / restore.c Sfi_you()
// ========================================================================

// Equipment slot names (C ref: decl.h uarm, uarmc, uarmh, etc.)
const EQUIP_SLOTS = ['weapon', 'armor', 'shield', 'helmet',
                     'gloves', 'boots', 'cloak', 'amulet',
                     'leftRing', 'rightRing'];

// C ref: Sfo_you() — save player struct (primitives only, no inventory)
export function saveYou(player) {
    return {
        x: player.x, y: player.y,
        name: player.name, roleIndex: player.roleIndex,
        race: player.race, gender: player.gender, alignment: player.alignment,
        alignmentRecord: player.alignmentRecord, alignmentAbuse: player.alignmentAbuse,
        hp: player.hp, hpmax: player.hpmax, pw: player.pw, pwmax: player.pwmax,
        ac: player.ac, level: player.level, exp: player.exp, score: player.score,
        attributes: [...player.attributes],
        dungeonLevel: player.dungeonLevel, maxDungeonLevel: player.maxDungeonLevel,
        gold: player.gold, hunger: player.hunger, nutrition: player.nutrition,
        movement: player.movement, speed: player.speed, moved: player.moved,
        luck: player.luck, moreluck: player.moreluck,
        blind: player.blind, confused: player.confused, stunned: player.stunned,
        hallucinating: player.hallucinating, sick: player.sick,
        foodpoisoned: player.foodpoisoned,
        turns: player.turns, showExp: player.showExp,
    };
}

// C ref: Sfi_you() — restore player struct (primitives only)
export function restYou(data) {
    const p = new Player();
    const fields = [
        'x', 'y', 'name', 'roleIndex', 'race', 'gender', 'alignment',
        'alignmentRecord', 'alignmentAbuse',
        'hp', 'hpmax', 'pw', 'pwmax', 'ac', 'level', 'exp', 'score',
        'dungeonLevel', 'maxDungeonLevel', 'gold', 'hunger', 'nutrition',
        'movement', 'speed', 'moved', 'luck', 'moreluck',
        'blind', 'confused', 'stunned', 'hallucinating', 'sick',
        'foodpoisoned', 'turns', 'showExp',
    ];
    for (const f of fields) {
        if (data[f] !== undefined) p[f] = data[f];
    }
    if (data.attributes) p.attributes = [...data.attributes];
    return p;
}

// Wire equipment slot references from index map into inventory array.
// C ref: done during restgamestate — equip pointers point into invent chain
export function wireEquip(player, equip) {
    for (const slot of EQUIP_SLOTS) {
        const idx = equip[slot];
        player[slot] = (idx >= 0 && idx < player.inventory.length)
            ? player.inventory[idx]
            : null;
    }
}

// Build equipment index map from player state.
// C ref: part of savegamestate — equip as inventory indices
export function saveEquip(player) {
    const indices = {};
    for (const slot of EQUIP_SLOTS) {
        indices[slot] = player[slot]
            ? player.inventory.indexOf(player[slot])
            : -1;
    }
    return indices;
}

// ========================================================================
// Game state save/restore -- C ref: save.c savegamestate() / restore.c restgamestate()
// ========================================================================

// C ref: savegamestate() — save game context + you + inventory + equip + rng + flags
export function saveGameState(game) {
    const { player, display } = game;
    const { getRngState, getRngCallCount } = game._rngAccessors;
    return {
        turnCount: game.turnCount,
        wizard: game.wizard,
        seerTurn: game.seerTurn,
        seed: game.seed,
        rng: serializeRng(getRngState()),
        rngCallCount: getRngCallCount(),
        you: saveYou(player),
        invent: saveObjChn(player.inventory),
        equip: saveEquip(player),
        messages: display.messages.slice(-200),
        flags: game.flags || null,
    };
}

// C ref: restgamestate() — restore game context + you + inventory + equip + flags
// Returns { player, turnCount, wizard, seerTurn, seed, rng, rngCallCount, messages, flags }
export function restGameState(gameState) {
    const player = restYou(gameState.you);
    player.inventory = restObjChn(gameState.invent);
    wireEquip(player, gameState.equip || {});
    return {
        player,
        turnCount: gameState.turnCount || 0,
        wizard: gameState.wizard || false,
        seerTurn: gameState.seerTurn || 0,
        seed: gameState.seed,
        rng: gameState.rng,
        rngCallCount: gameState.rngCallCount,
        messages: gameState.messages || [],
        flags: gameState.flags || null,
    };
}

// ========================================================================
// Top-level save/restore -- C ref: save.c dosave0() / restore.c dorecover()
// ========================================================================

// C ref: dosave0() — build complete save data (current level first, then game state, then other levels)
export function buildSaveData(game) {
    const { player, map } = game;
    const currentDepth = player.dungeonLevel;

    // Current level (saved first, like C)
    const currentLevel = map ? saveLev(map) : null;

    // Game state (player, inventory, equip, rng, context)
    const gameState = saveGameState(game);

    // Other cached levels
    const otherLevels = {};
    for (const [depth, levelMap] of Object.entries(game.levels)) {
        if (Number(depth) !== currentDepth) {
            otherLevels[depth] = saveLev(levelMap);
        }
    }

    return {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        currentDepth,
        currentLevel,
        gameState,
        otherLevels,
    };
}

// Save the game to localStorage. Returns true on success.
export function saveGame(game) {
    const s = storage();
    if (!s) return false;
    try {
        const data = buildSaveData(game);
        const json = JSON.stringify(data);
        s.setItem(SAVE_KEY, json);
        return true;
    } catch (e) {
        console.error('Failed to save game:', e);
        return false;
    }
}

// Load saved game data from localStorage. Returns parsed object or null.
export function loadSave() {
    const s = storage();
    if (!s) return null;
    try {
        const json = s.getItem(SAVE_KEY);
        if (!json) return null;
        const data = JSON.parse(json);
        if (!data || data.version !== SAVE_VERSION) return null;
        return data;
    } catch (e) {
        console.error('Failed to load save:', e);
        return null;
    }
}

// Delete the save from localStorage.
export function deleteSave() {
    const s = storage();
    if (!s) return;
    try { s.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

// Check if a save exists without fully parsing it.
export function hasSave() {
    const s = storage();
    if (!s) return false;
    try { return s.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
}

// List all webhack save/bones entries in localStorage.
// Returns array of { key, label } describing each stored item.
export function listSavedData() {
    const s = storage();
    if (!s) return [];
    const items = [];
    try {
        for (let i = 0; i < s.length; i++) {
            const key = s.key(i);
            if (key === SAVE_KEY) {
                items.push({ key, label: 'Saved game' });
            } else if (key.startsWith(BONES_KEY_PREFIX)) {
                const depth = key.slice(BONES_KEY_PREFIX.length);
                items.push({ key, label: `Bones file (depth ${depth})` });
            } else if (key === OPTIONS_KEY) {
                items.push({ key, label: 'Options/flags' });
            } else if (key === TOPTEN_KEY) {
                items.push({ key, label: 'High scores' });
            }
        }
    } catch (e) { /* ignore */ }
    return items;
}

// Delete all webhack data from localStorage.
export function clearAllData() {
    const s = storage();
    if (!s) return;
    const toRemove = [];
    try {
        for (let i = 0; i < s.length; i++) {
            const key = s.key(i);
            if (key === SAVE_KEY || key.startsWith(BONES_KEY_PREFIX) || key === OPTIONS_KEY || key === TOPTEN_KEY) {
                toRemove.push(key);
            }
        }
        for (const key of toRemove) {
            s.removeItem(key);
        }
    } catch (e) { /* ignore */ }
}

// ========================================================================
// Bones files -- C ref: bones.c savebones() / getbones()
// ========================================================================

// Save a bones level for the given depth.
// Only saves if no bones already exist for that depth.
export function saveBones(depth, mapData, playerName, playerX, playerY, playerLevel, inventory) {
    const s = storage();
    if (!s) return false;
    const key = BONES_KEY_PREFIX + depth;
    try {
        // Don't overwrite existing bones (first death wins)
        if (s.getItem(key) !== null) return false;

        const bonesData = {
            version: SAVE_VERSION,
            depth,
            map: mapData,
            ghost: {
                name: 'Ghost of ' + playerName,
                x: playerX,
                y: playerY,
                level: playerLevel,
            },
            droppedInventory: saveObjChn(inventory),
        };
        s.setItem(key, JSON.stringify(bonesData));
        return true;
    } catch (e) {
        console.error('Failed to save bones:', e);
        return false;
    }
}

// Load bones for a given depth. Returns parsed data or null.
export function loadBones(depth) {
    const s = storage();
    if (!s) return null;
    const key = BONES_KEY_PREFIX + depth;
    try {
        const json = s.getItem(key);
        if (!json) return null;
        const data = JSON.parse(json);
        if (!data || data.version !== SAVE_VERSION) return null;
        return data;
    } catch (e) {
        return null;
    }
}

// Delete bones for a given depth (single-use, matching C behavior).
export function deleteBones(depth) {
    const s = storage();
    if (!s) return;
    try { s.removeItem(BONES_KEY_PREFIX + depth); } catch (e) { /* ignore */ }
}

// ========================================================================
// Flags -- C ref: flag.h struct flag + options.c allopt[]
// ========================================================================

// Complete C NetHack 3.7 defaults (from optlist.h + options.c initoptions_init)
const C_DEFAULTS = {
    // Identity (empty = prompt at start)
    name: '', role: '', race: '', gender: '', alignment: '',
    catname: '', dogname: '', horsename: '', pettype: '',

    // Boolean: ON in C
    acoustics: true, autoopen: true, autodescribe: true, bones: true,
    cmdassist: true, color: true, confirm: true, dark_room: true,
    dropped_nopick: true, fireassist: true, fixinv: true, help: true,
    implicit_uncursed: true, legacy: true, mail: true,
    pickup_stolen: true, pickup_thrown: true,
    safe_pet: true, safe_wait: true, silent: true, sortpack: true,
    sparkle: true, splash_screen: true, status_updates: true,
    tips: true, tombstone: true, travel: true,
    use_darkgray: true, use_inverse: true, verbose: true,

    // Boolean: OFF in C
    autodig: false, pickup: false, autoquiver: false,
    hilite_pet: false, hilite_pile: false, lit_corridor: false,
    lootabc: false, menucolors: false, number_pad: false,
    perm_invent: false, pushweapon: false, rest_on_space: false,
    showdamage: false, showexp: false, showrace: false, time: false,

    // Compound options
    fruit: 'slime mold', pickup_types: '', menustyle: 'full',
    runmode: 'leap', pickup_burden: 'moderate', sortloot: 'loot',
    pile_limit: 5, msghistory: 20, statuslines: 2,
    msg_window: false, DECgraphics: false,
};

// JS-specific overrides from C defaults
const JS_OVERRIDES = {
    DECgraphics: true,  // C has DECgraphics off; we use box-drawing by default
};

// Computed: the effective defaults for this JS port
export const DEFAULT_FLAGS = { ...C_DEFAULTS, ...JS_OVERRIDES };

// C ref: options.c allopt[] — metadata for each option
export const OPTION_DEFS = [
    // String/compound options (C: "Compounds - selecting will prompt for new value")
    { name: 'name', type: 'string', label: 'Your character\'s name', menuChar: 'N',
      help: 'Your character\'s name (e.g., name:Merlin)' },
    { name: 'pickup_types', type: 'string', label: 'Pickup types', menuChar: 'p',
      help: 'Object types to autopickup (e.g., "$/!?+" for gold/potions/scrolls/rings/spellbooks). Empty = all types.' },

    // Boolean options
    { name: 'pickup', type: 'boolean', label: 'Auto-pickup', menuChar: 'a' },
    { name: 'showexp', type: 'boolean', label: 'Show experience', menuChar: 'e' },
    { name: 'color', type: 'boolean', label: 'Color', menuChar: 'c' },
    { name: 'time', type: 'boolean', label: 'Show turns', menuChar: 't' },
    { name: 'safe_pet', type: 'boolean', label: 'Safe pet', menuChar: 's' },
    { name: 'confirm', type: 'boolean', label: 'Confirm attacks', menuChar: 'f' },
    { name: 'verbose', type: 'boolean', label: 'Verbose messages', menuChar: 'v' },
    { name: 'tombstone', type: 'boolean', label: 'Tombstone', menuChar: 'b' },
    { name: 'rest_on_space', type: 'boolean', label: 'Rest on space', menuChar: 'r' },
    { name: 'number_pad', type: 'boolean', label: 'Number pad', menuChar: 'n' },
    { name: 'lit_corridor', type: 'boolean', label: 'Lit corridors', menuChar: 'l' },
    { name: 'DECgraphics', type: 'boolean', label: 'DECgraphics (box-drawing)', menuChar: 'd' },
    { name: 'msg_window', type: 'boolean', label: 'Message window (3 lines)', menuChar: 'm' },
];

// Migrate old option keys to new flag keys
function migrateFlags(saved) {
    // autopickup → pickup (pre-flags rename)
    if ('autopickup' in saved && !('pickup' in saved)) {
        saved.pickup = saved.autopickup;
        delete saved.autopickup;
    }
    // showExp → showexp (case normalization)
    if ('showExp' in saved && !('showexp' in saved)) {
        saved.showexp = saved.showExp;
        delete saved.showExp;
    }
    return saved;
}

// Parse URL parameters, coercing types based on C_DEFAULTS
function parseUrlFlags() {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    const urlFlags = {};
    for (const [key, value] of params) {
        // Special non-flag params pass through as-is
        if (['wizard', 'reset', 'seed'].includes(key)) {
            urlFlags[key] = key === 'seed'
                ? parseInt(value, 10)
                : (value === '1' || value === 'true');
            continue;
        }
        // Known flag — coerce type from C_DEFAULTS
        if (key in C_DEFAULTS) {
            const defVal = C_DEFAULTS[key];
            if (typeof defVal === 'boolean')
                urlFlags[key] = value === '1' || value === 'true' || value === '';
            else if (typeof defVal === 'number')
                urlFlags[key] = parseInt(value, 10);
            else
                urlFlags[key] = value;
        }
    }
    return urlFlags;
}

// Get non-flag URL parameters for game init (wizard mode, seed, etc.)
export function getUrlParams() {
    const url = parseUrlFlags();
    return {
        wizard: url.wizard || false,
        seed: url.seed || null,
        role: url.role || null,
        reset: url.reset || false,
    };
}

// C ref: options.c initoptions() — load flags from localStorage, merged with defaults
export function loadFlags() {
    const defaults = { ...C_DEFAULTS, ...JS_OVERRIDES };

    // localStorage
    let saved = {};
    const s = storage();
    if (s) {
        try {
            const json = s.getItem(OPTIONS_KEY);
            if (json) saved = migrateFlags(JSON.parse(json));
        } catch (e) {}
    }

    // URL parameters (highest priority)
    const urlFlags = parseUrlFlags();

    // Merge: defaults < localStorage < URL
    const flags = { ...defaults, ...saved, ...urlFlags };

    // Persist URL flag overrides to localStorage
    const persistable = {};
    for (const [k, v] of Object.entries(urlFlags)) {
        if (k in C_DEFAULTS) persistable[k] = v;
    }
    if (Object.keys(persistable).length > 0) {
        saveFlags({ ...saved, ...persistable });
    }

    return flags;
}

// C ref: options.c doset() — save flags to localStorage
export function saveFlags(flags) {
    const s = storage();
    if (!s) return;
    try { s.setItem(OPTIONS_KEY, JSON.stringify(flags)); } catch (e) { /* ignore */ }
}

// Get a single flag value.
export function getFlag(key) {
    return loadFlags()[key];
}

// Set a single flag and persist.
export function setFlag(key, value) {
    const flags = loadFlags();
    flags[key] = value;
    saveFlags(flags);
}

// Backward-compatible aliases
export const loadOptions = loadFlags;
export const saveOptions = saveFlags;
export const getOption = getFlag;
export const setOption = setFlag;
