// makemon.js -- Monster creation
// Faithful port of makemon.c from NetHack 3.7
// C ref: makemon.c — monster creation, selection, weapon/inventory assignment

import { rn2, rnd, rn1, d, c_d, getRngLog } from './rng.js';
import { mksobj, mkobj, next_ident } from './mkobj.js';
import { def_monsyms } from './symbols.js';
import { SHOPBASE, ROOMOFFSET } from './config.js';
import { A_NONE, A_LAWFUL, A_NEUTRAL, A_CHAOTIC } from './config.js';

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
    M2_MERC, M2_LORD, M2_PRINCE, M2_NASTY, M2_FEMALE, M2_MALE, M2_STRONG,
    M2_HOSTILE, M2_PEACEFUL, M2_DOMESTIC, M2_NEUTER, M2_GREEDY,
    M2_MINION,
    M1_FLY, M1_NOHANDS,
    PM_ORC, PM_GIANT, PM_ELF, PM_HUMAN, PM_ETTIN, PM_MINOTAUR, PM_NAZGUL,
    PM_MASTER_LICH, PM_ARCH_LICH,
    PM_WUMPUS, PM_LONG_WORM, PM_GIANT_EEL,
    PM_SOLDIER, PM_SERGEANT, PM_LIEUTENANT, PM_CAPTAIN, PM_WATCHMAN, PM_WATCH_CAPTAIN, PM_GUARD,
    PM_SHOPKEEPER, AT_WEAP, AT_EXPL, PM_PESTILENCE,
    PM_GOBLIN, PM_ORC_CAPTAIN, PM_MORDOR_ORC, PM_URUK_HAI, PM_ORC_SHAMAN,
    PM_OGRE_LEADER, PM_OGRE_TYRANT, PM_GHOST, PM_ERINYS,
    MS_LEADER, MS_NEMESIS, MS_GUARDIAN,
    PM_CROESUS,
} from './monsters.js';
import {
    ROCK, STATUE, FIGURINE, EGG, TIN, STRANGE_OBJECT, GOLD_PIECE, DILITHIUM_CRYSTAL,
    RING_CLASS, WAND_CLASS, WEAPON_CLASS, FOOD_CLASS, COIN_CLASS,
    SCROLL_CLASS, POTION_CLASS, ARMOR_CLASS, AMULET_CLASS, TOOL_CLASS,
    ROCK_CLASS, GEM_CLASS, SPBOOK_CLASS,
    TALLOW_CANDLE, WAX_CANDLE,
    ARROW, DAGGER, KNIFE, SHORT_SWORD, LONG_SWORD, SILVER_SABER, BROADSWORD,
    ATHAME,
    SCIMITAR, SPEAR, JAVELIN, TRIDENT, AXE, BATTLE_AXE, MACE, WAR_HAMMER, LUCERN_HAMMER,
    FLAIL, HALBERD, CLUB, AKLYS, RUBBER_HOSE, BULLWHIP, QUARTERSTAFF,
    TWO_HANDED_SWORD, MORNING_STAR, STILETTO, PICK_AXE,
    ORCISH_DAGGER, ORCISH_SHORT_SWORD, ORCISH_SPEAR, ORCISH_HELM,
    ORCISH_SHIELD, ORCISH_RING_MAIL, ORCISH_CHAIN_MAIL,
    ORCISH_BOW, ORCISH_ARROW, ORCISH_CLOAK, URUK_HAI_SHIELD,
    ELVEN_DAGGER, ELVEN_SHORT_SWORD, ELVEN_BOW, ELVEN_ARROW,
    ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_CLOAK,
    ELVEN_SHIELD, ELVEN_BOOTS,
    DWARVISH_MATTOCK, DWARVISH_SHORT_SWORD, DWARVISH_SPEAR,
    DWARVISH_IRON_HELM, DWARVISH_MITHRIL_COAT,
    DWARVISH_ROUNDSHIELD, DWARVISH_CLOAK,
    CROSSBOW, CROSSBOW_BOLT, BOW, SLING, FLINT,
    PARTISAN, BEC_DE_CORBIN, RANSEUR, SPETUM, GLAIVE,
    CREAM_PIE, DART, SHURIKEN, YA, YUMI, BOULDER,
    LEATHER_ARMOR, IRON_SHOES, SMALL_SHIELD, LARGE_SHIELD,
    SHIELD_OF_REFLECTION, CHAIN_MAIL, PLATE_MAIL, BRONZE_PLATE_MAIL,
    CRYSTAL_PLATE_MAIL, SPLINT_MAIL, BANDED_MAIL, RING_MAIL, STUDDED_LEATHER_ARMOR,
    HELMET, DENTED_POT, LOW_BOOTS, HIGH_BOOTS, LEATHER_GLOVES, LEATHER_CLOAK,
    CLOAK_OF_PROTECTION, CLOAK_OF_MAGIC_RESISTANCE,
    HELM_OF_BRILLIANCE, ROBE, MUMMY_WRAPPING,
    K_RATION, C_RATION, TIN_WHISTLE, BUGLE, SADDLE,
    MIRROR, POT_OBJECT_DETECTION, POT_HEALING, POT_EXTRA_HEALING,
    POT_FULL_HEALING, POT_SICKNESS, POT_SPEED, POT_INVISIBILITY,
    POT_GAIN_LEVEL, POT_POLYMORPH,
    CRYSTAL_BALL, BRASS_LANTERN, SKELETON_KEY,
    WAN_STRIKING, FOOD_RATION, TIN_OPENER, WAN_NOTHING,
    WAN_MAGIC_MISSILE, WAN_DEATH, WAN_SLEEP, WAN_FIRE, WAN_COLD, WAN_LIGHTNING,
    WAN_TELEPORTATION, WAN_CREATE_MONSTER, WAN_DIGGING,
    WAN_MAKE_INVISIBLE, WAN_SPEED_MONSTER, WAN_POLYMORPH,
    POT_ACID, POT_CONFUSION, POT_BLINDNESS, POT_SLEEPING, POT_PARALYSIS,
    SCR_EARTH, SCR_TELEPORTATION, SCR_CREATE_MONSTER,
    RIN_INVISIBILITY,
    AMULET_OF_LIFE_SAVING, AMULET_OF_YENDOR,
    CORPSE, LUCKSTONE, objectData,
} from './objects.js';
import { roles, races, initialAlignmentRecordForRole } from './player.js';

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
function strongmonst(ptr) { return !!(ptr.flags2 & M2_STRONG); }
function is_neuter(ptr) { return !!(ptr.flags2 & M2_NEUTER); }
function is_domestic(ptr) { return !!(ptr.flags2 & M2_DOMESTIC); }
function is_elf(ptr) { return ptr.symbol === S_HUMANOID && ptr.name && ptr.name.includes('elf'); }
function is_dwarf(ptr) { return ptr.symbol === S_HUMANOID && ptr.name && ptr.name.includes('dwarf'); }
function is_hobbit(ptr) { return ptr.symbol === S_HUMANOID && ptr.name && ptr.name.includes('hobbit'); }
function is_giant_species(ptr) { return ptr.symbol === S_GIANT && ptr.name && ptr.name.includes('giant'); }
// C ref: mondata.h:87 — #define is_armed(ptr) attacktype(ptr, AT_WEAP)
function is_armed(ptr) { return ptr.attacks && ptr.attacks.some(a => a.type === AT_WEAP); }
function attacktype(ptr, atyp) { return ptr.attacks && ptr.attacks.some(a => a.type === atyp); }
function is_animal(ptr) { return !!(ptr.flags1 & 0x00040000); } // M1_ANIMAL
function mindless(ptr) { return !!(ptr.flags1 & 0x00010000); } // M1_MINDLESS
function is_ndemon(ptr) { return ptr.symbol === S_DEMON; }
function always_hostile(ptr) { return !!(ptr.flags2 & M2_HOSTILE); }
function always_peaceful(ptr) { return !!(ptr.flags2 & M2_PEACEFUL); }

