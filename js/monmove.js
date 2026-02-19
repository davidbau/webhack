// monmove.js -- Monster movement AI
// C ref: monmove.c — dochug(), m_move(), m_move_aggress(), set_apparxy()
// Pet AI (dogmove.c) is in dogmove.js
// Focus: exact RNG consumption alignment with C NetHack
//
// INCOMPLETE / MISSING vs C monmove.c:
// - dochug: no Conflict handling (C:870), no covetous/quest/vault guards
// - dochug: m_respond() not implemented (C:764, handles spell/gaze/breath)
// - dochug: flees_light (gremlin+artifact light) not implemented (C:555)
// - dochug: in_your_sanctuary (temple) not implemented (C:564)
// - m_move: no boulder-pushing by strong monsters (C:2020)
// - m_move: no vault guard movement (C:1730)
// - m_move: covetous monster teleport-to-hero not implemented (C:1737)
// - m_move_aggress: simplified attack — only first attack used, no full mattackm
// - set_apparxy: displacement displacement-offset details simplified
// - shk_move: simplified from full C shk.c; no billing/theft tracking
// - undesirable_disp: not yet implemented (C:2279)
// - distfleeck: brave_gremlin roll consumed but not applied (C:541)

import { COLNO, ROWNO, IS_WALL, IS_DOOR, IS_ROOM,
         ACCESSIBLE, CORR, DOOR, D_ISOPEN, D_CLOSED, D_LOCKED, D_BROKEN,
         SHOPBASE, ROOM, ROOMOFFSET,
         NORMAL_SPEED, isok } from './config.js';
import { rn2, rnd, c_d } from './rng.js';
import { monsterAttackPlayer, applyMonflee } from './combat.js';
import { FOOD_CLASS, COIN_CLASS, BOULDER, ROCK, ROCK_CLASS,
         WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS,
         AMULET_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, RING_CLASS, SPBOOK_CLASS,
         PICK_AXE, DWARVISH_MATTOCK,
         CLOAK_OF_DISPLACEMENT, MINERAL, GOLD_PIECE,
         SKELETON_KEY, LOCK_PICK, CREDIT_CARD,
         objectData } from './objects.js';
import { next_ident, weight } from './mkobj.js';
import { can_carry } from './dogmove.js';
import { couldsee, m_cansee } from './vision.js';
import { can_teleport, noeyes, perceives, nohands,
         hides_under, is_mercenary, monDisplayName, monNam,
         mon_knows_traps, is_rider } from './mondata.js';
import { PM_GRID_BUG, PM_SHOPKEEPER, mons,
         PM_LEPRECHAUN,
         PM_DISPLACER_BEAST,
         PM_WHITE_UNICORN, PM_GRAY_UNICORN, PM_BLACK_UNICORN,
         AT_NONE, AT_CLAW, AT_WEAP,
         S_MIMIC,
         S_DOG, S_NYMPH, S_LEPRECHAUN, S_HUMAN,
         M2_COLLECT, M2_STRONG, M2_ROCKTHROW, M2_GREEDY, M2_JEWELS, M2_MAGIC,
         MZ_TINY, MZ_HUMAN, WT_HUMAN,
         M2_WANDER } from './monsters.js';
import { dog_move, could_reach_item } from './dogmove.js';
import { initrack, settrack, gettrack } from './track.js';
import { pointInShop, monsterInShop } from './shknam.js';

// Shared utilities — re-exported for consumers
import { dist2, distmin, monnear,
         monmoveTrace, monmovePhase3Trace, monmoveStepLabel,
         attackVerb, monAttackName,
         canSpotMonsterForMap, rememberInvisibleAt,
         addToMonsterInventory, canMergeMonsterInventoryObj,
         MTSZ, SQSRCHRADIUS, FARAWAY, BOLT_LIM } from './monutil.js';
export { dist2, distmin, monnear,
         monmoveTrace, monmovePhase3Trace, monmoveStepLabel,
         attackVerb, monAttackName,
         canSpotMonsterForMap, rememberInvisibleAt,
         addToMonsterInventory, canMergeMonsterInventoryObj,
         MTSZ, SQSRCHRADIUS, FARAWAY, BOLT_LIM };

// Re-export track functions (track.c)
export { initrack, settrack };

// Re-export mon.c functions
import { movemon as _movemon, mfndpos, handleHiderPremove,
         onscary,
         petCorpseChanceRoll, consumePassivemmRng } from './mon.js';
export { mfndpos, onscary, petCorpseChanceRoll, consumePassivemmRng };

// Re-export trap.c functions
import { m_harmless_trap, floor_trigger, mintrap_postmove } from './trap.js';
export { m_harmless_trap, floor_trigger, mintrap_postmove };

// Re-export mthrowu.c functions
import { thrwmu, hasWeaponAttack, maybeMonsterWieldBeforeAttack, linedUpToPlayer } from './mthrowu.js';

// ========================================================================
// movemon — wrapper that binds dochug into mon.js movemon
// ========================================================================
export function movemon(map, player, display, fov, game = null) {
    _movemon(map, player, display, fov, game, { dochug, handleHiderPremove });
}

// C direction tables (C ref: monmove.c)
const xdir = [0, 1, 1, 1, 0, -1, -1, -1];
const ydir = [-1, -1, 0, 1, 1, 1, 0, -1];

// ========================================================================
// onscary — C ref: monmove.c:241 (also in mon.c; we delegate to mon.js)
// ========================================================================
// (imported and re-exported above)

// ========================================================================
// leppie_avoidance — C ref: monmove.c:1142
// ========================================================================
function hasGold(inv) {
    return Array.isArray(inv)
        && inv.some(o => o && o.oclass === COIN_CLASS && (o.quan ?? 1) > 0);
}

function goldQuantity(inv) {
    if (!Array.isArray(inv)) return 0;
    let total = 0;
    for (const obj of inv) {
        if (!obj || obj.oclass !== COIN_CLASS) continue;
        total += Number(obj.quan || 0);
    }
    return total;
}

function leppie_avoidance(mon, player) {
    if (!mon || mon.mndx !== PM_LEPRECHAUN) return false;
    const lepreGold = goldQuantity(mon.minvent || []);
    if (lepreGold <= 0) return false;
    const heroGold = goldQuantity(player?.inventory || []);
    return lepreGold > heroGold;
}

// ========================================================================
// mon_track_add — C ref: monmove.c:79
// mon_track_clear — C ref: monmove.c:90
// ========================================================================

