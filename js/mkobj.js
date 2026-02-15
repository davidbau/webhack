// mkobj.js -- Object creation
// Faithful port of mkobj.c from NetHack 3.7
// C ref: mkobj.c — object creation, class initialization, containers

import { rn2, rnd, rn1, rne, rnz, d, getRngCallCount } from './rng.js';
import { isObjectNameKnown } from './discovery.js';
import {
    objectData, bases, oclass_prob_totals, mkobjprobs, NUM_OBJECTS,
    ILLOBJ_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
    TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS,
    CHAIN_CLASS, VENOM_CLASS,
    IRON, COPPER, WOOD, PLASTIC, GLASS, DRAGON_HIDE, LIQUID,
    ARROW, DART, ROCK,
    GOLD_PIECE, DILITHIUM_CRYSTAL, LOADSTONE,
    WAN_CANCELLATION, WAN_LIGHT, WAN_LIGHTNING,
    BAG_OF_HOLDING, OILSKIN_SACK, BAG_OF_TRICKS, SACK,
    LARGE_BOX, CHEST, ICE_BOX, CORPSE, STATUE,
    GRAY_DRAGON_SCALES, YELLOW_DRAGON_SCALES, LENSES,
    ELVEN_SHIELD, ORCISH_SHIELD, SHIELD_OF_REFLECTION,
    WORM_TOOTH, UNICORN_HORN, POT_WATER,
    SPE_BOOK_OF_THE_DEAD, SPE_NOVEL,
    ARM_SHIELD, ARM_GLOVES, ARM_BOOTS,
    CLASS_SYMBOLS,
    initObjectData,
} from './objects.js';
import { rndmonnum } from './makemon.js';
import { mons, G_NOCORPSE, M2_NEUTER, M2_FEMALE, M2_MALE, MZ_SMALL, PM_LIZARD, PM_LICHEN, S_TROLL, MS_RIDER } from './monsters.js';

// Named object indices we need (exported from objects.js)
// Check: CORPSE, EGG, TIN, SLIME_MOLD, KELP_FROND, CANDY_BAR,
// LOADSTONE, LUCKSTONE, TALLOW_CANDLE, WAX_CANDLE, BRASS_LANTERN, OIL_LAMP,
// MAGIC_LAMP, CHEST, LARGE_BOX, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING,
// EXPENSIVE_CAMERA, TINNING_KIT, MAGIC_MARKER, CAN_OF_GREASE, CRYSTAL_BALL,
// HORN_OF_PLENTY, BAG_OF_TRICKS, FIGURINE, BELL_OF_OPENING,
// MAGIC_FLUTE, MAGIC_HARP, FROST_HORN, FIRE_HORN, DRUM_OF_EARTHQUAKE,
// WAN_WISHING, WAN_NOTHING, BOULDER, STATUE,
// AMULET_OF_YENDOR, AMULET_OF_STRANGULATION, AMULET_OF_CHANGE, AMULET_OF_RESTFUL_SLEEP,
// FUMBLE_BOOTS, LEVITATION_BOOTS, HELM_OF_OPPOSITE_ALIGNMENT, GAUNTLETS_OF_FUMBLING,
// RIN_TELEPORTATION, RIN_POLYMORPH, RIN_AGGRAVATE_MONSTER, RIN_HUNGER,
// GOLD_PIECE, SPE_BLANK_PAPER, POT_OIL, POT_WATER

// Module-level depth for level_difficulty() during mklev
let _levelDepth = 1;
export function setLevelDepth(d) { _levelDepth = d; }

