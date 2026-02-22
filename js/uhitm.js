// uhitm.js -- Hero-vs-monster combat
// cf. uhitm.c — attack validation, to-hit/damage, damage-type handlers,
// engulfment, passive defense, mimic discovery, light attacks

import { rn2, rnd, d, c_d } from './rng.js';
import { exercise } from './attrib_exercise.js';
import { corpse_chance } from './mon.js';
import { A_DEX } from './config.js';
import {
    G_FREQ, G_NOCORPSE, MZ_TINY, MZ_HUMAN, MZ_LARGE, M2_COLLECT,
    S_ZOMBIE, S_MUMMY, S_VAMPIRE, S_WRAITH, S_LICH, S_GHOST, S_DEMON, S_KOP,
    PM_SHADE,
    AD_PHYS, AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE, AD_DISN, AD_ELEC,
    AD_DRST, AD_ACID, AD_BLND, AD_STUN, AD_SLOW, AD_PLYS, AD_DRLI,
    AD_DREN, AD_LEGS, AD_STON, AD_STCK, AD_SGLD, AD_SITM, AD_SEDU,
    AD_TLPT, AD_RUST, AD_CONF, AD_DGST, AD_HEAL, AD_WRAP, AD_WERE,
    AD_DRDX, AD_DRCO, AD_DRIN, AD_DISE, AD_DCAY, AD_SSEX, AD_HALU,
    AD_DETH, AD_PEST, AD_FAMN, AD_SLIM, AD_ENCH, AD_CORR, AD_POLY,
    AD_SAMU, AD_CURS,
    AT_WEAP, AT_CLAW, AT_KICK, AT_BITE, AT_TUCH, AT_BUTT, AT_STNG,
    AT_HUGS, AT_TENT,
} from './monsters.js';
import {
    CORPSE, FIGURINE, FOOD_CLASS, objectData,
    POTION_CLASS, POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING,
    POT_RESTORE_ABILITY, POT_GAIN_ABILITY,
} from './objects.js';
import { mkobj, mkcorpstat, RANDOM_CLASS, next_ident, xname } from './mkobj.js';
import {
    nonliving, monDisplayName, is_undead, is_demon,
    magic_negation,
    resists_fire, resists_cold, resists_elec, resists_acid,
    resists_poison, resists_sleep, resists_ston,
    thick_skinned,
} from './mondata.js';
import { obj_resists } from './objdata.js';
import { newexplevel } from './exper.js';
import { applyMonflee } from './mhitu.js';
import { mondead } from './monutil.js';
import { placeFloorObject } from './floor_objects.js';
import { uwepgone, uswapwepgone, uqwepgone } from './wield.js';


// ============================================================================
// 1. Magic negation and attack result constants
// ============================================================================

// C ref: monattk.h — monster-to-monster attack result bitmask
export const M_ATTK_MISS = 0x0;
export const M_ATTK_HIT = 0x1;
export const M_ATTK_DEF_DIED = 0x2;
export const M_ATTK_AGR_DIED = 0x4;
export const M_ATTK_AGR_DONE = 0x8;

// cf. uhitm.c:74 — mhitm_mgc_atk_negated(magr, mdef, verbosely):
//   Check if a magical attack is negated by target's magic cancellation.
//   Consumes rn2(10) — RNG-critical.
//   Returns true if attack is negated.
export function mhitm_mgc_atk_negated(magr, mdef) {
    if (magr.mcan) return true;
    const armpro = magic_negation(mdef);
    const negated = !(rn2(10) >= 3 * armpro);
    return negated;
}


// ============================================================================
// 2. Attack validation
// ============================================================================

// cf. uhitm.c:103 — dynamic_multi_reason(mon, verb, by_gaze):
//   Build reason string for multi-turn delay after special attacks.
// TODO: uhitm.c:103 — dynamic_multi_reason()

// cf. uhitm.c:125 — erode_armor(mdef, hurt):
//   Erode target's armor from acid/rust/fire damage.
// TODO: uhitm.c:125 — erode_armor()

// cf. uhitm.c:188 — attack_checks(mtmp, wep):
//   Pre-attack validation: peaceful/tame checks, displacement, invisibility.
// TODO: uhitm.c:188 — attack_checks()

// cf. uhitm.c:330 — check_caitiff(mtmp):
//   Alignment penalty for attacking a fleeing monster.
// TODO: uhitm.c:330 — check_caitiff()

// cf. uhitm.c:350 — mon_maybe_unparalyze(mtmp):
//   Wake up paralyzed monster on being attacked.
// TODO: uhitm.c:350 — mon_maybe_unparalyze()

// cf. uhitm.c:364 — find_roll_to_hit(mtmp, aatyp, weapon, attknum):
//   Compute to-hit roll including level, luck, DEX, enchantment, monster state.
//   Partially implemented in playerAttackMonster() below.
// TODO: uhitm.c:364 — find_roll_to_hit(): full implementation

// cf. uhitm.c:431 — force_attack(mtmp, pets_too):
//   Force attack on a monster in the way (e.g. 'F' prefix).
// TODO: uhitm.c:431 — force_attack()

// cf. uhitm.c:447 — do_attack(mtmp):
//   Top-level attack dispatcher: checks, weapon selection, special cases.
//   Partially implemented via playerAttackMonster() below.
// TODO: uhitm.c:447 — do_attack(): full implementation


// ============================================================================
// 3. Core hit mechanics
// ============================================================================

// cf. uhitm.c:586 — known_hitum(mon, weapon, uattk, aression, roleession, mhit, rollneeded, dieroll):
//   Handle known-hit path: exercise, cleave, flee check after hit.
//   Flee/morale check partially implemented in playerAttackMonster() below.
// TODO: uhitm.c:586 — known_hitum(): full implementation

