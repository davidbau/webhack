// o_init.js -- Object initialization (description shuffling)
// Faithful port of o_init.c from NetHack 3.7.
// C ref: o_init.c init_objects(), shuffle_all(), shuffle(), randomize_gem_colors()
//
// This module performs the same RNG-consuming operations as C's o_init.c:
// randomize_gem_colors (3 rn2 calls), shuffle_all (194 rn2 calls),
// WAN_NOTHING direction (1 rn2 call) = 198 total.

import { rn2 } from './rng.js';
import { resetIdentCounter } from './mkobj.js';
import { initDiscoveryState } from './discovery.js';
import {
    objectData, initObjectData, bases,
    ARMOR_CLASS, AMULET_CLASS, POTION_CLASS, RING_CLASS, SCROLL_CLASS,
    SPBOOK_CLASS, WAND_CLASS, GEM_CLASS, VENOM_CLASS,
    // Gem indices for randomize_gem_colors
    TURQUOISE, AQUAMARINE, FLUORITE,
    SAPPHIRE, DIAMOND, EMERALD,
    // Amulet range
    AMULET_OF_ESP, AMULET_OF_FLYING,
    // Potion range
    POT_GAIN_ABILITY, POT_OIL, POT_WATER,
    // Scroll range
    SCR_ENCHANT_ARMOR, SC20,
    // Spellbook range
    SPE_DIG, SPE_CHAIN_LIGHTNING,
    // Wand range (entire class via bases)
    WAN_NOTHING,
    // Armor sub-ranges
    HELMET, HELM_OF_TELEPATHY,
    LEATHER_GLOVES, GAUNTLETS_OF_DEXTERITY,
    CLOAK_OF_PROTECTION, CLOAK_OF_DISPLACEMENT,
    SPEED_BOOTS, LEVITATION_BOOTS,
    // Venom range (entire class via bases)
    // Gem probability constants
    LAST_REAL_GEM, oclass_prob_totals,
} from './objects.js';

// C ref: objclass.h
const NODIR = 1;
const IMMEDIATE = 2;

// Save canonical (unshuffled) object properties on first call.
// Since JS may call init_objects() multiple times (once per makelevel),
// we restore originals before each shuffle to ensure determinism.
let savedProps = null;

function save_originals() {
    if (savedProps) return; // only save once (from the pristine objectData)
    savedProps = objectData.map(obj => ({
        desc: obj.desc,
        color: obj.color,
        tough: obj.tough || 0,
        material: obj.material,
        dir: obj.dir,
    }));
}

function restore_originals() {
    for (let i = 0; i < objectData.length; i++) {
        objectData[i].desc = savedProps[i].desc;
        objectData[i].color = savedProps[i].color;
        if (savedProps[i].tough) objectData[i].tough = savedProps[i].tough;
        else delete objectData[i].tough;
        objectData[i].material = savedProps[i].material;
        objectData[i].dir = savedProps[i].dir;
    }
}

// ========================================================================
// randomize_gem_colors -- swap gem descriptions randomly
// C ref: o_init.c:83-108
// 3 rn2 calls total
// ========================================================================

function copy_obj_descr(dst_idx, src_idx) {
    objectData[dst_idx].desc = objectData[src_idx].desc;
    objectData[dst_idx].color = objectData[src_idx].color;
}

function randomize_gem_colors() {
    // Turquoise: maybe change from green to blue (copy from sapphire)
    if (rn2(2)) {
        copy_obj_descr(TURQUOISE, SAPPHIRE);
    }
    // Aquamarine: maybe change from green to blue (copy from sapphire)
    if (rn2(2)) {
        copy_obj_descr(AQUAMARINE, SAPPHIRE);
    }
    // Fluorite: maybe change from violet to blue/white/green
    const j = rn2(4);
    if (j === 1) copy_obj_descr(FLUORITE, SAPPHIRE);
    else if (j === 2) copy_obj_descr(FLUORITE, DIAMOND);
    else if (j === 3) copy_obj_descr(FLUORITE, EMERALD);
    // j === 0: stays violet (no change)
}

// ========================================================================
// shuffle -- Fisher-Yates variant with oc_name_known skip
// C ref: o_init.c:111-147
// ========================================================================

function is_name_known(idx) {
    // In C, oc_name_known is set for objects with no description.
    // C ref: o_init.c:210-224 validation
    return !objectData[idx].desc;
}