// C ref: monmove.c:79 — add position (x,y) to front of monster's track ring
export function mon_track_add(mon, x, y) {
    if (!Array.isArray(mon?.mtrack)) return;
    for (let j = MTSZ - 1; j > 0; j--)
        mon.mtrack[j] = mon.mtrack[j - 1];
    mon.mtrack[0] = { x, y };
}

// C ref: monmove.c:90 — clear all entries in monster's position track
export function mon_track_clear(mon) {
    if (!Array.isArray(mon?.mtrack)) return;
    for (let j = 0; j < mon.mtrack.length; j++)
        mon.mtrack[j] = { x: 0, y: 0 };
}

// ========================================================================
// monhaskey — C ref: monmove.c:97
// ========================================================================

// C ref: monmove.c:97 — check whether a monster carries a locking/unlocking tool
// forUnlocking=true: credit card also counts (C: for_unlocking)
export function monhaskey(mon, forUnlocking) {
    const inv = mon?.minvent || [];
    if (forUnlocking && inv.some(o => o?.otyp === CREDIT_CARD)) return true;
    return inv.some(o => o?.otyp === SKELETON_KEY || o?.otyp === LOCK_PICK);
}

// ========================================================================
// m_avoid_kicked_loc — C ref: monmove.c:1300
// ========================================================================
export function m_avoid_kicked_loc(mon, nx, ny, player) {
    const kl = player?.kickedloc;
    const monCanSee = (mon?.mcansee !== false) && !mon?.blind;
    if (!kl || !isok(kl.x, kl.y)) return false;
    if (!(mon?.peaceful || mon?.tame)) return false;
    if (player?.conflict) return false;
    if (!monCanSee || mon?.confused || mon?.stunned) return false;
    return nx === kl.x && ny === kl.y && dist2(nx, ny, player.x, player.y) <= 2;
}

// ========================================================================
// m_avoid_soko_push_loc — C ref: monmove.c:1316
// ========================================================================
export function m_avoid_soko_push_loc(mon, nx, ny, map, player) {
    if (!map?.flags?.sokoban) return false;
    if (!(mon?.peaceful || mon?.tame)) return false;
    if (mon?.confused || mon?.stunned) return false;
    if (player?.conflict) return false;
    if (dist2(nx, ny, player.x, player.y) !== 4) return false;
    const bx = nx + Math.sign(player.x - nx);
    const by = ny + Math.sign(player.y - ny);
    return (map.objects || []).some((obj) =>
        !obj?.buried && obj.otyp === BOULDER && obj.ox === bx && obj.oy === by
    );
}

// ========================================================================
// m_search_items — C ref: monmove.c:1333
// ========================================================================
const MAX_CARR_CAP = 1000;
const PRACTICAL_CLASSES = new Set([WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS, FOOD_CLASS]);
const MAGICAL_CLASSES = new Set([AMULET_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, RING_CLASS, SPBOOK_CLASS]);

function max_mon_load_for_search(mon) {
    const mdat = mon?.type || {};
    const strong = !!(mdat.flags2 & M2_STRONG);
    const cwt = Number(mdat.weight || 0);
    const msize = Number(mdat.size || 0);
    let maxload;
    if (!cwt) {
        maxload = (MAX_CARR_CAP * msize) / MZ_HUMAN;
    } else if (!strong || cwt > WT_HUMAN) {
        maxload = (MAX_CARR_CAP * cwt) / WT_HUMAN;
    } else {
        maxload = MAX_CARR_CAP;
    }
    if (!strong) maxload = Math.floor(maxload / 2);
    return Math.max(1, Math.floor(maxload));
}

function curr_mon_load_for_search(mon) {
    let load = 0;
    const throwsRocks = !!(mon?.type?.flags2 & M2_ROCKTHROW);
    for (const obj of mon?.minvent || []) {
        if (obj?.otyp === BOULDER && throwsRocks) continue;
        load += Number(obj?.owt || 0);
    }
    return load;
}

function mon_would_take_item_search(mon, obj, map) {
    const ptr = mon?.type || {};
    if (!obj) return false;
    if (obj.achievement) return false;
    if (mon?.tame && obj.cursed) return false;

    const maxload = max_mon_load_for_search(mon);
    const pctload = Math.floor((curr_mon_load_for_search(mon) * 100) / maxload);

    const likesGold = !!(ptr.flags2 & M2_GREEDY);
    const likesGems = !!(ptr.flags2 & M2_JEWELS);
    const likesObjs = !!(ptr.flags2 & M2_COLLECT)
        || (Array.isArray(ptr.attacks) && ptr.attacks.some((atk) => atk?.type === AT_WEAP));
    const likesMagic = !!(ptr.flags2 & M2_MAGIC);
    const throwsRocks = !!(ptr.flags2 & M2_ROCKTHROW);

    if (likesGold && obj.otyp === GOLD_PIECE && pctload < 95) return true;
    if (likesGems && obj.oclass === GEM_CLASS
        && (objectData[obj.otyp]?.material !== MINERAL)
        && pctload < 85) return true;
    if (likesObjs && PRACTICAL_CLASSES.has(obj.oclass) && pctload < 75) return true;
    if (likesMagic && MAGICAL_CLASSES.has(obj.oclass) && pctload < 85) return true;
    if (throwsRocks && obj.otyp === BOULDER && pctload < 50 && !map?.flags?.sokoban) return true;
    return false;
}

function playerHasGold(player) {
    return (player?.gold || 0) > 0 || hasGold(player?.inventory);
}

function cansee_for_hider_avoidance(map, player, fov, x, y) {
    if (!player) return false;
    if (player.blind) return false;
    if (fov && typeof fov.canSee === 'function') return !!fov.canSee(x, y);
    return !!couldsee(map, player, x, y);
}

