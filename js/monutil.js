// monutil.js -- Shared monster utilities
// Distance macros from hack.h, debug tracing, display helpers,
// visibility checks, and monster inventory utilities.

import { isok } from './config.js';
import { PM_GRID_BUG,
         AT_BITE, AT_CLAW, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_WEAP,
         AT_ENGL, AT_HUGS, AD_STCK } from './monsters.js';
import { couldsee } from './vision.js';
import { monNam } from './mondata.js';
import { is_hider, noattacks, dmgtype, attacktype } from './mondata.js';
import { weight } from './mkobj.js';
import { pushRngLogEntry, rnd } from './rng.js';
import { placeFloorObject } from './floor_objects.js';
import { SCR_SCARE_MONSTER } from './objects.js';

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

function onscary(map, x, y) {
    if (!map) return false;
    const objects = Array.isArray(map.objects) ? map.objects : [];

    for (const obj of objects) {
        if (!obj || obj.buried) continue;
        if (obj.ox === x && obj.oy === y
            && obj.otyp === SCR_SCARE_MONSTER
            && !obj.cursed) {
            return true;
        }
    }

    if (!Array.isArray(map.engravings)) return false;
    for (const engr of map.engravings) {
        if (!engr || engr.x !== x || engr.y !== y) continue;
        if (/elbereth/i.test(String(engr.text || ''))) {
            return true;
        }
    }

    return false;
}

function monsterHelpless(mon) {
    if (!mon) return true;
    if (mon.sleeping) return true;
    if (mon.mfrozen > 0) return true;
    if (mon.mcanmove === false) return true;
    if (mon.stunned) return true;
    return false;
}

function sanitizeMonsterType(mon) {
    const ptr = mon?.type;
    const ptrIsObject = ptr && typeof ptr === 'object';
    const attacks = ptrIsObject && Array.isArray(ptr.attacks)
        ? ptr.attacks
        : (!ptrIsObject ? [{ type: AT_WEAP }] : []);

    return {
        ...(ptrIsObject ? ptr : {}),
        attacks,
        flags1: Number(ptr?.flags1 ?? 0),
        flags2: Number(ptr?.flags2 ?? 0),
        flags3: Number(ptr?.flags3 ?? 0),
    };
}

// C ref: hack.c:3988 — monster_nearby()
// Checks adjacent monsters that can actually threaten the player this turn.
export function monsterNearby(map, player, fov) {
    if (!map || !player) return false;
    const px = player.x;
    const py = player.y;
    const playerHallucinating = !!player.hallucinating;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const x = px + dx;
            const y = py + dy;
            if (!isok(x, y)) continue;

            const mon = map.monsterAt(x, y);
            if (!mon || mon.dead) continue;
            if (mon.m_ap_type === 'furniture' || mon.m_ap_type === 'object') continue;

            const mptr = sanitizeMonsterType(mon);
            const isPeaceful = !!(mon.mpeaceful || mon.peaceful);
            if (!(playerHallucinating || (!mon.tame && !isPeaceful && !noattacks(mptr)))) continue;

            if (is_hider(mptr || {}) && mon.mundetected) continue;
            if (monsterHelpless(mon)) continue;
            if (onscary(map, px, py)) continue;

            let visible = true;
            try {
                visible = canSpotMonsterForMap(mon, map, player, fov);
            } catch (_err) {
                visible = true;
            }
            if (!visible) continue;

            return true;
        }
    }

    return false;
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

// C ref: mon.c:3434 unstuck() — release hero if stuck to dying/departing monster
// Called from mon_leaving_level (via m_detach from mondead) and mongone.
// Sets mspec_used = rnd(2) for sticky/engulfing/hugging monsters to prevent
// immediate re-engagement (relevant when monster doesn't die, e.g. polymorph).
export function unstuck(mon, player) {
    if (!player || player.ustuck !== mon) return;
    const ptr = mon.type || {};
    player.ustuck = null;
    // C ref: mon.c:3458-3461 — prevent holder from immediately re-holding
    if (!mon.mspec_used && (dmgtype(ptr, AD_STCK)
                            || attacktype(ptr, AT_ENGL)
                            || attacktype(ptr, AT_HUGS))) {
        mon.mspec_used = rnd(2);
    }
}

// C ref: mon.c mondead() → m_detach() → mon_leaving_level() → unstuck()
// Marks monster dead and drops all inventory to floor.
// Does NOT call map.removeMonster — callers handle removal if needed;
// movemon() filters dead monsters at end of turn.
export function mondead(mon, map, player) {
    mon.dead = true;
    pushRngLogEntry(`^die[${mon.mndx || 0}@${mon.mx},${mon.my}]`);
    // C ref: mon.c:2685 mon_leaving_level → unstuck
    if (player) unstuck(mon, player);
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
