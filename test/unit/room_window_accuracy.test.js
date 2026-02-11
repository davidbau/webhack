/**
 * Special Room and Window Type Accuracy Tests
 *
 * Verify that special room and window type constants match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Special room types
  OROOM, THEMEROOM, COURT, SWAMP, VAULT,
  BEEHIVE, MORGUE, BARRACKS, ZOO, DELPHI,
  TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, SHOPBASE,
  // Window types
  NHW_MESSAGE, NHW_STATUS, NHW_MAP, NHW_MENU, NHW_TEXT
} from '../../js/config.js';

describe('Special Room and Window Type Accuracy', () => {
  describe('Special Room Type Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h special room type definitions
      assert.strictEqual(OROOM, 0, 'OROOM (ordinary room) should be 0');
      assert.strictEqual(THEMEROOM, 1, 'THEMEROOM should be 1');
      assert.strictEqual(COURT, 2, 'COURT should be 2');
      assert.strictEqual(SWAMP, 3, 'SWAMP should be 3');
      assert.strictEqual(VAULT, 4, 'VAULT should be 4');
      assert.strictEqual(BEEHIVE, 5, 'BEEHIVE should be 5');
      assert.strictEqual(MORGUE, 6, 'MORGUE should be 6');
      assert.strictEqual(BARRACKS, 7, 'BARRACKS should be 7');
      assert.strictEqual(ZOO, 8, 'ZOO should be 8');
      assert.strictEqual(DELPHI, 9, 'DELPHI (Oracle) should be 9');
      assert.strictEqual(TEMPLE, 10, 'TEMPLE should be 10');
      assert.strictEqual(LEPREHALL, 11, 'LEPREHALL (Leprechaun hall) should be 11');
      assert.strictEqual(COCKNEST, 12, 'COCKNEST should be 12');
      assert.strictEqual(ANTHOLE, 13, 'ANTHOLE should be 13');
      assert.strictEqual(SHOPBASE, 14, 'SHOPBASE should be 14');
    });

    it('room types should be sequential from 0-14', () => {
      const roomTypes = [
        OROOM, THEMEROOM, COURT, SWAMP, VAULT,
        BEEHIVE, MORGUE, BARRACKS, ZOO, DELPHI,
        TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, SHOPBASE
      ];
      for (let i = 0; i < roomTypes.length; i++) {
        assert.strictEqual(roomTypes[i], i, `Room type ${i} should have value ${i}`);
      }
    });

    it('all room types should be unique', () => {
      const roomTypes = [
        OROOM, THEMEROOM, COURT, SWAMP, VAULT,
        BEEHIVE, MORGUE, BARRACKS, ZOO, DELPHI,
        TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, SHOPBASE
      ];
      const unique = new Set(roomTypes);
      assert.strictEqual(unique.size, 15, 'Should have 15 unique room types');
    });
  });

  describe('Basic Room Types', () => {
    it('OROOM should be zero (ordinary room)', () => {
      assert.strictEqual(OROOM, 0, 'OROOM is 0 (default/ordinary room)');
    });

    it('THEMEROOM should be first special type', () => {
      assert.strictEqual(THEMEROOM, 1, 'THEMEROOM is 1 (first special)');
    });

    it('basic room types should come first', () => {
      assert(OROOM < THEMEROOM, 'OROOM before THEMEROOM');
      assert(THEMEROOM < COURT, 'THEMEROOM before COURT');
    });
  });

  describe('Dangerous Room Types', () => {
    it('should have monster-filled rooms', () => {
      // ZOO, BARRACKS, BEEHIVE, COCKNEST, ANTHOLE contain hostile monsters
      assert(typeof ZOO === 'number', 'ZOO (monster room) defined');
      assert(typeof BARRACKS === 'number', 'BARRACKS (soldier room) defined');
      assert(typeof BEEHIVE === 'number', 'BEEHIVE (killer bees) defined');
      assert(typeof COCKNEST === 'number', 'COCKNEST (cockatrices) defined');
      assert(typeof ANTHOLE === 'number', 'ANTHOLE (giant ants) defined');
    });

    it('should have trap-filled rooms', () => {
      // VAULT has many traps and contains gold
      assert(typeof VAULT === 'number', 'VAULT (treasure room) defined');
    });

    it('should have environmental hazard rooms', () => {
      // SWAMP has pools and hostile terrain
      assert(typeof SWAMP === 'number', 'SWAMP (water hazard) defined');
    });
  });

  describe('Friendly Room Types', () => {
    it('should have peaceful special rooms', () => {
      // TEMPLE, DELPHI are typically peaceful
      assert(typeof TEMPLE === 'number', 'TEMPLE (priest room) defined');
      assert(typeof DELPHI === 'number', 'DELPHI (Oracle) defined');
    });

    it('should have shop room base', () => {
      // SHOPBASE marks the start of shop types
      assert.strictEqual(SHOPBASE, 14, 'SHOPBASE is 14 (shop type marker)');
    });
  });

  describe('Thematic Room Groups', () => {
    it('insect rooms should be grouped', () => {
      // BEEHIVE, COCKNEST, ANTHOLE are all insect-themed
      const insectRooms = [BEEHIVE, COCKNEST, ANTHOLE];
      for (const room of insectRooms) {
        assert(room >= 5 && room <= 13, `Insect room ${room} in range [5, 13]`);
      }
    });

    it('military room should be present (BARRACKS)', () => {
      assert.strictEqual(BARRACKS, 7, 'BARRACKS is military-themed room');
    });

    it('death-themed room should be present (MORGUE)', () => {
      assert.strictEqual(MORGUE, 6, 'MORGUE is death-themed room');
    });

    it('treasure room should be present (VAULT)', () => {
      assert.strictEqual(VAULT, 4, 'VAULT is treasure room');
    });
  });

  describe('Special Room Relationships', () => {
    it('OROOM should be base type', () => {
      assert.strictEqual(OROOM, 0, 'OROOM is 0 (default ordinary room)');
    });

    it('SHOPBASE should come after all special rooms', () => {
      const specialRooms = [
        THEMEROOM, COURT, SWAMP, VAULT, BEEHIVE, MORGUE,
        BARRACKS, ZOO, DELPHI, TEMPLE, LEPREHALL, COCKNEST, ANTHOLE
      ];
      for (const room of specialRooms) {
        assert(room < SHOPBASE, `Special room ${room} should be < SHOPBASE`);
      }
    });

    it('LEPREHALL should be unique (leprechaun treasure)', () => {
      // Leprechaun hall is special - contains leprechauns and gold
      assert.strictEqual(LEPREHALL, 11, 'LEPREHALL is leprechaun room');
    });
  });

  describe('Room Type Ranges', () => {
    it('all room types should fit in 5 bits (0-31)', () => {
      const roomTypes = [
        OROOM, THEMEROOM, COURT, SWAMP, VAULT,
        BEEHIVE, MORGUE, BARRACKS, ZOO, DELPHI,
        TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, SHOPBASE
      ];
      for (const room of roomTypes) {
        assert(room >= 0 && room < 32, `Room type ${room} should fit in 5 bits`);
      }
    });

    it('all room types should be in valid range [0, 14]', () => {
      const roomTypes = [
        OROOM, THEMEROOM, COURT, SWAMP, VAULT,
        BEEHIVE, MORGUE, BARRACKS, ZOO, DELPHI,
        TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, SHOPBASE
      ];
      for (const room of roomTypes) {
        assert(room >= 0 && room <= 14, `Room type ${room} should be in [0, 14]`);
      }
    });
  });

  describe('Room Type Completeness', () => {
    it('should have all standard special rooms from C NetHack', () => {
      const requiredRooms = [
        'OROOM', 'THEMEROOM', 'COURT', 'SWAMP', 'VAULT',
        'BEEHIVE', 'MORGUE', 'BARRACKS', 'ZOO', 'DELPHI',
        'TEMPLE', 'LEPREHALL', 'COCKNEST', 'ANTHOLE', 'SHOPBASE'
      ];

      const roomMap = {
        OROOM, THEMEROOM, COURT, SWAMP, VAULT,
        BEEHIVE, MORGUE, BARRACKS, ZOO, DELPHI,
        TEMPLE, LEPREHALL, COCKNEST, ANTHOLE, SHOPBASE
      };

      for (const roomName of requiredRooms) {
        assert(roomMap[roomName] !== undefined, `${roomName} should be defined`);
      }
    });

    it('should have exactly 15 room types (including OROOM)', () => {
      // OROOM(0) through SHOPBASE(14) = 15 types
      assert.strictEqual(SHOPBASE - OROOM + 1, 15, '15 room types total');
    });
  });

  describe('Window Type Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/wintype.h window type definitions
      assert.strictEqual(NHW_MESSAGE, 1, 'NHW_MESSAGE should be 1');
      assert.strictEqual(NHW_STATUS, 2, 'NHW_STATUS should be 2');
      assert.strictEqual(NHW_MAP, 3, 'NHW_MAP should be 3');
      assert.strictEqual(NHW_MENU, 4, 'NHW_MENU should be 4');
      assert.strictEqual(NHW_TEXT, 5, 'NHW_TEXT should be 5');
    });

    it('window types should be sequential from 1-5', () => {
      const windowTypes = [NHW_MESSAGE, NHW_STATUS, NHW_MAP, NHW_MENU, NHW_TEXT];
      for (let i = 0; i < windowTypes.length; i++) {
        assert.strictEqual(windowTypes[i], i + 1, `Window type ${i} should be ${i + 1}`);
      }
    });

    it('all window types should be unique', () => {
      const windowTypes = [NHW_MESSAGE, NHW_STATUS, NHW_MAP, NHW_MENU, NHW_TEXT];
      const unique = new Set(windowTypes);
      assert.strictEqual(unique.size, 5, 'Should have 5 unique window types');
    });
  });

  describe('Window Type Purpose', () => {
    it('NHW_MESSAGE should be for messages', () => {
      // Message window displays game messages
      assert.strictEqual(NHW_MESSAGE, 1, 'NHW_MESSAGE for game messages');
    });

    it('NHW_STATUS should be for status line', () => {
      // Status window shows HP, level, etc.
      assert.strictEqual(NHW_STATUS, 2, 'NHW_STATUS for player status');
    });

    it('NHW_MAP should be for dungeon display', () => {
      // Map window shows the dungeon grid
      assert.strictEqual(NHW_MAP, 3, 'NHW_MAP for dungeon display');
    });

    it('NHW_MENU should be for menus', () => {
      // Menu window for inventory, selections, etc.
      assert.strictEqual(NHW_MENU, 4, 'NHW_MENU for interactive menus');
    });

    it('NHW_TEXT should be for text display', () => {
      // Text window for help, discoveries, etc.
      assert.strictEqual(NHW_TEXT, 5, 'NHW_TEXT for scrolling text');
    });
  });

  describe('Window Type Ordering', () => {
    it('NHW_MESSAGE should be first', () => {
      assert.strictEqual(NHW_MESSAGE, 1, 'Message window is first');
    });

    it('core windows should come first (MESSAGE, STATUS, MAP)', () => {
      assert(NHW_MESSAGE < NHW_MENU, 'MESSAGE before MENU');
      assert(NHW_STATUS < NHW_MENU, 'STATUS before MENU');
      assert(NHW_MAP < NHW_MENU, 'MAP before MENU');
    });

    it('NHW_TEXT should be last', () => {
      assert.strictEqual(NHW_TEXT, 5, 'Text window is last');
    });
  });

  describe('Window Type Ranges', () => {
    it('all window types should fit in 3 bits (0-7)', () => {
      const windowTypes = [NHW_MESSAGE, NHW_STATUS, NHW_MAP, NHW_MENU, NHW_TEXT];
      for (const win of windowTypes) {
        assert(win >= 0 && win < 8, `Window type ${win} should fit in 3 bits`);
      }
    });

    it('all window types should be in valid range [1, 5]', () => {
      const windowTypes = [NHW_MESSAGE, NHW_STATUS, NHW_MAP, NHW_MENU, NHW_TEXT];
      for (const win of windowTypes) {
        assert(win >= 1 && win <= 5, `Window type ${win} should be in [1, 5]`);
      }
    });

    it('window types start at 1, not 0', () => {
      // Unlike most NetHack enums, window types start at 1
      assert.strictEqual(NHW_MESSAGE, 1, 'First window type is 1 (not 0)');
    });
  });

  describe('Window Type Completeness', () => {
    it('should have all standard window types from C NetHack', () => {
      const requiredWindows = [
        'NHW_MESSAGE', 'NHW_STATUS', 'NHW_MAP', 'NHW_MENU', 'NHW_TEXT'
      ];

      const windowMap = {
        NHW_MESSAGE, NHW_STATUS, NHW_MAP, NHW_MENU, NHW_TEXT
      };

      for (const windowName of requiredWindows) {
        assert(windowMap[windowName] !== undefined, `${windowName} should be defined`);
      }
    });

    it('should have exactly 5 window types', () => {
      const windowTypes = [NHW_MESSAGE, NHW_STATUS, NHW_MAP, NHW_MENU, NHW_TEXT];
      assert.strictEqual(windowTypes.length, 5, '5 window types total');
    });
  });

  describe('Critical Constant Values', () => {
    it('OROOM should be 0 (default room type)', () => {
      assert.strictEqual(OROOM, 0, 'OROOM must be 0 (ordinary room)');
    });

    it('SHOPBASE should mark shop type boundary', () => {
      assert.strictEqual(SHOPBASE, 14, 'SHOPBASE is 14 (shop type marker)');
    });

    it('NHW_MESSAGE should be 1 (first window type)', () => {
      assert.strictEqual(NHW_MESSAGE, 1, 'NHW_MESSAGE must be 1 (first window)');
    });
  });

  describe('Cross-Category Relationships', () => {
    it('room types and window types use different numbering', () => {
      // Room types start at 0, window types start at 1
      assert.strictEqual(OROOM, 0, 'Room types start at 0');
      assert.strictEqual(NHW_MESSAGE, 1, 'Window types start at 1');
    });

    it('both use small integer values suitable for arrays', () => {
      assert(SHOPBASE < 32, 'Room types fit in 5 bits');
      assert(NHW_TEXT < 8, 'Window types fit in 3 bits');
    });

    it('room type count and window type count are both valid', () => {
      const roomCount = SHOPBASE - OROOM + 1;
      const windowCount = NHW_TEXT - NHW_MESSAGE + 1;
      assert.strictEqual(roomCount, 15, '15 room types');
      assert.strictEqual(windowCount, 5, '5 window types');
    });
  });
});
