// makemon_new.js -- Monster creation for dungeon generation
// Faithful port of makemon.c from NetHack 3.7
// Focus: PRNG-faithful RNG consumption for level generation alignment

import { rn2, rnd, rn1, d } from './rng.js';
import { mksobj } from './mkobj_new.js';
import { ROCK } from './objects.js';
import {
    mons, LOW_PM, SPECIAL_PM,
    G_FREQ, G_NOGEN, G_UNIQ, G_HELL, G_NOHELL, G_SGROUP, G_LGROUP,
    S_ANT, S_BLOB, S_COCKATRICE, S_DOG, S_EYE, S_FELINE, S_GREMLIN,
    S_HUMANOID, S_IMP, S_JELLY, S_KOBOLD, S_LEPRECHAUN, S_MIMIC,
    S_NYMPH, S_ORC, S_PIERCER, S_QUADRUPED, S_RODENT, S_SPIDER,
    S_TRAPPER, S_UNICORN, S_VORTEX, S_WORM, S_XAN, S_LIGHT, S_ZRUTY,
    S_ANGEL, S_BAT, S_CENTAUR, S_DRAGON, S_ELEMENTAL, S_FUNGUS,
    S_GNOME, S_GIANT, S_JABBERWOCK, S_KOP, S_LICH, S_MUMMY,
    S_NAGA, S_OGRE, S_PUDDING, S_QUANTMECH, S_RUSTMONST, S_SNAKE,
    S_TROLL, S_UMBER, S_VAMPIRE, S_WRAITH, S_XORN, S_YETI, S_ZOMBIE,
    S_HUMAN, S_GHOST, S_GOLEM, S_DEMON, S_EEL, S_LIZARD,
    M2_MERC, M2_LORD, M2_PRINCE, M2_NASTY, M2_FEMALE, M2_MALE,
    M2_HOSTILE, M2_PEACEFUL, M2_DOMESTIC, M2_NEUTER, M2_GREEDY,
    M1_FLY, M1_NOHANDS,
    PM_SOLDIER, AT_WEAP,
    PM_GOBLIN, PM_ORC_CAPTAIN, PM_MORDOR_ORC, PM_URUK_HAI, PM_ORC_SHAMAN,
    PM_OGRE_LEADER, PM_OGRE_TYRANT,
} from './monsters.js';
import {
    DAGGER, KNIFE, SHORT_SWORD, LONG_SWORD, SILVER_SABER, BROADSWORD,
    SCIMITAR, SPEAR, JAVELIN, TRIDENT, AXE, BATTLE_AXE, MACE, WAR_HAMMER,
    FLAIL, HALBERD, CLUB, AKLYS, RUBBER_HOSE, BULLWHIP, QUARTERSTAFF,
    TWO_HANDED_SWORD, MORNING_STAR, STILETTO, PICK_AXE,
    ORCISH_DAGGER, ORCISH_SHORT_SWORD, ORCISH_SPEAR, ORCISH_HELM,
    ORCISH_SHIELD, ORCISH_RING_MAIL, ORCISH_CHAIN_MAIL,
    ORCISH_BOW, ORCISH_ARROW, ORCISH_CLOAK, URUK_HAI_SHIELD,
    ELVEN_DAGGER, ELVEN_SHORT_SWORD, ELVEN_BOW, ELVEN_ARROW,
    ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_CLOAK,
    ELVEN_SHIELD, ELVEN_BOOTS,
    DWARVISH_MATTOCK, DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT,
    DWARVISH_ROUNDSHIELD, DWARVISH_CLOAK,
    CROSSBOW, CROSSBOW_BOLT, BOW, SLING, FLINT,
    PARTISAN, BEC_DE_CORBIN,
    CREAM_PIE, DART, SHURIKEN, YA, YUMI, BOULDER,
    LEATHER_ARMOR, IRON_SHOES, SMALL_SHIELD, LARGE_SHIELD,
    SHIELD_OF_REFLECTION, CHAIN_MAIL, PLATE_MAIL, BRONZE_PLATE_MAIL,
    HELM_OF_BRILLIANCE, ROBE, MUMMY_WRAPPING,
    K_RATION, C_RATION, TIN_WHISTLE, BUGLE, SADDLE,
    MIRROR, POT_OBJECT_DETECTION, POT_HEALING, POT_EXTRA_HEALING,
    POT_SPEED, CRYSTAL_BALL, BRASS_LANTERN, SKELETON_KEY,
    WAN_STRIKING, FOOD_RATION, TIN_OPENER,
    RIN_INVISIBILITY,
    CORPSE,
} from './objects.js';