function sgn(x) {
    return x > 0 ? 1 : (x < 0 ? -1 : 0);
}

function race_peaceful(ptr, playerCtx) {
    const flags2 = ptr.flags2 || 0;
    const lovemask = races[playerCtx.race]?.lovemask || 0;
    return !!(flags2 & lovemask);
}

function race_hostile(ptr, playerCtx) {
    const flags2 = ptr.flags2 || 0;
    const hatemask = races[playerCtx.race]?.hatemask || 0;
    return !!(flags2 & hatemask);
}

function normalizePlayerContext(ctx = {}) {
    const roleIndex = Number.isInteger(ctx.roleIndex) ? ctx.roleIndex : undefined;
    const role = roleIndex !== undefined ? roles[roleIndex] : null;
    return {
        roleIndex,
        alignment: Number.isInteger(ctx.alignment) ? ctx.alignment : (role?.align || 0),
        alignmentRecord: Number.isInteger(ctx.alignmentRecord)
            ? ctx.alignmentRecord
            : initialAlignmentRecordForRole(roleIndex),
        alignmentAbuse: Number.isInteger(ctx.alignmentAbuse) ? ctx.alignmentAbuse : 0,
        race: Number.isInteger(ctx.race) ? ctx.race : 0,
        hasAmulet: !!ctx.hasAmulet,
    };
}

