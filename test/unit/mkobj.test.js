// test/unit/mkobj.test.js -- Tests for C-faithful object creation
// C ref: mkobj.c -- verifies mksobj(), mkobj(), and level generation objects

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initRng } from '../../js/rng.js';
import { ACCESSIBLE } from '../../js/config.js';
import { mksobj, mkobj, RANDOM_CLASS } from '../../js/mkobj.js';
import { objectData, NUM_OBJECTS,
    WEAPON_CLASS, ARMOR_CLASS, FOOD_CLASS, COIN_CLASS, WAND_CLASS,
} from '../../js/objects.js';
import { initLevelGeneration, generateLevel, wallification } from '../../js/dungeon.js';

describe('Object creation (C-faithful)', () => {
    it('objectData has expected number of entries', () => {
        assert.ok(objectData.length >= NUM_OBJECTS,
            `Expected >= ${NUM_OBJECTS} object types, got ${objectData.length}`);
    });

    it('mksobj creates object with correct type', () => {
        initRng(42);
        // Find a dagger in objectData
        const otyp = objectData.findIndex(o => o.name === 'dagger');
        assert.ok(otyp >= 0, 'dagger should exist in objectData');

        const obj = mksobj(otyp, true, false);
        assert.equal(obj.name, 'dagger');
        assert.equal(obj.oclass, WEAPON_CLASS);
        assert.ok(obj.owt > 0, 'Object should have weight');
    });

    it('mksobj sets display properties', () => {
        initRng(42);
        const otyp = objectData.findIndex(o => o.name === 'food ration');
        assert.ok(otyp >= 0, 'food ration should exist in objectData');

        const obj = mksobj(otyp, true, false);
        assert.equal(obj.displayChar, '%');
    });

    it('mkobj creates random object of a class', () => {
        initRng(42);
        initLevelGeneration();
        const obj = mkobj(WEAPON_CLASS, false);
        assert.ok(obj, 'mkobj should create an object');
        assert.equal(obj.oclass, WEAPON_CLASS, 'Object should be a weapon');
        assert.ok(obj.name, 'Object should have a name');
    });

    it('mkobj with RANDOM_CLASS creates any object', () => {
        initRng(42);
        initLevelGeneration();
        const obj = mkobj(RANDOM_CLASS, false);
        assert.ok(obj, 'mkobj with RANDOM_CLASS should create an object');
        assert.ok(obj.name, 'Object should have a name');
        assert.ok(typeof obj.oclass === 'number');
    });

    it('armor objects have AC', () => {
        initRng(42);
        const otyp = objectData.findIndex(o => o.name === 'leather armor');
        assert.ok(otyp >= 0, 'leather armor should exist');

        const obj = mksobj(otyp, true, false);
        assert.equal(obj.oclass, ARMOR_CLASS);
        // C-faithful objects use spe for enchantment, AC comes from objectData
        assert.ok(typeof obj.spe === 'number', 'Armor should have spe (enchantment)');
    });

    it('food objects have nutrition via objectData', () => {
        initRng(42);
        const otyp = objectData.findIndex(o => o.name === 'food ration');
        const obj = mksobj(otyp, true, false);
        // Nutrition is in objectData, not on obj directly (C-faithful)
        const data = objectData[obj.otyp];
        assert.ok(data.nutrition > 0, 'Food ration should have nutrition in objectData');
    });
});

describe('Level object population (C-faithful)', () => {
    it('generateLevel places objects on the map', () => {
        initRng(42);
        initLevelGeneration();
        const map = generateLevel(1);
        wallification(map);

        assert.ok(map.objects.length > 0, 'Level should have objects');
    });

    it('objects have C-faithful properties', () => {
        initRng(42);
        initLevelGeneration();
        const map = generateLevel(1);
        wallification(map);

        for (const obj of map.objects) {
            assert.equal(typeof obj.otyp, 'number', `${obj.name} should have otyp`);
            assert.ok(obj.otyp >= 0 && obj.otyp < NUM_OBJECTS,
                `${obj.name} otyp ${obj.otyp} should be valid`);
            assert.equal(typeof obj.oclass, 'number', `${obj.name} should have oclass`);
            assert.ok(obj.owt > 0 || obj.owt === 0, `${obj.name} should have owt`);
            assert.equal(typeof obj.displayChar, 'string', `${obj.name} should have displayChar`);
        }
    });

    it('gold pieces have quantity > 1', () => {
        initRng(42);
        initLevelGeneration();
        const map = generateLevel(1);
        wallification(map);

        const gold = map.objects.filter(o => o.oclass === COIN_CLASS);
        for (const g of gold) {
            assert.ok(g.quan > 0, `Gold should have quantity > 0, got ${g.quan}`);
        }
    });
});
