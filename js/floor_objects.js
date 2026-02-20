// floor_objects.js -- Floor object placement/stacking helpers
// C ref: mkobj.c place_object()/stackobj()

import { COIN_CLASS, objectData } from './objects.js';
import { pushRngLogEntry } from './rng.js';

export function canStackFloorObject(a, b) {
    if (!a || !b) return false;
    if (a.otyp !== b.otyp) return false;
    if (a.oclass === COIN_CLASS) return true;
    if (!objectData[a.otyp]?.merge) return false;
    if (!!a.cursed !== !!b.cursed) return false;
    if (!!a.blessed !== !!b.blessed) return false;
    if ((a.spe || 0) !== (b.spe || 0)) return false;
    if ((a.known || 0) !== (b.known || 0)) return false;
    if ((a.oeroded || 0) !== (b.oeroded || 0)) return false;
    if ((a.oeroded2 || 0) !== (b.oeroded2 || 0)) return false;
    if (!!a.oerodeproof !== !!b.oerodeproof) return false;
    if ((a.odiluted || 0) !== (b.odiluted || 0)) return false;
    if ((a.recharged || 0) !== (b.recharged || 0)) return false;
    if ((a.corpsenm || 0) !== (b.corpsenm || 0)) return false;
    if ((a.oeaten || 0) !== (b.oeaten || 0)) return false;
    if ((a.ovar1 || 0) !== (b.ovar1 || 0)) return false;
    if ((a.ovar2 || 0) !== (b.ovar2 || 0)) return false;
    if ((a.ovar3 || 0) !== (b.ovar3 || 0)) return false;
    if ((a.age || 0) !== (b.age || 0)) return false;
    if (!!a.olocked !== !!b.olocked) return false;
    if (!!a.obroken !== !!b.obroken) return false;
    if (!!a.otrapped !== !!b.otrapped) return false;
    if ((a.no_charge || 0) !== (b.no_charge || 0)) return false;
    if (!!a.lamplit !== !!b.lamplit) return false;
    if ((a.poisoned || 0) !== (b.poisoned || 0)) return false;
    if ((a.material || 0) !== (b.material || 0)) return false;
    if ((a.wt || a.owt || 0) !== (b.wt || b.owt || 0)) return false;
    if ((a.unpaid || 0) !== (b.unpaid || 0)) return false;
    if ((a.shopOwned || 0) !== (b.shopOwned || 0)) return false;
    if ((a.noDrop || 0) !== (b.noDrop || 0)) return false;
    return (a.corpsenm === b.corpsenm)
        && (a.age === b.age);
}

export function placeFloorObject(map, obj) {
    pushRngLogEntry(`^place[${obj.otyp},${obj.ox},${obj.oy}]`);
    for (const existing of map.objects) {
        if (existing.ox !== obj.ox || existing.oy !== obj.oy) continue;
        if (existing.buried || obj.buried) continue;
        if (!canStackFloorObject(existing, obj)) continue;
        existing.quan = (existing.quan || 1) + (obj.quan || 1);
        return existing;
    }
    map.objects.push(obj);
    return obj;
}
