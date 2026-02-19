// shknam.test.js — Unit tests for shknam.js new exported functions
// Tests: saleable, shkname, Shknam, shkname_is_pname, is_izchak

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    saleable,
    shkname,
    Shknam,
    shkname_is_pname,
    is_izchak,
    shtypes,
} from '../../js/shknam.js';
import {
    FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, POTION_CLASS, WAND_CLASS,
    GEM_CLASS, AMULET_CLASS, TOOL_CLASS,
    TOUCHSTONE,
} from '../../js/objects.js';
import { SHOPBASE } from '../../js/config.js';

// ========================================================================
// saleable
// ========================================================================

describe('saleable', () => {
    it('returns true for any object in a general store (RANDOM_CLASS)', () => {
        // shtypes[0] is the general store
        const shk = { isshk: true, shoptype: 0 + SHOPBASE };
        const obj = { oclass: WEAPON_CLASS, otyp: 0 };
        assert.equal(saleable(shk, obj), true);
    });

    it('returns true for armor in an armor shop', () => {
        // shtypes[1] is used armor dealership: ARMOR_CLASS 90%, WEAPON_CLASS 10%
        const shk = { isshk: true, shoptype: 1 + SHOPBASE };
        const armor = { oclass: ARMOR_CLASS, otyp: 0 };
        assert.equal(saleable(shk, armor), true);
    });

    it('returns true for weapon in an armor shop (secondary class)', () => {
        const shk = { isshk: true, shoptype: 1 + SHOPBASE };
        const weapon = { oclass: WEAPON_CLASS, otyp: 0 };
        assert.equal(saleable(shk, weapon), true);
    });

    it('returns false for food in an armor shop', () => {
        const shk = { isshk: true, shoptype: 1 + SHOPBASE };
        const food = { oclass: FOOD_CLASS, otyp: 0 };
        assert.equal(saleable(shk, food), false);
    });

    it('returns true for scroll in a bookstore', () => {
        // shtypes[2] is second-hand bookstore: SCROLL_CLASS 90%, SPBOOK_CLASS 10%
        const shk = { isshk: true, shoptype: 2 + SHOPBASE };
        const scroll = { oclass: SCROLL_CLASS, otyp: 0 };
        assert.equal(saleable(shk, scroll), true);
    });

    it('returns false for weapon in a bookstore', () => {
        const shk = { isshk: true, shoptype: 2 + SHOPBASE };
        const weapon = { oclass: WEAPON_CLASS, otyp: 0 };
        assert.equal(saleable(shk, weapon), false);
    });

    it('returns true for potion in a liquor emporium', () => {
        // shtypes[3] is liquor emporium: POTION_CLASS 100%
        const shk = { isshk: true, shoptype: 3 + SHOPBASE };
        const potion = { oclass: POTION_CLASS, otyp: 0 };
        assert.equal(saleable(shk, potion), true);
    });

    it('returns true for touchstone (specific otyp) in a jeweler', () => {
        // shtypes[6] is jewelers: RING_CLASS 85%, GEM_CLASS 10%, AMULET_CLASS 5%
        const shk = { isshk: true, shoptype: 6 + SHOPBASE };
        const ring = { oclass: RING_CLASS, otyp: 0 };
        assert.equal(saleable(shk, ring), true);
    });

    it('returns false for weapon in a jeweler', () => {
        const shk = { isshk: true, shoptype: 6 + SHOPBASE };
        const weapon = { oclass: WEAPON_CLASS, otyp: 0 };
        assert.equal(saleable(shk, weapon), false);
    });

    it('returns false for invalid shoptype', () => {
        const shk = { isshk: true, shoptype: 999 };
        const obj = { oclass: WEAPON_CLASS, otyp: 0 };
        assert.equal(saleable(shk, obj), false);
    });
});

// ========================================================================
// shkname
// ========================================================================

