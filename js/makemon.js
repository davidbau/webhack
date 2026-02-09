// makemon.js -- Monster creation
// Faithful port of makemon.c from NetHack 3.7
// C ref: makemon.c — monster creation, selection, weapon/inventory assignment

import { rn2, rnd, rn1, d } from './rng.js';
import { mksobj, mkobj, next_ident } from './mkobj.js';
import { def_monsyms } from './symbols.js';
import { SHOPBASE, ROOMOFFSET } from './config.js';

// Registration for get_shop_item to avoid circular dependency with shknam.js.
// shknam.js calls registerGetShopItem() during initialization.
let _getShopItem = null;
export function registerGetShopItem(fn) { _getShopItem = fn; }
import {
    mons, LOW_PM, SPECIAL_PM, MAXMCLASSES,
    G_FREQ, G_NOGEN, G_UNIQ, G_HELL, G_NOHELL, G_SGROUP, G_LGROUP,
    G_NOCORPSE, G_IGNORE,
    S_ANT, S_BLOB, S_COCKATRICE, S_DOG, S_EYE, S_FELINE, S_GREMLIN,
    S_HUMANOID, S_IMP, S_JELLY, S_KOBOLD, S_LEPRECHAUN, S_MIMIC,
    S_NYMPH, S_ORC, S_PIERCER, S_QUADRUPED, S_RODENT, S_SPIDER,
    S_TRAPPER, S_UNICORN, S_VORTEX, S_WORM, S_XAN, S_LIGHT, S_ZRUTY,
    S_ANGEL, S_BAT, S_CENTAUR, S_DRAGON, S_ELEMENTAL, S_FUNGUS,
    S_GNOME, S_GIANT, S_JABBERWOCK, S_KOP, S_LICH, S_MUMMY,
    S_NAGA, S_OGRE, S_PUDDING, S_QUANTMECH, S_RUSTMONST, S_SNAKE,
    S_TROLL, S_UMBER, S_VAMPIRE, S_WRAITH, S_XORN, S_YETI, S_ZOMBIE,
    S_HUMAN, S_GHOST, S_GOLEM, S_DEMON, S_EEL, S_LIZARD, S_MIMIC_DEF,
    M2_MERC, M2_LORD, M2_PRINCE, M2_NASTY, M2_FEMALE, M2_MALE,
    M2_HOSTILE, M2_PEACEFUL, M2_DOMESTIC, M2_NEUTER, M2_GREEDY,
    M1_FLY, M1_NOHANDS,
    PM_ORC, PM_GIANT, PM_ELF, PM_HUMAN,
    PM_SOLDIER, PM_SHOPKEEPER, AT_WEAP, AT_EXPL, PM_PESTILENCE,
    PM_GOBLIN, PM_ORC_CAPTAIN, PM_MORDOR_ORC, PM_URUK_HAI, PM_ORC_SHAMAN,
    PM_OGRE_LEADER, PM_OGRE_TYRANT, PM_GHOST,
} from './monsters.js';
import {
    ROCK, STATUE, FIGURINE, EGG, TIN, STRANGE_OBJECT, GOLD_PIECE,
    RING_CLASS, WAND_CLASS, WEAPON_CLASS, FOOD_CLASS, COIN_CLASS,
    SCROLL_CLASS, POTION_CLASS, ARMOR_CLASS, AMULET_CLASS, TOOL_CLASS,
    ROCK_CLASS, GEM_CLASS, SPBOOK_CLASS,
    TALLOW_CANDLE, WAX_CANDLE,
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
    POT_FULL_HEALING, POT_SICKNESS,
    POT_SPEED, CRYSTAL_BALL, BRASS_LANTERN, SKELETON_KEY,
    WAN_STRIKING, FOOD_RATION, TIN_OPENER,
    WAN_MAGIC_MISSILE, WAN_DEATH, WAN_SLEEP, WAN_FIRE, WAN_COLD, WAN_LIGHTNING,
    WAN_TELEPORTATION, WAN_CREATE_MONSTER, WAN_DIGGING,
    POT_ACID, POT_CONFUSION, POT_BLINDNESS, POT_SLEEPING, POT_PARALYSIS,
    SCR_EARTH, SCR_TELEPORTATION, SCR_CREATE_MONSTER,
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
function attacktype(ptr, atyp) { return ptr.attacks && ptr.attacks.some(a => a.type === atyp); }
function is_animal(ptr) { return !!(ptr.flags1 & 0x00000001); } // M1_ANIMAL
function mindless(ptr) { return !!(ptr.flags1 & 0x00008000); } // M1_MINDLESS

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
// mkclass -- Pick a random monster of a given class
// C ref: makemon.c:1750-1967
// ========================================================================

const A_NONE = 0;
const G_GENO = 0x0020;
const G_GONE = 0x03; // G_GENOD | G_EXTINCT (mvflags)

// C ref: mondata.h is_placeholder()
function is_placeholder(mndx) {
    return mndx === PM_ORC || mndx === PM_GIANT
        || mndx === PM_ELF || mndx === PM_HUMAN;
}

// C ref: makemon.c mk_gen_ok()
function mk_gen_ok(mndx, mvflagsmask, genomask) {
    const ptr = mons[mndx];
    // mvitals not tracked yet — skip mvflagsmask check
    if (ptr.geno & genomask) return false;
    if (is_placeholder(mndx)) return false;
    return true;
}

// C ref: makemon.c:1750-1823 mongen_order initialization
let mongen_order = null;
let mclass_maxf = null;

function init_mongen_order() {
    if (mongen_order) return;
    mongen_order = [];
    mclass_maxf = new Array(MAXMCLASSES).fill(0);
    for (let i = LOW_PM; i < SPECIAL_PM; i++) {
        mongen_order.push(i);
        const mlet = mons[i].symbol;
        const freq = mons[i].geno & G_FREQ;
        if (freq > mclass_maxf[mlet])
            mclass_maxf[mlet] = freq;
    }
    // C ref: qsort by (mlet << 8) | difficulty, ascending
    mongen_order.sort((a, b) => {
        const ka = (mons[a].symbol << 8) | mons[a].difficulty;
        const kb = (mons[b].symbol << 8) | mons[b].difficulty;
        return ka - kb;
    });
}

// C ref: makemon.c:2007-2039 adj_lev()
function adj_lev(ptr, depth = 1) {
    const ulevel = 1; // during level gen
    let tmp = ptr.level;
    if (tmp > 49) return 50;
    let tmp2 = depth - tmp;
    if (tmp2 < 0) tmp--;
    else tmp += Math.floor(tmp2 / 5);
    tmp2 = ulevel - ptr.level;
    if (tmp2 > 0) tmp += Math.floor(tmp2 / 4);
    tmp2 = Math.floor(3 * ptr.level / 2);
    if (tmp2 > 49) tmp2 = 49;
    return tmp > tmp2 ? tmp2 : (tmp > 0 ? tmp : 0);
}

// C ref: monst.h montoostrong(monindx, lev)
function montoostrong(mndx, lev) {
    return mons[mndx].difficulty > lev;
}

// C ref: makemon.c:1866-1967 mkclass() / mkclass_aligned()
// Returns monster index (mndx) or -1 (NON_PM)
export function mkclass(monclass, spc, depth = 1, atyp = A_NONE) {
    const ulevel = 1;
    const maxmlev = depth >> 1; // level_difficulty() >> 1
    const gehennom = 0; // not in hell during level gen

    init_mongen_order();
    const zero_freq_for_entire_class = (mclass_maxf[monclass] === 0);

    // Find first monster of this class in sorted order
    let first;
    for (first = 0; first < SPECIAL_PM; first++) {
        if (mons[mongen_order[first]].symbol === monclass) break;
    }
    if (first === SPECIAL_PM) return -1;

    let mv_mask = G_GONE;
    if (spc & G_IGNORE) {
        mv_mask = 0;
        spc &= ~G_IGNORE;
    }

    let num = 0;
    const nums = new Array(SPECIAL_PM + 1).fill(0);
    let last;

    for (last = first; last < SPECIAL_PM && mons[mongen_order[last]].symbol === monclass; last++) {
        const mndx = mongen_order[last];

        // Alignment filter (for mkclass_aligned)
        if (atyp !== A_NONE && Math.sign(mons[mndx].align) !== Math.sign(atyp))
            continue;

        // C ref: hell/nohell gating — rn2(9) per candidate
        let gn_mask = G_NOGEN | G_UNIQ;
        if (rn2(9) || monclass === S_LICH)
            gn_mask |= (gehennom ? G_NOHELL : G_HELL);
        gn_mask &= ~spc;

        if (mk_gen_ok(mndx, mv_mask, gn_mask)) {
            // C ref: montoostrong early exit — conditional rn2(2)
            if (num && montoostrong(mndx, maxmlev)
                && mons[mndx].difficulty > mons[mongen_order[last - 1]].difficulty
                && rn2(2))
                break;
            let k = mons[mndx].geno & G_FREQ;
            if (k === 0 && zero_freq_for_entire_class) k = 1;
            if (k > 0) {
                // Skew toward lower monsters at lower levels
                nums[mndx] = k + 1 - (adj_lev(mons[mndx], depth) > (ulevel * 2) ? 1 : 0);
                num += nums[mndx];
            }
        }
    }

    if (!num) return -1;

    // C ref: final selection — rnd(num)
    let roll = rnd(num);
    for (let i = first; i < last; i++) {
        const mndx = mongen_order[i];
        roll -= nums[mndx];
        if (roll <= 0)
            return nums[mndx] ? mndx : -1;
    }
    return -1;
}

// C ref: drawing.c def_char_to_monclass()
export function def_char_to_monclass(ch) {
    for (let i = 1; i < MAXMCLASSES; i++) {
        if (ch === def_monsyms[i].sym) return i;
    }
    return MAXMCLASSES;
}

// ========================================================================
// newmonhp -- HP calculation (exact C port)
// C ref: makemon.c:1013-1055
// ========================================================================

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
        if (!rn2(4)) m_initthrow(DART, 12);
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
        // C ref: muse.c rnd_offensive_item()
        // Skip for animals, exploders, mindless, ghosts, kops
        const difficulty = ptr.difficulty || ptr.level;
        let otyp = 0;
        if (ptr.symbol !== S_GHOST && ptr.symbol !== S_KOP) {
            if (difficulty > 7 && !rn2(35)) {
                otyp = WAN_DEATH;
            } else {
                const range = 9 - (difficulty < 4 ? 1 : 0) + 4 * (difficulty > 6 ? 1 : 0);
                const pick = rn2(range);
                switch (pick) {
                case 0: otyp = SCR_EARTH; break; // may fall through to case 1 in C, but RNG same
                case 1: otyp = WAN_STRIKING; break;
                case 2: otyp = POT_ACID; break;
                case 3: otyp = POT_CONFUSION; break;
                case 4: otyp = POT_BLINDNESS; break;
                case 5: otyp = POT_SLEEPING; break;
                case 6: otyp = POT_PARALYSIS; break;
                case 7: case 8: otyp = WAN_MAGIC_MISSILE; break;
                case 9: otyp = WAN_SLEEP; break;
                case 10: otyp = WAN_FIRE; break;
                case 11: otyp = WAN_COLD; break;
                case 12: otyp = WAN_LIGHTNING; break;
                }
            }
        }
        if (otyp) mksobj(otyp, true, false);
    }
}

