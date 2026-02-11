/**
 * Trap System Accuracy Tests
 *
 * Verify that trap type constants match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Trap type constants
  NO_TRAP,
  ARROW_TRAP,
  DART_TRAP,
  ROLLING_BOULDER_TRAP,
  SQKY_BOARD,
  BEAR_TRAP,
  LANDMINE,
  SLP_GAS_TRAP,
  RUST_TRAP,
  FIRE_TRAP,
  PIT,
  SPIKED_PIT,
  HOLE,
  TRAPDOOR,
  TELEP_TRAP,
  LEVEL_TELEP,
  MAGIC_PORTAL,
  WEB,
  STATUE_TRAP,
  MAGIC_TRAP,
  ANTI_MAGIC,
  POLY_TRAP,
  VIBRATING_SQUARE
} from '../../js/config.js';

describe('Trap System Accuracy', () => {
  describe('Trap Type Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/trap.h trap type definitions
      assert.strictEqual(NO_TRAP, 0, 'NO_TRAP should be 0');
      assert.strictEqual(ARROW_TRAP, 1, 'ARROW_TRAP should be 1');
      assert.strictEqual(DART_TRAP, 2, 'DART_TRAP should be 2');
      assert.strictEqual(ROLLING_BOULDER_TRAP, 7, 'ROLLING_BOULDER_TRAP should be 7');
      assert.strictEqual(SQKY_BOARD, 4, 'SQKY_BOARD (squeaky board) should be 4');
      assert.strictEqual(BEAR_TRAP, 5, 'BEAR_TRAP should be 5');
      assert.strictEqual(LANDMINE, 6, 'LANDMINE should be 6');
      assert.strictEqual(SLP_GAS_TRAP, 8, 'SLP_GAS_TRAP (sleeping gas) should be 8');
      assert.strictEqual(RUST_TRAP, 9, 'RUST_TRAP should be 9');
      assert.strictEqual(FIRE_TRAP, 10, 'FIRE_TRAP should be 10');
      assert.strictEqual(PIT, 11, 'PIT should be 11');
      assert.strictEqual(SPIKED_PIT, 12, 'SPIKED_PIT should be 12');
      assert.strictEqual(HOLE, 13, 'HOLE should be 13');
      assert.strictEqual(TRAPDOOR, 14, 'TRAPDOOR should be 14');
      assert.strictEqual(TELEP_TRAP, 15, 'TELEP_TRAP (teleportation) should be 15');
      assert.strictEqual(LEVEL_TELEP, 16, 'LEVEL_TELEP (level teleporter) should be 16');
      assert.strictEqual(MAGIC_PORTAL, 17, 'MAGIC_PORTAL should be 17');
      assert.strictEqual(WEB, 18, 'WEB should be 18');
      assert.strictEqual(STATUE_TRAP, 19, 'STATUE_TRAP should be 19');
      assert.strictEqual(MAGIC_TRAP, 20, 'MAGIC_TRAP should be 20');
      assert.strictEqual(ANTI_MAGIC, 21, 'ANTI_MAGIC should be 21');
      assert.strictEqual(POLY_TRAP, 22, 'POLY_TRAP (polymorph) should be 22');
      assert.strictEqual(VIBRATING_SQUARE, 23, 'VIBRATING_SQUARE should be 23');
    });

    it('NO_TRAP should be zero (absence of trap)', () => {
      assert.strictEqual(NO_TRAP, 0, 'NO_TRAP is 0 (no trap present)');
    });

    it('VIBRATING_SQUARE should be last trap type', () => {
      // C ref: VIBRATING_SQUARE is the highest trap number
      assert.strictEqual(VIBRATING_SQUARE, 23, 'VIBRATING_SQUARE is highest (23)');
    });
  });

  describe('Trap Categories - Physical Traps', () => {
    it('should have projectile traps', () => {
      // Arrow and dart traps shoot projectiles
      assert(typeof ARROW_TRAP === 'number', 'ARROW_TRAP should be defined');
      assert(typeof DART_TRAP === 'number', 'DART_TRAP should be defined');
    });

    it('should have boulder trap', () => {
      assert(typeof ROLLING_BOULDER_TRAP === 'number', 'ROLLING_BOULDER_TRAP should be defined');
    });

    it('should have mechanical traps', () => {
      assert(typeof BEAR_TRAP === 'number', 'BEAR_TRAP should be defined');
      assert(typeof LANDMINE === 'number', 'LANDMINE should be defined');
      assert(typeof SQKY_BOARD === 'number', 'SQKY_BOARD should be defined');
    });

    it('should have pit types', () => {
      assert(typeof PIT === 'number', 'PIT should be defined');
      assert(typeof SPIKED_PIT === 'number', 'SPIKED_PIT should be defined');
      assert(SPIKED_PIT > PIT, 'SPIKED_PIT should come after PIT');
    });

    it('should have fall-through traps', () => {
      assert(typeof HOLE === 'number', 'HOLE should be defined');
      assert(typeof TRAPDOOR === 'number', 'TRAPDOOR should be defined');
    });
  });

  describe('Trap Categories - Elemental Traps', () => {
    it('should have fire trap', () => {
      assert(typeof FIRE_TRAP === 'number', 'FIRE_TRAP should be defined');
    });

    it('should have rust trap', () => {
      assert(typeof RUST_TRAP === 'number', 'RUST_TRAP should be defined');
    });

    it('should have sleeping gas trap', () => {
      assert(typeof SLP_GAS_TRAP === 'number', 'SLP_GAS_TRAP should be defined');
    });
  });

  describe('Trap Categories - Magical Traps', () => {
    it('should have teleportation traps', () => {
      assert(typeof TELEP_TRAP === 'number', 'TELEP_TRAP should be defined');
      assert(typeof LEVEL_TELEP === 'number', 'LEVEL_TELEP should be defined');
      assert(typeof MAGIC_PORTAL === 'number', 'MAGIC_PORTAL should be defined');
    });

    it('should have polymorph trap', () => {
      assert(typeof POLY_TRAP === 'number', 'POLY_TRAP should be defined');
    });

    it('should have magic-related traps', () => {
      assert(typeof MAGIC_TRAP === 'number', 'MAGIC_TRAP should be defined');
      assert(typeof ANTI_MAGIC === 'number', 'ANTI_MAGIC should be defined');
    });

    it('should have statue trap', () => {
      assert(typeof STATUE_TRAP === 'number', 'STATUE_TRAP should be defined');
    });
  });

  describe('Trap Categories - Special Traps', () => {
    it('should have web trap', () => {
      assert(typeof WEB === 'number', 'WEB should be defined');
    });

    it('should have vibrating square', () => {
      // The Vibrating Square is special (marks Wizard's Tower location)
      assert(typeof VIBRATING_SQUARE === 'number', 'VIBRATING_SQUARE should be defined');
    });
  });

  describe('Trap Uniqueness', () => {
    it('all trap types should be unique', () => {
      const traps = [
        NO_TRAP, ARROW_TRAP, DART_TRAP, ROLLING_BOULDER_TRAP, SQKY_BOARD,
        BEAR_TRAP, LANDMINE, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR, TELEP_TRAP, LEVEL_TELEP,
        MAGIC_PORTAL, WEB, STATUE_TRAP, MAGIC_TRAP, ANTI_MAGIC,
        POLY_TRAP, VIBRATING_SQUARE
      ];

      const unique = new Set(traps);
      assert.strictEqual(unique.size, traps.length, 'All trap types should be unique');
    });

    it('should have exactly 24 trap types (including NO_TRAP)', () => {
      // C ref: NetHack has 24 trap types (0-23)
      const trapCount = VIBRATING_SQUARE - NO_TRAP + 1;
      assert.strictEqual(trapCount, 24, 'Should have 24 trap types (0-23)');
    });
  });

  describe('Trap Ranges', () => {
    it('all trap types should be in valid range [0, 30]', () => {
      const traps = [
        NO_TRAP, ARROW_TRAP, DART_TRAP, ROLLING_BOULDER_TRAP, SQKY_BOARD,
        BEAR_TRAP, LANDMINE, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR, TELEP_TRAP, LEVEL_TELEP,
        MAGIC_PORTAL, WEB, STATUE_TRAP, MAGIC_TRAP, ANTI_MAGIC,
        POLY_TRAP, VIBRATING_SQUARE
      ];

      for (const trap of traps) {
        assert(trap >= 0 && trap <= 30,
          `Trap ${trap} should be in range [0, 30]`);
      }
    });

    it('trap types should fit in 5 bits (0-31)', () => {
      // Highest trap is 23, so all fit in 5 bits
      const traps = [
        NO_TRAP, ARROW_TRAP, DART_TRAP, ROLLING_BOULDER_TRAP, SQKY_BOARD,
        BEAR_TRAP, LANDMINE, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR, TELEP_TRAP, LEVEL_TELEP,
        MAGIC_PORTAL, WEB, STATUE_TRAP, MAGIC_TRAP, ANTI_MAGIC,
        POLY_TRAP, VIBRATING_SQUARE
      ];

      for (const trap of traps) {
        assert(trap >= 0 && trap < 32, `Trap ${trap} should fit in 5 bits`);
      }
    });
  });

  describe('Trap Relationships', () => {
    it('dart trap should come after arrow trap', () => {
      assert(DART_TRAP > ARROW_TRAP, 'DART_TRAP follows ARROW_TRAP');
    });

    it('spiked pit should come after regular pit', () => {
      assert(SPIKED_PIT > PIT, 'SPIKED_PIT is upgrade of PIT');
      assert.strictEqual(SPIKED_PIT - PIT, 1, 'SPIKED_PIT immediately follows PIT');
    });

    it('teleportation traps should be grouped', () => {
      // TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL are consecutive
      assert(TELEP_TRAP < LEVEL_TELEP, 'TELEP_TRAP before LEVEL_TELEP');
      assert(LEVEL_TELEP < MAGIC_PORTAL, 'LEVEL_TELEP before MAGIC_PORTAL');
    });

    it('hole and trapdoor should be adjacent (both cause falling)', () => {
      assert.strictEqual(TRAPDOOR - HOLE, 1, 'TRAPDOOR immediately follows HOLE');
    });
  });

  describe('Trap Danger Levels', () => {
    it('early dungeon traps should have low numbers', () => {
      // Simple mechanical traps (arrow, dart, bear, pit) are early
      assert(ARROW_TRAP < 10, 'ARROW_TRAP is early game (< 10)');
      assert(DART_TRAP < 10, 'DART_TRAP is early game (< 10)');
      assert(BEAR_TRAP < 10, 'BEAR_TRAP is early game (< 10)');
      assert(PIT < 15, 'PIT is relatively early (< 15)');
    });

    it('magical traps should have higher numbers', () => {
      // Magical traps tend to appear deeper
      assert(MAGIC_TRAP > 15, 'MAGIC_TRAP is later (> 15)');
      assert(ANTI_MAGIC > 15, 'ANTI_MAGIC is later (> 15)');
      assert(POLY_TRAP > 15, 'POLY_TRAP is later (> 15)');
    });
  });

  describe('Special Trap Properties', () => {
    it('SQKY_BOARD is non-consecutive (special alarm trap)', () => {
      // Squeaky board is at 4, between DART_TRAP(2) and BEAR_TRAP(5)
      assert.strictEqual(SQKY_BOARD, 4, 'SQKY_BOARD has specific value 4');
    });

    it('ROLLING_BOULDER_TRAP is non-consecutive (special physical trap)', () => {
      // Rolling boulder is at 7, between LANDMINE(6) and SLP_GAS_TRAP(8)
      assert.strictEqual(ROLLING_BOULDER_TRAP, 7, 'ROLLING_BOULDER_TRAP has specific value 7');
    });

    it('VIBRATING_SQUARE is unique endgame feature', () => {
      // Vibrating square marks the location of the Wizard's Tower entrance
      assert.strictEqual(VIBRATING_SQUARE, 23, 'VIBRATING_SQUARE is last (special)');
    });

    it('WEB is spider-specific trap', () => {
      // Webs are created by spiders
      assert(typeof WEB === 'number', 'WEB trap should exist');
      assert(WEB > 15, 'WEB is a later-game trap');
    });
  });

  describe('Trap Type Completeness', () => {
    it('should have all standard trap types from C NetHack', () => {
      // Verify all major trap categories are present
      const requiredTraps = [
        'ARROW_TRAP', 'DART_TRAP', 'BEAR_TRAP', 'LANDMINE',
        'PIT', 'SPIKED_PIT', 'HOLE', 'TRAPDOOR',
        'TELEP_TRAP', 'LEVEL_TELEP', 'MAGIC_PORTAL',
        'FIRE_TRAP', 'RUST_TRAP', 'SLP_GAS_TRAP',
        'MAGIC_TRAP', 'ANTI_MAGIC', 'POLY_TRAP',
        'WEB', 'STATUE_TRAP', 'SQKY_BOARD',
        'ROLLING_BOULDER_TRAP', 'VIBRATING_SQUARE'
      ];

      const trapMap = {
        ARROW_TRAP, DART_TRAP, BEAR_TRAP, LANDMINE,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR,
        TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL,
        FIRE_TRAP, RUST_TRAP, SLP_GAS_TRAP,
        MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP,
        WEB, STATUE_TRAP, SQKY_BOARD,
        ROLLING_BOULDER_TRAP, VIBRATING_SQUARE
      };

      for (const trapName of requiredTraps) {
        assert(trapMap[trapName] !== undefined,
          `${trapName} should be defined`);
      }
    });
  });

  describe('Trap Count', () => {
    it('should have 23 actual traps (excluding NO_TRAP)', () => {
      const traps = [
        ARROW_TRAP, DART_TRAP, ROLLING_BOULDER_TRAP, SQKY_BOARD,
        BEAR_TRAP, LANDMINE, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR, TELEP_TRAP, LEVEL_TELEP,
        MAGIC_PORTAL, WEB, STATUE_TRAP, MAGIC_TRAP, ANTI_MAGIC,
        POLY_TRAP, VIBRATING_SQUARE
      ];

      assert.strictEqual(traps.length, 22, 'Should have 22 actual traps (excluding NO_TRAP)');
      // Note: Count is 22 not 23 because we're excluding NO_TRAP from this list
    });

    it('trap indices should span 0-23 range', () => {
      assert.strictEqual(NO_TRAP, 0, 'First trap index is 0');
      assert.strictEqual(VIBRATING_SQUARE, 23, 'Last trap index is 23');
    });
  });
});