function shuffle(o_low, o_high, domaterial) {
    // Count shufflable items
    let num_to_shuffle = 0;
    for (let j = o_low; j <= o_high; j++) {
        if (!is_name_known(j)) num_to_shuffle++;
    }
    if (num_to_shuffle < 2) return;

    for (let j = o_low; j <= o_high; j++) {
        if (is_name_known(j)) continue;

        // Pick random swap target, retrying if it's name_known
        let i;
        do {
            i = j + rn2(o_high - j + 1);
        } while (is_name_known(i));

        // Swap desc (C: oc_descr_idx)
        let sw = objectData[j].desc;
        objectData[j].desc = objectData[i].desc;
        objectData[i].desc = sw;

        // Swap tough (C: oc_tough)
        sw = objectData[j].tough || 0;
        objectData[j].tough = objectData[i].tough || 0;
        objectData[i].tough = sw;

        // Swap color (C: oc_color)
        const color = objectData[j].color;
        objectData[j].color = objectData[i].color;
        objectData[i].color = color;

        // Swap material if domaterial (class shuffles)
        if (domaterial) {
            sw = objectData[j].material;
            objectData[j].material = objectData[i].material;
            objectData[i].material = sw;
        }
    }
}

// ========================================================================
// shuffle_all -- shuffle descriptions for all applicable ranges
// C ref: o_init.c:320-346
// 194 rn2 calls total (when no oc_name_known items in ranges)
// ========================================================================

function shuffle_all() {
    // Group 1: Entire classes (domaterial = true)
    // C ref: shuffle_classes[] = AMULET, POTION, RING, SCROLL, SPBOOK, WAND, VENOM

    // Amulets: AMULET_OF_ESP(199)..AMULET_OF_FLYING(209) — 11 items
    shuffle(AMULET_OF_ESP, AMULET_OF_FLYING, true);

    // Potions: POT_GAIN_ABILITY(295)..POT_OIL(319) — 25 items
    // (excludes POT_WATER which has fixed "clear" description)
    shuffle(POT_GAIN_ABILITY, POT_OIL, true);

    // Rings: entire class via bases[]
    shuffle(bases[RING_CLASS], bases[RING_CLASS + 1] - 1, true);

    // Scrolls: SCR_ENCHANT_ARMOR(321)..SC20(361) — 41 items
    // (includes 21 real scrolls + 20 extra labels; excludes SCR_BLANK_PAPER)
    shuffle(SCR_ENCHANT_ARMOR, SC20, true);

    // Spellbooks: SPE_DIG(363)..SPE_CHAIN_LIGHTNING(403) — 41 items
    // (excludes SPE_BLANK_PAPER, SPE_NOVEL, SPE_BOOK_OF_THE_DEAD)
    shuffle(SPE_DIG, SPE_CHAIN_LIGHTNING, true);

    // Wands: entire class via bases[]
    shuffle(bases[WAND_CLASS], bases[WAND_CLASS + 1] - 1, true);

    // Venom: entire class via bases[]
    shuffle(bases[VENOM_CLASS], bases[VENOM_CLASS + 1] - 1, true);

    // Group 2: Armor sub-ranges (domaterial = false)
    // C ref: shuffle_types[] = HELMET, LEATHER_GLOVES, CLOAK_OF_PROTECTION, SPEED_BOOTS

    // Helmets: HELMET(97)..HELM_OF_TELEPATHY(100) — 4 items
    shuffle(HELMET, HELM_OF_TELEPATHY, false);

    // Gloves: LEATHER_GLOVES(157)..GAUNTLETS_OF_DEXTERITY(160) — 4 items
    shuffle(LEATHER_GLOVES, GAUNTLETS_OF_DEXTERITY, false);

    // Cloaks: CLOAK_OF_PROTECTION(146)..CLOAK_OF_DISPLACEMENT(149) — 4 items
    shuffle(CLOAK_OF_PROTECTION, CLOAK_OF_DISPLACEMENT, false);

    // Boots: SPEED_BOOTS(164)..LEVITATION_BOOTS(170) — 7 items
    shuffle(SPEED_BOOTS, LEVITATION_BOOTS, false);
}

// ========================================================================
// init_objects -- main entry point
// C ref: o_init.c init_objects()
// Total: 198 rn2 calls (3 gem + 194 shuffle + 1 WAN_NOTHING)
// ========================================================================

