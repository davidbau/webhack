// test/unit/storage.test.js -- Tests for save/load, bones, options, serialization round-trips
// Verifies that all C-mirroring serialization functions correctly round-trip data.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initRng, getRngState, setRngState, getRngCallCount, setRngCallCount, rn2, rnd } from '../../js/rng.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';
import { makemon, NO_MM_FLAGS } from '../../js/makemon.js';
import { mksobj } from '../../js/mkobj.js';
import { mons, PM_GHOST } from '../../js/monsters.js';
import { objectData } from '../../js/objects.js';
import { COLNO, ROWNO, ACCESSIBLE } from '../../js/config.js';
import { Player, roles } from '../../js/player.js';
import { GameMap } from '../../js/map.js';
import {
    saveObj, restObj, saveObjChn, restObjChn,
    saveMon, restMon, saveMonChn, restMonChn,
    saveTrapChn, restTrapChn,
    saveLev, restLev,
    saveYou, restYou, saveEquip, wireEquip,
    saveGameState, restGameState,
    serializeRng, deserializeRng,
    buildSaveData, loadSave, deleteSave, saveGame,
    saveBones, loadBones, deleteBones,
    loadOptions, saveOptions, getOption, setOption,
} from '../../js/storage.js';

// --- localStorage mock for Node.js ---
// Mimics browser localStorage with a simple in-memory Map.
const store = new Map();
globalThis.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
};

// ========================================================================
// saveObj / restObj -- C ref: saveobj / restobj
// ========================================================================
describe('Object save/restore (saveObj/restObj)', () => {
    it('round-trips an object created by mksobj()', () => {
        initRng(42);
        initLevelGeneration();
        const otyp = objectData.findIndex(o => o.name === 'dagger');
        const obj = mksobj(otyp, true, false);
        assert.ok(obj);

        const saved = saveObj(obj);
        assert.equal(saved.displayChar, undefined, 'displayChar should be stripped');
        assert.equal(saved.name, 'dagger');

        const restored = restObj(saved);
        assert.equal(restored.name, obj.name);
        assert.equal(restored.otyp, obj.otyp);
        assert.equal(restored.oclass, obj.oclass);
        assert.equal(restored.owt, obj.owt);
        assert.equal(typeof restored.displayChar, 'string');
        assert.ok(restored.displayChar.length > 0);
    });

    it('round-trips through JSON.stringify/parse', () => {
        initRng(42);
        initLevelGeneration();
        const otyp = objectData.findIndex(o => o.name === 'food ration');
        const obj = mksobj(otyp, true, false);
        const json = JSON.stringify(saveObj(obj));
        const restored = restObj(JSON.parse(json));
        assert.equal(restored.name, obj.name);
        assert.equal(restored.displayChar, '%');
    });

    it('saveObjChn/restObjChn handle empty and null lists', () => {
        assert.deepEqual(saveObjChn([]), []);
        assert.deepEqual(saveObjChn(null), []);
        assert.deepEqual(restObjChn([]), []);
        assert.deepEqual(restObjChn(null), []);
    });
});