function m_search_items_goal(mon, map, player, fov, ggx, ggy, appr) {
    const omx = mon.mx;
    const omy = mon.my;
    let minr = SQSRCHRADIUS;

    const mux = Number.isInteger(mon.mux) ? mon.mux : ggx;
    const muy = Number.isInteger(mon.muy) ? mon.muy : ggy;
    if (!mon.peaceful && distmin(mux, muy, omx, omy) < SQSRCHRADIUS) {
        minr--;
    }
    if (!mon.peaceful && is_mercenary(mon.type || {})) {
        minr = 1;
    }

    if (pointInShop(omx, omy, map) && (rn2(25) || mon.isshk)) {
        if (minr < SQSRCHRADIUS && appr === -1) {
            if (distmin(omx, omy, mux, muy) <= 3) {
                ggx = mux;
                ggy = muy;
            } else {
                appr = 1;
            }
        }
        return { ggx, ggy, appr, done: false };
    }

    const hmx = Math.min(COLNO - 1, omx + minr);
    const hmy = Math.min(ROWNO - 1, omy + minr);
    const lmx = Math.max(1, omx - minr);
    const lmy = Math.max(0, omy - minr);

    for (let xx = lmx; xx <= hmx; xx++) {
        for (let yy = lmy; yy <= hmy; yy++) {
            const pile = map.objectsAt
                ? map.objectsAt(xx, yy)
                : map.objects.filter((o) => !o.buried && o.ox === xx && o.oy === yy);
            if (!pile || pile.length === 0) continue;
            if (minr < distmin(omx, omy, xx, yy)) continue;
            if (!could_reach_item(map, mon, xx, yy)) continue;
            if (hides_under(mon.type || {}) && cansee_for_hider_avoidance(map, player, fov, xx, yy)) continue;
            const occ = map.monsterAt(xx, yy);
            if (occ && occ !== mon) {
                const occHelpless = !!occ.sleeping
                    || (Number(occ.mfrozen || 0) > 0)
                    || occ.mcanmove === false;
                const occHidden = !!occ.mundetected;
                const occMimicDisguise = !!occ.mappearance && !occ.iswiz;
                const occImmobile = Number(occ.type?.speed || 0) <= 0;
                if (occHelpless || occHidden || occMimicDisguise || occImmobile) continue;
            }
            if (onscary(map, xx, yy)) continue;
            const trap = map.trapAt(xx, yy);
            if (trap && mon_knows_traps(mon, trap.ttyp)) {
                if (ggx === xx && ggy === yy) {
                    ggx = mux;
                    ggy = muy;
                }
                continue;
            }
            if (!m_cansee(mon, map, xx, yy)) continue;
            const costly = pointInShop(xx, yy, map);

            for (const obj of pile) {
                if (obj?.otyp === ROCK) continue;
                if (costly && !obj?.no_charge) continue;
                if (!mon_would_take_item_search(mon, obj, map)) continue;
                if (can_carry(mon, obj) <= 0) continue;

                minr = distmin(omx, omy, xx, yy);
                ggx = xx;
                ggy = yy;
                monmoveTrace('m_search-pick',
                    `id=${mon.m_id ?? '?'}`,
                    `name=${mon.type?.name || mon.name || '?'}`,
                    `obj=(${obj?.otyp ?? '?'},class=${obj?.oclass ?? '?'},quan=${obj?.quan ?? '?'})`,
                    `at=(${xx},${yy})`,
                    `minr=${minr}`,
                    `mux=(${mux},${muy})`,
                    `appr=${appr}`);
                if (ggx === omx && ggy === omy) {
                    return { ggx, ggy, appr, done: true };
                }
                break;
            }
        }
    }

    if (minr < SQSRCHRADIUS && appr === -1) {
        if (distmin(omx, omy, mux, muy) <= 3) {
            ggx = mux;
            ggy = muy;
        } else {
            appr = 1;
        }
    }

    return { ggx, ggy, appr, done: false };
}

// ========================================================================
// dochug — C ref: monmove.c:690
// ========================================================================

function wipeoutEngravingText(text, cnt) {
    if (!text || cnt <= 0) return text || '';
    const chars = text.split('');
    const lth = chars.length;
    while (cnt-- > 0) {
        let nxt;
        do {
            nxt = rn2(lth);
        } while (chars[nxt] === ' ');
        chars[nxt] = ' ';
    }
    return chars.join('');
}

function wipeEngravingAt(map, x, y, cnt) {
    if (!map || !Array.isArray(map.engravings)) return;
    const idx = map.engravings.findIndex((e) => e && e.x === x && e.y === y);
    if (idx < 0) return;
    const engr = map.engravings[idx];
    if (!engr || engr.type === 'headstone' || engr.nowipeout) return;
    let erase = cnt;
    if (engr.type !== 'dust' && engr.type !== 'blood') {
        erase = rn2(1 + Math.floor(50 / (cnt + 1))) ? 0 : 1;
    }
    if (erase > 0) {
        engr.text = wipeoutEngravingText(engr.text || '', erase).replace(/^ +/, '');
        if (!engr.text) map.engravings.splice(idx, 1);
    }
}

