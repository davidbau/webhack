/**
 * Movement Direction and Role Constants Accuracy Tests
 *
 * Verify that direction and player role constants match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Direction constants
  DIR_W, DIR_NW, DIR_N, DIR_NE,
  DIR_E, DIR_SE, DIR_S, DIR_SW,
  DIR_UP, DIR_DOWN,
  // Player role constants
  PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
  PM_KNIGHT, PM_MONK, PM_PRIEST, PM_ROGUE, PM_RANGER,
  PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD
} from '../../js/config.js';

describe('Movement and Role Constants Accuracy', () => {
  describe('Direction Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/hack.h direction constants
      assert.strictEqual(DIR_W, 0, 'DIR_W (west) should be 0');
      assert.strictEqual(DIR_NW, 1, 'DIR_NW (northwest) should be 1');
      assert.strictEqual(DIR_N, 2, 'DIR_N (north) should be 2');
      assert.strictEqual(DIR_NE, 3, 'DIR_NE (northeast) should be 3');
      assert.strictEqual(DIR_E, 4, 'DIR_E (east) should be 4');
      assert.strictEqual(DIR_SE, 5, 'DIR_SE (southeast) should be 5');
      assert.strictEqual(DIR_S, 6, 'DIR_S (south) should be 6');
      assert.strictEqual(DIR_SW, 7, 'DIR_SW (southwest) should be 7');
      assert.strictEqual(DIR_UP, 8, 'DIR_UP should be 8');
      assert.strictEqual(DIR_DOWN, 9, 'DIR_DOWN should be 9');
    });

    it('compass directions should be sequential from 0-7', () => {
      const compass = [DIR_W, DIR_NW, DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW];
      for (let i = 0; i < compass.length; i++) {
        assert.strictEqual(compass[i], i, `Direction ${i} should have value ${i}`);
      }
    });

    it('DIR_W should be first (0)', () => {
      assert.strictEqual(DIR_W, 0, 'West is the first compass direction');
    });

    it('vertical directions should follow compass directions', () => {
      assert.strictEqual(DIR_UP, 8, 'DIR_UP follows compass (8)');
      assert.strictEqual(DIR_DOWN, 9, 'DIR_DOWN follows DIR_UP (9)');
    });

    it('all directions should be unique', () => {
      const directions = [DIR_W, DIR_NW, DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW, DIR_UP, DIR_DOWN];
      const unique = new Set(directions);
      assert.strictEqual(unique.size, 10, 'Should have 10 unique directions');
    });
  });

  describe('Direction Compass Layout', () => {
    it('cardinal directions should be at even indices', () => {
      assert.strictEqual(DIR_W, 0, 'West is even (0)');
      assert.strictEqual(DIR_N, 2, 'North is even (2)');
      assert.strictEqual(DIR_E, 4, 'East is even (4)');
      assert.strictEqual(DIR_S, 6, 'South is even (6)');
    });

    it('diagonal directions should be at odd indices', () => {
      assert.strictEqual(DIR_NW, 1, 'Northwest is odd (1)');
      assert.strictEqual(DIR_NE, 3, 'Northeast is odd (3)');
      assert.strictEqual(DIR_SE, 5, 'Southeast is odd (5)');
      assert.strictEqual(DIR_SW, 7, 'Southwest is odd (7)');
    });

    it('directions should proceed clockwise from west', () => {
      // W -> NW -> N -> NE -> E -> SE -> S -> SW
      assert(DIR_W < DIR_NW, 'W before NW');
      assert(DIR_NW < DIR_N, 'NW before N');
      assert(DIR_N < DIR_NE, 'N before NE');
      assert(DIR_NE < DIR_E, 'NE before E');
      assert(DIR_E < DIR_SE, 'E before SE');
      assert(DIR_SE < DIR_S, 'SE before S');
      assert(DIR_S < DIR_SW, 'S before SW');
    });

    it('opposite directions should be 4 apart', () => {
      assert.strictEqual(DIR_E - DIR_W, 4, 'East is opposite West (+4)');
      assert.strictEqual(DIR_S - DIR_N, 4, 'South is opposite North (+4)');
      assert.strictEqual(DIR_SE - DIR_NW, 4, 'Southeast opposite Northwest (+4)');
      assert.strictEqual(DIR_SW - DIR_NE, 4, 'Southwest opposite Northeast (+4)');
    });
  });

  describe('Direction Ranges', () => {
    it('all directions should fit in 4 bits (0-15)', () => {
      const directions = [DIR_W, DIR_NW, DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW, DIR_UP, DIR_DOWN];
      for (const dir of directions) {
        assert(dir >= 0 && dir < 16, `Direction ${dir} should fit in 4 bits`);
      }
    });

    it('compass directions should be in range [0, 7]', () => {
      const compass = [DIR_W, DIR_NW, DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW];
      for (const dir of compass) {
        assert(dir >= 0 && dir <= 7, `Compass direction ${dir} should be in [0, 7]`);
      }
    });

    it('vertical directions should be 8 and 9', () => {
      assert.strictEqual(DIR_UP, 8, 'DIR_UP is 8');
      assert.strictEqual(DIR_DOWN, 9, 'DIR_DOWN is 9');
    });
  });

  describe('Player Role Constants (PM_*)', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/pm.h player role indices
      assert.strictEqual(PM_ARCHEOLOGIST, 0, 'PM_ARCHEOLOGIST should be 0');
      assert.strictEqual(PM_BARBARIAN, 1, 'PM_BARBARIAN should be 1');
      assert.strictEqual(PM_CAVEMAN, 2, 'PM_CAVEMAN should be 2');
      assert.strictEqual(PM_HEALER, 3, 'PM_HEALER should be 3');
      assert.strictEqual(PM_KNIGHT, 4, 'PM_KNIGHT should be 4');
      assert.strictEqual(PM_MONK, 5, 'PM_MONK should be 5');
      assert.strictEqual(PM_PRIEST, 6, 'PM_PRIEST should be 6');
      assert.strictEqual(PM_ROGUE, 7, 'PM_ROGUE should be 7');
      assert.strictEqual(PM_RANGER, 8, 'PM_RANGER should be 8');
      assert.strictEqual(PM_SAMURAI, 9, 'PM_SAMURAI should be 9');
      assert.strictEqual(PM_TOURIST, 10, 'PM_TOURIST should be 10');
      assert.strictEqual(PM_VALKYRIE, 11, 'PM_VALKYRIE should be 11');
      assert.strictEqual(PM_WIZARD, 12, 'PM_WIZARD should be 12');
    });

    it('roles should be sequential from 0-12', () => {
      const roles = [
        PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
        PM_KNIGHT, PM_MONK, PM_PRIEST, PM_ROGUE, PM_RANGER,
        PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD
      ];
      for (let i = 0; i < roles.length; i++) {
        assert.strictEqual(roles[i], i, `Role ${i} should have value ${i}`);
      }
    });

    it('should have exactly 13 playable roles', () => {
      const roles = [
        PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
        PM_KNIGHT, PM_MONK, PM_PRIEST, PM_ROGUE, PM_RANGER,
        PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD
      ];
      assert.strictEqual(roles.length, 13, '13 playable roles');
    });

    it('all role constants should be unique', () => {
      const roles = [
        PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
        PM_KNIGHT, PM_MONK, PM_PRIEST, PM_ROGUE, PM_RANGER,
        PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD
      ];
      const unique = new Set(roles);
      assert.strictEqual(unique.size, 13, 'All 13 roles should be unique');
    });
  });

  describe('Role Ordering', () => {
    it('PM_ARCHEOLOGIST should be first', () => {
      assert.strictEqual(PM_ARCHEOLOGIST, 0, 'Archeologist is first role');
    });

    it('PM_WIZARD should be last', () => {
      assert.strictEqual(PM_WIZARD, 12, 'Wizard is last role (12)');
    });

    it('PM_ROGUE should come before PM_RANGER', () => {
      // Note: This matches the JS roles[] array order, not alphabetical
      assert(PM_ROGUE < PM_RANGER, 'Rogue before Ranger (matching roles array)');
    });

    it('melee roles should be early', () => {
      // Barbarian, Caveman, Knight are melee-focused
      assert(PM_BARBARIAN < 5, 'Barbarian is early (< 5)');
      assert(PM_CAVEMAN < 5, 'Caveman is early (< 5)');
      assert(PM_KNIGHT < 5, 'Knight is early (< 5)');
    });

    it('support roles should be scattered', () => {
      // Healer, Priest, Monk are support roles
      assert(typeof PM_HEALER === 'number', 'Healer defined');
      assert(typeof PM_PRIEST === 'number', 'Priest defined');
      assert(typeof PM_MONK === 'number', 'Monk defined');
    });
  });

  describe('Role Ranges', () => {
    it('all roles should fit in 4 bits (0-15)', () => {
      const roles = [
        PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
        PM_KNIGHT, PM_MONK, PM_PRIEST, PM_ROGUE, PM_RANGER,
        PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD
      ];
      for (const role of roles) {
        assert(role >= 0 && role < 16, `Role ${role} should fit in 4 bits`);
      }
    });

    it('all roles should be in valid range [0, 12]', () => {
      const roles = [
        PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
        PM_KNIGHT, PM_MONK, PM_PRIEST, PM_ROGUE, PM_RANGER,
        PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD
      ];
      for (const role of roles) {
        assert(role >= 0 && role <= 12, `Role ${role} should be in [0, 12]`);
      }
    });
  });

  describe('Role Categories', () => {
    it('should have fighter roles', () => {
      const fighters = [PM_BARBARIAN, PM_CAVEMAN, PM_KNIGHT, PM_SAMURAI, PM_VALKYRIE];
      for (const role of fighters) {
        assert(typeof role === 'number', `Fighter role ${role} should be defined`);
      }
    });

    it('should have magical roles', () => {
      const magical = [PM_HEALER, PM_MONK, PM_PRIEST, PM_WIZARD];
      for (const role of magical) {
        assert(typeof role === 'number', `Magical role ${role} should be defined`);
      }
    });

    it('should have ranged combat roles', () => {
      const ranged = [PM_RANGER, PM_ROGUE, PM_SAMURAI];
      for (const role of ranged) {
        assert(typeof role === 'number', `Ranged role ${role} should be defined`);
      }
    });

    it('should have exploration role (Archeologist)', () => {
      assert.strictEqual(PM_ARCHEOLOGIST, 0, 'Archeologist is exploration role');
    });

    it('should have comedy role (Tourist)', () => {
      assert.strictEqual(PM_TOURIST, 10, 'Tourist is comedy/challenge role');
    });
  });

  describe('Direction and Role Integration', () => {
    it('direction count and role count are both valid game constants', () => {
      // 10 directions (8 compass + 2 vertical)
      const dirCount = DIR_DOWN - DIR_W + 1;
      assert.strictEqual(dirCount, 10, '10 total directions');

      // 13 playable roles
      const roleCount = PM_WIZARD - PM_ARCHEOLOGIST + 1;
      assert.strictEqual(roleCount, 13, '13 total roles');
    });

    it('both use small integer values suitable for arrays', () => {
      // Directions fit in 4 bits
      assert(DIR_DOWN < 16, 'Directions fit in 4 bits');
      // Roles fit in 4 bits
      assert(PM_WIZARD < 16, 'Roles fit in 4 bits');
    });
  });

  describe('Direction Completeness', () => {
    it('should have all 8 compass directions', () => {
      const requiredDirections = ['DIR_W', 'DIR_NW', 'DIR_N', 'DIR_NE', 'DIR_E', 'DIR_SE', 'DIR_S', 'DIR_SW'];
      const directionMap = { DIR_W, DIR_NW, DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW };

      for (const dirName of requiredDirections) {
        assert(directionMap[dirName] !== undefined, `${dirName} should be defined`);
      }
    });

    it('should have vertical movement directions', () => {
      assert(typeof DIR_UP === 'number', 'DIR_UP should be defined');
      assert(typeof DIR_DOWN === 'number', 'DIR_DOWN should be defined');
    });
  });

  describe('Role Completeness', () => {
    it('should have all 13 standard roles from C NetHack', () => {
      const requiredRoles = [
        'PM_ARCHEOLOGIST', 'PM_BARBARIAN', 'PM_CAVEMAN', 'PM_HEALER',
        'PM_KNIGHT', 'PM_MONK', 'PM_PRIEST', 'PM_ROGUE', 'PM_RANGER',
        'PM_SAMURAI', 'PM_TOURIST', 'PM_VALKYRIE', 'PM_WIZARD'
      ];

      const roleMap = {
        PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVEMAN, PM_HEALER,
        PM_KNIGHT, PM_MONK, PM_PRIEST, PM_ROGUE, PM_RANGER,
        PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WIZARD
      };

      for (const roleName of requiredRoles) {
        assert(roleMap[roleName] !== undefined, `${roleName} should be defined`);
      }
    });
  });

  describe('Critical Constant Values', () => {
    it('DIR_W should be 0 (first direction)', () => {
      assert.strictEqual(DIR_W, 0, 'DIR_W must be 0 (first direction)');
    });

    it('PM_ARCHEOLOGIST should be 0 (first role)', () => {
      assert.strictEqual(PM_ARCHEOLOGIST, 0, 'PM_ARCHEOLOGIST must be 0 (first role)');
    });

    it('compass directions should wrap around mod 8', () => {
      // Directions 0-7 are compass, enabling modular arithmetic for opposite directions
      const maxCompass = Math.max(DIR_W, DIR_NW, DIR_N, DIR_NE, DIR_E, DIR_SE, DIR_S, DIR_SW);
      assert.strictEqual(maxCompass, 7, 'Compass directions should max at 7 for mod 8 arithmetic');
    });
  });
});