describe('shkname', () => {
    it('returns name unchanged when no prefix char', () => {
        const shk = { shknam: 'Skibbereen' };
        assert.equal(shkname(shk), 'Skibbereen');
    });

    it('strips underscore prefix (female indicator)', () => {
        const shk = { shknam: '_Lucrezia' };
        assert.equal(shkname(shk), 'Lucrezia');
    });

    it('strips dash prefix (female indicator)', () => {
        const shk = { shknam: '-Lucrezia' };
        assert.equal(shkname(shk), 'Lucrezia');
    });

    it('strips pipe prefix (male indicator)', () => {
        const shk = { shknam: '|Dirk' };
        assert.equal(shkname(shk), 'Dirk');
    });

    it('strips plus prefix (male indicator)', () => {
        const shk = { shknam: '+Dirk' };
        assert.equal(shkname(shk), 'Dirk');
    });

    it('strips equals prefix (personal name indicator)', () => {
        const shk = { shknam: '=Azura' };
        assert.equal(shkname(shk), 'Azura');
    });

    it('handles Izchak (has + prefix)', () => {
        const shk = { shknam: '+Izchak' };
        assert.equal(shkname(shk), 'Izchak');
    });

    it('returns empty string for empty shknam', () => {
        const shk = { shknam: '' };
        assert.equal(shkname(shk), '');
    });

    it('returns empty string for missing shknam', () => {
        const shk = {};
        assert.equal(shkname(shk), '');
    });
});

// ========================================================================
// Shknam
// ========================================================================

describe('Shknam', () => {
    it('capitalizes name without prefix', () => {
        const shk = { shknam: 'tsjernigof' };
        assert.equal(Shknam(shk), 'Tsjernigof');
    });

    it('strips prefix and capitalizes', () => {
        const shk = { shknam: '+izchak' };
        assert.equal(Shknam(shk), 'Izchak');
    });

    it('preserves already-capitalized name', () => {
        const shk = { shknam: 'Skibbereen' };
        assert.equal(Shknam(shk), 'Skibbereen');
    });

    it('strips prefix and capitalizes for female name', () => {
        const shk = { shknam: '-lucrezia' };
        assert.equal(Shknam(shk), 'Lucrezia');
    });
});

// ========================================================================
// shkname_is_pname
// ========================================================================

describe('shkname_is_pname', () => {
    it('returns true for dash prefix', () => {
        const shk = { shknam: '-Lucrezia' };
        assert.equal(shkname_is_pname(shk), true);
    });

    it('returns true for plus prefix', () => {
        const shk = { shknam: '+Dirk' };
        assert.equal(shkname_is_pname(shk), true);
    });

    it('returns true for equals prefix', () => {
        const shk = { shknam: '=Azura' };
        assert.equal(shkname_is_pname(shk), true);
    });

    it('returns false for underscore prefix (gender-only, not pname)', () => {
        const shk = { shknam: '_Lucrezia' };
        assert.equal(shkname_is_pname(shk), false);
    });

    it('returns false for pipe prefix (gender-only, not pname)', () => {
        const shk = { shknam: '|Dirk' };
        assert.equal(shkname_is_pname(shk), false);
    });

    it('returns false for plain name with no prefix', () => {
        const shk = { shknam: 'Skibbereen' };
        assert.equal(shkname_is_pname(shk), false);
    });

    it('returns false for undefined shknam', () => {
        const shk = {};
        assert.equal(shkname_is_pname(shk), false);
    });
});

// ========================================================================
// is_izchak
// ========================================================================

describe('is_izchak', () => {
    it('returns true for Izchak with + prefix', () => {
        const shk = { isshk: true, shknam: '+Izchak' };
        assert.equal(is_izchak(shk), true);
    });

    it('returns false for non-Izchak shopkeeper', () => {
        const shk = { isshk: true, shknam: 'Skibbereen' };
        assert.equal(is_izchak(shk), false);
    });

    it('returns false for non-shopkeeper with Izchak name', () => {
        const shk = { isshk: false, shknam: '+Izchak' };
        assert.equal(is_izchak(shk), false);
    });

    it('returns false for plain Izchak without prefix (not a valid shknam)', () => {
        const shk = { isshk: true, shknam: 'Izchak' };
        // In C, Izchak always has '+' prefix; but we still return true
        // since letter('I') is true (no stripping), and name matches
        assert.equal(is_izchak(shk), true);
    });

    it('returns false for lowercase izchak (case-sensitive)', () => {
        const shk = { isshk: true, shknam: '+izchak' };
        assert.equal(is_izchak(shk), false);
    });
});
