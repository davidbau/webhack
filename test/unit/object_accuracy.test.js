/**
 * Object System Accuracy Tests
 *
 * Verify that object types, classes, and properties match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
  TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
  WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS,
  VENOM_CLASS
} from '../../js/objects.js';

describe('Object System Accuracy', () => {
  describe('Object Class Constants', () => {
    it('should match C NetHack object classes', () => {
      // C ref: objclass.h object class definitions
      assert.strictEqual(ILLOBJ_CLASS, 0, 'ILLOBJ_CLASS should be 0');
      assert.strictEqual(WEAPON_CLASS, 1, 'WEAPON_CLASS should be 1');
      assert.strictEqual(ARMOR_CLASS, 2, 'ARMOR_CLASS should be 2');
      assert.strictEqual(RING_CLASS, 3, 'RING_CLASS should be 3');
      assert.strictEqual(AMULET_CLASS, 4, 'AMULET_CLASS should be 4');
      assert.strictEqual(TOOL_CLASS, 5, 'TOOL_CLASS should be 5');
      assert.strictEqual(FOOD_CLASS, 6, 'FOOD_CLASS should be 6');
      assert.strictEqual(POTION_CLASS, 7, 'POTION_CLASS should be 7');
      assert.strictEqual(SCROLL_CLASS, 8, 'SCROLL_CLASS should be 8');
      assert.strictEqual(SPBOOK_CLASS, 9, 'SPBOOK_CLASS should be 9');
      assert.strictEqual(WAND_CLASS, 10, 'WAND_CLASS should be 10');
      assert.strictEqual(COIN_CLASS, 11, 'COIN_CLASS should be 11');
      assert.strictEqual(GEM_CLASS, 12, 'GEM_CLASS should be 12');
      assert.strictEqual(ROCK_CLASS, 13, 'ROCK_CLASS should be 13');
      assert.strictEqual(BALL_CLASS, 14, 'BALL_CLASS should be 14');
      assert.strictEqual(CHAIN_CLASS, 15, 'CHAIN_CLASS should be 15');
      assert.strictEqual(VENOM_CLASS, 16, 'VENOM_CLASS should be 16');
    });

    it('should have sequential class values', () => {
      // C ref: Object classes are sequential from 0 to 16
      const classes = [
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
        TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
        WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS,
        CHAIN_CLASS, VENOM_CLASS
      ];

      for (let i = 0; i < classes.length; i++) {
        assert.strictEqual(classes[i], i,
          `Class at position ${i} should have value ${i}`);
      }
    });
  });

  describe('Object Class Semantics', () => {
    it('ILLOBJ_CLASS should be first (invalid object)', () => {
      assert.strictEqual(ILLOBJ_CLASS, 0,
        'ILLOBJ_CLASS (illegal object) should be 0');
    });

    it('WEAPON_CLASS should come before ARMOR_CLASS', () => {
      assert(WEAPON_CLASS < ARMOR_CLASS,
        'Weapons should come before armor in class ordering');
    });

    it('magical classes should be grouped', () => {
      // Rings, amulets, potions, scrolls, spellbooks, wands are magical
      assert(RING_CLASS < AMULET_CLASS, 'RING before AMULET');
      assert(POTION_CLASS < SCROLL_CLASS, 'POTION before SCROLL');
      assert(SCROLL_CLASS < SPBOOK_CLASS, 'SCROLL before SPBOOK');
      assert(SPBOOK_CLASS < WAND_CLASS, 'SPBOOK before WAND');
    });

    it('COIN_CLASS should be distinct', () => {
      // Coins/gold are special
      assert.strictEqual(COIN_CLASS, 11, 'COIN_CLASS should be 11');
      assert(COIN_CLASS > WAND_CLASS, 'Coins come after wands');
      assert(COIN_CLASS < GEM_CLASS, 'Coins come before gems');
    });

    it('constraint objects should be last', () => {
      // Ball and chain are constraint objects for prisoners
      assert(BALL_CLASS > GEM_CLASS, 'BALL after normal objects');
      assert(CHAIN_CLASS > BALL_CLASS, 'CHAIN after BALL');
      assert(VENOM_CLASS > CHAIN_CLASS, 'VENOM is last');
    });
  });

  describe('Object Class Ranges', () => {
    it('all classes should be in valid range', () => {
      const classes = [
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
        TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
        WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS,
        CHAIN_CLASS, VENOM_CLASS
      ];

      for (const cls of classes) {
        assert(cls >= 0 && cls <= 20,
          `Object class ${cls} should be in range [0, 20]`);
      }
    });

    it('should have exactly 17 object classes', () => {
      // C ref: NetHack has 17 object classes (0-16)
      assert.strictEqual(VENOM_CLASS, 16,
        'VENOM_CLASS (last class) should be 16');
    });
  });

  describe('Object Class Uniqueness', () => {
    it('all class constants should be unique', () => {
      const classes = [
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
        TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
        WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS,
        CHAIN_CLASS, VENOM_CLASS
      ];

      const unique = new Set(classes);
      assert.strictEqual(unique.size, classes.length,
        'All object class constants should have unique values');
    });
  });

  describe('Common Object Classes', () => {
    it('should have standard adventure game classes', () => {
      // Verify the most common object types exist
      assert(typeof WEAPON_CLASS === 'number', 'WEAPON_CLASS defined');
      assert(typeof ARMOR_CLASS === 'number', 'ARMOR_CLASS defined');
      assert(typeof POTION_CLASS === 'number', 'POTION_CLASS defined');
      assert(typeof SCROLL_CLASS === 'number', 'SCROLL_CLASS defined');
      assert(typeof FOOD_CLASS === 'number', 'FOOD_CLASS defined');
      assert(typeof TOOL_CLASS === 'number', 'TOOL_CLASS defined');
    });

    it('should have magical item classes', () => {
      assert(typeof RING_CLASS === 'number', 'RING_CLASS defined');
      assert(typeof AMULET_CLASS === 'number', 'AMULET_CLASS defined');
      assert(typeof WAND_CLASS === 'number', 'WAND_CLASS defined');
      assert(typeof SPBOOK_CLASS === 'number', 'SPBOOK_CLASS defined');
    });

    it('should have treasure classes', () => {
      assert(typeof COIN_CLASS === 'number', 'COIN_CLASS defined');
      assert(typeof GEM_CLASS === 'number', 'GEM_CLASS defined');
    });

    it('should have special/constraint classes', () => {
      assert(typeof ROCK_CLASS === 'number', 'ROCK_CLASS defined');
      assert(typeof BALL_CLASS === 'number', 'BALL_CLASS defined');
      assert(typeof CHAIN_CLASS === 'number', 'CHAIN_CLASS defined');
      assert(typeof VENOM_CLASS === 'number', 'VENOM_CLASS defined');
    });
  });

  describe('Object Class Categorization', () => {
    it('wearable classes should be in correct range', () => {
      // Armor and rings are wearable
      assert(ARMOR_CLASS > ILLOBJ_CLASS, 'Armor is valid object');
      assert(RING_CLASS > ILLOBJ_CLASS, 'Rings are valid objects');
      assert(AMULET_CLASS > ILLOBJ_CLASS, 'Amulets are valid objects');
    });

    it('consumable classes should be distinct', () => {
      // Food, potions, scrolls are consumed
      const consumables = [FOOD_CLASS, POTION_CLASS, SCROLL_CLASS];
      const unique = new Set(consumables);
      assert.strictEqual(unique.size, 3, 'Consumables should be distinct');
    });

    it('throwable weapon classes should exist', () => {
      // Weapons can be thrown
      assert(WEAPON_CLASS > ILLOBJ_CLASS, 'Weapons exist');
      assert(WEAPON_CLASS < ARMOR_CLASS, 'Weapons before armor');
    });
  });

  describe('Special Object Handling', () => {
    it('ILLOBJ_CLASS should never be used for real objects', () => {
      // ILLOBJ_CLASS (0) represents invalid/illegal objects
      assert.strictEqual(ILLOBJ_CLASS, 0,
        'ILLOBJ_CLASS is 0 (falsy value for validation)');
    });

    it('COIN_CLASS should be special', () => {
      // Coins/gold have unique stacking and display
      assert.strictEqual(COIN_CLASS, 11, 'Coins are class 11');
      assert(COIN_CLASS !== ILLOBJ_CLASS, 'Coins are valid objects');
    });

    it('VENOM_CLASS should be last', () => {
      // Venom is added late in NetHack development
      assert.strictEqual(VENOM_CLASS, 16, 'VENOM_CLASS is highest (16)');
    });
  });

  describe('Object Class Documentation', () => {
    it('class values should match C objclass.h comments', () => {
      // C ref: objclass.h has specific class ordering and values
      // ILLOBJ=0, WEAPON=1, ARMOR=2, RING=3, AMULET=4, TOOL=5,
      // FOOD=6, POTION=7, SCROLL=8, SPBOOK=9, WAND=10, COIN=11,
      // GEM=12, ROCK=13, BALL=14, CHAIN=15, VENOM=16

      const expected = {
        ILLOBJ_CLASS: 0, WEAPON_CLASS: 1, ARMOR_CLASS: 2, RING_CLASS: 3,
        AMULET_CLASS: 4, TOOL_CLASS: 5, FOOD_CLASS: 6, POTION_CLASS: 7,
        SCROLL_CLASS: 8, SPBOOK_CLASS: 9, WAND_CLASS: 10, COIN_CLASS: 11,
        GEM_CLASS: 12, ROCK_CLASS: 13, BALL_CLASS: 14, CHAIN_CLASS: 15,
        VENOM_CLASS: 16
      };

      assert.strictEqual(ILLOBJ_CLASS, expected.ILLOBJ_CLASS);
      assert.strictEqual(WEAPON_CLASS, expected.WEAPON_CLASS);
      assert.strictEqual(ARMOR_CLASS, expected.ARMOR_CLASS);
      assert.strictEqual(RING_CLASS, expected.RING_CLASS);
      assert.strictEqual(AMULET_CLASS, expected.AMULET_CLASS);
      assert.strictEqual(TOOL_CLASS, expected.TOOL_CLASS);
      assert.strictEqual(FOOD_CLASS, expected.FOOD_CLASS);
      assert.strictEqual(POTION_CLASS, expected.POTION_CLASS);
      assert.strictEqual(SCROLL_CLASS, expected.SCROLL_CLASS);
      assert.strictEqual(SPBOOK_CLASS, expected.SPBOOK_CLASS);
      assert.strictEqual(WAND_CLASS, expected.WAND_CLASS);
      assert.strictEqual(COIN_CLASS, expected.COIN_CLASS);
      assert.strictEqual(GEM_CLASS, expected.GEM_CLASS);
      assert.strictEqual(ROCK_CLASS, expected.ROCK_CLASS);
      assert.strictEqual(BALL_CLASS, expected.BALL_CLASS);
      assert.strictEqual(CHAIN_CLASS, expected.CHAIN_CLASS);
      assert.strictEqual(VENOM_CLASS, expected.VENOM_CLASS);
    });
  });
});