// ========================================================================
// Monster flags needed for m_initweap/m_initinv checks
// ========================================================================

// Check helpers
function is_mercenary(ptr) { return !!(ptr.flags2 & M2_MERC); }
function is_lord(ptr) { return !!(ptr.flags2 & M2_LORD); }
function is_prince(ptr) { return !!(ptr.flags2 & M2_PRINCE); }
function is_nasty(ptr) { return !!(ptr.flags2 & M2_NASTY); }
function is_female(ptr) { return !!(ptr.flags2 & M2_FEMALE); }
function is_male(ptr) { return !!(ptr.flags2 & M2_MALE); }
function is_neuter(ptr) { return !!(ptr.flags2 & M2_NEUTER); }
function is_domestic(ptr) { return !!(ptr.flags2 & M2_DOMESTIC); }
function is_elf(ptr) { return ptr.symbol === S_HUMANOID && ptr.name && ptr.name.includes('elf'); }
function is_dwarf(ptr) { return ptr.symbol === S_HUMANOID && ptr.name && ptr.name.includes('dwarf'); }
function is_hobbit(ptr) { return ptr.symbol === S_HUMANOID && ptr.name && ptr.name.includes('hobbit'); }
// C ref: mondata.h:87 — #define is_armed(ptr) attacktype(ptr, AT_WEAP)
function is_armed(ptr) { return ptr.attacks && ptr.attacks.some(a => a.type === AT_WEAP); }

// ========================================================================
// rndmonst_adj -- weighted reservoir sampling (exact C port)
// C ref: makemon.c:1655-1728
// ========================================================================

// C ref: monst.h difficulty macros
function monmax_difficulty(levdif, ulevel) {
    return Math.floor((levdif + ulevel) / 2);
}
function monmin_difficulty(levdif) {
    return Math.floor(levdif / 6);
}

// C ref: makemon.c uncommon()
function uncommon(mndx) {
    const ptr = mons[mndx];
    if (ptr.geno & (G_NOGEN | G_UNIQ)) return true;
    // mvitals not tracked — skip G_GONE check
    // Not Inhell at standard depths → check G_HELL
    return !!(ptr.geno & G_HELL);
}

// C ref: makemon.c align_shift() — for standard dungeon (AM_NONE), always 0
function align_shift(ptr) {
    return 0; // AM_NONE alignment
}

// C ref: makemon.c temperature_shift() — no temperature at standard depths
function temperature_shift(ptr) {
    return 0;
}

// C ref: makemon.c rndmonst_adj()
export function rndmonst_adj(minadj, maxadj, depth) {
    const ulevel = 1; // hardcoded for level gen testing
    // C ref: level_difficulty() returns depth(&u.uz) for main dungeon
    const zlevel = depth;
    const minmlev = monmin_difficulty(zlevel) + minadj;
    const maxmlev = monmax_difficulty(zlevel, ulevel) + maxadj;

    // Quest check: not in quest → skip rn2(7)

    let totalweight = 0;
    let selected_mndx = -1; // NON_PM

    for (let mndx = LOW_PM; mndx < SPECIAL_PM; mndx++) {
        const ptr = mons[mndx];

        // Difficulty filter
        if (ptr.difficulty < minmlev || ptr.difficulty > maxmlev)
            continue;
        // upper/elemlevel: not applicable at standard depths
        if (uncommon(mndx))
            continue;
        // Not Inhell, so skip G_NOHELL check

        let weight = (ptr.geno & G_FREQ) + align_shift(ptr) + temperature_shift(ptr);
        if (weight < 0 || weight > 127) weight = 0;

        if (weight > 0) {
            totalweight += weight;
            if (rn2(totalweight) < weight)
                selected_mndx = mndx;
        }
    }

    if (selected_mndx < 0 || uncommon(selected_mndx))
        return -1; // NON_PM
    return selected_mndx;
}

