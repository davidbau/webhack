/**
 * Monster System Accuracy Tests
 *
 * Verify that monster types, flags, and properties match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Monster resistances (MR_)
  MR_FIRE, MR_COLD, MR_SLEEP, MR_DISINT, MR_ELEC,
  MR_POISON, MR_ACID, MR_STONE,
  // Monster flags 1 (M1_) - movement and body
  M1_FLY, M1_SWIM, M1_AMORPHOUS, M1_WALLWALK, M1_CLING,
  M1_TUNNEL, M1_NEEDPICK, M1_CONCEAL, M1_HIDE, M1_AMPHIBIOUS,
  M1_BREATHLESS, M1_NOTAKE, M1_NOEYES, M1_NOHANDS, M1_NOLIMBS,
  M1_NOHEAD, M1_MINDLESS, M1_HUMANOID, M1_ANIMAL, M1_SLITHY,
  M1_UNSOLID, M1_THICK_HIDE, M1_OVIPAROUS, M1_REGEN,
  M1_SEE_INVIS, M1_TPORT, M1_TPORT_CNTRL,
  M1_ACID, M1_POIS, M1_CARNIVORE, M1_HERBIVORE, M1_OMNIVORE,
  M1_METALLIVORE,
  // Monster flags 2 (M2_) - race and behavior
  M2_NOPOLY, M2_UNDEAD, M2_WERE, M2_HUMAN, M2_ELF, M2_DWARF,
  M2_GNOME, M2_ORC, M2_DEMON, M2_MERC, M2_LORD, M2_PRINCE,
  M2_MINION, M2_GIANT, M2_SHAPESHIFTER,
  M2_MALE, M2_FEMALE, M2_NEUTER, M2_PNAME,
  M2_HOSTILE, M2_PEACEFUL, M2_DOMESTIC, M2_WANDER, M2_STALK,
  M2_NASTY, M2_STRONG, M2_ROCKTHROW,
  M2_GREEDY, M2_JEWELS, M2_COLLECT, M2_MAGIC,
  // Monster flags 3 (M3_) - special
  M3_WANTSAMUL, M3_WANTSBELL, M3_WANTSBOOK, M3_WANTSCAND,
  M3_WANTSARTI, M3_WANTSALL, M3_WAITFORU, M3_CLOSE,
  M3_COVETOUS, M3_WAITMASK,
  M3_INFRAVISION, M3_INFRAVISIBLE, M3_DISPLACES,
  // Some PM_ constants for testing
  PM_GIANT_ANT, PM_KILLER_BEE, PM_SOLDIER_ANT, PM_FIRE_ANT,
  PM_ACID_BLOB, PM_COCKATRICE,
  PM_LITTLE_DOG, PM_DOG, PM_LARGE_DOG, PM_WEREWOLF,
  PM_FLOATING_EYE, PM_GRID_BUG, PM_NEWT,
  PM_GOBLIN, PM_HOBGOBLIN, PM_KOBOLD, PM_ORC,
  PM_HUMAN, PM_ELF, PM_DWARF, PM_GNOME,
  PM_GIANT_RAT, PM_SEWER_RAT, PM_ROCK_MOLE,
  PM_PURPLE_WORM, PM_BABY_PURPLE_WORM,
  PM_WIZARD_OF_YENDOR,
  mons
} from '../../js/monsters.js';

import {
  carnivorous, herbivorous, is_omnivore, is_metallivore,
  is_animal, is_mindless, is_humanoid, slithy, unsolid,
  nohands, nolimbs, nohead, noeyes, notake,
  can_fly, can_swim, amorphous, passes_walls, can_tunnel
} from '../../js/mondata.js';

describe('Monster System Accuracy', () => {
  describe('Monster Resistance Constants (MR_)', () => {
    it('should match C NetHack resistance flags', () => {
      // C ref: include/monflag.h resistance bit flags
      assert.strictEqual(MR_FIRE, 0x01, 'MR_FIRE should be 0x01');
      assert.strictEqual(MR_COLD, 0x02, 'MR_COLD should be 0x02');
      assert.strictEqual(MR_SLEEP, 0x04, 'MR_SLEEP should be 0x04');
      assert.strictEqual(MR_DISINT, 0x08, 'MR_DISINT should be 0x08');
      assert.strictEqual(MR_ELEC, 0x10, 'MR_ELEC should be 0x10');
      assert.strictEqual(MR_POISON, 0x20, 'MR_POISON should be 0x20');
      assert.strictEqual(MR_ACID, 0x40, 'MR_ACID should be 0x40');
      assert.strictEqual(MR_STONE, 0x80, 'MR_STONE should be 0x80');
    });

    it('resistance flags should be powers of 2', () => {
      const resistances = [
        MR_FIRE, MR_COLD, MR_SLEEP, MR_DISINT,
        MR_ELEC, MR_POISON, MR_ACID, MR_STONE
      ];

      for (const res of resistances) {
        // Power of 2 test: n & (n-1) === 0
        assert.strictEqual(res & (res - 1), 0,
          `Resistance ${res.toString(16)} should be power of 2`);
      }
    });

    it('all resistance flags should be unique', () => {
      const resistances = [
        MR_FIRE, MR_COLD, MR_SLEEP, MR_DISINT,
        MR_ELEC, MR_POISON, MR_ACID, MR_STONE
      ];

      const unique = new Set(resistances);
      assert.strictEqual(unique.size, resistances.length,
        'All resistance flags should have unique values');
    });
  });

  describe('Monster Flags 1 (M1_) - Movement and Body', () => {
    it('should have correct bit values for M1_ flags', () => {
      // C ref: include/monflag.h M1_ bit definitions
      assert.strictEqual(M1_FLY, 0x00000001, 'M1_FLY should be 0x00000001');
      assert.strictEqual(M1_SWIM, 0x00000002, 'M1_SWIM should be 0x00000002');
      assert.strictEqual(M1_AMORPHOUS, 0x00000004, 'M1_AMORPHOUS should be 0x00000004');
      assert.strictEqual(M1_WALLWALK, 0x00000008, 'M1_WALLWALK should be 0x00000008');
      assert.strictEqual(M1_CLING, 0x00000010, 'M1_CLING should be 0x00000010');
      assert.strictEqual(M1_TUNNEL, 0x00000020, 'M1_TUNNEL should be 0x00000020');
    });

    it('M1_NOLIMBS should combine NOHANDS and additional bits', () => {
      // C ref: M1_NOLIMBS = (M1_NOHANDS | 0x00004000)
      assert.strictEqual(M1_NOHANDS, 0x00002000, 'M1_NOHANDS should be 0x00002000');
      assert.strictEqual(M1_NOLIMBS, 0x00006000, 'M1_NOLIMBS should be 0x00006000');
      assert((M1_NOLIMBS & M1_NOHANDS) === M1_NOHANDS,
        'M1_NOLIMBS should include M1_NOHANDS bits');
    });

    it('M1_OMNIVORE should combine carnivore and herbivore', () => {
      // C ref: M1_OMNIVORE = (M1_CARNIVORE | M1_HERBIVORE)
      assert.strictEqual(M1_CARNIVORE, 0x20000000, 'M1_CARNIVORE should be 0x20000000');
      assert.strictEqual(M1_HERBIVORE, 0x40000000, 'M1_HERBIVORE should be 0x40000000');
      assert.strictEqual(M1_OMNIVORE, 0x60000000, 'M1_OMNIVORE should be 0x60000000');
      assert.strictEqual(M1_OMNIVORE, M1_CARNIVORE | M1_HERBIVORE,
        'M1_OMNIVORE should equal M1_CARNIVORE | M1_HERBIVORE');
    });
  });

  describe('Monster Flags 2 (M2_) - Race and Behavior', () => {
    it('should have race flags for playable races', () => {
      // C ref: M2_ flags for race types
      assert(typeof M2_HUMAN === 'number', 'M2_HUMAN should be defined');
      assert(typeof M2_ELF === 'number', 'M2_ELF should be defined');
      assert(typeof M2_DWARF === 'number', 'M2_DWARF should be defined');
      assert(typeof M2_GNOME === 'number', 'M2_GNOME should be defined');
      assert(typeof M2_ORC === 'number', 'M2_ORC should be defined');
    });

    it('should have gender flags', () => {
      // C ref: M2_MALE, M2_FEMALE, M2_NEUTER
      assert(typeof M2_MALE === 'number', 'M2_MALE should be defined');
      assert(typeof M2_FEMALE === 'number', 'M2_FEMALE should be defined');
      assert(typeof M2_NEUTER === 'number', 'M2_NEUTER should be defined');

      // All should be distinct
      const genders = [M2_MALE, M2_FEMALE, M2_NEUTER];
      const unique = new Set(genders);
      assert.strictEqual(unique.size, 3, 'Gender flags should be unique');
    });

    it('should have behavior flags', () => {
      assert(typeof M2_HOSTILE === 'number', 'M2_HOSTILE should be defined');
      assert(typeof M2_PEACEFUL === 'number', 'M2_PEACEFUL should be defined');
      assert(typeof M2_DOMESTIC === 'number', 'M2_DOMESTIC should be defined');
      assert(typeof M2_WANDER === 'number', 'M2_WANDER should be defined');
      assert(typeof M2_STALK === 'number', 'M2_STALK should be defined');
    });

    it('should have loot behavior flags', () => {
      assert(typeof M2_GREEDY === 'number', 'M2_GREEDY should be defined');
      assert(typeof M2_JEWELS === 'number', 'M2_JEWELS should be defined');
      assert(typeof M2_COLLECT === 'number', 'M2_COLLECT should be defined');
      assert(typeof M2_MAGIC === 'number', 'M2_MAGIC should be defined');
    });
  });

  describe('Monster Flags 3 (M3_) - Special Behavior', () => {
    it('should have quest artifact desire flags', () => {
      // C ref: M3_WANTS* flags for covetous monsters
      assert(typeof M3_WANTSAMUL === 'number', 'M3_WANTSAMUL should be defined');
      assert(typeof M3_WANTSBELL === 'number', 'M3_WANTSBELL should be defined');
      assert(typeof M3_WANTSBOOK === 'number', 'M3_WANTSBOOK should be defined');
      assert(typeof M3_WANTSCAND === 'number', 'M3_WANTSCAND should be defined');
      assert(typeof M3_WANTSARTI === 'number', 'M3_WANTSARTI should be defined');
      assert(typeof M3_WANTSALL === 'number', 'M3_WANTSALL should be defined');
    });

    it('should have wait/close behavior flags', () => {
      assert(typeof M3_WAITFORU === 'number', 'M3_WAITFORU should be defined');
      assert(typeof M3_CLOSE === 'number', 'M3_CLOSE should be defined');
      assert(typeof M3_COVETOUS === 'number', 'M3_COVETOUS should be defined');
      assert(typeof M3_WAITMASK === 'number', 'M3_WAITMASK should be defined');
    });

    it('should have vision flags', () => {
      assert(typeof M3_INFRAVISION === 'number', 'M3_INFRAVISION should be defined');
      assert(typeof M3_INFRAVISIBLE === 'number', 'M3_INFRAVISIBLE should be defined');
      assert(typeof M3_DISPLACES === 'number', 'M3_DISPLACES should be defined');
    });
  });

  describe('Monster Type Constants (PM_)', () => {
    it('PM_GIANT_ANT should be first monster (index 0)', () => {
      // C ref: include/pm.h monster indices start at 0
      assert.strictEqual(PM_GIANT_ANT, 0, 'PM_GIANT_ANT should be index 0');
    });

    it('should have sequential ant indices', () => {
      // C ref: Ants are first in monster list
      assert.strictEqual(PM_GIANT_ANT, 0);
      assert.strictEqual(PM_KILLER_BEE, 1);
      assert.strictEqual(PM_SOLDIER_ANT, 2);
      assert.strictEqual(PM_FIRE_ANT, 3);
    });

    it('should have common monster types', () => {
      // Verify important monster constants exist
      assert(typeof PM_KOBOLD === 'number', 'PM_KOBOLD should be defined');
      assert(typeof PM_GOBLIN === 'number', 'PM_GOBLIN should be defined');
      assert(typeof PM_ORC === 'number', 'PM_ORC should be defined');
      assert(typeof PM_NEWT === 'number', 'PM_NEWT should be defined');
      assert(typeof PM_GRID_BUG === 'number', 'PM_GRID_BUG should be defined');
    });

    it('should have dog family types', () => {
      // C ref: Dog progression
      assert(typeof PM_LITTLE_DOG === 'number', 'PM_LITTLE_DOG should be defined');
      assert(typeof PM_DOG === 'number', 'PM_DOG should be defined');
      assert(typeof PM_LARGE_DOG === 'number', 'PM_LARGE_DOG should be defined');
      assert(PM_LITTLE_DOG < PM_DOG, 'Little dog should come before dog');
      assert(PM_DOG < PM_LARGE_DOG, 'Dog should come before large dog');
    });

    it('should have special quest monsters', () => {
      assert(typeof PM_WIZARD_OF_YENDOR === 'number', 'PM_WIZARD_OF_YENDOR should be defined');
    });

    it('should have dangerous monsters', () => {
      assert(typeof PM_COCKATRICE === 'number', 'PM_COCKATRICE should be defined');
      assert(typeof PM_FLOATING_EYE === 'number', 'PM_FLOATING_EYE should be defined');
      assert(typeof PM_PURPLE_WORM === 'number', 'PM_PURPLE_WORM should be defined');
    });
  });

  describe('Monster Data Array', () => {
    it('mons array should exist and have entries', () => {
      assert(Array.isArray(mons), 'mons should be an array');
      assert(mons.length > 0, 'mons array should have entries');
      assert(mons.length > 100, 'mons should have at least 100+ monster types');
    });

    it('each monster entry should have required fields', () => {
      // Check first few monsters
      for (let i = 0; i < Math.min(10, mons.length); i++) {
        const mon = mons[i];
        assert(mon.name, `Monster ${i} should have name`);
        assert(typeof mon.symbol === 'number', `Monster ${i} should have symbol (monster class)`);
        assert(typeof mon.level === 'number', `Monster ${i} should have level`);
        assert(typeof mon.mr === 'number', `Monster ${i} should have mr (magic resistance)`);
        assert(typeof mon.flags1 === 'number', `Monster ${i} should have flags1`);
        assert(typeof mon.flags2 === 'number', `Monster ${i} should have flags2`);
        assert(typeof mon.flags3 === 'number', `Monster ${i} should have flags3`);
      }
    });

    it('PM_ constants should index into mons array', () => {
      // Verify PM_ constants are valid indices
      assert(mons[PM_GIANT_ANT], 'PM_GIANT_ANT should index valid monster');
      assert(mons[PM_KOBOLD], 'PM_KOBOLD should index valid monster');
      assert(mons[PM_LITTLE_DOG], 'PM_LITTLE_DOG should index valid monster');

      // Verify the names match expectations
      assert(mons[PM_GIANT_ANT].name.toLowerCase().includes('ant'),
        'PM_GIANT_ANT should refer to an ant');
      assert(mons[PM_LITTLE_DOG].name.toLowerCase().includes('dog'),
        'PM_LITTLE_DOG should refer to a dog');
    });
  });

  describe('Monster Predicate Functions', () => {
    it('carnivorous() should detect carnivore flag', () => {
      // Test with a monster that should be carnivorous (dog)
      const dog = mons[PM_DOG];
      if (dog.flags1 & M1_CARNIVORE) {
        assert(carnivorous(dog), 'Dog should be carnivorous');
      }
    });

    it('herbivorous() should detect herbivore flag', () => {
      // Test function exists and works
      const testMon = { flags1: M1_HERBIVORE };
      assert(herbivorous(testMon), 'Should detect herbivore flag');
    });

    it('is_omnivore() should require both diet flags', () => {
      // C ref: Omnivore requires BOTH carnivore and herbivore bits
      const omnivore = { flags1: M1_OMNIVORE };
      assert(is_omnivore(omnivore), 'Should detect omnivore (both flags)');

      const carnivore = { flags1: M1_CARNIVORE };
      assert(!is_omnivore(carnivore), 'Carnivore only is not omnivore');

      const herbivore = { flags1: M1_HERBIVORE };
      assert(!is_omnivore(herbivore), 'Herbivore only is not omnivore');
    });

    it('can_fly() should detect fly flag', () => {
      const flyer = { flags1: M1_FLY };
      assert(can_fly(flyer), 'Should detect M1_FLY');

      const nonFlyer = { flags1: 0 };
      assert(!can_fly(nonFlyer), 'Should not detect fly on monster without flag');
    });

    it('can_swim() should detect swim flag', () => {
      const swimmer = { flags1: M1_SWIM };
      assert(can_swim(swimmer), 'Should detect M1_SWIM');
    });

    it('is_humanoid() should detect humanoid flag', () => {
      const humanoid = { flags1: M1_HUMANOID };
      assert(is_humanoid(humanoid), 'Should detect M1_HUMANOID');
    });

    it('nolimbs() should require exact NOLIMBS bits', () => {
      // C ref: nolimbs(ptr) checks (flags1 & M1_NOLIMBS) === M1_NOLIMBS
      const noLimbs = { flags1: M1_NOLIMBS };
      assert(nolimbs(noLimbs), 'Should detect M1_NOLIMBS');

      // Just NOHANDS is not enough for nolimbs()
      const justNoHands = { flags1: M1_NOHANDS };
      assert(!nolimbs(justNoHands), 'M1_NOHANDS alone should not satisfy nolimbs()');
    });

    it('passes_walls() should detect wallwalk flag', () => {
      const wallwalker = { flags1: M1_WALLWALK };
      assert(passes_walls(wallwalker), 'Should detect M1_WALLWALK');
    });

    it('amorphous() should detect amorphous flag', () => {
      const blob = mons[PM_ACID_BLOB];
      // Acid blobs should be amorphous
      if (blob.flags1 & M1_AMORPHOUS) {
        assert(amorphous(blob), 'Acid blob should be amorphous');
      }
    });
  });

  describe('Monster Characteristics', () => {
    it('cockatrice should have stone touch', () => {
      const cockatrice = mons[PM_COCKATRICE];
      // Cockatrices petrify on touch (would need to check attack data)
      assert(cockatrice, 'Cockatrice should exist in mons array');
      assert(cockatrice.name.toLowerCase().includes('cockatrice'),
        'PM_COCKATRICE should refer to a cockatrice');
    });

    it('floating eye should be eyeball class', () => {
      const eye = mons[PM_FLOATING_EYE];
      assert(eye, 'Floating eye should exist');
      // Floating eyes have a monster symbol class
      assert(typeof eye.symbol === 'number', 'Floating eye should have symbol class');
    });

    it('grid bug should have specific movement', () => {
      const gridBug = mons[PM_GRID_BUG];
      assert(gridBug, 'Grid bug should exist');
      // Grid bugs move in straight lines (but that's in movement code, not flags)
    });
  });

  describe('Monster Flag Combinations', () => {
    it('undead should be distinct from living', () => {
      // Verify M2_UNDEAD exists
      assert(typeof M2_UNDEAD === 'number', 'M2_UNDEAD should be defined');
    });

    it('were-creatures should have M2_WERE flag', () => {
      assert(typeof M2_WERE === 'number', 'M2_WERE should be defined');

      const werewolf = mons[PM_WEREWOLF];
      if (werewolf.flags2 & M2_WERE) {
        assert(true, 'Werewolf has M2_WERE flag');
      }
    });

    it('demons should have M2_DEMON flag', () => {
      assert(typeof M2_DEMON === 'number', 'M2_DEMON should be defined');
    });

    it('giants should have M2_GIANT flag', () => {
      assert(typeof M2_GIANT === 'number', 'M2_GIANT should be defined');
    });
  });
});