// ========================================================================
// rnd_defensive_item -- select random defensive item for monster
// C ref: muse.c:1221-1274
// ========================================================================

function rnd_defensive_item(mndx) {
    const ptr = mons[mndx];
    const difficulty = ptr.difficulty || 0;
    let trycnt = 0;

    // Animals, exploders, mindless, ghosts, Kops don't get defensive items
    if (is_animal(ptr) || attacktype(ptr, AT_EXPL) || mindless(ptr)
        || ptr.symbol === S_GHOST || ptr.symbol === S_KOP) {
        return 0;
    }

    // Difficulty-based item selection (with retry loop for teleport cases)
    while (true) {
        const roll = rn2(8 + (difficulty > 3 ? 1 : 0) + (difficulty > 6 ? 1 : 0) + (difficulty > 8 ? 1 : 0));

        switch (roll) {
        case 6:
        case 9:
            // Note: noteleport_level check omitted (always false at level gen)
            if (++trycnt < 2) {
                continue; // try_again
            }
            if (!rn2(3)) return WAN_TELEPORTATION;
            // Fall through
        case 0:
        case 1:
            return SCR_TELEPORTATION;
        case 8:
        case 10:
            if (!rn2(3)) return WAN_CREATE_MONSTER;
            // Fall through
        case 2:
            return SCR_CREATE_MONSTER;
        case 3:
            return POT_HEALING;
        case 4:
            return POT_EXTRA_HEALING;
        case 5:
            return (mndx !== PM_PESTILENCE) ? POT_FULL_HEALING : POT_SICKNESS;
        case 7:
            // Note: Sokoban check omitted (not during level gen), shopkeeper/priest checks omitted
            return WAN_DIGGING;
        }
        return 0;
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
        } else if (mndx === PM_SHOPKEEPER) {
            // C ref: makemon.c:703-721 — SKELETON_KEY + fall-through switch
            mksobj(SKELETON_KEY, true, false);
            const w = rn2(4);
            // MAJOR fall through: case 0 gets all items, case 3 only WAN_STRIKING
            if (w <= 0) mksobj(WAN_MAGIC_MISSILE, true, false);
            if (w <= 1) mksobj(POT_EXTRA_HEALING, true, false);
            if (w <= 2) mksobj(POT_HEALING, true, false);
            mksobj(WAN_STRIKING, true, false); // case 3 always executes
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
        const otyp = rnd_defensive_item(mndx);
        if (otyp) mksobj(otyp, true, false);
    }
    if (m_lev > rn2(100)) {
        // rnd_misc_item → mongets → mksobj
        // TODO: Implement rnd_misc_item when needed
    }
    if ((ptr.flags2 & M2_GREEDY) && !rn2(5)) {
        // mkmonmoney: d(level_difficulty(), minvent ? 5 : 10)
        d(Math.max(depth, 1), 10);
    }
}