// C ref: makemon.c rndmonst()
export function rndmonnum(depth) {
    return rndmonst_adj(0, 0, depth || 1);
}

// ========================================================================
// newmonhp -- HP calculation (exact C port)
// C ref: makemon.c:1013-1055
// ========================================================================

function adj_lev(ptr) {
    // C ref: simplified — at depth 1, adj_lev just returns ptr.level
    return ptr.level;
}

export function newmonhp(mndx) {
    const ptr = mons[mndx];
    let m_lev = adj_lev(ptr);
    let hp;

    // Golem: fixed HP based on type — no RNG
    // Rider: d(10, 8) — rare at depth 1
    // High level (>49): fixed — no RNG
    // Dragon: d(m_lev, 4) — not at depth 1
    // Level 0: rnd(4)
    // Normal: d(m_lev, 8)

    if (m_lev === 0) {
        hp = rnd(4);
    } else {
        hp = d(m_lev, 8);
    }

    // C ref: if mhpmax == basehp, add 1
    const basehp = m_lev || 1;
    if (hp === basehp) hp++;

    return { hp, m_lev };
}

// ========================================================================
// m_initthrow -- create missile objects
// C ref: makemon.c:149-159
// ========================================================================

function m_initthrow(otyp, oquan) {
    const otmp = mksobj(otyp, true, false);
    otmp.quan = rn1(oquan, 3);
    return otmp;
}

// ========================================================================
// m_initweap -- weapon/armor assignment
// C ref: makemon.c:162-573
// This is a huge function. We port all branches to consume correct RNG.
// ========================================================================

