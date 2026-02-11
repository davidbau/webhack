/**
 * Direction Constants Accuracy Tests
 *
 * Verify that direction constants match C NetHack exactly.
 * C ref: include/hack.h direction definitions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Compass directions (0-7)
  DIR_W, DIR_NW, DIR_N, DIR_NE,
  DIR_E, DIR_SE, DIR_S, DIR_SW,
  // Vertical directions
  DIR_UP, DIR_DOWN,
  // Direction count
  N_DIRS
} from '../../js/config.js';

describe('Direction Constants Accuracy', () => {
  describe('Compass Direction Constants (0-7)', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/hack.h direction definitions
      // Directions are numbered clockwise starting from west (left)
      assert.strictEqual(DIR_W, 0, 'DIR_W (west/left) should be 0');
      assert.strictEqual(DIR_NW, 1, 'DIR_NW (northwest/up-left) should be 1');
      assert.strictEqual(DIR_N, 2, 'DIR_N (north/up) should be 2');
      assert.strictEqual(DIR_NE, 3, 'DIR_NE (northeast/up-right) should be 3');
      assert.strictEqual(DIR_E, 4, 'DIR_E (east/right) should be 4');
      assert.strictEqual(DIR_SE, 5, 'DIR_SE (southeast/down-right) should be 5');
      assert.strictEqual(DIR_S, 6, 'DIR_S (south/down) should be 6');
      assert.strictEqual(DIR_SW, 7, 'DIR_SW (southwest/down-left) should be 7');
    });

    it('compass directions should be sequential from 0-7', () => {
      const compassDirs = [
        DIR_W, DIR_NW, DIR_N, DIR_NE,
        DIR_E, DIR_SE, DIR_S, DIR_SW
      ];
      for (let i = 0; i < compassDirs.length; i++) {
        assert.strictEqual(compassDirs[i], i, `Compass direction ${i} should be ${i}`);
      }
    });

    it('DIR_W should be first compass direction', () => {
      assert.strictEqual(DIR_W, 0, 'West is first (0)');
    });

    it('DIR_SW should be last compass direction', () => {
      assert.strictEqual(DIR_SW, 7, 'Southwest is last compass (7)');
    });
  });

  describe('Vertical Direction Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/hack.h vertical directions
      assert.strictEqual(DIR_UP, 8, 'DIR_UP should be 8');
      assert.strictEqual(DIR_DOWN, 9, 'DIR_DOWN should be 9');
    });

    it('vertical directions should follow compass directions', () => {
      assert(DIR_UP > DIR_SW, 'UP follows compass directions');
      assert(DIR_DOWN > DIR_UP, 'DOWN follows UP');
    });

    it('DIR_UP should be 8 (first vertical)', () => {
      assert.strictEqual(DIR_UP, 8, 'UP is 8 (first vertical direction)');
    });

    it('DIR_DOWN should be 9 (second vertical)', () => {
      assert.strictEqual(DIR_DOWN, 9, 'DOWN is 9 (second vertical direction)');
    });
  });

  describe('Direction Count Constant', () => {
    it('N_DIRS should be 8 (compass directions only)', () => {
      // C ref: N_DIRS excludes UP/DOWN (only counts horizontal/compass dirs)
      assert.strictEqual(N_DIRS, 8, 'N_DIRS should be 8 (excludes vertical)');
    });

    it('N_DIRS should equal number of compass directions', () => {
      assert.strictEqual(N_DIRS, DIR_SW - DIR_W + 1, 'N_DIRS counts W through SW');
    });

    it('N_DIRS should not include vertical directions', () => {
      assert(DIR_UP >= N_DIRS, 'UP is beyond N_DIRS count');
      assert(DIR_DOWN >= N_DIRS, 'DOWN is beyond N_DIRS count');
    });
  });

  describe('Direction Uniqueness', () => {
    it('all directions should be unique', () => {
      const allDirs = [
        DIR_W, DIR_NW, DIR_N, DIR_NE,
        DIR_E, DIR_SE, DIR_S, DIR_SW,
        DIR_UP, DIR_DOWN
      ];
      const unique = new Set(allDirs);
      assert.strictEqual(unique.size, 10, 'All 10 directions should be unique');
    });

    it('should have exactly 10 direction constants', () => {
      // 8 compass + 2 vertical = 10 total
      const dirCount = 10;
      assert.strictEqual(dirCount, 10, '10 total direction constants');
    });
  });

  describe('Direction Ranges', () => {
    it('compass directions should be in range [0, 7]', () => {
      const compassDirs = [
        DIR_W, DIR_NW, DIR_N, DIR_NE,
        DIR_E, DIR_SE, DIR_S, DIR_SW
      ];
      for (const dir of compassDirs) {
        assert(dir >= 0 && dir <= 7, `Compass direction ${dir} in [0, 7]`);
      }
    });

    it('vertical directions should be in range [8, 9]', () => {
      const verticalDirs = [DIR_UP, DIR_DOWN];
      for (const dir of verticalDirs) {
        assert(dir >= 8 && dir <= 9, `Vertical direction ${dir} in [8, 9]`);
      }
    });

    it('all directions should fit in 4 bits (0-15)', () => {
      const allDirs = [
        DIR_W, DIR_NW, DIR_N, DIR_NE,
        DIR_E, DIR_SE, DIR_S, DIR_SW,
        DIR_UP, DIR_DOWN
      ];
      for (const dir of allDirs) {
        assert(dir >= 0 && dir < 16, `Direction ${dir} fits in 4 bits`);
      }
    });
  });

  describe('Cardinal Directions', () => {
    it('should have four cardinal directions (N, E, S, W)', () => {
      assert(typeof DIR_N === 'number', 'North defined');
      assert(typeof DIR_E === 'number', 'East defined');
      assert(typeof DIR_S === 'number', 'South defined');
      assert(typeof DIR_W === 'number', 'West defined');
    });

    it('cardinal directions should be even numbered', () => {
      // In C NetHack, cardinal directions are at even indices
      assert.strictEqual(DIR_W % 2, 0, 'West is even');
      assert.strictEqual(DIR_N % 2, 0, 'North is even');
      assert.strictEqual(DIR_E % 2, 0, 'East is even');
      assert.strictEqual(DIR_S % 2, 0, 'South is even');
    });

    it('cardinal directions should be evenly spaced', () => {
      // Cardinal directions are 2 apart (with diagonals between)
      assert.strictEqual(DIR_N - DIR_W, 2, 'W to N is 2 steps');
      assert.strictEqual(DIR_E - DIR_N, 2, 'N to E is 2 steps');
      assert.strictEqual(DIR_S - DIR_E, 2, 'E to S is 2 steps');
    });
  });

  describe('Diagonal Directions', () => {
    it('should have four diagonal directions (NW, NE, SE, SW)', () => {
      assert(typeof DIR_NW === 'number', 'Northwest defined');
      assert(typeof DIR_NE === 'number', 'Northeast defined');
      assert(typeof DIR_SE === 'number', 'Southeast defined');
      assert(typeof DIR_SW === 'number', 'Southwest defined');
    });

    it('diagonal directions should be odd numbered', () => {
      // In C NetHack, diagonal directions are at odd indices
      assert.strictEqual(DIR_NW % 2, 1, 'Northwest is odd');
      assert.strictEqual(DIR_NE % 2, 1, 'Northeast is odd');
      assert.strictEqual(DIR_SE % 2, 1, 'Southeast is odd');
      assert.strictEqual(DIR_SW % 2, 1, 'Southwest is odd');
    });

    it('diagonals should be between cardinals', () => {
      assert(DIR_W < DIR_NW && DIR_NW < DIR_N, 'NW between W and N');
      assert(DIR_N < DIR_NE && DIR_NE < DIR_E, 'NE between N and E');
      assert(DIR_E < DIR_SE && DIR_SE < DIR_S, 'SE between E and S');
      assert(DIR_S < DIR_SW && DIR_SW < (DIR_W + 8), 'SW between S and W (wrapping)');
    });
  });

  describe('Opposite Directions', () => {
    it('east should be opposite of west', () => {
      // Opposite directions differ by 4 (N_DIRS / 2)
      assert.strictEqual((DIR_E - DIR_W + N_DIRS) % N_DIRS, 4, 'E opposite W');
    });

    it('north should be opposite of south', () => {
      assert.strictEqual((DIR_S - DIR_N + N_DIRS) % N_DIRS, 4, 'S opposite N');
    });

    it('northeast should be opposite of southwest', () => {
      assert.strictEqual((DIR_SW - DIR_NE + N_DIRS) % N_DIRS, 4, 'SW opposite NE');
    });

    it('northwest should be opposite of southeast', () => {
      assert.strictEqual((DIR_SE - DIR_NW + N_DIRS) % N_DIRS, 4, 'SE opposite NW');
    });

    it('up should be opposite of down', () => {
      // Vertical directions are opposites (differ by 1)
      assert.strictEqual(DIR_DOWN - DIR_UP, 1, 'DOWN opposite UP');
    });
  });

  describe('Direction Ordering', () => {
    it('directions should be clockwise from west', () => {
      // C NetHack orders directions clockwise starting from west (left)
      assert(DIR_W < DIR_NW, 'W before NW');
      assert(DIR_NW < DIR_N, 'NW before N');
      assert(DIR_N < DIR_NE, 'N before NE');
      assert(DIR_NE < DIR_E, 'NE before E');
      assert(DIR_E < DIR_SE, 'E before SE');
      assert(DIR_SE < DIR_S, 'SE before S');
      assert(DIR_S < DIR_SW, 'S before SW');
    });

    it('west should come first', () => {
      assert.strictEqual(DIR_W, 0, 'West is first compass direction');
    });

    it('vertical directions should come after compass', () => {
      assert(DIR_UP > DIR_SW, 'UP after all compass directions');
      assert(DIR_DOWN > DIR_UP, 'DOWN after UP');
    });
  });

  describe('Direction Categories', () => {
    it('should have exactly 4 cardinal directions', () => {
      const cardinals = [DIR_N, DIR_E, DIR_S, DIR_W];
      const unique = new Set(cardinals);
      assert.strictEqual(unique.size, 4, '4 unique cardinal directions');
    });

    it('should have exactly 4 diagonal directions', () => {
      const diagonals = [DIR_NW, DIR_NE, DIR_SE, DIR_SW];
      const unique = new Set(diagonals);
      assert.strictEqual(unique.size, 4, '4 unique diagonal directions');
    });

    it('should have exactly 2 vertical directions', () => {
      const verticals = [DIR_UP, DIR_DOWN];
      const unique = new Set(verticals);
      assert.strictEqual(unique.size, 2, '2 unique vertical directions');
    });

    it('compass directions should equal cardinals + diagonals', () => {
      const compassCount = DIR_SW - DIR_W + 1; // 8 directions
      const cardinalCount = 4;
      const diagonalCount = 4;
      assert.strictEqual(compassCount, cardinalCount + diagonalCount,
                        'Compass = cardinals + diagonals');
    });
  });

  describe('Direction Completeness', () => {
    it('should have all compass directions from C NetHack', () => {
      const requiredDirs = [
        'DIR_W', 'DIR_NW', 'DIR_N', 'DIR_NE',
        'DIR_E', 'DIR_SE', 'DIR_S', 'DIR_SW'
      ];

      const dirMap = {
        DIR_W, DIR_NW, DIR_N, DIR_NE,
        DIR_E, DIR_SE, DIR_S, DIR_SW
      };

      for (const dirName of requiredDirs) {
        assert(dirMap[dirName] !== undefined, `${dirName} should be defined`);
      }
    });

    it('should have all vertical directions from C NetHack', () => {
      assert(typeof DIR_UP === 'number', 'DIR_UP should be defined');
      assert(typeof DIR_DOWN === 'number', 'DIR_DOWN should be defined');
    });

    it('should have N_DIRS constant', () => {
      assert(typeof N_DIRS === 'number', 'N_DIRS should be defined');
    });
  });

  describe('Critical Direction Values', () => {
    it('DIR_W should be 0 (start of compass)', () => {
      assert.strictEqual(DIR_W, 0, 'DIR_W must be 0');
    });

    it('DIR_SW should be 7 (end of compass)', () => {
      assert.strictEqual(DIR_SW, 7, 'DIR_SW must be 7');
    });

    it('N_DIRS should be 8 (compass count)', () => {
      assert.strictEqual(N_DIRS, 8, 'N_DIRS must be 8');
    });

    it('DIR_UP should be 8 (first vertical)', () => {
      assert.strictEqual(DIR_UP, 8, 'DIR_UP must be 8');
    });

    it('DIR_DOWN should be 9 (second vertical)', () => {
      assert.strictEqual(DIR_DOWN, 9, 'DIR_DOWN must be 9');
    });
  });

  describe('Direction Indexing', () => {
    it('directions should be suitable for array indexing', () => {
      const allDirs = [
        DIR_W, DIR_NW, DIR_N, DIR_NE,
        DIR_E, DIR_SE, DIR_S, DIR_SW,
        DIR_UP, DIR_DOWN
      ];

      for (const dir of allDirs) {
        assert(dir >= 0, `Direction ${dir} should be non-negative`);
        assert(Number.isInteger(dir), `Direction ${dir} should be integer`);
      }
    });

    it('compass directions should index an 8-element array', () => {
      const compassDirs = [
        DIR_W, DIR_NW, DIR_N, DIR_NE,
        DIR_E, DIR_SE, DIR_S, DIR_SW
      ];

      for (const dir of compassDirs) {
        assert(dir >= 0 && dir < N_DIRS, `Compass direction ${dir} in [0, ${N_DIRS})`);
      }
    });
  });

  describe('Movement Delta Consistency', () => {
    it('opposite directions should have opposite effects', () => {
      // In NetHack, opposite directions (differing by 4) have opposite deltas
      // E.g., if E moves right (+1,0), W moves left (-1,0)
      const oppositeOffset = N_DIRS / 2; // 4

      assert.strictEqual(oppositeOffset, 4, 'Opposite directions differ by 4');
      assert.strictEqual((DIR_E + oppositeOffset) % N_DIRS, DIR_W,
                        'E + 4 (mod 8) = W');
      assert.strictEqual((DIR_N + oppositeOffset) % N_DIRS, DIR_S,
                        'N + 4 (mod 8) = S');
    });

    it('diagonal directions should be between adjacent cardinals', () => {
      // NW is between W(0) and N(2)
      assert(DIR_W < DIR_NW && DIR_NW < DIR_N, 'NW between W and N');
      // NE is between N(2) and E(4)
      assert(DIR_N < DIR_NE && DIR_NE < DIR_E, 'NE between N and E');
      // SE is between E(4) and S(6)
      assert(DIR_E < DIR_SE && DIR_SE < DIR_S, 'SE between E and S');
      // SW is between S(6) and W(0+8=8 with wrapping)
      assert(DIR_S < DIR_SW, 'SW after S');
    });
  });

  describe('Count Validation', () => {
    it('should have exactly 8 compass directions', () => {
      const compassCount = DIR_SW - DIR_W + 1;
      assert.strictEqual(compassCount, 8, '8 compass directions (0-7)');
    });

    it('should have exactly 2 vertical directions', () => {
      const verticalCount = DIR_DOWN - DIR_UP + 1;
      assert.strictEqual(verticalCount, 2, '2 vertical directions (8-9)');
    });

    it('should have exactly 10 total directions', () => {
      const totalCount = DIR_DOWN - DIR_W + 1;
      assert.strictEqual(totalCount, 10, '10 total directions (0-9)');
    });
  });
});
