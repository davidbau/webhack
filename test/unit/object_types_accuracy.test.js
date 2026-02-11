/**
 * Object Class and Material Type Accuracy Tests
 *
 * Verify that object class and material type constants match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Object classes
  ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
  AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS,
  SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS,
  GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS,
  // Material types
  LIQUID, WAX, VEGGY, FLESH, PAPER, CLOTH, LEATHER, WOOD, BONE,
  DRAGON_HIDE, IRON, METAL, COPPER, SILVER, GOLD, PLATINUM,
  MITHRIL, PLASTIC, GLASS, GEMSTONE, MINERAL
} from '../../js/objects.js';

describe('Object Class and Material Type Accuracy', () => {
  describe('Object Class Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/objclass.h object class definitions
      assert.strictEqual(ILLOBJ_CLASS, 0, 'ILLOBJ_CLASS should be 0');
      assert.strictEqual(WEAPON_CLASS, 1, 'WEAPON_CLASS should be 1');
      assert.strictEqual(ARMOR_CLASS, 2, 'ARMOR_CLASS should be 2');
      assert.strictEqual(RING_CLASS, 3, 'RING_CLASS should be 3');
      assert.strictEqual(AMULET_CLASS, 4, 'AMULET_CLASS should be 4');
      assert.strictEqual(TOOL_CLASS, 5, 'TOOL_CLASS should be 5');
      assert.strictEqual(FOOD_CLASS, 6, 'FOOD_CLASS should be 6');
      assert.strictEqual(POTION_CLASS, 7, 'POTION_CLASS should be 7');
      assert.strictEqual(SCROLL_CLASS, 8, 'SCROLL_CLASS should be 8');
      assert.strictEqual(SPBOOK_CLASS, 9, 'SPBOOK_CLASS should be 9');
      assert.strictEqual(WAND_CLASS, 10, 'WAND_CLASS should be 10');
      assert.strictEqual(COIN_CLASS, 11, 'COIN_CLASS should be 11');
      assert.strictEqual(GEM_CLASS, 12, 'GEM_CLASS should be 12');
      assert.strictEqual(ROCK_CLASS, 13, 'ROCK_CLASS should be 13');
      assert.strictEqual(BALL_CLASS, 14, 'BALL_CLASS should be 14');
      assert.strictEqual(CHAIN_CLASS, 15, 'CHAIN_CLASS should be 15');
      assert.strictEqual(VENOM_CLASS, 16, 'VENOM_CLASS should be 16');
    });

    it('object classes should be sequential from 0-16', () => {
      const classes = [
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
        AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS,
        SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS,
        GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS
      ];
      for (let i = 0; i < classes.length; i++) {
        assert.strictEqual(classes[i], i, `Object class ${i} should be ${i}`);
      }
    });

    it('ILLOBJ_CLASS should be 0 (illegal/invalid object)', () => {
      assert.strictEqual(ILLOBJ_CLASS, 0, 'ILLOBJ_CLASS is 0 (invalid)');
    });

    it('all object classes should be unique', () => {
      const classes = [
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
        AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS,
        SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS,
        GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS
      ];
      const unique = new Set(classes);
      assert.strictEqual(unique.size, 17, 'All 17 object classes should be unique');
    });
  });

  describe('Object Class Categories', () => {
    it('should have equipment classes', () => {
      // Weapons and armor are equipment
      assert(typeof WEAPON_CLASS === 'number', 'WEAPON_CLASS defined');
      assert(typeof ARMOR_CLASS === 'number', 'ARMOR_CLASS defined');
      assert(typeof RING_CLASS === 'number', 'RING_CLASS defined');
      assert(typeof AMULET_CLASS === 'number', 'AMULET_CLASS defined');
    });

    it('should have consumable classes', () => {
      // Food, potions, scrolls are consumables
      assert(typeof FOOD_CLASS === 'number', 'FOOD_CLASS defined');
      assert(typeof POTION_CLASS === 'number', 'POTION_CLASS defined');
      assert(typeof SCROLL_CLASS === 'number', 'SCROLL_CLASS defined');
    });

    it('should have magical item classes', () => {
      // Wands, spellbooks, scrolls are magical
      assert(typeof WAND_CLASS === 'number', 'WAND_CLASS defined');
      assert(typeof SPBOOK_CLASS === 'number', 'SPBOOK_CLASS defined');
      assert(typeof SCROLL_CLASS === 'number', 'SCROLL_CLASS defined');
    });

    it('should have treasure classes', () => {
      // Coins, gems are treasure
      assert(typeof COIN_CLASS === 'number', 'COIN_CLASS defined');
      assert(typeof GEM_CLASS === 'number', 'GEM_CLASS defined');
    });

    it('should have utility classes', () => {
      // Tools are utility items
      assert(typeof TOOL_CLASS === 'number', 'TOOL_CLASS defined');
    });

    it('should have special classes', () => {
      // Ball, chain, venom, rock are special
      assert(typeof BALL_CLASS === 'number', 'BALL_CLASS defined');
      assert(typeof CHAIN_CLASS === 'number', 'CHAIN_CLASS defined');
      assert(typeof VENOM_CLASS === 'number', 'VENOM_CLASS defined');
      assert(typeof ROCK_CLASS === 'number', 'ROCK_CLASS defined');
    });
  });

  describe('Object Class Ordering', () => {
    it('WEAPON_CLASS should come first after ILLOBJ', () => {
      assert.strictEqual(WEAPON_CLASS, 1, 'Weapons are first real class');
    });

    it('equipment should be early (weapons, armor, rings, amulets)', () => {
      assert(WEAPON_CLASS < 5, 'WEAPON_CLASS early');
      assert(ARMOR_CLASS < 5, 'ARMOR_CLASS early');
      assert(RING_CLASS < 5, 'RING_CLASS early');
      assert(AMULET_CLASS < 5, 'AMULET_CLASS early');
    });

    it('consumables should be in middle (food, potions, scrolls)', () => {
      assert(FOOD_CLASS > 5 && FOOD_CLASS < 10, 'FOOD_CLASS middle');
      assert(POTION_CLASS > 5 && POTION_CLASS < 10, 'POTION_CLASS middle');
      assert(SCROLL_CLASS > 5 && SCROLL_CLASS < 10, 'SCROLL_CLASS middle');
    });

    it('VENOM_CLASS should be last', () => {
      assert.strictEqual(VENOM_CLASS, 16, 'VENOM_CLASS is last (16)');
    });
  });

  describe('Object Class Ranges', () => {
    it('all object classes should fit in 5 bits (0-31)', () => {
      const classes = [
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
        AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS,
        SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS,
        GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS
      ];
      for (const cls of classes) {
        assert(cls >= 0 && cls < 32, `Class ${cls} should fit in 5 bits`);
      }
    });

    it('all object classes should be in valid range [0, 16]', () => {
      const classes = [
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
        AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS,
        SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS,
        GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS
      ];
      for (const cls of classes) {
        assert(cls >= 0 && cls <= 16, `Class ${cls} should be in [0, 16]`);
      }
    });
  });

  describe('Material Type Constants', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/objclass.h material type definitions
      assert.strictEqual(LIQUID, 1, 'LIQUID should be 1');
      assert.strictEqual(WAX, 2, 'WAX should be 2');
      assert.strictEqual(VEGGY, 3, 'VEGGY (vegetable) should be 3');
      assert.strictEqual(FLESH, 4, 'FLESH should be 4');
      assert.strictEqual(PAPER, 5, 'PAPER should be 5');
      assert.strictEqual(CLOTH, 6, 'CLOTH should be 6');
      assert.strictEqual(LEATHER, 7, 'LEATHER should be 7');
      assert.strictEqual(WOOD, 8, 'WOOD should be 8');
      assert.strictEqual(BONE, 9, 'BONE should be 9');
      assert.strictEqual(DRAGON_HIDE, 10, 'DRAGON_HIDE should be 10');
      assert.strictEqual(IRON, 11, 'IRON should be 11');
      assert.strictEqual(METAL, 12, 'METAL should be 12');
      assert.strictEqual(COPPER, 13, 'COPPER should be 13');
      assert.strictEqual(SILVER, 14, 'SILVER should be 14');
      assert.strictEqual(GOLD, 15, 'GOLD should be 15');
      assert.strictEqual(PLATINUM, 16, 'PLATINUM should be 16');
      assert.strictEqual(MITHRIL, 17, 'MITHRIL should be 17');
      assert.strictEqual(PLASTIC, 18, 'PLASTIC should be 18');
      assert.strictEqual(GLASS, 19, 'GLASS should be 19');
      assert.strictEqual(GEMSTONE, 20, 'GEMSTONE should be 20');
      assert.strictEqual(MINERAL, 21, 'MINERAL should be 21');
    });

    it('material types should be sequential from 1-21', () => {
      const materials = [
        LIQUID, WAX, VEGGY, FLESH, PAPER, CLOTH, LEATHER, WOOD, BONE,
        DRAGON_HIDE, IRON, METAL, COPPER, SILVER, GOLD, PLATINUM,
        MITHRIL, PLASTIC, GLASS, GEMSTONE, MINERAL
      ];
      for (let i = 0; i < materials.length; i++) {
        assert.strictEqual(materials[i], i + 1, `Material ${i} should be ${i + 1}`);
      }
    });

    it('all material types should be unique', () => {
      const materials = [
        LIQUID, WAX, VEGGY, FLESH, PAPER, CLOTH, LEATHER, WOOD, BONE,
        DRAGON_HIDE, IRON, METAL, COPPER, SILVER, GOLD, PLATINUM,
        MITHRIL, PLASTIC, GLASS, GEMSTONE, MINERAL
      ];
      const unique = new Set(materials);
      assert.strictEqual(unique.size, 21, 'All 21 material types should be unique');
    });
  });

  describe('Material Type Categories', () => {
    it('should have organic materials', () => {
      // Flesh, veggy, leather, wood, bone, dragon hide
      assert(typeof FLESH === 'number', 'FLESH defined');
      assert(typeof VEGGY === 'number', 'VEGGY defined');
      assert(typeof LEATHER === 'number', 'LEATHER defined');
      assert(typeof WOOD === 'number', 'WOOD defined');
      assert(typeof BONE === 'number', 'BONE defined');
      assert(typeof DRAGON_HIDE === 'number', 'DRAGON_HIDE defined');
    });

    it('should have metal materials', () => {
      // Iron, metal, copper, silver, gold, platinum, mithril
      assert(typeof IRON === 'number', 'IRON defined');
      assert(typeof METAL === 'number', 'METAL defined');
      assert(typeof COPPER === 'number', 'COPPER defined');
      assert(typeof SILVER === 'number', 'SILVER defined');
      assert(typeof GOLD === 'number', 'GOLD defined');
      assert(typeof PLATINUM === 'number', 'PLATINUM defined');
      assert(typeof MITHRIL === 'number', 'MITHRIL defined');
    });

    it('should have precious metals', () => {
      // Silver, gold, platinum, mithril
      assert(typeof SILVER === 'number', 'SILVER defined');
      assert(typeof GOLD === 'number', 'GOLD defined');
      assert(typeof PLATINUM === 'number', 'PLATINUM defined');
      assert(typeof MITHRIL === 'number', 'MITHRIL defined');
    });

    it('should have fabric materials', () => {
      // Paper, cloth, leather
      assert(typeof PAPER === 'number', 'PAPER defined');
      assert(typeof CLOTH === 'number', 'CLOTH defined');
      assert(typeof LEATHER === 'number', 'LEATHER defined');
    });

    it('should have mineral materials', () => {
      // Glass, gemstone, mineral
      assert(typeof GLASS === 'number', 'GLASS defined');
      assert(typeof GEMSTONE === 'number', 'GEMSTONE defined');
      assert(typeof MINERAL === 'number', 'MINERAL defined');
    });

    it('should have special materials', () => {
      // Liquid, wax, dragon hide, plastic
      assert(typeof LIQUID === 'number', 'LIQUID defined');
      assert(typeof WAX === 'number', 'WAX defined');
      assert(typeof DRAGON_HIDE === 'number', 'DRAGON_HIDE defined');
      assert(typeof PLASTIC === 'number', 'PLASTIC defined');
    });
  });

  describe('Material Type Ordering', () => {
    it('LIQUID should be first material', () => {
      assert.strictEqual(LIQUID, 1, 'LIQUID is first (1)');
    });

    it('organic materials should be early', () => {
      assert(VEGGY < 10, 'VEGGY early');
      assert(FLESH < 10, 'FLESH early');
      assert(WOOD < 10, 'WOOD early');
      assert(BONE < 10, 'BONE early');
    });

    it('metals should be in middle section', () => {
      assert(IRON > 10 && IRON < 20, 'IRON middle section');
      assert(COPPER > 10 && COPPER < 20, 'COPPER middle section');
      assert(SILVER > 10 && SILVER < 20, 'SILVER middle section');
      assert(GOLD > 10 && GOLD < 20, 'GOLD middle section');
    });

    it('MINERAL should be last material', () => {
      assert.strictEqual(MINERAL, 21, 'MINERAL is last (21)');
    });
  });

  describe('Material Type Ranges', () => {
    it('all material types should fit in 5 bits (0-31)', () => {
      const materials = [
        LIQUID, WAX, VEGGY, FLESH, PAPER, CLOTH, LEATHER, WOOD, BONE,
        DRAGON_HIDE, IRON, METAL, COPPER, SILVER, GOLD, PLATINUM,
        MITHRIL, PLASTIC, GLASS, GEMSTONE, MINERAL
      ];
      for (const mat of materials) {
        assert(mat >= 0 && mat < 32, `Material ${mat} should fit in 5 bits`);
      }
    });

    it('all material types should be in valid range [1, 21]', () => {
      const materials = [
        LIQUID, WAX, VEGGY, FLESH, PAPER, CLOTH, LEATHER, WOOD, BONE,
        DRAGON_HIDE, IRON, METAL, COPPER, SILVER, GOLD, PLATINUM,
        MITHRIL, PLASTIC, GLASS, GEMSTONE, MINERAL
      ];
      for (const mat of materials) {
        assert(mat >= 1 && mat <= 21, `Material ${mat} should be in [1, 21]`);
      }
    });
  });

  describe('Constant Relationships', () => {
    it('POTION_CLASS and SCROLL_CLASS should match tested values', () => {
      // These were already tested in potion_scroll_accuracy.test.js
      assert.strictEqual(POTION_CLASS, 7, 'POTION_CLASS is 7');
      assert.strictEqual(SCROLL_CLASS, 8, 'SCROLL_CLASS is 8');
    });

    it('SPBOOK_CLASS should match tested value', () => {
      // This was already tested in spell_accuracy.test.js
      assert.strictEqual(SPBOOK_CLASS, 9, 'SPBOOK_CLASS is 9');
    });

    it('should have exactly 17 object classes', () => {
      // ILLOBJ_CLASS(0) through VENOM_CLASS(16) = 17 classes
      assert.strictEqual(VENOM_CLASS - ILLOBJ_CLASS + 1, 17, '17 object classes');
    });

    it('should have exactly 21 material types', () => {
      // LIQUID(1) through MINERAL(21) = 21 materials
      assert.strictEqual(MINERAL - LIQUID + 1, 21, '21 material types');
    });
  });

  describe('Object Class Completeness', () => {
    it('should have all standard object classes from C NetHack', () => {
      const requiredClasses = [
        'ILLOBJ_CLASS', 'WEAPON_CLASS', 'ARMOR_CLASS', 'RING_CLASS',
        'AMULET_CLASS', 'TOOL_CLASS', 'FOOD_CLASS', 'POTION_CLASS',
        'SCROLL_CLASS', 'SPBOOK_CLASS', 'WAND_CLASS', 'COIN_CLASS',
        'GEM_CLASS', 'ROCK_CLASS', 'BALL_CLASS', 'CHAIN_CLASS', 'VENOM_CLASS'
      ];

      const classMap = {
        ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS,
        AMULET_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS,
        SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS,
        GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS
      };

      for (const className of requiredClasses) {
        assert(classMap[className] !== undefined, `${className} should be defined`);
      }
    });
  });

  describe('Material Type Completeness', () => {
    it('should have all standard material types from C NetHack', () => {
      const requiredMaterials = [
        'LIQUID', 'WAX', 'VEGGY', 'FLESH', 'PAPER', 'CLOTH', 'LEATHER', 'WOOD', 'BONE',
        'DRAGON_HIDE', 'IRON', 'METAL', 'COPPER', 'SILVER', 'GOLD', 'PLATINUM',
        'MITHRIL', 'PLASTIC', 'GLASS', 'GEMSTONE', 'MINERAL'
      ];

      const materialMap = {
        LIQUID, WAX, VEGGY, FLESH, PAPER, CLOTH, LEATHER, WOOD, BONE,
        DRAGON_HIDE, IRON, METAL, COPPER, SILVER, GOLD, PLATINUM,
        MITHRIL, PLASTIC, GLASS, GEMSTONE, MINERAL
      };

      for (const materialName of requiredMaterials) {
        assert(materialMap[materialName] !== undefined, `${materialName} should be defined`);
      }
    });
  });

  describe('Critical Constant Values', () => {
    it('ILLOBJ_CLASS should be 0 (invalid object marker)', () => {
      assert.strictEqual(ILLOBJ_CLASS, 0, 'ILLOBJ_CLASS must be 0');
    });

    it('WEAPON_CLASS should be 1 (first valid class)', () => {
      assert.strictEqual(WEAPON_CLASS, 1, 'WEAPON_CLASS must be 1');
    });

    it('LIQUID should be 1 (first material)', () => {
      assert.strictEqual(LIQUID, 1, 'LIQUID must be 1');
    });

    it('VENOM_CLASS should be 16 (last object class)', () => {
      assert.strictEqual(VENOM_CLASS, 16, 'VENOM_CLASS must be 16');
    });

    it('MINERAL should be 21 (last material type)', () => {
      assert.strictEqual(MINERAL, 21, 'MINERAL must be 21');
    });
  });
});
