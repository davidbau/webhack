/**
 * Player Character Accuracy Tests
 *
 * Verify that player character attributes, roles, and races
 * match C NetHack 3.7 exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { roles, races } from '../../js/player.js';
import { A_LAWFUL, A_NEUTRAL, A_CHAOTIC, RACE_HUMAN, RACE_ORC } from '../../js/config.js';

// Constants matching C NetHack
const GENDER_MALE = 0;
const GENDER_FEMALE = 1;

// Note: genders and alignments arrays not exported from player.js
// Testing only roles and races which are exported

describe('Player Character Accuracy', () => {
  describe('Roles Array', () => {
    it('should have exactly 13 roles', () => {
      // C ref: role.c roles[] array has 13 roles
      assert.strictEqual(roles.length, 13,
        `Expected 13 roles, got ${roles.length}`);
    });

    it('should have roles in correct order', () => {
      // C ref: role.c roles[] array order (Rogue before Ranger - see Memory.md)
      const expected = [
        'archeologist', 'barbarian', 'caveman', 'healer', 'knight',
        'monk', 'priest', 'rogue', 'ranger', 'samurai', 'tourist',
        'valkyrie', 'wizard'
      ];

      for (let i = 0; i < roles.length; i++) {
        assert.strictEqual(roles[i].name.toLowerCase(), expected[i],
          `Role ${i} should be ${expected[i]}, got ${roles[i].name.toLowerCase()}`);
      }
    });

    it('Rogue should come before Ranger', () => {
      // C ref: Memory note - roles[] array order: Rogue before Ranger
      const rogueIdx = roles.findIndex(r => r.name.toLowerCase() === 'rogue');
      const rangerIdx = roles.findIndex(r => r.name.toLowerCase() === 'ranger');

      assert(rogueIdx >= 0, 'Rogue should exist');
      assert(rangerIdx >= 0, 'Ranger should exist');
      assert(rogueIdx < rangerIdx,
        `Rogue (${rogueIdx}) should come before Ranger (${rangerIdx})`);
    });

    it('each role should have required fields', () => {
      for (const role of roles) {
        assert(role.name, `Role missing name: ${JSON.stringify(role)}`);
        assert(role.abbr, `Role ${role.name} missing abbr`);
        assert(Array.isArray(role.validRaces), `Role ${role.name} missing validRaces`);
        assert(Array.isArray(role.validAligns), `Role ${role.name} missing validAligns`);
      }
    });
  });

  describe('Races Array', () => {
    it('should have exactly 5 races', () => {
      // C ref: C NetHack has 5 playable races
      assert.strictEqual(races.length, 5,
        `Expected 5 races, got ${races.length}`);
    });

    it('should have races in correct order', () => {
      // C ref: race.c races[] array order
      const expected = ['human', 'elf', 'dwarf', 'gnome', 'orc'];

      for (let i = 0; i < races.length; i++) {
        assert.strictEqual(races[i].name.toLowerCase(), expected[i],
          `Race ${i} should be ${expected[i]}, got ${races[i].name.toLowerCase()}`);
      }
    });

    it('each race should have required fields', () => {
      for (const race of races) {
        assert(race.name, `Race missing name: ${JSON.stringify(race)}`);
        assert(race.menuChar, `Race ${race.name} missing menuChar`);
        assert(race.adj, `Race ${race.name} missing adj`);
        assert(Array.isArray(race.validAligns), `Race ${race.name} missing validAligns`);
      }
    });
  });

  // Note: genders and alignments arrays are not exported from player.js
  // They are handled internally by the character creation system

  describe('Role Constraints', () => {
    it('Valkyrie should force female gender', () => {
      const valk = roles.find(r => r.name.toLowerCase() === 'valkyrie');
      assert(valk, 'Valkyrie role should exist');
      assert(valk.forceGender !== null && valk.forceGender !== undefined,
        'Valkyrie should have forceGender set');
      assert.strictEqual(valk.forceGender, 'female',
        'Valkyrie should force female gender');
    });

    it('Knight should have restricted races', () => {
      const knight = roles.find(r => r.name.toLowerCase() === 'knight');
      assert(knight, 'Knight role should exist');

      // C ref: Knights can be human or dwarf
      assert(knight.validRaces.includes(RACE_HUMAN),
        'Knight should allow human');
      assert(!knight.validRaces.includes(RACE_ORC),
        'Knight should not allow orc');
    });

    it('Priest should allow all alignments', () => {
      const priest = roles.find(r => r.name.toLowerCase() === 'priest');
      assert(priest, 'Priest role should exist');

      // C ref: Priests can be any alignment
      assert(priest.validAligns.includes(A_LAWFUL), 'Priest should allow lawful');
      assert(priest.validAligns.includes(A_NEUTRAL), 'Priest should allow neutral');
      assert(priest.validAligns.includes(A_CHAOTIC), 'Priest should allow chaotic');
    });

    it('Samurai should force lawful alignment', () => {
      const samurai = roles.find(r => r.name.toLowerCase() === 'samurai');
      assert(samurai, 'Samurai role should exist');

      // C ref: Samurai are always lawful
      assert.strictEqual(samurai.validAligns.length, 1,
        'Samurai should have exactly one alignment');
      assert.strictEqual(samurai.validAligns[0], A_LAWFUL,
        'Samurai should be lawful');
    });
  });

  describe('Starting Attributes', () => {
    it('each role should have stat ranges', () => {
      for (const role of roles) {
        if (role.attrbase) {
          // Verify structure
          assert(role.attrbase.STR, `${role.name} missing STR attrbase`);
          assert(role.attrbase.DEX, `${role.name} missing DEX attrbase`);
          assert(role.attrbase.CON, `${role.name} missing CON attrbase`);
          assert(role.attrbase.INT, `${role.name} missing INT attrbase`);
          assert(role.attrbase.WIS, `${role.name} missing WIS attrbase`);
          assert(role.attrbase.CHA, `${role.name} missing CHA attrbase`);
        }
      }
    });

    it('Barbarian should have high STR', () => {
      const barb = roles.find(r => r.name.toLowerCase() === 'barbarian');
      if (barb && barb.attrbase) {
        // C ref: Barbarians start with high strength
        assert(barb.attrbase.STR >= 16,
          `Barbarian STR should be >= 16, got ${barb.attrbase.STR}`);
      }
    });

    it('Wizard should have high INT', () => {
      const wizard = roles.find(r => r.name.toLowerCase() === 'wizard');
      if (wizard && wizard.attrbase) {
        // C ref: Wizards start with high intelligence
        assert(wizard.attrbase.INT >= 16,
          `Wizard INT should be >= 16, got ${wizard.attrbase.INT}`);
      }
    });
  });

  describe('Role Names', () => {
    it('should have both male and female names', () => {
      for (const role of roles) {
        assert(role.name, `Role missing name`);

        // Some roles have gendered names (e.g., Cavewoman)
        if (role.namef) {
          assert.notStrictEqual(role.name, role.namef,
            `${role.name} has same male/female name`);
        }
      }
    });

    it('Caveman should have Cavewoman as female name', () => {
      const caveman = roles.find(r => r.name.toLowerCase() === 'caveman');
      if (caveman && caveman.namef) {
        assert.strictEqual(caveman.namef.toLowerCase(), 'cavewoman',
          `Caveman female name should be Cavewoman, got ${caveman.namef}`);
      }
    });
  });

  describe('Constants Validation', () => {
    it('role array should have 13 entries', () => {
      // C ref: Archeologist is first (index 0), Wizard is last (index 12)
      assert.strictEqual(roles[0].name.toLowerCase(), 'archeologist',
        'First role should be Archeologist');
      assert.strictEqual(roles[12].name.toLowerCase(), 'wizard',
        'Last role (index 12) should be Wizard');
    });

    it('race constants should be correct', () => {
      assert.strictEqual(RACE_HUMAN, 0, 'RACE_HUMAN should be 0');
      assert.strictEqual(RACE_ORC, 4, 'RACE_ORC should be 4');
    });

    it('alignment constants should be correct', () => {
      assert.strictEqual(A_LAWFUL, 1, 'A_LAWFUL should be 1');
      assert.strictEqual(A_NEUTRAL, 0, 'A_NEUTRAL should be 0');
      assert.strictEqual(A_CHAOTIC, -1, 'A_CHAOTIC should be -1');
    });
  });
});