function dochug(mon, map, player, display, fov, game = null) {
    if (mon.waiting && map?.flags?.is_tutorial) return;

    if (mon.type && mon.type.symbol === S_MIMIC) {
        return;
    }

    wipeEngravingAt(map, mon.mx, mon.my, 1);

    // Phase 2: Sleep check — C ref: monmove.c disturb()
    function disturb(monster) {
        const canSee = fov && fov.canSee(monster.mx, monster.my);
        if (!canSee) return false;
        if (dist2(monster.mx, monster.my, player.x, player.y) > 100) return false;

        if (player.stealth) {
            const isEttin = monster.type?.name === 'ettin';
            if (!(isEttin && rn2(10))) return false;
        }

        const sym = monster.type?.symbol;
        const isHardSleeper = sym === S_NYMPH
            || monster.type?.name === 'jabberwock'
            || sym === S_LEPRECHAUN;
        if (isHardSleeper && rn2(50)) return false;

        const aggravate = !!player.aggravateMonster;
        const isDogOrHuman = sym === S_DOG || sym === S_HUMAN;
        if (!(aggravate || isDogOrHuman || !rn2(7))) return false;

        return true;
    }

    if (mon.sleeping) {
        if (disturb(mon)) mon.sleeping = false;
        return;
    }

    // INCOMPLETE: C:745 m_respond() — monster spell/gaze/breath attacks not implemented
    // INCOMPLETE: C:759 special monster actions (covetous, quest nemesis) not implemented

    if (mon.confused && !rn2(50)) mon.confused = false;
    if (mon.stunned && !rn2(10)) mon.stunned = false;

    if (mon.flee && !rn2(40) && can_teleport(mon.type || {})
        && !mon.iswiz && !(map.flags && map.flags.noteleport)) {
            for (let tries = 0; tries < 50; tries++) {
                const nx = rnd(COLNO - 1);
                const ny = rn2(ROWNO);
                const loc = map.at(nx, ny);
                if (!loc || !ACCESSIBLE(loc.typ)) continue;
                if (map.monsterAt(nx, ny)) continue;
                if (nx === player.x && ny === player.y) continue;
                mon.mx = nx;
                mon.my = ny;
                return;
            }
            return;
    }

    if (mon.flee && !(mon.fleetim > 0)
        && (mon.mhp ?? 0) >= (mon.mhpmax ?? 0)
        && !rn2(25)) {
        mon.flee = false;
    }

    // C ref: monmove.c:779 — set_apparxy after flee checks
    set_apparxy(mon, map, player);

    // distfleeck: always rn2(5) for every non-sleeping monster
    const braveGremlinRoll = rn2(5);
    monmoveTrace('distfleeck',
        `step=${monmoveStepLabel(map)}`,
        `id=${mon.m_id ?? '?'}`,
        `mndx=${mon.mndx ?? '?'}`,
        `name=${mon.type?.name || mon.name || '?'}`,
        `pos=(${mon.mx},${mon.my})`,
        `roll=${braveGremlinRoll}`);

    const targetX = Number.isInteger(mon.mux) ? mon.mux : player.x;
    const targetY = Number.isInteger(mon.muy) ? mon.muy : player.y;
    const BOLT_LIM_LOCAL = 8;
    const inrange = dist2(mon.mx, mon.my, targetX, targetY) <= (BOLT_LIM_LOCAL * BOLT_LIM_LOCAL);
    const nearby = inrange && monnear(mon, targetX, targetY);
    const isWanderer = !!(mon.type && mon.type.flags2 & M2_WANDER);
    const monCanSee = (mon.mcansee !== false) && !mon.blind;

    let scaredNow = false;
    monmovePhase3Trace(
        `step=${monmoveStepLabel(map)}`,
        `id=${mon.m_id ?? '?'}`,
        `mndx=${mon.mndx ?? '?'}`,
        `name=${mon.type?.name || mon.name || '?'}`,
        `pos=(${mon.mx},${mon.my})`,
        `target=(${targetX},${targetY})`,
        `inrange=${inrange ? 1 : 0}`,
        `nearby=${nearby ? 1 : 0}`,
        `flee=${mon.flee ? 1 : 0}`,
        `conf=${mon.confused ? 1 : 0}`,
        `stun=${mon.stunned ? 1 : 0}`,
        `minvis=${mon.minvis ? 1 : 0}`,
        `wander=${isWanderer ? 1 : 0}`,
        `mcansee=${monCanSee ? 1 : 0}`,
        `peace=${mon.peaceful ? 1 : 0}`,
    );
    // Short-circuit OR matching C's evaluation order
    let phase3Cond = !nearby;
    if (phase3Cond) monmovePhase3Trace(`step=${monmoveStepLabel(map)}`, `id=${mon.m_id ?? '?'}`, 'gate=!nearby');
    if (!phase3Cond) phase3Cond = !!(mon.flee);
    if (phase3Cond && mon.flee) monmovePhase3Trace(`step=${monmoveStepLabel(map)}`, `id=${mon.m_id ?? '?'}`, 'gate=mflee');
    if (!phase3Cond) {
        const seescaryX = monCanSee ? player.x : targetX;
        const seescaryY = monCanSee ? player.y : targetY;
        const sawscary = onscary(map, seescaryX, seescaryY);
        // INCOMPLETE: flees_light (gremlin+artifact) not implemented (C:555)
        // INCOMPLETE: in_your_sanctuary (temple) not implemented (C:564)
        if (nearby && sawscary) {
            phase3Cond = true;
            scaredNow = true;
            applyMonflee(mon, rnd(rn2(7) ? 10 : 100), true);
            monmovePhase3Trace(`step=${monmoveStepLabel(map)}`, `id=${mon.m_id ?? '?'}`, 'gate=scared');
        }
    }
    if (!phase3Cond) phase3Cond = !!(mon.confused);
    if (phase3Cond && mon.confused) monmovePhase3Trace(`step=${monmoveStepLabel(map)}`, `id=${mon.m_id ?? '?'}`, 'gate=confused');
    if (!phase3Cond) phase3Cond = !!(mon.stunned);
    if (phase3Cond && mon.stunned) monmovePhase3Trace(`step=${monmoveStepLabel(map)}`, `id=${mon.m_id ?? '?'}`, 'gate=stunned');
    if (!phase3Cond && mon.minvis) {
        const invisRoll = rn2(3);
        phase3Cond = !invisRoll;
        monmovePhase3Trace(
            `step=${monmoveStepLabel(map)}`,
            `id=${mon.m_id ?? '?'}`,
            `gate=minvis`,
            `roll=rn2(3)=${invisRoll}`,
            `take=${phase3Cond ? 1 : 0}`,
        );
    }
    if (!phase3Cond && mon.mndx === PM_LEPRECHAUN) {
        const playerHasGoldNow = playerHasGold(player);
        const monHasGold = hasGold(mon.minvent);
        if (!playerHasGoldNow && (monHasGold || rn2(2))) phase3Cond = true;
    }
    if (!phase3Cond && isWanderer) {
        const wanderRoll = rn2(4);
        phase3Cond = !wanderRoll;
        monmovePhase3Trace(
            `step=${monmoveStepLabel(map)}`,
            `id=${mon.m_id ?? '?'}`,
            `gate=wander`,
            `roll=rn2(4)=${wanderRoll}`,
            `take=${phase3Cond ? 1 : 0}`,
        );
    }
    // INCOMPLETE: Conflict artifact check not implemented (C:870)
    if (!phase3Cond && !monCanSee) {
        const blindRoll = rn2(4);
        phase3Cond = !blindRoll;
        monmovePhase3Trace(
            `step=${monmoveStepLabel(map)}`,
            `id=${mon.m_id ?? '?'}`,
            `gate=!mcansee`,
            `roll=rn2(4)=${blindRoll}`,
            `take=${phase3Cond ? 1 : 0}`,
        );
    }
    if (!phase3Cond) phase3Cond = !!(mon.peaceful);
    if (phase3Cond && mon.peaceful) monmovePhase3Trace(`step=${monmoveStepLabel(map)}`, `id=${mon.m_id ?? '?'}`, 'gate=peaceful');
    monmovePhase3Trace(`step=${monmoveStepLabel(map)}`, `id=${mon.m_id ?? '?'}`, `phase3Cond=${phase3Cond ? 1 : 0}`);

    // Wield gate before movement
    if (!mon.peaceful
        && inrange
        && dist2(mon.mx, mon.my, targetX, targetY) <= 8
        && hasWeaponAttack(mon)
        && !scaredNow) {
        if (maybeMonsterWieldBeforeAttack(mon, player, display)) {
            return;
        }
    }

    // Phase 3 movement + optional Phase 4 ranged
    let mmoved = false;
    let phase4Allowed = !phase3Cond;
    if (phase3Cond) {
        if (mon.meating) {
            mon.meating--;
        } else if (mon.tame) {
            const omx = mon.mx, omy = mon.my;
            dog_move(mon, map, player, display, fov, false, game);
            if (!mon.dead && (mon.mx !== omx || mon.my !== omy)) {
                const trapResult = mintrap_postmove(mon, map, player);
                if (trapResult === 2 || trapResult === 3) {
                    return;
                }
                mmoved = true;
            }
        } else {
            const omx = mon.mx, omy = mon.my;
            m_move(mon, map, player, display, fov);
            const moveDone = !!mon._mMoveDone;
            let trapDied = false;
            if (!mon.dead && (mon.mx !== omx || mon.my !== omy)) {
                const trapResult = mintrap_postmove(mon, map, player);
                if (trapResult === 2 || trapResult === 3) {
                    trapDied = true;
                } else {
                    mmoved = true;
                }
            }
            if (!trapDied && !mon.dead
                && mon.mcanmove !== false
                && (mmoved || moveDone)
                && map.objectsAt(mon.mx, mon.my).length > 0
                && maybeMonsterPickStuff(mon, map)) {
                mmoved = false;
            } else if (moveDone) {
                mmoved = false;
            }
            if (trapDied) return;
        }
        // distfleeck recalc after m_move
        const postMoveBraveRoll = rn2(5);
        monmoveTrace('distfleeck-postmove',
            `step=${monmoveStepLabel(map)}`,
            `id=${mon.m_id ?? '?'}`,
            `mndx=${mon.mndx ?? '?'}`,
            `name=${mon.type?.name || mon.name || '?'}`,
            `pos=(${mon.mx},${mon.my})`,
            `roll=${postMoveBraveRoll}`);

        if (mmoved && !mon.dead) {
            const targetX2 = Number.isInteger(mon.mux) ? mon.mux : player.x;
            const targetY2 = Number.isInteger(mon.muy) ? mon.muy : player.y;
            const nearby2 = monnear(mon, targetX2, targetY2);
            if (!nearby2 && hasWeaponAttack(mon)) {
                phase4Allowed = true;
            }
        }
    }

    // Phase 4: Standard Attacks
    if (phase4Allowed && !mon.peaceful && !mon.flee && !mon.dead) {
        const targetX2 = Number.isInteger(mon.mux) ? mon.mux : player.x;
        const targetY2 = Number.isInteger(mon.muy) ? mon.muy : player.y;
        const inrange2 = dist2(mon.mx, mon.my, targetX2, targetY2) <= (BOLT_LIM_LOCAL * BOLT_LIM_LOCAL);
        const nearby2 = inrange2 && monnear(mon, targetX2, targetY2);
        if (inrange2) {
            if (nearby2) {
                if (!phase3Cond) {
                    if (maybeMonsterWieldBeforeAttack(mon, player, display)) {
                        return;
                    }
                    monsterAttackPlayer(mon, player, display, game);
                }
            } else if (hasWeaponAttack(mon)) {
                thrwmu(mon, map, player, display, game);
            }
        }
    }
}