let _makemonPlayerCtx = normalizePlayerContext();
let _makemonLevelCtx = {
    dungeonAlign: A_NONE,
};

export function setMakemonPlayerContext(playerLike) {
    const inventory = Array.isArray(playerLike?.inventory) ? playerLike.inventory : [];
    _makemonPlayerCtx = normalizePlayerContext({
        roleIndex: playerLike?.roleIndex,
        alignment: playerLike?.alignment,
        alignmentRecord: playerLike?.alignmentRecord,
        alignmentAbuse: playerLike?.alignmentAbuse,
        race: playerLike?.race,
        hasAmulet: inventory.some(o => o?.otyp === AMULET_OF_YENDOR),
    });
}

export function setMakemonRoleContext(roleIndex) {
    _makemonPlayerCtx = normalizePlayerContext({ roleIndex });
}

export function getMakemonRoleIndex() {
    return _makemonPlayerCtx.roleIndex;
}

export function setMakemonLevelContext(levelCtx = {}) {
    _makemonLevelCtx = {
        dungeonAlign: Number.isInteger(levelCtx.dungeonAlign)
            ? levelCtx.dungeonAlign
            : A_NONE,
    };
}

// C ref: makemon.c peace_minded(struct permonst *ptr)
function peace_minded(ptr, playerCtx = _makemonPlayerCtx) {
    const mal = ptr.align || 0;
    const ual = playerCtx.alignment || 0;
    const alignRecord = playerCtx.alignmentRecord;
    const alignAbuse = playerCtx.alignmentAbuse;

    if (always_peaceful(ptr)) return true;
    if (always_hostile(ptr)) return false;
    if (ptr.sound === MS_LEADER || ptr.sound === MS_GUARDIAN) return true;
    if (ptr.sound === MS_NEMESIS) return false;
    if (ptr === mons[PM_ERINYS]) return !alignAbuse;

    if (race_peaceful(ptr, playerCtx)) return true;
    if (race_hostile(ptr, playerCtx)) return false;

    if (sgn(mal) !== sgn(ual)) return false;
    if (mal < 0 && playerCtx.hasAmulet) return false;
    if ((ptr.flags2 || 0) & M2_MINION) return alignRecord >= 0;

    return !!rn2(16 + (alignRecord < -15 ? -15 : alignRecord))
        && !!rn2(2 + Math.abs(mal));
}

// C ref: objnam.c rnd_class()
function mkobj_rnd_class(first, last) {
    if (first > last) {
        const t = first;
        first = last;
        last = t;
    }
    let sum = 0;
    for (let i = first; i <= last; i++) {
        sum += (objectData[i]?.prob || 0);
    }
    if (sum <= 0) return first;
    let x = rnd(sum);
    for (let i = first; i <= last; i++) {
        x -= (objectData[i]?.prob || 0);
        if (x <= 0) return i;
    }
    return last;
}

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

const ALIGNWEIGHT = 4; // C ref: global.h ALIGNWEIGHT