// ========================================================================
// saveMon / restMon -- C ref: savemon / restmon
// ========================================================================
describe('Monster save/restore (saveMon/restMon)', () => {
    it('round-trips a monster created by makemon()', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        // Find a room center to place a monster
        const room = map.rooms[0];
        const cx = Math.floor((room.lx + room.hx) / 2);
        const cy = Math.floor((room.ly + room.hy) / 2);

        const mndx = mons.findIndex(m => m.name === 'grid bug');
        const mon = makemon(mndx, cx, cy, NO_MM_FLAGS, 1, map);
        assert.ok(mon, 'makemon should succeed');

        const saved = saveMon(mon);
        // Derived fields should be stripped
        assert.equal(saved.type, undefined);
        assert.equal(saved.attacks, undefined);
        assert.equal(saved.displayChar, undefined);
        assert.equal(saved.displayColor, undefined);
        // mndx preserved
        assert.equal(saved.mndx, mndx);

        const restored = restMon(saved);
        // Derived fields reconstructed
        assert.ok(restored.type, 'type should be reconstructed');
        assert.equal(restored.type, mons[mndx]);
        assert.equal(restored.attacks, mons[mndx].attacks);
        assert.equal(typeof restored.displayChar, 'string');
        assert.ok(restored.displayChar.length > 0);
        assert.equal(typeof restored.displayColor, 'number');

        // All primitive fields match original
        assert.equal(restored.mx, mon.mx);
        assert.equal(restored.my, mon.my);
        assert.equal(restored.mhp, mon.mhp);
        assert.equal(restored.mhpmax, mon.mhpmax);
        assert.equal(restored.mlevel, mon.mlevel);
        assert.equal(restored.name, mon.name);
        assert.equal(restored.speed, mon.speed);
        assert.equal(restored.peaceful, mon.peaceful);
        assert.equal(restored.tame, mon.tame);
        assert.equal(restored.dead, mon.dead);
    });

    it('round-trips through JSON.stringify/parse', () => {
        initRng(99);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const room = map.rooms[0];
        const cx = Math.floor((room.lx + room.hx) / 2);
        const cy = Math.floor((room.ly + room.hy) / 2);
        const mndx = mons.findIndex(m => m.name === 'kobold');
        const mon = makemon(mndx, cx, cy, NO_MM_FLAGS, 1, map);
        assert.ok(mon);

        const saved = saveMon(mon);
        const json = JSON.stringify(saved);
        const parsed = JSON.parse(json);
        const restored = restMon(parsed);

        assert.equal(restored.name, mon.name);
        assert.equal(restored.mndx, mon.mndx);
        assert.equal(restored.mhp, mon.mhp);
        assert.ok(restored.type);
        assert.ok(restored.attacks);
    });

    it('preserves mtrack array', () => {
        const mon = {
            mndx: 0, name: 'test', mx: 5, my: 5, mhp: 10, mhpmax: 10,
            mlevel: 1, mac: 10, speed: 12, movement: 0,
            type: mons[0], attacks: mons[0].attacks,
            displayChar: 'a', displayColor: 7,
            peaceful: false, tame: false, flee: false,
            confused: false, stunned: false, blind: false,
            sleeping: false, dead: false, passive: false,
            mtrack: [{x:1,y:2},{x:3,y:4},{x:0,y:0},{x:0,y:0}],
        };
        const restored = restMon(JSON.parse(JSON.stringify(saveMon(mon))));
        assert.deepEqual(restored.mtrack, [{x:1,y:2},{x:3,y:4},{x:0,y:0},{x:0,y:0}]);
    });

    it('saveMonChn properly strips displayChar from minvent items', () => {
        const item = { name: 'dagger', oclass: 1, otyp: 5, displayChar: ')' };
        const mon = {
            mndx: 0, name: 'test', mx: 5, my: 5, mhp: 10, mhpmax: 10,
            mlevel: 1, mac: 10, speed: 12, movement: 0,
            type: mons[0], attacks: mons[0].attacks,
            displayChar: 'a', displayColor: 7,
            peaceful: false, tame: true, flee: false,
            confused: false, stunned: false, blind: false,
            sleeping: false, dead: false, passive: false,
            minvent: [item],
            mtrack: [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],
        };
        const saved = saveMonChn([mon]);
        assert.equal(saved.length, 1);
        assert.equal(saved[0].minvent[0].displayChar, undefined, 'minvent item displayChar should be stripped');
        assert.equal(saved[0].minvent[0].name, 'dagger');

        const restored = restMonChn(JSON.parse(JSON.stringify(saved)));
        assert.equal(restored[0].minvent[0].name, 'dagger');
        assert.ok(restored[0].minvent[0].displayChar, 'minvent item displayChar should be restored');
    });

    it('restMon rebuilds mtrack when missing', () => {
        const saved = { mndx: 0, name: 'test', mx: 5, my: 5, mhp: 10, mhpmax: 10 };
        const restored = restMon(saved);
        assert.ok(Array.isArray(restored.mtrack));
        assert.equal(restored.mtrack.length, 4);
    });
});