// cf. uhitm.c:650 — hitum_cleave(target, uattk):
//   Cleaving attack: hit adjacent monsters with two-handed weapon.
// TODO: uhitm.c:650 — hitum_cleave()

// cf. uhitm.c:735 — double_punch():
//   Check for martial arts double punch chance.
// TODO: uhitm.c:735 — double_punch()

// cf. uhitm.c:757 — hitum(mon, uattk):
//   Main melee hit routine: roll to-hit, call known_hitum or miss.
// TODO: uhitm.c:757 — hitum()

// cf. uhitm.c:818 — hmon(mon, obj, thrown, dieroll):
//   Wrapper for hmon_hitmon: applies object damage to monster.
// TODO: uhitm.c:818 — hmon()

// cf. uhitm.c:837 — hmon_hitmon_barehands(hmd, mon):
//   Bare-handed damage: martial arts, 1d2 base, skill bonuses.
// TODO: uhitm.c:837 — hmon_hitmon_barehands()

// cf. uhitm.c:884 — hmon_hitmon_weapon_ranged(hmd, mon, obj):
//   Ranged weapon used in melee: rnd(2) base damage.
// TODO: uhitm.c:884 — hmon_hitmon_weapon_ranged()

// cf. uhitm.c:919 — hmon_hitmon_weapon_melee(hmd, mon, obj):
//   Melee weapon damage: dmgval, enchantment, blessed vs undead, silver, etc.
// TODO: uhitm.c:919 — hmon_hitmon_weapon_melee()

// cf. uhitm.c:1048 — hmon_hitmon_weapon(hmd, mon, obj):
//   Dispatch weapon hit to ranged or melee sub-handler.
// TODO: uhitm.c:1048 — hmon_hitmon_weapon()

// cf. uhitm.c:1073 — hmon_hitmon_potion(hmd, mon, obj):
//   Potion used as melee weapon: potionhit() then 1 damage (0 vs shade).
//   Partially implemented in hitMonsterWithPotion() below.
// TODO: uhitm.c:1073 — hmon_hitmon_potion(): full implementation

// cf. uhitm.c:1097 — hmon_hitmon_misc_obj(hmd, mon, obj):
//   Miscellaneous object as weapon: cockatrice corpse, cream pie, etc.
// TODO: uhitm.c:1097 — hmon_hitmon_misc_obj()

// cf. uhitm.c:1365 — hmon_hitmon_do_hit(hmd, mon, obj):
//   Apply computed damage: subtract HP, handle death, generate messages.
// TODO: uhitm.c:1365 — hmon_hitmon_do_hit()

// cf. uhitm.c:1414 — hmon_hitmon_dmg_recalc(hmd, obj):
//   Recalculate damage after enchantment/bonus adjustments.
// TODO: uhitm.c:1414 — hmon_hitmon_dmg_recalc()

// cf. uhitm.c:1488 — hmon_hitmon_poison(hmd, mon, obj):
//   Apply poison from poisoned weapon to monster.
// TODO: uhitm.c:1488 — hmon_hitmon_poison()

// cf. uhitm.c:1519 — hmon_hitmon_jousting(hmd, mon, obj):
//   Jousting bonus damage with lance while riding.
// TODO: uhitm.c:1519 — hmon_hitmon_jousting()

// cf. uhitm.c:1548 — hmon_hitmon_stagger(hmd, mon, obj):
//   Stagger chance after strong unarmed hit (rnd(100)).
// TODO: uhitm.c:1548 — hmon_hitmon_stagger()

// cf. uhitm.c:1566 — hmon_hitmon_pet(hmd, mon, obj):
//   Adjust behavior when hitting a pet.
// TODO: uhitm.c:1566 — hmon_hitmon_pet()

// cf. uhitm.c:1582 — hmon_hitmon_splitmon(hmd, mon, obj):
//   Handle pudding splitting on hit.
// TODO: uhitm.c:1582 — hmon_hitmon_splitmon()

// cf. uhitm.c:1615 — hmon_hitmon_msg_hit(hmd, mon, obj):
//   Generate hit message ("You hit the <monster>").
// TODO: uhitm.c:1615 — hmon_hitmon_msg_hit()

// cf. uhitm.c:1641 — hmon_hitmon_msg_silver(hmd, mon, obj):
//   Silver damage message ("The silver sears the <monster>!").
// TODO: uhitm.c:1641 — hmon_hitmon_msg_silver()

// cf. uhitm.c:1680 — hmon_hitmon_msg_lightobj(hmd, mon, obj):
//   Light-source weapon message (burning undead, etc).
// TODO: uhitm.c:1680 — hmon_hitmon_msg_lightobj()

// cf. uhitm.c:1732 — hmon_hitmon(mon, obj, thrown, dieroll):
//   Core hit-monster dispatcher: calls barehands/weapon/potion/misc, then
//   do_hit, dmg_recalc, poison, jousting, stagger, pet, splitmon, messages.
//   Partially implemented in playerAttackMonster() below.
// TODO: uhitm.c:1732 — hmon_hitmon(): full implementation


// ============================================================================
// 4. Special hit mechanics
// ============================================================================

// cf. uhitm.c:1920 — mhurtle_to_doom(mtmp, tmp, xd, yd, range):
//   Monster hurtle to death (knockback into hazard).
// TODO: uhitm.c:1920 — mhurtle_to_doom()

// cf. uhitm.c:1941 — first_weapon_hit(weapon):
//   Check if this is the first hit with a weapon (for artifact effects).
// TODO: uhitm.c:1941 — first_weapon_hit()

// cf. uhitm.c:1970 — shade_aware(obj):
//   Check if object can affect a shade (silver, blessed, artifact).
// TODO: uhitm.c:1970 — shade_aware()

// cf. uhitm.c:1994 — shade_miss(magr, mdef, obj, thrown, verbose):
//   Miss message when attacking shade with non-effective weapon.
// TODO: uhitm.c:1994 — shade_miss()