// ========================================================================
// m_move — C ref: monmove.c:1716
// ========================================================================

function onlineu(mon, player) {
    const dx = mon.mx - player.x;
    const dy = mon.my - player.y;
    return dx === 0 || dy === 0 || dy === dx || dy === -dx;
}

// C ref: priest.c move_special()
function move_special(mon, map, player, inHisShop, appr, uondoor, avoid, ggx, ggy) {
    const omx = mon.mx;
    const omy = mon.my;
    if (omx === ggx && omy === ggy) return 0;
    if (mon.confused) {
        avoid = false;
        appr = 0;
    }

    let nix = omx;
    let niy = omy;
    const positions = mfndpos(mon, map, player);
    const cnt = positions.length;
    let chcnt = 0;
    if (mon.isshk && avoid && uondoor) {
        let hasOffLine = false;
        for (let i = 0; i < cnt; i++) {
            if (!positions[i].notOnLine) {
                hasOffLine = true;
                break;
            }
        }
        if (!hasOffLine) avoid = false;
    }

    for (let i = 0; i < cnt; i++) {
        const nx = positions[i].x;
        const ny = positions[i].y;
        const loc = map.at(nx, ny);
        if (!loc) continue;
        if (!(IS_ROOM(loc.typ) || (mon.isshk && (!inHisShop || mon.following)))) continue;

        if (avoid && positions[i].notOnLine && !positions[i].allowM) continue;

        const better = dist2(nx, ny, ggx, ggy) < dist2(nix, niy, ggx, ggy);
        if ((!appr && !rn2(++chcnt))
            || (appr && better)
            || positions[i].allowM) {
            nix = nx;
            niy = ny;
        }
    }

    if (mon.ispriest && avoid && nix === omx && niy === omy && onlineu(mon, player)) {
        return move_special(mon, map, player, inHisShop, appr, uondoor, false, ggx, ggy);
    }

    if (nix !== omx || niy !== omy) {
        if (map.monsterAt(nix, niy) || (nix === player.x && niy === player.y)) return 0;
        mon.mx = nix;
        mon.my = niy;
        return 1;
    }
    return 0;
}