// ========================================================================
// RNG state serialization
// ========================================================================
describe('RNG state serialization', () => {
    it('round-trips ISAAC64 context through hex strings', () => {
        initRng(12345);
        // Advance state to get non-trivial values
        for (let i = 0; i < 100; i++) rn2(1000);

        const ctx = getRngState();
        const serialized = serializeRng(ctx);

        // All fields should be strings or numbers
        assert.equal(typeof serialized.a, 'string');
        assert.equal(typeof serialized.b, 'string');
        assert.equal(typeof serialized.c, 'string');
        assert.equal(typeof serialized.n, 'number');
        assert.ok(Array.isArray(serialized.r));
        assert.equal(serialized.r.length, 256);
        assert.equal(serialized.m.length, 256);

        const restored = deserializeRng(serialized);
        assert.equal(restored.a, ctx.a);
        assert.equal(restored.b, ctx.b);
        assert.equal(restored.c, ctx.c);
        assert.equal(restored.n, ctx.n);
        for (let i = 0; i < 256; i++) {
            assert.equal(restored.r[i], ctx.r[i], `r[${i}] mismatch`);
            assert.equal(restored.m[i], ctx.m[i], `m[${i}] mismatch`);
        }
    });

    it('round-trips through JSON and produces identical RNG output', () => {
        initRng(777);
        for (let i = 0; i < 50; i++) rn2(100);

        const ctx = getRngState();
        const callCount = getRngCallCount();
        const json = JSON.stringify(serializeRng(ctx));

        // Generate some reference values from current state
        const expected = [];
        for (let i = 0; i < 20; i++) expected.push(rn2(1000));

        // Restore state
        const restoredCtx = deserializeRng(JSON.parse(json));
        setRngState(restoredCtx);
        setRngCallCount(callCount);

        // Should produce identical values
        const actual = [];
        for (let i = 0; i < 20; i++) actual.push(rn2(1000));

        assert.deepEqual(actual, expected, 'RNG output should match after restore');
    });

    it('handles zero-valued BigInt fields', () => {
        // Edge case: a=0, b=0, c=0
        const ctx = { a: 0n, b: 0n, c: 0n, n: 0, r: new Array(256).fill(0n), m: new Array(256).fill(0n) };
        const serialized = serializeRng(ctx);
        assert.equal(serialized.a, '0');
        const restored = deserializeRng(serialized);
        assert.equal(restored.a, 0n);
        assert.equal(restored.b, 0n);
    });
});

// ========================================================================
// saveYou / restYou -- C ref: Sfo_you / Sfi_you
// ========================================================================
describe('Player save/restore (saveYou/restYou)', () => {
    it('round-trips a freshly initialized player', () => {
        initRng(42);
        initLevelGeneration();
        const p = new Player();
        p.initRole(0); // Archeologist
        p.x = 15;
        p.y = 8;
        p.name = 'TestHero';
        p.gold = 123;
        p.hunger = 800;

        const data = saveYou(p);
        const restored = restYou(data);

        assert.equal(restored.x, 15);
        assert.equal(restored.y, 8);
        assert.equal(restored.name, 'TestHero');
        assert.equal(restored.roleIndex, 0);
        assert.equal(restored.gold, 123);
        assert.equal(restored.hunger, 800);
        assert.equal(restored.hp, p.hp);
        assert.equal(restored.hpmax, p.hpmax);
        assert.deepEqual(restored.attributes, p.attributes);
    });

    it('round-trips inventory and equipment via saveObjChn + saveEquip + wireEquip', () => {
        initRng(42);
        initLevelGeneration();
        const p = new Player();
        p.initRole(11); // Valkyrie

        // Add items to inventory
        const dagger = { name: 'dagger', oclass: 1, otyp: 5, owt: 10, spe: 0,
                         blessed: false, cursed: false, displayChar: ')' };
        const armor = { name: 'leather armor', oclass: 2, otyp: 100, owt: 150, spe: 0,
                        blessed: false, cursed: false, displayChar: '[' };
        p.addToInventory(dagger);
        p.addToInventory(armor);
        p.weapon = dagger;
        p.armor = armor;

        // Save: you + inventory + equip (separate, like C)
        const youData = saveYou(p);
        const inventData = saveObjChn(p.inventory);
        const equipData = saveEquip(p);

        // Equipment stored as indices
        assert.equal(equipData.weapon, 0);
        assert.equal(equipData.armor, 1);
        assert.equal(equipData.shield, -1);

        // Round-trip through JSON
        const json = JSON.stringify({ you: youData, invent: inventData, equip: equipData });
        const parsed = JSON.parse(json);

        const restored = restYou(parsed.you);
        restored.inventory = restObjChn(parsed.invent);
        wireEquip(restored, parsed.equip);

        assert.equal(restored.inventory.length, 2);
        assert.equal(restored.inventory[0].name, 'dagger');
        assert.equal(restored.inventory[1].name, 'leather armor');
        // Equipment references should point to inventory items
        assert.equal(restored.weapon, restored.inventory[0]);
        assert.equal(restored.armor, restored.inventory[1]);
        assert.equal(restored.shield, null);
    });

    it('round-trips through JSON.stringify/parse', () => {
        const p = new Player();
        p.initRole(5); // Monk
        p.x = 30;
        p.y = 12;
        p.luck = 3;
        p.confused = true;

        const json = JSON.stringify(saveYou(p));
        const restored = restYou(JSON.parse(json));
        assert.equal(restored.x, 30);
        assert.equal(restored.y, 12);
        assert.equal(restored.luck, 3);
        assert.equal(restored.confused, true);
        assert.equal(restored.roleName, 'Monk');
    });
});

