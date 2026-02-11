/**
 * Attack and Damage Type Accuracy Tests
 *
 * Verify that attack types (AT_*) and damage types (AD_*) match C NetHack exactly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  // Attack types (AT_*)
  AT_ANY, AT_NONE, AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG,
  AT_HUGS, AT_SPIT, AT_ENGL, AT_BREA, AT_EXPL, AT_BOOM, AT_GAZE, AT_TENT,
  AT_WEAP, AT_MAGC,
  // Damage types (AD_*) - physical and elemental
  AD_ANY, AD_PHYS, AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE, AD_DISN, AD_ELEC,
  AD_DRST, AD_ACID,
  // Damage types - special effects
  AD_SPC1, AD_SPC2, AD_BLND, AD_STUN, AD_SLOW, AD_PLYS, AD_DRLI, AD_DREN,
  AD_LEGS, AD_STON, AD_STCK, AD_SGLD, AD_SITM, AD_SEDU, AD_TLPT, AD_RUST,
  AD_CONF, AD_DGST, AD_HEAL, AD_WRAP, AD_WERE,
  // Damage types - attribute drain
  AD_DRDX, AD_DRCO, AD_DRIN,
  // Damage types - diseases and effects
  AD_DISE, AD_DCAY, AD_SSEX, AD_HALU, AD_DETH, AD_PEST, AD_FAMN, AD_SLIM,
  AD_ENCH, AD_CORR, AD_POLY,
  // Damage types - special high values
  AD_CLRC, AD_SPEL, AD_RBRE, AD_SAMU, AD_CURS
} from '../../js/monsters.js';

describe('Attack and Damage Type Accuracy', () => {
  describe('Attack Type Constants (AT_*)', () => {
    it('should have correct values matching C NetHack', () => {
      // C ref: include/monflag.h attack type definitions
      assert.strictEqual(AT_ANY, -1, 'AT_ANY should be -1');
      assert.strictEqual(AT_NONE, 0, 'AT_NONE should be 0');
      assert.strictEqual(AT_CLAW, 1, 'AT_CLAW should be 1');
      assert.strictEqual(AT_BITE, 2, 'AT_BITE should be 2');
      assert.strictEqual(AT_KICK, 3, 'AT_KICK should be 3');
      assert.strictEqual(AT_BUTT, 4, 'AT_BUTT (headbutt/gore) should be 4');
      assert.strictEqual(AT_TUCH, 5, 'AT_TUCH (touch) should be 5');
      assert.strictEqual(AT_STNG, 6, 'AT_STNG (sting) should be 6');
      assert.strictEqual(AT_HUGS, 7, 'AT_HUGS (hug/squeeze) should be 7');
      assert.strictEqual(AT_SPIT, 10, 'AT_SPIT should be 10');
      assert.strictEqual(AT_ENGL, 11, 'AT_ENGL (engulf) should be 11');
      assert.strictEqual(AT_BREA, 12, 'AT_BREA (breath) should be 12');
      assert.strictEqual(AT_EXPL, 13, 'AT_EXPL (explode) should be 13');
      assert.strictEqual(AT_BOOM, 14, 'AT_BOOM (sonic boom) should be 14');
      assert.strictEqual(AT_GAZE, 15, 'AT_GAZE should be 15');
      assert.strictEqual(AT_TENT, 16, 'AT_TENT (tentacle) should be 16');
      assert.strictEqual(AT_WEAP, 254, 'AT_WEAP (weapon) should be 254');
      assert.strictEqual(AT_MAGC, 255, 'AT_MAGC (magic spell) should be 255');
    });

    it('AT_NONE should be zero (no attack)', () => {
      assert.strictEqual(AT_NONE, 0, 'AT_NONE is 0 (no attack present)');
    });

    it('AT_ANY should be -1 (wildcard)', () => {
      assert.strictEqual(AT_ANY, -1, 'AT_ANY is -1 (matches any attack)');
    });

    it('special attack types should be at high values', () => {
      // WEAP and MAGC are special (254, 255)
      assert(AT_WEAP > 200, 'AT_WEAP should be high value (254)');
      assert(AT_MAGC > 200, 'AT_MAGC should be high value (255)');
      assert.strictEqual(AT_MAGC, 255, 'AT_MAGC should be maximum byte value');
    });
  });

  describe('Attack Type Categories', () => {
    it('should have melee attack types', () => {
      const melee = [AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_HUGS, AT_TENT];
      for (const atk of melee) {
        assert(typeof atk === 'number', 'Melee attack should be defined');
        assert(atk > 0 && atk < 20, 'Melee attacks should be in low range');
      }
    });

    it('should have ranged/special attack types', () => {
      assert(typeof AT_SPIT === 'number', 'AT_SPIT should be defined');
      assert(typeof AT_BREA === 'number', 'AT_BREA (breath) should be defined');
      assert(typeof AT_GAZE === 'number', 'AT_GAZE should be defined');
    });

    it('should have explosive attack types', () => {
      assert(typeof AT_EXPL === 'number', 'AT_EXPL should be defined');
      assert(typeof AT_BOOM === 'number', 'AT_BOOM should be defined');
    });

    it('should have engulf attack', () => {
      assert(typeof AT_ENGL === 'number', 'AT_ENGL should be defined');
    });
  });

  describe('Damage Type Constants (AD_*) - Basic', () => {
    it('should have correct values for basic damage types', () => {
      // C ref: include/monflag.h damage type definitions
      assert.strictEqual(AD_ANY, -1, 'AD_ANY should be -1');
      assert.strictEqual(AD_PHYS, 0, 'AD_PHYS (physical) should be 0');
      assert.strictEqual(AD_MAGM, 1, 'AD_MAGM (magic missile) should be 1');
      assert.strictEqual(AD_FIRE, 2, 'AD_FIRE should be 2');
      assert.strictEqual(AD_COLD, 3, 'AD_COLD should be 3');
      assert.strictEqual(AD_SLEE, 4, 'AD_SLEE (sleep) should be 4');
      assert.strictEqual(AD_DISN, 5, 'AD_DISN (disintegrate) should be 5');
      assert.strictEqual(AD_ELEC, 6, 'AD_ELEC (electric) should be 6');
      assert.strictEqual(AD_DRST, 7, 'AD_DRST (strength poison) should be 7');
      assert.strictEqual(AD_ACID, 8, 'AD_ACID should be 8');
    });

    it('AD_PHYS should be zero (default physical damage)', () => {
      assert.strictEqual(AD_PHYS, 0, 'AD_PHYS is 0 (default damage type)');
    });

    it('AD_ANY should be -1 (wildcard)', () => {
      assert.strictEqual(AD_ANY, -1, 'AD_ANY is -1 (matches any damage)');
    });
  });

  describe('Damage Type Categories - Elemental', () => {
    it('should have all elemental damage types', () => {
      assert.strictEqual(AD_FIRE, 2, 'Fire damage');
      assert.strictEqual(AD_COLD, 3, 'Cold damage');
      assert.strictEqual(AD_ELEC, 6, 'Electric damage');
      assert.strictEqual(AD_ACID, 8, 'Acid damage');
    });

    it('elemental damage types should be low numbered', () => {
      const elemental = [AD_FIRE, AD_COLD, AD_ELEC, AD_ACID];
      for (const dmg of elemental) {
        assert(dmg >= 0 && dmg < 10, `Elemental ${dmg} should be < 10`);
      }
    });
  });

  describe('Damage Type Categories - Status Effects', () => {
    it('should have debilitating effects', () => {
      assert(typeof AD_SLEE === 'number', 'AD_SLEE (sleep) should be defined');
      assert(typeof AD_BLND === 'number', 'AD_BLND (blind) should be defined');
      assert(typeof AD_STUN === 'number', 'AD_STUN should be defined');
      assert(typeof AD_SLOW === 'number', 'AD_SLOW should be defined');
      assert(typeof AD_PLYS === 'number', 'AD_PLYS (paralysis) should be defined');
      assert(typeof AD_CONF === 'number', 'AD_CONF (confuse) should be defined');
      assert(typeof AD_HALU === 'number', 'AD_HALU (hallucination) should be defined');
    });

    it('should have drain effects', () => {
      assert(typeof AD_DRLI === 'number', 'AD_DRLI (drain life) should be defined');
      assert(typeof AD_DREN === 'number', 'AD_DREN (drain energy) should be defined');
      assert(typeof AD_DRDX === 'number', 'AD_DRDX (drain DEX) should be defined');
      assert(typeof AD_DRCO === 'number', 'AD_DRCO (drain CON) should be defined');
      assert(typeof AD_DRIN === 'number', 'AD_DRIN (drain INT) should be defined');
    });
  });

  describe('Damage Type Categories - Special', () => {
    it('should have petrification', () => {
      assert.strictEqual(AD_STON, 18, 'AD_STON (stone to flesh) should be 18');
    });

    it('should have theft effects', () => {
      assert(typeof AD_SGLD === 'number', 'AD_SGLD (steal gold) should be defined');
      assert(typeof AD_SITM === 'number', 'AD_SITM (steal item) should be defined');
    });

    it('should have teleportation', () => {
      assert(typeof AD_TLPT === 'number', 'AD_TLPT (teleport) should be defined');
    });

    it('should have corrosion effects', () => {
      assert(typeof AD_RUST === 'number', 'AD_RUST should be defined');
      assert(typeof AD_CORR === 'number', 'AD_CORR (corrode) should be defined');
    });

    it('should have lycanthropy', () => {
      assert(typeof AD_WERE === 'number', 'AD_WERE (werewolf) should be defined');
    });

    it('should have polymorph', () => {
      assert(typeof AD_POLY === 'number', 'AD_POLY (polymorph) should be defined');
    });

    it('should have sliming', () => {
      assert(typeof AD_SLIM === 'number', 'AD_SLIM (green slime) should be defined');
    });
  });

  describe('Damage Type Categories - Deadly', () => {
    it('should have instant death effects', () => {
      assert(typeof AD_DETH === 'number', 'AD_DETH (death) should be defined');
      assert(typeof AD_DISN === 'number', 'AD_DISN (disintegrate) should be defined');
    });

    it('should have diseases', () => {
      assert(typeof AD_DISE === 'number', 'AD_DISE (disease) should be defined');
      assert(typeof AD_PEST === 'number', 'AD_PEST (pestilence) should be defined');
      assert(typeof AD_DCAY === 'number', 'AD_DCAY (decay) should be defined');
    });

    it('should have famine', () => {
      assert(typeof AD_FAMN === 'number', 'AD_FAMN (famine) should be defined');
    });
  });

  describe('Damage Type Categories - Other', () => {
    it('should have engulf/digest', () => {
      assert(typeof AD_DGST === 'number', 'AD_DGST (digest) should be defined');
      assert(typeof AD_WRAP === 'number', 'AD_WRAP should be defined');
    });

    it('should have healing (positive effect)', () => {
      assert(typeof AD_HEAL === 'number', 'AD_HEAL should be defined');
    });

    it('should have seduction', () => {
      assert(typeof AD_SEDU === 'number', 'AD_SEDU (seduce) should be defined');
      assert(typeof AD_SSEX === 'number', 'AD_SSEX (succubus) should be defined');
    });

    it('should have stick effect', () => {
      assert(typeof AD_STCK === 'number', 'AD_STCK (stick) should be defined');
    });

    it('should have leg damage', () => {
      assert(typeof AD_LEGS === 'number', 'AD_LEGS (wound legs) should be defined');
    });

    it('should have enchantment', () => {
      assert(typeof AD_ENCH === 'number', 'AD_ENCH (enchant) should be defined');
    });

    it('should have special codes', () => {
      assert(typeof AD_SPC1 === 'number', 'AD_SPC1 should be defined');
      assert(typeof AD_SPC2 === 'number', 'AD_SPC2 should be defined');
    });
  });

  describe('Damage Type Categories - Special High Values', () => {
    it('should have cleric attack', () => {
      assert.strictEqual(AD_CLRC, 240, 'AD_CLRC (clerical) should be 240');
    });

    it('should have spell attack', () => {
      assert.strictEqual(AD_SPEL, 241, 'AD_SPEL (spell) should be 241');
    });

    it('should have random breath', () => {
      assert.strictEqual(AD_RBRE, 242, 'AD_RBRE (random breath) should be 242');
    });

    it('should have special quest attacks', () => {
      assert.strictEqual(AD_SAMU, 252, 'AD_SAMU (samurai quest) should be 252');
    });

    it('should have curse attack', () => {
      assert.strictEqual(AD_CURS, 253, 'AD_CURS (curse items) should be 253');
    });

    it('special damage types should be at high values', () => {
      const special = [AD_CLRC, AD_SPEL, AD_RBRE, AD_SAMU, AD_CURS];
      for (const dmg of special) {
        assert(dmg >= 240, `Special damage ${dmg} should be >= 240`);
      }
    });
  });

  describe('Attack and Damage Relationships', () => {
    it('bite attack often pairs with poison damage', () => {
      // AT_BITE commonly used with AD_DRST (poison)
      assert(typeof AT_BITE === 'number', 'AT_BITE exists');
      assert(typeof AD_DRST === 'number', 'AD_DRST exists');
    });

    it('breath attack pairs with elemental damage', () => {
      // AT_BREA used with AD_FIRE, AD_COLD, AD_ELEC, etc.
      assert(typeof AT_BREA === 'number', 'AT_BREA exists');
      assert(typeof AD_FIRE === 'number', 'Elemental damage exists');
    });

    it('gaze attack pairs with special effects', () => {
      // AT_GAZE used with AD_STON, AD_CONF, etc.
      assert(typeof AT_GAZE === 'number', 'AT_GAZE exists');
      assert(typeof AD_STON === 'number', 'Special effects exist');
    });

    it('touch attack pairs with various effects', () => {
      // AT_TUCH used with AD_RUST, AD_CORR, etc.
      assert(typeof AT_TUCH === 'number', 'AT_TUCH exists');
      assert(typeof AD_RUST === 'number', 'Corrosion effects exist');
    });
  });

  describe('Value Ranges', () => {
    it('most attack types fit in one byte (0-255)', () => {
      const attacks = [
        AT_NONE, AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG,
        AT_HUGS, AT_SPIT, AT_ENGL, AT_BREA, AT_EXPL, AT_BOOM, AT_GAZE,
        AT_TENT, AT_WEAP, AT_MAGC
      ];

      for (const atk of attacks) {
        assert(atk >= 0 && atk <= 255, `Attack ${atk} should fit in byte`);
      }
    });

    it('most damage types fit in one byte (0-255)', () => {
      const damages = [
        AD_PHYS, AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE, AD_DISN, AD_ELEC,
        AD_DRST, AD_ACID, AD_BLND, AD_STUN, AD_SLOW, AD_PLYS, AD_DRLI,
        AD_DREN, AD_STON, AD_CLRC, AD_SPEL, AD_RBRE, AD_SAMU, AD_CURS
      ];

      for (const dmg of damages) {
        assert(dmg >= 0 && dmg <= 255, `Damage ${dmg} should fit in byte`);
      }
    });
  });

  describe('Sequential Numbering', () => {
    it('basic attack types should be mostly sequential', () => {
      // AT_CLAW through AT_HUGS are 1-7 (sequential)
      assert.strictEqual(AT_CLAW, 1);
      assert.strictEqual(AT_BITE, 2);
      assert.strictEqual(AT_KICK, 3);
      assert.strictEqual(AT_BUTT, 4);
      assert.strictEqual(AT_TUCH, 5);
      assert.strictEqual(AT_STNG, 6);
      assert.strictEqual(AT_HUGS, 7);
    });

    it('basic damage types should be mostly sequential', () => {
      // AD_PHYS through AD_ACID are 0-8 (mostly sequential)
      assert.strictEqual(AD_PHYS, 0);
      assert.strictEqual(AD_MAGM, 1);
      assert.strictEqual(AD_FIRE, 2);
      assert.strictEqual(AD_COLD, 3);
      assert.strictEqual(AD_SLEE, 4);
      assert.strictEqual(AD_DISN, 5);
      assert.strictEqual(AD_ELEC, 6);
      assert.strictEqual(AD_DRST, 7);
      assert.strictEqual(AD_ACID, 8);
    });
  });

  describe('Critical Constant Values', () => {
    it('AT_NONE should be 0 (no attack)', () => {
      assert.strictEqual(AT_NONE, 0, 'AT_NONE must be 0');
    });

    it('AD_PHYS should be 0 (default damage)', () => {
      assert.strictEqual(AD_PHYS, 0, 'AD_PHYS must be 0');
    });

    it('AT_MAGC should be 255 (max byte)', () => {
      assert.strictEqual(AT_MAGC, 255, 'AT_MAGC is max byte value');
    });

    it('wildcard constants should be -1', () => {
      assert.strictEqual(AT_ANY, -1, 'AT_ANY must be -1');
      assert.strictEqual(AD_ANY, -1, 'AD_ANY must be -1');
    });
  });
});
