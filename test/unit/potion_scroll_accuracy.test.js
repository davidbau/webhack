/**
 * Potion and Scroll Accuracy Tests
 *
 * Verify that potion (POT_*) and scroll (SCR_*) constants match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  POTION_CLASS,
  SCROLL_CLASS,
  // Beneficial potions
  POT_GAIN_ABILITY,
  POT_RESTORE_ABILITY,
  POT_SPEED,
  POT_LEVITATION,
  POT_INVISIBILITY,
  POT_SEE_INVISIBLE,
  POT_HEALING,
  POT_EXTRA_HEALING,
  POT_FULL_HEALING,
  POT_GAIN_LEVEL,
  POT_ENLIGHTENMENT,
  POT_MONSTER_DETECTION,
  POT_OBJECT_DETECTION,
  POT_GAIN_ENERGY,
  // Harmful potions
  POT_CONFUSION,
  POT_BLINDNESS,
  POT_PARALYSIS,
  POT_HALLUCINATION,
  POT_SLEEPING,
  POT_SICKNESS,
  POT_ACID,
  // Transformation potions
  POT_POLYMORPH,
  // Misc potions
  POT_BOOZE,
  POT_FRUIT_JUICE,
  POT_OIL,
  POT_WATER,
  // Beneficial scrolls
  SCR_ENCHANT_ARMOR,
  SCR_ENCHANT_WEAPON,
  SCR_REMOVE_CURSE,
  SCR_TAMING,
  SCR_LIGHT,
  SCR_TELEPORTATION,
  SCR_GOLD_DETECTION,
  SCR_FOOD_DETECTION,
  SCR_IDENTIFY,
  SCR_MAGIC_MAPPING,
  SCR_CHARGING,
  // Harmful scrolls
  SCR_DESTROY_ARMOR,
  SCR_CONFUSE_MONSTER,
  SCR_SCARE_MONSTER,
  SCR_CREATE_MONSTER,
  SCR_GENOCIDE,
  SCR_FIRE,
  SCR_EARTH,
  SCR_PUNISHMENT,
  SCR_STINKING_CLOUD,
  SCR_AMNESIA,
  // Special scrolls
  SCR_BLANK_PAPER
} from '../../js/objects.js';

describe('Potion and Scroll Accuracy', () => {
  describe('Object Class Constants', () => {
    it('POTION_CLASS should be 7', () => {
      // C ref: include/objclass.h POTION_CLASS
      assert.strictEqual(POTION_CLASS, 7, 'POTION_CLASS should be 7');
    });

    it('SCROLL_CLASS should be 8', () => {
      // C ref: include/objclass.h SCROLL_CLASS
      assert.strictEqual(SCROLL_CLASS, 8, 'SCROLL_CLASS should be 8');
    });

    it('scrolls should come after potions', () => {
      assert(SCROLL_CLASS > POTION_CLASS, 'SCROLL_CLASS follows POTION_CLASS');
      assert.strictEqual(SCROLL_CLASS - POTION_CLASS, 1, 'Sequential classes');
    });
  });

  describe('Potion Index Range', () => {
    it('POT_GAIN_ABILITY should be first potion (295)', () => {
      // C ref: include/obj.h potion indices start at 295
      assert.strictEqual(POT_GAIN_ABILITY, 295, 'POT_GAIN_ABILITY should be 295');
    });

    it('POT_WATER should be last potion (320)', () => {
      assert.strictEqual(POT_WATER, 320, 'POT_WATER should be 320');
    });

    it('potion range should span 26 potions (295-320)', () => {
      const potionCount = POT_WATER - POT_GAIN_ABILITY + 1;
      assert.strictEqual(potionCount, 26, 'Should have 26 potions total');
    });
  });

  describe('Scroll Index Range', () => {
    it('SCR_ENCHANT_ARMOR should be first scroll (321)', () => {
      // C ref: include/obj.h scroll indices start at 321
      assert.strictEqual(SCR_ENCHANT_ARMOR, 321, 'SCR_ENCHANT_ARMOR should be 321');
    });

    it('SCR_BLANK_PAPER should be last scroll (362)', () => {
      assert.strictEqual(SCR_BLANK_PAPER, 362, 'SCR_BLANK_PAPER should be 362');
    });

    it('scroll range should span from 321-362', () => {
      // Note: Not all indices are used (gaps in numbering)
      assert(SCR_BLANK_PAPER > SCR_ENCHANT_ARMOR,
        'Scroll range from ENCHANT_ARMOR to BLANK_PAPER');
    });
  });

  describe('Beneficial Potions', () => {
    it('should have correct indices for beneficial potions', () => {
      assert.strictEqual(POT_GAIN_ABILITY, 295, 'POT_GAIN_ABILITY should be 295');
      assert.strictEqual(POT_RESTORE_ABILITY, 296, 'POT_RESTORE_ABILITY should be 296');
      assert.strictEqual(POT_SPEED, 300, 'POT_SPEED should be 300');
      assert.strictEqual(POT_HEALING, 305, 'POT_HEALING should be 305');
      assert.strictEqual(POT_EXTRA_HEALING, 306, 'POT_EXTRA_HEALING should be 306');
      assert.strictEqual(POT_FULL_HEALING, 313, 'POT_FULL_HEALING should be 313');
      assert.strictEqual(POT_GAIN_LEVEL, 307, 'POT_GAIN_LEVEL should be 307');
      assert.strictEqual(POT_GAIN_ENERGY, 311, 'POT_GAIN_ENERGY should be 311');
    });

    it('should have healing progression', () => {
      // Healing -> Extra Healing -> Full Healing
      assert(POT_HEALING < POT_EXTRA_HEALING, 'Extra healing follows healing');
      assert(POT_EXTRA_HEALING < POT_FULL_HEALING, 'Full healing is most powerful');
    });

    it('should have ability potions', () => {
      assert(typeof POT_GAIN_ABILITY === 'number', 'Gain ability potion');
      assert(typeof POT_RESTORE_ABILITY === 'number', 'Restore ability potion');
    });

    it('should have detection potions', () => {
      assert(typeof POT_MONSTER_DETECTION === 'number', 'Monster detection');
      assert(typeof POT_OBJECT_DETECTION === 'number', 'Object detection');
    });

    it('should have enhancement potions', () => {
      assert(typeof POT_SPEED === 'number', 'Speed potion');
      assert(typeof POT_LEVITATION === 'number', 'Levitation potion');
      assert(typeof POT_INVISIBILITY === 'number', 'Invisibility potion');
      assert(typeof POT_SEE_INVISIBLE === 'number', 'See invisible potion');
    });
  });

  describe('Harmful Potions', () => {
    it('should have correct indices for harmful potions', () => {
      assert.strictEqual(POT_CONFUSION, 297, 'POT_CONFUSION should be 297');
      assert.strictEqual(POT_BLINDNESS, 298, 'POT_BLINDNESS should be 298');
      assert.strictEqual(POT_PARALYSIS, 299, 'POT_PARALYSIS should be 299');
      assert.strictEqual(POT_HALLUCINATION, 302, 'POT_HALLUCINATION should be 302');
      assert.strictEqual(POT_SLEEPING, 312, 'POT_SLEEPING should be 312');
      assert.strictEqual(POT_SICKNESS, 316, 'POT_SICKNESS should be 316');
      assert.strictEqual(POT_ACID, 318, 'POT_ACID should be 318');
    });

    it('should have status effect potions', () => {
      const statusPotions = [
        POT_CONFUSION, POT_BLINDNESS, POT_PARALYSIS,
        POT_HALLUCINATION, POT_SLEEPING
      ];

      for (const pot of statusPotions) {
        assert(pot >= 295 && pot <= 320, 'Status potion in valid range');
      }
    });
  });

  describe('Special Potions', () => {
    it('should have transformation potions', () => {
      assert.strictEqual(POT_POLYMORPH, 314, 'POT_POLYMORPH should be 314');
    });

    it('should have misc consumable potions', () => {
      assert.strictEqual(POT_BOOZE, 315, 'POT_BOOZE (alcohol) should be 315');
      assert.strictEqual(POT_FRUIT_JUICE, 317, 'POT_FRUIT_JUICE should be 317');
      assert.strictEqual(POT_OIL, 319, 'POT_OIL should be 319');
    });

    it('should have water as special base potion', () => {
      assert.strictEqual(POT_WATER, 320, 'POT_WATER is last (special base)');
    });

    it('should have enlightenment (oracle potion)', () => {
      assert.strictEqual(POT_ENLIGHTENMENT, 308, 'POT_ENLIGHTENMENT should be 308');
    });
  });

  describe('Beneficial Scrolls', () => {
    it('should have correct indices for beneficial scrolls', () => {
      assert.strictEqual(SCR_ENCHANT_ARMOR, 321, 'SCR_ENCHANT_ARMOR should be 321');
      assert.strictEqual(SCR_ENCHANT_WEAPON, 326, 'SCR_ENCHANT_WEAPON should be 326');
      assert.strictEqual(SCR_REMOVE_CURSE, 325, 'SCR_REMOVE_CURSE should be 325');
      assert.strictEqual(SCR_TAMING, 328, 'SCR_TAMING should be 328');
      assert.strictEqual(SCR_IDENTIFY, 334, 'SCR_IDENTIFY should be 334');
      assert.strictEqual(SCR_MAGIC_MAPPING, 335, 'SCR_MAGIC_MAPPING should be 335');
      assert.strictEqual(SCR_CHARGING, 340, 'SCR_CHARGING should be 340');
    });

    it('should have enchantment scrolls', () => {
      assert(typeof SCR_ENCHANT_ARMOR === 'number', 'Enchant armor scroll');
      assert(typeof SCR_ENCHANT_WEAPON === 'number', 'Enchant weapon scroll');
    });

    it('should have detection scrolls', () => {
      assert(typeof SCR_GOLD_DETECTION === 'number', 'Gold detection');
      assert(typeof SCR_FOOD_DETECTION === 'number', 'Food detection');
      assert(typeof SCR_IDENTIFY === 'number', 'Identify scroll');
      assert(typeof SCR_MAGIC_MAPPING === 'number', 'Magic mapping');
    });

    it('should have utility scrolls', () => {
      assert(typeof SCR_LIGHT === 'number', 'Light scroll');
      assert(typeof SCR_TELEPORTATION === 'number', 'Teleportation scroll');
      assert(typeof SCR_CHARGING === 'number', 'Charging scroll');
      assert(typeof SCR_REMOVE_CURSE === 'number', 'Remove curse scroll');
    });
  });

  describe('Harmful Scrolls', () => {
    it('should have correct indices for harmful scrolls', () => {
      assert.strictEqual(SCR_DESTROY_ARMOR, 322, 'SCR_DESTROY_ARMOR should be 322');
      assert.strictEqual(SCR_CONFUSE_MONSTER, 323, 'SCR_CONFUSE_MONSTER should be 323');
      assert.strictEqual(SCR_SCARE_MONSTER, 324, 'SCR_SCARE_MONSTER should be 324');
      assert.strictEqual(SCR_CREATE_MONSTER, 327, 'SCR_CREATE_MONSTER should be 327');
      assert.strictEqual(SCR_GENOCIDE, 329, 'SCR_GENOCIDE should be 329');
      assert.strictEqual(SCR_FIRE, 337, 'SCR_FIRE should be 337');
      assert.strictEqual(SCR_EARTH, 338, 'SCR_EARTH should be 338');
      assert.strictEqual(SCR_PUNISHMENT, 339, 'SCR_PUNISHMENT should be 339');
      assert.strictEqual(SCR_STINKING_CLOUD, 341, 'SCR_STINKING_CLOUD should be 341');
      assert.strictEqual(SCR_AMNESIA, 336, 'SCR_AMNESIA should be 336');
    });

    it('should have destructive scrolls', () => {
      assert(typeof SCR_DESTROY_ARMOR === 'number', 'Destroy armor scroll');
      assert(typeof SCR_FIRE === 'number', 'Fire scroll');
      assert(typeof SCR_EARTH === 'number', 'Earth scroll');
    });

    it('should have punishment scrolls', () => {
      assert(typeof SCR_PUNISHMENT === 'number', 'Punishment scroll');
      assert(typeof SCR_AMNESIA === 'number', 'Amnesia scroll');
    });

    it('should have powerful effect scrolls', () => {
      assert(typeof SCR_GENOCIDE === 'number', 'Genocide scroll');
      assert(typeof SCR_CREATE_MONSTER === 'number', 'Create monster scroll');
    });
  });

  describe('Special Scrolls', () => {
    it('should have blank paper', () => {
      assert.strictEqual(SCR_BLANK_PAPER, 362, 'SCR_BLANK_PAPER should be 362');
    });

    it('blank paper should be at end of scroll range', () => {
      // Blank paper is the last scroll
      assert(SCR_BLANK_PAPER > 360, 'Blank paper is high index');
    });
  });

  describe('Potion Uniqueness', () => {
    it('all potion constants should be unique', () => {
      const potions = [
        POT_GAIN_ABILITY, POT_RESTORE_ABILITY, POT_CONFUSION, POT_BLINDNESS,
        POT_PARALYSIS, POT_SPEED, POT_LEVITATION, POT_HALLUCINATION,
        POT_INVISIBILITY, POT_SEE_INVISIBLE, POT_HEALING, POT_EXTRA_HEALING,
        POT_GAIN_LEVEL, POT_ENLIGHTENMENT, POT_MONSTER_DETECTION,
        POT_OBJECT_DETECTION, POT_GAIN_ENERGY, POT_SLEEPING, POT_FULL_HEALING,
        POT_POLYMORPH, POT_BOOZE, POT_SICKNESS, POT_FRUIT_JUICE, POT_ACID,
        POT_OIL, POT_WATER
      ];

      const unique = new Set(potions);
      assert.strictEqual(unique.size, potions.length,
        'All potion constants should have unique values');
      assert.strictEqual(potions.length, 26, 'Should have all 26 potions');
    });
  });

  describe('Scroll Uniqueness', () => {
    it('all scroll constants should be unique', () => {
      const scrolls = [
        SCR_ENCHANT_ARMOR, SCR_DESTROY_ARMOR, SCR_CONFUSE_MONSTER,
        SCR_SCARE_MONSTER, SCR_REMOVE_CURSE, SCR_ENCHANT_WEAPON,
        SCR_CREATE_MONSTER, SCR_TAMING, SCR_GENOCIDE, SCR_LIGHT,
        SCR_TELEPORTATION, SCR_GOLD_DETECTION, SCR_FOOD_DETECTION,
        SCR_IDENTIFY, SCR_MAGIC_MAPPING, SCR_AMNESIA, SCR_FIRE,
        SCR_EARTH, SCR_PUNISHMENT, SCR_CHARGING, SCR_STINKING_CLOUD,
        SCR_BLANK_PAPER
      ];

      const unique = new Set(scrolls);
      assert.strictEqual(unique.size, scrolls.length,
        'All scroll constants should have unique values');
      assert.strictEqual(scrolls.length, 22, 'Should have all 22 scrolls');
    });
  });

  describe('Value Ranges', () => {
    it('all potions should be in range 295-320', () => {
      const potions = [
        POT_GAIN_ABILITY, POT_RESTORE_ABILITY, POT_CONFUSION, POT_BLINDNESS,
        POT_PARALYSIS, POT_SPEED, POT_LEVITATION, POT_HALLUCINATION,
        POT_INVISIBILITY, POT_SEE_INVISIBLE, POT_HEALING, POT_EXTRA_HEALING,
        POT_GAIN_LEVEL, POT_ENLIGHTENMENT, POT_MONSTER_DETECTION,
        POT_OBJECT_DETECTION, POT_GAIN_ENERGY, POT_SLEEPING, POT_FULL_HEALING,
        POT_POLYMORPH, POT_BOOZE, POT_SICKNESS, POT_FRUIT_JUICE, POT_ACID,
        POT_OIL, POT_WATER
      ];

      for (const pot of potions) {
        assert(pot >= 295 && pot <= 320,
          `Potion ${pot} should be in range [295, 320]`);
      }
    });

    it('all scrolls should be in range 321-362', () => {
      const scrolls = [
        SCR_ENCHANT_ARMOR, SCR_DESTROY_ARMOR, SCR_CONFUSE_MONSTER,
        SCR_SCARE_MONSTER, SCR_REMOVE_CURSE, SCR_ENCHANT_WEAPON,
        SCR_CREATE_MONSTER, SCR_TAMING, SCR_GENOCIDE, SCR_LIGHT,
        SCR_TELEPORTATION, SCR_GOLD_DETECTION, SCR_FOOD_DETECTION,
        SCR_IDENTIFY, SCR_MAGIC_MAPPING, SCR_AMNESIA, SCR_FIRE,
        SCR_EARTH, SCR_PUNISHMENT, SCR_CHARGING, SCR_STINKING_CLOUD,
        SCR_BLANK_PAPER
      ];

      for (const scr of scrolls) {
        assert(scr >= 321 && scr <= 362,
          `Scroll ${scr} should be in range [321, 362]`);
      }
    });

    it('potions and scrolls should not overlap', () => {
      // Potions end at 320, scrolls start at 321
      assert(SCR_ENCHANT_ARMOR > POT_WATER, 'Scrolls come after potions');
      assert.strictEqual(SCR_ENCHANT_ARMOR - POT_WATER, 1,
        'Scrolls immediately follow potions');
    });
  });

  describe('Count Validation', () => {
    it('should have exactly 26 potions', () => {
      const potionCount = POT_WATER - POT_GAIN_ABILITY + 1;
      assert.strictEqual(potionCount, 26, 'Exactly 26 potions (295-320)');
    });

    it('should have 22 scrolls', () => {
      // Count actual scrolls, not range (some indices unused)
      const scrolls = [
        SCR_ENCHANT_ARMOR, SCR_DESTROY_ARMOR, SCR_CONFUSE_MONSTER,
        SCR_SCARE_MONSTER, SCR_REMOVE_CURSE, SCR_ENCHANT_WEAPON,
        SCR_CREATE_MONSTER, SCR_TAMING, SCR_GENOCIDE, SCR_LIGHT,
        SCR_TELEPORTATION, SCR_GOLD_DETECTION, SCR_FOOD_DETECTION,
        SCR_IDENTIFY, SCR_MAGIC_MAPPING, SCR_AMNESIA, SCR_FIRE,
        SCR_EARTH, SCR_PUNISHMENT, SCR_CHARGING, SCR_STINKING_CLOUD,
        SCR_BLANK_PAPER
      ];
      assert.strictEqual(scrolls.length, 22, '22 scroll types');
    });
  });

  describe('Critical Potion Values', () => {
    it('POT_GAIN_ABILITY should be 295 (first potion)', () => {
      assert.strictEqual(POT_GAIN_ABILITY, 295, 'POT_GAIN_ABILITY must be 295');
    });

    it('POT_WATER should be 320 (last potion, special)', () => {
      assert.strictEqual(POT_WATER, 320, 'POT_WATER must be 320');
    });

    it('POT_HEALING should be 305 (basic healing)', () => {
      assert.strictEqual(POT_HEALING, 305, 'POT_HEALING is fundamental potion');
    });
  });

  describe('Critical Scroll Values', () => {
    it('SCR_ENCHANT_ARMOR should be 321 (first scroll)', () => {
      assert.strictEqual(SCR_ENCHANT_ARMOR, 321, 'SCR_ENCHANT_ARMOR must be 321');
    });

    it('SCR_BLANK_PAPER should be 362 (last scroll)', () => {
      assert.strictEqual(SCR_BLANK_PAPER, 362, 'SCR_BLANK_PAPER must be 362');
    });

    it('SCR_IDENTIFY should be 334 (critical utility)', () => {
      assert.strictEqual(SCR_IDENTIFY, 334, 'SCR_IDENTIFY is essential scroll');
    });
  });
});
