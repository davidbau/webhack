// discovery.js -- Object discovery state (oc_name_known / discoveries list)
// C ref: o_init.c discover_object(), observe_object(), dodiscovered()

import {
    objectData,
    WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS,
    FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS,
    COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS,
} from './objects.js';

// Generic placeholder object indices occupy [0..17] in this port.
const FIRST_OBJECT = 18;

let ocNameKnown = [];
let ocEncountered = [];
let discoByClass = new Map();

function resetDiscoByClass() {
    discoByClass = new Map();
    for (const oclass of [
        WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, TOOL_CLASS,
        FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS,
        COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS,
    ]) {
        discoByClass.set(oclass, []);
    }
}

// C ref: o_init.c init_objects() + sanity check of oc_name_known/oc_descr.
export function initDiscoveryState() {
    ocNameKnown = new Array(objectData.length).fill(false);
    ocEncountered = new Array(objectData.length).fill(false);
    for (let i = 0; i < objectData.length; i++) {
        const od = objectData[i];
        ocNameKnown[i] = !!od?.known || !od?.desc;
        ocEncountered[i] = false;
    }
    resetDiscoByClass();
}

export function isObjectNameKnown(otyp) {
    if (ocNameKnown.length === 0) {
        const od = objectData[otyp];
        return !!od?.known || !od?.desc;
    }
    return !!ocNameKnown[otyp];
}

export function isObjectEncountered(otyp) {
    return !!ocEncountered[otyp];
}

function pushDisco(otyp) {
    const od = objectData[otyp];
    if (!od) return;
    const cls = od.oc_class;
    const arr = discoByClass.get(cls);
    if (!arr) return;
    if (!arr.includes(otyp)) arr.push(otyp);
}

// C ref: o_init.c discover_object() (subset; no samurai special naming yet).
export function discoverObject(otyp, markAsKnown, markAsEncountered) {
    if (ocNameKnown.length === 0) initDiscoveryState();
    if (!Number.isInteger(otyp) || otyp < FIRST_OBJECT || otyp >= objectData.length) return;
    if ((!ocNameKnown[otyp] && markAsKnown) || (!ocEncountered[otyp] && markAsEncountered)) {
        pushDisco(otyp);
        if (markAsEncountered) ocEncountered[otyp] = true;
        if (!ocNameKnown[otyp] && markAsKnown) ocNameKnown[otyp] = true;
    }
}

// C ref: o_init.c observe_object()
export function observeObject(obj) {
    if (!obj) return;
    obj.dknown = true;
    discoverObject(obj.otyp, false, true);
}

// C ref: o_init.c interesting_to_discover() (subset: no oc_uname yet).
function interestingToDiscover(otyp) {
    const od = objectData[otyp];
    if (!od) return false;
    return ((ocNameKnown[otyp] || ocEncountered[otyp]) && !!od.desc);
}

function discoveryTypeName(otyp) {
    const od = objectData[otyp];
    if (!od) return 'unknown object';
    const nn = ocNameKnown[otyp];
    const dn = od.desc || od.name;
    const an = od.name;
    switch (od.oc_class) {
    case RING_CLASS:
        return nn ? `ring of ${an}` : `${dn} ring`;
    case AMULET_CLASS:
        return nn ? an : `${dn} amulet`;
    case POTION_CLASS:
        return nn ? `potion of ${an}` : `${dn} potion`;
    case SCROLL_CLASS:
        return nn ? `scroll of ${an}` : `scroll labeled ${dn}`;
    case SPBOOK_CLASS:
        return nn ? `spellbook of ${an}` : `${dn} spellbook`;
    case WAND_CLASS:
        return nn ? `wand of ${an}` : `${dn} wand`;
    default:
        return an;
    }
}

export function getDiscoveriesMenuLines() {
    const lines = [];
    const classOrder = [
        AMULET_CLASS, WEAPON_CLASS, ARMOR_CLASS, FOOD_CLASS, TOOL_CLASS,
        RING_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS,
        COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS,
    ];
    const classLabel = {
        [AMULET_CLASS]: 'Amulets',
        [WEAPON_CLASS]: 'Weapons',
        [ARMOR_CLASS]: 'Armor',
        [FOOD_CLASS]: 'Comestibles',
        [TOOL_CLASS]: 'Tools',
        [RING_CLASS]: 'Rings',
        [POTION_CLASS]: 'Potions',
        [SCROLL_CLASS]: 'Scrolls',
        [SPBOOK_CLASS]: 'Spellbooks',
        [WAND_CLASS]: 'Wands',
        [COIN_CLASS]: 'Coins',
        [GEM_CLASS]: 'Gems/Stones',
        [ROCK_CLASS]: 'Rocks',
        [BALL_CLASS]: 'Balls',
        [CHAIN_CLASS]: 'Chains',
        [VENOM_CLASS]: 'Venoms',
    };

    for (const cls of classOrder) {
        const discovered = (discoByClass.get(cls) || []).filter(interestingToDiscover);
        if (discovered.length === 0) continue;
        lines.push(classLabel[cls]);
        for (const otyp of discovered) {
            const star = ocEncountered[otyp] ? '  ' : '* ';
            lines.push(`${star}${discoveryTypeName(otyp)}`);
        }
    }
    return lines;
}
