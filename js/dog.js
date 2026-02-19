// dog.js -- Pet AI helper functions
// C ref: dog.c dogfood(), initedog()
// Focus: exact RNG consumption alignment with C NetHack

import {
    mons, NUMMONS,
    MR_POISON, MR_ACID, MR_STONE, MR_FIRE,
    S_BLOB, S_JELLY, S_FUNGUS, S_VORTEX, S_LIGHT, S_ELEMENTAL,
    S_GOLEM, S_GHOST, S_YETI, S_KOBOLD, S_ORC, S_OGRE,
    PM_COCKATRICE, PM_CHICKATRICE, PM_MEDUSA,
    PM_STALKER, PM_FLESH_GOLEM, PM_LEATHER_GOLEM,
    PM_GHOUL, PM_KILLER_BEE, PM_PYROLISK,
    PM_GELATINOUS_CUBE, PM_RUST_MONSTER,
    PM_DEATH, PM_PESTILENCE, PM_FAMINE, PM_LIZARD, PM_LICHEN,
} from './monsters.js';

import {
    objectData,
    FOOD_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, COIN_CLASS, GEM_CLASS,
    SILVER,
    CORPSE, TIN, EGG,
    TRIPE_RATION, MEATBALL, MEAT_STICK, ENORMOUS_MEATBALL, MEAT_RING,
    LUMP_OF_ROYAL_JELLY, GLOB_OF_GREEN_SLIME,
    CLOVE_OF_GARLIC, APPLE, CARROT, BANANA, SLIME_MOLD,
    AMULET_OF_STRANGULATION, RIN_SLOW_DIGESTION,
} from './objects.js';

import { obj_resists, is_organic, is_metallic, is_rustprone } from './objdata.js';
import {
    carnivorous, herbivorous, is_undead, is_elf,
    is_humanoid, acidic, poisonous, is_metallivore,
} from './mondata.js';

// Re-export dogmove.c functions that were previously defined here
export { can_carry, dog_eat } from './dogmove.js';

// ========================================================================
// dogfood return categories (C ref: mextra.h dogfood_types)
// ========================================================================
export const DOGFOOD  = 0;
export const CADAVER  = 1;
export const ACCFOOD  = 2;
export const MANFOOD  = 3;
export const APPORT   = 4;
export const POISON   = 5;
export const UNDEF    = 6;
export const TABU     = 7;

const NON_PM = -1;

function monIndex(mon) {
    if (Number.isInteger(mon?.mnum)) return mon.mnum;
    if (Number.isInteger(mon?.mndx)) return mon.mndx;
    return NON_PM;
}

function monPtr(mon) {
    const idx = monIndex(mon);
    return ismnum(idx) ? mons[idx] : null;
}

// ========================================================================
// Helper predicates matching C macros from mondata.h
// ========================================================================

function mon_vegan(ptr) {
    return ptr.symbol === S_BLOB || ptr.symbol === S_JELLY
        || ptr.symbol === S_FUNGUS || ptr.symbol === S_VORTEX
        || ptr.symbol === S_LIGHT
        || (ptr.symbol === S_ELEMENTAL && ptr !== mons[PM_STALKER])
        || (ptr.symbol === S_GOLEM && ptr !== mons[PM_FLESH_GOLEM]
            && ptr !== mons[PM_LEATHER_GOLEM])
        || ptr.symbol === S_GHOST;
}

function flesh_petrifies(pm) {
    return pm === mons[PM_COCKATRICE] || pm === mons[PM_CHICKATRICE]
        || pm === mons[PM_MEDUSA];
}

function is_rider(ptr) {
    return ptr === mons[PM_DEATH] || ptr === mons[PM_PESTILENCE]
        || ptr === mons[PM_FAMINE];
}

function resists_poison(mon) { return !!(monPtr(mon)?.mr1 & MR_POISON); }
function resists_acid(mon)   { return !!(monPtr(mon)?.mr1 & MR_ACID); }
function resists_ston(mon)   { return !!(monPtr(mon)?.mr1 & MR_STONE); }
function likes_fire(ptr) { return !!(ptr.mr1 & MR_FIRE); }
function polyfood(obj) { return false; }
function slimeproof(ptr) { return false; }

function mon_hates_silver(mon) {
    const ptr = monPtr(mon);
    if (!ptr) return false;
    return !!(ptr.flags2 & 0x00000400);
}

function ismnum(fx) { return fx >= 0 && fx < NUMMONS; }
const humanoid = is_humanoid;

function same_race(ptr1, ptr2) {
    const race_flags = 0x00004000 | 0x00008000 | 0x00010000 | 0x00020000 | 0x00040000;
    return !!(ptr1.flags2 & ptr2.flags2 & race_flags);
}

function is_quest_artifact(obj) { return false; }
function peek_at_iced_corpse_age(obj) { return obj.age || 0; }

// ========================================================================
// dogfood — classify object for pet food evaluation
// C ref: dog.c:988-1130 dogfood(mon, obj)
// ========================================================================

