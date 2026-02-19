// test/unit/makemon.test.js -- Tests for C-faithful monster creation
// C ref: makemon.c -- verifies makemon(), mons[], and level generation monsters

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initRng } from '../../js/rng.js';
import { ACCESSIBLE } from '../../js/config.js';
import { makemon, rndmonnum, NO_MM_FLAGS, MM_NOGRP, setMakemonPlayerContext, mbirth_limit } from '../../js/makemon.js';
import { mons, PM_NAZGUL, PM_ERINYS, PM_LITTLE_DOG } from '../../js/monsters.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';

describe('Monster creation (C-faithful)', () => {
    it('mons[] has many entries', () => {
        assert.ok(mons.length > 300, `Expected >300 monster types, got ${mons.length}`);
    });

    it('makemon creates a valid monster with known mndx', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const room = map.rooms[0];
        const cx = Math.floor((room.lx + room.hx) / 2);
        const cy = Math.floor((room.ly + room.hy) / 2);

        // Find a grid bug in mons[]
        const mndx = mons.findIndex(m => m.name === 'grid bug');
        assert.ok(mndx >= 0, 'grid bug should exist in mons[]');

        const mon = makemon(mndx, cx, cy, NO_MM_FLAGS, 1, map);
        assert.ok(mon, 'Should create a monster');
        assert.equal(mon.mx, cx);
        assert.equal(mon.my, cy);
        assert.ok(mon.mhp > 0, 'Monster should have HP');
        assert.ok(mon.speed > 0, 'Monster should have speed');
        assert.equal(mon.name, 'grid bug');
        assert.equal(typeof mon.displayChar, 'string');
        assert.ok(!mon.dead, 'New monster should not be dead');
    });

    it('makemon with null selects random monster', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const room = map.rooms[0];
        const cx = Math.floor((room.lx + room.hx) / 2);
        const cy = Math.floor((room.ly + room.hy) / 2);

        const mon = makemon(null, cx, cy, NO_MM_FLAGS, 1, map);
        assert.ok(mon, 'Should create a random monster');
        assert.ok(mon.mhp > 0, 'Monster should have HP');
        assert.ok(mon.name, 'Monster should have a name');
    });

    it('rndmonnum returns valid monster index', () => {
        initRng(42);
        for (let i = 0; i < 20; i++) {
            const mndx = rndmonnum(1);
            assert.ok(mndx >= 0 && mndx < mons.length,
                `rndmonnum should return valid index, got ${mndx}`);
        }
    });

    it('makemon peace_minded follows player alignment context', () => {
        const gremlin = mons.findIndex(m => m.name === 'gremlin');
        assert.ok(gremlin >= 0, 'gremlin should exist in mons[]');

        // Use a simple accessible tile map so only monster-creation logic is exercised.
        const map = { monsters: [], at: () => ({ typ: 100 }) };

        initRng(1234);
        setMakemonPlayerContext({
            roleIndex: 1, alignment: -1, alignmentRecord: 10, race: 0, inventory: [],
        });
        const chaoticGremlin = makemon(gremlin, 10, 10, NO_MM_FLAGS, 1, map);
        assert.equal(chaoticGremlin.peaceful, true);

        initRng(1234);
        map.monsters = [];
        setMakemonPlayerContext({
            roleIndex: 4, alignment: 1, alignmentRecord: 10, race: 0, inventory: [],
        });
        const lawfulGremlin = makemon(gremlin, 10, 10, NO_MM_FLAGS, 1, map);
        assert.equal(lawfulGremlin.peaceful, false);
    });
});

describe('Level monster population (C-faithful)', () => {
    it('makelevel places monsters on the map', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        assert.ok(map.monsters.length > 0, 'Level should have monsters');
    });

    it('monsters are placed on accessible terrain', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        for (const mon of map.monsters) {
            const loc = map.at(mon.mx, mon.my);
            assert.ok(loc && ACCESSIBLE(loc.typ),
                `Monster "${mon.name}" at ${mon.mx},${mon.my} should be on accessible terrain`);
        }
    });

    it('no two monsters share the same tile', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        const positions = new Set();
        for (const mon of map.monsters) {
            const key = `${mon.mx},${mon.my}`;
            assert.ok(!positions.has(key),
                `Two monsters at ${key}`);
            positions.add(key);
        }
    });

    it('monsters have C-faithful properties', () => {
        initRng(42);
        initLevelGeneration();
        const map = makelevel(1);
        wallification(map);

        for (const mon of map.monsters) {
            assert.equal(typeof mon.mndx, 'number', `${mon.name} should have mndx`);
            assert.ok(mon.mndx >= 0 && mon.mndx < mons.length,
                `${mon.name} mndx ${mon.mndx} should be valid`);
            assert.ok(mon.mhp > 0, `${mon.name} should have positive HP`);
            assert.ok(mon.speed >= 0, `${mon.name} should have non-negative speed`);
            assert.ok(Array.isArray(mon.attacks), `${mon.name} should have attacks array`);
            assert.ok(Array.isArray(mon.mtrack), `${mon.name} should have mtrack array`);
        }
    });
});

// ========================================================================
// mbirth_limit
// ========================================================================

describe('mbirth_limit', () => {
    it('returns 9 for PM_NAZGUL', () => {
        assert.equal(mbirth_limit(PM_NAZGUL), 9);
    });

    it('returns 3 for PM_ERINYS', () => {
        assert.equal(mbirth_limit(PM_ERINYS), 3);
    });

    it('returns 120 (MAXMONNO) for ordinary monsters', () => {
        assert.equal(mbirth_limit(PM_LITTLE_DOG), 120);
    });

    it('returns 120 for index 0', () => {
        assert.equal(mbirth_limit(0), 120);
    });
});
