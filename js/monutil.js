// monutil.js -- Shared monster utilities
// Distance macros from hack.h, debug tracing, display helpers,
// visibility checks, and monster inventory utilities.

import { isok } from './config.js';
import { PM_GRID_BUG,
         AT_BITE, AT_CLAW, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_WEAP } from './monsters.js';
import { couldsee } from './vision.js';
import { monNam } from './mondata.js';
import { weight } from './mkobj.js';
import { pushRngLogEntry } from './rng.js';
import { placeFloorObject } from './floor_objects.js';

// ========================================================================
// Constants — C ref: hack.h / monst.h / dogmove.c
// ========================================================================
export const MTSZ = 4;           // C ref: monst.h — track history size
export const SQSRCHRADIUS = 5;   // C ref: dogmove.c — object search radius
export const FARAWAY = 127;      // C ref: hack.h — large distance sentinel
export const BOLT_LIM = 8;       // C ref: hack.h BOLT_LIM (threat radius baseline)

// ========================================================================
// Debug tracing — development-only trace helpers
// ========================================================================
function monmoveTraceEnabled() {
    const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    return env.WEBHACK_MONMOVE_TRACE === '1';
}

export function monmoveTrace(...args) {
    if (!monmoveTraceEnabled()) return;
    console.log('[MONMOVE_TRACE]', ...args);
}

function monmovePhase3TraceEnabled() {
    const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    return env.WEBHACK_MONMOVE_PHASE3_TRACE === '1';
}

export function monmovePhase3Trace(...args) {
    if (!monmovePhase3TraceEnabled()) return;
    console.log('[MONMOVE_PHASE3]', ...args);
}

export function monmoveStepLabel(map) {
    const idx = map?._replayStepIndex;
    return Number.isInteger(idx) ? String(idx + 1) : '?';
}

// ========================================================================
// Distance — C ref: hack.h macros
// ========================================================================

// Squared distance
export function dist2(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// C ref: hack.h distmin()
export function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

// C ref: mon.c monnear() + NODIAG()
export function monnear(mon, x, y) {
    const distance = dist2(mon.mx, mon.my, x, y);
    // C ref: hack.h NODIAG(monnum) is only PM_GRID_BUG.
    const nodiag = mon.mndx === PM_GRID_BUG;
    if (distance === 2 && nodiag) return false;
    return distance < 3;
}

// ========================================================================
// Display helpers — attack verbs, monster names
// ========================================================================
export function attackVerb(type) {
    switch (type) {
        case AT_BITE: return 'bites';
        case AT_CLAW: return 'claws';
        // C ref: mhitm.c hitmm() uses generic "hits" for AT_KICK.
        case AT_KICK: return 'hits';
        case AT_BUTT: return 'butts';
        case AT_TUCH: return 'touches';
        case AT_STNG: return 'stings';
        case AT_WEAP: return 'hits';
        default: return 'hits';
    }
}

export function monAttackName(mon) {
    // C ref: do_name.c Monnam() — uses ARTICLE_THE regardless of tame status,
    // and "saddled" is prepended when a saddle is worn.
    return monNam(mon, { article: 'the', capitalize: true });
}

// ========================================================================
// Visibility helpers — canSpotMonsterForMap, rememberInvisibleAt
// ========================================================================
export function rememberInvisibleAt(map, x, y, player) {
    if (!map || !isok(x, y)) return;
    if (player && x === player.x && y === player.y) return;
    const loc = map.at(x, y);
    if (!loc) return;
    loc.mem_invis = true;
}

export function canSpotMonsterForMap(mon, map, player, fov) {
    if (!mon || !map || !player) return false;
    const visible = fov?.canSee ? fov.canSee(mon.mx, mon.my) : couldsee(map, player, mon.mx, mon.my);
    if (!visible) return false;
    if (player.blind) return false;
    if (mon.mundetected) return false;
    if (mon.minvis && !player.seeInvisible) return false;
    return true;
}

// ========================================================================
// Monster inventory helpers
// ========================================================================
export function canMergeMonsterInventoryObj(dst, src) {
    if (!dst || !src) return false;
    if (dst.otyp !== src.otyp) return false;
    if (!!dst.cursed !== !!src.cursed) return false;
    if (!!dst.blessed !== !!src.blessed) return false;
    if (Number(dst.spe || 0) !== Number(src.spe || 0)) return false;
    if (Number(dst.oeroded || 0) !== Number(src.oeroded || 0)) return false;
    if (Number(dst.oeroded2 || 0) !== Number(src.oeroded2 || 0)) return false;
    if (!!dst.oerodeproof !== !!src.oerodeproof) return false;
    if (!!dst.greased !== !!src.greased) return false;
    if (!!dst.opoisoned !== !!src.opoisoned) return false;
    if ((dst.corpsenm ?? -1) !== (src.corpsenm ?? -1)) return false;
    if ((dst.fromsink ?? null) !== (src.fromsink ?? null)) return false;
    if ((dst.no_charge ?? null) !== (src.no_charge ?? null)) return false;
    return true;
}

export function addToMonsterInventory(mon, obj) {
    if (!mon || !obj) return null;
    if (!Array.isArray(mon.minvent)) mon.minvent = [];
    const quan = Number(obj.quan || 1);
    if (quan <= 0) return null;
    obj.quan = quan;
    for (const invObj of mon.minvent) {
        if (!canMergeMonsterInventoryObj(invObj, obj)) continue;
        invObj.quan = Number(invObj.quan || 0) + quan;
        invObj.owt = weight(invObj);
        return invObj;
    }
    mon.minvent.push(obj);
    return obj;
}

// ========================================================================
// Centralized monster death/pickup/drop — C ref: mon.c, steal.c
// ========================================================================

// C ref: mon.c mondead() → m_detach() → relobj()
// Marks monster dead and drops all inventory to floor.
// Does NOT call map.removeMonster — callers handle removal if needed;
// movemon() filters dead monsters at end of turn.
export function mondead(mon, map) {
    mon.dead = true;
    pushRngLogEntry(`^die[${mon.mndx || 0}@${mon.mx},${mon.my}]`);
    // C ref: m_detach -> relobj: drop all inventory to floor
    if (Array.isArray(mon.minvent) && mon.minvent.length > 0) {
        // Reverse order to match C's relobj chain-order floor pile ordering
        for (let idx = mon.minvent.length - 1; idx >= 0; idx--) {
            const obj = mon.minvent[idx];
            if (!obj) continue;
            obj.ox = mon.mx;
            obj.oy = mon.my;
            placeFloorObject(map, obj);
        }
        mon.minvent = [];
        mon.weapon = null;
    }
}

// C ref: steal.c:619 mpickobj()
// Adds object to monster inventory with event logging.
// Callers are responsible for floor removal before calling this.
export function mpickobj(mon, obj) {
    pushRngLogEntry(`^pickup[${mon.mndx}@${mon.mx},${mon.my},${obj.otyp}]`);
    return addToMonsterInventory(mon, obj);
}

// C ref: steal.c:814 mdrop_obj()
// Removes object from monster inventory and places on floor with event logging.
export function mdrop_obj(mon, obj, map) {
    const idx = Array.isArray(mon.minvent) ? mon.minvent.indexOf(obj) : -1;
    if (idx >= 0) mon.minvent.splice(idx, 1);
    if (mon.weapon === obj) mon.weapon = null;
    obj.ox = mon.mx;
    obj.oy = mon.my;
    pushRngLogEntry(`^drop[${mon.mndx}@${mon.mx},${mon.my},${obj.otyp}]`);
    placeFloorObject(map, obj);
}