// ========================================================================
// saveLev / restLev -- C ref: savelev / getlev
// ========================================================================
describe('Level save/restore (saveLev/restLev)', () => {
    it('round-trips a generated level', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const data = saveLev(map);
        const json = JSON.stringify(data);
        const restored = restLev(JSON.parse(json));

        // Grid dimensions
        assert.equal(restored.locations.length, COLNO);
        assert.equal(restored.locations[0].length, ROWNO);

        // Every cell should match
        for (let x = 0; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                assert.equal(restored.at(x, y).typ, map.at(x, y).typ,
                    `typ mismatch at (${x},${y})`);
                assert.equal(restored.at(x, y).lit, map.at(x, y).lit,
                    `lit mismatch at (${x},${y})`);
                assert.equal(restored.at(x, y).roomno, map.at(x, y).roomno,
                    `roomno mismatch at (${x},${y})`);
            }
        }
    });

    it('round-trips rooms', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const data = saveLev(map);
        const restored = restLev(JSON.parse(JSON.stringify(data)));

        assert.equal(restored.rooms.length, map.rooms.length);
        assert.equal(restored.nroom, map.nroom);
        for (let i = 0; i < map.rooms.length; i++) {
            assert.equal(restored.rooms[i].lx, map.rooms[i].lx);
            assert.equal(restored.rooms[i].ly, map.rooms[i].ly);
            assert.equal(restored.rooms[i].hx, map.rooms[i].hx);
            assert.equal(restored.rooms[i].hy, map.rooms[i].hy);
            assert.equal(restored.rooms[i].rtype, map.rooms[i].rtype);
            assert.equal(restored.rooms[i].rlit, map.rooms[i].rlit);
        }
    });

    it('round-trips stairs', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(3);
        wallification(map);

        const restored = restLev(JSON.parse(JSON.stringify(saveLev(map))));
        assert.equal(restored.upstair.x, map.upstair.x);
        assert.equal(restored.upstair.y, map.upstair.y);
        assert.equal(restored.dnstair.x, map.dnstair.x);
        assert.equal(restored.dnstair.y, map.dnstair.y);
    });

    it('round-trips monsters with full fidelity', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);
        const origCount = map.monsters.length;
        assert.ok(origCount > 0, 'Level should have monsters');

        const restored = restLev(JSON.parse(JSON.stringify(saveLev(map))));
        assert.equal(restored.monsters.length, origCount);

        for (let i = 0; i < origCount; i++) {
            const orig = map.monsters[i];
            const rest = restored.monsters[i];
            assert.equal(rest.name, orig.name, `Monster ${i} name`);
            assert.equal(rest.mndx, orig.mndx, `Monster ${i} mndx`);
            assert.equal(rest.mx, orig.mx, `Monster ${i} mx`);
            assert.equal(rest.my, orig.my, `Monster ${i} my`);
            assert.equal(rest.mhp, orig.mhp, `Monster ${i} mhp`);
            assert.ok(rest.type, `Monster ${i} should have type`);
            assert.ok(rest.attacks, `Monster ${i} should have attacks`);
            assert.ok(rest.displayChar, `Monster ${i} should have displayChar`);
        }
    });

    it('round-trips objects', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);
        const origCount = map.objects.length;

        const restored = restLev(JSON.parse(JSON.stringify(saveLev(map))));
        assert.equal(restored.objects.length, origCount);
        for (let i = 0; i < origCount; i++) {
            assert.equal(restored.objects[i].name, map.objects[i].name);
            assert.equal(restored.objects[i].otyp, map.objects[i].otyp);
            assert.equal(restored.objects[i].ox, map.objects[i].ox);
            assert.equal(restored.objects[i].oy, map.objects[i].oy);
        }
    });

    it('round-trips traps', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(3); // deeper levels more likely to have traps
        wallification(map);

        const restored = restLev(JSON.parse(JSON.stringify(saveLev(map))));
        assert.equal(restored.traps.length, map.traps.length);
        for (let i = 0; i < map.traps.length; i++) {
            assert.equal(restored.traps[i].tx, map.traps[i].tx);
            assert.equal(restored.traps[i].ty, map.traps[i].ty);
        }
    });

    it('round-trips level flags', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        // Set some flags for testing
        map.flags.has_shop = true;
        map.flags.nfountains = 2;

        const restored = restLev(JSON.parse(JSON.stringify(saveLev(map))));
        assert.equal(restored.flags.has_shop, true);
        assert.equal(restored.flags.nfountains, 2);
    });

    it('round-trips isBones flag', () => {
        const map = new GameMap();
        map.isBones = true;
        const restored = restLev(JSON.parse(JSON.stringify(saveLev(map))));
        assert.equal(restored.isBones, true);
    });

    it('round-trips smeq array', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const restored = restLev(JSON.parse(JSON.stringify(saveLev(map))));
        // JSON converts sparse array holes (undefined) to null;
        // verify the populated entries match exactly
        assert.equal(restored.smeq.length, map.smeq.length);
        for (let i = 0; i < map.smeq.length; i++) {
            if (map.smeq[i] !== undefined) {
                assert.equal(restored.smeq[i], map.smeq[i], `smeq[${i}] mismatch`);
            }
        }
    });
});