function shk_move(mon, map, player) {
    const omx = mon.mx;
    const omy = mon.my;
    const home = mon.shk || { x: omx, y: omy };
    const door = mon.shd || { x: home.x, y: home.y };
    const udist = dist2(omx, omy, player.x, player.y);
    const satdoor = (home.x === omx && home.y === omy);
    let appr = 1;
    let gtx = home.x;
    let gty = home.y;
    let avoid = false;
    let uondoor = (player.x === door.x && player.y === door.y);
    let badinv = false;

    if (udist < 3) {
        if (!mon.peaceful) {
            return 0;
        }
        if (mon.following && udist < 2) {
            return 0;
        }
    }

    if (!mon.peaceful) {
        gtx = player.x;
        gty = player.y;
        avoid = false;
    } else {
        if (player.invis || player.usteed) {
            avoid = false;
        } else {
            if (uondoor) {
                const hasPickaxeInInventory = !!(player.inventory || []).find((o) =>
                    o && (o.otyp === PICK_AXE || o.otyp === DWARVISH_MATTOCK));
                const hasPickaxeOnGround = !!(map.objectsAt?.(player.x, player.y) || []).find((o) =>
                    o && (o.otyp === PICK_AXE || o.otyp === DWARVISH_MATTOCK));
                badinv = hasPickaxeInInventory || hasPickaxeOnGround;
                if (satdoor && badinv) return 0;
                avoid = !badinv;
            } else {
                const inShop = pointInShop(player.x, player.y, map);
                avoid = inShop && dist2(gtx, gty, player.x, player.y) > 8;
                badinv = false;
            }

            const gdist = dist2(omx, omy, gtx, gty);
            if (((!mon.robbed && !mon.billct && !mon.debit) || avoid) && gdist < 3) {
                if (!badinv && !onlineu(mon, player)) return 0;
                if (satdoor) {
                    appr = 0;
                    gtx = 0;
                    gty = 0;
                }
            }
        }
    }

    const inHisShop = monsterInShop(mon, map);
    return move_special(mon, map, player, inHisShop, appr, uondoor, avoid, gtx, gty);
}

// C ref: mon.c mpickstuff() early gates.
function maybeMonsterPickStuff(mon, map) {
    if (mon.isshk && monsterInShop(mon, map)) return false;
    if (!mon.tame && monsterInShop(mon, map) && rn2(25)) return false;

    const pile = (map.objectsAt?.(mon.mx, mon.my) || [])
        .filter((obj) => obj && !obj.buried);
    for (const obj of pile) {
        if (obj.otyp === ROCK) continue;
        if (!mon_would_take_item_search(mon, obj, map)) continue;
        const carryAmt = can_carry(mon, obj);
        if (carryAmt <= 0) continue;

        let picked = obj;
        const quan = Number(obj.quan || 1);
        if (carryAmt < quan) {
            obj.quan = quan - carryAmt;
            obj.owt = weight(obj);
            picked = { ...obj, quan: carryAmt, o_id: next_ident() };
            picked.owt = weight(picked);
        } else {
            map.removeObject(obj);
        }
        addToMonsterInventory(mon, picked);
        return true;
    }
    return false;
}