// ========================================================================
// ========================================================================
// set_mimic_sym — assign mimic appearance
// C ref: makemon.c:2386-2475
// For RNG alignment during level generation.
// During mklev, mimics are placed in ordinary rooms (OROOM), so we always
// take the default "else" branch: ROLL_FROM(syms) → rn2(17).
// ========================================================================

const MAXOCLASSES = 18; // C ref: config.h

// C ref: makemon.c:2378 — syms[] array for mimic appearance
const mimic_syms = [
    MAXOCLASSES,  MAXOCLASSES,     RING_CLASS,   WAND_CLASS,   WEAPON_CLASS,
    FOOD_CLASS,   COIN_CLASS,      SCROLL_CLASS, POTION_CLASS, ARMOR_CLASS,
    AMULET_CLASS, TOOL_CLASS,      ROCK_CLASS,   GEM_CLASS,    SPBOOK_CLASS,
    S_MIMIC_DEF,  S_MIMIC_DEF,
];

function set_mimic_sym(mndx, x, y, map, depth) {
    // C ref: makemon.c:2386-2540 — determine mimic appearance
    // Look up room type at (x, y) from map
    let rt = 0;
    if (map && map.at) {
        const loc = map.at(x, y);
        if (loc && loc.roomno >= ROOMOFFSET) {
            const roomIdx = loc.roomno - ROOMOFFSET;
            if (roomIdx >= 0 && roomIdx < map.rooms.length) {
                rt = map.rooms[roomIdx].rtype;
            }
        }
    }

    // Determine s_sym and possibly set appear directly
    let s_sym;
    let appear;

    if (rt >= SHOPBASE) {
        // C ref: makemon.c:2460-2479 — shop mimic appearance
        if (rn2(10) >= (depth || 1)) {
            s_sym = S_MIMIC_DEF;
            // fall through to assign_sym below
        } else {
            s_sym = _getShopItem(rt - SHOPBASE);
            if (s_sym < 0) {
                // Specific item type: appear = -s_sym (no goto assign_sym)
                appear = -s_sym;
            } else if (rt === SHOPBASE + 10 && s_sym > MAXOCLASSES) {
                // FODDERSHOP: health food store with VEGETARIAN_CLASS
                rn2(2); // C: rn2(2) ? LUMP_OF_ROYAL_JELLY : SLIME_MOLD
                return; // no post-fixup RNG for these items
            } else {
                if (s_sym === 0 || s_sym >= MAXOCLASSES) // RANDOM_CLASS or VEGETARIAN
                    s_sym = mimic_syms[rn2(15) + 2]; // syms[rn2(SIZE(syms)-2)+2]
                // fall through to assign_sym below
            }
        }
    } else {
        // Default: ROLL_FROM(syms) = syms[rn2(17)]
        s_sym = mimic_syms[rn2(17)];
    }

    // assign_sym logic (only if appear not already set)
    if (appear === undefined) {
        if (s_sym === MAXOCLASSES) {
            // Furniture appearance: rn2(8) from furnsyms
            rn2(8);
            // No further RNG — furniture doesn't trigger corpsenm fixup
            return;
        } else if (s_sym === S_MIMIC_DEF) {
            appear = STRANGE_OBJECT;
        } else if (s_sym === COIN_CLASS) {
            appear = GOLD_PIECE;
        } else {
            // mkobj(s_sym, FALSE) — create a temp object to get its otyp
            // This consumes RNG for object selection + mksobj init.
            // C then calls obfree() to discard it.
            const obj = mkobj(s_sym, false);
            appear = obj ? obj.otyp : STRANGE_OBJECT;
        }
    }

    // Post-fixup: if appearance is STATUE/FIGURINE/CORPSE/EGG/TIN,
    // pick a monster type for corpsenm
    // C ref: makemon.c:2508-2518
    if (appear === STATUE || appear === FIGURINE
        || appear === CORPSE || appear === EGG || appear === TIN) {
        const rndmndx = rndmonnum();
        const nocorpse = (mons[rndmndx].geno & G_NOCORPSE) !== 0;
        if (appear === CORPSE && nocorpse) {
            // C: rn1(PM_WIZARD - PM_ARCHEOLOGIST + 1, PM_ARCHEOLOGIST) = rn1(13, 330)
            rn1(13, 330); // consumes 1 rn2(13) call
        }
        // For EGG with non-hatchable or TIN with nocorpse: mndx = NON_PM (no extra RNG)
    }
}