// ========================================================================
// localStorage: save/load game (v2 format)
// ========================================================================
describe('Save/load game (localStorage, v2 format)', () => {
    beforeEach(() => {
        store.clear();
    });

    it('saveGame + loadSave round-trips game state', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const player = new Player();
        player.initRole(11);
        player.x = 10;
        player.y = 7;
        player.name = 'SaveTest';
        player.gold = 50;
        const dagger = { name: 'dagger', oclass: 1, otyp: 5, owt: 10, spe: 0,
                         blessed: false, cursed: false, displayChar: ')' };
        player.addToInventory(dagger);
        player.weapon = dagger;

        const game = {
            player,
            map,
            display: { messages: ['Hello', 'World'] },
            levels: { 1: map },
            seed: 42,
            turnCount: 15,
            wizard: true,
            seerTurn: 30,
            _rngAccessors: { getRngState, getRngCallCount },
        };

        const ok = saveGame(game);
        assert.ok(ok, 'saveGame should succeed');

        const loaded = loadSave();
        assert.ok(loaded, 'loadSave should return data');
        assert.equal(loaded.version, 2);
        assert.equal(loaded.currentDepth, player.dungeonLevel);

        // v2 format: gameState contains player, context, inventory
        assert.ok(loaded.gameState);
        assert.equal(loaded.gameState.seed, 42);
        assert.equal(loaded.gameState.turnCount, 15);
        assert.equal(loaded.gameState.wizard, true);
        assert.equal(loaded.gameState.seerTurn, 30);
        assert.ok(loaded.gameState.you);
        assert.equal(loaded.gameState.you.name, 'SaveTest');
        assert.equal(loaded.gameState.you.gold, 50);
        assert.ok(loaded.gameState.rng);
        assert.ok(loaded.gameState.invent);
        assert.equal(loaded.gameState.invent.length, 1);
        assert.equal(loaded.gameState.equip.weapon, 0);
        assert.deepEqual(loaded.gameState.messages, ['Hello', 'World']);

        // v2 format: currentLevel is the current level
        assert.ok(loaded.currentLevel);
        assert.ok(loaded.currentLevel.locations);
    });

    it('deleteSave removes the save', () => {
        store.set('webhack-save', '{"version":2}');
        deleteSave();
        assert.equal(store.has('webhack-save'), false);
    });

    it('loadSave returns null when no save exists', () => {
        assert.equal(loadSave(), null);
    });

    it('loadSave returns null for corrupt data', () => {
        store.set('webhack-save', 'not-json');
        assert.equal(loadSave(), null);
    });

    it('loadSave returns null for wrong version', () => {
        store.set('webhack-save', JSON.stringify({ version: 999 }));
        assert.equal(loadSave(), null);
    });

    it('full Player round-trip through save/load', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const player = new Player();
        player.initRole(4); // Knight
        player.x = 20;
        player.y = 10;
        player.hp = 5;
        player.gold = 999;
        player.luck = -2;
        player.confused = true;

        const game = {
            player, map,
            display: { messages: [] },
            levels: { 1: map },
            seed: 42, turnCount: 0, wizard: false, seerTurn: 0,
            _rngAccessors: { getRngState, getRngCallCount },
        };
        saveGame(game);

        const loaded = loadSave();
        const restored = restGameState(loaded.gameState);
        assert.equal(restored.player.x, 20);
        assert.equal(restored.player.y, 10);
        assert.equal(restored.player.hp, 5);
        assert.equal(restored.player.gold, 999);
        assert.equal(restored.player.luck, -2);
        assert.equal(restored.player.confused, true);
        assert.equal(restored.player.roleName, 'Knight');
    });

    it('full RNG round-trip: restore produces identical future values', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        // Snapshot RNG state
        const ctx = getRngState();
        const callCount = getRngCallCount();
        const rngSer = serializeRng(ctx);

        // Generate reference values
        const expected = [];
        for (let i = 0; i < 50; i++) expected.push(rn2(10000));

        // Restore RNG state
        setRngState(deserializeRng(JSON.parse(JSON.stringify(rngSer))));
        setRngCallCount(callCount);

        // Should produce identical values
        const actual = [];
        for (let i = 0; i < 50; i++) actual.push(rn2(10000));
        assert.deepEqual(actual, expected);
    });
});