// INCOMPLETE vs C m_move():
// - No vault guard movement (C:1730)
// - No covetous monster teleport-to-hero (C:1737)
// - No boulder-pushing by strong monsters (C:2020)
// - No door-breaking by strong hostiles (C:2035)
// - No pool/lava avoidance messaging
// - Inventory-based door unlock limited to iswiz only
function m_move(mon, map, player, display = null, fov = null) {
    mon._mMoveDone = false;
    if (mon.isshk) {
        const omx = mon.mx, omy = mon.my;
        shk_move(mon, map, player);
        return mon.mx !== omx || mon.my !== omy;
    }
    if (mon.ispriest) {
        if (mon.epri && mon.epri.shrpos) {
            const omx = mon.mx, omy = mon.my;
            const ggx = mon.epri.shrpos.x + (rn2(3) - 1);
            const ggy = mon.epri.shrpos.y + (rn2(3) - 1);
            move_special(mon, map, player, false, 1, false, true, ggx, ggy);
            return mon.mx !== omx || mon.my !== omy;
        }
    }

    const omx = mon.mx, omy = mon.my;
    const ptr = mon.type || {};
    const verysmall = (ptr.size || 0) === MZ_TINY;
    const can_open = !(nohands(ptr) || verysmall);
    // C ref: monmove.c:1768 — can_unlock = (can_open && monhaskey) || iswiz || is_rider
    const can_unlock = (can_open && monhaskey(mon, true)) || !!mon.iswiz || is_rider(ptr);

    set_apparxy(mon, map, player);

    let ggx = mon.mux ?? player.x, ggy = mon.muy ?? player.y;

    let appr = mon.flee ? -1 : 1;

    const monLoc = map.at(omx, omy);
    const playerLoc = map.at(ggx, ggy);
    const should_see = couldsee(map, player, omx, omy)
        && (playerLoc && playerLoc.lit || !(monLoc && monLoc.lit))
        && (dist2(omx, omy, ggx, ggy) <= 36);

    if (mon.confused) {
        appr = 0;
    }
    if (mon.peaceful) {
        appr = 0;
    }
    if (appr === 1 && leppie_avoidance(mon, player)) {
        appr = -1;
    }

    if (!should_see && !noeyes(mon.type || {})) {
        const cp = gettrack(omx, omy);
        if (cp) {
            ggx = cp.x;
            ggy = cp.y;
        }
    }

    let getitems = false;
    const isRogueLevel = !!(map?.flags?.is_rogue || map?.flags?.roguelike || map?.flags?.is_rogue_lev);
    if ((!mon.peaceful || !rn2(10)) && !isRogueLevel) {
        const heroStr = Number(player?.str) || Number(player?.acurrstr) || 10;
        const inLine = linedUpToPlayer(mon, map, player, fov)
            && (distmin(mon.mx, mon.my, mon.mux ?? player.x, mon.muy ?? player.y)
                <= (Math.floor(heroStr / 2) + 1));
        if (appr !== 1 || !inLine) getitems = true;
    }
    if (getitems) {
        const replayStep = Number.isInteger(map?._replayStepIndex) ? map._replayStepIndex + 1 : '?';
        const apprBeforeSearch = appr;
        const ggxBeforeSearch = ggx;
        const ggyBeforeSearch = ggy;
        const searchState = m_search_items_goal(mon, map, player, fov, ggx, ggy, appr);
        ggx = searchState.ggx;
        ggy = searchState.ggy;
        appr = searchState.appr;
        monmoveTrace('m_move-search',
            `step=${replayStep}`,
            `id=${mon.m_id ?? '?'}`,
            `name=${mon.type?.name || mon.name || '?'}`,
            `mux=(${mon.mux ?? '?'},${mon.muy ?? '?'})`,
            `from=(${ggxBeforeSearch},${ggyBeforeSearch})`,
            `to=(${ggx},${ggy})`,
            `appr=${apprBeforeSearch}->${appr}`);
        if (searchState.done) {
            mon._mMoveDone = true;
            return false;
        }
    }

    const positions = mfndpos(mon, map, player, { allowDoorOpen: can_open, allowDoorUnlock: can_unlock });
    const cnt = positions.length;
    const replayStep = Number.isInteger(map?._replayStepIndex) ? map._replayStepIndex + 1 : '?';
    const posSummary = positions.map((p) => `(${p.x},${p.y})`).join(' ');
    const trackSummary = Array.isArray(mon.mtrack)
        ? mon.mtrack.map((t) => `(${t?.x ?? '?'},${t?.y ?? '?'})`).join(' ')
        : 'none';
    monmoveTrace('m_move-begin',
        `step=${monmoveStepLabel(map)}`,
        `id=${mon.m_id ?? '?'}`,
        `mndx=${mon.mndx ?? '?'}`,
        `name=${mon.type?.name || mon.name || '?'}`,
        `pos=(${omx},${omy})`,
        `target=(${ggx},${ggy})`,
        `mux=(${mon.mux ?? '?'},${mon.muy ?? '?'})`,
        `mcansee=${mon.mcansee === false ? 0 : 1}`,
        `blind=${mon.blind ? 1 : 0}`,
        `shouldSee=${should_see ? 1 : 0}`,
        `shortsighted=${map?.flags?.shortsighted ? 1 : 0}`,
        `appr=${appr}`,
        `cnt=${cnt}`,
        `poss=${posSummary}`,
        `track=${trackSummary}`);
    const tryUnicornFallbackTeleport = () => {
        const isUnicorn = mon.mndx === PM_WHITE_UNICORN
            || mon.mndx === PM_GRAY_UNICORN
            || mon.mndx === PM_BLACK_UNICORN;
        if (!isUnicorn || rn2(2) || (map.flags && map.flags.noteleport)) return false;
        for (let tries = 0; tries < 200; tries++) {
            const nx = rnd(COLNO - 1);
            const ny = rn2(ROWNO);
            const loc = map.at(nx, ny);
            if (!loc || !ACCESSIBLE(loc.typ)) continue;
            if (map.monsterAt(nx, ny)) continue;
            if (nx === player.x && ny === player.y) continue;
            mon.mx = nx;
            mon.my = ny;
            return true;
        }
        return false;
    };
    if (cnt === 0) return tryUnicornFallbackTeleport();

    let nix = omx, niy = omy;
    let nidist = dist2(omx, omy, ggx, ggy);
    let chcnt = 0;
    let chosenIdx = -1;
    let mmoved = false;
    const jcnt = Math.min(MTSZ, cnt - 1);
    if (!mon.peaceful
        && map?.flags?.shortsighted
        && nidist > (couldsee(map, player, nix, niy) ? 144 : 36)
        && appr === 1) {
        appr = 0;
    }
    const betterWithDisplacing = false;

    for (let i = 0; i < cnt; i++) {
        const nx = positions[i].x;
        const ny = positions[i].y;

        if (m_avoid_kicked_loc(mon, nx, ny, player)) continue;

        if (positions[i].allowMDisp && !positions[i].allowM && !betterWithDisplacing) continue;

        if (appr !== 0 && mon.mtrack) {
            let skipThis = false;
            for (let j = 0; j < jcnt; j++) {
                if (nx === mon.mtrack[j].x && ny === mon.mtrack[j].y) {
                    const denom = 4 * (cnt - j);
                    const trackRoll = rn2(denom);
                    monmoveTrace('m_move-track',
                        `step=${monmoveStepLabel(map)}`,
                        `id=${mon.m_id ?? '?'}`,
                        `mndx=${mon.mndx ?? '?'}`,
                        `name=${mon.type?.name || mon.name || '?'}`,
                        `pos=(${omx},${omy})`,
                        `cand=(${nx},${ny})`,
                        `j=${j}`,
                        `denom=${denom}`,
                        `roll=${trackRoll}`);
                    if (trackRoll) {
                        skipThis = true;
                        break;
                    }
                }
            }
            if (skipThis) continue;
        }

        const ndist = dist2(nx, ny, ggx, ggy);
        const nearer = ndist < nidist;

        if ((appr === 1 && nearer)
            || (appr === -1 && !nearer)
            || (appr === 0 && !rn2(++chcnt))
            || !mmoved) {
            nix = nx;
            niy = ny;
            nidist = ndist;
            chosenIdx = i;
            mmoved = true;
        }
    }
    if (!mmoved && tryUnicornFallbackTeleport()) return true;

    if (mmoved && chosenIdx >= 0) {
        const chosen = positions[chosenIdx];
        const attacksMonster = !!chosen.allowM
            || (nix === (mon.mux ?? -1) && niy === (mon.muy ?? -1));
        if (attacksMonster && m_move_aggress(mon, map, player, nix, niy, display, fov)) {
            mon._mMoveDone = true;
            return false;
        }
    }

    if (nix !== omx || niy !== omy) {
        // C ref: monmove.c:2065 — mon_track_add(mtmp, omx, omy)
        mon_track_add(mon, omx, omy);
        mon.mx = nix;
        mon.my = niy;

        const here = map.at(mon.mx, mon.my);
        if (here && IS_DOOR(here.typ)) {
            const wasLocked = !!(here.flags & D_LOCKED);
            const wasClosed = !!(here.flags & D_CLOSED);
            if ((wasLocked && can_unlock) || (wasClosed && can_open)) {
                here.flags &= ~(D_LOCKED | D_CLOSED);
                here.flags |= D_ISOPEN;
                if (display) {
                    const canSeeDoor = fov?.canSee ? fov.canSee(mon.mx, mon.my) : couldsee(map, player, mon.mx, mon.my);
                    if (canSeeDoor && mon.name) {
                        display.putstr_message(`${monNam(mon, { article: 'the', capitalize: true })} opens a door.`);
                    } else {
                        display.putstr_message('You hear a door open.');
                    }
                }
            }
        }
        return true;
    }
    return false;
}