// cf. uhitm.c:2034 — m_slips_free(mdef, mattk):
//   Monster slips free from grabbing attack.
// TODO: uhitm.c:2034 — m_slips_free()

// cf. uhitm.c:2076 — joust(mon, obj):
//   Jousting check: lance + riding + skill → bonus damage or lance break.
// TODO: uhitm.c:2076 — joust()

// cf. uhitm.c:2111 — demonpet():
//   Demon summoning when hero is a demon and attacks.
// TODO: uhitm.c:2111 — demonpet()

// cf. uhitm.c:2126 — theft_petrifies(otmp):
//   Check if stealing an object would petrify the thief.
// TODO: uhitm.c:2126 — theft_petrifies()

// cf. uhitm.c:2152 — steal_it(mdef, mattk):
//   Hero steal-attack (nymph polymorph form, etc).
// TODO: uhitm.c:2152 — steal_it()


// ============================================================================
// 5. Damage-type handlers (mhitm_ad_*)
// ============================================================================
// These handlers implement the m-vs-m (monster-vs-monster) combat path.
// Each takes (magr, mattk, mdef, mhm) where mhm is:
//   { damage, hitflags, done, permdmg, specialdmg, dieroll }
// The uhitm (u-vs-m) and mhitu (m-vs-u) paths remain in playerAttackMonster()
// and monsterAttackPlayer() respectively.

// cf. uhitm.c:3959 — physical damage handler
// m-vs-m branch: uhitm.c:4106-4177
export function mhitm_ad_phys(magr, mattk, mdef, mhm) {
    const pd = mdef.type || {};
    if (mattk.type === AT_KICK && thick_skinned(pd)) {
        mhm.damage = 0;
    }
}

// cf. uhitm.c:2499 — fire damage handler
// m-vs-m branch: uhitm.c:2565-2600
export function mhitm_ad_fire(magr, mattk, mdef, mhm) {
    if (mhitm_mgc_atk_negated(magr, mdef)) {
        mhm.damage = 0;
        return;
    }
    if (resists_fire(mdef)) {
        mhm.damage = 0;
    }
}

// cf. uhitm.c:2604 — cold damage handler
// m-vs-m branch: uhitm.c:2642-2658
export function mhitm_ad_cold(magr, mattk, mdef, mhm) {
    if (mhitm_mgc_atk_negated(magr, mdef)) {
        mhm.damage = 0;
        return;
    }
    if (resists_cold(mdef)) {
        mhm.damage = 0;
    }
}

// cf. uhitm.c:2662 — electric damage handler
// m-vs-m branch: uhitm.c:2698-2716
export function mhitm_ad_elec(magr, mattk, mdef, mhm) {
    if (mhitm_mgc_atk_negated(magr, mdef)) {
        mhm.damage = 0;
        return;
    }
    if (resists_elec(mdef)) {
        mhm.damage = 0;
    }
}

// cf. uhitm.c:2720 — acid damage handler
// m-vs-m branch: uhitm.c:2744-2763
export function mhitm_ad_acid(magr, mattk, mdef, mhm) {
    if (magr.mcan) {
        mhm.damage = 0;
        return;
    }
    if (resists_acid(mdef)) {
        mhm.damage = 0;
    }
    // C ref: !rn2(30) erode_armor, !rn2(6) acid_damage — omitted (no armor system)
    rn2(30);
    rn2(6);
}

// cf. uhitm.c:3082 — apply actual poison effects (m-vs-m)
function mhitm_really_poison(magr, mattk, mdef, mhm) {
    if (resists_poison(mdef)) {
        // C ref: if resists, "unaffected" — no damage
        mhm.damage = 0;
        return;
    }
    // C ref: mhitm.c:3094 — m_lev > 0 ? lose a level : take 2d6 damage
    if ((mdef.m_lev ?? mdef.mlevel ?? 0) > 0) {
        const mlev = mdef.m_lev ?? mdef.mlevel ?? 0;
        mhm.damage = d(2, 6);
        if (mdef.mhpmax > (mlev + 1)) {
            mdef.mhpmax -= mhm.damage;
            if (mdef.mhpmax < (mlev + 1)) mdef.mhpmax = mlev + 1;
        }
    } else {
        mhm.damage = mdef.mhp;
    }
}

// cf. uhitm.c:3100 — poison (AD_DRST/AD_DRDX/AD_DRCO) handler
// m-vs-m branch: uhitm.c:3137-3142
export function mhitm_ad_drst(magr, mattk, mdef, mhm) {
    const negated = mhitm_mgc_atk_negated(magr, mdef);
    if (!negated && !rn2(8)) {
        mhitm_really_poison(magr, mattk, mdef, mhm);
    }
}

// cf. uhitm.c:4366 — stun handler
// m-vs-m branch: uhitm.c:4388-4399
export function mhitm_ad_stun(magr, mattk, mdef, mhm) {
    if (magr.mcan) return;
    mdef.mstun = 1;
    mhitm_ad_phys(magr, mattk, mdef, mhm);
}

// cf. uhitm.c:3668 — confusion handler
// m-vs-m branch: uhitm.c:3691-3703
export function mhitm_ad_conf(magr, mattk, mdef, mhm) {
    if (!magr.mcan && !mdef.mconf && !magr.mspec_used) {
        mdef.mconf = 1;
    }
}

// cf. uhitm.c:2936 — blinding handler
// m-vs-m branch: uhitm.c:2964-2989
export function mhitm_ad_blnd(magr, mattk, mdef, mhm) {
    // C ref: can_blnd check omitted for simplicity; uses damage dice for duration
    let rnd_tmp = d(mattk.dice || 0, mattk.sides || 0);
    rnd_tmp += (mdef.mblinded || 0);
    if (rnd_tmp > 127) rnd_tmp = 127;
    mdef.mblinded = rnd_tmp;
    mdef.mcansee = 0;
    if (mhm) mhm.damage = 0;
}