// ========================================================================
// localStorage: bones files
// ========================================================================
describe('Bones files (localStorage)', () => {
    beforeEach(() => {
        store.clear();
    });

    it('saveBones + loadBones round-trips', () => {
        const map = new GameMap();
        map.at(10, 5).typ = 24; // ROOM
        const mapData = saveLev(map);
        mapData.isBones = true;

        const ok = saveBones(3, mapData, 'Hero', 10, 5, 1, []);
        assert.ok(ok);

        const loaded = loadBones(3);
        assert.ok(loaded);
        assert.equal(loaded.depth, 3);
        assert.ok(loaded.map);
        assert.equal(loaded.ghost.name, 'Ghost of Hero');
        assert.equal(loaded.ghost.x, 10);
        assert.equal(loaded.ghost.y, 5);
    });

    it('saveBones does not overwrite existing bones', () => {
        const mapData = saveLev(new GameMap());
        saveBones(2, mapData, 'First', 5, 5, 1, []);
        const ok = saveBones(2, mapData, 'Second', 6, 6, 2, []);
        assert.equal(ok, false, 'Second save should fail');

        const loaded = loadBones(2);
        assert.equal(loaded.ghost.name, 'Ghost of First');
    });

    it('deleteBones removes bones', () => {
        const mapData = saveLev(new GameMap());
        saveBones(4, mapData, 'Hero', 10, 5, 1, []);
        deleteBones(4);
        assert.equal(loadBones(4), null);
    });

    it('loadBones returns null when no bones exist', () => {
        assert.equal(loadBones(99), null);
    });

    it('bones map can be deserialized with restLev', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);
        const mapData = saveLev(map);
        mapData.isBones = true;

        saveBones(1, mapData, 'Ghost', 10, 5, 1, []);
        const bonesData = loadBones(1);
        const restored = restLev(bonesData.map);
        assert.equal(restored.isBones, true);
        assert.equal(restored.rooms.length, map.rooms.length);
        assert.equal(restored.monsters.length, map.monsters.length);
    });
});