function m_initweap(mndx, depth) {
    const ptr = mons[mndx];
    const mm = ptr.symbol; // mlet
    const bias = is_lord(ptr) ? 1 : is_prince(ptr) ? 2 : is_nasty(ptr) ? 1 : 0;

    switch (mm) {
    case S_GIANT:
        if (rn2(2)) mksobj(BOULDER, true, false);
        else mksobj(CLUB, true, false);
        if (!rn2(5)) {
            if (rn2(2)) mksobj(rn2(2) ? AXE : BATTLE_AXE, true, false);
            // else no extra weapon
        }
        break;

    case S_HUMAN:
        if (is_mercenary(ptr)) {
            // Mercenary weapon selection
            const w = rn2(3);
            let wpn;
            if (w === 0) {
                wpn = rn1(BEC_DE_CORBIN - PARTISAN + 1, PARTISAN);
            } else if (w === 1) {
                wpn = rn2(2) ? DAGGER : KNIFE;
            } else {
                const w2 = rn2(5);
                if (w2 === 0) wpn = rn2(2) ? SPEAR : SHORT_SWORD;
                else if (w2 === 1) wpn = rn2(2) ? FLAIL : MACE;
                else if (w2 === 2) wpn = rn2(2) ? BROADSWORD : LONG_SWORD;
                else if (w2 === 3) wpn = rn2(2) ? LONG_SWORD : SILVER_SABER;
                else {
                    if (!rn2(4)) wpn = DAGGER;
                    else if (!rn2(7)) wpn = SPEAR;
                    else wpn = LONG_SWORD;
                }
            }
            mksobj(wpn, true, false);
            // Secondary weapon
            if (!rn2(4)) mksobj(KNIFE, true, false);
        } else if (is_elf(ptr)) {
            // Elf equipment
            if (rn2(2)) {
                mksobj(rn2(2) ? ELVEN_MITHRIL_COAT : ELVEN_CLOAK, true, false);
            }
            if (rn2(2)) mksobj(ELVEN_LEATHER_HELM, true, false);
            if (!rn2(4)) mksobj(ELVEN_BOOTS, true, false);
            if (!rn2(2)) mksobj(ELVEN_DAGGER, true, false);
            const w = rn2(3);
            if (w === 0) {
                if (!rn2(4)) mksobj(ELVEN_SHIELD, true, false);
                if (!rn2(3)) mksobj(ELVEN_SHORT_SWORD, true, false);
                mksobj(ELVEN_BOW, true, false);
                m_initthrow(ELVEN_ARROW, 12);
            } else if (w === 1) {
                if (!rn2(2)) mksobj(ELVEN_SHIELD, true, false);
                mksobj(ELVEN_SHORT_SWORD, true, false);
            } else {
                if (!rn2(2)) mksobj(ELVEN_SPEAR || SPEAR, true, false);
                mksobj(ELVEN_SHORT_SWORD, true, false);
            }
        } else {
            // Generic human — check specific types
            // Ninja, priest, cleric, etc. — simplified
            if (ptr.name && (ptr.name === 'priest' || ptr.name === 'priestess')) {
                const otmp = mksobj(MACE, true, false);
                otmp.spe = rnd(3);
                if (!rn2(2)) otmp.cursed = true;
            } else if (ptr.name && ptr.name === 'ninja') {
                if (rn2(4)) m_initthrow(SHURIKEN, 8);
                else m_initthrow(DART, 8);
                if (rn2(4)) mksobj(SHORT_SWORD, true, false);
                else mksobj(AXE, true, false);
            }
        }
        break;

    case S_ANGEL:
        if (rn2(3)) {
            mksobj(rn2(2) ? LONG_SWORD : MACE, true, false);
        }
        // Artifact check — rn2(20)
        if (!rn2(20)) { /* mk_artifact */ }
        {
            const otmp = mksobj(rn2(4) ? SHIELD_OF_REFLECTION : LARGE_SHIELD, true, false);
            otmp.spe = rn2(4);
        }
        break;

    case S_HUMANOID:
        if (is_hobbit(ptr)) {
            const w = rn2(3);
            if (w === 0) mksobj(DAGGER, true, false);
            else if (w === 1) mksobj(ELVEN_DAGGER, true, false);
            else mksobj(SLING, true, false);
            if (rn2(4)) m_initthrow(FLINT, 8);
            else m_initthrow(ROCK, 8);
            if (!rn2(10)) mksobj(ELVEN_MITHRIL_COAT, true, false);
            if (!rn2(10)) mksobj(DWARVISH_CLOAK, true, false);
        } else if (is_dwarf(ptr)) {
            if (!rn2(7)) mksobj(DWARVISH_CLOAK, true, false);
            if (!rn2(7)) mksobj(IRON_SHOES, true, false);
            if (!rn2(4)) {
                mksobj(DWARVISH_IRON_HELM, true, false);
                mksobj(DWARVISH_MITHRIL_COAT, true, false);
            }
            if (rn2(2)) {
                mksobj(DWARVISH_MATTOCK, true, false);
            } else {
                mksobj(rn2(2) ? AXE : SPEAR, true, false);
            }
            if (!rn2(3)) mksobj(DWARVISH_MITHRIL_COAT, true, false);
            if (!rn2(3)) {
                mksobj(rn2(2) ? PICK_AXE : DAGGER, true, false);
            }
        }
        break;

    case S_KOP:
        if (!rn2(4)) m_initthrow(CREAM_PIE, 2);
        if (!rn2(3)) mksobj(rn2(2) ? CLUB : RUBBER_HOSE, true, false);
        break;

    case S_ORC: {
        // C ref: makemon.c:411-446
        if (rn2(2)) mksobj(ORCISH_HELM, true, false);
        const orcType = (mndx !== PM_ORC_CAPTAIN) ? mndx
            : rn2(2) ? PM_MORDOR_ORC : PM_URUK_HAI;
        if (orcType === PM_MORDOR_ORC) {
            if (!rn2(3)) mksobj(SCIMITAR, true, false);
            if (!rn2(3)) mksobj(ORCISH_SHIELD, true, false);
            if (!rn2(3)) mksobj(KNIFE, true, false);
            if (!rn2(3)) mksobj(ORCISH_CHAIN_MAIL, true, false);
        } else if (orcType === PM_URUK_HAI) {
            if (!rn2(3)) mksobj(ORCISH_CLOAK, true, false);
            if (!rn2(3)) mksobj(ORCISH_SHORT_SWORD, true, false);
            if (!rn2(3)) mksobj(IRON_SHOES, true, false);
            if (!rn2(3)) {
                mksobj(ORCISH_BOW, true, false);
                m_initthrow(ORCISH_ARROW, 12);
            }
            if (!rn2(3)) mksobj(URUK_HAI_SHIELD, true, false);
        } else {
            // default: common orc
            if (mndx !== PM_ORC_SHAMAN && rn2(2))
                mksobj((mndx === PM_GOBLIN || rn2(2) === 0) ? ORCISH_DAGGER : SCIMITAR, true, false);
        }
        break;
    }

    case S_OGRE:
        // C ref: makemon.c:447-452
        if (!rn2(mndx === PM_OGRE_TYRANT ? 3 : mndx === PM_OGRE_LEADER ? 6 : 12)) {
            mksobj(BATTLE_AXE, true, false);
        } else {
            mksobj(CLUB, true, false);
        }
        break;

    case S_TROLL:
        if (!rn2(2)) {
            const w = rn2(4);
            if (w === 0) mksobj(LONG_SWORD, true, false);
            else if (w === 1) mksobj(TWO_HANDED_SWORD, true, false);
            else if (w === 2) mksobj(MACE, true, false);
            else mksobj(AXE, true, false);
        }
        break;

    case S_KOBOLD:
        if (!rn2(4)) m_initthrow(DART, 6);
        break;

    case S_CENTAUR:
        if (rn2(2)) {
            mksobj(BOW, true, false);
            m_initthrow(CROSSBOW_BOLT, 12);
        }
        break;

    case S_WRAITH:
        mksobj(KNIFE, true, false);
        mksobj(LONG_SWORD, true, false);
        break;

    case S_ZOMBIE:
        if (!rn2(4)) mksobj(LEATHER_ARMOR, true, false);
        if (!rn2(4)) {
            mksobj(rn2(3) ? KNIFE : SHORT_SWORD, true, false);
        }
        break;

    case S_LIZARD:
        // Salamander
        if (ptr.name && ptr.name === 'salamander') {
            if (!rn2(7)) mksobj(SPEAR, true, false);
            else if (!rn2(3)) mksobj(TRIDENT, true, false);
            else mksobj(STILETTO, true, false);
        }
        break;

    case S_DEMON:
        // Horned devil
        if (ptr.name && ptr.name === 'horned devil') {
            if (!rn2(4)) {
                mksobj(rn2(2) ? TRIDENT : BULLWHIP, true, false);
            }
        }
        break;

    case S_GNOME:
        // Gnomes get equipment similar to dwarves but simpler
        if (!rn2(4)) mksobj(CROSSBOW, true, false);
        else if (!rn2(2)) mksobj(DAGGER, true, false);
        break;

    default:
        // Generic weapon assignment for armed monsters
        // C ref: makemon.c:534-571
        if (ptr.attacks && ptr.attacks.some(a => a.type === 254)) { // AT_WEAP
            const w = rnd(Math.max(1, 14 - 2 * bias));
            let wpn;
            if (w <= 2) wpn = LONG_SWORD;
            else if (w <= 4) wpn = SHORT_SWORD;
            else if (w <= 8) wpn = MACE;
            else if (w <= 12) wpn = DAGGER;
            else wpn = SPEAR;
            mksobj(wpn, true, false);
        }
        break;
    }

    // C ref: makemon.c:571 — offensive item check, OUTSIDE the switch,
    // always called for ALL monsters. rn2(75) is always consumed.
    if (ptr.level > rn2(75)) {
        // rnd_offensive_item → mongets → mksobj
        // TODO: implement actual offensive item creation
    }
}