export function dogfood(mon, obj, moves) {
    const mptr = monPtr(mon);
    if (!mptr) return APPORT;
    const carni = carnivorous(mptr);
    const herbi = herbivorous(mptr);

    if (obj.opoisoned && !resists_poison(mon))
        return POISON;

    if (is_quest_artifact(obj) || obj_resists(obj, 0, 95))
        return obj.cursed ? TABU : APPORT;

    if (obj.oclass === FOOD_CLASS) {
        const fx = (obj.otyp === CORPSE || obj.otyp === TIN || obj.otyp === EGG)
            ? (obj.corpsenm !== undefined ? obj.corpsenm : NON_PM)
            : NON_PM;
        const fptr = ismnum(fx) ? mons[fx] : null;

        if (obj.otyp === CORPSE && fptr && is_rider(fptr))
            return TABU;

        if ((obj.otyp === CORPSE || obj.otyp === EGG)
            && fptr && flesh_petrifies(fptr)
            && !resists_ston(mon))
            return POISON;

        if (obj.otyp === LUMP_OF_ROYAL_JELLY
            && mptr === mons[PM_KILLER_BEE]) {
            return TABU;
        }

        if (!carni && !herbi)
            return obj.cursed ? UNDEF : APPORT;

        const starving = !!(mon.tame && !mon.isminion
                           && mon.edog && mon.edog.mhpmax_penalty);
        const mblind = false;

        if (monIndex(mon) === PM_GHOUL) {
            if (obj.otyp === CORPSE) {
                const corpseAge = peek_at_iced_corpse_age(obj);
                return (corpseAge + 50 <= (moves || 0)
                        && fx !== PM_LIZARD && fx !== PM_LICHEN) ? DOGFOOD
                    : (starving && fptr && !mon_vegan(fptr)) ? ACCFOOD
                    : POISON;
            }
            if (obj.otyp === EGG)
                return starving ? ACCFOOD : POISON;
            return TABU;
        }

        switch (obj.otyp) {
        case TRIPE_RATION:
        case MEATBALL:
        case MEAT_RING:
        case MEAT_STICK:
        case ENORMOUS_MEATBALL:
            return carni ? DOGFOOD : MANFOOD;

        case EGG:
            if (fx === PM_PYROLISK && !likes_fire(mptr))
                return POISON;
            return carni ? CADAVER : MANFOOD;

        case CORPSE: {
            const corpseAge = peek_at_iced_corpse_age(obj);
            if ((corpseAge + 50 <= (moves || 0)
                 && fx !== PM_LIZARD && fx !== PM_LICHEN
                 && mptr.symbol !== S_FUNGUS)
                || (fptr && acidic(fptr) && !resists_acid(mon))
                || (fptr && poisonous(fptr) && !resists_poison(mon)))
                return POISON;
            else if (polyfood(obj) && mon.tame > 1 && !starving)
                return MANFOOD;
            else if (fptr && mon_vegan(fptr))
                return herbi ? CADAVER : MANFOOD;
            else if (humanoid(mptr) && fptr && same_race(mptr, fptr)
                     && !is_undead(mptr) && fptr.symbol !== S_KOBOLD
                     && fptr.symbol !== S_ORC && fptr.symbol !== S_OGRE)
                return (starving && carni && !is_elf(mptr)) ? ACCFOOD : TABU;
            else
                return carni ? CADAVER : MANFOOD;
        }

        case GLOB_OF_GREEN_SLIME:
            return (starving || slimeproof(mptr)) ? ACCFOOD : POISON;

        case CLOVE_OF_GARLIC:
            return is_undead(mptr) ? TABU
                : (herbi || starving) ? ACCFOOD
                : MANFOOD;

        case TIN:
            return is_metallivore(mptr) ? ACCFOOD : MANFOOD;

        case APPLE:
            return herbi ? DOGFOOD : starving ? ACCFOOD : MANFOOD;

        case CARROT:
            return (herbi || mblind) ? DOGFOOD : starving ? ACCFOOD : MANFOOD;

        case BANANA:
            return (mptr.symbol === S_YETI && herbi) ? DOGFOOD
                : (herbi || starving) ? ACCFOOD
                : MANFOOD;

        default:
            if (starving) return ACCFOOD;
            return (obj.otyp > SLIME_MOLD) ? (carni ? ACCFOOD : MANFOOD)
                                           : (herbi ? ACCFOOD : MANFOOD);
        }
    }

    if (obj.oclass === ROCK_CLASS)
        return UNDEF;

    if (obj.otyp === AMULET_OF_STRANGULATION
        || obj.otyp === RIN_SLOW_DIGESTION)
        return TABU;

    if (mon_hates_silver(mon)
        && objectData[obj.otyp].material === SILVER)
        return TABU;

    if (monIndex(mon) === PM_GELATINOUS_CUBE && is_organic(obj))
        return ACCFOOD;

    if (is_metallivore(mptr) && is_metallic(obj)
        && (is_rustprone(obj) || monIndex(mon) !== PM_RUST_MONSTER)) {
        return (is_rustprone(obj) && !obj.oerodeproof) ? DOGFOOD : ACCFOOD;
    }

    if (!obj.cursed
        && obj.oclass !== BALL_CLASS
        && obj.oclass !== CHAIN_CLASS)
        return APPORT;

    return UNDEF;
}