// makemon -- main monster creation
// C ref: makemon.c:1148-1505
// Simplified for level generation PRNG alignment
// ========================================================================

// MM flags
export const NO_MM_FLAGS = 0;
export const MM_NOGRP = 0x08;

// C ref: makemon.c makemon_rnd_goodpos() — find random valid position
// Tries up to 50 random positions using rn2(COLNO-3)+2, rn2(ROWNO).
// During mklev, cansee() is FALSE so it always checks goodpos.
// Simplified goodpos: SPACE_POS(typ) terrain, no monster already there.
function makemon_rnd_goodpos(map, ptr) {
    const COLNO = 80, ROWNO = 21;
    const DOOR = 23; // SPACE_POS(typ) = typ > DOOR
    for (let tryct = 0; tryct < 50; tryct++) {
        const nx = rn2(COLNO - 3) + 2; // rn1(COLNO-3, 2)
        const ny = rn2(ROWNO);
        if (!map.at) continue;
        const loc = map.at(nx, ny);
        if (!loc) continue;
        // C ref: goodpos checks accessible terrain
        if (loc.typ <= DOOR) continue; // wall, stone, door — not SPACE_POS
        // Check no monster at this position
        let occupied = false;
        if (map.monsters) {
            for (const m of map.monsters) {
                if (m.mx === nx && m.my === ny) { occupied = true; break; }
            }
        }
        if (occupied) continue;
        return { x: nx, y: ny };
    }
    // Exhaustive search fallback (no RNG consumed)
    for (let nx = 2; nx < COLNO - 1; nx++) {
        for (let ny = 0; ny < ROWNO; ny++) {
            const loc = map.at(nx, ny);
            if (!loc || loc.typ <= DOOR) continue;
            let occupied = false;
            if (map.monsters) {
                for (const m of map.monsters) {
                    if (m.mx === nx && m.my === ny) { occupied = true; break; }
                }
            }
            if (!occupied) return { x: nx, y: ny };
        }
    }
    return null;
}

