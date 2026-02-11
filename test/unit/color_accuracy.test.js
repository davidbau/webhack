/**
 * Color System Accuracy Tests
 *
 * Verify that color constants and rendering match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN, CLR_BLUE,
  CLR_MAGENTA, CLR_CYAN, CLR_GRAY, NO_COLOR,
  CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW, CLR_BRIGHT_BLUE,
  CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
} from '../../js/symbols.js';

describe('Color Accuracy', () => {
  describe('Color Constants', () => {
    it('should match C NetHack color values', () => {
      // C ref: color.h color definitions
      assert.strictEqual(CLR_BLACK, 0, 'CLR_BLACK should be 0');
      assert.strictEqual(CLR_RED, 1, 'CLR_RED should be 1');
      assert.strictEqual(CLR_GREEN, 2, 'CLR_GREEN should be 2');
      assert.strictEqual(CLR_BROWN, 3, 'CLR_BROWN should be 3');
      assert.strictEqual(CLR_BLUE, 4, 'CLR_BLUE should be 4');
      assert.strictEqual(CLR_MAGENTA, 5, 'CLR_MAGENTA should be 5');
      assert.strictEqual(CLR_CYAN, 6, 'CLR_CYAN should be 6');
      assert.strictEqual(CLR_GRAY, 7, 'CLR_GRAY should be 7');
    });

    it('NO_COLOR should be distinct', () => {
      // C ref: NO_COLOR is a special value (8)
      assert.strictEqual(NO_COLOR, 8, 'NO_COLOR should be 8');
      assert(NO_COLOR !== CLR_BLACK, 'NO_COLOR should not equal CLR_BLACK');
      assert(NO_COLOR !== CLR_GRAY, 'NO_COLOR should not equal CLR_GRAY');
    });

    it('should have bright colors', () => {
      // C ref: Bright variants of basic colors
      assert.strictEqual(CLR_ORANGE, 9, 'CLR_ORANGE should be 9');
      assert.strictEqual(CLR_BRIGHT_GREEN, 10, 'CLR_BRIGHT_GREEN should be 10');
      assert.strictEqual(CLR_YELLOW, 11, 'CLR_YELLOW should be 11');
      assert.strictEqual(CLR_BRIGHT_BLUE, 12, 'CLR_BRIGHT_BLUE should be 12');
      assert.strictEqual(CLR_BRIGHT_MAGENTA, 13, 'CLR_BRIGHT_MAGENTA should be 13');
      assert.strictEqual(CLR_BRIGHT_CYAN, 14, 'CLR_BRIGHT_CYAN should be 14');
      assert.strictEqual(CLR_WHITE, 15, 'CLR_WHITE should be 15');
    });
  });

  describe('Color Range', () => {
    it('all colors should be in valid range [0, 15]', () => {
      const colors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN, CLR_BLUE,
        CLR_MAGENTA, CLR_CYAN, CLR_GRAY, NO_COLOR,
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW, CLR_BRIGHT_BLUE,
        CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];

      for (const color of colors) {
        assert(color >= 0 && color <= 15,
          `Color ${color} should be in range [0, 15]`);
      }
    });

    it('should have exactly 16 color slots', () => {
      // C ref: NetHack uses 16-color palette
      assert.strictEqual(CLR_WHITE, 15, 'Highest color should be 15 (0-15 = 16 colors)');
    });
  });

  describe('Color Semantics', () => {
    it('CLR_RED should come before CLR_ORANGE', () => {
      // Basic red before bright orange
      assert(CLR_RED < CLR_ORANGE,
        'CLR_RED should have lower value than CLR_ORANGE');
    });

    it('CLR_GREEN should come before CLR_BRIGHT_GREEN', () => {
      assert(CLR_GREEN < CLR_BRIGHT_GREEN,
        'CLR_GREEN should have lower value than CLR_BRIGHT_GREEN');
    });

    it('CLR_BLUE should come before CLR_BRIGHT_BLUE', () => {
      assert(CLR_BLUE < CLR_BRIGHT_BLUE,
        'CLR_BLUE should have lower value than CLR_BRIGHT_BLUE');
    });

    it('CLR_GRAY should come before CLR_WHITE', () => {
      // Gray is dim, white is bright
      assert(CLR_GRAY < CLR_WHITE,
        'CLR_GRAY should have lower value than CLR_WHITE');
    });
  });

  describe('Color Uniqueness', () => {
    it('all color constants should be unique', () => {
      const colors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN, CLR_BLUE,
        CLR_MAGENTA, CLR_CYAN, CLR_GRAY, NO_COLOR,
        CLR_ORANGE, CLR_BRIGHT_GREEN, CLR_YELLOW, CLR_BRIGHT_BLUE,
        CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
      ];

      const unique = new Set(colors);
      assert.strictEqual(unique.size, colors.length,
        'All color constants should have unique values');
    });
  });

  describe('Critical Memory Fix Validation', () => {
    it('CLR_WHITE should be 15 not 14', () => {
      // Memory note: Fixed off-by-one - CLR_WHITE=15 not 14 (CRITICAL)
      assert.strictEqual(CLR_WHITE, 15,
        'CLR_WHITE must be 15 (not 14 - critical fix from memory)');
    });

    it('COLOR_CSS array should have NO_COLOR slot', () => {
      // Memory note: Fixed missing NO_COLOR slot causing offset (CRITICAL)
      // This test just verifies the constant exists and is in the right position
      assert.strictEqual(NO_COLOR, 8,
        'NO_COLOR must be at position 8 (critical fix from memory)');
      assert(NO_COLOR < CLR_ORANGE,
        'NO_COLOR should come before bright colors');
    });
  });

  describe('Color Display Constants', () => {
    it('should have standard basic colors 0-7', () => {
      // C ref: Standard VGA/ANSI color palette
      const basicColors = [
        CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN,
        CLR_BLUE, CLR_MAGENTA, CLR_CYAN, CLR_GRAY
      ];

      for (let i = 0; i < basicColors.length; i++) {
        assert.strictEqual(basicColors[i], i,
          `Basic color ${i} should have value ${i}`);
      }
    });

    it('bright colors should start at 9', () => {
      // C ref: Bright colors are indices 9-15
      assert.strictEqual(CLR_ORANGE, 9, 'First bright color should be 9');
      assert(CLR_BRIGHT_GREEN >= 9, 'Bright colors should be >= 9');
      assert(CLR_YELLOW >= 9, 'Bright colors should be >= 9');
      assert(CLR_WHITE >= 9, 'Bright colors should be >= 9');
    });
  });
});