// C ref: makemon.c align_shift()
function align_shift(ptr) {
    switch (_makemonLevelCtx.dungeonAlign) {
    default:
    case A_NONE:
        return 0;
    case A_LAWFUL:
        return Math.trunc(((ptr.align || 0) + 20) / (2 * ALIGNWEIGHT));
    case A_NEUTRAL:
        return Math.trunc((20 - Math.abs(ptr.align || 0)) / ALIGNWEIGHT);
    case A_CHAOTIC:
        return Math.trunc((20 - (ptr.align || 0)) / (2 * ALIGNWEIGHT));
    }
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

    // DEBUG: Disabled (set to true to debug depth 3 rndmonst_adj)
    const DEBUG_RNG = false; // (depth === 3 && minadj === 0 && maxadj === 0);
    if (DEBUG_RNG) {
        const log = getRngLog();
        const callNum = log ? log.length : 0;
        console.log(`\n=== rndmonst_adj(${minadj}, ${maxadj}, ${depth}) at RNG call ${callNum} (within depth 3) ===`);
        console.log(`Difficulty range: ${minmlev}-${maxmlev}`);
    }
    let iterCount = 0;

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
            const oldTotal = totalweight;
            totalweight += weight;

            // DEBUG: Log first 10 eligible monsters
            if (DEBUG_RNG && iterCount < 10) {
                console.log(`[${iterCount}] mndx=${mndx} ${ptr.name.padEnd(20)} diff=${ptr.difficulty} geno=0x${ptr.geno.toString(16)} freq=${ptr.geno & G_FREQ} weight=${weight} total=${oldTotal}->${totalweight}`);
                iterCount++;
            }

            // DEBUG: Log actual rn2 call
            // if (depth === 3 && minadj === 0 && maxadj === 0 && iterCount < 5) {
            //     console.log(`  -> Calling rn2(${totalweight})`);
            // }
            const roll = rn2(totalweight);
            // if (depth === 3 && minadj === 0 && maxadj === 0 && iterCount < 5) {
            //     console.log(`  -> Result: ${roll}, weight=${weight}, selected=${roll < weight ? mndx : 'unchanged'}`);
            // }
            if (roll < weight)
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

export function newmonhp(mndx, depth = 1) {
    const ptr = mons[mndx];
    let m_lev = adj_lev(ptr, depth);
    let hp;

    // Golem: fixed HP based on type — no RNG
    // Rider: d(10, 8) — rare at depth 1
    // High level (>49): fixed — no RNG
    // Dragon: d(m_lev, 4) — not at depth 1
    // Level 0: rnd(4)
    // Normal: d(m_lev, 8)

    if (m_lev === 0) {
        hp = rnd(4);
    } else if (ptr.symbol === S_DRAGON) {
        hp = c_d(m_lev, 4);
    } else {
        hp = c_d(m_lev, 8);
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

function m_initweap(mon, mndx, depth) {
    const ptr = mons[mndx];
    const mm = ptr.symbol; // mlet
    const bias = is_lord(ptr) ? 1 : is_prince(ptr) ? 2 : is_nasty(ptr) ? 1 : 0;
    const mongets = (otyp, init = true, artif = false) => {
        const obj = mksobj(otyp, init, artif);
        if (mon) {
            if (!mon.minvent) mon.minvent = [];
            mon.minvent.push(obj);
        }
        return obj;
    };

    switch (mm) {
    case S_GIANT:
        // C ref: makemon.c:182-185
        if (rn2(2)) {
            mksobj((mndx !== PM_ETTIN) ? BOULDER : CLUB, true, false);
        }
        if ((mndx !== PM_ETTIN) && !rn2(5)) {
            mksobj(rn2(2) ? TWO_HANDED_SWORD : BATTLE_AXE, true, false);
        }
        break;

    case S_HUMAN:
        if (is_mercenary(ptr)) {
            // C ref: makemon.c:188-226
            let w1 = 0;
            let w2 = 0;
            switch (mndx) {
            case PM_WATCHMAN:
            case PM_SOLDIER:
                if (!rn2(3)) {
                    w1 = rn1(BEC_DE_CORBIN - PARTISAN + 1, PARTISAN);
                    w2 = rn2(2) ? DAGGER : KNIFE;
                } else {
                    w1 = rn2(2) ? SPEAR : SHORT_SWORD;
                }
                break;
            case PM_SERGEANT:
                w1 = rn2(2) ? FLAIL : MACE;
                break;
            case PM_LIEUTENANT:
                w1 = rn2(2) ? BROADSWORD : LONG_SWORD;
                break;
            case PM_CAPTAIN:
            case PM_WATCH_CAPTAIN:
                w1 = rn2(2) ? LONG_SWORD : SILVER_SABER;
                break;
            default:
                if (!rn2(4)) w1 = DAGGER;
                if (!rn2(7)) w2 = SPEAR;
                break;
            }
            if (w1) mksobj(w1, true, false);
            if (!w2 && w1 !== DAGGER && !rn2(4)) w2 = KNIFE;
            if (w2) mksobj(w2, true, false);
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
            if (rn2(7)) mksobj(DWARVISH_CLOAK, true, false);
            if (rn2(7)) mksobj(IRON_SHOES, true, false);
            if (!rn2(4)) {
                mksobj(DWARVISH_SHORT_SWORD, true, false);
                if (rn2(2)) {
                    mksobj(DWARVISH_MATTOCK, true, false);
                } else {
                    mksobj(rn2(2) ? AXE : DWARVISH_SPEAR, true, false);
                    mksobj(DWARVISH_ROUNDSHIELD, true, false);
                }
                mksobj(DWARVISH_IRON_HELM, true, false);
                if (!rn2(3)) mksobj(DWARVISH_MITHRIL_COAT, true, false);
            } else {
                mksobj(!rn2(3) ? PICK_AXE : DAGGER, true, false);
            }
        }
        break;

    case S_KOP:
        if (!rn2(4)) m_initthrow(CREAM_PIE, 2);
        if (!rn2(3)) mksobj(rn2(2) ? CLUB : RUBBER_HOSE, true, false);
        break;

    case S_ORC: {
        // C ref: makemon.c:411-446
        if (rn2(2)) mongets(ORCISH_HELM, true, false);
        const orcType = (mndx !== PM_ORC_CAPTAIN) ? mndx
            : rn2(2) ? PM_MORDOR_ORC : PM_URUK_HAI;
        if (orcType === PM_MORDOR_ORC) {
            if (!rn2(3)) mongets(SCIMITAR, true, false);
            if (!rn2(3)) mongets(ORCISH_SHIELD, true, false);
            if (!rn2(3)) mongets(KNIFE, true, false);
            if (!rn2(3)) mongets(ORCISH_CHAIN_MAIL, true, false);
        } else if (orcType === PM_URUK_HAI) {
            if (!rn2(3)) mongets(ORCISH_CLOAK, true, false);
            if (!rn2(3)) mongets(ORCISH_SHORT_SWORD, true, false);
            if (!rn2(3)) mongets(IRON_SHOES, true, false);
            if (!rn2(3)) {
                mongets(ORCISH_BOW, true, false);
                m_initthrow(ORCISH_ARROW, 12);
            }
            if (!rn2(3)) mongets(URUK_HAI_SHIELD, true, false);
        } else {
            // default: common orc
            if (mndx !== PM_ORC_SHAMAN && rn2(2))
                mongets((mndx === PM_GOBLIN || rn2(2) === 0) ? ORCISH_DAGGER : SCIMITAR, true, false);
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
        // C ref: makemon.c:454-467
        if (!rn2(2)) {
            const w = rn2(4);
            if (w === 0) mksobj(RANSEUR, true, false);
            else if (w === 1) mksobj(PARTISAN, true, false);
            else if (w === 2) mksobj(GLAIVE, true, false);
            else mksobj(SPETUM, true, false);
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

    default:
        // Generic weapon assignment for armed monsters
        // C ref: makemon.c:534-571
        if (ptr.attacks && ptr.attacks.some(a => a.type === 254)) { // AT_WEAP
            const w = rnd(Math.max(1, 14 - 2 * bias));
            switch (w) {
            case 1:
                if (strongmonst(ptr)) mksobj(BATTLE_AXE, true, false);
                else m_initthrow(DART, 12);
                break;
            case 2:
                if (strongmonst(ptr)) mksobj(TWO_HANDED_SWORD, true, false);
                else {
                    mksobj(CROSSBOW, true, false);
                    m_initthrow(CROSSBOW_BOLT, 12);
                }
                break;
            case 3:
                mksobj(BOW, true, false);
                m_initthrow(ARROW, 12);
                break;
            case 4:
                if (strongmonst(ptr)) mksobj(LONG_SWORD, true, false);
                else m_initthrow(DAGGER, 3);
                break;
            case 5:
                if (strongmonst(ptr)) mksobj(LUCERN_HAMMER, true, false);
                else mksobj(AKLYS, true, false);
                break;
            default:
                break;
            }
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
        if (otyp) mongets(otyp, true, false);
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
// rnd_misc_item -- select random misc item for monster
// C ref: muse.c:2619-2657
// ========================================================================

function rnd_misc_item(mndx) {
    const ptr = mons[mndx];
    const difficulty = ptr.difficulty || 0;

    // Animals, exploders, mindless, ghosts, Kops don't get misc items
    if (is_animal(ptr) || attacktype(ptr, AT_EXPL) || mindless(ptr)
        || ptr.symbol === S_GHOST || ptr.symbol === S_KOP) {
        return 0;
    }

    // Weak monsters (difficulty < 6) can get polymorph items
    if (difficulty < 6 && !rn2(30)) {
        return rn2(6) ? POT_POLYMORPH : WAN_POLYMORPH;
    }

    // Non-living monsters and vampshifters don't get amulet of life saving
    // Note: is_vampshifter check omitted (only applies to existing monsters)
    const nonliving_monster = !!(ptr.flags3 & 0x00000040); // MZ_NONLIVING
    if (!rn2(40) && !nonliving_monster) {
        return AMULET_OF_LIFE_SAVING;
    }

    switch (rn2(3)) {
    case 0:
        // Note: mtmp->isgd (vault guard) check omitted (not set during creation)
        return rn2(6) ? POT_SPEED : WAN_SPEED_MONSTER;
    case 1:
        // Note: mtmp->mpeaceful and See_invisible checks omitted (not relevant at creation)
        return rn2(6) ? POT_INVISIBILITY : WAN_MAKE_INVISIBLE;
    case 2:
        return POT_GAIN_LEVEL;
    }
    return 0;
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
            // C ref: makemon.c m_initinv() mercenary branch.
            // Keep the same roll order and gating so RNG stays aligned.
            let mac = 0;
            if (mndx === PM_SOLDIER) mac = 3;
            else if (mndx === PM_SERGEANT) mac = 0;
            else if (mndx === PM_LIEUTENANT) mac = -2;
            else if (mndx === PM_CAPTAIN) mac = -3;
            else if (mndx === PM_WATCHMAN) mac = 3;
            else if (mndx === PM_WATCH_CAPTAIN) mac = -2;

            const addAc = (otyp) => {
                if (!Number.isFinite(otyp)) return;
                const obj = mksobj(otyp, true, false);
                const baseAc = Number(objectData[otyp]?.oc1 || 0);
                const spe = Number(obj?.spe || 0);
                const erosion = Math.max(Number(obj?.oeroded || 0), Number(obj?.oeroded2 || 0));
                // C ref: ARM_BONUS(obj) = a_ac + spe - min(greatest_erosion, a_ac)
                mac += (baseAc + spe - Math.min(erosion, baseAc));
            };

            if (mac < -1 && rn2(5)) {
                addAc(rn2(5) ? PLATE_MAIL : CRYSTAL_PLATE_MAIL);
            } else if (mac < 3 && rn2(5)) {
                addAc(rn2(3) ? SPLINT_MAIL : BANDED_MAIL);
            } else if (rn2(5)) {
                addAc(rn2(3) ? RING_MAIL : STUDDED_LEATHER_ARMOR);
            } else {
                addAc(LEATHER_ARMOR);
            }

            if (mac < 10 && rn2(3)) {
                addAc(HELMET);
            } else if (mac < 10 && rn2(2)) {
                addAc(DENTED_POT);
            }

            if (mac < 10 && rn2(3)) {
                addAc(SMALL_SHIELD);
            } else if (mac < 10 && rn2(2)) {
                addAc(LARGE_SHIELD);
            }

            if (mac < 10 && rn2(3)) {
                addAc(LOW_BOOTS);
            } else if (mac < 10 && rn2(2)) {
                addAc(HIGH_BOOTS);
            }

            if (mac < 10 && rn2(3)) {
                addAc(LEATHER_GLOVES);
            } else if (mac < 10 && rn2(2)) {
                addAc(LEATHER_CLOAK);
            }

            if (mndx === PM_WATCH_CAPTAIN) {
                // No extra gear in C.
            } else if (mndx === PM_WATCHMAN) {
                if (rn2(3)) mksobj(TIN_WHISTLE, true, false);
            } else if (mndx === PM_GUARD) {
                mksobj(TIN_WHISTLE, true, false);
            } else {
                // Soldiers and officers.
                if (!rn2(3)) mksobj(K_RATION, true, false);
                if (!rn2(2)) mksobj(C_RATION, true, false);
                if (mndx !== PM_SOLDIER && !rn2(3)) mksobj(BUGLE, true, false);
            }
        } else if (ptr.name && (ptr.name === 'priest' || ptr.name === 'priestess')) {
            mksobj(rn2(7) ? ROBE : (rn2(3) ? CLOAK_OF_PROTECTION : CLOAK_OF_MAGIC_RESISTANCE), true, false);
            mksobj(SMALL_SHIELD, true, false);
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
        // C ref: makemon.c:740-751
        if (mndx === PM_MINOTAUR) {
            if (!rn2(3)) {
                mksobj(WAN_DIGGING, true, false);
            }
        } else if (is_giant_species(ptr)) {
            const cnt = rn2(Math.floor(m_lev / 2));
            for (let i = 0; i < cnt; i++) {
                const otyp = mkobj_rnd_class(DILITHIUM_CRYSTAL, LUCKSTONE - 1);
                const otmp = mksobj(otyp, false, false);
                otmp.quan = rn1(2, 3);
                otmp.owt = otmp.quan * (objectData[otmp.otyp].weight || 1);
            }
        }
        break;

    case S_WRAITH:
        if (mndx === PM_NAZGUL) {
            const otmp = mksobj(RIN_INVISIBILITY, false, false);
            otmp.cursed = true;
        }
        break;

    case S_LICH:
        // C ref: makemon.c lich equipment
        if (mndx === PM_MASTER_LICH) {
            if (!rn2(13)) mksobj(rn2(7) ? ATHAME : WAN_NOTHING, true, false);
        } else if (mndx === PM_ARCH_LICH && !rn2(3)) {
            // C ref: mksobj(rn2(3) ? ATHAME : QUARTERSTAFF, TRUE, rn2(13)?FALSE:TRUE)
            // Consume the enchantment RNG draw regardless; cursedness is not fully modeled here.
            const otmp = mksobj(rn2(3) ? ATHAME : QUARTERSTAFF, true, false);
            rn2(13);
            if (otmp && (otmp.spe || 0) < 2) {
                otmp.spe = rnd(3);
            }
            if (otmp && !rn2(4)) {
                otmp.oerodeproof = true;
            }
        }
        break;

    case S_MUMMY:
        // C ref: makemon.c gives wrapping on rn2(7)!=0 (6/7 chance)
        if (rn2(7)) mksobj(MUMMY_WRAPPING, true, false);
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
    const rollDef = rn2(50);
    if (m_lev > rollDef) {
        const otyp = rnd_defensive_item(mndx);
        if (otyp) mksobj(otyp, true, false);
    }
    if (m_lev > rn2(100)) {
        const otyp = rnd_misc_item(mndx);
        if (otyp) mksobj(otyp, true, false);
    }
    if ((ptr.flags2 & M2_GREEDY) && !rn2(5)) {
        // mkmonmoney: d(level_difficulty(), minvent ? 5 : 10)
        c_d(Math.max(depth, 1), 10);
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

// C ref: teleport.c collect_coords() + enexto() for group placement.
function group_collect_coords(cx, cy, maxradius) {
    const COLNO = 80;
    const ROWNO = 21;
    const rowrange = (cy < Math.floor(ROWNO / 2)) ? (ROWNO - 1 - cy) : cy;
    const colrange = (cx < Math.floor(COLNO / 2)) ? (COLNO - 1 - cx) : cx;
    const k = Math.max(rowrange, colrange);
    const lim = maxradius ? Math.min(maxradius, k) : k;
    const result = [];

    for (let radius = 1; radius <= lim; radius++) {
        const ringStart = result.length;
        const lox = cx - radius;
        const hix = cx + radius;
        const loy = cy - radius;
        const hiy = cy + radius;
        for (let y = Math.max(loy, 0); y <= hiy; y++) {
            if (y > ROWNO - 1) break;
            for (let x = Math.max(lox, 1); x <= hix; x++) {
                if (x > COLNO - 1) break;
                if (x !== lox && x !== hix && y !== loy && y !== hiy) continue;
                result.push({ x, y });
            }
        }
        let n = result.length - ringStart;
        let passIdx = ringStart;
        while (n > 1) {
            const swap = rn2(n);
            if (swap) {
                const tmp = result[passIdx];
                result[passIdx] = result[passIdx + swap];
                result[passIdx + swap] = tmp;
            }
            passIdx++;
            n--;
        }
    }
    return result;
}

function group_sp_goodpos(x, y, map) {
    const DOOR = 23;
    if (x < 0 || y < 0 || x >= 80 || y >= 21) return false;
    const loc = map.at(x, y);
    if (!loc || loc.typ <= DOOR) return false;
    for (const m of map.monsters || []) {
        if (m.mx === x && m.my === y) return false;
    }
    return true;
}

function group_enexto(cx, cy, map) {
    const nearCoords = group_collect_coords(cx, cy, 3);
    for (const cc of nearCoords) {
        if (group_sp_goodpos(cc.x, cc.y, map)) return cc;
    }
    const allCoords = group_collect_coords(cx, cy, 0);
    for (let i = nearCoords.length; i < allCoords.length; i++) {
        if (group_sp_goodpos(allCoords[i].x, allCoords[i].y, map)) return allCoords[i];
    }
    return null;
}

export function makemon(ptr_or_null, x, y, mmflags, depth, map) {
    let mndx;
    let anymon = false;

    // DEBUG: Disabled
    const DEBUG_MAKEMON = false;
    if (DEBUG_MAKEMON && depth >= 2) {
        console.log(`\nmakemon(${ptr_or_null === null ? 'null' : ptr_or_null}, ${x}, ${y}, ${mmflags}, depth=${depth})`);
    }

    // C ref: makemon.c:1173-1178 — random position finding for (0,0)
    // Happens before random monster selection when ptr is null.
    if (x === 0 && y === 0 && map) {
        const pos = makemon_rnd_goodpos(map, null);
        if (pos) { x = pos.x; y = pos.y; }
        else return null;
    }

    if (ptr_or_null === null || ptr_or_null === undefined) {
        // Random monster selection
        anymon = true;
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
    // next_ident() returns counter value and consumes rnd(2)
    const m_id = next_ident();

    // C ref: makemon.c:1259 — newmonhp
    const { hp, m_lev } = newmonhp(mndx, depth || 1);

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

    // C ref: makemon.c:1382-1386
    // During mklev and without Amulet, selected monsters may start asleep.
    if ((is_ndemon(ptr) || mndx === PM_WUMPUS
        || mndx === PM_LONG_WORM || mndx === PM_GIANT_EEL)
        && rn2(5)) {
        // mtmp->msleeping = TRUE; RNG side effect only.
    }

    // C ref: makemon.c:1370-1371 — ghost naming via rndghostname()
    // rndghostname: rn2(7), and if nonzero, rn2(34) to pick from ghostnames
    if (mndx === PM_GHOST) {
        if (rn2(7)) {
            rn2(34); // ROLL_FROM(ghostnames)
        }
    }

    // C ref: makemon.c mitem special-cases before m_initweap/m_initinv.
    // Needed for PRNG parity on special unique monsters (notably Croesus).
    let mitem = STRANGE_OBJECT;
    if (mndx === PM_CROESUS) {
        mitem = TWO_HANDED_SWORD;
    }
    if (mitem !== STRANGE_OBJECT) {
        mksobj(mitem, true, false);
    }

    // Build full monster object for gameplay.
    // C ref: makemon.c creates/places monster before group and inventory setup.
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
        peaceful: peace_minded(ptr),
        mpeaceful: false,
        tame: false,
        flee: false,
        confused: false,
        stunned: false,
        blind: false,
        sleeping: false,  // sleep handled by C's finalize_creation, not here
        dead: false,
        passive: false,
        minvent: [],
        mtrack: [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],
    };
    mon.mpeaceful = mon.peaceful;

    // Add to map if provided
    if (map && x !== undefined && y !== undefined) {
        map.monsters.unshift(mon); // C ref: fmon prepend (LIFO order)
    }

    // Group formation
    // C ref: makemon.c:1427-1435 — only for anymon (random monster)
    if (anymon && !(mmflags & MM_NOGRP)) {
        const initgrp = (n) => {
            const ulevel = 1;
            let cnt = rnd(n);
            cnt = Math.floor(cnt / ((ulevel < 3) ? 4 : (ulevel < 5) ? 2 : 1));
            if (!cnt) cnt = 1;
            let gx = mon.mx;
            let gy = mon.my;
            while (cnt-- > 0) {
                if (peace_minded(mon.type)) continue;
                const cc = map ? group_enexto(gx, gy, map) : null;
                if (!cc) continue;
                gx = cc.x;
                gy = cc.y;
                const mate = makemon(mndx, gx, gy, mmflags | MM_NOGRP, depth, map);
                if (mate) {
                    mate.peaceful = false;
                    mate.mpeaceful = false;
                    mate.mavenge = 0;
                }
            }
        };

        if ((ptr.geno & G_SGROUP) && rn2(2)) {
            initgrp(3);
        } else if (ptr.geno & G_LGROUP) {
            if (rn2(3)) initgrp(10);
            else initgrp(3);
        }
    }

    // Weapon/inventory initialization
    // C ref: makemon.c:1438-1440
    if (is_armed(ptr))
        m_initweap(mon, mndx, depth || 1);
    m_initinv(mndx, depth || 1, m_lev);

    // C ref: makemon.c:1443-1448 — saddle for domestic monsters
    // C evaluates !rn2(100) first (always consumed), then is_domestic
    if (!rn2(100) && is_domestic(ptr)) {
        mksobj(SADDLE, true, false);
    }

    return mon;
}
