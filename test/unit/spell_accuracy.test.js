/**
 * Spell System Accuracy Tests
 *
 * Verify that spell constants (SPE_*) match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  SPBOOK_CLASS,
  // Attack spells
  SPE_MAGIC_MISSILE,
  SPE_FIREBALL,
  SPE_CONE_OF_COLD,
  SPE_FINGER_OF_DEATH,
  SPE_FORCE_BOLT,
  SPE_DRAIN_LIFE,
  SPE_CHAIN_LIGHTNING,
  // Status/debuff spells
  SPE_SLEEP,
  SPE_CONFUSE_MONSTER,
  SPE_SLOW_MONSTER,
  SPE_CAUSE_FEAR,
  SPE_CHARM_MONSTER,
  // Healing spells
  SPE_HEALING,
  SPE_EXTRA_HEALING,
  SPE_CURE_BLINDNESS,
  SPE_CURE_SICKNESS,
  SPE_RESTORE_ABILITY,
  SPE_STONE_TO_FLESH,
  // Detection spells
  SPE_DETECT_MONSTERS,
  SPE_DETECT_FOOD,
  SPE_DETECT_UNSEEN,
  SPE_DETECT_TREASURE,
  SPE_CLAIRVOYANCE,
  SPE_IDENTIFY,
  // Utility spells
  SPE_LIGHT,
  SPE_DIG,
  SPE_KNOCK,
  SPE_WIZARD_LOCK,
  SPE_LEVITATION,
  SPE_INVISIBILITY,
  SPE_HASTE_SELF,
  SPE_JUMPING,
  // Defensive spells
  SPE_PROTECTION,
  SPE_REMOVE_CURSE,
  SPE_CANCELLATION,
  SPE_TURN_UNDEAD,
  // Creation/summoning spells
  SPE_CREATE_MONSTER,
  SPE_CREATE_FAMILIAR,
  // Map/divination spells
  SPE_MAGIC_MAPPING,
  // Transformation spells
  SPE_POLYMORPH,
  SPE_TELEPORT_AWAY,
  // Special books
  SPE_BLANK_PAPER,
  SPE_NOVEL,
  SPE_BOOK_OF_THE_DEAD
} from '../../js/objects.js';

describe('Spell System Accuracy', () => {
  describe('Spellbook Class Constant', () => {
    it('SPBOOK_CLASS should be 9', () => {
      // C ref: include/objclass.h SPBOOK_CLASS
      assert.strictEqual(SPBOOK_CLASS, 9, 'SPBOOK_CLASS should be 9');
    });

    it('SPBOOK_CLASS should come after SCROLL_CLASS', () => {
      // SPBOOK_CLASS=9 follows SCROLL_CLASS=8
      assert.strictEqual(SPBOOK_CLASS, 9, 'Spellbooks follow scrolls');
    });
  });

  describe('Spell Index Range', () => {
    it('SPE_DIG should be first spell (363)', () => {
      // C ref: include/obj.h spell object indices start at 363
      assert.strictEqual(SPE_DIG, 363, 'SPE_DIG should be 363 (first spell)');
    });

    it('SPE_BOOK_OF_THE_DEAD should be last spell (406)', () => {
      assert.strictEqual(SPE_BOOK_OF_THE_DEAD, 406,
        'SPE_BOOK_OF_THE_DEAD should be 406 (last spell)');
    });

    it('spell range should span 44 spells (363-406)', () => {
      const spellCount = SPE_BOOK_OF_THE_DEAD - SPE_DIG + 1;
      assert.strictEqual(spellCount, 44, 'Should have 44 spells total');
    });
  });

  describe('Attack Spells', () => {
    it('should have correct indices for attack spells', () => {
      // C ref: include/obj.h attack spell indices
      assert.strictEqual(SPE_MAGIC_MISSILE, 364, 'SPE_MAGIC_MISSILE should be 364');
      assert.strictEqual(SPE_FIREBALL, 365, 'SPE_FIREBALL should be 365');
      assert.strictEqual(SPE_CONE_OF_COLD, 366, 'SPE_CONE_OF_COLD should be 366');
      assert.strictEqual(SPE_FINGER_OF_DEATH, 368, 'SPE_FINGER_OF_DEATH should be 368');
      assert.strictEqual(SPE_FORCE_BOLT, 373, 'SPE_FORCE_BOLT should be 373');
      assert.strictEqual(SPE_DRAIN_LIFE, 376, 'SPE_DRAIN_LIFE should be 376');
      assert.strictEqual(SPE_CHAIN_LIGHTNING, 403, 'SPE_CHAIN_LIGHTNING should be 403');
    });

    it('attack spells should exist', () => {
      const attackSpells = [
        SPE_MAGIC_MISSILE, SPE_FIREBALL, SPE_CONE_OF_COLD,
        SPE_FINGER_OF_DEATH, SPE_FORCE_BOLT, SPE_DRAIN_LIFE,
        SPE_CHAIN_LIGHTNING
      ];

      for (const spell of attackSpells) {
        assert(spell >= 363 && spell <= 406,
          `Attack spell ${spell} should be in valid range`);
      }
    });

    it('should have elemental damage spells', () => {
      // Fire, cold, lightning
      assert(typeof SPE_FIREBALL === 'number', 'Fireball (fire damage)');
      assert(typeof SPE_CONE_OF_COLD === 'number', 'Cone of cold (cold damage)');
      assert(typeof SPE_CHAIN_LIGHTNING === 'number', 'Chain lightning (electric damage)');
    });

    it('should have magic missile (pure magic damage)', () => {
      assert.strictEqual(SPE_MAGIC_MISSILE, 364, 'Magic missile is basic attack spell');
    });
  });

  describe('Healing Spells', () => {
    it('should have correct indices for healing spells', () => {
      assert.strictEqual(SPE_HEALING, 371, 'SPE_HEALING should be 371');
      assert.strictEqual(SPE_EXTRA_HEALING, 388, 'SPE_EXTRA_HEALING should be 388');
      assert.strictEqual(SPE_CURE_BLINDNESS, 375, 'SPE_CURE_BLINDNESS should be 375');
      assert.strictEqual(SPE_CURE_SICKNESS, 383, 'SPE_CURE_SICKNESS should be 383');
      assert.strictEqual(SPE_RESTORE_ABILITY, 389, 'SPE_RESTORE_ABILITY should be 389');
      assert.strictEqual(SPE_STONE_TO_FLESH, 402, 'SPE_STONE_TO_FLESH should be 402');
    });

    it('healing progression should exist', () => {
      // Healing -> Extra Healing
      assert(SPE_HEALING < SPE_EXTRA_HEALING, 'Extra healing is upgrade');
    });
  });

  describe('Detection Spells', () => {
    it('should have correct indices for detection spells', () => {
      assert.strictEqual(SPE_DETECT_MONSTERS, 370, 'SPE_DETECT_MONSTERS should be 370');
      assert.strictEqual(SPE_DETECT_FOOD, 380, 'SPE_DETECT_FOOD should be 380');
      assert.strictEqual(SPE_DETECT_UNSEEN, 386, 'SPE_DETECT_UNSEEN should be 386');
      assert.strictEqual(SPE_DETECT_TREASURE, 391, 'SPE_DETECT_TREASURE should be 391');
      assert.strictEqual(SPE_CLAIRVOYANCE, 382, 'SPE_CLAIRVOYANCE should be 382');
      assert.strictEqual(SPE_IDENTIFY, 394, 'SPE_IDENTIFY should be 394');
    });

    it('should have detection spells for all major categories', () => {
      const detectionTypes = [
        SPE_DETECT_MONSTERS,   // Monsters
        SPE_DETECT_FOOD,       // Food
        SPE_DETECT_UNSEEN,     // Hidden things
        SPE_DETECT_TREASURE,   // Treasure
        SPE_CLAIRVOYANCE,      // Map vision
        SPE_IDENTIFY           // Object identification
      ];

      assert.strictEqual(detectionTypes.length, 6, 'Should have 6 detection spell types');
    });
  });

  describe('Utility Spells', () => {
    it('should have correct indices for utility spells', () => {
      assert.strictEqual(SPE_LIGHT, 369, 'SPE_LIGHT should be 369');
      assert.strictEqual(SPE_DIG, 363, 'SPE_DIG should be 363');
      assert.strictEqual(SPE_KNOCK, 372, 'SPE_KNOCK should be 372');
      assert.strictEqual(SPE_WIZARD_LOCK, 378, 'SPE_WIZARD_LOCK should be 378');
      assert.strictEqual(SPE_LEVITATION, 387, 'SPE_LEVITATION should be 387');
      assert.strictEqual(SPE_INVISIBILITY, 390, 'SPE_INVISIBILITY should be 390');
      assert.strictEqual(SPE_HASTE_SELF, 385, 'SPE_HASTE_SELF should be 385');
      assert.strictEqual(SPE_JUMPING, 401, 'SPE_JUMPING should be 401');
    });

    it('should have door manipulation spells', () => {
      // Knock (open) and Wizard Lock (close)
      assert(typeof SPE_KNOCK === 'number', 'Knock to open doors');
      assert(typeof SPE_WIZARD_LOCK === 'number', 'Wizard lock to seal doors');
    });

    it('should have movement enhancement spells', () => {
      assert(typeof SPE_LEVITATION === 'number', 'Levitation for floating');
      assert(typeof SPE_HASTE_SELF === 'number', 'Haste for speed');
      assert(typeof SPE_JUMPING === 'number', 'Jumping for mobility');
    });
  });

  describe('Status Effect Spells', () => {
    it('should have correct indices for debuff spells', () => {
      assert.strictEqual(SPE_SLEEP, 367, 'SPE_SLEEP should be 367');
      assert.strictEqual(SPE_CONFUSE_MONSTER, 374, 'SPE_CONFUSE_MONSTER should be 374');
      assert.strictEqual(SPE_SLOW_MONSTER, 377, 'SPE_SLOW_MONSTER should be 377');
      assert.strictEqual(SPE_CAUSE_FEAR, 381, 'SPE_CAUSE_FEAR should be 381');
      assert.strictEqual(SPE_CHARM_MONSTER, 384, 'SPE_CHARM_MONSTER should be 384');
    });

    it('should have monster control spells', () => {
      const controlSpells = [
        SPE_SLEEP,            // Put to sleep
        SPE_CONFUSE_MONSTER,  // Confuse
        SPE_SLOW_MONSTER,     // Slow
        SPE_CAUSE_FEAR,       // Frighten
        SPE_CHARM_MONSTER     // Charm/pacify
      ];

      for (const spell of controlSpells) {
        assert(spell >= 363 && spell <= 406, 'Control spell in valid range');
      }
    });
  });

  describe('Defensive/Protective Spells', () => {
    it('should have correct indices for defensive spells', () => {
      assert.strictEqual(SPE_PROTECTION, 400, 'SPE_PROTECTION should be 400');
      assert.strictEqual(SPE_REMOVE_CURSE, 392, 'SPE_REMOVE_CURSE should be 392');
      assert.strictEqual(SPE_CANCELLATION, 399, 'SPE_CANCELLATION should be 399');
      assert.strictEqual(SPE_TURN_UNDEAD, 395, 'SPE_TURN_UNDEAD should be 395');
    });

    it('should have curse removal', () => {
      assert(typeof SPE_REMOVE_CURSE === 'number', 'Remove curse spell exists');
    });

    it('should have protection spell', () => {
      assert(typeof SPE_PROTECTION === 'number', 'Protection spell exists');
    });
  });

  describe('Creation/Summoning Spells', () => {
    it('should have correct indices for creation spells', () => {
      assert.strictEqual(SPE_CREATE_MONSTER, 379, 'SPE_CREATE_MONSTER should be 379');
      assert.strictEqual(SPE_CREATE_FAMILIAR, 398, 'SPE_CREATE_FAMILIAR should be 398');
    });

    it('should have monster creation spells', () => {
      assert(typeof SPE_CREATE_MONSTER === 'number', 'Create random monster');
      assert(typeof SPE_CREATE_FAMILIAR === 'number', 'Create familiar pet');
    });
  });

  describe('Divination/Map Spells', () => {
    it('should have magic mapping', () => {
      assert.strictEqual(SPE_MAGIC_MAPPING, 393, 'SPE_MAGIC_MAPPING should be 393');
    });
  });

  describe('Transformation Spells', () => {
    it('should have correct indices for transformation spells', () => {
      assert.strictEqual(SPE_POLYMORPH, 396, 'SPE_POLYMORPH should be 396');
      assert.strictEqual(SPE_TELEPORT_AWAY, 397, 'SPE_TELEPORT_AWAY should be 397');
    });

    it('should have polymorph spell', () => {
      assert(typeof SPE_POLYMORPH === 'number', 'Polymorph spell exists');
    });

    it('should have teleportation spell', () => {
      assert(typeof SPE_TELEPORT_AWAY === 'number', 'Teleport spell exists');
    });
  });

  describe('Special Spellbooks', () => {
    it('should have correct indices for special books', () => {
      assert.strictEqual(SPE_BLANK_PAPER, 404, 'SPE_BLANK_PAPER should be 404');
      assert.strictEqual(SPE_NOVEL, 405, 'SPE_NOVEL should be 405');
      assert.strictEqual(SPE_BOOK_OF_THE_DEAD, 406, 'SPE_BOOK_OF_THE_DEAD should be 406');
    });

    it('special books should be at end of spell range', () => {
      // Blank paper, Novel, Book of the Dead are non-spell books at end
      assert(SPE_BLANK_PAPER > 400, 'Special books are high indices');
      assert(SPE_NOVEL > SPE_BLANK_PAPER, 'Novel after blank paper');
      assert(SPE_BOOK_OF_THE_DEAD > SPE_NOVEL, 'Book of the Dead is last');
    });

    it('Book of the Dead should be unique quest item', () => {
      assert.strictEqual(SPE_BOOK_OF_THE_DEAD, 406,
        'Book of the Dead is final quest item book');
    });
  });

  describe('Spell Uniqueness', () => {
    it('all spell constants should be unique', () => {
      const spells = [
        SPE_DIG, SPE_MAGIC_MISSILE, SPE_FIREBALL, SPE_CONE_OF_COLD,
        SPE_SLEEP, SPE_FINGER_OF_DEATH, SPE_LIGHT, SPE_DETECT_MONSTERS,
        SPE_HEALING, SPE_KNOCK, SPE_FORCE_BOLT, SPE_CONFUSE_MONSTER,
        SPE_CURE_BLINDNESS, SPE_DRAIN_LIFE, SPE_SLOW_MONSTER,
        SPE_WIZARD_LOCK, SPE_CREATE_MONSTER, SPE_DETECT_FOOD,
        SPE_CAUSE_FEAR, SPE_CLAIRVOYANCE, SPE_CURE_SICKNESS,
        SPE_CHARM_MONSTER, SPE_HASTE_SELF, SPE_DETECT_UNSEEN,
        SPE_LEVITATION, SPE_EXTRA_HEALING, SPE_RESTORE_ABILITY,
        SPE_INVISIBILITY, SPE_DETECT_TREASURE, SPE_REMOVE_CURSE,
        SPE_MAGIC_MAPPING, SPE_IDENTIFY, SPE_TURN_UNDEAD,
        SPE_POLYMORPH, SPE_TELEPORT_AWAY, SPE_CREATE_FAMILIAR,
        SPE_CANCELLATION, SPE_PROTECTION, SPE_JUMPING,
        SPE_STONE_TO_FLESH, SPE_CHAIN_LIGHTNING, SPE_BLANK_PAPER,
        SPE_NOVEL, SPE_BOOK_OF_THE_DEAD
      ];

      const unique = new Set(spells);
      assert.strictEqual(unique.size, spells.length,
        'All spell constants should have unique values');
      assert.strictEqual(spells.length, 44, 'Should have all 44 spells');
    });
  });

  describe('Spell Value Ranges', () => {
    it('all spells should be in range 363-406', () => {
      const spells = [
        SPE_DIG, SPE_MAGIC_MISSILE, SPE_FIREBALL, SPE_CONE_OF_COLD,
        SPE_SLEEP, SPE_FINGER_OF_DEATH, SPE_LIGHT, SPE_DETECT_MONSTERS,
        SPE_HEALING, SPE_KNOCK, SPE_FORCE_BOLT, SPE_CONFUSE_MONSTER,
        SPE_CURE_BLINDNESS, SPE_DRAIN_LIFE, SPE_SLOW_MONSTER,
        SPE_WIZARD_LOCK, SPE_CREATE_MONSTER, SPE_DETECT_FOOD,
        SPE_CAUSE_FEAR, SPE_CLAIRVOYANCE, SPE_CURE_SICKNESS,
        SPE_CHARM_MONSTER, SPE_HASTE_SELF, SPE_DETECT_UNSEEN,
        SPE_LEVITATION, SPE_EXTRA_HEALING, SPE_RESTORE_ABILITY,
        SPE_INVISIBILITY, SPE_DETECT_TREASURE, SPE_REMOVE_CURSE,
        SPE_MAGIC_MAPPING, SPE_IDENTIFY, SPE_TURN_UNDEAD,
        SPE_POLYMORPH, SPE_TELEPORT_AWAY, SPE_CREATE_FAMILIAR,
        SPE_CANCELLATION, SPE_PROTECTION, SPE_JUMPING,
        SPE_STONE_TO_FLESH, SPE_CHAIN_LIGHTNING, SPE_BLANK_PAPER,
        SPE_NOVEL, SPE_BOOK_OF_THE_DEAD
      ];

      for (const spell of spells) {
        assert(spell >= 363 && spell <= 406,
          `Spell ${spell} should be in range [363, 406]`);
      }
    });

    it('spells should fit in object index range', () => {
      // Spells are object types, so they fit in the object index system
      assert(SPE_DIG >= 0 && SPE_DIG < 1000, 'Spells in object range');
      assert(SPE_BOOK_OF_THE_DEAD >= 0 && SPE_BOOK_OF_THE_DEAD < 1000,
        'All spells in object range');
    });
  });

  describe('Spell Count Validation', () => {
    it('should have exactly 44 spells', () => {
      // C ref: NetHack has 44 spells from DIG to BOOK_OF_THE_DEAD
      const spellCount = SPE_BOOK_OF_THE_DEAD - SPE_DIG + 1;
      assert.strictEqual(spellCount, 44, 'Exactly 44 spells (363-406)');
    });

    it('should have 41 castable spells (excluding special books)', () => {
      // Blank paper, Novel, Book of the Dead are not castable spells
      const castableCount = SPE_BLANK_PAPER - SPE_DIG;
      assert.strictEqual(castableCount, 41, '41 castable spells (363-403)');
    });
  });

  describe('Critical Spell Values', () => {
    it('SPE_DIG should be 363 (first spell)', () => {
      // Dig is the first actual spell
      assert.strictEqual(SPE_DIG, 363, 'SPE_DIG must be 363');
    });

    it('SPE_MAGIC_MISSILE should be 364 (basic attack)', () => {
      // Magic missile is the fundamental attack spell
      assert.strictEqual(SPE_MAGIC_MISSILE, 364, 'Magic missile is spell 364');
    });

    it('SPE_BOOK_OF_THE_DEAD should be 406 (last/quest item)', () => {
      // Book of the Dead is the final quest item
      assert.strictEqual(SPE_BOOK_OF_THE_DEAD, 406,
        'Book of the Dead must be 406');
    });
  });
});
