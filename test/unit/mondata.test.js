// mondata.test.js — Unit tests for new mondata.js exported functions
// Tests: dmgtype_fromattack, dmgtype, noattacks, ranged_attk,
//        hates_silver, hates_blessings, mon_hates_silver, mon_hates_blessings,
//        sticks, cantvomit, num_horns, sliparm, breakarm,
//        haseyes, hates_light, mon_hates_light, poly_when_stoned, can_track,
//        can_blow, can_chant, can_be_strangled,
//        little_to_big, big_to_little, big_little_match, same_race,
//        is_mind_flayer, is_unicorn, is_rider, is_longworm

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    dmgtype_fromattack, dmgtype,
    noattacks, ranged_attk,
    hates_silver, hates_blessings,
    mon_hates_silver, mon_hates_blessings,
    sticks, cantvomit, num_horns,
    sliparm, breakarm,
    haseyes, hates_light, mon_hates_light,
    poly_when_stoned, can_track,
    can_blow, can_chant, can_be_strangled,
    little_to_big, big_to_little, big_little_match, same_race,
    is_mind_flayer, is_unicorn, is_rider, is_longworm,
} from '../../js/mondata.js';
import {
    mons,
    PM_LITTLE_DOG, PM_DOG, PM_LARGE_DOG,
    PM_WEREWOLF, PM_VAMPIRE, PM_SHADE, PM_TENGU,
    PM_ROCK_MOLE, PM_WOODCHUCK, PM_HORSE, PM_WARHORSE,
    PM_WHITE_UNICORN, PM_GRAY_UNICORN, PM_BLACK_UNICORN, PM_KI_RIN,
    PM_HORNED_DEVIL, PM_MINOTAUR, PM_ASMODEUS, PM_BALROG,
    PM_GAS_SPORE, PM_GREMLIN, PM_STONE_GOLEM, PM_IRON_GOLEM,
    PM_KILLER_BEE,
    PM_MIND_FLAYER, PM_MASTER_MIND_FLAYER,
    PM_DEATH, PM_FAMINE, PM_PESTILENCE,
    PM_LONG_WORM, PM_LONG_WORM_TAIL, PM_BABY_LONG_WORM,
    PM_PONY,
    PM_ELF, PM_GREY_ELF, PM_ELF_NOBLE,
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

// ========================================================================
// haseyes
// ========================================================================

describe('haseyes', () => {
    it('returns true for little dog (has eyes)', () => {
        assert.equal(haseyes(mons[PM_LITTLE_DOG]), true);
    });

    it('returns true for human (has eyes)', () => {
        // mons[183] = lich (has eyes as an ex-human)
        assert.equal(haseyes(mons[183]), true);
    });

    it('returns false for quivering blob (PM_QUIVERING_BLOB — M1_NOEYES)', () => {
        // quivering blob has M1_NOEYES (gas spore does not — it IS an eye type)
        assert.equal(haseyes(mons[7]), false); // PM_QUIVERING_BLOB = 7
    });
});

// ========================================================================
// hates_light / mon_hates_light
// ========================================================================

describe('hates_light', () => {
    it('returns true for gremlin (only light-hating monster)', () => {
        assert.equal(hates_light(mons[PM_GREMLIN]), true);
    });

    it('returns false for little dog', () => {
        assert.equal(hates_light(mons[PM_LITTLE_DOG]), false);
    });

    it('returns false for vampire (not PM_GREMLIN)', () => {
        assert.equal(hates_light(mons[PM_VAMPIRE]), false);
    });
});

describe('mon_hates_light', () => {
    it('returns true for a gremlin monster instance', () => {
        const mon = { mnum: PM_GREMLIN };
        assert.equal(mon_hates_light(mon), true);
    });

    it('returns false for a little dog monster instance', () => {
        const mon = { mnum: PM_LITTLE_DOG };
        assert.equal(mon_hates_light(mon), false);
    });
});

// ========================================================================
// poly_when_stoned
// ========================================================================

describe('poly_when_stoned', () => {
    it('returns true for iron golem (golem, not stone golem)', () => {
        assert.equal(poly_when_stoned(mons[PM_IRON_GOLEM]), true);
    });

    it('returns false for stone golem itself', () => {
        assert.equal(poly_when_stoned(mons[PM_STONE_GOLEM]), false);
    });

    it('returns false for little dog (not a golem)', () => {
        assert.equal(poly_when_stoned(mons[PM_LITTLE_DOG]), false);
    });
});

// ========================================================================
// can_track
// ========================================================================

describe('can_track', () => {
    it('returns true for little dog (has eyes)', () => {
        assert.equal(can_track(mons[PM_LITTLE_DOG]), true);
    });

    it('returns false for quivering blob (no eyes, no Excalibur)', () => {
        assert.equal(can_track(mons[7]), false); // PM_QUIVERING_BLOB
    });

    it('returns true for quivering blob when wieldsExcalibur=true', () => {
        assert.equal(can_track(mons[7], true), true); // PM_QUIVERING_BLOB
    });

    it('returns true for gremlin (has eyes)', () => {
        assert.equal(can_track(mons[PM_GREMLIN]), true);
    });
});

// ========================================================================
// can_blow
// ========================================================================

describe('can_blow', () => {
    it('returns true for little dog (has sound, has head, not breathless)', () => {
        assert.equal(can_blow(mons[PM_LITTLE_DOG]), true);
    });

    it('returns false for acid blob (MS_SILENT + M1_BREATHLESS)', () => {
        // acid blob is silent and breathless — can_blow returns false
        assert.equal(can_blow(mons[6]), false); // PM_ACID_BLOB = 6
    });

    it('returns false for killer bee (MS_BUZZ + MZ_TINY)', () => {
        // killer bee: MS_BUZZ and verysmall (MZ_TINY) — can_blow returns false
        assert.equal(can_blow(mons[PM_KILLER_BEE]), false);
    });

    it('returns false when isStrangled=true even for little dog', () => {
        assert.equal(can_blow(mons[PM_LITTLE_DOG], true), false);
    });
});

// ========================================================================
// can_chant
// ========================================================================

describe('can_chant', () => {
    it('returns true for little dog (has sound, has head, not silent)', () => {
        assert.equal(can_chant(mons[PM_LITTLE_DOG]), true);
    });

    it('returns false for acid blob (MS_SILENT)', () => {
        assert.equal(can_chant(mons[6]), false); // PM_ACID_BLOB = 6
    });

    it('returns false for killer bee (MS_BUZZ)', () => {
        assert.equal(can_chant(mons[PM_KILLER_BEE]), false);
    });

    it('returns false when isStrangled=true even for little dog', () => {
        assert.equal(can_chant(mons[PM_LITTLE_DOG], true), false);
    });

    it('returns false for quivering blob (MS_SILENT, M1_NOHEAD)', () => {
        assert.equal(can_chant(mons[7]), false); // PM_QUIVERING_BLOB = 7
    });
});

// ========================================================================
// can_be_strangled
// ========================================================================

describe('can_be_strangled', () => {
    it('returns true for little dog (has head, not mindless, not breathless)', () => {
        assert.equal(can_be_strangled(mons[PM_LITTLE_DOG]), true);
    });

    it('returns false for acid blob (M1_NOHEAD)', () => {
        // acid blob has M1_NOHEAD — no head means no strangulation
        assert.equal(can_be_strangled(mons[6]), false); // PM_ACID_BLOB = 6
    });

    it('returns false for quivering blob (M1_NOHEAD)', () => {
        assert.equal(can_be_strangled(mons[7]), false); // PM_QUIVERING_BLOB = 7
    });

    it('returns true for killer bee (has head, not mindless, not breathless)', () => {
        // killer bee has no M1_NOHEAD, no M1_MINDLESS, no M1_BREATHLESS
        assert.equal(can_be_strangled(mons[PM_KILLER_BEE]), true);
    });

    it('returns true for werewolf (mindless=false, breathless=false, has head)', () => {
        // werewolf is not mindless nor breathless — can be strangled
        assert.equal(can_be_strangled(mons[PM_WEREWOLF]), true);
    });
});

// ========================================================================
// is_mind_flayer, is_unicorn, is_rider, is_longworm
// ========================================================================

describe('is_mind_flayer', () => {
    it('returns true for mind flayer', () => {
        assert.equal(is_mind_flayer(mons[PM_MIND_FLAYER]), true);
    });
    it('returns true for master mind flayer', () => {
        assert.equal(is_mind_flayer(mons[PM_MASTER_MIND_FLAYER]), true);
    });
    it('returns false for little dog', () => {
        assert.equal(is_mind_flayer(mons[PM_LITTLE_DOG]), false);
    });
});

describe('is_unicorn', () => {
    it('returns true for white unicorn (S_UNICORN + likes_gems)', () => {
        assert.equal(is_unicorn(mons[PM_WHITE_UNICORN]), true);
    });
    it('returns true for gray unicorn (S_UNICORN + likes_gems)', () => {
        assert.equal(is_unicorn(mons[PM_GRAY_UNICORN]), true);
    });
    it('returns false for ki-rin (S_ANGEL, not S_UNICORN)', () => {
        // ki-rin is classified as S_ANGEL in monsters.js — not S_UNICORN
        assert.equal(is_unicorn(mons[PM_KI_RIN]), false);
    });
    it('returns false for little dog', () => {
        assert.equal(is_unicorn(mons[PM_LITTLE_DOG]), false);
    });
});

describe('is_rider', () => {
    it('returns true for Death', () => {
        assert.equal(is_rider(mons[PM_DEATH]), true);
    });
    it('returns true for Famine', () => {
        assert.equal(is_rider(mons[PM_FAMINE]), true);
    });
    it('returns true for Pestilence', () => {
        assert.equal(is_rider(mons[PM_PESTILENCE]), true);
    });
    it('returns false for little dog', () => {
        assert.equal(is_rider(mons[PM_LITTLE_DOG]), false);
    });
});

describe('is_longworm', () => {
    it('returns true for long worm', () => {
        assert.equal(is_longworm(mons[PM_LONG_WORM]), true);
    });
    it('returns true for baby long worm', () => {
        assert.equal(is_longworm(mons[PM_BABY_LONG_WORM]), true);
    });
    it('returns true for long worm tail', () => {
        assert.equal(is_longworm(mons[PM_LONG_WORM_TAIL]), true);
    });
    it('returns false for little dog', () => {
        assert.equal(is_longworm(mons[PM_LITTLE_DOG]), false);
    });
});

// ========================================================================
// little_to_big, big_to_little, big_little_match
// ========================================================================

describe('little_to_big', () => {
    it('returns PM_DOG for PM_LITTLE_DOG', () => {
        assert.equal(little_to_big(PM_LITTLE_DOG), PM_DOG);
    });
    it('returns PM_LARGE_DOG for PM_DOG', () => {
        assert.equal(little_to_big(PM_DOG), PM_LARGE_DOG);
    });
    it('returns PM_WARHORSE for PM_HORSE', () => {
        assert.equal(little_to_big(PM_HORSE), PM_WARHORSE);
    });
    it('returns same index for PM_WARHORSE (no grown-up form)', () => {
        assert.equal(little_to_big(PM_WARHORSE), PM_WARHORSE);
    });
    it('returns PM_ELF_NOBLE for PM_GREY_ELF', () => {
        assert.equal(little_to_big(PM_GREY_ELF), PM_ELF_NOBLE);
    });
});

describe('big_to_little', () => {
    it('returns PM_LITTLE_DOG for PM_DOG', () => {
        assert.equal(big_to_little(PM_DOG), PM_LITTLE_DOG);
    });
    it('returns PM_DOG for PM_LARGE_DOG', () => {
        assert.equal(big_to_little(PM_LARGE_DOG), PM_DOG);
    });
    it('returns PM_PONY for PM_HORSE', () => {
        assert.equal(big_to_little(PM_HORSE), PM_PONY);
    });
    it('returns same index for PM_LITTLE_DOG (no juvenile form)', () => {
        assert.equal(big_to_little(PM_LITTLE_DOG), PM_LITTLE_DOG);
    });
});

describe('big_little_match', () => {
    it('returns true for PM_LITTLE_DOG and PM_DOG (direct growth)', () => {
        assert.equal(big_little_match(PM_LITTLE_DOG, PM_DOG), true);
    });
    it('returns true for PM_LITTLE_DOG and PM_LARGE_DOG (two-step growth)', () => {
        assert.equal(big_little_match(PM_LITTLE_DOG, PM_LARGE_DOG), true);
    });
    it('returns true for same index', () => {
        assert.equal(big_little_match(PM_LITTLE_DOG, PM_LITTLE_DOG), true);
    });
    it('returns false for little dog and horse (different symbol classes)', () => {
        assert.equal(big_little_match(PM_LITTLE_DOG, PM_HORSE), false);
    });
});

// ========================================================================
// same_race
// ========================================================================

describe('same_race', () => {
    it('returns true for same monster', () => {
        assert.equal(same_race(mons[PM_LITTLE_DOG], mons[PM_LITTLE_DOG]), true);
    });

    it('returns true for two elves (is_elf branch)', () => {
        // all elves have M2_ELF
        assert.equal(same_race(mons[PM_ELF], mons[PM_GREY_ELF]), true);
    });

    it('returns false for elf and little dog', () => {
        assert.equal(same_race(mons[PM_ELF], mons[PM_LITTLE_DOG]), false);
    });

    it('returns true for mind flayer and master mind flayer', () => {
        assert.equal(same_race(mons[PM_MIND_FLAYER], mons[PM_MASTER_MIND_FLAYER]), true);
    });

    it('returns true for two unicorns', () => {
        assert.equal(same_race(mons[PM_WHITE_UNICORN], mons[PM_GRAY_UNICORN]), true);
    });

    it('returns true for Death and Famine (both riders)', () => {
        assert.equal(same_race(mons[PM_DEATH], mons[PM_FAMINE]), true);
    });

    it('returns false for Death and little dog', () => {
        assert.equal(same_race(mons[PM_DEATH], mons[PM_LITTLE_DOG]), false);
    });

    it('returns true for little dog and large dog (grow-up chain)', () => {
        assert.equal(same_race(mons[PM_LITTLE_DOG], mons[PM_LARGE_DOG]), true);
    });

    it('returns false for tengu and imp (tengu exception)', () => {
        // tengu is S_IMP but does not match imps
        assert.equal(same_race(mons[PM_TENGU], mons[PM_TENGU - 1]), false);
    });
});
