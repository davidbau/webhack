// display_rng.js -- Display-only RNG glyph helpers.
// C ref: display.h random_monster/random_object + what_mon/what_obj macros.

import { rn2_on_display_rng } from './rng.js';
import { mons } from './monsters.js';
import {
    objectData, CORPSE, STATUE,
    POTION_CLASS, FIRST_REAL_GEM, LAST_GLASS_GEM, FIRST_SPELL, LAST_SPELL,
} from './objects.js';
import { observeObject } from './discovery.js';
import { def_monsyms } from './symbols.js';

function randomMonsterGlyph() {
    if (!Array.isArray(mons) || mons.length === 0) {
        return { ch: '?', color: 7 };
    }
    const idx = rn2_on_display_rng(mons.length);
    const mon = mons[idx] || {};
    const symIdx = Number.isInteger(mon.symbol) ? mon.symbol : 0;
    const sym = def_monsyms[symIdx]?.sym || '?';
    const color = Number.isInteger(mon.color) ? mon.color : 7;
    return { ch: sym, color };
}

function randomObjectGlyph() {
    // C random_object() skips the "strange object" slot.
    const firstObject = 1;
    const count = Math.max(0, (objectData?.length || 0) - firstObject);
    if (count <= 0) return { ch: '?', color: 7 };
    const idx = rn2_on_display_rng(count) + firstObject;
    const obj = objectData[idx] || {};
    const ch = obj.symbol || '?';
    const color = Number.isInteger(obj.color) ? obj.color : 7;
    return { ch, color };
}

export function monsterMapGlyph(mon, hallucinating = false) {
    if (hallucinating) return randomMonsterGlyph();
    return {
        ch: mon?.displayChar || '?',
        color: Number.isInteger(mon?.displayColor) ? mon.displayColor : 7,
    };
}

function isGenericObject(obj) {
    if (!obj || obj.dknown) return false;
    if (obj.oclass === POTION_CLASS) return true;
    if (Number.isInteger(obj.otyp)
        && obj.otyp >= FIRST_REAL_GEM
        && obj.otyp <= LAST_GLASS_GEM) {
        return true;
    }
    if (Number.isInteger(obj.otyp)
        && obj.otyp >= FIRST_SPELL
        && obj.otyp <= LAST_SPELL) {
        return true;
    }
    return false;
}

function genericObjectGlyph(obj) {
    const classIdx = Number.isInteger(obj?.oclass) ? obj.oclass : 0;
    // This port keeps ILLOBJ_CLASS at 0, but generic slots start at index 1.
    const generic = objectData[classIdx + 1] || objectData[classIdx] || {};
    return {
        ch: generic.symbol || obj?.displayChar || '?',
        color: Number.isInteger(generic.color) ? generic.color : 7,
    };
}

function maybeObserveObjectForMap(obj, player, x, y) {
    if (!isGenericObject(obj) || !player || !Number.isInteger(x) || !Number.isInteger(y)) {
        return;
    }
    if (!Number.isInteger(player.x) || !Number.isInteger(player.y)) return;
    const r = 2; // C ref: display.c map_object() uses max(u.xray_range, 2)
    const neardist = (r * r) * 2 - r;
    const dx = player.x - x;
    const dy = player.y - y;
    if ((dx * dx) + (dy * dy) <= neardist) {
        observeObject(obj);
    }
}

export function objectMapGlyph(obj, hallucinating = false, options = {}) {
    if (hallucinating) return randomObjectGlyph();
    const { player = null, x = null, y = null, observe = true } = options;
    if (observe) {
        maybeObserveObjectForMap(obj, player, x, y);
    }
    if (isGenericObject(obj)) {
        return genericObjectGlyph(obj);
    }
    // C ref: display.c obj_to_glyph() — statues show the depicted
    // monster's symbol but use the object's oc_color, not the
    // monster's color.
    if (obj?.otyp === STATUE
        && Number.isInteger(obj?.corpsenm) && obj.corpsenm >= 0
        && obj.corpsenm < mons.length) {
        const mon = mons[obj.corpsenm];
        const symIdx = Number.isInteger(mon?.symbol) ? mon.symbol : 0;
        const ch = def_monsyms[symIdx]?.sym || '?';
        return { ch, color: Number.isInteger(obj?.displayColor) ? obj.displayColor : 7 };
    }
    const corpseColor = (obj?.otyp === CORPSE
        && Number.isInteger(obj?.corpsenm)
        && obj.corpsenm >= 0
        && Number.isInteger(mons[obj.corpsenm]?.color))
        ? mons[obj.corpsenm].color
        : null;
    return {
        ch: obj?.displayChar || '?',
        color: Number.isInteger(corpseColor)
            ? corpseColor
            : (Number.isInteger(obj?.displayColor) ? obj.displayColor : 7),
    };
}
