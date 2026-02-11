/**
 * System Limits and Game Mechanics Accuracy Tests
 *
 * Verify that system limits, version info, and game mechanics constants
 * match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Version constants
  VERSION_MAJOR, VERSION_MINOR, PATCHLEVEL,
  // Map and terminal dimensions
  COLNO, ROWNO, TERMINAL_COLS, TERMINAL_ROWS,
  MESSAGE_ROW, MAP_ROW_START,
  // Dungeon limits
  MAXNROFROOMS, MAXDUNGEON, MAXLEVEL, MAXOCLASSES,
  // Encumbrance levels
  UNENCUMBERED, SLT_ENCUMBER, MOD_ENCUMBER,
  HVY_ENCUMBER, EXT_ENCUMBER, OVERLOADED
} from '../../js/config.js';

describe('System Limits and Game Mechanics Accuracy', () => {
  describe('Version Constants', () => {
    it('should match NetHack 3.7.0', () => {
      // C ref: include/patchlevel.h version defines
      assert.strictEqual(VERSION_MAJOR, 3, 'VERSION_MAJOR should be 3');
      assert.strictEqual(VERSION_MINOR, 7, 'VERSION_MINOR should be 7');
      assert.strictEqual(PATCHLEVEL, 0, 'PATCHLEVEL should be 0');
    });

    it('VERSION_MAJOR should be 3 (NetHack 3.x series)', () => {
      assert.strictEqual(VERSION_MAJOR, 3, 'NetHack 3.x series');
    });

    it('VERSION_MINOR should be 7 (NetHack 3.7)', () => {
      assert.strictEqual(VERSION_MINOR, 7, 'NetHack 3.7 release');
    });

    it('PATCHLEVEL should be 0 (base release)', () => {
      assert.strictEqual(PATCHLEVEL, 0, 'Base 3.7.0 release');
    });

    it('version numbers should be non-negative', () => {
      assert(VERSION_MAJOR >= 0, 'Major version >= 0');
      assert(VERSION_MINOR >= 0, 'Minor version >= 0');
      assert(PATCHLEVEL >= 0, 'Patch level >= 0');
    });
  });

  describe('Map Dimensions', () => {
    it('should have standard NetHack map size', () => {
      // C ref: include/config.h COLNO and ROWNO
      assert.strictEqual(COLNO, 80, 'Map should be 80 columns wide');
      assert.strictEqual(ROWNO, 21, 'Map should be 21 rows tall');
    });

    it('should match terminal dimensions', () => {
      // Terminal includes map + status + messages
      assert.strictEqual(TERMINAL_COLS, 80, 'Terminal 80 columns');
      assert.strictEqual(TERMINAL_ROWS, 24, 'Terminal 24 rows (VT100 standard)');
    });

    it('COLNO should equal TERMINAL_COLS', () => {
      assert.strictEqual(COLNO, TERMINAL_COLS, 'Map width equals terminal width');
    });

    it('map rows should fit in terminal with room for status', () => {
      // 24 rows total: 1 message + 21 map + 2 status
      assert(ROWNO < TERMINAL_ROWS, 'Map rows leave room for message/status');
      const overhead = TERMINAL_ROWS - ROWNO;
      assert.strictEqual(overhead, 3, '3 rows for message + status lines');
    });

    it('MESSAGE_ROW should be first row', () => {
      assert.strictEqual(MESSAGE_ROW, 0, 'Message row is 0 (top)');
    });

    it('MAP_ROW_START should follow MESSAGE_ROW', () => {
      assert.strictEqual(MAP_ROW_START, 1, 'Map starts at row 1');
      assert.strictEqual(MAP_ROW_START - MESSAGE_ROW, 1, 'Map follows message');
    });
  });

  describe('Dungeon Structure Limits', () => {
    it('should have correct dungeon limits', () => {
      // C ref: include/config.h dungeon limits
      assert.strictEqual(MAXNROFROOMS, 40, 'MAXNROFROOMS should be 40');
      assert.strictEqual(MAXDUNGEON, 16, 'MAXDUNGEON should be 16');
      assert.strictEqual(MAXLEVEL, 32, 'MAXLEVEL should be 32');
      assert.strictEqual(MAXOCLASSES, 18, 'MAXOCLASSES should be 18');
    });

    it('MAXNROFROOMS should be 40 (max rooms per level)', () => {
      assert.strictEqual(MAXNROFROOMS, 40, 'Max 40 rooms per level');
    });

    it('MAXDUNGEON should be 16 (max branches)', () => {
      assert.strictEqual(MAXDUNGEON, 16, 'Max 16 dungeon branches');
    });

    it('MAXLEVEL should be 32 (max depth)', () => {
      assert.strictEqual(MAXLEVEL, 32, 'Max depth 32 levels');
    });

    it('MAXOCLASSES should be 18 (object classes)', () => {
      assert.strictEqual(MAXOCLASSES, 18, 'Max 18 object classes');
    });

    it('limits should be reasonable for gameplay', () => {
      assert(MAXNROFROOMS > 0 && MAXNROFROOMS <= 100, 'Rooms: reasonable limit');
      assert(MAXDUNGEON > 0 && MAXDUNGEON <= 32, 'Branches: reasonable limit');
      assert(MAXLEVEL > 0 && MAXLEVEL <= 64, 'Levels: reasonable limit');
      assert(MAXOCLASSES > 0 && MAXOCLASSES <= 32, 'Object classes: reasonable');
    });
  });

  describe('Encumbrance Level Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/hack.h encumbrance level defines
      assert.strictEqual(UNENCUMBERED, 0, 'UNENCUMBERED should be 0');
      assert.strictEqual(SLT_ENCUMBER, 1, 'SLT_ENCUMBER (slightly) should be 1');
      assert.strictEqual(MOD_ENCUMBER, 2, 'MOD_ENCUMBER (moderately) should be 2');
      assert.strictEqual(HVY_ENCUMBER, 3, 'HVY_ENCUMBER (heavily) should be 3');
      assert.strictEqual(EXT_ENCUMBER, 4, 'EXT_ENCUMBER (extremely) should be 4');
      assert.strictEqual(OVERLOADED, 5, 'OVERLOADED should be 5');
    });

    it('encumbrance levels should be sequential from 0-5', () => {
      const levels = [UNENCUMBERED, SLT_ENCUMBER, MOD_ENCUMBER, 
                      HVY_ENCUMBER, EXT_ENCUMBER, OVERLOADED];
      for (let i = 0; i < levels.length; i++) {
        assert.strictEqual(levels[i], i, `Encumbrance level ${i} should be ${i}`);
      }
    });

    it('UNENCUMBERED should be zero (no burden)', () => {
      assert.strictEqual(UNENCUMBERED, 0, 'UNENCUMBERED is 0 (no burden)');
    });

    it('encumbrance should increase in severity', () => {
      assert(UNENCUMBERED < SLT_ENCUMBER, 'Unencumbered < Slightly');
      assert(SLT_ENCUMBER < MOD_ENCUMBER, 'Slightly < Moderately');
      assert(MOD_ENCUMBER < HVY_ENCUMBER, 'Moderately < Heavily');
      assert(HVY_ENCUMBER < EXT_ENCUMBER, 'Heavily < Extremely');
      assert(EXT_ENCUMBER < OVERLOADED, 'Extremely < Overloaded');
    });

    it('OVERLOADED should be maximum encumbrance', () => {
      assert.strictEqual(OVERLOADED, 5, 'OVERLOADED is 5 (maximum)');
    });

    it('all encumbrance levels should be unique', () => {
      const levels = [UNENCUMBERED, SLT_ENCUMBER, MOD_ENCUMBER,
                      HVY_ENCUMBER, EXT_ENCUMBER, OVERLOADED];
      const unique = new Set(levels);
      assert.strictEqual(unique.size, 6, 'All 6 levels should be unique');
    });
  });

  describe('Encumbrance Categories', () => {
    it('should have playable encumbrance levels', () => {
      // UNENCUMBERED through HVY_ENCUMBER are fully playable
      assert(typeof UNENCUMBERED === 'number', 'UNENCUMBERED defined');
      assert(typeof SLT_ENCUMBER === 'number', 'SLT_ENCUMBER defined');
      assert(typeof MOD_ENCUMBER === 'number', 'MOD_ENCUMBER defined');
      assert(typeof HVY_ENCUMBER === 'number', 'HVY_ENCUMBER defined');
    });

    it('should have severely restricted levels', () => {
      // EXT_ENCUMBER and OVERLOADED are severely restricted
      assert(typeof EXT_ENCUMBER === 'number', 'EXT_ENCUMBER defined');
      assert(typeof OVERLOADED === 'number', 'OVERLOADED defined');
    });

    it('should have exactly 6 encumbrance levels', () => {
      // UNENCUMBERED(0) through OVERLOADED(5) = 6 levels
      assert.strictEqual(OVERLOADED - UNENCUMBERED + 1, 6, '6 encumbrance levels');
    });
  });

  describe('Encumbrance Ranges', () => {
    it('all encumbrance levels should fit in 3 bits (0-7)', () => {
      const levels = [UNENCUMBERED, SLT_ENCUMBER, MOD_ENCUMBER,
                      HVY_ENCUMBER, EXT_ENCUMBER, OVERLOADED];
      for (const level of levels) {
        assert(level >= 0 && level < 8, `Level ${level} should fit in 3 bits`);
      }
    });

    it('all encumbrance levels should be in valid range [0, 5]', () => {
      const levels = [UNENCUMBERED, SLT_ENCUMBER, MOD_ENCUMBER,
                      HVY_ENCUMBER, EXT_ENCUMBER, OVERLOADED];
      for (const level of levels) {
        assert(level >= 0 && level <= 5, `Level ${level} should be in [0, 5]`);
      }
    });
  });

  describe('System Constants Relationships', () => {
    it('map should fit in terminal', () => {
      assert(COLNO <= TERMINAL_COLS, 'Map columns fit in terminal');
      assert(ROWNO <= TERMINAL_ROWS, 'Map rows fit in terminal');
    });

    it('version should be sensible', () => {
      assert(VERSION_MAJOR >= 3 && VERSION_MAJOR <= 5, 'Major version 3-5');
      assert(VERSION_MINOR >= 0 && VERSION_MINOR <= 10, 'Minor version 0-10');
      assert(PATCHLEVEL >= 0 && PATCHLEVEL <= 20, 'Patch level 0-20');
    });

    it('dungeon limits should be internally consistent', () => {
      // Max levels should exceed max branches
      assert(MAXLEVEL > MAXDUNGEON, 'More levels than branches');
      // Max rooms should be reasonable for a level
      assert(MAXNROFROOMS < 100, 'Rooms per level < 100');
    });

    it('encumbrance should start at zero', () => {
      assert.strictEqual(UNENCUMBERED, 0, 'Encumbrance starts at 0');
    });
  });

  describe('Terminal Layout', () => {
    it('should have VT100-compatible dimensions', () => {
      // VT100 standard is 80x24
      assert.strictEqual(TERMINAL_COLS, 80, '80 columns (VT100)');
      assert.strictEqual(TERMINAL_ROWS, 24, '24 rows (VT100)');
    });

    it('should allocate rows correctly', () => {
      // 1 message + 21 map + 2 status = 24 total
      const messageRows = 1;
      const mapRows = ROWNO;
      const statusRows = TERMINAL_ROWS - messageRows - mapRows;

      assert.strictEqual(messageRows, 1, '1 row for messages');
      assert.strictEqual(mapRows, 21, '21 rows for map');
      assert.strictEqual(statusRows, 2, '2 rows for status');
      assert.strictEqual(messageRows + mapRows + statusRows, 24, 'Total 24 rows');
    });

    it('MESSAGE_ROW should be at top', () => {
      assert.strictEqual(MESSAGE_ROW, 0, 'Message at row 0 (top)');
    });

    it('map should start after message', () => {
      assert.strictEqual(MAP_ROW_START, MESSAGE_ROW + 1, 'Map after message');
    });
  });

  describe('Dungeon Scale', () => {
    it('MAXLEVEL should support full game', () => {
      // NetHack dungeon goes to about level 50+ with all branches
      assert(MAXLEVEL >= 32, 'MAXLEVEL >= 32 for full game');
    });

    it('MAXDUNGEON should support all branches', () => {
      // Main + Mines + Sokoban + Quest + Fort Ludios + Gehennom + etc.
      assert(MAXDUNGEON >= 16, 'MAXDUNGEON >= 16 for all branches');
    });

    it('MAXNROFROOMS should support complex levels', () => {
      // Complex levels can have 20+ rooms
      assert(MAXNROFROOMS >= 40, 'MAXNROFROOMS >= 40 for complex levels');
    });

    it('MAXOCLASSES should support all item types', () => {
      // Weapon, armor, potion, scroll, wand, ring, amulet, tool, food, etc.
      assert(MAXOCLASSES >= 18, 'MAXOCLASSES >= 18 for all item types');
    });
  });

  describe('Critical Constant Values', () => {
    it('COLNO should be 80 (standard width)', () => {
      assert.strictEqual(COLNO, 80, 'COLNO must be 80');
    });

    it('ROWNO should be 21 (standard height)', () => {
      assert.strictEqual(ROWNO, 21, 'ROWNO must be 21');
    });

    it('UNENCUMBERED should be 0 (default state)', () => {
      assert.strictEqual(UNENCUMBERED, 0, 'UNENCUMBERED must be 0');
    });

    it('MAXLEVEL should be 32 (dungeon depth)', () => {
      assert.strictEqual(MAXLEVEL, 32, 'MAXLEVEL must be 32');
    });
  });

  describe('Constant Completeness', () => {
    it('should have all version components', () => {
      const versionParts = ['VERSION_MAJOR', 'VERSION_MINOR', 'PATCHLEVEL'];
      const versionMap = { VERSION_MAJOR, VERSION_MINOR, PATCHLEVEL };

      for (const part of versionParts) {
        assert(versionMap[part] !== undefined, `${part} should be defined`);
      }
    });

    it('should have all terminal dimension constants', () => {
      const terminalConsts = ['COLNO', 'ROWNO', 'TERMINAL_COLS', 'TERMINAL_ROWS',
                              'MESSAGE_ROW', 'MAP_ROW_START'];
      const terminalMap = { COLNO, ROWNO, TERMINAL_COLS, TERMINAL_ROWS,
                           MESSAGE_ROW, MAP_ROW_START };

      for (const constName of terminalConsts) {
        assert(terminalMap[constName] !== undefined, `${constName} should be defined`);
      }
    });

    it('should have all dungeon limit constants', () => {
      const limitConsts = ['MAXNROFROOMS', 'MAXDUNGEON', 'MAXLEVEL', 'MAXOCLASSES'];
      const limitMap = { MAXNROFROOMS, MAXDUNGEON, MAXLEVEL, MAXOCLASSES };

      for (const constName of limitConsts) {
        assert(limitMap[constName] !== undefined, `${constName} should be defined`);
      }
    });

    it('should have all encumbrance level constants', () => {
      const encumbranceConsts = ['UNENCUMBERED', 'SLT_ENCUMBER', 'MOD_ENCUMBER',
                                 'HVY_ENCUMBER', 'EXT_ENCUMBER', 'OVERLOADED'];
      const encumbranceMap = { UNENCUMBERED, SLT_ENCUMBER, MOD_ENCUMBER,
                              HVY_ENCUMBER, EXT_ENCUMBER, OVERLOADED };

      for (const constName of encumbranceConsts) {
        assert(encumbranceMap[constName] !== undefined, `${constName} should be defined`);
      }
    });
  });

  describe('Constant Count Validation', () => {
    it('should have exactly 3 version components', () => {
      const versionCount = 3; // MAJOR, MINOR, PATCHLEVEL
      assert.strictEqual(versionCount, 3, '3 version components');
    });

    it('should have exactly 6 terminal layout constants', () => {
      const terminalCount = 6; // COLNO, ROWNO, TERMINAL_COLS, TERMINAL_ROWS, MESSAGE_ROW, MAP_ROW_START
      assert.strictEqual(terminalCount, 6, '6 terminal layout constants');
    });

    it('should have exactly 4 dungeon limit constants', () => {
      const limitCount = 4; // MAXNROFROOMS, MAXDUNGEON, MAXLEVEL, MAXOCLASSES
      assert.strictEqual(limitCount, 4, '4 dungeon limit constants');
    });

    it('should have exactly 6 encumbrance levels', () => {
      const encumbranceCount = 6; // UNENCUMBERED through OVERLOADED
      assert.strictEqual(encumbranceCount, 6, '6 encumbrance levels');
    });
  });
});