function mkobjTrace(msg) {
    if (typeof process !== 'undefined' && process.env.WEBHACK_MKOBJ_TRACE === '1') {
        const stack = new Error().stack || '';
        const lines = stack.split('\n');
        const toTag = (line) => {
            const m = (line || '').match(/at (?:(\S+)\s+\()?.*?([^/\s]+\.js):(\d+)/);
            if (!m) return null;
            return `${m[1] || '?'}(${m[2]}:${m[3]})`;
        };
        const c1 = toTag(lines[2]);
        const c2 = toTag(lines[3]);
        const c3 = toTag(lines[4]);
        let ctx = c1 || '?';
        if (c2) ctx += ` <= ${c2}`;
        if (c3) ctx += ` <= ${c3}`;
        console.log(`[MKOBJ] ${msg} ctx=${ctx}`);
    }
}

// C ref: mkobj.c svc.context.ident — monotonic ID counter for objects and monsters.
// next_ident() returns current value, then increments by rnd(2).
// Tracked here so nameshk() can use the shopkeeper's m_id value.
let _identCounter = 0;
export function next_ident() {
    const res = _identCounter;
    _identCounter += rnd(2);
    if (_identCounter === 0) _identCounter = rnd(2) + 1;
    return res;
}
export function getIdentCounter() { return _identCounter; }
export function resetIdentCounter() {
    _identCounter = 0;
}

// Some parity tests generate special levels directly without running the full
// o_init.c-style bootstrap. Ensure class bases/probability totals exist before
// mkobj() uses them for class-weighted random selection.
function ensureObjectClassTablesInitialized() {
    if (bases[WEAPON_CLASS] === 0 || oclass_prob_totals[WEAPON_CLASS] === 0) {
        initObjectData();
    }
}

// C ref: objnam.c rnd_class() -- pick random object in index range by probability
function rnd_class(first, last) {
    let sum = 0;
    for (let i = first; i <= last; i++)
        sum += objectData[i].prob || 0;
    if (!sum) return rn1(last - first + 1, first);
    let x = rnd(sum);
    for (let i = first; i <= last; i++) {
        x -= objectData[i].prob || 0;
        if (x <= 0) return i;
    }
    return first;
}

// C ref: Is_mbag() -- is object a magic bag?
function is_mbag(obj) {
    return obj.otyp === BAG_OF_HOLDING || obj.otyp === BAG_OF_TRICKS
        || obj.otyp === OILSKIN_SACK;
}

// P_ skill constants for is_multigen
const P_BOW = 20;
const P_SHURIKEN = 24;

// Helper: is object a stackable missile?
function is_multigen(obj) {
    if (obj.oclass !== WEAPON_CLASS) return false;
    const skill = objectData[obj.otyp].sub;
    return skill >= -P_SHURIKEN && skill <= -P_BOW;
}

// Helper: can object be poisoned?
function is_poisonable(obj) {
    return is_multigen(obj);
}

// Helper: material checks for erosion
function is_flammable(obj) {
    const mat = objectData[obj.otyp].material;
    if (mat === LIQUID) return false;
    return (mat <= WOOD) || mat === PLASTIC;
}
function is_rustprone(obj) {
    return objectData[obj.otyp].material === IRON;
}
function is_crackable(obj) {
    return objectData[obj.otyp].material === GLASS && obj.oclass === ARMOR_CLASS;
}
function is_rottable(obj) {
    const mat = objectData[obj.otyp].material;
    if (mat === LIQUID) return false;
    return mat <= WOOD || mat === DRAGON_HIDE;
}
function is_corrodeable(obj) {
    const mat = objectData[obj.otyp].material;
    return mat === COPPER || mat === IRON;
}

// C ref: Is_container(otmp) — is object a container?
function Is_container(obj) {
    return obj.otyp === LARGE_BOX || obj.otyp === CHEST || obj.otyp === ICE_BOX
        || obj.otyp === SACK || obj.otyp === OILSKIN_SACK
        || obj.otyp === BAG_OF_HOLDING || obj.otyp === BAG_OF_TRICKS;
}

// C ref: mkobj.c weight() — compute actual weight of an object
// Considers quantity, corpse type, container contents, coins
export function weight(obj) {
    let wt = objectData[obj.otyp].weight;
    if (obj.quan < 1) return 0;
    if (Is_container(obj) || obj.otyp === STATUE) {
        if (obj.otyp === STATUE && obj.corpsenm >= 0 && obj.corpsenm < mons.length) {
            wt = Math.floor(3 * mons[obj.corpsenm].weight / 2);
            const msize = mons[obj.corpsenm].size || 0;
            const minwt = (msize * 2 + 1) * 100;
            if (wt < minwt) wt = minwt;
        }
        // Container contents weight — cobj not tracked in JS yet, so cwt=0
        let cwt = 0;
        if (obj.cobj) {
            for (const c of obj.cobj) cwt += weight(c);
            if (obj.otyp === BAG_OF_HOLDING)
                cwt = obj.cursed ? (cwt * 2)
                    : obj.blessed ? Math.floor((cwt + 3) / 4)
                    : Math.floor((cwt + 1) / 2);
        }
        return wt + cwt;
    }
    if (obj.otyp === CORPSE && obj.corpsenm >= 0 && obj.corpsenm < mons.length) {
        return obj.quan * mons[obj.corpsenm].weight;
    }
    if (obj.oclass === COIN_CLASS) {
        return Math.max(Math.floor((obj.quan + 50) / 100), 1);
    }
    return wt ? wt * obj.quan : (obj.quan + 1) >> 1;
}

// C ref: objnam.c erosion_matters() — class-based check for whether erosion is relevant
function erosion_matters(obj) {
    switch (obj.oclass) {
    case WEAPON_CLASS:
    case ARMOR_CLASS:
    case BALL_CLASS:
    case CHAIN_CLASS:
        return true;
    case TOOL_CLASS:
        return (objectData[obj.otyp].sub || 0) !== 0; // is_weptool
    default:
        return false;
    }
}

// C ref: objclass.h is_damageable() — material-based check
function is_damageable(obj) {
    return is_rustprone(obj) || is_flammable(obj) || is_rottable(obj)
        || is_corrodeable(obj) || is_crackable(obj);
}

// C ref: mkobj.c may_generate_eroded(otmp)
function may_generate_eroded(obj) {
    if (obj.oerodeproof) return false;
    if (!erosion_matters(obj) || !is_damageable(obj)) return false;
    if (obj.otyp === WORM_TOOTH || obj.otyp === UNICORN_HORN) return false;
    if (obj.oartifact) return false;
    return true;
}

// C ref: mkobj.c blessorcurse()
function blessorcurse(obj, chance) {
    if (obj.blessed || obj.cursed) return;
    if (!rn2(chance)) {
        if (!rn2(2)) {
            obj.cursed = true;
        } else {
            obj.blessed = true;
        }
    }
}

// C ref: mkobj.c curse()
function curse(obj) {
    obj.blessed = false;
    obj.cursed = true;
}

// C ref: mkobj.c bcsign()
function bcsign(obj) {
    return obj.cursed ? -1 : obj.blessed ? 1 : 0;
}

// Create a blank object
function newobj(otyp) {
    // C ref: mkobj.c:1183 — otmp->o_id = next_ident()
    // next_ident() returns counter value and consumes rnd(2)
    const o_id = next_ident();
    return {
        o_id,
        otyp: otyp,
        oclass: objectData[otyp].oc_class,
        quan: 1,
        spe: 0,
        blessed: false,
        cursed: false,
        oerodeproof: false,
        oeroded: 0,
        oeroded2: 0,
        greased: false,
        opoisoned: 0,
        corpsenm: -1, // NON_PM
        owt: objectData[otyp].weight,
        displayChar: CLASS_SYMBOLS[objectData[otyp].oc_class] || '?',
        displayColor: objectData[otyp].color,
        ox: 0, oy: 0,
        where: 'free',
        lamplit: false,
        age: 1,
        tknown: false,
        known: false,
        dknown: false,
        bknown: false,
        name: objectData[otyp].name,
    };
}

// C ref: mkobj.c mkobj_erosions()
function mkobj_erosions(obj) {
    if (!may_generate_eroded(obj)) return;
    if (!rn2(100)) {
        obj.oerodeproof = true;
    } else {
        if (!rn2(80) && (is_flammable(obj) || is_rustprone(obj) || is_crackable(obj))) {
            do {
                obj.oeroded++;
            } while (obj.oeroded < 3 && !rn2(9));
        }
        if (!rn2(80) && (is_rottable(obj) || is_corrodeable(obj))) {
            do {
                obj.oeroded2++;
            } while (obj.oeroded2 < 3 && !rn2(9));
        }
    }
    if (!rn2(1000)) obj.greased = true;
}

// rndmonnum imported from makemon.js (circular but safe — called at runtime only)

// C ref: mon.c undead_to_corpse() — map undead monsters to their living form
// Cache the lookups (lazy init on first call)
let _undead_cache = null;
function undead_to_corpse(mndx) {
    if (!_undead_cache) {
        _undead_cache = new Map();
        const targets = [
            [['kobold zombie', 'kobold mummy'], 'kobold'],
            [['dwarf zombie', 'dwarf mummy'], 'dwarf'],
            [['gnome zombie', 'gnome mummy'], 'gnome'],
            [['orc zombie', 'orc mummy'], 'orc'],
            [['elf zombie', 'elf mummy'], 'elf'],
            [['human zombie', 'human mummy', 'vampire', 'vampire lord'], 'human'],
            [['giant zombie', 'giant mummy'], 'giant'],
            [['ettin zombie', 'ettin mummy'], 'ettin'],
        ];
        for (const [srcs, tgt] of targets) {
            const tgtIdx = mons.findIndex(m => m.name === tgt);
            for (const src of srcs) {
                const srcIdx = mons.findIndex(m => m.name === src);
                if (srcIdx >= 0 && tgtIdx >= 0) _undead_cache.set(srcIdx, tgtIdx);
            }
        }
    }
    return _undead_cache.has(mndx) ? _undead_cache.get(mndx) : mndx;
}

// C ref: mkobj.c mksobj_init() -- class-specific object initialization
// skipErosion: if true, skip mkobj_erosions (used by ini_inv — C's mksobj
// path for starting inventory doesn't include erosion)
function mksobj_init(obj, artif, skipErosion) {
    const oclass = obj.oclass;
    const otyp = obj.otyp;
    const od = objectData[otyp];

    switch (oclass) {
    case WEAPON_CLASS:
        if (is_multigen(obj)) obj.quan = rn1(6, 6);
        if (!rn2(11)) {
            obj.spe = rne(3);
            obj.blessed = !!rn2(2);
        } else if (!rn2(10)) {
            curse(obj);
            obj.spe = -rne(3);
        } else {
            blessorcurse(obj, 10);
        }
        if (is_poisonable(obj) && !rn2(100))
            obj.opoisoned = 1;
        if (artif && !rn2(20)) {
            // mk_artifact -- skip, just consumed the rn2
        }
        break;

    case FOOD_CLASS:
        // Check specific food types by name since we may not have all constants
        if (od.name === 'corpse') {
            // C ref: mkobj.c:900-910 — retry if G_NOCORPSE
            let tryct = 50;
            do {
                obj.corpsenm = undead_to_corpse(rndmonnum(_levelDepth));
                mkobjTrace(`corpse try=${51 - tryct} call=${getRngCallCount()} corpsenm=${obj.corpsenm} nocorpse=${obj.corpsenm >= 0 ? (((mons[obj.corpsenm].geno & G_NOCORPSE) !== 0) ? 1 : 0) : -1}`);
            } while (obj.corpsenm >= 0
                     && (mons[obj.corpsenm].geno & G_NOCORPSE)
                     && --tryct > 0);
            if (tryct === 0) obj.corpsenm = mons.findIndex(m => m.name === 'human');
        } else if (od.name === 'egg') {
            obj.corpsenm = -1;
            if (!rn2(3)) {
                for (let tryct = 200; tryct > 0; --tryct) {
                    const base = rndmonnum(_levelDepth); // can_be_hatched(rndmonnum())
                    obj.corpsenm = base;
                    mkobjTrace(`egg try=${201 - tryct} call=${getRngCallCount()} base=${base}`);
                    break; // simplified: first attempt succeeds
                }
            }
        } else if (od.name === 'tin') {
            obj.corpsenm = -1;
            if (!rn2(6)) {
                // spinach tin -- no RNG
                mkobjTrace(`tin spinach call=${getRngCallCount()}`);
            } else {
                // C ref: mkobj.c:930-937 — retry until cnutrit && !G_NOCORPSE
                for (let tryct = 200; tryct > 0; --tryct) {
                    const mndx = undead_to_corpse(rndmonnum(_levelDepth));
                    const nutrition = mndx >= 0 ? (mons[mndx].nutrition || 0) : 0;
                    const nocorpse = mndx >= 0 ? (((mons[mndx].geno & G_NOCORPSE) !== 0) ? 1 : 0) : -1;
                    mkobjTrace(`tin try=${201 - tryct} call=${getRngCallCount()} mndx=${mndx} cnutrit=${nutrition} nocorpse=${nocorpse}`);
                    if (mndx >= 0 && mons[mndx].nutrition > 0
                        && !(mons[mndx].geno & G_NOCORPSE)) {
                        obj.corpsenm = mndx;
                        rn2(15); // set_tin_variety RANDOM_TIN: rn2(TTSZ-1) where TTSZ=16
                        mkobjTrace(`tin selected=${mndx} at_try=${201 - tryct} call=${getRngCallCount()}`);
                        break;
                    }
                }
            }
            blessorcurse(obj, 10);
        } else if (od.name === 'kelp frond') {
            obj.quan = rnd(2);
        } else if (od.name === 'candy bar') {
            rn2(12); // C ref: read.c assign_candy_wrapper() uses rn2(12) in 3.7 trace
        }
        // General food: possible quan=2 (C: else branch of Is_pudding)
        if (od.name !== 'corpse' && od.name !== 'meat ring'
            && od.name !== 'kelp frond') {
            if (!rn2(6)) obj.quan = 2;
        }
        break;

    case GEM_CLASS:
        if (od.name === 'loadstone') {
            curse(obj);
        } else if (od.name === 'rock') {
            obj.quan = rn1(6, 6);
        } else if (od.name !== 'luckstone' && !rn2(6)) {
            obj.quan = 2;
        }
        break;

    case TOOL_CLASS:
        if (od.name === 'tallow candle' || od.name === 'wax candle') {
            obj.spe = 1;
            obj.quan = 1 + (rn2(2) ? rn2(7) : 0);
            blessorcurse(obj, 5);
        } else if (od.name === 'brass lantern' || od.name === 'oil lamp') {
            obj.spe = 1;
            obj.age = rn1(500, 1000);
            blessorcurse(obj, 5);
        } else if (od.name === 'magic lamp') {
            obj.spe = 1;
            blessorcurse(obj, 2);
        } else if (od.name === 'chest' || od.name === 'large box') {
            obj.olocked = !!rn2(5);
            obj.otrapped = !rn2(10);
            obj.tknown = obj.otrapped && !rn2(100);
            // mkbox_cnts -- consume RNG for contents
            mkbox_cnts(obj);
        } else if (od.name === 'ice box' || od.name === 'sack'
                   || od.name === 'oilskin sack' || od.name === 'bag of holding') {
            mkbox_cnts(obj);
        } else if (od.name === 'expensive camera' || od.name === 'tinning kit'
                   || od.name === 'magic marker') {
            obj.spe = rn1(70, 30);
        } else if (od.name === 'can of grease') {
            obj.spe = rn1(21, 5);
            blessorcurse(obj, 10);
        } else if (od.name === 'crystal ball') {
            obj.spe = rn1(5, 3);
            blessorcurse(obj, 2);
        } else if (od.name === 'horn of plenty' || od.name === 'bag of tricks') {
            obj.spe = rn1(18, 3);
        } else if (od.name === 'figurine') {
            let tryct = 0;
            do {
                obj.corpsenm = rndmonnum(_levelDepth); // rndmonnum_adj(5, 10)
                mkobjTrace(`figurine try=${tryct + 1} call=${getRngCallCount()} corpsenm=${obj.corpsenm}`);
            } while (tryct++ < 30 && false); // simplified: first attempt ok
            blessorcurse(obj, 4);
        } else if (od.name === 'Bell of Opening') {
            obj.spe = 3;
        } else if (od.name === 'magic flute' || od.name === 'magic harp'
                   || od.name === 'frost horn' || od.name === 'fire horn'
                   || od.name === 'drum of earthquake') {
            obj.spe = rn1(5, 4);
        }
        break;

    case AMULET_CLASS:
        if (rn2(10) && (od.name === 'amulet of strangulation'
                        || od.name === 'amulet of change'
                        || od.name === 'amulet of restful sleep')) {
            curse(obj);
        } else {
            blessorcurse(obj, 10);
        }
        break;

    case VENOM_CLASS:
    case CHAIN_CLASS:
    case BALL_CLASS:
        break;

    case POTION_CLASS:
    case SCROLL_CLASS:
        blessorcurse(obj, 4);
        break;

    case SPBOOK_CLASS:
        blessorcurse(obj, 17);
        break;

    case ARMOR_CLASS:
        if (rn2(10) && (od.name === 'fumble boots'
                        || od.name === 'levitation boots'
                        || od.name === 'helm of opposite alignment'
                        || od.name === 'gauntlets of fumbling'
                        || !rn2(11))) {
            curse(obj);
            obj.spe = -rne(3);
        } else if (!rn2(10)) {
            obj.blessed = !!rn2(2);
            obj.spe = rne(3);
        } else {
            blessorcurse(obj, 10);
        }
        if (artif && !rn2(40)) {
            // mk_artifact -- skip, just consumed the rn2
        }
        break;

    case WAND_CLASS:
        if (od.name === 'wand of wishing') {
            obj.spe = 1;
        } else {
            obj.spe = rn1(5, (od.dir === 1) ? 11 : 4); // NODIR=1
        }
        blessorcurse(obj, 17);
        break;

    case RING_CLASS:
        if (od.charged) {
            blessorcurse(obj, 3);
            if (rn2(10)) {
                if (rn2(10) && bcsign(obj))
                    obj.spe = bcsign(obj) * rne(3);
                else
                    obj.spe = rn2(2) ? rne(3) : -rne(3);
            }
            if (obj.spe === 0)
                obj.spe = rn2(4) - rn2(3);
            if (obj.spe < 0 && rn2(5))
                curse(obj);
        } else if (rn2(10) && (od.name === 'teleportation'
                               || od.name === 'polymorph'
                               || od.name === 'aggravate monster'
                               || od.name === 'hunger'
                               || !rn2(9))) {
            curse(obj);
        }
        break;

    case ROCK_CLASS:
        if (od.name === 'statue') {
            obj.corpsenm = rndmonnum(_levelDepth); // Pass depth for correct monster selection
            mkobjTrace(`statue call=${getRngCallCount()} corpsenm=${obj.corpsenm}`);
            // C ref: !verysmall() && rn2(level_difficulty()/2+10) > 10
            // verysmall = msize < MZ_SMALL (i.e., MZ_TINY)
            // Short-circuit: skip rn2 if monster is very small
            if (obj.corpsenm >= 0 && obj.corpsenm < mons.length
                && mons[obj.corpsenm].size >= MZ_SMALL
                && rn2(Math.floor(_levelDepth / 2 + 10)) > 10) {
                // would add spellbook to container -- skip
            }
        }
        break;

    case COIN_CLASS:
        break; // no init for coins

    default:
        break;
    }

    if (!skipErosion) mkobj_erosions(obj);
}

// C ref: mkobj.c mkbox_cnts() -- fill container with random items
function mkbox_cnts(box) {
    const od = objectData[box.otyp];
    let n;
    if (od.name === 'ice box') {
        n = 20;
    } else if (od.name === 'chest') {
        n = box.olocked ? 7 : 5;
    } else if (od.name === 'large box') {
        n = box.olocked ? 5 : 3;
    } else {
        // sack, oilskin sack, bag of holding
        n = 1;
    }
    mkobjTrace(`mkbox start call=${getRngCallCount()} box=${box.otyp} base_n=${n}`);
    n = rn2(n + 1); // actual count
    mkobjTrace(`mkbox count call=${getRngCallCount()} n=${n}`);

    // For each item in box, generate it
    for (let i = 0; i < n; i++) {
        if (od.name === 'ice box') {
            // C ref: mkobj.c:347 — mksobj(CORPSE, TRUE, FALSE) for ice box
            mksobj(CORPSE, true, false);
        } else {
            // rnd(100) for class selection from boxiprobs
            const tprob = rnd(100);
            // Use boxiprobs table to select class
            const boxiprobs = [
                { iprob: 18, iclass: GEM_CLASS },
                { iprob: 15, iclass: FOOD_CLASS },
                { iprob: 18, iclass: POTION_CLASS },
                { iprob: 18, iclass: SCROLL_CLASS },
                { iprob: 12, iclass: SPBOOK_CLASS },
                { iprob: 7, iclass: COIN_CLASS },
                { iprob: 6, iclass: WAND_CLASS },
                { iprob: 5, iclass: RING_CLASS },
                { iprob: 1, iclass: AMULET_CLASS },
            ];
            let prob = tprob;
            let oclass = GEM_CLASS; // default
            for (const bp of boxiprobs) {
                prob -= bp.iprob;
                if (prob <= 0) { oclass = bp.iclass; break; }
            }
            mkobjTrace(`mkbox pick call=${getRngCallCount()} class=${oclass} tprob=${prob}`);
            // Create the item
            const otmp = mkobj(oclass, false);
            if (!otmp) continue;

            // C ref: mkobj.c:360-370 — coin quantity and rock substitution
            if (otmp.oclass === COIN_CLASS) {
                // C ref: rnd(level_difficulty() + 2) * rnd(75)
                rnd(_levelDepth + 2);
                rnd(75);
            } else {
                // C ref: while (otmp->otyp == ROCK) rnd_class(...)
                while (otmp.otyp === ROCK) {
                    otmp.otyp = rnd_class(DILITHIUM_CRYSTAL, LOADSTONE);
                }
            }
            // C ref: mkobj.c:371-378 — bag of holding special cases
            if (box.otyp === BAG_OF_HOLDING) {
                if (is_mbag(otmp)) {
                    otmp.otyp = SACK;
                } else {
                    while (otmp.otyp === WAN_CANCELLATION) {
                        otmp.otyp = rnd_class(WAN_LIGHT, WAN_LIGHTNING);
                    }
                }
            }
            mkobjTrace(`mkbox item call=${getRngCallCount()} otyp=${otmp.otyp} oclass=${otmp.oclass} corpsenm=${otmp.corpsenm ?? -1}`);
        }
    }
}

// C ref: mksobj() post-init -- handle corpse/statue/figurine/egg gender
// C ref: mkobj.c:1196-1225
function mksobj_postinit(obj) {
    const od = objectData[obj.otyp];
    // Corpse: if corpsenm not set, assign one
    if (od.name === 'corpse' && obj.corpsenm === -1) {
        obj.corpsenm = undead_to_corpse(rndmonnum(_levelDepth));
    }
    // C ref: mkobj.c mksobj() SPE_NOVEL case:
    // initialize novelidx and consume noveltitle() selection RNG.
    if (obj.otyp === SPE_NOVEL) {
        obj.novelidx = rn2(41);
    }
    // Statue/figurine: if corpsenm not set, assign one
    // C ref: mkobj.c:1212 — otmp->corpsenm = rndmonnum()
    if ((od.name === 'statue' || od.name === 'figurine') && obj.corpsenm === -1) {
        obj.corpsenm = rndmonnum(_levelDepth);
    }
    // Gender assignment for corpse/statue/figurine
    // C ref: mkobj.c:1215-1218 — only rn2(2) if not neuter/female/male
    if (obj.corpsenm >= 0 && (od.name === 'corpse' || od.name === 'statue' || od.name === 'figurine')) {
        const ptr = mons[obj.corpsenm];
        const isNeuter = !!(ptr.flags2 & M2_NEUTER);
        const isFemale = !!(ptr.flags2 & M2_FEMALE);
        const isMale   = !!(ptr.flags2 & M2_MALE);
        if (!isNeuter && !isFemale && !isMale) {
            rn2(2); // random gender
        }
    }
    // C ref: mkobj.c:1224 set_corpsenm → start_corpse_timeout for CORPSE
    // start_corpse_timeout calls rnz(rot_adjust) where rot_adjust=25 at depth 1
    // C ref: mkobj.c:1400 — lizard and lichen corpses skip start_corpse_timeout
    if (od.name === 'corpse' && obj.corpsenm >= 0
        && obj.corpsenm !== PM_LIZARD && obj.corpsenm !== PM_LICHEN) {
        rnz(25); // start_corpse_timeout
    }
}

// C ref: mkobj.c mksobj() -- create a specific object type
// skipErosion: if true, skip mkobj_erosions (for ini_inv items)
export function mksobj(otyp, init, artif, skipErosion) {
    if (otyp < 0 || otyp >= NUM_OBJECTS) otyp = 0;
    const nm = objectData[otyp]?.name;
    if (nm === 'tin' || nm === 'egg' || nm === 'corpse') {
        mkobjTrace(`mksobj create otyp=${otyp} name=${nm} init=${init ? 1 : 0} artif=${artif ? 1 : 0} call=${getRngCallCount()}`);
    }
    const obj = newobj(otyp);
    if (init) mksobj_init(obj, artif, skipErosion);
    mksobj_postinit(obj);
    // C ref: mkobj.c — otmp->owt = weight(otmp) after full initialization
    obj.owt = weight(obj);
    return obj;
}

// C ref: mkobj.c special_corpse() macro
function special_corpse(mndx) {
    if (mndx < 0) return false;
    return mndx === PM_LIZARD || mndx === PM_LICHEN
        || mons[mndx].symbol === S_TROLL
        || mons[mndx].sound === MS_RIDER;
}

// C ref: mkobj.c start_corpse_timeout() — consume RNG for corpse rot/revive timing
// Only called for RNG alignment; we don't actually track timers.
export const TAINT_AGE = 50;
const TROLL_REVIVE_CHANCE = 37;
function start_corpse_timeout_rng(corpsenm) {
    // Lizards and lichen don't rot or revive
    if (corpsenm === PM_LIZARD || corpsenm === PM_LICHEN) return;
    // rot_adjust=25 during mklev; consume rnz(25)
    rnz(25);
    // Rider: rn2(3) loop for revival time
    if (mons[corpsenm].sound === MS_RIDER) {
        const minturn = 12; // non-Death rider default
        for (let when = minturn; when < 67; when++) {
            if (!rn2(3)) break;
        }
    } else if (mons[corpsenm].symbol === S_TROLL) {
        // Troll: rn2(37) loop up to TAINT_AGE times
        for (let age = 2; age <= TAINT_AGE; age++) {
            if (!rn2(TROLL_REVIVE_CHANCE)) break;
        }
    }
}

// C ref: mkobj.c set_corpsenm() — set corpsenm and restart timers
// Used by create_object (sp_lev) when overriding corpsenm after mksobj
// Unlike mkcorpstat's conditional check, this ALWAYS restarts start_corpse_timeout
// for corpses, matching C's set_corpsenm which unconditionally calls it.
export function set_corpsenm(obj, id) {
    obj.corpsenm = id;
    if (objectData[obj.otyp]?.name === 'corpse') {
        start_corpse_timeout_rng(id);
    }
    obj.owt = weight(obj);
}

// C ref: mkobj.c mkcorpstat() — create a corpse or statue with specific monster type
// ptr_mndx: monster index to override corpsenm (-1 for random/no override)
// init: whether to call mksobj_init (CORPSTAT_INIT flag)
export function mkcorpstat(objtype, ptr_mndx, init) {
    const otmp = mksobj(objtype, init, false);
    if (ptr_mndx >= 0) {
        const old_corpsenm = otmp.corpsenm;
        otmp.corpsenm = ptr_mndx;
        otmp.owt = weight(otmp);
        if (objectData[otmp.otyp]?.name === 'corpse'
            && (special_corpse(old_corpsenm)
                || special_corpse(ptr_mndx))) {
            // C: obj_stop_timers(otmp) — no RNG consumed
            // Restart corpse timeout with new corpsenm
            start_corpse_timeout_rng(ptr_mndx);
        }
    }
    return otmp;
}

// C ref: mkobj.c mkobj() -- create random object of a class
// skipErosion: if true, skip mkobj_erosions (for ini_inv UNDEF_TYP items)
export function mkobj(oclass, artif, skipErosion) {
    ensureObjectClassTablesInitialized();
    const inputClass = oclass;

    // RANDOM_CLASS selection
    if (oclass === 0) { // RANDOM_CLASS = 0 in C, but our ILLOBJ_CLASS = 0
        // Use mkobjprobs table
        let tprob = rnd(100);
        for (const ip of mkobjprobs) {
            tprob -= ip.iprob;
            if (tprob <= 0) { oclass = ip.iclass; break; }
        }
    }

    // Select specific object type within class
    const probTotal = oclass_prob_totals[oclass];
    let prob, i;
    if (probTotal > 0) {
        prob = rnd(probTotal);
        i = bases[oclass];
        while (prob > 0 && i < bases[oclass + 1]) {
            prob -= objectData[i].prob || 0;
            if (prob > 0) i++;
        }
    } else {
        i = bases[oclass];
    }
    // Sanity check
    if (i >= NUM_OBJECTS || objectData[i].oc_class !== oclass) {
        i = bases[oclass];
    }
    mkobjTrace(`mkobj call=${getRngCallCount()} in_class=${inputClass} class=${oclass} picked=${i} artif=${artif ? 1 : 0}`);
    return mksobj(i, true, artif, skipErosion);
}

// RANDOM_CLASS constant (matches C's RANDOM_CLASS = 0)
export const RANDOM_CLASS = 0;

// C ref: objnam.c just_an()
function just_an(str) {
    const s = String(str || '').trimStart();
    if (!s) return 'a';
    const c = s[0].toLowerCase();
    return 'aeiou'.includes(c) ? 'an' : 'a';
}

// C ref: objnam.c makeplural() + singplur_compound() (subset).
function makeplural(word) {
    const w0 = String(word || '').trimStart();
    if (!w0) return 's';
    if (/^pair of /i.test(w0)) return w0;

    const compounds = [
        ' of ', ' labeled ', ' called ', ' named ', ' above', ' versus ',
        ' from ', ' in ', ' on ', ' a la ', ' with', ' de ', " d'",
        ' du ', ' au ', '-in-', '-at-',
    ];
    const lower = w0.toLowerCase();
    let splitIdx = -1;
    for (const c of compounds) {
        const idx = lower.indexOf(c);
        if (idx >= 0 && (splitIdx < 0 || idx < splitIdx)) splitIdx = idx;
    }
    const excess = splitIdx >= 0 ? w0.slice(splitIdx) : '';
    let stem = splitIdx >= 0 ? w0.slice(0, splitIdx) : w0;
    stem = stem.replace(/\s+$/, '');
    if (!stem) return `s${excess}`;

    const irregular = new Map([
        ['corpse', 'corpses'],
        ['knife', 'knives'],
        ['tooth', 'teeth'],
        ['staff', 'staves'],
        ['man', 'men'],
    ]);
    const asIs = ['boots', 'shoes', 'gloves', 'lenses', 'scales', 'gauntlets', 'iron bars'];
    const stemLower = stem.toLowerCase();
    if (asIs.some(s => stemLower.endsWith(s))) return `${stem}${excess}`;

    for (const [sing, plur] of irregular.entries()) {
        if (stemLower.endsWith(sing)) {
            return `${stem.slice(0, stem.length - sing.length)}${plur}${excess}`;
        }
    }
    if (!/[A-Za-z]$/.test(stem)) return `${stem}'s${excess}`;
    if (/(s|x|z|ch|sh)$/i.test(stem) || /ato$/i.test(stem)) return `${stem}es${excess}`;
    if (/[^aeiou]y$/i.test(stem)) return `${stem.slice(0, -1)}ies${excess}`;
    return `${stem}s${excess}`;
}

// C ref: objnam.c xname() pluralize path + makeplural()
function pluralizeName(name) {
    const s = String(name || '');
    if (!s) return s;
    return makeplural(s);
}

// C ref: objnam.c xname() (subset used by current JS engine)
function xname_for_doname(obj, dknown = true, known = true, bknown = false) {
    const od = objectData[obj.otyp];
    const nameKnown = isObjectNameKnown(obj.otyp) || !!known;
    let base = od.name;
    switch (obj.oclass) {
    case RING_CLASS:
        base = !dknown ? 'ring'
            : nameKnown ? `ring of ${od.name}`
                : `${od.desc || od.name} ring`;
        break;
    case AMULET_CLASS:
        base = !dknown ? 'amulet'
            : nameKnown ? od.name
                : `${od.desc || od.name} amulet`;
        break;
    case POTION_CLASS:
        base = !dknown ? 'potion'
            : nameKnown ? `potion of ${od.name}`
                : `${od.desc || od.name} potion`;
        if (dknown && obj.odiluted) {
            base = `diluted ${base}`;
        }
        if (dknown && nameKnown && obj.otyp === POT_WATER
            && bknown && (obj.blessed || obj.cursed)) {
            base = `potion of ${obj.blessed ? 'holy' : 'unholy'} water`;
        }
        break;
    case SCROLL_CLASS:
        if (!dknown) base = 'scroll';
        else if (nameKnown) base = `scroll of ${od.name}`;
        else if (od.magic) base = `scroll labeled ${od.desc || od.name}`;
        else base = `${od.desc || od.name} scroll`;
        break;
    case SPBOOK_CLASS:
        base = !dknown ? 'spellbook'
            : nameKnown ? (obj.otyp === SPE_BOOK_OF_THE_DEAD
                ? od.name
                : `spellbook of ${od.name}`)
                : `${od.desc || od.name} spellbook`;
        break;
    case WAND_CLASS:
        if (!dknown) base = 'wand';
        else if (nameKnown) base = `wand of ${od.name}`;
        else if (od.desc) base = `${od.desc} wand`;
        else base = `wand of ${od.name}`;
        break;
    case TOOL_CLASS:
        // C ref: objnam.c xname() — lenses get "pair of ".
        if (obj.otyp === LENSES) {
            base = `pair of ${dknown ? od.name : (od.desc || od.name)}`;
        } else {
            base = dknown ? od.name : (od.desc || od.name);
        }
        break;
    case ARMOR_CLASS:
        // C ref: objnam.c xname() armor handling.
        if (obj.otyp >= GRAY_DRAGON_SCALES && obj.otyp <= YELLOW_DRAGON_SCALES) {
            base = `set of ${od.name}`;
        } else if (od.sub === ARM_BOOTS || od.sub === ARM_GLOVES) {
            base = `pair of ${dknown ? od.name : (od.desc || od.name)}`;
        } else if (!dknown && od.sub === ARM_SHIELD) {
            // C ref: objnam.c xname() unknown shield special-cases.
            if (obj.otyp >= ELVEN_SHIELD && obj.otyp <= ORCISH_SHIELD) {
                base = 'shield';
            } else if (obj.otyp === SHIELD_OF_REFLECTION) {
                base = 'smooth shield';
            } else {
                base = od.desc || od.name;
            }
        } else {
            base = dknown ? od.name : (od.desc || od.name);
        }
        break;
    case FOOD_CLASS:
        if (obj.otyp === CORPSE) {
            const corpseIdx = Number.isInteger(obj.corpsenm) ? obj.corpsenm : obj.corpsem;
            if (Number.isInteger(corpseIdx) && mons[corpseIdx]) {
                base = `${mons[corpseIdx].name} corpse`;
            } else {
                base = 'corpse';
            }
        } else {
            base = od.name;
        }
        break;
    default:
        base = od.name;
        break;
    }
    if ((obj.quan || 1) !== 1) base = pluralizeName(base);
    return base;
}

// C ref: objnam.c doname() — format an object name for display
// Produces strings like "a blessed +1 quarterstaff (weapon in hands)"
export function doname(obj, player) {
    const od = objectData[obj.otyp];
    const known = !!obj.known;
    const dknown = !!obj.dknown || known;
    const bknown = !!obj.bknown;
    const nameKnown = isObjectNameKnown(obj.otyp) || known;
    const quan = obj.quan || 1;
    const showCharges = known && od.charged
        && (obj.oclass === WAND_CLASS || obj.oclass === TOOL_CLASS);
    const suppressWaterBuc = (
        obj.otyp === POT_WATER
        && nameKnown
        && (obj.blessed || obj.cursed)
    );
    const roleName = String(player?.roleName || '');
    const roleIsCleric = roleName === 'Priest' || roleName === 'Priestess';
    let prefix = '';

    // C ref: objnam.c doname_base() quantity/article prefix
    if (quan !== 1) {
        prefix = `${quan} `;
    }

    // C ref: objnam.c doname_base() BUC logic
    if (bknown && obj.oclass !== COIN_CLASS && !suppressWaterBuc) {
        if (obj.cursed) prefix += 'cursed ';
        else if (obj.blessed) prefix += 'blessed ';
        else if (!(known && od.charged && obj.oclass !== ARMOR_CLASS
            && obj.oclass !== RING_CLASS) && !showCharges
            && !roleIsCleric) {
            prefix += 'uncursed ';
        }
    }

    // C ref: objnam.c doname_base() weapon poison marker
    if (obj.oclass === WEAPON_CLASS && obj.opoisoned) {
        prefix += 'poisoned ';
    }

    // C ref: objnam.c doname_base() known enchantment
    if (known && (obj.oclass === WEAPON_CLASS || obj.oclass === ARMOR_CLASS
        || (obj.oclass === RING_CLASS && od.charged))) {
        prefix += `${obj.spe >= 0 ? '+' : ''}${obj.spe} `;
    }

    const baseName = xname_for_doname(obj, dknown, known, bknown);
    let result = `${prefix}${baseName}`.trimStart();
    if (quan === 1 && !result.startsWith('the ')) {
        result = `${just_an(result)} ${result}`;
    }

    // Suffix: worn/wielded/charges
    if (player) {
        if (player.weapon === obj) {
            if (od.big) {
                result += ' (weapon in hands)';
            } else {
                result += ' (wielded)';
            }
        } else if (
            player.armor === obj
            || player.shield === obj
            || player.helmet === obj
            || player.gloves === obj
            || player.boots === obj
            || player.cloak === obj
        ) {
            result += ' (being worn)';
        }
    }

    // Charges suffix for wands and charged tools
    if (showCharges) {
        result += ` (0:${obj.spe})`;
    }

    return result;
}