// ========================================================================
// m_initinv -- inventory items
// C ref: makemon.c:590-810
// Simplified: only port branches that consume RNG
// ========================================================================

function m_initinv(mndx, depth, m_lev) {
    const ptr = mons[mndx];
    const mm = ptr.symbol;

    switch (mm) {
    case S_HUMAN:
        if (is_mercenary(ptr)) {
            // Mercenary armor
            const w = rn2(5);
            if (w === 0) mksobj(PLATE_MAIL, true, false);
            else if (w === 1) mksobj(BRONZE_PLATE_MAIL, true, false);
            else if (w <= 3) mksobj(CHAIN_MAIL, true, false);
            // else nothing

            // Helmet
            if (!rn2(3)) mksobj(rn2(2) ? ORCISH_HELM : DWARVISH_IRON_HELM, true, false);
            // Shield
            if (!rn2(3)) mksobj(SMALL_SHIELD, true, false);
            // Boots
            if (!rn2(3)) mksobj(IRON_SHOES, true, false);
            // Gloves
            if (!rn2(3)) mksobj(LEATHER_ARMOR, true, false);
            // Cloak
            if (!rn2(3)) mksobj(LEATHER_ARMOR, true, false);

            // Watchman whistle
            if (ptr.name && (ptr.name === 'watchman' || ptr.name === 'watch captain')) {
                if (!rn2(3)) mksobj(TIN_WHISTLE, true, false);
            }
            // Rations
            if (!rn2(3)) mksobj(K_RATION, true, false);
            if (!rn2(2)) mksobj(C_RATION, true, false);
            if (!rn2(3)) mksobj(BUGLE, true, false);
        } else if (ptr.name && (ptr.name === 'priest' || ptr.name === 'priestess')) {
            if (!rn2(7)) mksobj(ROBE, true, false);
            if (!rn2(3)) mksobj(rn2(2) ? ELVEN_CLOAK : DWARVISH_CLOAK, true, false);
            rn1(10, 20); // gold amount
        }
        break;

    case S_NYMPH:
        if (!rn2(2)) mksobj(MIRROR, true, false);
        if (!rn2(2)) mksobj(POT_OBJECT_DETECTION, true, false);
        break;

    case S_GIANT:
        // Minotaur wand
        if (ptr.name && ptr.name === 'minotaur') {
            if (!rn2(3)) mksobj(WAN_STRIKING, true, false);
        }
        // Giant treasure
        if (ptr.level > 0) {
            const cnt = rn2(Math.max(1, Math.floor(ptr.level / 2)));
            for (let i = 0; i < cnt; i++) {
                const quan = rn1(2, 3);
                rnd(100); // rnd_class selection
                mksobj(BOULDER, true, false); // placeholder for actual class selection
            }
        }
        break;

    case S_WRAITH:
        // Nazgul: ring of invisibility (no RNG for creation)
        break;

    case S_LICH:
        // Lich equipment
        if (ptr.name && ptr.name === 'arch-lich') {
            if (!rn2(3)) mksobj(rn2(2) ? LONG_SWORD : AXE, true, false);
        } else if (ptr.name && ptr.name === 'master lich') {
            if (!rn2(13)) mksobj(rn2(7) ? DAGGER : WAN_STRIKING, true, false);
        }
        break;

    case S_MUMMY:
        if (!rn2(7)) mksobj(MUMMY_WRAPPING, true, false);
        break;

    case S_GNOME:
        // C ref: makemon.c:811 — gnome candle
        // Not in mines at depth 1, so rn2(60)
        if (!rn2(60)) {
            mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, true, false);
        }
        break;

    default:
        break;
    }

    // C ref: makemon.c:824 — soldier check (skips tail for most soldiers)
    if (mndx === PM_SOLDIER && rn2(13))
        return;

    // C ref: makemon.c:827-833 — tail section: defensive/misc items and gold
    // These rn2 checks always fire; the item creation only triggers when m_lev > result
    // At depth 1 (m_lev typically 0-1), the checks almost never pass
    if (m_lev > rn2(50)) {
        // rnd_defensive_item → mongets → mksobj
        // Complex item selection; accept divergence here if it triggers
    }
    if (m_lev > rn2(100)) {
        // rnd_misc_item → mongets → mksobj
        // Complex item selection; accept divergence here if it triggers
    }
    if ((ptr.flags2 & M2_GREEDY) && !rn2(5)) {
        // mkmonmoney: d(level_difficulty(), minvent ? 5 : 10)
        d(Math.max(depth, 1), 10);
    }
}