export function makemon(ptr_or_null, x, y, mmflags, depth, map) {
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

    // C ref: makemon.c:1173-1178 — random position finding for (0,0)
    if (x === 0 && y === 0 && map) {
        const pos = makemon_rnd_goodpos(map, ptr);
        if (pos) { x = pos.x; y = pos.y; }
        else return null;
    }

    // C ref: makemon.c:1252 — mtmp->m_id = next_ident()
    // next_ident() returns counter value and consumes rnd(2)
    const m_id = next_ident();

    // C ref: makemon.c:1259 — newmonhp
    const { hp, m_lev } = newmonhp(mndx);

    // Gender assignment
    // C ref: makemon.c:1278-1290
    if (!is_male(ptr) && !is_female(ptr) && !is_neuter(ptr)) {
        rn2(2); // random gender
    }

    // C ref: makemon.c:1299-1310 — post-placement switch on mlet
    if (ptr.symbol === S_MIMIC) {
        set_mimic_sym(mndx, x, y, map, depth);
    } else if ((ptr.symbol === S_SPIDER || ptr.symbol === S_SNAKE) && map) {
        // C ref: in_mklev && x && y → mkobj_at(RANDOM_CLASS, x, y, TRUE)
        // mkobj_at creates a random object (consumes RNG), then hideunder (no RNG)
        if (x && y) {
            mkobj(0, true); // RANDOM_CLASS = 0, artif = true
        }
        // hideunder() — no RNG
    }

    // Sleep check for certain types during level gen
    // C ref: makemon.c:1328, 1385
    if (ptr.symbol === S_JABBERWOCK || ptr.symbol === S_NYMPH) {
        rn2(5);
    }

    // C ref: makemon.c:1370-1371 — ghost naming via rndghostname()
    // rndghostname: rn2(7), and if nonzero, rn2(34) to pick from ghostnames
    if (mndx === PM_GHOST) {
        if (rn2(7)) {
            rn2(34); // ROLL_FROM(ghostnames)
        }
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
                    makemon(mndx, x, y, mmflags | MM_NOGRP, depth, map);
                }
            }
        } else if (ptr.geno & G_LGROUP) {
            if (!rn2(3)) {
                // m_initlgrp or m_initsgrp
                if (rn2(3)) {
                    // m_initsgrp: rnd(3)
                    const cnt = Math.floor(rnd(3) / 4);
                    for (let i = 0; i < cnt; i++) {
                        makemon(mndx, x, y, mmflags | MM_NOGRP, depth, map);
                    }
                } else {
                    // m_initlgrp: rnd(10)
                    const cnt = Math.floor(rnd(10) / 4);
                    for (let i = 0; i < cnt; i++) {
                        makemon(mndx, x, y, mmflags | MM_NOGRP, depth, map);
                    }
                }
            }
        }
    }

    // Build full monster object for gameplay
    const symEntry = def_monsyms[ptr.symbol];
    const mon = {
        mndx,
        m_id,
        type: ptr,
        name: ptr.name,
        displayChar: symEntry ? symEntry.sym : '?',
        displayColor: ptr.color,
        mx: x,
        my: y,
        mhp: hp,
        mhpmax: hp,
        mlevel: m_lev,
        mac: ptr.ac,
        speed: ptr.speed,
        movement: 0,  // C ref: *mtmp = cg.zeromonst (zero-init)
        attacks: ptr.attacks,
        peaceful: false,
        tame: false,
        flee: false,
        confused: false,
        stunned: false,
        blind: false,
        sleeping: false,  // sleep handled by C's finalize_creation, not here
        dead: false,
        passive: false,
        mtrack: [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],
    };

    // Add to map if provided
    if (map && x !== undefined && y !== undefined) {
        map.monsters.unshift(mon); // C ref: fmon prepend (LIFO order)
    }

    return mon;
}

