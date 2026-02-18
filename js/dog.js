// dog.js -- Pet AI helper functions
// C ref: dog.c dogfood(), initedog()
// Focus: exact RNG consumption alignment with C NetHack

import {
    mons, NUMMONS,
    MR_POISON, MR_ACID, MR_STONE, MR_FIRE,
    M1_NOTAKE, M1_NOHANDS, M2_STRONG, M2_ROCKTHROW,
    WT_HUMAN, MZ_HUMAN,
    MZ_TINY, MZ_SMALL, MZ_MEDIUM, MZ_LARGE, MZ_HUGE, MZ_GIGANTIC,
    AT_ENGL,
    S_BLOB, S_JELLY, S_FUNGUS, S_VORTEX, S_LIGHT, S_ELEMENTAL,
    S_GOLEM, S_GHOST, S_YETI, S_KOBOLD, S_ORC, S_OGRE, S_NYMPH, S_DRAGON,
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
    CORPSE, TIN, EGG, BOULDER,
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
import { monNam } from './mondata.js';
import { doname } from './mkobj.js';
import { couldsee } from './vision.js';

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

// C ref: mondata.h — vegan(ptr) for permonst* (monster diet classification)
// Used in corpse evaluation: is the corpse monster vegan?
function mon_vegan(ptr) {
    return ptr.symbol === S_BLOB || ptr.symbol === S_JELLY
        || ptr.symbol === S_FUNGUS || ptr.symbol === S_VORTEX
        || ptr.symbol === S_LIGHT
        || (ptr.symbol === S_ELEMENTAL && ptr !== mons[PM_STALKER])
        || (ptr.symbol === S_GOLEM && ptr !== mons[PM_FLESH_GOLEM]
            && ptr !== mons[PM_LEATHER_GOLEM])
        || ptr.symbol === S_GHOST; // noncorporeal
}

// C ref: mondata.h — flesh_petrifies(pm)
function flesh_petrifies(pm) {
    return pm === mons[PM_COCKATRICE] || pm === mons[PM_CHICKATRICE]
        || pm === mons[PM_MEDUSA];
}

// C ref: mondata.h — is_rider(ptr)
function is_rider(ptr) {
    return ptr === mons[PM_DEATH] || ptr === mons[PM_PESTILENCE]
        || ptr === mons[PM_FAMINE];
}

// Resistance checks using mr1 flags (innate monster resistances)
// C ref: monst.h — resists_poison/acid/ston use Resists_Elem
function resists_poison(mon) { return !!(monPtr(mon)?.mr1 & MR_POISON); }
function resists_acid(mon)   { return !!(monPtr(mon)?.mr1 & MR_ACID); }
function resists_ston(mon)   { return !!(monPtr(mon)?.mr1 & MR_STONE); }

// C ref: mondata.h — likes_fire(ptr) — fire vortex, flaming sphere, lava lovers
function likes_fire(ptr) { return !!(ptr.mr1 & MR_FIRE); }

// C ref: obj.h — polyfood(obj) — food that causes polymorph
// Simplified: chameleon/doppelganger/sandestin corpses not common in early game
function polyfood(obj) { return false; }

// C ref: mondata.h — slimeproof(ptr) — immune to slime transformation
function slimeproof(ptr) { return false; } // dogs/cats aren't slimeproof

// C ref: mon.c — mon_hates_silver(mon) — undead, werewolves, demons, etc.
function mon_hates_silver(mon) {
    const ptr = monPtr(mon);
    if (!ptr) return false;
    return !!(ptr.flags2 & 0x00000400); // M2_UNDEAD check is simplification
    // Full check involves were, demon, vampire, shade — not relevant for pets
}

// C ref: permonst.h — ismnum(fx) — valid monster index
function ismnum(fx) { return fx >= 0 && fx < NUMMONS; }

// C ref: mondata.h — humanoid(ptr) = is_humanoid(ptr)
const humanoid = is_humanoid;

// C ref: mondata.h — same_race(ptr1, ptr2) — checks race flags match
function same_race(ptr1, ptr2) {
    // Checks: both human, both elf, both dwarf, both gnome, both orc
    const race_flags = 0x00004000 | 0x00008000 | 0x00010000 | 0x00020000 | 0x00040000;
    // M2_HUMAN | M2_ELF | M2_DWARF | M2_GNOME | M2_ORC
    return !!(ptr1.flags2 & ptr2.flags2 & race_flags);
}

// C ref: is_quest_artifact(obj) — always false in early game
function is_quest_artifact(obj) { return false; }

// C ref: vision.c — peek_at_iced_corpse_age(obj) — simplified (no icing)
function peek_at_iced_corpse_age(obj) { return obj.age || 0; }

// ========================================================================
// dogfood — classify object for pet food evaluation
// C ref: dog.c:988-1130 dogfood(mon, obj)
// ========================================================================

// Returns food category (DOGFOOD..TABU). The lower, the more desirable.
// RNG: calls obj_resists(obj, 0, 95) which consumes rn2(100) for non-invocation items.
// @param moves — current game turn (svm.moves in C)
export function dogfood(mon, obj, moves) {
    const mptr = monPtr(mon);
    if (!mptr) return APPORT;
    const carni = carnivorous(mptr);
    const herbi = herbivorous(mptr);

    // Line 998-999: Poison check
    if (obj.opoisoned && !resists_poison(mon))
        return POISON;

    // Line 1000-1001: Quest artifact / obj_resists check
    // obj_resists(obj, 0, 95) → rn2(100), returns (chance < 0) = false for non-artifacts
    if (is_quest_artifact(obj) || obj_resists(obj, 0, 95))
        return obj.cursed ? TABU : APPORT;

    // Line 1003: Main switch on object class
    if (obj.oclass === FOOD_CLASS) {
        // Extract corpse monster number
        const fx = (obj.otyp === CORPSE || obj.otyp === TIN || obj.otyp === EGG)
            ? (obj.corpsenm !== undefined ? obj.corpsenm : NON_PM)
            : NON_PM;
        const fptr = ismnum(fx) ? mons[fx] : null;

        // Line 1013: Rider corpse check
        if (obj.otyp === CORPSE && fptr && is_rider(fptr))
            return TABU;

        // Line 1015: Petrification check
        if ((obj.otyp === CORPSE || obj.otyp === EGG)
            && fptr && flesh_petrifies(fptr)
            && !resists_ston(mon))
            return POISON;

        // Line 1019: Killer bee / royal jelly special case
        if (obj.otyp === LUMP_OF_ROYAL_JELLY
            && mptr === mons[PM_KILLER_BEE]) {
            return TABU; // simplified: assume queen exists
        }

        // Line 1027: Non-carnivore/herbivore can't eat
        if (!carni && !herbi)
            return obj.cursed ? UNDEF : APPORT;

        // Line 1030: Setup for diet-specific checks
        const starving = !!(mon.tame && !mon.isminion
                           && mon.edog && mon.edog.mhpmax_penalty);
        const mblind = false; // mon.mcansee is not tracked yet

        // Line 1036: Ghoul special case
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

        // Line 1050: Specific food type checks
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
            // Line 1061: Complex corpse logic
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

    // C: case ROCK_CLASS: return UNDEF
    if (obj.oclass === ROCK_CLASS)
        return UNDEF;

    // C: default (non-food, non-rock objects)
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

    // C: fallthrough to ROCK_CLASS → UNDEF
    return UNDEF;
}

// ========================================================================
// can_carry — check if monster can pick up an object
// C ref: dogmove.c:1971-2034 can_carry(mtmp, otmp)
// ========================================================================

const MAX_CARR_CAP = 1000; // C ref: weight.h

// C ref: dogmove.c:1908-1935 max_mon_load(mtmp)
// C field names: cwt → JS weight, msize → JS size
function max_mon_load(mon) {
    const mdat = monPtr(mon);
    if (!mdat) return 0;
    const strong = !!(mdat.flags2 & M2_STRONG);
    const cwt = mdat.weight || 0;  // C: permonst.cwt (corpse weight)
    const msize = mdat.size || 0;  // C: permonst.msize
    let maxload;

    if (!cwt) {
        maxload = (MAX_CARR_CAP * msize) / MZ_HUMAN;
    } else if (!strong || cwt > WT_HUMAN) {
        maxload = (MAX_CARR_CAP * cwt) / WT_HUMAN;
    } else {
        maxload = MAX_CARR_CAP; // strong monsters w/cwt <= WT_HUMAN
    }

    if (!strong) maxload = Math.floor(maxload / 2);
    if (maxload < 1) maxload = 1;

    return Math.floor(maxload);
}

// C ref: dogmove.c:1894-1905 curr_mon_load(mtmp)
function curr_mon_load(mon) {
    let load = 0;
    const throws = !!(monPtr(mon)?.flags2 & M2_ROCKTHROW);
    if (mon.minvent) {
        for (const obj of mon.minvent) {
            if (obj.otyp !== BOULDER || !throws)
                load += obj.owt || 0;
        }
    }
    return load;
}

// C ref: dogmove.c:1971-2034
// Returns: 0 if can't carry, or quantity that can be carried
// No RNG consumed (rn2 for huge stacks not relevant in early game)
export function can_carry(mon, obj) {
    const mdat = monPtr(mon);
    if (!mdat) return 0;

    // C: notake(mdat) — can't carry anything
    if (mdat.flags1 & M1_NOTAKE) return 0;

    // C: can_touch_safely — petrification and silver checks
    if ((obj.otyp === CORPSE || obj.otyp === EGG)
        && obj.corpsenm !== undefined
        && ismnum(obj.corpsenm)
        && flesh_petrifies(mons[obj.corpsenm])
        && !resists_ston(mon))
        return 0;
    if (mon_hates_silver(mon)
        && objectData[obj.otyp] && objectData[obj.otyp].material === SILVER)
        return 0;

    const iquan = obj.quan || 1;

    // C: nohands monsters can only carry 1 at a time (unless engulfer/dragon)
    if (iquan > 1 && (mdat.flags1 & M1_NOHANDS)) {
        let glomper = false;
        if (mdat.symbol === S_DRAGON
            && (obj.oclass === COIN_CLASS || obj.oclass === GEM_CLASS)) {
            glomper = true;
        } else {
            for (const atk of mdat.attacks || []) {
                if (atk.type === AT_ENGL) { glomper = true; break; }
            }
        }
        if (!glomper) return 1;
    }

    // C: steed check — skip (not implemented)
    // C: shopkeeper — skip (not relevant for pets)

    // C: peaceful but not tame
    if (mon.peaceful && !mon.tame) return 0;

    // C: boulder throwers carry unlimited boulders
    if ((mdat.flags2 & M2_ROCKTHROW) && obj.otyp === BOULDER) return iquan;

    // C: nymphs deal in stolen merchandise, not boulders/statues
    if (mdat.symbol === S_NYMPH)
        return (obj.oclass === ROCK_CLASS) ? 0 : iquan;

    // C: weight check — curr_load + new_weight > max_load
    if (curr_mon_load(mon) + (obj.owt || 0) > max_mon_load(mon)) return 0;

    return iquan;
}

// ========================================================================
// dog_eat — pet eats an object after moving to its position
// C ref: dogmove.c:217-342 dog_eat()
// RNG: dogfood() reward check → obj_resists(0,95) → rn2(100)
//      delobj → obj_resists(0,0) → rn2(100)
// ========================================================================

// C ref: dogmove.c:155-214 dog_nutrition()
// Sets mon.meating (turns spent eating) and returns nutrition value.
// No RNG consumed.
function dog_nutrition(mon, obj) {
    const mdat = monPtr(mon);
    if (!mdat) return 0;
    let nutrit;

    if (obj.oclass === FOOD_CLASS) {
        if (obj.otyp === CORPSE) {
            const corpsenm = obj.corpsenm !== undefined ? obj.corpsenm : 0;
            // C ref: dogmove.c:166
            mon.meating = 3 + (mons[corpsenm].weight >> 6);
            nutrit = mons[corpsenm].nutrition || 0;
        } else {
            // C ref: dogmove.c:169
            mon.meating = objectData[obj.otyp].delay || 0;
            nutrit = objectData[obj.otyp].nutrition || 0;
        }
        // C ref: dogmove.c:172-192 — size multiplier
        switch (mdat.size) {
            case MZ_TINY:     nutrit *= 8; break;
            case MZ_SMALL:    nutrit *= 6; break;
            default:
            case MZ_MEDIUM:   nutrit *= 5; break;
            case MZ_LARGE:    nutrit *= 4; break;
            case MZ_HUGE:     nutrit *= 3; break;
            case MZ_GIGANTIC: nutrit *= 2; break;
        }
        // C ref: dogmove.c:193-196 — eaten_stat for partially eaten (skip for now)
    } else if (obj.oclass === COIN_CLASS) {
        mon.meating = Math.floor((obj.quan || 1) / 2000) + 1;
        nutrit = Math.floor((obj.quan || 1) / 20);
    } else {
        // Non-food (metallivore, gelatinous cube, etc.)
        mon.meating = Math.floor((obj.owt || 0) / 20) + 1;
        nutrit = 5 * (objectData[obj.otyp].nutrition || 0);
    }
    return nutrit;
}

// Returns 2 if pet dies (not implemented), otherwise 1
// map is needed to remove the eaten object
export function dog_eat(mon, obj, map, turnCount, ctx = null) {
    const edog = mon.edog;
    if (!edog) return 1;
    const display = ctx?.display || null;
    const player = ctx?.player || null;
    const fov = ctx?.fov || null;
    const startX = Number.isInteger(ctx?.startX) ? ctx.startX : mon.mx;
    const startY = Number.isInteger(ctx?.startY) ? ctx.startY : mon.my;

    // C ref: dogmove.c:231-232 — clamp hungrytime
    if (edog.hungrytime < turnCount)
        edog.hungrytime = turnCount;

    // C ref: dogmove.c:233 — nutrition calculation (no RNG)
    let nutrit = dog_nutrition(mon, obj);

    // C ref: dogmove.c:241 — update hungrytime
    edog.hungrytime += nutrit;

    // C ref: dogmove.c:242-247 — clear confusion, starvation penalty
    mon.confused = 0;
    if (edog.mhpmax_penalty) {
        mon.mhpmax = (mon.mhpmax || 0) + edog.mhpmax_penalty;
        edog.mhpmax_penalty = 0;
    }

    // C ref: dogmove.c:248-249 — reduce flee time
    if (mon.flee && mon.fleetim > 1)
        mon.fleetim = Math.floor(mon.fleetim / 2);

    // C ref: dogmove.c:250-251 — increase tameness
    if (mon.tame < 20)
        mon.tame++;

    // C ref: dogmove.c:263-264 — split stacked food (quantity > 1)
    // splitobj creates a single-item copy; the original stays on the map
    let removeFromMap = true;
    if ((obj.quan || 1) > 1 && obj.oclass === FOOD_CLASS) {
        obj.quan--;
        // Create a virtual copy for the eaten portion (reward check uses otyp, invlet)
        obj = { ...obj, quan: 1 };
        removeFromMap = false; // original stays on map with reduced quantity
    }

    // C ref: dogmove.c:271-299 — report observed pet eating.
    if (display && player) {
        const seeObj = fov?.canSee ? fov.canSee(mon.mx, mon.my) : couldsee(map, player, mon.mx, mon.my);
        const sawPet = (fov?.canSee ? fov.canSee(startX, startY) : couldsee(map, player, startX, startY))
            && !mon.minvis;
        if (sawPet || (seeObj && !mon.minvis)) {
            display.putstr_message(`${monNam(mon, { capitalize: true })} eats ${doname(obj, null)}.`);
        } else if (seeObj) {
            display.putstr_message(`It eats ${doname(obj, null)}.`);
        }
    }

    // C ref: dogmove.c:313-337 — reward check + consume
    // (Not a rust monster with oerodeproof, so always hits the else branch)
    // Reward check: dogfood(mtmp, obj) == DOGFOOD && obj->invlet
    // dogfood → obj_resists(obj, 0, 95) → rn2(100)
    if (dogfood(mon, obj, turnCount) === DOGFOOD && obj.invlet) {
        // C ref: dogmove.c:318-325 — apport update
        edog.apport += Math.floor(200 / ((edog.dropdist || 0) + turnCount
                                          - (edog.droptime || 0)));
        if (edog.apport <= 0) edog.apport = 1;
    }

    // C ref: dogmove.c:337 — m_consume_obj → delobj → delobj_core
    // delobj_core calls obj_resists(obj, 0, 0) → rn2(100) (always false for non-invocation)
    obj_resists(obj, 0, 0); // consume rn2(100)
    if (removeFromMap) {
        map.removeObject(obj);
    }

    return 1;
}