export function init_objects() {
    // Compute bases[] and probability totals first
    initObjectData();
    initDiscoveryState();

    // Save/restore canonical descriptions so repeated calls are deterministic
    save_originals();
    restore_originals();

    // Reset identity counter for deterministic monster/object IDs
    resetIdentCounter();

    // Randomize some gem colors (3 rn2 calls)
    // C ref: o_init.c:193
    randomize_gem_colors();

    // Shuffle object descriptions (194 rn2 calls)
    // C ref: o_init.c:228
    shuffle_all();

    // Randomize WAN_NOTHING direction (1 rn2 call)
    // C ref: o_init.c:233
    objectData[WAN_NOTHING].dir = rn2(2) ? NODIR : IMMEDIATE;
}

// cf. o_init.c:351 — check if an object's description matches a string
// Returns true if obj's shuffled/unshuffled description equals descr.
export function objdescr_is(obj, descr) {
    if (!obj) return false;
    const objdescr = objectData[obj.otyp]?.desc;
    if (!objdescr) return false;
    return objdescr === descr;
}

// cf. o_init.c:268 — return the shuffleable range containing otyp
// Returns { lo, hi } — the range of object indices whose descriptions are
// shuffled together.  If otyp is not in any shuffled range, lo === hi === otyp.
export function obj_shuffle_range(otyp) {
    const ocls = objectData[otyp]?.oc_class;
    let lo = otyp, hi = otyp;

    switch (ocls) {
    case ARMOR_CLASS:
        if (otyp >= HELMET && otyp <= HELM_OF_TELEPATHY)
            { lo = HELMET; hi = HELM_OF_TELEPATHY; }
        else if (otyp >= LEATHER_GLOVES && otyp <= GAUNTLETS_OF_DEXTERITY)
            { lo = LEATHER_GLOVES; hi = GAUNTLETS_OF_DEXTERITY; }
        else if (otyp >= CLOAK_OF_PROTECTION && otyp <= CLOAK_OF_DISPLACEMENT)
            { lo = CLOAK_OF_PROTECTION; hi = CLOAK_OF_DISPLACEMENT; }
        else if (otyp >= SPEED_BOOTS && otyp <= LEVITATION_BOOTS)
            { lo = SPEED_BOOTS; hi = LEVITATION_BOOTS; }
        break;
    case POTION_CLASS:
        // potion of water has the only fixed description
        lo = bases[POTION_CLASS];
        hi = POT_WATER - 1;
        break;
    case AMULET_CLASS:
    case SCROLL_CLASS:
    case SPBOOK_CLASS:
        // exclude non-magic types and also unique ones
        lo = bases[ocls];
        { let i = lo;
          while (i < objectData.length && objectData[i].oc_class === ocls) {
              if (objectData[i].unique || !objectData[i].magic) break;
              i++;
          }
          hi = i - 1; }
        break;
    case RING_CLASS:
    case WAND_CLASS:
    case VENOM_CLASS:
        // entire class
        lo = bases[ocls];
        hi = bases[ocls + 1] - 1;
        break;
    }

    // artifact checking: if otyp fell outside the computed range, reset
    if (otyp < lo || otyp > hi) lo = hi = otyp;
    return { lo, hi };
}

// cf. o_init.c:53 — adjust gem probabilities based on dungeon depth
// Gems deeper in the list are rarer; deeper levels make more gems available.
// In C, lev = ledger_no(dlev); in JS, depth is used directly as lev.
export function setgemprobs(depth) {
    const lev = depth || 0;
    let first = bases[GEM_CLASS];
    let sum = 0;

    // Zero out the first (9 - floor(lev/3)) gems (the rarest, depth-limited ones)
    let j;
    for (j = 0; j < 9 - Math.floor(lev / 3); j++)
        objectData[first + j].prob = 0;
    first += j; // first now points to the first accessible gem

    // Set probability for accessible gems proportionally
    // C: (171 + j - first) / (LAST_REAL_GEM + 1 - first) — integer division
    const denom = LAST_REAL_GEM + 1 - first;
    for (j = first; j <= LAST_REAL_GEM; j++)
        objectData[j].prob = denom > 0 ? Math.floor((171 + j - first) / denom) : 0;

    // Recompute GEM_CLASS probability total (including rocks/stones beyond LAST_REAL_GEM)
    for (j = bases[GEM_CLASS]; j < bases[GEM_CLASS + 1]; j++)
        sum += (objectData[j].prob || 0);
    oclass_prob_totals[GEM_CLASS] = sum;
}
