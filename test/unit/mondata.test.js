// mondata.test.js — Unit tests for new mondata.js exported functions
// Tests: dmgtype_fromattack, dmgtype, noattacks, ranged_attk,
//        hates_silver, hates_blessings, mon_hates_silver, mon_hates_blessings,
//        sticks, cantvomit, num_horns, sliparm, breakarm

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    dmgtype_fromattack, dmgtype,
    noattacks, ranged_attk,
    hates_silver, hates_blessings,
    mon_hates_silver, mon_hates_blessings,
    sticks, cantvomit, num_horns,
    sliparm, breakarm,
} from '../../js/mondata.js';
import {
    mons,
    PM_LITTLE_DOG, PM_WEREWOLF, PM_VAMPIRE, PM_SHADE, PM_TENGU,
    PM_ROCK_MOLE, PM_WOODCHUCK, PM_HORSE, PM_WARHORSE,
    PM_WHITE_UNICORN, PM_GRAY_UNICORN, PM_BLACK_UNICORN, PM_KI_RIN,
    PM_HORNED_DEVIL, PM_MINOTAUR, PM_ASMODEUS, PM_BALROG,
    PM_GAS_SPORE,
    AT_CLAW, AT_BITE,
    AD_STCK, AD_FIRE,
} from '../../js/monsters.js';

// ========================================================================
// noattacks
// ========================================================================

describe('noattacks', () => {
    it('returns true for gas spore (only AT_BOOM passive attack)', () => {
        // gas spore has only AT_BOOM which is a passive death explosion
        assert.equal(noattacks(mons[PM_GAS_SPORE]), true);
    });

    it('returns true for acid blob (all AT_NONE attacks)', () => {
        // acid blob has type:0 (AT_NONE) attacks — no active attack
        assert.equal(noattacks(mons[6]), true);
    });

    it('returns false for little dog (has AT_BITE)', () => {
        assert.equal(noattacks(mons[PM_LITTLE_DOG]), false);
    });
});

// ========================================================================
// dmgtype_fromattack and dmgtype
// ========================================================================

describe('dmgtype_fromattack', () => {
    it('returns true for large mimic with AD_STCK from AT_CLAW', () => {
        // large mimic (mons[65]) has AT_CLAW with AD_STCK damage
        assert.equal(dmgtype_fromattack(mons[65], AD_STCK, AT_CLAW), true);
    });

    it('returns false for large mimic with AD_STCK from AT_BITE (wrong attack type)', () => {
        assert.equal(dmgtype_fromattack(mons[65], AD_STCK, AT_BITE), false);
    });

    it('returns false for little dog with AD_STCK', () => {
        assert.equal(dmgtype_fromattack(mons[PM_LITTLE_DOG], AD_STCK, AT_CLAW), false);
    });
});

describe('dmgtype', () => {
    it('returns true for large mimic with AD_STCK (sticking damage)', () => {
        assert.equal(dmgtype(mons[65], AD_STCK), true);
    });

    it('returns false for little dog with AD_STCK', () => {
        assert.equal(dmgtype(mons[PM_LITTLE_DOG], AD_STCK), false);
    });

    it('returns false for little dog with AD_FIRE', () => {
        assert.equal(dmgtype(mons[PM_LITTLE_DOG], AD_FIRE), false);
    });
});

// ========================================================================
// ranged_attk
// ========================================================================

describe('ranged_attk', () => {
    it('returns true for winter wolf cub (has AT_BREA breath attack)', () => {
        // mons[22] = winter wolf cub, has AT_BREA
        assert.equal(ranged_attk(mons[22]), true);
    });

    it('returns false for little dog (melee only)', () => {
        assert.equal(ranged_attk(mons[PM_LITTLE_DOG]), false);
    });

    it('returns false for large mimic (claw only)', () => {
        assert.equal(ranged_attk(mons[65]), false);
    });
});

// ========================================================================
// hates_silver
// ========================================================================

describe('hates_silver', () => {
    it('returns true for werewolf (M2_WERE flag)', () => {
        assert.equal(hates_silver(mons[PM_WEREWOLF]), true);
    });

    it('returns true for vampire (S_VAMPIRE symbol)', () => {
        assert.equal(hates_silver(mons[PM_VAMPIRE]), true);
    });

    it('returns true for shade (specific PM_SHADE identity)', () => {
        assert.equal(hates_silver(mons[PM_SHADE]), true);
    });

    it('returns false for tengu (S_IMP symbol but is PM_TENGU exception)', () => {
        assert.equal(hates_silver(mons[PM_TENGU]), false);
    });

    it('returns false for little dog', () => {
        assert.equal(hates_silver(mons[PM_LITTLE_DOG]), false);
    });
});

// ========================================================================
// hates_blessings
// ========================================================================

describe('hates_blessings', () => {
    it('returns true for lich (M2_UNDEAD)', () => {
        // mons[183] = lich, is undead
        assert.equal(hates_blessings(mons[183]), true);
    });

    it('returns false for little dog', () => {
        assert.equal(hates_blessings(mons[PM_LITTLE_DOG]), false);
    });
});

// ========================================================================
// mon_hates_silver / mon_hates_blessings
// ========================================================================