// cf. uhitm.c:3457 — sleep handler
// m-vs-m branch: uhitm.c:3486-3500
export function mhitm_ad_slee(magr, mattk, mdef, mhm) {
    if (!mdef.msleeping && !resists_sleep(mdef)) {
        const amt = rnd(10);
        if (mdef.mcanmove !== false) {
            mdef.mcanmove = false;
            mdef.mfrozen = Math.min((mdef.mfrozen || 0) + amt, 127);
        }
    }
}

// cf. uhitm.c:3409 — paralysis handler
// m-vs-m branch: uhitm.c:3441-3453
export function mhitm_ad_plys(magr, mattk, mdef, mhm) {
    if (mdef.mcanmove !== false && !rn2(3)
        && !mhitm_mgc_atk_negated(magr, mdef)) {
        const amt = rnd(10);
        mdef.mcanmove = false;
        mdef.mfrozen = Math.min(amt, 127);
    }
}

// cf. uhitm.c:3284 — sticking handler
// m-vs-m branch: uhitm.c:3307-3311
export function mhitm_ad_stck(magr, mattk, mdef, mhm) {
    const negated = mhitm_mgc_atk_negated(magr, mdef);
    if (negated) mhm.damage = 0;
}

// cf. uhitm.c:3315 — wrap handler
// m-vs-m branch: uhitm.c:3396-3406
export function mhitm_ad_wrap(magr, mattk, mdef, mhm) {
    if (magr.mcan) mhm.damage = 0;
}

// cf. uhitm.c:2423 — level drain handler
// m-vs-m branch: uhitm.c:2467-2495
export function mhitm_ad_drli(magr, mattk, mdef, mhm) {
    if (!rn2(3) && !resists_ston(mdef) /* resists_drli in C, using ston as proxy */
        && !mhitm_mgc_atk_negated(magr, mdef)) {
        mhm.damage = d(2, 6);
        const mlev = mdef.m_lev ?? mdef.mlevel ?? 0;
        if (mdef.mhpmax - mhm.damage > mlev) {
            mdef.mhpmax -= mhm.damage;
        } else if (mdef.mhpmax > mlev) {
            mdef.mhpmax = mlev + 1;
        }
        if (mlev === 0) {
            mhm.damage = mdef.mhp;
        } else {
            if (mdef.m_lev !== undefined) mdef.m_lev--;
            else if (mdef.mlevel !== undefined) mdef.mlevel--;
        }
    }
}

// cf. uhitm.c:3630 — slow handler
// m-vs-m branch: uhitm.c:3654-3664
export function mhitm_ad_slow(magr, mattk, mdef, mhm) {
    const negated = mhitm_mgc_atk_negated(magr, mdef);
    if (!negated) {
        mdef.mslow = 1;
    }
}

// cf. uhitm.c:2396 — energy drain handler
// m-vs-m branch: simplified
export function mhitm_ad_dren(magr, mattk, mdef, mhm) {
    const negated = mhitm_mgc_atk_negated(magr, mdef);
    if (negated) mhm.damage = 0;
    // C ref: xdrainenergym — increases mspec_used
    if (!negated && (mdef.mspec_used || 0) < 20) {
        mdef.mspec_used = (mdef.mspec_used || 0) + d(2, 2);
    }
}

// cf. uhitm.c:3146 — brain drain (mind flayer)
// m-vs-m: uhitm.c:3241-3280
export function mhitm_ad_drin(magr, mattk, mdef, mhm) {
    const pd = mdef.type || {};
    if (!pd.flags1 || (pd.flags1 & 0x00040000 /* M1_NOHEAD */)) {
        // Can't drain brain from headless monster
        mhm.damage = 0;
        return;
    }
    // C ref: intelligence drain — reduces m_lev and mhpmax
    const mlev = mdef.m_lev ?? mdef.mlevel ?? 0;
    if (mlev > 0) {
        if (mdef.m_lev !== undefined) mdef.m_lev--;
        else if (mdef.mlevel !== undefined) mdef.mlevel--;
        mhm.damage = d(2, 6);
        if (mdef.mhpmax > (mlev + 1)) {
            mdef.mhpmax -= mhm.damage;
            if (mdef.mhpmax < (mlev)) mdef.mhpmax = mlev;
        }
    } else {
        mhm.damage = mdef.mhp;
    }
}

// --- Remaining AD_* handlers: simplified stubs for rare/complex effects ---

