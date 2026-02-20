// pickup_types.test.js -- Unit tests for pickup_types filtering
// Tests the shouldAutopickup function and pickup_types option

import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
    WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
    TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS,
    SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS
} from '../../js/symbols.js';

describe('pickup types', () => {

// Helper function extracted from commands.js for testing
function shouldAutopickup(obj, pickupTypes) {
    if (!pickupTypes || pickupTypes === '') {
        return true;
    }

    const classToSymbol = {
        [WEAPON_CLASS]: ')',
        [ARMOR_CLASS]: '[',
        [RING_CLASS]: '=',
        [AMULET_CLASS]: '"',
        [TOOL_CLASS]: '(',
        [FOOD_CLASS]: '%',
        [POTION_CLASS]: '!',
        [SCROLL_CLASS]: '?',
        [SPBOOK_CLASS]: '+',
        [WAND_CLASS]: '/',
        [COIN_CLASS]: '$',
        [GEM_CLASS]: '*',
        [ROCK_CLASS]: '`',
    };

    const symbol = classToSymbol[obj.oclass];
    return symbol && pickupTypes.includes(symbol);
}

test('pickup_types: empty string picks up all types', () => {
    const potion = { oclass: POTION_CLASS, name: 'potion' };
    const scroll = { oclass: SCROLL_CLASS, name: 'scroll' };
    const weapon = { oclass: WEAPON_CLASS, name: 'sword' };

    assert.strictEqual(shouldAutopickup(potion, ''), true);
    assert.strictEqual(shouldAutopickup(scroll, ''), true);
    assert.strictEqual(shouldAutopickup(weapon, ''), true);
});

test('pickup_types: gold only ("$")', () => {
    const gold = { oclass: COIN_CLASS, name: 'gold' };
    const potion = { oclass: POTION_CLASS, name: 'potion' };

    assert.strictEqual(shouldAutopickup(gold, '$'), true);
    assert.strictEqual(shouldAutopickup(potion, '$'), false);
});

test('pickup_types: potions and scrolls ("!?")', () => {
    const potion = { oclass: POTION_CLASS, name: 'potion' };
    const scroll = { oclass: SCROLL_CLASS, name: 'scroll' };
    const weapon = { oclass: WEAPON_CLASS, name: 'sword' };

    assert.strictEqual(shouldAutopickup(potion, '!?'), true);
    assert.strictEqual(shouldAutopickup(scroll, '!?'), true);
    assert.strictEqual(shouldAutopickup(weapon, '!?'), false);
});

test('pickup_types: common valuable items ("$/!?=+")', () => {
    const gold = { oclass: COIN_CLASS, name: 'gold' };
    const potion = { oclass: POTION_CLASS, name: 'potion' };
    const scroll = { oclass: SCROLL_CLASS, name: 'scroll' };
    const ring = { oclass: RING_CLASS, name: 'ring' };
    const spellbook = { oclass: SPBOOK_CLASS, name: 'spellbook' };
    const weapon = { oclass: WEAPON_CLASS, name: 'sword' };
    const armor = { oclass: ARMOR_CLASS, name: 'armor' };

    assert.strictEqual(shouldAutopickup(gold, '$/!?=+'), true);
    assert.strictEqual(shouldAutopickup(potion, '$/!?=+'), true);
    assert.strictEqual(shouldAutopickup(scroll, '$/!?=+'), true);
    assert.strictEqual(shouldAutopickup(ring, '$/!?=+'), true);
    assert.strictEqual(shouldAutopickup(spellbook, '$/!?=+'), true);
    assert.strictEqual(shouldAutopickup(weapon, '$/!?=+'), false);
    assert.strictEqual(shouldAutopickup(armor, '$/!?=+'), false);
});

test('pickup_types: all object class symbols work', () => {
    const testCases = [
        { oclass: WEAPON_CLASS, symbol: ')', name: 'weapon' },
        { oclass: ARMOR_CLASS, symbol: '[', name: 'armor' },
        { oclass: RING_CLASS, symbol: '=', name: 'ring' },
        { oclass: AMULET_CLASS, symbol: '"', name: 'amulet' },
        { oclass: TOOL_CLASS, symbol: '(', name: 'tool' },
        { oclass: FOOD_CLASS, symbol: '%', name: 'food' },
        { oclass: POTION_CLASS, symbol: '!', name: 'potion' },
        { oclass: SCROLL_CLASS, symbol: '?', name: 'scroll' },
        { oclass: SPBOOK_CLASS, symbol: '+', name: 'spellbook' },
        { oclass: WAND_CLASS, symbol: '/', name: 'wand' },
        { oclass: COIN_CLASS, symbol: '$', name: 'gold' },
        { oclass: GEM_CLASS, symbol: '*', name: 'gem' },
        { oclass: ROCK_CLASS, symbol: '`', name: 'rock' },
    ];

    for (const tc of testCases) {
        const obj = { oclass: tc.oclass, name: tc.name };
        assert.strictEqual(shouldAutopickup(obj, tc.symbol), true,
            `${tc.name} (${tc.symbol}) should be picked up`);
        assert.strictEqual(shouldAutopickup(obj, 'x'), false,
            `${tc.name} should not be picked up with types='x'`);
    }
});

test('pickup_types: order does not matter', () => {
    const potion = { oclass: POTION_CLASS, name: 'potion' };
    const scroll = { oclass: SCROLL_CLASS, name: 'scroll' };

    assert.strictEqual(shouldAutopickup(potion, '!?'), true);
    assert.strictEqual(shouldAutopickup(potion, '?!'), true);
    assert.strictEqual(shouldAutopickup(scroll, '!?'), true);
    assert.strictEqual(shouldAutopickup(scroll, '?!'), true);
});

}); // describe