describe('mon_hates_silver', () => {
    it('returns true for a werewolf monster instance', () => {
        const mon = { mnum: PM_WEREWOLF };
        assert.equal(mon_hates_silver(mon), true);
    });

    it('returns false for a little dog monster instance', () => {
        const mon = { mnum: PM_LITTLE_DOG };
        assert.equal(mon_hates_silver(mon), false);
    });

    it('returns false for a monster with no mnum', () => {
        const mon = {};
        assert.equal(mon_hates_silver(mon), false);
    });
});

describe('mon_hates_blessings', () => {
    it('returns true for a lich monster instance', () => {
        const mon = { mnum: 183 }; // lich
        assert.equal(mon_hates_blessings(mon), true);
    });

    it('returns false for a little dog monster instance', () => {
        const mon = { mnum: PM_LITTLE_DOG };
        assert.equal(mon_hates_blessings(mon), false);
    });
});

// ========================================================================
// sticks
// ========================================================================

describe('sticks', () => {
    it('returns true for large mimic (has AD_STCK damage)', () => {
        assert.equal(sticks(mons[65]), true);
    });

    it('returns true for python (has AT_HUGS)', () => {
        // mons[217] = python, has AT_HUGS
        assert.equal(sticks(mons[217]), true);
    });

    it('returns false for little dog', () => {
        assert.equal(sticks(mons[PM_LITTLE_DOG]), false);
    });
});

// ========================================================================
// cantvomit
// ========================================================================

describe('cantvomit', () => {
    it('returns true for sewer rat (S_RODENT, not rock mole or woodchuck)', () => {
        // mons[88] = sewer rat
        assert.equal(cantvomit(mons[88]), true);
    });

    it('returns false for rock mole (S_RODENT but is PM_ROCK_MOLE exception)', () => {
        assert.equal(cantvomit(mons[PM_ROCK_MOLE]), false);
    });

    it('returns false for woodchuck (S_RODENT but is PM_WOODCHUCK exception)', () => {
        assert.equal(cantvomit(mons[PM_WOODCHUCK]), false);
    });

    it('returns true for warhorse (PM_WARHORSE)', () => {
        assert.equal(cantvomit(mons[PM_WARHORSE]), true);
    });

    it('returns true for horse (PM_HORSE)', () => {
        assert.equal(cantvomit(mons[PM_HORSE]), true);
    });

    it('returns false for little dog', () => {
        assert.equal(cantvomit(mons[PM_LITTLE_DOG]), false);
    });
});

// ========================================================================
// num_horns
// ========================================================================

describe('num_horns', () => {
    it('returns 1 for white unicorn', () => {
        assert.equal(num_horns(mons[PM_WHITE_UNICORN]), 1);
    });

    it('returns 1 for gray unicorn', () => {
        assert.equal(num_horns(mons[PM_GRAY_UNICORN]), 1);
    });

    it('returns 1 for black unicorn', () => {
        assert.equal(num_horns(mons[PM_BLACK_UNICORN]), 1);
    });

    it('returns 1 for ki-rin', () => {
        assert.equal(num_horns(mons[PM_KI_RIN]), 1);
    });

    it('returns 2 for minotaur', () => {
        assert.equal(num_horns(mons[PM_MINOTAUR]), 2);
    });

    it('returns 2 for horned devil', () => {
        assert.equal(num_horns(mons[PM_HORNED_DEVIL]), 2);
    });

    it('returns 2 for Asmodeus', () => {
        assert.equal(num_horns(mons[PM_ASMODEUS]), 2);
    });

    it('returns 2 for Balrog', () => {
        assert.equal(num_horns(mons[PM_BALROG]), 2);
    });

    it('returns 0 for little dog', () => {
        assert.equal(num_horns(mons[PM_LITTLE_DOG]), 0);
    });
});

// ========================================================================
// sliparm
// ========================================================================

describe('sliparm', () => {
    it('returns true for acid blob (MZ_TINY, size <= MZ_SMALL)', () => {
        // mons[6] = acid blob, size=0=MZ_TINY
        assert.equal(sliparm(mons[6]), true);
    });

    it('returns true for little dog (MZ_SMALL, size <= MZ_SMALL)', () => {
        // little dog has size=1=MZ_SMALL
        assert.equal(sliparm(mons[PM_LITTLE_DOG]), true);
    });

    it('returns true for shade (S_GHOST symbol = noncorporeal)', () => {
        assert.equal(sliparm(mons[PM_SHADE]), true);
    });

    it('returns false for minotaur (large humanoid, not ghost/vortex)', () => {
        // minotaur has size=3=MZ_LARGE > MZ_SMALL
        assert.equal(sliparm(mons[PM_MINOTAUR]), false);
    });
});

// ========================================================================
// breakarm
// ========================================================================

describe('breakarm', () => {
    it('returns true for large mimic (MZ_LARGE, bigmonst)', () => {
        // large mimic: not sliparm (size=3>MZ_SMALL, not ghost), bigmonst (size>=MZ_LARGE)
        assert.equal(breakarm(mons[65]), true);
    });

    it('returns false for acid blob (sliparm is true, so breakarm false)', () => {
        assert.equal(breakarm(mons[6]), false);
    });

    it('returns false for little dog (sliparm is true, size=MZ_SMALL)', () => {
        assert.equal(breakarm(mons[PM_LITTLE_DOG]), false);
    });

    it('returns true for minotaur (MZ_LARGE, bigmonst)', () => {
        assert.equal(breakarm(mons[PM_MINOTAUR]), true);
    });
});
