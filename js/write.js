// write.js — Writing on blank scrolls and spellbooks (magic marker)
// Faithful port of write.c from NetHack 3.7.
//
// Implements: cost(), write_ok(), dowrite(), new_book_description()
// cf. write.c

import {
    SCROLL_CLASS, SPBOOK_CLASS,
    SCR_BLANK_PAPER, SPE_BLANK_PAPER,
    SCR_LIGHT, SCR_GOLD_DETECTION, SCR_FOOD_DETECTION, SCR_MAGIC_MAPPING,
    SCR_AMNESIA, SCR_FIRE, SCR_EARTH,
    SCR_DESTROY_ARMOR, SCR_CREATE_MONSTER, SCR_PUNISHMENT,
    SCR_CONFUSE_MONSTER,
    SCR_IDENTIFY,
    SCR_ENCHANT_ARMOR, SCR_REMOVE_CURSE, SCR_ENCHANT_WEAPON, SCR_CHARGING,
    SCR_SCARE_MONSTER, SCR_STINKING_CLOUD, SCR_TAMING, SCR_TELEPORTATION,
    SCR_GENOCIDE,
    objectData,
} from './objects.js';

// cf. hack.h:510 — getobj() callback return values (shared protocol, defined here
// until a dedicated getobj module exists)
const GETOBJ_EXCLUDE    = -3;
const GETOBJ_DOWNPLAY   =  1;
const GETOBJ_SUGGEST    =  2;

// cf. write.c:14 — returns base cost of writing a scroll or spellbook
// Cost is the number of marker charges consumed.
// For spellbooks: 10 × spell level (oc2 == oc_level per objclass.h:104).
// For scrolls: fixed per-type cost table matching C.
function cost(otmp) {
    if (otmp.oclass === SPBOOK_CLASS)
        return 10 * objectData[otmp.otyp].oc2; // oc2 == oc_level for books

    switch (otmp.otyp) {
    case SCR_LIGHT:
    case SCR_GOLD_DETECTION:
    case SCR_FOOD_DETECTION:
    case SCR_MAGIC_MAPPING:
    case SCR_AMNESIA:
    case SCR_FIRE:
    case SCR_EARTH:
        return 8;
    case SCR_DESTROY_ARMOR:
    case SCR_CREATE_MONSTER:
    case SCR_PUNISHMENT:
        return 10;
    case SCR_CONFUSE_MONSTER:
        return 12;
    case SCR_IDENTIFY:
        return 14;
    case SCR_ENCHANT_ARMOR:
    case SCR_REMOVE_CURSE:
    case SCR_ENCHANT_WEAPON:
    case SCR_CHARGING:
        return 16;
    case SCR_SCARE_MONSTER:
    case SCR_STINKING_CLOUD:
    case SCR_TAMING:
    case SCR_TELEPORTATION:
        return 20;
    case SCR_GENOCIDE:
        return 30;
    case SCR_BLANK_PAPER:
    default:
        // impossible("You can't write such a weird scroll!")
        return 1000;
    }
}

// cf. write.c:61 — getobj callback: which objects can be written on?
// Blank paper (scroll or spellbook) is SUGGEST; all others are DOWNPLAY or EXCLUDE.
function write_ok(obj) {
    if (!obj || (obj.oclass !== SCROLL_CLASS && obj.oclass !== SPBOOK_CLASS))
        return GETOBJ_EXCLUDE;

    if (obj.otyp === SCR_BLANK_PAPER || obj.otyp === SPE_BLANK_PAPER)
        return GETOBJ_SUGGEST;

    return GETOBJ_DOWNPLAY;
}

// cf. write.c:74 — apply a magic marker: write on a blank scroll or spellbook
// TODO: dowrite() requires getobj, getlin, mksobj, useup, hold_another_object,
//       known_spell, bcsign, wipeout_text, check_unpaid, exercise, livelog_printf,
//       and the full message/conduct system — not yet implemented.
export function dowrite(pen) {
    void pen;
    // TODO: write.c:74 — dowrite(): write on blank scroll/spellbook with magic marker
    return 0; // ECMD_OK placeholder
}

// cf. write.c:395 — build the description string for the spellbook-conversion message.
// "the spellbook warps strangely, then turns <result>."
// Composition-material descriptions (parchment, vellum, cloth) get "into " prepended.
// JS: returns the string directly rather than writing into a caller-provided buffer.
function new_book_description(booktype) {
    const compositions = ['parchment', 'vellum', 'cloth'];
    const descr = objectData[booktype].desc;
    return (compositions.includes(descr) ? 'into ' : '') + descr;
}

export { cost, write_ok, new_book_description };
