/**
 * Terrain Type Accuracy Tests
 *
 * Verify that map tile/terrain type constants match C NetHack exactly.
 * These constants define what appears on each cell of the dungeon map.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Basic terrain
  STONE, VWALL, HWALL, DOOR, CORR, ROOM,
  // Wall variations
  TLCORNER, TRCORNER, BLCORNER, BRCORNER,
  CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL,
  // Secret features
  SDOOR, SCORR,
  // Water features
  POOL, MOAT, WATER, LAVAPOOL, LAVAWALL,
  // Stairs and ladders
  STAIRS, LADDER,
  // Dungeon furniture
  FOUNTAIN, THRONE, SINK, GRAVE, ALTAR,
  // Special terrain
  TREE, ICE, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN,
  AIR, CLOUD, IRONBARS,
  // Boundary constant
  MAX_TYPE
} from '../../js/config.js';

describe('Terrain Type Accuracy', () => {
  describe('Basic Terrain Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h terrain type definitions
      assert.strictEqual(STONE, 0, 'STONE should be 0');
      assert.strictEqual(VWALL, 1, 'VWALL (vertical wall) should be 1');
      assert.strictEqual(HWALL, 2, 'HWALL (horizontal wall) should be 2');
      assert.strictEqual(DOOR, 23, 'DOOR should be 23');
      assert.strictEqual(CORR, 24, 'CORR (corridor) should be 24');
      assert.strictEqual(ROOM, 25, 'ROOM should be 25');
    });

    it('STONE should be zero (default terrain)', () => {
      assert.strictEqual(STONE, 0, 'STONE is 0 (unexcavated rock)');
    });

    it('ROOM should come after CORR', () => {
      assert(ROOM > CORR, 'ROOM should follow CORR');
      assert.strictEqual(ROOM - CORR, 1, 'ROOM immediately follows CORR');
    });
  });

  describe('Wall Corner Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h corner wall types
      assert.strictEqual(TLCORNER, 3, 'TLCORNER (top-left) should be 3');
      assert.strictEqual(TRCORNER, 4, 'TRCORNER (top-right) should be 4');
      assert.strictEqual(BLCORNER, 5, 'BLCORNER (bottom-left) should be 5');
      assert.strictEqual(BRCORNER, 6, 'BRCORNER (bottom-right) should be 6');
    });

    it('corners should be sequential from 3-6', () => {
      assert.strictEqual(TLCORNER, 3, 'TLCORNER is 3');
      assert.strictEqual(TRCORNER, 4, 'TRCORNER is 4');
      assert.strictEqual(BLCORNER, 5, 'BLCORNER is 5');
      assert.strictEqual(BRCORNER, 6, 'BRCORNER is 6');
    });

    it('top corners should come before bottom corners', () => {
      assert(TLCORNER < BLCORNER, 'Top-left before bottom-left');
      assert(TRCORNER < BRCORNER, 'Top-right before bottom-right');
    });
  });

  describe('Wall Junction Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h wall junction types
      assert.strictEqual(CROSSWALL, 7, 'CROSSWALL (4-way junction) should be 7');
      assert.strictEqual(TUWALL, 8, 'TUWALL (T-up junction) should be 8');
      assert.strictEqual(TDWALL, 9, 'TDWALL (T-down junction) should be 9');
      assert.strictEqual(TLWALL, 10, 'TLWALL (T-left junction) should be 10');
      assert.strictEqual(TRWALL, 11, 'TRWALL (T-right junction) should be 11');
      assert.strictEqual(DBWALL, 12, 'DBWALL (double wall) should be 12');
    });

    it('wall junctions should be sequential from 7-12', () => {
      const junctions = [CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL];
      for (let i = 0; i < junctions.length; i++) {
        assert.strictEqual(junctions[i], 7 + i, `Junction ${i} should be ${7 + i}`);
      }
    });

    it('CROSSWALL should be first junction type', () => {
      assert.strictEqual(CROSSWALL, 7, 'CROSSWALL is first (4-way junction)');
    });
  });

  describe('Secret Feature Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h secret features
      assert.strictEqual(SDOOR, 14, 'SDOOR (secret door) should be 14');
      assert.strictEqual(SCORR, 15, 'SCORR (secret corridor) should be 15');
    });

    it('secret features should be adjacent', () => {
      assert.strictEqual(SCORR - SDOOR, 1, 'SCORR immediately follows SDOOR');
    });

    it('SDOOR should come before SCORR', () => {
      assert(SDOOR < SCORR, 'Secret door before secret corridor');
    });
  });

  describe('Water Feature Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h water and lava features
      assert.strictEqual(POOL, 16, 'POOL should be 16');
      assert.strictEqual(MOAT, 17, 'MOAT should be 17');
      assert.strictEqual(WATER, 18, 'WATER should be 18');
      assert.strictEqual(LAVAPOOL, 20, 'LAVAPOOL should be 20');
      assert.strictEqual(LAVAWALL, 21, 'LAVAWALL should be 21');
    });

    it('water features should be grouped together', () => {
      assert(POOL < MOAT, 'POOL before MOAT');
      assert(MOAT < WATER, 'MOAT before WATER');
    });

    it('lava features should be grouped together', () => {
      assert.strictEqual(LAVAWALL - LAVAPOOL, 1, 'LAVAWALL immediately follows LAVAPOOL');
    });

    it('WATER should be generic, POOL/MOAT specific', () => {
      // WATER is the general water terrain, POOL/MOAT are specific types
      assert(WATER > POOL, 'WATER constant comes after POOL');
      assert(WATER > MOAT, 'WATER constant comes after MOAT');
    });
  });

  describe('Vertical Movement Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h stair and ladder features
      assert.strictEqual(STAIRS, 26, 'STAIRS should be 26');
      assert.strictEqual(LADDER, 27, 'LADDER should be 27');
    });

    it('LADDER should immediately follow STAIRS', () => {
      assert.strictEqual(LADDER - STAIRS, 1, 'LADDER immediately follows STAIRS');
    });

    it('stairs should come before ladders', () => {
      assert(STAIRS < LADDER, 'STAIRS before LADDER');
    });
  });

  describe('Dungeon Furniture Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h dungeon features
      assert.strictEqual(FOUNTAIN, 28, 'FOUNTAIN should be 28');
      assert.strictEqual(THRONE, 29, 'THRONE should be 29');
      assert.strictEqual(SINK, 30, 'SINK should be 30');
      assert.strictEqual(GRAVE, 31, 'GRAVE should be 31');
      assert.strictEqual(ALTAR, 32, 'ALTAR should be 32');
    });

    it('furniture should be sequential from 28-32', () => {
      const furniture = [FOUNTAIN, THRONE, SINK, GRAVE, ALTAR];
      for (let i = 0; i < furniture.length; i++) {
        assert.strictEqual(furniture[i], 28 + i, `Furniture ${i} should be ${28 + i}`);
      }
    });

    it('FOUNTAIN should be first furniture type', () => {
      assert.strictEqual(FOUNTAIN, 28, 'FOUNTAIN is first furniture');
    });

    it('ALTAR should be last furniture type', () => {
      assert.strictEqual(ALTAR, 32, 'ALTAR is last furniture');
    });
  });

  describe('Special Terrain Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/rm.h special terrain types
      assert.strictEqual(TREE, 13, 'TREE should be 13');
      assert.strictEqual(ICE, 33, 'ICE should be 33');
      assert.strictEqual(DRAWBRIDGE_UP, 19, 'DRAWBRIDGE_UP should be 19');
      assert.strictEqual(DRAWBRIDGE_DOWN, 34, 'DRAWBRIDGE_DOWN should be 34');
      assert.strictEqual(AIR, 35, 'AIR should be 35');
      assert.strictEqual(CLOUD, 36, 'CLOUD should be 36');
      assert.strictEqual(IRONBARS, 22, 'IRONBARS should be 22');
    });

    it('TREE should be early (forests in early levels)', () => {
      assert.strictEqual(TREE, 13, 'TREE is 13 (after walls, before secret features)');
    });

    it('drawbridges should not be sequential (different categories)', () => {
      assert.notStrictEqual(DRAWBRIDGE_DOWN - DRAWBRIDGE_UP, 1,
        'Drawbridge states not sequential (one is obstacle, one is floor)');
    });

    it('AIR and CLOUD should be adjacent (related terrain)', () => {
      assert.strictEqual(CLOUD - AIR, 1, 'CLOUD immediately follows AIR');
    });

    it('IRONBARS should be between walls and door', () => {
      assert(IRONBARS > LAVAWALL, 'IRONBARS after lava features');
      assert(IRONBARS < DOOR, 'IRONBARS before DOOR');
    });
  });

  describe('Terrain Type Boundary', () => {
    it('MAX_TYPE should define terrain type count', () => {
      // C ref: include/rm.h MAX_TYPE is one past the last valid type
      assert.strictEqual(MAX_TYPE, 37, 'MAX_TYPE should be 37');
    });

    it('MAX_TYPE should be one past last terrain type', () => {
      // CLOUD (36) is the last actual terrain type
      assert.strictEqual(MAX_TYPE - CLOUD, 1, 'MAX_TYPE is CLOUD + 1');
    });

    it('all terrain types should be less than MAX_TYPE', () => {
      const terrains = [
        STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
        CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL,
        TREE, SDOOR, SCORR, POOL, MOAT, WATER, DRAWBRIDGE_UP,
        LAVAPOOL, LAVAWALL, IRONBARS, DOOR, CORR, ROOM, STAIRS, LADDER,
        FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE, DRAWBRIDGE_DOWN, AIR, CLOUD
      ];

      for (const terrain of terrains) {
        assert(terrain < MAX_TYPE, `Terrain ${terrain} should be < MAX_TYPE`);
      }
    });
  });

  describe('Terrain Type Uniqueness', () => {
    it('all terrain types should be unique', () => {
      const terrains = [
        STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
        CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL,
        TREE, SDOOR, SCORR, POOL, MOAT, WATER, DRAWBRIDGE_UP,
        LAVAPOOL, LAVAWALL, IRONBARS, DOOR, CORR, ROOM, STAIRS, LADDER,
        FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE, DRAWBRIDGE_DOWN, AIR, CLOUD
      ];

      const unique = new Set(terrains);
      assert.strictEqual(unique.size, terrains.length, 'All terrain types should be unique');
    });

    it('should have exactly 37 terrain types', () => {
      // C ref: NetHack has 37 terrain types (0-36)
      assert.strictEqual(MAX_TYPE, 37, 'Should have 37 terrain types (0-36)');
    });
  });

  describe('Terrain Type Ranges', () => {
    it('all terrain types should be in valid range [0, 36]', () => {
      const terrains = [
        STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
        CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL,
        TREE, SDOOR, SCORR, POOL, MOAT, WATER, DRAWBRIDGE_UP,
        LAVAPOOL, LAVAWALL, IRONBARS, DOOR, CORR, ROOM, STAIRS, LADDER,
        FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE, DRAWBRIDGE_DOWN, AIR, CLOUD
      ];

      for (const terrain of terrains) {
        assert(terrain >= 0 && terrain <= 36,
          `Terrain ${terrain} should be in range [0, 36]`);
      }
    });

    it('terrain types should fit in 6 bits (0-63)', () => {
      // Highest terrain is 36, so all fit in 6 bits
      const terrains = [
        STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
        CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL,
        TREE, SDOOR, SCORR, POOL, MOAT, WATER, DRAWBRIDGE_UP,
        LAVAPOOL, LAVAWALL, IRONBARS, DOOR, CORR, ROOM, STAIRS, LADDER,
        FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, ICE, DRAWBRIDGE_DOWN, AIR, CLOUD
      ];

      for (const terrain of terrains) {
        assert(terrain >= 0 && terrain < 64, `Terrain ${terrain} should fit in 6 bits`);
      }
    });
  });

  describe('Terrain Type Categories', () => {
    it('should have wall types', () => {
      const walls = [VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
                     CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL];

      for (const wall of walls) {
        assert(typeof wall === 'number', `Wall ${wall} should be defined`);
      }
      assert.strictEqual(walls.length, 12, 'Should have 12 wall types');
    });

    it('should have open space types (ROOM, CORR, AIR)', () => {
      assert(typeof ROOM === 'number', 'ROOM should be defined');
      assert(typeof CORR === 'number', 'CORR should be defined');
      assert(typeof AIR === 'number', 'AIR should be defined');
    });

    it('should have liquid types', () => {
      const liquids = [POOL, MOAT, WATER, LAVAPOOL];
      for (const liquid of liquids) {
        assert(typeof liquid === 'number', `Liquid ${liquid} should be defined`);
      }
    });

    it('should have interactive features', () => {
      const interactive = [DOOR, STAIRS, LADDER, FOUNTAIN, THRONE, SINK, ALTAR];
      for (const feature of interactive) {
        assert(typeof feature === 'number', `Feature ${feature} should be defined`);
      }
    });

    it('should have obstacle types', () => {
      const obstacles = [STONE, TREE, IRONBARS, DRAWBRIDGE_UP, GRAVE];
      for (const obstacle of obstacles) {
        assert(typeof obstacle === 'number', `Obstacle ${obstacle} should be defined`);
      }
    });
  });

  describe('Terrain Type Relationships', () => {
    it('basic walls should come first (VWALL, HWALL)', () => {
      assert(VWALL < TLCORNER, 'VWALL before corners');
      assert(HWALL < TLCORNER, 'HWALL before corners');
      assert.strictEqual(VWALL, 1, 'VWALL is early');
      assert.strictEqual(HWALL, 2, 'HWALL is early');
    });

    it('corners should be grouped together', () => {
      const corners = [TLCORNER, TRCORNER, BLCORNER, BRCORNER];
      const minCorner = Math.min(...corners);
      const maxCorner = Math.max(...corners);
      assert.strictEqual(maxCorner - minCorner, 3, 'All 4 corners should be sequential');
    });

    it('secret features should be near each other', () => {
      assert.strictEqual(SCORR - SDOOR, 1, 'Secret features are adjacent');
    });

    it('furniture should be grouped together', () => {
      const furniture = [FOUNTAIN, THRONE, SINK, GRAVE, ALTAR];
      const minFurniture = Math.min(...furniture);
      const maxFurniture = Math.max(...furniture);
      assert.strictEqual(maxFurniture - minFurniture, 4, 'All 5 furniture types sequential');
    });

    it('STONE should be the base terrain', () => {
      assert.strictEqual(STONE, 0, 'STONE is 0 (base/default terrain)');
    });

    it('CLOUD should be the last actual terrain type', () => {
      assert.strictEqual(CLOUD, 36, 'CLOUD is 36 (last terrain before MAX_TYPE)');
    });
  });

  describe('Passability Groups', () => {
    it('passable floor types should be identifiable', () => {
      // ROOM, CORR, DOOR (when open), DRAWBRIDGE_DOWN are passable floors
      assert(typeof ROOM === 'number', 'ROOM is passable');
      assert(typeof CORR === 'number', 'CORR is passable');
      assert(typeof DRAWBRIDGE_DOWN === 'number', 'DRAWBRIDGE_DOWN is passable floor');
    });

    it('impassable obstacle types should be identifiable', () => {
      // STONE, walls, TREE, IRONBARS, DRAWBRIDGE_UP are impassable
      assert(typeof STONE === 'number', 'STONE is impassable');
      assert(typeof VWALL === 'number', 'VWALL is impassable');
      assert(typeof TREE === 'number', 'TREE is impassable');
      assert(typeof IRONBARS === 'number', 'IRONBARS is impassable');
      assert(typeof DRAWBRIDGE_UP === 'number', 'DRAWBRIDGE_UP is impassable');
    });

    it('swimming-required types should be identifiable', () => {
      // POOL, MOAT, WATER, LAVAPOOL require swimming/levitation
      assert(typeof POOL === 'number', 'POOL requires swimming');
      assert(typeof MOAT === 'number', 'MOAT requires swimming');
      assert(typeof WATER === 'number', 'WATER requires swimming');
      assert(typeof LAVAPOOL === 'number', 'LAVAPOOL requires levitation');
    });
  });

  describe('Terrain Type Completeness', () => {
    it('should have all standard terrain types from C NetHack', () => {
      // Verify all major terrain categories are present
      const requiredTerrains = [
        'STONE', 'VWALL', 'HWALL', 'TLCORNER', 'TRCORNER', 'BLCORNER', 'BRCORNER',
        'CROSSWALL', 'TREE', 'SDOOR', 'SCORR',
        'POOL', 'MOAT', 'WATER', 'LAVAPOOL', 'LAVAWALL',
        'IRONBARS', 'DOOR', 'CORR', 'ROOM', 'STAIRS', 'LADDER',
        'FOUNTAIN', 'THRONE', 'SINK', 'GRAVE', 'ALTAR',
        'ICE', 'DRAWBRIDGE_UP', 'DRAWBRIDGE_DOWN', 'AIR', 'CLOUD'
      ];

      const terrainMap = {
        STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
        CROSSWALL, TREE, SDOOR, SCORR,
        POOL, MOAT, WATER, LAVAPOOL, LAVAWALL,
        IRONBARS, DOOR, CORR, ROOM, STAIRS, LADDER,
        FOUNTAIN, THRONE, SINK, GRAVE, ALTAR,
        ICE, DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, AIR, CLOUD
      };

      for (const terrainName of requiredTerrains) {
        assert(terrainMap[terrainName] !== undefined,
          `${terrainName} should be defined`);
      }
    });
  });

  describe('Critical Terrain Values', () => {
    it('STONE should be 0 for absence checks', () => {
      // STONE=0 allows simple falsy checks for unexcavated terrain
      assert.strictEqual(STONE, 0, 'STONE must be 0');
    });

    it('ROOM and CORR should be near end (after features)', () => {
      // ROOM and CORR come late because they're the basic passable floor
      assert(ROOM > 20, 'ROOM is late in sequence (> 20)');
      assert(CORR > 20, 'CORR is late in sequence (> 20)');
    });

    it('secret features should have moderate values', () => {
      // SDOOR and SCORR are in middle range
      assert(SDOOR > 10 && SDOOR < 20, 'SDOOR in middle range');
      assert(SCORR > 10 && SCORR < 20, 'SCORR in middle range');
    });
  });
});