// ========================================================================
// localStorage: options
// ========================================================================
describe('Options (localStorage)', () => {
    beforeEach(() => {
        store.clear();
    });

    it('loadOptions returns defaults when nothing saved', () => {
        const opts = loadOptions();
        assert.equal(opts.autopickup, true);
        assert.equal(opts.showExp, true);
        assert.equal(opts.color, true);
    });

    it('saveOptions + loadOptions round-trips', () => {
        saveOptions({ autopickup: false, showExp: true, color: false });
        const opts = loadOptions();
        assert.equal(opts.autopickup, false);
        assert.equal(opts.showExp, true);
        assert.equal(opts.color, false);
    });

    it('getOption returns individual values', () => {
        saveOptions({ autopickup: false });
        assert.equal(getOption('autopickup'), false);
        assert.equal(getOption('showExp'), true); // default
    });

    it('setOption updates a single value', () => {
        setOption('color', false);
        assert.equal(getOption('color'), false);
        assert.equal(getOption('autopickup'), true); // unchanged
    });

    it('loadOptions merges saved with defaults for new keys', () => {
        // Simulate a save from older version missing a key
        store.set('webhack-options', JSON.stringify({ autopickup: false }));
        const opts = loadOptions();
        assert.equal(opts.autopickup, false);
        assert.equal(opts.showExp, true); // default filled in
        assert.equal(opts.color, true);   // default filled in
    });

    it('handles corrupt options gracefully', () => {
        store.set('webhack-options', 'not-json');
        const opts = loadOptions();
        // Should fall back to defaults
        assert.equal(opts.autopickup, true);
    });
});

// ========================================================================
// Multi-level save round-trip (v2 format)
// ========================================================================
describe('Multi-level save (v2 format)', () => {
    beforeEach(() => {
        store.clear();
    });

    it('saves and restores multiple dungeon levels', () => {
        initRng(42);
        initLevelGeneration();

        const map1 = makelevel(1);
        wallification(map1);
        const map3 = makelevel(3);
        wallification(map3);

        const player = new Player();
        player.initRole(11);
        player.dungeonLevel = 3;

        const game = {
            player,
            map: map3,
            display: { messages: [] },
            levels: { 1: map1, 3: map3 },
            seed: 42, turnCount: 100, wizard: false, seerTurn: 120,
            _rngAccessors: { getRngState, getRngCallCount },
        };
        saveGame(game);
        const loaded = loadSave();

        // v2 format: currentLevel is the current level, otherLevels has the rest
        assert.ok(loaded.currentLevel, 'Current level (3) should be in currentLevel');
        assert.ok(loaded.otherLevels['1'], 'Level 1 should be in otherLevels');
        assert.equal(loaded.currentDepth, 3);

        // Restore both levels
        const r3 = restLev(loaded.currentLevel);
        const r1 = restLev(loaded.otherLevels['1']);
        assert.equal(r1.rooms.length, map1.rooms.length);
        assert.equal(r3.rooms.length, map3.rooms.length);
        // Stairs should be different
        assert.notDeepEqual(
            { x: r1.upstair.x, y: r1.upstair.y },
            { x: r3.upstair.x, y: r3.upstair.y }
        );
    });
});

// ========================================================================
// saveGameState / restGameState -- C ref: savegamestate / restgamestate
// ========================================================================
describe('saveGameState/restGameState round-trip', () => {
    it('round-trips full game state including inventory and equip', () => {
        initRng(42);
        initLevelGeneration();

        const player = new Player();
        player.initRole(11); // Valkyrie
        player.x = 15;
        player.y = 8;
        player.name = 'TestHero';
        player.gold = 100;

        const dagger = { name: 'dagger', oclass: 1, otyp: 5, owt: 10, spe: 0,
                         blessed: false, cursed: false, displayChar: ')' };
        player.addToInventory(dagger);
        player.weapon = dagger;

        const game = {
            player,
            map: null,
            display: { messages: ['test message'] },
            levels: {},
            seed: 42, turnCount: 10, wizard: true, seerTurn: 25,
            _rngAccessors: { getRngState, getRngCallCount },
        };

        const gs = saveGameState(game);
        const json = JSON.stringify(gs);
        const restored = restGameState(JSON.parse(json));

        assert.equal(restored.player.name, 'TestHero');
        assert.equal(restored.player.x, 15);
        assert.equal(restored.player.gold, 100);
        assert.equal(restored.player.inventory.length, 1);
        assert.equal(restored.player.inventory[0].name, 'dagger');
        assert.equal(restored.player.weapon, restored.player.inventory[0]);
        assert.equal(restored.turnCount, 10);
        assert.equal(restored.wizard, true);
        assert.equal(restored.seerTurn, 25);
        assert.equal(restored.seed, 42);
        assert.deepEqual(restored.messages, ['test message']);
    });
});
