// objdata.js -- Object predicate functions
// C ref: include/objclass.h macros, src/zap.c obj_resists()
// These operate on object instances or otyp indices.

import {
    objectData,
    FLESH, VEGGY, WAX, WOOD, IRON, MITHRIL,
    FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
    TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS,
    CORPSE, EGG, TIN,
    AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR,
    BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    SPE_BOOK_OF_THE_DEAD,
} from './objects.js';
import { PM_DEATH, PM_PESTILENCE, PM_FAMINE } from './monsters.js';
import { rn2 } from './rng.js';

// ========================================================================
// Material predicates — C ref: objclass.h
// ========================================================================

// Get the material of an object instance
// C ref: #define oc_material(obj)  objects[(obj)->otyp].oc_material
// In JS: objectData[obj.otyp].material
export function oc_material(obj) {
    return objectData[obj.otyp].material;
}

// C ref: there is NO is_meat() macro in C. Instead C checks material == FLESH.
// We provide this for convenience, matching C's dogfood pattern.
export function is_meat(obj) {
    return oc_material(obj) === FLESH;
}

// C ref: #define vegan(obj) (oc_material(obj) == VEGGY)
// Note: in C this is a macro in objclass.h
export function vegan(obj) {
    return oc_material(obj) === VEGGY;
}

// C ref: #define vegetarian(obj) (oc_material(obj) == VEGGY || ... WAX || WOOD)
// Note: C checks veggy_material in eat.c: VEGGY, WAX, WOOD
export function vegetarian(obj) {
    const mat = oc_material(obj);
    return mat === VEGGY || mat === WAX || mat === WOOD;
}

// ========================================================================
// Object classification helpers
// ========================================================================

// C ref: obj.h — is_indestructible checks
export function is_quest_artifact(obj) {
    // Simplified — in C this checks artlist[]. For RNG alignment
    // we only need to know if obj_resists returns true.
    return false; // TODO: implement when artifacts are ported
}

// C ref: zap.c:1456 obj_resists() — check if object resists destruction
// Invocation items always resist (no RNG consumed).
// Everything else: ALWAYS consumes rn2(100), compares to ochance or achance.
export function obj_resists(obj, ochance, achance) {
    if (obj.otyp === AMULET_OF_YENDOR
        || obj.otyp === SPE_BOOK_OF_THE_DEAD
        || obj.otyp === CANDELABRUM_OF_INVOCATION
        || obj.otyp === BELL_OF_OPENING
        || (obj.otyp === CORPSE && is_rider_corpse(obj))
        || is_quest_artifact(obj)) {
        return true;
    }
    // C: int chance = rn2(100);
    //    return (boolean)(chance < (obj->oartifact ? achance : ochance));
    const chance = rn2(100);
    return chance < (obj.oartifact ? achance : ochance);
}

// C ref: is_rider() — checks for Death, Famine, Pestilence corpses
function is_rider_corpse(obj) {
    if (obj.otyp !== CORPSE) return false;
    const corpsenm = obj.corpsenm;
    return corpsenm === PM_DEATH
        || corpsenm === PM_PESTILENCE
        || corpsenm === PM_FAMINE;
}

// ========================================================================
// Material classification predicates — C ref: objclass.h
// ========================================================================

// C ref: #define is_organic(otmp) (objects[(otmp)->otyp].oc_material <= WOOD)
export function is_organic(obj) {
    return oc_material(obj) <= WOOD;
}

// C ref: #define is_metallic(otmp) (oc_mat >= IRON && oc_mat <= MITHRIL)
export function is_metallic(obj) {
    const mat = oc_material(obj);
    return mat >= IRON && mat <= MITHRIL;
}

// C ref: #define is_rustprone(otmp) (objects[(otmp)->otyp].oc_material == IRON)
export function is_rustprone(obj) { return oc_material(obj) === IRON; }

// C ref: #define is_flammable(otmp) — material < DRAGON_HIDE and not liquid/wax
export function is_flammable(obj) {
    const mat = oc_material(obj);
    return mat >= VEGGY && mat <= WOOD;
}

// ========================================================================
// Food classification helpers (for dogfood)
// ========================================================================

// C ref: dog.c — corpse checks for toxicity
export function is_corpse(obj) {
    return obj.otyp === CORPSE;
}

export function is_egg(obj) {
    return obj.otyp === EGG;
}

export function is_tin(obj) {
    return obj.otyp === TIN;
}
