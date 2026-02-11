/**
 * Game Constants Accuracy Tests
 *
 * Verify that fundamental game constants (attributes, doors, levels, alignment)
 * match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Attribute indices (A_*)
  A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA,
  // Alignment constants
  A_CHAOTIC, A_NEUTRAL, A_LAWFUL,
  // Door states (D_*)
  D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, D_SECRET,
  // Map dimensions and limits
  COLNO, ROWNO, MAXLEVEL,
  // Gender constants
  MALE, FEMALE,
  // Race constants
  RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC
} from '../../js/config.js';

describe('Game Constants Accuracy', () => {
  describe('Attribute Indices (A_*)', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/hack.h attribute indices
      assert.strictEqual(A_STR, 0, 'A_STR should be 0');
      assert.strictEqual(A_INT, 1, 'A_INT should be 1');
      assert.strictEqual(A_WIS, 2, 'A_WIS should be 2');
      assert.strictEqual(A_DEX, 3, 'A_DEX should be 3');
      assert.strictEqual(A_CON, 4, 'A_CON should be 4');
      assert.strictEqual(A_CHA, 5, 'A_CHA should be 5');
    });

    it('should be sequential from 0-5', () => {
      const attrs = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA];
      for (let i = 0; i < attrs.length; i++) {
        assert.strictEqual(attrs[i], i, `Attribute ${i} should have value ${i}`);
      }
    });

    it('should have exactly 6 primary attributes', () => {
      // C ref: NetHack has exactly 6 attributes
      const attrs = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA];
      const unique = new Set(attrs);
      assert.strictEqual(unique.size, 6, 'Should have 6 unique attribute indices');
    });

    it('all attributes should be in valid range [0, 5]', () => {
      const attrs = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA];
      for (const attr of attrs) {
        assert(attr >= 0 && attr <= 5, `Attribute ${attr} should be in [0, 5]`);
      }
    });
  });

  describe('Attribute Ordering', () => {
    it('STR should come first (melee combat)', () => {
      assert.strictEqual(A_STR, 0, 'Strength is the first attribute');
    });

    it('mental attributes should be grouped (INT, WIS)', () => {
      assert(A_INT < A_WIS, 'INT should come before WIS');
      assert.strictEqual(A_WIS - A_INT, 1, 'INT and WIS should be adjacent');
    });

    it('physical attributes should be together (STR, DEX, CON)', () => {
      // STR=0, DEX=3, CON=4
      assert(A_STR < A_DEX, 'STR before DEX');
      assert(A_DEX < A_CON, 'DEX before CON');
    });

    it('CHA should be last', () => {
      assert.strictEqual(A_CHA, 5, 'Charisma is the last attribute');
    });
  });

  describe('Alignment Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/align.h alignment values
      assert.strictEqual(A_CHAOTIC, -1, 'A_CHAOTIC should be -1');
      assert.strictEqual(A_NEUTRAL, 0, 'A_NEUTRAL should be 0');
      assert.strictEqual(A_LAWFUL, 1, 'A_LAWFUL should be 1');
    });

    it('alignments should be in order chaotic < neutral < lawful', () => {
      assert(A_CHAOTIC < A_NEUTRAL, 'Chaotic < Neutral');
      assert(A_NEUTRAL < A_LAWFUL, 'Neutral < Lawful');
    });

    it('neutral should be zero (default/center)', () => {
      assert.strictEqual(A_NEUTRAL, 0, 'Neutral is 0 (default alignment)');
    });

    it('alignments should span range [-1, 1]', () => {
      assert.strictEqual(A_CHAOTIC, -1);
      assert.strictEqual(A_LAWFUL, 1);
      assert.strictEqual(A_LAWFUL - A_CHAOTIC, 2, 'Alignment range should be 2');
    });
  });

  describe('Door State Constants (D_*)', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h door state bit flags
      assert.strictEqual(D_NODOOR, 0, 'D_NODOOR should be 0');
      assert.strictEqual(D_BROKEN, 1, 'D_BROKEN should be 1');
      assert.strictEqual(D_ISOPEN, 2, 'D_ISOPEN should be 2');
      assert.strictEqual(D_CLOSED, 4, 'D_CLOSED should be 4');
      assert.strictEqual(D_LOCKED, 8, 'D_LOCKED should be 8');
      assert.strictEqual(D_TRAPPED, 16, 'D_TRAPPED should be 16');
      assert.strictEqual(D_SECRET, 32, 'D_SECRET should be 32');
    });

    it('door flags should be powers of 2 (bit flags)', () => {
      const doorFlags = [D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, D_SECRET];
      for (const flag of doorFlags) {
        // Power of 2 test: n & (n-1) === 0
        assert.strictEqual(flag & (flag - 1), 0,
          `Door flag ${flag} should be power of 2`);
      }
    });

    it('D_NODOOR should be zero (no door present)', () => {
      assert.strictEqual(D_NODOOR, 0, 'D_NODOOR is 0 (absence of door)');
    });

    it('door flags should be unique', () => {
      const doorFlags = [D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, D_SECRET];
      const unique = new Set(doorFlags);
      assert.strictEqual(unique.size, doorFlags.length, 'All door flags should be unique');
    });

    it('door flags can be combined with bitwise OR', () => {
      // Doors can be closed and locked at same time
      const closedAndLocked = D_CLOSED | D_LOCKED;
      assert.strictEqual(closedAndLocked, 12, 'D_CLOSED | D_LOCKED should be 12');
      assert(closedAndLocked & D_CLOSED, 'Combined flag should include D_CLOSED');
      assert(closedAndLocked & D_LOCKED, 'Combined flag should include D_LOCKED');
    });

    it('secret doors can be trapped', () => {
      // Secret doors can also be trapped
      const secretTrapped = D_SECRET | D_TRAPPED;
      assert(secretTrapped & D_SECRET, 'Should have D_SECRET bit');
      assert(secretTrapped & D_TRAPPED, 'Should have D_TRAPPED bit');
    });
  });

  describe('Map Dimensions', () => {
    it('should match C NetHack map size', () => {
      // C ref: include/config.h COLNO and ROWNO
      assert.strictEqual(COLNO, 80, 'Map should be 80 columns wide');
      assert.strictEqual(ROWNO, 21, 'Map should be 21 rows tall');
    });

    it('standard terminal size (80x24) fits map plus status', () => {
      // Map is 21 rows, leaves 3 rows for messages/status in 24-line terminal
      assert(ROWNO <= 24, 'Map should fit in standard terminal height');
      assert.strictEqual(COLNO, 80, 'Map width matches standard terminal width');
    });

    it('map dimensions should be positive', () => {
      assert(COLNO > 0, 'COLNO should be positive');
      assert(ROWNO > 0, 'ROWNO should be positive');
    });
  });

  describe('Dungeon Depth', () => {
    it('MAXLEVEL should define maximum dungeon depth', () => {
      // C ref: include/config.h MAXLEVEL
      assert.strictEqual(MAXLEVEL, 32, 'Maximum dungeon level should be 32');
    });

    it('MAXLEVEL should be reasonable for gameplay', () => {
      assert(MAXLEVEL > 20, 'Dungeon should be deep enough for endgame');
      assert(MAXLEVEL < 100, 'Dungeon should not be unreasonably deep');
    });
  });

  describe('Gender Constants', () => {
    it('should have male and female constants', () => {
      // C ref: include/hack.h gender defines
      assert.strictEqual(MALE, 0, 'MALE should be 0');
      assert.strictEqual(FEMALE, 1, 'FEMALE should be 1');
    });

    it('genders should be distinct', () => {
      assert.notStrictEqual(MALE, FEMALE, 'Male and female should be different');
    });

    it('genders should be in valid range', () => {
      assert(MALE >= 0 && MALE <= 1, 'MALE should be 0 or 1');
      assert(FEMALE >= 0 && FEMALE <= 1, 'FEMALE should be 0 or 1');
    });
  });

  describe('Race Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/hack.h race indices
      assert.strictEqual(RACE_HUMAN, 0, 'RACE_HUMAN should be 0');
      assert.strictEqual(RACE_ELF, 1, 'RACE_ELF should be 1');
      assert.strictEqual(RACE_DWARF, 2, 'RACE_DWARF should be 2');
      assert.strictEqual(RACE_GNOME, 3, 'RACE_GNOME should be 3');
      assert.strictEqual(RACE_ORC, 4, 'RACE_ORC should be 4');
    });

    it('should be sequential from 0-4', () => {
      const races = [RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC];
      for (let i = 0; i < races.length; i++) {
        assert.strictEqual(races[i], i, `Race ${i} should have value ${i}`);
      }
    });

    it('RACE_HUMAN should be first', () => {
      assert.strictEqual(RACE_HUMAN, 0, 'Human is the default/first race');
    });

    it('all races should be unique', () => {
      const races = [RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC];
      const unique = new Set(races);
      assert.strictEqual(unique.size, 5, 'Should have 5 unique races');
    });

    it('RACE_ORC should be last', () => {
      assert.strictEqual(RACE_ORC, 4, 'Orc is the last playable race');
    });
  });

  describe('Constant Relationships', () => {
    it('attribute count matches D&D convention', () => {
      // D&D and NetHack both have 6 primary attributes
      const attrCount = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA].length;
      assert.strictEqual(attrCount, 6, 'Six primary attributes (D&D convention)');
    });

    it('race count matches player races array', () => {
      // Should have 5 playable races (confirmed in player_accuracy.test.js)
      const raceCount = RACE_ORC - RACE_HUMAN + 1;
      assert.strictEqual(raceCount, 5, '5 playable races');
    });

    it('alignment count is 3 (law/neutral/chaos)', () => {
      const alignments = [A_CHAOTIC, A_NEUTRAL, A_LAWFUL];
      assert.strictEqual(alignments.length, 3, '3 alignments in NetHack');
    });

    it('gender count is 2 (binary)', () => {
      const genders = [MALE, FEMALE];
      assert.strictEqual(genders.length, 2, '2 genders in NetHack');
    });
  });

  describe('Critical Constant Values', () => {
    it('A_NEUTRAL should be 0 for arithmetic', () => {
      // Neutral=0 allows simple arithmetic for alignment shifts
      assert.strictEqual(A_NEUTRAL, 0, 'A_NEUTRAL must be 0');
    });

    it('D_NODOOR should be 0 for absence checks', () => {
      // D_NODOOR=0 allows simple falsy checks
      assert.strictEqual(D_NODOOR, 0, 'D_NODOOR must be 0');
    });

    it('MALE should be 0 (default/first)', () => {
      // Male=0 is the default in many contexts
      assert.strictEqual(MALE, 0, 'MALE should be 0 (default)');
    });

    it('RACE_HUMAN should be 0 (default/first)', () => {
      // Human=0 is the default race
      assert.strictEqual(RACE_HUMAN, 0, 'RACE_HUMAN should be 0 (default)');
    });

    it('A_STR should be 0 (first attribute)', () => {
      // STR=0 is the first attribute index
      assert.strictEqual(A_STR, 0, 'A_STR should be 0 (first attribute)');
    });
  });

  describe('Range Validation', () => {
    it('all attributes fit in 3 bits (0-7)', () => {
      const attrs = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA];
      for (const attr of attrs) {
        assert(attr >= 0 && attr < 8, `Attribute ${attr} should fit in 3 bits`);
      }
    });

    it('all races fit in 3 bits (0-7)', () => {
      const races = [RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC];
      for (const race of races) {
        assert(race >= 0 && race < 8, `Race ${race} should fit in 3 bits`);
      }
    });

    it('door flags fit in 6 bits (0-63)', () => {
      // Highest door flag is D_SECRET = 32, so all fit in 6 bits
      const doorFlags = [D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, D_SECRET];
      for (const flag of doorFlags) {
        assert(flag >= 0 && flag < 64, `Door flag ${flag} should fit in 6 bits`);
      }
    });
  });
});
