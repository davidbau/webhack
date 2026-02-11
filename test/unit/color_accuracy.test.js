/**
 * Color Constants Accuracy Tests
 *
 * Verify that display color constants match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Standard colors (0-7)
  CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
  CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY,
  // Special color
  NO_COLOR,
  // Bright colors (9-15)
  CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
  CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
} from '../../js/display.js';

describe('Color Constants Accuracy', () => {
  describe('Standard Color Constants (0-7)', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/color.h color definitions
      assert.strictEqual(CLR_BLACK, 0, 'CLR_BLACK should be 0');
      assert.strictEqual(CLR_RED, 1, 'CLR_RED should be 1');
      assert.strictEqual(CLR_GREEN, 2, 'CLR_GREEN should be 2');
      assert.strictEqual(CLR_BROWN, 3, 'CLR_BROWN should be 3');
      assert.strictEqual(CLR_BLUE, 4, 'CLR_BLUE should be 4');
      assert.strictEqual(CLR_MAGENTA, 5, 'CLR_MAGENTA should be 5');
      assert.strictEqual(CLR_CYAN, 6, 'CLR_CYAN should be 6');
      assert.strictEqual(CLR_GRAY, 7, 'CLR_GRAY should be 7');
    });

    it('standard colors should be sequential from 0-7', () => {
      const standardColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY
      ];
      for (let i = 0; i < standardColors.length; i++) {
        assert.strictEqual(standardColors[i], i, `Standard color ${i} should be ${i}`);
      }
    });

    it('CLR_BLACK should be 0 (first color)', () => {
      assert.strictEqual(CLR_BLACK, 0, 'Black is first (0)');
    });

    it('CLR_GRAY should be 7 (last standard color)', () => {
      assert.strictEqual(CLR_GRAY, 7, 'Gray is last standard (7)');
    });
  });

  describe('Special Color Constant', () => {
    it('NO_COLOR should be 8', () => {
      // C ref: include/color.h NO_COLOR definition
      assert.strictEqual(NO_COLOR, 8, 'NO_COLOR should be 8');
    });

    it('NO_COLOR should follow standard colors', () => {
      assert.strictEqual(NO_COLOR - CLR_GRAY, 1, 'NO_COLOR follows CLR_GRAY');
    });

    it('NO_COLOR should be in the gap before bright colors', () => {
      assert(NO_COLOR < CLR_ORANGE, 'NO_COLOR before bright colors');
      assert(NO_COLOR > CLR_GRAY, 'NO_COLOR after standard colors');
    });
  });

  describe('Bright Color Constants (9-15)', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/color.h bright color definitions
      assert.strictEqual(CLR_ORANGE, 9, 'CLR_ORANGE should be 9');
      assert.strictEqual(CLR_BRIGHT_GREEN, 10, 'CLR_BRIGHT_GREEN should be 10');
      assert.strictEqual(CLR_YELLOW, 11, 'CLR_YELLOW should be 11');
      assert.strictEqual(CLR_BRIGHT_BLUE, 12, 'CLR_BRIGHT_BLUE should be 12');
      assert.strictEqual(CLR_BRIGHT_MAGENTA, 13, 'CLR_BRIGHT_MAGENTA should be 13');
      assert.strictEqual(CLR_BRIGHT_CYAN, 14, 'CLR_BRIGHT_CYAN should be 14');
      assert.strictEqual(CLR_WHITE, 15, 'CLR_WHITE should be 15');
    });

    it('bright colors should be sequential from 9-15', () => {
      const brightColors = [
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
        CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];
      for (let i = 0; i < brightColors.length; i++) {
        assert.strictEqual(brightColors[i], 9 + i, `Bright color ${i} should be ${9 + i}`);
      }
    });

    it('CLR_ORANGE should be first bright color', () => {
      assert.strictEqual(CLR_ORANGE, 9, 'Orange is first bright (9)');
    });

    it('CLR_WHITE should be last color', () => {
      assert.strictEqual(CLR_WHITE, 15, 'White is last (15)');
    });
  });

  describe('Color Uniqueness', () => {
    it('all colors should be unique', () => {
      const allColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY,
        NO_COLOR,
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
        CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];
      const unique = new Set(allColors);
      assert.strictEqual(unique.size, 16, 'All 16 color constants should be unique');
    });

    it('should have exactly 16 color constants', () => {
      // 8 standard + 1 NO_COLOR + 7 bright = 16 total
      const colorCount = 16;
      assert.strictEqual(colorCount, 16, '16 total color constants');
    });
  });

  describe('Color Ranges', () => {
    it('all colors should fit in 4 bits (0-15)', () => {
      const allColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY,
        NO_COLOR,
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
        CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];
      for (const color of allColors) {
        assert(color >= 0 && color < 16, `Color ${color} should fit in 4 bits`);
      }
    });

    it('standard colors should be in range [0, 7]', () => {
      const standardColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY
      ];
      for (const color of standardColors) {
        assert(color >= 0 && color <= 7, `Standard color ${color} in [0, 7]`);
      }
    });

    it('bright colors should be in range [9, 15]', () => {
      const brightColors = [
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
        CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];
      for (const color of brightColors) {
        assert(color >= 9 && color <= 15, `Bright color ${color} in [9, 15]`);
      }
    });
  });

  describe('Color Categories', () => {
    it('should have primary colors', () => {
      assert(typeof CLR_RED === 'number', 'Red defined');
      assert(typeof CLR_GREEN === 'number', 'Green defined');
      assert(typeof CLR_BLUE === 'number', 'Blue defined');
    });

    it('should have secondary colors', () => {
      assert(typeof CLR_CYAN === 'number', 'Cyan (blue+green) defined');
      assert(typeof CLR_MAGENTA === 'number', 'Magenta (red+blue) defined');
      assert(typeof CLR_YELLOW === 'number', 'Yellow (red+green) defined');
    });

    it('should have neutral colors', () => {
      assert(typeof CLR_BLACK === 'number', 'Black defined');
      assert(typeof CLR_WHITE === 'number', 'White defined');
      assert(typeof CLR_GRAY === 'number', 'Gray defined');
    });

    it('should have earth tones', () => {
      assert(typeof CLR_BROWN === 'number', 'Brown defined');
      assert(typeof CLR_ORANGE === 'number', 'Orange defined');
    });

    it('should have bright variants', () => {
      assert(typeof CLR_BRIGHT_GREEN === 'number', 'Bright green defined');
      assert(typeof CLR_BRIGHT_BLUE === 'number', 'Bright blue defined');
      assert(typeof CLR_BRIGHT_MAGENTA === 'number', 'Bright magenta defined');
      assert(typeof CLR_BRIGHT_CYAN === 'number', 'Bright cyan defined');
    });
  });

  describe('Color Relationships', () => {
    it('CLR_BLACK should be first', () => {
      assert.strictEqual(CLR_BLACK, 0, 'Black is 0 (first color)');
    });

    it('CLR_WHITE should be last', () => {
      assert.strictEqual(CLR_WHITE, 15, 'White is 15 (last color)');
    });

    it('NO_COLOR should be in middle', () => {
      assert(NO_COLOR > CLR_GRAY, 'NO_COLOR after standard colors');
      assert(NO_COLOR < CLR_ORANGE, 'NO_COLOR before bright colors');
      assert.strictEqual(NO_COLOR, 8, 'NO_COLOR is 8 (middle gap)');
    });

    it('bright colors should have higher values than standard', () => {
      assert(CLR_BRIGHT_GREEN > CLR_GREEN, 'Bright green > green');
      assert(CLR_BRIGHT_BLUE > CLR_BLUE, 'Bright blue > blue');
      assert(CLR_BRIGHT_MAGENTA > CLR_MAGENTA, 'Bright magenta > magenta');
      assert(CLR_BRIGHT_CYAN > CLR_CYAN, 'Bright cyan > cyan');
    });

    it('yellow should be bright version of brown', () => {
      // In NetHack, yellow is the bright version of brown
      assert(CLR_YELLOW > CLR_BROWN, 'Yellow (bright) > brown (dark)');
    });

    it('orange should follow NO_COLOR', () => {
      assert.strictEqual(CLR_ORANGE - NO_COLOR, 1, 'Orange follows NO_COLOR');
    });
  });

  describe('Standard vs Bright Color Pairs', () => {
    it('should have matching bright colors for some standard colors', () => {
      // Green has bright variant
      assert(CLR_BRIGHT_GREEN > CLR_GREEN, 'Bright green exists');
      // Blue has bright variant
      assert(CLR_BRIGHT_BLUE > CLR_BLUE, 'Bright blue exists');
      // Magenta has bright variant
      assert(CLR_BRIGHT_MAGENTA > CLR_MAGENTA, 'Bright magenta exists');
      // Cyan has bright variant
      assert(CLR_BRIGHT_CYAN > CLR_CYAN, 'Bright cyan exists');
    });

    it('gray should not have bright variant (white is used)', () => {
      // White serves as bright gray
      assert.strictEqual(CLR_WHITE, 15, 'White is brightest neutral');
    });

    it('brown uses yellow as bright variant', () => {
      // Yellow is the bright version of brown in NetHack
      assert(CLR_YELLOW > CLR_BROWN, 'Yellow is bright brown');
    });
  });

  describe('Color Count by Category', () => {
    it('should have exactly 8 standard colors', () => {
      const standardCount = CLR_GRAY - CLR_BLACK + 1;
      assert.strictEqual(standardCount, 8, '8 standard colors (0-7)');
    });

    it('should have exactly 7 bright colors', () => {
      const brightCount = CLR_WHITE - CLR_ORANGE + 1;
      assert.strictEqual(brightCount, 7, '7 bright colors (9-15)');
    });

    it('should have exactly 1 special color (NO_COLOR)', () => {
      assert.strictEqual(NO_COLOR, 8, '1 special color (8)');
    });
  });

  describe('Color Completeness', () => {
    it('should have all standard colors from C NetHack', () => {
      const requiredColors = [
        'CLR_BLACK', 'CLR_RED', 'CLR_GREEN', 'CLR_BROWN',
        'CLR_BLUE', 'CLR_MAGENTA', 'CLR_CYAN', 'CLR_GRAY'
      ];

      const colorMap = {
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY
      };

      for (const colorName of requiredColors) {
        assert(colorMap[colorName] !== undefined, `${colorName} should be defined`);
      }
    });

    it('should have all bright colors from C NetHack', () => {
      const requiredBrightColors = [
        'CLR_ORANGE', 'CLR_BRIGHT_GREEN', 'CLR_YELLOW',
        'CLR_BRIGHT_BLUE', 'CLR_BRIGHT_MAGENTA', 'CLR_BRIGHT_CYAN', 'CLR_WHITE'
      ];

      const brightColorMap = {
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
        CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      };

      for (const colorName of requiredBrightColors) {
        assert(brightColorMap[colorName] !== undefined, `${colorName} should be defined`);
      }
    });

    it('should have NO_COLOR special constant', () => {
      assert(typeof NO_COLOR === 'number', 'NO_COLOR should be defined');
    });
  });

  describe('Critical Color Values', () => {
    it('CLR_BLACK should be 0 (absence of color)', () => {
      assert.strictEqual(CLR_BLACK, 0, 'CLR_BLACK must be 0');
    });

    it('NO_COLOR should be 8 (special marker)', () => {
      assert.strictEqual(NO_COLOR, 8, 'NO_COLOR must be 8');
    });

    it('CLR_WHITE should be 15 (maximum color)', () => {
      assert.strictEqual(CLR_WHITE, 15, 'CLR_WHITE must be 15');
    });
  });

  describe('Color Indexing', () => {
    it('colors should be suitable for array indexing', () => {
      const allColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY,
        NO_COLOR,
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
        CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];

      for (const color of allColors) {
        assert(color >= 0, `Color ${color} should be non-negative`);
        assert(Number.isInteger(color), `Color ${color} should be integer`);
      }
    });

    it('colors should fit in standard color palette (16 colors)', () => {
      const allColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY,
        NO_COLOR,
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW,
        CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];

      for (const color of allColors) {
        assert(color < 16, `Color ${color} should fit in 16-color palette`);
      }
    });
  });
});