// ========================================================================
// m_move_aggress — C ref: monmove.c:2090
// ========================================================================
// INCOMPLETE vs C m_move_aggress():
// - Only first attack type used (C uses full mattackm multi-attack loop)
// - No special attack handling (engulf, gaze, breath, etc.)
// - No experience/corpse drop for killed defenders
// - Retaliation simplified (single attack, no multi-round)
function m_move_aggress(mon, map, player, nx, ny, display = null, fov = null) {
    const target = map.monsterAt(nx, ny);
    if (!target || target === mon || target.dead) return false;

    if (target.sleeping) {
        target.sleeping = false;
        target.msleeping = false;
    }

    const attackerVisible = canSpotMonsterForMap(mon, map, player, fov);
    const defenderVisible = canSpotMonsterForMap(target, map, player, fov);
    const replayStep = Number.isInteger(map?._replayStepIndex) ? map._replayStepIndex + 1 : '?';
    monmoveTrace('m_move_aggress',
        `step=${replayStep}`,
        `attacker=${mon.m_id ?? '?'}(${mon.type?.name || mon.name || '?'})`,
        `defender=${target.m_id ?? '?'}(${target.type?.name || target.name || '?'})`,
        `at=(${mon.mx},${mon.my})->(${target.mx},${target.my})`,
        `vis=${attackerVisible || defenderVisible ? 1 : 0}`);
    if (!attackerVisible && !defenderVisible && !player?.deaf) {
        if (display?.putstr_message && !map?._heardDistantNoiseThisTurn) {
            display.putstr_message('You hear some noises in the distance.');
        }
        if (map) map._heardDistantNoiseThisTurn = true;
    }

    const turnCount = (player.turns || 0) + 1;

    const attk = (Array.isArray(mon.attacks) && mon.attacks.length > 0)
        ? (mon.attacks.find((a) => a && a.type !== AT_NONE) || { type: AT_CLAW, dice: 1, sides: 1 })
        : { type: AT_CLAW, dice: 1, sides: 1 };

    const roll = rnd(20);
    const toHit = (target.mac ?? 10) + (mon.mlevel || 1);
    const hit = toHit > roll;
    let defenderDied = false;
    if (hit) {
        const dice = (attk && attk.dice) ? attk.dice : 1;
        const sides = (attk && attk.sides) ? attk.sides : 1;
        const dmg = c_d(Math.max(1, dice), Math.max(1, sides));
        rn2(3);
        rn2(6);
        target.mhp -= Math.max(1, dmg);
        if (target.mhp <= 0) {
            target.dead = true;
            if (typeof map.removeMonster === 'function') map.removeMonster(target);
            defenderDied = true;
        }
        consumePassivemmRng(mon, target, true, defenderDied);
    } else {
        consumePassivemmRng(mon, target, false, false);
    }

    const retaliationRoll = (hit && !defenderDied) ? rn2(4) : 0;
    const targetMove = Number(target.movement || 0);
    const retaliationSpeedRoll = (hit && !defenderDied && retaliationRoll)
        ? rn2(NORMAL_SPEED)
        : 0;
    monmoveTrace('m_move_aggress-retal-gate',
        `step=${replayStep}`,
        `attacker=${mon.m_id ?? '?'}`,
        `defender=${target.m_id ?? '?'}`,
        `hit=${hit ? 1 : 0}`,
        `defenderDied=${defenderDied ? 1 : 0}`,
        `retRoll=${retaliationRoll}`,
        `targetMove=${targetMove}`,
        `speedRoll=${retaliationSpeedRoll}`);
    if (hit && !defenderDied
        && retaliationRoll
        && targetMove > retaliationSpeedRoll) {
        monmoveTrace('m_move_aggress-retal',
            `step=${replayStep}`,
            `attacker=${mon.m_id ?? '?'}`,
            `defender=${target.m_id ?? '?'}`,
            `targetMove=${targetMove}`,
            `turnCount=${turnCount}`);
        if (targetMove > NORMAL_SPEED) target.movement = targetMove - NORMAL_SPEED;
        else target.movement = 0;
        const rattk = (Array.isArray(target.attacks) && target.attacks.length > 0)
            ? (target.attacks.find((a) => a && a.type !== AT_NONE) || { type: AT_CLAW, dice: 1, sides: 1 })
            : { type: AT_CLAW, dice: 1, sides: 1 };
        const rroll = rnd(20);
        const rtoHit = (mon.mac ?? 10) + (target.mlevel || 1);
        const rhit = rtoHit > rroll;
        if (rhit) {
            const rdice = (rattk && rattk.dice) ? rattk.dice : 1;
            const rsides = (rattk && rattk.sides) ? rattk.sides : 1;
            const rdmg = c_d(Math.max(1, rdice), Math.max(1, rsides));
            rn2(3);
            rn2(6);
            mon.mhp -= Math.max(1, rdmg);
            const attackerDied = mon.mhp <= 0;
            if (attackerDied) mon.dead = true;
            consumePassivemmRng(target, mon, true, attackerDied);
        } else {
            consumePassivemmRng(target, mon, false, false);
        }
    }

    return true;
}

// ========================================================================
// set_apparxy — C ref: monmove.c:2200
// ========================================================================
function set_apparxy(mon, map, player) {
    let mx = Number.isInteger(mon.mux) ? mon.mux : 0;
    let my = Number.isInteger(mon.muy) ? mon.muy : 0;

    if (mon.tame || (mx === player.x && my === player.y)) {
        mon.mux = player.x;
        mon.muy = player.y;
        return;
    }

    const mdat = mons[mon.mndx] || mon.type || {};
    const monCanSee = mon.mcansee !== false;
    const notseen = (!monCanSee || (player.invisible && !perceives(mdat)));
    const playerDisplaced = !!(player.cloak && player.cloak.otyp === CLOAK_OF_DISPLACEMENT);
    const notthere = playerDisplaced && mon.mndx !== PM_DISPLACER_BEAST;
    let displ;
    if (notseen) {
        displ = 1;
    } else if (notthere) {
        displ = couldsee(map, player, mx, my) ? 2 : 1;
    } else {
        displ = 0;
    }

    if (!displ) {
        mon.mux = player.x;
        mon.muy = player.y;
        return;
    }

    const gotu = notseen ? !rn2(3) : (notthere ? !rn2(4) : false);

    if (!gotu) {
        let tryCnt = 0;
        do {
            if (++tryCnt > 200) {
                mx = player.x;
                my = player.y;
                break;
            }
            mx = player.x - displ + rn2(2 * displ + 1);
            my = player.y - displ + rn2(2 * displ + 1);
            const loc = map.at(mx, my);
            const closedDoor = !!loc && IS_DOOR(loc.typ) && (loc.flags & (D_CLOSED | D_LOCKED));
            const blocked = !loc || !(ACCESSIBLE(loc.typ) && !closedDoor);
            if (!isok(mx, my)) continue;
            if (displ !== 2 && mx === mon.mx && my === mon.my) continue;
            if ((mx !== player.x || my !== player.y) && blocked) continue;
            if (!couldsee(map, player, mx, my)) continue;
            break;
        } while (true);
    } else {
        mx = player.x;
        my = player.y;
    }

    mon.mux = mx;
    mon.muy = my;
}