// cf. uhitm.c:2259 — rust handler (m-vs-m: damages equipment)
export function mhitm_ad_rust(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:2316 — corrosion handler
export function mhitm_ad_corr(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:2341 — decay handler
export function mhitm_ad_dcay(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:2768 — steal gold (m-vs-m: no effect)
export function mhitm_ad_sgld(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:2837 — teleport (m-vs-m: TODO)
export function mhitm_ad_tlpt(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:2993 — curse items (m-vs-m: no effect)
export function mhitm_ad_curs(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:3504 — slime (TODO: needs newcham)
export function mhitm_ad_slim(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:3581 — enchantment drain (TODO)
export function mhitm_ad_ench(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:3707 — polymorph (TODO: needs newcham)
export function mhitm_ad_poly(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:4181 — stoning (TODO: needs petrification system)
export function mhitm_ad_ston(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:4243 — lycanthropy (m-vs-m: no effect)
export function mhitm_ad_were(magr, mattk, mdef, mhm) { /* no effect m-vs-m */ }

// cf. uhitm.c:4274 — nurse healing (m-vs-m: heals defender)
export function mhitm_ad_heal(magr, mattk, mdef, mhm) {
    mdef.mhp = Math.min((mdef.mhp || 0) + mhm.damage, mdef.mhpmax || mdef.mhp);
    mhm.damage = 0;
}

// cf. uhitm.c:4403 — leg wound (m-vs-m: physical damage)
export function mhitm_ad_legs(magr, mattk, mdef, mhm) {
    mhitm_ad_phys(magr, mattk, mdef, mhm);
}

// cf. uhitm.c:4470 — digestion (engulf)
export function mhitm_ad_dgst(magr, mattk, mdef, mhm) {
    // C ref: full digestion damage = d(6,6) if mhm.damage == 0
    // Simplified: just use the rolled damage
}

// cf. uhitm.c:4548 — steal amulet (m-vs-m: no effect)
export function mhitm_ad_samu(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:4571 — disease (m-vs-m: no effect)
export function mhitm_ad_dise(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:4601 — seduction (m-vs-m: no effect)
export function mhitm_ad_sedu(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:4729 — succubus seduction (m-vs-m: no effect)
export function mhitm_ad_ssex(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:3815 — death touch (Rider attack)
export function mhitm_ad_deth(magr, mattk, mdef, mhm) {
    // C ref: redirects to mhitm_ad_drli for m-vs-m
    mhitm_ad_drli(magr, mattk, mdef, mhm);
}

// cf. uhitm.c:3786 — pestilence (Rider attack)
export function mhitm_ad_pest(magr, mattk, mdef, mhm) {
    /* m-vs-m: just physical damage */
}

// cf. uhitm.c:3755 — famine (Rider attack)
export function mhitm_ad_famn(magr, mattk, mdef, mhm) {
    /* m-vs-m: just physical damage */
}

// cf. uhitm.c:3875 — hallucination (m-vs-m: no effect)
export function mhitm_ad_halu(magr, mattk, mdef, mhm) { mhm.damage = 0; }

// cf. uhitm.c:3902 — do_stone_u (TODO: needs petrification system)
// cf. uhitm.c:3923 — do_stone_mon (TODO: needs petrification system)

// ============================================================================
// 5b. Central AD_* dispatcher
// ============================================================================

// cf. uhitm.c:4760 — mhitm_adtyping(magr, mattk, mdef, mhm):
//   Dispatch to specific mhitm_ad_* handler based on attack damage type.
//   mattk.damage is the JS equivalent of mattk->adtyp.
export function mhitm_adtyping(magr, mattk, mdef, mhm) {
    switch (mattk.damage) {
    case AD_PHYS: mhitm_ad_phys(magr, mattk, mdef, mhm); break;
    case AD_FIRE: mhitm_ad_fire(magr, mattk, mdef, mhm); break;
    case AD_COLD: mhitm_ad_cold(magr, mattk, mdef, mhm); break;
    case AD_ELEC: mhitm_ad_elec(magr, mattk, mdef, mhm); break;
    case AD_ACID: mhitm_ad_acid(magr, mattk, mdef, mhm); break;
    case AD_STUN: mhitm_ad_stun(magr, mattk, mdef, mhm); break;
    case AD_LEGS: mhitm_ad_legs(magr, mattk, mdef, mhm); break;
    case AD_WERE: mhitm_ad_were(magr, mattk, mdef, mhm); break;
    case AD_HEAL: mhitm_ad_heal(magr, mattk, mdef, mhm); break;
    case AD_SGLD: mhitm_ad_sgld(magr, mattk, mdef, mhm); break;
    case AD_TLPT: mhitm_ad_tlpt(magr, mattk, mdef, mhm); break;
    case AD_BLND: mhitm_ad_blnd(magr, mattk, mdef, mhm); break;
    case AD_CURS: mhitm_ad_curs(magr, mattk, mdef, mhm); break;
    case AD_DRLI: mhitm_ad_drli(magr, mattk, mdef, mhm); break;
    case AD_RUST: mhitm_ad_rust(magr, mattk, mdef, mhm); break;
    case AD_CORR: mhitm_ad_corr(magr, mattk, mdef, mhm); break;
    case AD_DCAY: mhitm_ad_dcay(magr, mattk, mdef, mhm); break;
    case AD_DREN: mhitm_ad_dren(magr, mattk, mdef, mhm); break;
    case AD_DRST:
    case AD_DRDX:
    case AD_DRCO: mhitm_ad_drst(magr, mattk, mdef, mhm); break;
    case AD_DRIN: mhitm_ad_drin(magr, mattk, mdef, mhm); break;
    case AD_STCK: mhitm_ad_stck(magr, mattk, mdef, mhm); break;
    case AD_WRAP: mhitm_ad_wrap(magr, mattk, mdef, mhm); break;
    case AD_PLYS: mhitm_ad_plys(magr, mattk, mdef, mhm); break;
    case AD_SLEE: mhitm_ad_slee(magr, mattk, mdef, mhm); break;
    case AD_SLIM: mhitm_ad_slim(magr, mattk, mdef, mhm); break;
    case AD_ENCH: mhitm_ad_ench(magr, mattk, mdef, mhm); break;
    case AD_SLOW: mhitm_ad_slow(magr, mattk, mdef, mhm); break;
    case AD_CONF: mhitm_ad_conf(magr, mattk, mdef, mhm); break;
    case AD_POLY: mhitm_ad_poly(magr, mattk, mdef, mhm); break;
    case AD_DISE: mhitm_ad_dise(magr, mattk, mdef, mhm); break;
    case AD_SAMU: mhitm_ad_samu(magr, mattk, mdef, mhm); break;
    case AD_DETH: mhitm_ad_deth(magr, mattk, mdef, mhm); break;
    case AD_PEST: mhitm_ad_pest(magr, mattk, mdef, mhm); break;
    case AD_FAMN: mhitm_ad_famn(magr, mattk, mdef, mhm); break;
    case AD_DGST: mhitm_ad_dgst(magr, mattk, mdef, mhm); break;
    case AD_HALU: mhitm_ad_halu(magr, mattk, mdef, mhm); break;
    case AD_SSEX: mhitm_ad_ssex(magr, mattk, mdef, mhm); break;
    case AD_SEDU:
    case AD_SITM: mhitm_ad_sedu(magr, mattk, mdef, mhm); break;
    default:
        mhm.damage = 0;
        break;
    }
}


// ============================================================================
// 6. Engulfment
// ============================================================================

// cf. uhitm.c:4813 — damageum(mdef, mattk, specialdmg):
//   Apply hero's attack damage to monster (used by polymorphed hero attacks).
// TODO: uhitm.c:4813 — damageum()

// cf. uhitm.c:4869 — explum(mdef, mattk):
//   Exploding attack (hero polymorphed into exploding monster).
// TODO: uhitm.c:4869 — explum()

// cf. uhitm.c:4909 — start_engulf(mdef):
//   Start engulfing animation/state.
// TODO: uhitm.c:4909 — start_engulf()

// cf. uhitm.c:4927 — end_engulf():
//   End engulfing animation/state.
// TODO: uhitm.c:4927 — end_engulf()

// cf. uhitm.c:4936 — gulpum(mdef, mattk):
//   Hero engulf attack (polymorphed into engulfer).
// TODO: uhitm.c:4936 — gulpum()


// ============================================================================
// 7. Miss / defense / knockback
// ============================================================================

// cf. uhitm.c:5176 — missum(mdef, uattk, can_see):
//   Hero misses monster: print miss message, exercise DEX.
// TODO: uhitm.c:5176 — missum()

// cf. uhitm.c:5196 — m_is_steadfast(mtmp):
//   Check if monster resists knockback (heavy, clinging, etc).
// TODO: uhitm.c:5196 — m_is_steadfast()

// cf. uhitm.c:5225 — mhitm_knockback(magr, mdef, mattk, mhm, dieroll):
//   Knockback effect on hit: push monster back, possibly into hazard.
// TODO: uhitm.c:5225 — mhitm_knockback()


// ============================================================================
// 8. Polymorphed hero attacks
// ============================================================================

// cf. uhitm.c:5402 — hmonas(mon):
//   Hero attacks as polymorphed monster (use monster attack list).
// TODO: uhitm.c:5402 — hmonas()


// ============================================================================
// 9. Passive defense
// ============================================================================

// cf. uhitm.c:5843 — passive(mon, mhit, malive, AT_type, wep_was_destroyed):
//   Monster's passive defense: damage hero on contact (acid blob, etc).
//   rn2(3) gate partially consumed in playerAttackMonster() below.
// TODO: uhitm.c:5843 — passive(): full implementation

// cf. uhitm.c:6105 — passive_obj(mon, obj, mattk):
//   Passive defense damages hero's weapon/armor.
// TODO: uhitm.c:6105 — passive_obj()


// ============================================================================
// 10. Mimic discovery
// ============================================================================

// cf. uhitm.c:6179 — that_is_a_mimic(mtmp):
//   Reveal that a hidden monster is actually a mimic.
// TODO: uhitm.c:6179 — that_is_a_mimic()

// cf. uhitm.c:6260 — stumble_onto_mimic(mtmp):
//   Hero stumbles onto a hidden mimic while moving.
// TODO: uhitm.c:6260 — stumble_onto_mimic()

// cf. uhitm.c:6278 — disguised_as_non_mon(mtmp):
//   Check if monster is disguised as a non-monster object/feature.
// TODO: uhitm.c:6278 — disguised_as_non_mon()

// cf. uhitm.c:6286 — disguised_as_mon(mtmp):
//   Check if monster is disguised as another monster.
// TODO: uhitm.c:6286 — disguised_as_mon()


// ============================================================================
// 11. Light attacks
// ============================================================================

// cf. uhitm.c:6293 — nohandglow(mon):
//   Suppress hand-glow message when inappropriate (e.g., not wielding light source).
// TODO: uhitm.c:6293 — nohandglow()

// cf. uhitm.c:6319 — flash_hits_mon(mtmp, otmp):
//   Flash of light hits a monster (camera, wand of light, etc).
// TODO: uhitm.c:6319 — flash_hits_mon()

// cf. uhitm.c:6403 — light_hits_gremlin(mon, dmg):
//   Light damage specifically to gremlins.
// TODO: uhitm.c:6403 — light_hits_gremlin()


// ============================================================================
// Implemented functions (moved from mhitu.js)
// ============================================================================

// cf. uhitm.c find_roll_to_hit() — luck component (partial)
function isUndeadOrDemon(monsterType) {
    if (!monsterType) return false;
    const sym = monsterType.symbol;
    return sym === S_ZOMBIE
        || sym === S_MUMMY
        || sym === S_VAMPIRE
        || sym === S_WRAITH
        || sym === S_LICH
        || sym === S_GHOST
        || sym === S_DEMON;
}

export function weaponEnchantment(weapon) {
    return (weapon && (weapon.enchantment ?? weapon.spe)) || 0;
}

export function weaponDamageSides(weapon, monster) {
    if (!weapon) return 0;
    if (weapon.wsdam) return weapon.wsdam;
    const info = objectData[weapon.otyp];
    if (!info) return 0;
    const isLarge = (monster?.type?.size ?? MZ_TINY) >= MZ_LARGE;
    return isLarge ? (info.ldam || 0) : (info.sdam || 0);
}

// cf. uhitm.c hmon_hitmon_weapon() — ranged weapon used in melee check
function usesRangedMeleeDamage(weapon) {
    if (!weapon) return false;
    const sub = objectData[weapon.otyp]?.sub;
    if (!Number.isInteger(sub)) return false;
    const isLauncher = sub >= 20 && sub <= 22;      // P_BOW..P_CROSSBOW
    const isAmmoOrMissile = sub <= -20 && sub >= -24; // -P_BOW..-P_SHURIKEN
    return isLauncher || isAmmoOrMissile;
}

// cf. uhitm.c find_roll_to_hit() — Luck component.
// sgn(Luck) * ((abs(Luck) + 2) / 3)  (integer division)
function luckBonus(luck) {
    if (!luck) return 0;
    return Math.sign(luck) * Math.floor((Math.abs(luck) + 2) / 3);
}

// cf. weapon.c abon() — DEX component of to-hit bonus.
function dexToHit(dex) {
    if (dex < 4) return -3;
    if (dex < 6) return -2;
    if (dex < 8) return -1;
    if (dex < 14) return 0;
    return dex - 14;
}

// cf. uhitm.c hmon_hitmon_potion() -> potion.c potionhit()
function consumeMeleePotion(player, weapon) {
    const potion = { ...weapon, quan: 1 };
    if ((weapon.quan || 1) > 1) {
        weapon.quan = (weapon.quan || 1) - 1;
        potion.o_id = next_ident();
    } else {
        player.removeFromInventory(weapon);
        if (player.weapon === weapon) uwepgone(player);
        if (player.swapWeapon === weapon) uswapwepgone(player);
        if (player.quiver === weapon) uqwepgone(player);
    }
    return potion;
}

function potionHealsMonster(potion) {
    if (!potion) return false;
    return potion.otyp === POT_HEALING
        || potion.otyp === POT_EXTRA_HEALING
        || potion.otyp === POT_FULL_HEALING
        || potion.otyp === POT_RESTORE_ABILITY
        || potion.otyp === POT_GAIN_ABILITY;
}

// cf. uhitm.c hmon_hitmon_potion() -> potion.c potionhit()
function hitMonsterWithPotion(player, monster, display, weapon) {
    const potion = consumeMeleePotion(player, weapon);
    const bottleChoices = player?.hallucinating ? 24 : 7;
    rn2(bottleChoices); // bottlename()

    // cf. potion.c:1671
    if (rn2(5) && monster.mhp > 1) {
        monster.mhp--;
    }

    if (potionHealsMonster(potion) && monster.mhp < (monster.mhpmax || monster.mhp)) {
        monster.mhp = monster.mhpmax || monster.mhp;
        display.putstr_message(`The ${monDisplayName(monster)} looks sound and hale again.`);
    }

    // cf. potion.c:1893 — distance<3 && !rn2((1+DEX)/2) gate for potionbreathe()
    const dex = player.attributes?.[A_DEX] ?? 10;
    const breatheDenom = Math.max(1, Math.floor((1 + dex) / 2));
    rn2(breatheDenom);
}

// cf. mon.c xkilled() — monster death handling.
// Co-located here with its primary caller playerAttackMonster().
// TODO: future mon.js codematch should migrate this to mon.js.
function handleMonsterKilled(player, monster, display, map) {
    // cf. uhitm.c -> mon.c mondead() -> killed() -> xkilled()
    const mdat = monster.type || {};
    const killVerb = nonliving(mdat) ? 'destroy' : 'kill';
    display.putstr_message(`You ${killVerb} the ${monDisplayName(monster)}!`);
    mondead(monster, map, player);

    // cf. exper.c experience() -- roughly monster level * level
    const exp = (monster.mlevel + 1) * (monster.mlevel + 1);
    player.exp += exp;
    player.score += exp;
    newexplevel(player, display);

    // cf. mon.c:3581-3609 xkilled() — "illogical but traditional" treasure drop.
    const treasureRoll = rn2(6);
    const canDropTreasure = treasureRoll === 0
        && !((mdat.geno || 0) & G_NOCORPSE)
        && !monster.mcloned
        && (monster.mx !== player.x || monster.my !== player.y)
        && mdat.symbol !== S_KOP;
    if (canDropTreasure && map) {
        const otmp = mkobj(RANDOM_CLASS, true, false);
        const flags2 = mdat.flags2 || 0;
        const isSmallMonster = (mdat.size || 0) < MZ_HUMAN;
        const isPermaFood = otmp && otmp.oclass === FOOD_CLASS && !otmp.oartifact;
        const dropTooBig = isSmallMonster && !!otmp
            && otmp.otyp !== FIGURINE
            && ((otmp.owt || 0) > 30 || !!objectData[otmp.otyp]?.oc_big);
        if (isPermaFood && !(flags2 & M2_COLLECT)) {
            obj_resists(otmp, 0, 0);
        } else if (dropTooBig) {
            obj_resists(otmp, 0, 0);
        } else {
            otmp.ox = monster.mx;
            otmp.oy = monster.my;
            placeFloorObject(map, otmp);
        }
    }

    // C ref: mon.c:3178-3252 corpse_chance()
    const createCorpse = corpse_chance(monster);

    if (createCorpse) {
        const corpse = mkcorpstat(CORPSE, monster.mndx || 0, true,
            map ? monster.mx : 0, map ? monster.my : 0, map);
        corpse.age = Math.max((player?.turns || 0) + 1, 1);
    }

    return true;
}

// cf. uhitm.c do_attack() / hmon_hitmon() — hero attacks monster
export function playerAttackMonster(player, monster, display, map) {
    // To-hit calculation
    // cf. uhitm.c find_roll_to_hit():
    //   tmp = 1 + abon() + find_mac(mtmp) + u.uhitinc
    //         + (sgn(Luck)*((abs(Luck)+2)/3)) + u.ulevel
    //   then: mhit = (tmp > rnd(20))
    const dieRoll = rnd(20);
    // cf. weapon.c abon() = str_bonus + (ulevel<3?1:0) + dex_bonus
    const abon = player.strToHit + (player.level < 3 ? 1 : 0)
        + dexToHit(player.attributes?.[A_DEX] ?? 10);
    let toHit = 1 + abon + monster.mac + player.level
        + luckBonus(player.luck || 0)
        + weaponEnchantment(player.weapon);
    // cf. uhitm.c:386-393 — monster state adjustments
    if (monster.stunned) toHit += 2;
    if (monster.flee) toHit += 2;
    if (monster.sleeping) toHit += 2;
    if (monster.mcanmove === false) toHit += 4;

    if (toHit <= dieRoll) {
        // Miss
        // cf. uhitm.c -- "You miss the <monster>"
        display.putstr_message(`You miss the ${monDisplayName(monster)}.`);
        // cf. uhitm.c:5997 passive() — rn2(3) when monster alive after attack
        rn2(3);
        return false;
    }

    // cf. uhitm.c:742 exercise(A_DEX, TRUE) on successful hit
    exercise(player, A_DEX, true);

    if (player.weapon && player.weapon.oclass === POTION_CLASS) {
        hitMonsterWithPotion(player, monster, display, player.weapon);
        // cf. uhitm.c hmon_hitmon_potion() sets base damage to 1 (or 0 vs shade)
        // after potionhit(), then proceeds through normal kill/flee/passive handling.
        if ((monster.mndx ?? -1) !== PM_SHADE) {
            monster.mhp -= 1;
        }
        if (monster.mhp <= 0) {
            return handleMonsterKilled(player, monster, display, map);
        }
        // cf. uhitm.c:624-628 known_hitum() — 1/25 morale/flee check on surviving hit
        if (!rn2(25) && monster.mhp < Math.floor((monster.mhpmax || 1) / 2)) {
            // cf. monflee(mon, !rn2(3) ? rnd(100) : 0, ...) — flee timer
            const fleetime = !rn2(3) ? rnd(100) : 0;
            applyMonflee(monster, fleetime, false);
        }
        // cf. uhitm.c:5997 passive() — rn2(3) when monster alive after attack
        rn2(3);
        return false;
    }

    // Hit! Calculate damage
    // cf. weapon.c:265 dmgval() -- rnd(oc_wsdam) for small monsters
    let damage = 0;
    const rangedMelee = usesRangedMeleeDamage(player.weapon);
    const wsdam = weaponDamageSides(player.weapon, monster);
    if (player.weapon && rangedMelee) {
        // cf. uhitm.c hmon_hitmon_weapon_ranged() base damage.
        damage = rnd(2);
    } else if (player.weapon && wsdam > 0) {
        damage = rnd(wsdam);
        damage += weaponEnchantment(player.weapon);
        // cf. weapon.c dmgval() — blessed weapon bonus vs undead/demons.
        if (player.weapon.blessed && isUndeadOrDemon(monster.type)) {
            damage += rnd(4);
        }
    } else if (player.weapon && player.weapon.damage) {
        damage = c_d(player.weapon.damage[0], player.weapon.damage[1]);
        damage += player.weapon.enchantment || 0;
    } else {
        // Bare-handed combat
        // cf. uhitm.c -- barehand damage is 1d2 + martial arts bonuses
        damage = rnd(2);
    }

    // Add strength bonus
    if (!rangedMelee) {
        damage += player.strDamage;
    }

    // Minimum 1 damage on a hit
    if (damage < 1) damage = 1;

    // Apply damage
    // cf. uhitm.c -- "You hit the <monster>!"
    monster.mhp -= damage;

    if (monster.mhp <= 0) {
        // cf. uhitm.c:5997 passive() — skipped when monster is killed
        return handleMonsterKilled(player, monster, display, map);
    } else {
        // cf. uhitm.c -- various hit messages
        if (dieRoll >= 18) {
            display.putstr_message(`You smite the ${monDisplayName(monster)}!`);
        } else {
            display.putstr_message(`You hit the ${monDisplayName(monster)}.`);
        }
        // cf. uhitm.c hmon_hitmon_core():
        // For armed melee hits with damage > 1: mhitm_knockback().
        // For unarmed hits with damage > 1: hmon_hitmon_stagger() → rnd(100).
        if (player.weapon && damage > 1 && !player.twoweap) {
            // cf. uhitm.c:5225 mhitm_knockback — hero attacks monster
            // RNG: rn2(3) always, rn2(6) always, then eligibility + rn2(2)*2 if qualifies
            const knockdist = rn2(3); // 67% 1-step, 33% 2-step
            if (!rn2(6)) {
                // Passed 1/6 chance gate. Check eligibility:
                // AD_PHYS + AT_WEAP: passes for armed hero (mattk is hero's attack)
                // Size: hero (MZ_HUMAN) must be > mdef.msize + 1
                const msize = monster.type?.size ?? MZ_HUMAN;
                if (msize + 1 < MZ_HUMAN) {
                    // cf. uhitm.c:5350-5352 — knockback message
                    const adj = rn2(2) ? 'forceful' : 'powerful';
                    const noun = rn2(2) ? 'blow' : 'strike';
                    display.putstr_message(
                        `You knock the ${monDisplayName(monster)} back with a ${adj} ${noun}!`
                    );
                }
            }
        } else if (!player.weapon && damage > 1) {
            // cf. uhitm.c:1554 hmon_hitmon_stagger — rnd(100) stun chance check
            rnd(100);
        }
        // cf. uhitm.c:624-628 known_hitum() — 1/25 morale/flee check on surviving hit
        if (!rn2(25) && monster.mhp < Math.floor((monster.mhpmax || 1) / 2)) {
            // cf. monflee(mon, !rn2(3) ? rnd(100) : 0, ...) — flee timer
            const fleetime = !rn2(3) ? rnd(100) : 0;
            applyMonflee(monster, fleetime, false);
        }
        // cf. uhitm.c:5997 passive() — rn2(3) when monster alive after hit
        rn2(3);
        return false;
    }
}