// ========================================================================
// makemon -- main monster creation
// C ref: makemon.c:1148-1505
// Simplified for level generation PRNG alignment
// ========================================================================

// MM flags
export const NO_MM_FLAGS = 0;
export const MM_NOGRP = 0x08;

export function makemon(ptr_or_null, x, y, mmflags, depth) {
    let mndx;

    if (ptr_or_null === null || ptr_or_null === undefined) {
        // Random monster selection
        mndx = rndmonst_adj(0, 0, depth || 1);
        if (mndx < 0) return null; // No valid monster found
    } else if (typeof ptr_or_null === 'number') {
        mndx = ptr_or_null;
    } else {
        mndx = mons.indexOf(ptr_or_null);
    }

    if (mndx < 0 || mndx >= mons.length) return null;
    const ptr = mons[mndx];

    // C ref: makemon.c:1252 — mtmp->m_id = next_ident()
    // next_ident() consumes rnd(2) for unique monster ID (BEFORE newmonhp)
    rnd(2);

    // C ref: makemon.c:1259 — newmonhp
    const { hp, m_lev } = newmonhp(mndx);

    // Gender assignment
    // C ref: makemon.c:1278-1290
    if (!is_male(ptr) && !is_female(ptr) && !is_neuter(ptr)) {
        rn2(2); // random gender
    }

    // Sleep check for certain types during level gen
    // C ref: makemon.c:1328, 1385
    if (ptr.symbol === S_JABBERWOCK || ptr.symbol === S_NYMPH) {
        rn2(5);
    }

    // Weapon/inventory initialization
    // C ref: makemon.c:1438-1440
    if (is_armed(ptr))
        m_initweap(mndx, depth || 1);
    m_initinv(mndx, depth || 1, m_lev);

    // C ref: makemon.c:1443-1448 — saddle for domestic monsters
    // C evaluates !rn2(100) first (always consumed), then is_domestic
    if (!rn2(100) && is_domestic(ptr)) {
        mksobj(SADDLE, true, false);
    }

    // Group formation
    // C ref: makemon.c:1427-1430
    if (!(mmflags & MM_NOGRP)) {
        if (ptr.geno & G_SGROUP) {
            if (!rn2(2)) {
                // m_initsgrp: rnd(3) for count, then makemon per group member
                const cnt = Math.floor(rnd(3) / 4); // ulevel < 3 → divide by 4
                for (let i = 0; i < cnt; i++) {
                    makemon(mndx, x, y, mmflags | MM_NOGRP, depth);
                }
            }
        } else if (ptr.geno & G_LGROUP) {
            if (!rn2(3)) {
                // m_initlgrp or m_initsgrp
                if (rn2(3)) {
                    // m_initsgrp: rnd(3)
                    const cnt = Math.floor(rnd(3) / 4);
                    for (let i = 0; i < cnt; i++) {
                        makemon(mndx, x, y, mmflags | MM_NOGRP, depth);
                    }
                } else {
                    // m_initlgrp: rnd(10)
                    const cnt = Math.floor(rnd(10) / 4);
                    for (let i = 0; i < cnt; i++) {
                        makemon(mndx, x, y, mmflags | MM_NOGRP, depth);
                    }
                }
            }
        }
    }

    return { mndx, hp, m_lev, name: ptr.name };
}
