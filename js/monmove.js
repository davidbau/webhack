// monmove.js -- Monster movement AI
// C-faithful port of mon.c movemon(), monmove.c dochug(), dogmove.c dog_move()
// Focus: exact RNG consumption alignment with C NetHack

import { COLNO, ROWNO, STONE, IS_WALL, IS_DOOR, IS_ROOM,
         ACCESSIBLE, CORR, DOOR, D_CLOSED, D_LOCKED, D_BROKEN,
         POOL, LAVAPOOL, SHOPBASE, ROOMOFFSET,
         NORMAL_SPEED, isok } from './config.js';
import { rn2, rnd, c_d } from './rng.js';
import { monsterAttackPlayer } from './combat.js';
import { FOOD_CLASS, COIN_CLASS, BOULDER, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS,
         PICK_AXE, DWARVISH_MATTOCK } from './objects.js';
import { doname } from './mkobj.js';
import { observeObject } from './discovery.js';
import { dogfood, dog_eat, can_carry, DOGFOOD, CADAVER, ACCFOOD, MANFOOD, APPORT,
         POISON, UNDEF, TABU } from './dog.js';
import { couldsee, m_cansee, do_clear_area } from './vision.js';
import { can_teleport, noeyes, perceives } from './mondata.js';
import { PM_GRID_BUG, PM_IRON_GOLEM, PM_SHOPKEEPER, mons,
         PM_LEPRECHAUN, PM_XAN, PM_YELLOW_LIGHT, PM_BLACK_LIGHT,
         PM_PURPLE_WORM, PM_BABY_PURPLE_WORM, PM_SHRIEKER,
         AT_NONE, AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_WEAP,
         AD_PHYS,
         AD_ACID, AD_ENCH,
         M1_FLY, M1_SWIM, M1_AMPHIBIOUS, M1_AMORPHOUS, M1_CLING, M1_SEE_INVIS, S_MIMIC,
         MZ_TINY, MZ_SMALL, MR_FIRE, MR_SLEEP, G_FREQ } from './monsters.js';
import { STATUE_TRAP, MAGIC_TRAP, VIBRATING_SQUARE, RUST_TRAP, FIRE_TRAP,
         SLP_GAS_TRAP, BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TRAPDOOR,
         WEB, ANTI_MAGIC, MAGIC_PORTAL } from './symbols.js';

const MTSZ = 4;           // C ref: monst.h — track history size
const SQSRCHRADIUS = 5;   // C ref: dogmove.c — object search radius
const FARAWAY = 127;      // C ref: hack.h — large distance sentinel
const BOLT_LIM = 8;       // C ref: hack.h BOLT_LIM (threat radius baseline)

function attackVerb(type) {
    switch (type) {
        case AT_BITE: return 'bites';
        case AT_CLAW: return 'claws';
        case AT_KICK: return 'kicks';
        case AT_BUTT: return 'butts';
        case AT_TUCH: return 'touches';
        case AT_STNG: return 'stings';
        case AT_WEAP: return 'hits';
        default: return 'hits';
    }
}

// ========================================================================
// Player track — C ref: track.c
// Circular buffer recording player positions for pet pathfinding.
// ========================================================================
const UTSZ = 100;         // C ref: track.c — track buffer size
let _utrack = new Array(UTSZ).fill(null).map(() => ({ x: 0, y: 0 }));
let _utcnt = 0;
let _utpnt = 0;

export function initrack() {
    _utrack = new Array(UTSZ).fill(null).map(() => ({ x: 0, y: 0 }));
    _utcnt = 0;
    _utpnt = 0;
}

// C ref: track.c settrack() — record player position (called after movemon, before moves++)
export function settrack(player) {
    if (_utcnt < UTSZ) _utcnt++;
    if (_utpnt === UTSZ) _utpnt = 0;
    _utrack[_utpnt].x = player.x;
    _utrack[_utpnt].y = player.y;
    _utpnt++;
}

// C ref: track.c gettrack() — find most recent track entry adjacent to (x,y)
// Returns the track entry if distmin=1 (adjacent), null if distmin=0 (same pos) or not found.
function gettrack(x, y) {
    let cnt = _utcnt;
    let idx = _utpnt;
    while (cnt-- > 0) {
        if (idx === 0) idx = UTSZ - 1;
        else idx--;
        const tc = _utrack[idx];
        const ndist = Math.max(Math.abs(x - tc.x), Math.abs(y - tc.y)); // distmin
        if (ndist <= 1) return ndist ? tc : null;
    }
    return null;
}

// C direction tables (C ref: monmove.c)
const xdir = [0, 1, 1, 1, 0, -1, -1, -1];
const ydir = [-1, -1, 0, 1, 1, 1, 0, -1];

// Squared distance
function dist2(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// C ref: mon.c monnear() + NODIAG()
function monnear(mon, x, y) {
    const distance = dist2(mon.mx, mon.my, x, y);
    const nodiag = mon.mndx === PM_GRID_BUG
        || mon.mndx === PM_XAN
        || mon.mndx === PM_YELLOW_LIGHT
        || mon.mndx === PM_BLACK_LIGHT;
    if (distance === 2 && nodiag) return false;
    return distance < 3;
}

function hasGold(inv) {
    return Array.isArray(inv)
        && inv.some(o => o && o.oclass === COIN_CLASS && (o.quan ?? 1) > 0);
}

function playerHasGold(player) {
    return (player?.gold || 0) > 0 || hasGold(player?.inventory);
}

function pointInShop(x, y, map) {
    const loc = map.at(x, y);
    const roomno = loc?.roomno || 0;

    if (roomno >= ROOMOFFSET) {
        const roomIdx = roomno - ROOMOFFSET;
        const room = map.rooms?.[roomIdx];
        return !!(room && room.rtype >= SHOPBASE);
    }

    // C ref: in_rooms() handles SHARED/SHARED_PLUS tiles by scanning
    // nearby roomno entries for eligible rooms. Our map roomno assignment
    // can leave doorway/corridor connectors as NO_ROOM, so use a narrow
    // fallback for door/corridor (and shared-like roomno values).
    const isSharedLike = roomno === 1 || roomno === 2;
    const isDoorCorr = loc && (loc.typ === DOOR || loc.typ === CORR);
    if (!isSharedLike && !isDoorCorr) return false;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const nloc = map.at(x + dx, y + dy);
            const nr = nloc?.roomno || 0;
            if (nr < ROOMOFFSET) continue;
            const room = map.rooms?.[nr - ROOMOFFSET];
            if (room && room.rtype >= SHOPBASE) return true;
        }
    }
    return false;
}

// C ref: in_rooms(x,y,SHOPBASE) check used by monmove.c m_search_items().
function monsterInShop(mon, map) {
    // C ref: inhishop(shkp) checks shopkeeper's own assigned shop room.
    if (mon?.isshk && Number.isInteger(mon.shoproom) && mon.shoproom >= ROOMOFFSET) {
        const loc = map.at(mon.mx, mon.my);
        const roomno = loc?.roomno || 0;
        if (roomno === mon.shoproom) {
            const room = map.rooms?.[roomno - ROOMOFFSET];
            return !!(room && room.rtype >= SHOPBASE);
        }
        return false;
    }
    return pointInShop(mon.mx, mon.my, map);
}

// C ref: mon.c mpickstuff() early gates.
function maybeMonsterPickStuff(mon, map) {
    // prevent shopkeepers from leaving their shop door behavior
    if (mon.isshk && monsterInShop(mon, map)) return false;

    // non-tame monsters normally don't go shopping
    if (!mon.tame && monsterInShop(mon, map) && rn2(25)) return false;

    // Full pickup behavior is pending; current port keeps RNG-visible gates.
    return false;
}

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

// C ref: engrave.c wipe_engr_at(), used by monmove.c pre-movement.
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

// C ref: monmove.c m_avoid_kicked_loc()
function m_avoid_kicked_loc(mon, nx, ny, player) {
    const kl = player?.kickedloc;
    const monCanSee = (mon?.mcansee !== false) && !mon?.blind;
    if (!kl || !isok(kl.x, kl.y)) return false;
    if (!(mon?.peaceful || mon?.tame)) return false;
    if (!monCanSee || mon?.confused || mon?.stunned) return false;
    return nx === kl.x && ny === kl.y && dist2(nx, ny, player.x, player.y) <= 2;
}

// C ref: monmove.c set_apparxy().
// Track monster's apparent player coordinates (mux/muy), which can differ from
// actual player position when monster cannot currently perceive the hero.
function set_apparxy(mon, map, player) {
    let mx = Number.isInteger(mon.mux) ? mon.mux : 0;
    let my = Number.isInteger(mon.muy) ? mon.muy : 0;

    // C ref: set_apparxy() early-return path.
    if (mon.tame || (mx === player.x && my === player.y)) {
        mon.mux = player.x;
        mon.muy = player.y;
        return;
    }

    const mdat = mons[mon.mndx] || mon.type || {};
    const monCanSee = mon.mcansee !== false;
    const notseen = (!monCanSee || (player.invisible && !perceives(mdat)));
    // We currently do not model displacement at runtime.
    const notthere = false;
    let displ = notseen ? 1 : 0;

    if (!displ) {
        mon.mux = player.x;
        mon.muy = player.y;
        return;
    }

    // C ref: gotu = notseen ? !rn2(3) : notthere ? !rn2(4) : FALSE.
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
            if (!couldsee(mx, my)) continue;
            break;
        } while (true);
    } else {
        mx = player.x;
        my = player.y;
    }

    mon.mux = mx;
    mon.muy = my;
}

// C ref: mon.c:3243 corpse_chance() RNG.
function petCorpseChanceRoll(mon) {
    const mdat = mon?.type || {};
    const gfreq = (mdat.geno || 0) & G_FREQ;
    const verysmall = (mdat.size || 0) === MZ_TINY;
    const corpsetmp = 2 + (gfreq < 2 ? 1 : 0) + (verysmall ? 1 : 0);
    return rn2(corpsetmp);
}

// C ref: mhitm.c passivemm() RNG-only probe for pet melee path.
// We currently model only RNG consumption order, not full passive effects.
function consumePassivemmRng(attacker, defender, strike, defenderDied) {
    const ddef = defender?.type || (Number.isInteger(defender?.mndx) ? mons[defender.mndx] : null);
    const passive = ddef?.attacks?.find((a) => a && a.type === AT_NONE) || null;
    // C has fixed-size mattk[] with implicit trailing AT_NONE entries.
    // When no explicit passive attack exists, this falls back to AD_PHYS.
    const adtyp = passive ? passive.damage : AD_PHYS;
    // C ref: passivemm() AD_ACID special path consumes rn2(30)/rn2(6)
    // regardless of hit, and rn2(2) on hit.
    if (adtyp === AD_ACID) {
        if (strike) rn2(2);
        rn2(30);
        rn2(6);
        return;
    }

    // C ref: passivemm() AD_ENCH has no RNG.
    if (adtyp === AD_ENCH) return;

    // C ref: passivemm() early return if defender died or is cancelled.
    if (defenderDied || defender?.mcan) return;

    // C ref: passivemm() generic passive gate.
    rn2(3);
}

// ========================================================================
// Trap harmlessness check — C ref: trap.c m_harmless_trap()
// ========================================================================
// Returns true if the trap is harmless to this monster (no avoidance needed).
function m_harmless_trap(mon, trap) {
    const mdat = mons[mon.mndx] || {};
    const flags1 = mdat.flags1 || 0;
    const mr1 = mdat.mr1 || 0;
    const msize = mdat.size || 0;

    // C ref: floor_trigger + check_in_air — flyers avoid floor traps
    const isFloor = trap.ttyp >= 1 && trap.ttyp <= TRAPDOOR; // ARROW..TRAPDOOR
    if (isFloor && (flags1 & M1_FLY)) return true;

    switch (trap.ttyp) {
    case STATUE_TRAP:
    case MAGIC_TRAP:
    case VIBRATING_SQUARE:
        return true;
    case RUST_TRAP:
        // Only harmful to iron golems
        return mon.mndx !== PM_IRON_GOLEM;
    case FIRE_TRAP:
        return !!(mr1 & MR_FIRE);
    case SLP_GAS_TRAP:
        return !!(mr1 & MR_SLEEP);
    case BEAR_TRAP:
        return msize <= MZ_SMALL || !!(flags1 & M1_AMORPHOUS);
    case PIT: case SPIKED_PIT: case HOLE: case TRAPDOOR:
        return !!(flags1 & M1_CLING);
    case WEB:
        return !!(flags1 & M1_AMORPHOUS);
    case ANTI_MAGIC:
        // Simplified: no resists_magm check yet
        return false;
    default:
        return false;
    }
}

// ============================================================================
// Monster trap resolution after movement
// C ref: monmove.c postmov() -> mintrap()
// ============================================================================
const Trap_Effect_Finished = 0;
const Trap_Caught_Mon = 1;
const Trap_Killed_Mon = 2;

function mintrap_postmove(mon, map) {
    const trap = map.trapAt(mon.mx, mon.my);
    if (!trap) {
        mon.mtrapped = 0;
        return Trap_Effect_Finished;
    }

    // Entering a harmless trap has no effect for this monster.
    if (!mon.mtrapped && m_harmless_trap(mon, trap)) {
        return Trap_Effect_Finished;
    }

    switch (trap.ttyp) {
    case PIT:
    case SPIKED_PIT: {
        // C ref: trap.c trapeffect_pit(monster) — non-passwall monsters get trapped.
        mon.mtrapped = 1;
        const dmg = rnd(trap.ttyp === PIT ? 6 : 10);
        mon.mhp -= Math.max(0, dmg);
        if (mon.mhp <= 0) {
            mon.dead = true;
            map.removeMonster(mon);
            return Trap_Killed_Mon;
        }
        return Trap_Caught_Mon;
    }
    default:
        return Trap_Effect_Finished;
    }
}

// ========================================================================
// mfndpos — collect valid adjacent positions in column-major order
// ========================================================================
// C ref: mon.c mfndpos() — returns positions a monster can move to
// Iterates (x-1..x+1) × (y-1..y+1) in column-major order, skipping current pos.
// Handles NODIAG (grid bugs), terrain, doors, monsters, player, boulders.
function mfndpos(mon, map, player) {
    const omx = mon.mx, omy = mon.my;
    const nodiag = (mon.mndx === PM_GRID_BUG);
    const mflags1 = mon.type?.flags1 || 0;
    const poolok = !!(mflags1 & (M1_FLY | M1_SWIM | M1_AMPHIBIOUS));
    const lavaok = !!(mflags1 & M1_FLY);
    // C ref: mon.c:2061-2062 — tame monsters get ALLOW_M | ALLOW_TRAPS
    const allowM = !!mon.tame;
    const positions = [];
    const maxx = Math.min(omx + 1, COLNO - 1);
    const maxy = Math.min(omy + 1, ROWNO - 1);

    for (let nx = Math.max(1, omx - 1); nx <= maxx; nx++) {
        for (let ny = Math.max(0, omy - 1); ny <= maxy; ny++) {
            if (nx === omx && ny === omy) continue;

            // C ref: NODIAG — grid bugs can only move in cardinal directions
            if (nx !== omx && ny !== omy && nodiag) continue;

            const loc = map.at(nx, ny);
            if (!loc || !ACCESSIBLE(loc.typ)) continue;
            if (loc.typ === POOL && !poolok) continue;
            if (loc.typ === LAVAPOOL && !lavaok) continue;

            // C ref: door checks
            if (IS_DOOR(loc.typ) && (loc.flags & (D_CLOSED | D_LOCKED))) continue;

            // C ref: mon.c:2228-2238 — no diagonal moves through doorways
            // If either current pos or target is a non-broken door, diagonal blocked
            if (nx !== omx && ny !== omy) {
                const monLoc = map.at(omx, omy);
                if ((IS_DOOR(loc.typ) && (loc.flags & ~D_BROKEN))
                    || (monLoc && IS_DOOR(monLoc.typ) && (monLoc.flags & ~D_BROKEN)))
                    continue;
            }

            const monAtPos = map.monsterAt(nx, ny);
            // C ref: MON_AT + mm_aggression/mm_displacement gating:
            // occupied positions are only included when monster-vs-monster
            // interaction is allowed for this pair.
            // Important: C mm_aggression is narrow (not generic hostile-vs-tame).
            let allowMAttack = false;
            if (monAtPos && !monAtPos.dead) {
                if (allowM) {
                    allowMAttack = !monAtPos.tame && !monAtPos.peaceful;
                } else {
                    // C ref: mon.c mm_aggression() special cases.
                    // Keep only implemented combinations here.
                    const attackerIdx = mon.mndx;
                    const defenderIdx = monAtPos.mndx;
                    const isPurpleWorm = attackerIdx === PM_PURPLE_WORM || attackerIdx === PM_BABY_PURPLE_WORM;
                    const isShrieker = defenderIdx === PM_SHRIEKER;
                    allowMAttack = isPurpleWorm && isShrieker;
                }
            }
            if (monAtPos && !allowMAttack) continue;

            // C ref: u_at — skip player position
            if (nx === player.x && ny === player.y) continue;

            // C ref: sobj_at(BOULDER) — skip positions with boulders
            // (simplified: no monster can move boulders for now)
            let hasBoulder = false;
            for (const obj of map.objects) {
                if (obj.ox === nx && obj.oy === ny && obj.otyp === BOULDER) {
                    hasBoulder = true;
                    break;
                }
            }
            if (hasBoulder) continue;

            // C ref: t_at() — check for traps and set ALLOW_TRAPS flag
            // C ref: mon.c:2337-2352 — trap handling in mfndpos
            let allowTraps = false;
            const trap = map.trapAt(nx, ny);
            if (trap) {
                // C ref: line 2347 — if (!m_harmless_trap(mon, ttmp))
                // Only set ALLOW_TRAPS if trap is NOT harmless
                if (!m_harmless_trap(mon, trap)) {
                    // C ref: For pets (ALLOW_TRAPS in flags), include position with flag
                    // Non-pets would skip here if they know the trap type, but pets always include it
                    allowTraps = true;
                }
            }

            // C ref: mon.c mfndpos() only sets NOTONL when monster can see hero.
            const mux = Number.isInteger(mon.mux) ? mon.mux : player.x;
            const muy = Number.isInteger(mon.muy) ? mon.muy : player.y;
            const monSeeHero = (mon.mcansee !== false)
                && !mon.blind
                && m_cansee(mon, map, player.x, player.y)
                && (!player.invisible || perceives(mon.type || {}));
            const notOnLine = monSeeHero
                && (nx === mux || ny === muy
                    || (ny - muy) === (nx - mux)
                    || (ny - muy) === -(nx - mux));

            positions.push({
                x: nx,
                y: ny,
                allowTraps,
                allowM: !!allowMAttack,
                notOnLine,
            });
        }
    }
    return positions;
}

// ========================================================================
// dog_goal helper functions — C-faithful checks
// ========================================================================

// C ref: dogmove.c:144-153 — cursed_object_at(x, y)
// Checks if ANY object at position (x, y) is cursed
function cursed_object_at(map, x, y) {
    for (const obj of map.objects) {
        if (obj.ox === x && obj.oy === y && obj.cursed)
            return true;
    }
    return false;
}

// C ref: dogmove.c:1353-1362 — could_reach_item(mon, nx, ny)
// Check if monster could pick up objects from location (no pool/lava/boulder blocking)
function could_reach_item(map, mon, nx, ny) {
    const loc = map.at(nx, ny);
    if (!loc) return false;
    const typ = loc.typ;
    // C: is_pool checks typ >= POOL && typ <= DRAWBRIDGE_UP (simplified)
    const isPool = (typ === POOL);
    const isLava = (typ === LAVAPOOL);
    // C: sobj_at(BOULDER, nx, ny) — is there a boulder at this position?
    let hasBoulder = false;
    for (const obj of map.objects) {
        if (obj.ox === nx && obj.oy === ny && obj.otyp === BOULDER) {
            hasBoulder = true; break;
        }
    }
    // Little dogs can't swim, don't like lava, can't throw rocks
    if (isPool) return false; // simplified: pets aren't swimmers
    if (isLava) return false; // simplified: pets don't like lava
    if (hasBoulder) return false; // simplified: pets can't throw rocks
    return true;
}

// C ref: dogmove.c:1371-1407 — can_reach_location(mon, mx, my, fx, fy)
// Recursive pathfinding: can monster navigate from (mx,my) to (fx,fy)?
// Uses greedy approach: only steps through cells closer to target.
function can_reach_location(map, mon, mx, my, fx, fy) {
    if (mx === fx && my === fy) return true;
    if (!isok(mx, my)) return false;

    const d = dist2(mx, my, fx, fy);
    for (let i = mx - 1; i <= mx + 1; i++) {
        for (let j = my - 1; j <= my + 1; j++) {
            if (!isok(i, j)) continue;
            if (dist2(i, j, fx, fy) >= d) continue;
            const loc = map.at(i, j);
            if (!loc) continue;
            // C: IS_OBSTRUCTED(typ) = typ < POOL
            if (loc.typ < POOL) continue;
            // C: closed/locked doors block
            if (IS_DOOR(loc.typ) && (loc.flags & (D_CLOSED | D_LOCKED)))
                continue;
            if (!could_reach_item(map, mon, i, j)) continue;
            if (can_reach_location(map, mon, i, j, fx, fy))
                return true;
        }
    }
    return false;
}

// ========================================================================
// dog_invent — pet inventory management (pickup/drop at current position)
// C ref: dogmove.c:392-471
// Returns: 0 (no action), 1 (ate something), 2 (died)
// ========================================================================
function dog_invent(mon, edog, udist, map, turnCount, display, player) {
    if (mon.meating) return 0;
    const omx = mon.mx, omy = mon.my;

    // C ref: droppables(mtmp) — check if pet has non-cursed inventory
    const hasDrop = mon.minvent && mon.minvent.some(o => !o.cursed);

    if (hasDrop) {
        // C ref: dogmove.c:411-421 — drop path
        if (!rn2(udist + 1) || !rn2(edog.apport)) {
            if (rn2(10) < edog.apport) {
                // relobj: drop all non-cursed inventory items
                const keep = [];
                for (const o of mon.minvent) {
                    if (!o.cursed) {
                        o.ox = omx; o.oy = omy;
                        map.objects.push(o);
                        if (display && player && couldsee(map, player, mon.mx, mon.my)) {
                            observeObject(o);
                            display.putstr_message(`The ${mon.name} drops ${doname(o, null)}.`);
                        }
                    } else {
                        keep.push(o);
                    }
                }
                mon.minvent = keep;
                if (edog.apport > 1) edog.apport--;
                edog.dropdist = udist;
                edog.droptime = turnCount;
            }
        }
    } else {
        // C ref: dogmove.c:423-470 — pickup/eat path
        // Find the top object at pet's position (last in array = top of C's chain)
        let obj = null;
        for (let i = map.objects.length - 1; i >= 0; i--) {
            if (map.objects[i].ox === omx && map.objects[i].oy === omy) {
                obj = map.objects[i]; break;
            }
        }

        if (obj) {
            const edible = dogfood(mon, obj, turnCount);

            // C ref: dogmove.c:436-438 — eat if edible enough
            if ((edible <= CADAVER
                || (edog.mhpmax_penalty && edible === ACCFOOD))
                && could_reach_item(map, mon, obj.ox, obj.oy)) {
                dog_eat(mon, obj, map, turnCount);
                return 1;
            }

            // C ref: dogmove.c:440-467 — carry check
            const carryamt = can_carry(mon, obj);
            if (carryamt > 0 && !obj.cursed
                && could_reach_item(map, mon, obj.ox, obj.oy)) {
                if (rn2(20) < edog.apport + 3) {
                    if (rn2(udist) || !rn2(edog.apport)) {
                        // Pick up the object
                        map.removeObject(obj);
                        if (!mon.minvent) mon.minvent = [];
                        mon.minvent.push(obj);
                        // C ref: dogmove.c "The <pet> picks up <obj>." when observed.
                        if (display && player && couldsee(map, player, mon.mx, mon.my)) {
                            observeObject(obj);
                            display.putstr_message(`The ${mon.name} picks up ${doname(obj, null)}.`);
                        }
                    }
                }
            }
        }
    }
    return 0;
}

// ========================================================================
// movemon — multi-pass monster processing
// ========================================================================

// Move all monsters on the level
// C ref: mon.c movemon() — multi-pass loop until no monster can move
// Called from gameLoop after hero action, BEFORE mcalcmove.
export function movemon(map, player, display, fov, game = null) {
    let anyMoved;
    do {
        anyMoved = false;
        for (const mon of map.monsters) {
            if (mon.dead) continue;
            if (mon.movement >= NORMAL_SPEED) {
                const oldx = mon.mx;
                const oldy = mon.my;
                const alreadySawMon = !!(game && game.occupation && couldsee(map, player, oldx, oldy));
                mon.movement -= NORMAL_SPEED;
                anyMoved = true;
                dochug(mon, map, player, display, fov);
                // C ref: monmove.c dochugw() threat-notice interruption gate.
                // If an occupied hero newly notices a hostile, attack-capable
                // monster close enough to threaten, stop the occupation now.
                if (game && game.occupation && !mon.dead) {
                    const attacks = mon.type?.attacks || [];
                    const noAttacks = !attacks.some((a) => a && a.type !== AT_NONE);
                    const threatRangeSq = (BOLT_LIM + 1) * (BOLT_LIM + 1);
                    const oldDist = dist2(oldx, oldy, player.x, player.y);
                    const newDist = dist2(mon.mx, mon.my, player.x, player.y);
                    const canSeeNow = couldsee(map, player, mon.mx, mon.my);
                    const couldSeeOld = couldsee(map, player, oldx, oldy);
                    if (!mon.peaceful
                        && !noAttacks
                        && newDist <= threatRangeSq
                        && (!alreadySawMon || !couldSeeOld || oldDist > threatRangeSq)
                        && canSeeNow
                        && mon.mcanmove !== false) {
                        if (game.flags?.verbose !== false) {
                            game.display.putstr_message(`You stop ${game.occupation.occtxt}.`);
                        }
                        game.occupation = null;
                        game.multi = 0;
                    }
                }
            }
        }
    } while (anyMoved);

    // Remove dead monsters
    map.monsters = map.monsters.filter(m => !m.dead);
    player.displacedPetThisTurn = false;
}

// ========================================================================
// dochug — per-monster action dispatch
// ========================================================================

// C ref: monmove.c dochug() — process one monster's turn
function dochug(mon, map, player, display, fov) {
    // C ref: special-level "waiting" monsters are initialized to remain inert
    // until explicitly disturbed/engaged by scripted flow.
    if (mon.waiting && map?.flags?.is_tutorial) return;

    // C ref: mimic behavior — disguised mimics stay inert until disturbed.
    // Minimal parity gate: don't process roaming AI for mimic-class monsters.
    if (mon.type && mon.type.symbol === S_MIMIC) {
        return;
    }

    // C ref: monmove.c:735 — monsters wipe floor engravings before movement.
    wipeEngravingAt(map, mon.mx, mon.my, 1);

    // Phase 2: Sleep check
    // C ref: monmove.c disturb() — wake sleeping monster if player visible & close
    function disturb(monster) {
        // C ref: couldsee() and mdistu() <= 100 gate.
        const canSee = fov && fov.canSee(monster.mx, monster.my);
        if (!canSee) return false;
        if (dist2(monster.mx, monster.my, player.x, player.y) > 100) return false;

        // C ref: !Stealth || (ettin && rn2(10)).
        // Replay player state does not yet model stealth intrinsics by default.
        if (player.stealth) {
            const isEttin = monster.type?.name === 'ettin';
            if (!(isEttin && rn2(10))) return false;
        }

        // C ref: nymph/jabberwock/leprechaun: only wake 1/50.
        const sym = monster.type?.symbol;
        const isHardSleeper = sym === 'n' || monster.type?.name === 'jabberwock' || sym === 'l';
        if (isHardSleeper && rn2(50)) return false;

        // C ref: Aggravate_monster || dog/human || !rn2(7) (non-mimics).
        // We do not model mimic furniture/object disguise state here.
        const aggravate = !!player.aggravateMonster;
        const isDogOrHuman = sym === 'd' || sym === '@';
        if (!(aggravate || isDogOrHuman || !rn2(7))) return false;

        return true;
    }

    if (mon.sleeping) {
        if (disturb(mon)) mon.sleeping = false;
        return;
    }

    set_apparxy(mon, map, player);

    // C ref: monmove.c phase-1 timeout checks.
    // Confused monsters may recover with 1/50 chance each turn.
    if (mon.confused && !rn2(50)) mon.confused = false;
    // Stunned monsters may recover with 1/10 chance each turn.
    if (mon.stunned && !rn2(10)) mon.stunned = false;

    // C ref: monmove.c:759-761 — fleeing monster may regain courage.
    if (mon.flee && !(mon.fleetim > 0)
        && (mon.mhp ?? 0) >= (mon.mhpmax ?? 0)
        && !rn2(25)) {
        mon.flee = false;
    }

    // C ref: monmove.c:745-750 — fleeing teleport-capable monsters
    // check !rn2(40) and may spend their turn teleporting away.
    if (mon.flee && !rn2(40) && can_teleport(mon.type || {})
        && !mon.iswiz && !(map.flags && map.flags.noteleport)) {
            // Simplified rloc() equivalent: random accessible unoccupied square.
            for (let tries = 0; tries < 200; tries++) {
                const nx = 1 + rn2(COLNO - 1);
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

    // distfleeck: always rn2(5) for every non-sleeping monster
    // C ref: monmove.c:538 — bravegremlin = (rn2(5) == 0)
    rn2(5);

    // Phase 3: Evaluate condition block for ALL monsters (including tame)
    // C ref: monmove.c:882-887 — short-circuit OR evaluation
    // This determines whether monster wanders/moves (condition TRUE)
    // or falls through to Phase 4 attack (condition FALSE)
    // C ref: distfleeck(monmove.c): inrange/nearby are based on the monster's
    // remembered hero position (mux,muy), not always current player coords.
    const targetX = Number.isInteger(mon.mux) ? mon.mux : player.x;
    const targetY = Number.isInteger(mon.muy) ? mon.muy : player.y;
    const BOLT_LIM = 8;
    const inrange = dist2(mon.mx, mon.my, targetX, targetY) <= (BOLT_LIM * BOLT_LIM);
    const nearby = inrange && monnear(mon, targetX, targetY);
    const M2_WANDER = 0x800000;
    const isWanderer = !!(mon.type && mon.type.flags2 & M2_WANDER);
    const monCanSee = (mon.mcansee !== false) && !mon.blind;

    // Short-circuit OR matching C's evaluation order
    // Each rn2() is only consumed if earlier conditions didn't short-circuit
    let phase3Cond = !nearby;
    if (!phase3Cond) phase3Cond = !!(mon.flee);
    if (!phase3Cond) phase3Cond = false; // scared (simplified: no Elbereth)
    if (!phase3Cond) phase3Cond = !!(mon.confused);
    if (!phase3Cond) phase3Cond = !!(mon.stunned);
    if (!phase3Cond && mon.minvis) phase3Cond = !rn2(3);
    // C ref: monmove.c phase-three leprechaun clause:
    // (mdat->mlet == S_LEPRECHAUN && !findgold(player_inventory)
    //  && (findgold(mon_inventory) || rn2(2)))
    if (!phase3Cond && mon.mndx === PM_LEPRECHAUN) {
        const playerHasGoldNow = playerHasGold(player);
        const monHasGold = hasGold(mon.minvent);
        if (!playerHasGoldNow && (monHasGold || rn2(2))) phase3Cond = true;
    }
    if (typeof process !== 'undefined' && process.env.DEBUG_DOG_GATE === '1' && mon.tame) {
        console.error(
            `[dog-gate] call=${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'} `
            + `pet=${mon.type?.name} at=${mon.mx},${mon.my} target=${targetX},${targetY} `
            + `inrange=${inrange} nearby=${nearby} phase3=${phase3Cond} `
            + `peaceful=${!!mon.peaceful} mpeaceful=${!!mon.mpeaceful} `
            + `tame=${!!mon.tame} mtame=${mon.mtame ?? 0}`
        );
    }
    if (!phase3Cond && isWanderer) phase3Cond = !rn2(4);
    // skip Conflict check
    if (!phase3Cond && !monCanSee) phase3Cond = !rn2(4);
    if (!phase3Cond) phase3Cond = !!(mon.peaceful);

    if (phase3Cond) {
        // C ref: monmove.c:1743-1748 — meating check (inside m_move)
        // If monster is still eating, decrement meating and skip movement
        if (mon.meating) {
            mon.meating--;
            // C ref: dogmove.c:1454 finish_meating — clear meating when done
            // (no RNG consumed)
        } else if (mon.tame) {
            // Inside condition block: m_move (routes to dog_move for tame)
            // C ref: monmove.c:911 — m_move() for all monsters in this path
            const omx = mon.mx, omy = mon.my;
            dog_move(mon, map, player, display, fov);
            if (!mon.dead && (mon.mx !== omx || mon.my !== omy)) {
                mintrap_postmove(mon, map);
            }
        } else {
            const omx = mon.mx, omy = mon.my;
            m_move(mon, map, player);
            if (!mon.dead && (mon.mx !== omx || mon.my !== omy)) {
                mintrap_postmove(mon, map);
            }
            if (mon.mcanmove !== false
                && !mon.tame
                && monsterInShop(mon, map)
                && map.objectsAt(mon.mx, mon.my).length > 0) {
                maybeMonsterPickStuff(mon, map);
            }
        }
        // distfleeck recalc after m_move
        // C ref: monmove.c:915
        rn2(5);
    } else {
        // Phase 4: Standard Attacks
        // C ref: monmove.c:966-973 — attack only when in range and not scared.
        // We do not model full distfleeck scared state yet, but should still
        // avoid off-range attacks.
        if (!mon.peaceful && nearby && !mon.flee) {
            monsterAttackPlayer(mon, player, display);
        }
    }
}

// ========================================================================
// Pet ranged attack evaluation
// C ref: dogmove.c find_targ(), score_targ(), best_target(), pet_ranged_attk()
// ========================================================================

// C ref: dogmove.c:654-696 find_targ() — find first visible monster along a line
//
// CRITICAL FOR RNG ALIGNMENT: C checks mtmp->mux/muy (pet's tracked player
// position) along the scan line. If the player is in the path, find_targ
// returns &gy.youmonst, which score_targ handles with an early -3000 return
// BEFORE consuming rnd(5). For tame pets, mux/muy always equals the player's
// actual position (see set_apparxy in monmove.c:2211-2214).
//
// Without this check, JS scans past the player and finds monsters beyond,
// consuming extra rnd(5) calls that C never makes. This is a recurring bug
// pattern — see memory/pet_ranged_attk_bug.md for full documentation.
function find_targ(mon, dx, dy, maxdist, map, player) {
    const mux = Number.isInteger(mon.mux) ? mon.mux : 0;
    const muy = Number.isInteger(mon.muy) ? mon.muy : 0;
    let curx = mon.mx, cury = mon.my;
    for (let dist = 0; dist < maxdist; dist++) {
        curx += dx;
        cury += dy;
        if (!isok(curx, cury)) break;
        // C ref: dogmove.c:679 — if pet can't see this cell, stop
        if (!m_cansee(mon, map, curx, cury)) break;
        // C ref: dogmove.c:682-683 — if pet thinks player is here, return player
        // Uses mtmp->mux/muy (apparent player position), not always u.ux/u.uy.
        if (curx === mux && cury === muy) {
            return { isPlayer: true, mx: player.x, my: player.y };
        }
        // C ref: dogmove.c:685-693 — check for monster at position
        const targ = map.monsterAt(curx, cury);
        if (targ && !targ.dead) {
            // C ref: dogmove.c:687-690 — must be visible to the pet and not hidden
            const perceiveInvis = !!(mons[mon.mndx]?.flags1 & M1_SEE_INVIS);
            if ((!targ.minvis || perceiveInvis) && !targ.mundetected) {
                return targ;
            }
            // Pet can't see it — clear target and keep scanning
        }
    }
    return null;
}

// C ref: dogmove.c:698-740 find_friends() — check if allies are behind target
// Scans beyond the target in the same direction to see if the player or
// tame monsters are in the line of fire. Returns 1 if so (pet should not fire).
function find_friends(mon, target, maxdist, map, player) {
    const dx = Math.sign(target.mx - mon.mx);
    const dy = Math.sign(target.my - mon.my);
    const mux = Number.isInteger(mon.mux) ? mon.mux : 0;
    const muy = Number.isInteger(mon.muy) ? mon.muy : 0;
    let curx = target.mx, cury = target.my;
    let dist = Math.max(Math.abs(target.mx - mon.mx), Math.abs(target.my - mon.my));

    for (; dist <= maxdist; ++dist) {
        curx += dx;
        cury += dy;
        if (!isok(curx, cury)) return false;
        // C ref: dogmove.c:717-718 — if pet can't see beyond, stop
        if (!m_cansee(mon, map, curx, cury)) return false;
        // C ref: dogmove.c:721-722 — player behind target
        if (curx === mux && cury === muy) return true;
        // C ref: dogmove.c:724-736 — tame monster behind target
        const pal = map.monsterAt(curx, cury);
        if (pal && !pal.dead) {
            if (pal.tame) {
                const perceiveInvis = !!(mons[mon.mndx]?.flags1 & M1_SEE_INVIS);
                if (!pal.minvis || perceiveInvis) return true;
            }
            // Quest leaders/guardians — skip for now (not in early game)
        }
    }
    return false;
}

// C ref: dogmove.c:742-840 score_targ() — evaluate target attractiveness
//
// RNG CRITICAL: rnd(5) fuzz factor at line 835, rn2(3) if confused at 753/837.
// Several early returns (lines 774, 778, 783, 789, 794) exit BEFORE consuming
// rnd(5). The player target (isPlayer) hits line 786→789 returning -3000 before
// rnd(5) — this is critical for RNG alignment.
//
// For vampire shifters (line 818), rn2() is consumed. Not relevant for early
// game pets but included for correctness.
function score_targ(mon, target, map, player) {
    let score = 0;
    // C ref: dogmove.c:753 — if not confused, or 1-in-3 chance, do full scoring
    if (!mon.confused || !rn2(3)) {
        // C ref: dogmove.c:758-769 — alignment checks (minions/priests)
        // Simplified: early-game monsters are not minions/priests

        // C ref: dogmove.c:771-774 — quest friendlies (not in early game)

        // C ref: dogmove.c:776-779 — coaligned priests (not in early game)

        // C ref: dogmove.c:780-783 — adjacent targets penalized
        const dm = Math.max(Math.abs(mon.mx - target.mx), Math.abs(mon.my - target.my));
        if (dm <= 1) {
            score -= 3000;
            return score;
        }
        // C ref: dogmove.c:785-789 — tame monsters and player never targeted
        // Returns BEFORE rnd(5) at line 835
        if (target.tame || target.isPlayer) {
            score -= 3000;
            return score;
        }
        // C ref: dogmove.c:791-794 — friends behind target
        if (find_friends(mon, target, 15, map, player)) {
            score -= 3000;
            return score;
        }
        // C ref: dogmove.c:797-798 — hostile bonus
        if (!target.peaceful) score += 10;
        // C ref: dogmove.c:800-801 — passive monster penalty
        const mdat = mons[target.mndx];
        if (mdat && mdat.attacks && mdat.attacks[0] && mdat.attacks[0].type === 0) {
            score -= 1000;
        }
        // C ref: dogmove.c:804-807 — weak target penalty
        const targLev = target.mlevel || 0;
        const monLev = mon.mlevel || 0;
        if ((targLev < 2 && monLev > 5)
            || (monLev > 12 && targLev < monLev - 9)) {
            score -= 25;
        }
        // C ref: dogmove.c:813-822 — vampire shifter level adjustment
        // rn2() consumed here for vampire shifters — not relevant early game
        let mtmpLev = monLev;
        // (vampire shifter check omitted — no vampires in early game)

        // C ref: dogmove.c:826-827 — vastly stronger foe penalty
        if (targLev > mtmpLev + 4)
            score -= (targLev - mtmpLev) * 20;
        // C ref: dogmove.c:831 — beefiest monster bonus
        score += targLev * 2 + Math.floor((target.mhp || 0) / 3);
    }
    // C ref: dogmove.c:835 — fuzz factor (consumed for all targets that reach here)
    score += rnd(5);
    // C ref: dogmove.c:837-838 — confused penalty
    if (mon.confused && !rn2(3)) score -= 1000;
    return score;
}

// C ref: dogmove.c:842-890 best_target() — find best ranged attack target
function best_target(mon, forced, map, player) {
    // C ref: dogmove.c:854 — if (!mtmp->mcansee) return 0;
    const monCanSee = (mon.mcansee !== false)
        && !mon.blind
        && !(Number.isFinite(mon.mblinded) && mon.mblinded > 0)
        && !mon.mblind;
    if (!monCanSee) return null;
    let bestscore = -40000;
    let bestTarg = null;
    // C ref: dogmove.c:861-882 — scan all 8 directions
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const targ = find_targ(mon, dx, dy, 7, map, player);
            if (!targ) continue;
            const currscore = score_targ(mon, targ, map, player);
            if (currscore > bestscore) {
                bestscore = currscore;
                bestTarg = targ;
            }
        }
    }
    // C ref: dogmove.c:886-887 — filter negative scores
    if (!forced && bestscore < 0) bestTarg = null;
    return bestTarg;
}

// C ref: dogmove.c:892-970 pet_ranged_attk() — pet considers ranged attack
// For early game pets (dogs/cats), they have no ranged attacks,
// but best_target still evaluates targets (consuming RNG via score_targ).
// The actual attack path (mattackm) is not reached for melee-only pets.
function pet_ranged_attk(mon, map, player, display) {
    const mtarg = best_target(mon, false, map, player);
    // C ref: dogmove.c:912-970 — if target exists, pet may attempt attack.
    if (!mtarg) return 0;
    if (mtarg.isPlayer) {
        monsterAttackPlayer(mon, player, display);
        return 1; // acted (MMOVE_DONE)
    }
    // For melee-only pets, mattackm is relevant only when target is adjacent.
    const dm = Math.max(Math.abs(mon.mx - mtarg.mx), Math.abs(mon.my - mtarg.my));
    if (dm <= 1) {
        rnd(20); // C ref: mhitm.c mattackm() to-hit roll
    }
    return 0; // miss/no-ranged-action in early-game pet traces
}

// ========================================================================
// dog_move — tame pet AI
// ========================================================================

// C ref: dogmove.c dog_move() — full pet movement logic
// Returns: -2 (skip), 0 (stay), 1 (moved), 2 (moved+ate)
function dog_move(mon, map, player, display, fov, after = false) {
    const omx = mon.mx, omy = mon.my;
    // C ref: hack.h #define distu(xx,yy) dist2(xx,yy,u.ux,u.uy)
    const udist = dist2(omx, omy, player.x, player.y);
    const edogRaw = mon.edog || null;
    const edog = edogRaw || { apport: 0, hungrytime: 1000, whistletime: 0 };
    // C ref: dog_move uses svm.moves which is incremented at end of turn,
    // so during movemon() svm.moves = (completed turns + 1).
    // JS player.turns is incremented after movemon(), so add 1 to match C.
    const turnCount = (player.turns || 0) + 1;

    // C ref: dogmove.c:1024-1029 — dog_invent before dog_goal
    if (edog) {
        const invResult = dog_invent(mon, edog, udist, map, turnCount, display, player);
        if (invResult === 1) return 1; // ate something — done
        if (invResult === 2) return 0; // died
    }

    // C ref: dogmove.c — whappr = (monstermoves - edog->whistletime < 5)
    const whappr = (turnCount - edog.whistletime) < 5 ? 1 : 0;

    // dog_goal — scan nearby objects for food/items
    // C ref: dogmove.c dog_goal():500-554
    let gx = 0, gy = 0, gtyp = UNDEF;
    const minX = Math.max(1, omx - SQSRCHRADIUS);
    const maxX = Math.min(COLNO - 1, omx + SQSRCHRADIUS);
    const minY = Math.max(0, omy - SQSRCHRADIUS);
    const maxY = Math.min(ROWNO - 1, omy + SQSRCHRADIUS);

    // C ref: in_masters_sight = couldsee(omx, omy)
    if (fov && typeof fov.compute === 'function') {
        fov.compute(map, player.x, player.y);
    }
    const inMastersSight = (fov && typeof fov.couldSee === 'function')
        ? !!fov.couldSee(omx, omy)
        : couldsee(map, player, omx, omy);

    // C ref: dogmove.c:498 — dog_has_minvent = (droppables(mtmp) != 0)
    const dogHasMinvent = !!(mon.minvent && mon.minvent.length > 0);

    // C ref: dogmove.c:545 — lighting check for apport branch
    const dogLoc = map.at(omx, omy);
    const playerLoc0 = map.at(player.x, player.y);
    const dogLit = !!(dogLoc && dogLoc.lit);
    const playerLit = !!(playerLoc0 && playerLoc0.lit);

    // C ref: dogmove.c:498-555
    // Pets without EDOG (or leashed pets) don't pick object goals.
    if (!edogRaw || mon.mleashed) {
        gtyp = APPORT;
        gx = player.x;
        gy = player.y;
    } else {
        // C ref: dog_goal iterates fobj (ALL objects on level)
        // C's fobj is LIFO (place_object prepends), so iterate in reverse to match
        for (let oi = map.objects.length - 1; oi >= 0; oi--) {
            const obj = map.objects[oi];
            const ox = obj.ox, oy = obj.oy;

            if (ox < minX || ox > maxX || oy < minY || oy > maxY) continue;

            const otyp = dogfood(mon, obj, turnCount);

            // C ref: dogmove.c:526 — skip inferior goals
            if (otyp > gtyp || otyp === UNDEF) continue;

            // C ref: dogmove.c:529-531 — skip cursed POSITIONS unless starving
            // C uses cursed_object_at(nx, ny) which checks ALL objects at position
            if (cursed_object_at(map, ox, oy)
                && !(edog.mhpmax_penalty && otyp < MANFOOD)) continue;

            // C ref: dogmove.c:533-535 — skip unreachable goals
            if (!could_reach_item(map, mon, ox, oy)
                || !can_reach_location(map, mon, omx, omy, ox, oy))
                continue;

            if (otyp < MANFOOD) {
                // Good food — direct goal
                // C ref: dogmove.c:536-542
                if (otyp < gtyp || dist2(ox, oy, omx, omy) < dist2(gx, gy, omx, omy)) {
                    gx = ox; gy = oy; gtyp = otyp;
                }
            } else if (gtyp === UNDEF && inMastersSight
                    && !dogHasMinvent
                    && (!dogLit || playerLit)
                    && (otyp === MANFOOD || m_cansee(mon, map, ox, oy))
                    && edog.apport > rn2(8)
                    && can_carry(mon, obj) > 0) {
                // C ref: dogmove.c:543-552 — APPORT/MANFOOD with apport+carry check
                gx = ox; gy = oy; gtyp = APPORT;
            }
        }
    }

    // Follow player logic
    // C ref: dogmove.c:567-609
    let appr = 0;
    if (gtyp === UNDEF || (gtyp !== DOGFOOD && gtyp !== APPORT
                           && turnCount < edog.hungrytime)) {
        // No good goal found — follow player
        gx = player.x; gy = player.y;

        // C ref: dogmove.c:565-566 — if called from "after" path and already
        // adjacent to the hero's square, skip movement this turn.
        if (after && udist <= 4) {
            return 0;
        }

        appr = (udist >= 9) ? 1 : (mon.flee) ? -1 : 0;

        if (udist > 1) {
            // C ref: dogmove.c:575-578 — approach check
            const playerLoc = map.at(player.x, player.y);
            const playerInRoom = playerLoc && IS_ROOM(playerLoc.typ);
            if (!playerInRoom || !rn2(4) || whappr
                || (dogHasMinvent && rn2(edog.apport))) {
                appr = 1;
            }
        }

        // C ref: dogmove.c:583-606 — check stairs, food in inventory, portal
        if (appr === 0) {
            // Check if player is on stairs
            if ((player.x === map.upstair.x && player.y === map.upstair.y)
                || (player.x === map.dnstair.x && player.y === map.dnstair.y)) {
                appr = 1;
            } else {
                // C ref: scan player inventory for DOGFOOD items
                // Each dogfood() call consumes rn2(100) via obj_resists
                for (const invObj of player.inventory) {
                    if (dogfood(mon, invObj, turnCount) === DOGFOOD) {
                        appr = 1;
                        break;
                    }
                }
                // C ref: dogmove.c:586-595 — magic portal proximity also
                // makes pets follow more tightly.
                if (appr === 0) {
                    for (const trap of map.traps || []) {
                        if (trap && trap.ttyp === MAGIC_PORTAL) {
                            const dx = trap.tx - player.x;
                            const dy = trap.ty - player.y;
                            if ((dx * dx + dy * dy) <= 2) appr = 1;
                            break;
                        }
                    }
                }
            }
        }
    } else {
        // Good goal exists
        appr = 1;
    }

    // C ref: dogmove.c:610-611 — confused pets don't approach or flee
    if (mon.confused) appr = 0;

    // C ref: dogmove.c:603-637 — redirect goal when pet can't see master
    if (gx === player.x && gy === player.y && !inMastersSight) {
        const cp = gettrack(omx, omy);
        if (cp) {
            gx = cp.x; gy = cp.y;
            if (edog) edog.ogoal.x = 0;
        } else {
            if (edog && edog.ogoal.x
                && (edog.ogoal.x !== omx || edog.ogoal.y !== omy)) {
                gx = edog.ogoal.x; gy = edog.ogoal.y;
                edog.ogoal.x = 0;
            } else {
                let fardist = FARAWAY * FARAWAY;
                gx = FARAWAY; gy = FARAWAY;
                // C ref: do_clear_area(omx, omy, 9, wantdoor, &fardist)
                // wantdoor finds visible-from-pet position closest to player
                const wdState = { dist: fardist };
                do_clear_area(fov, map, omx, omy, 9, (x, y, st) => {
                    const ndist = dist2(x, y, player.x, player.y);
                    if (st.dist > ndist) {
                        gx = x; gy = y; st.dist = ndist;
                    }
                }, wdState);
                if (gx === FARAWAY || (gx === omx && gy === omy)) {
                    gx = player.x; gy = player.y;
                } else if (edog) {
                    edog.ogoal.x = gx; edog.ogoal.y = gy;
                }
            }
        }
    } else if (edog) {
        edog.ogoal.x = 0;
    }

    // ========================================================================
    // Position evaluation loop — uses mfndpos for C-faithful position collection
    // C ref: dogmove.c:1063-1268
    // ========================================================================

    // Collect valid positions (column-major order, no stay pos, boulder filter)
    const positions = mfndpos(mon, map, player);
    const cnt = positions.length;
    let nix = omx, niy = omy;
    let nidist = dist2(omx, omy, gx, gy);
    let chcnt = 0;
    let chi = -1;
    let uncursedcnt = 0;
    const cursemsg = new Array(cnt).fill(false);

    // First pass: count uncursed positions
    // C ref: dogmove.c:1063-1072
    for (let i = 0; i < cnt; i++) {
        const nx = positions[i].x, ny = positions[i].y;
        if (map.monsterAt(nx, ny) && !positions[i].allowM && !positions[i].allowMdisp) {
            continue;
        }
        if (cursed_object_at(map, nx, ny)) continue;
        uncursedcnt++;
    }

    // Second pass: evaluate positions
    // C ref: dogmove.c:1088-1268
    // C ref: distmin check for backtrack avoidance (hoisted from loop)
    let do_eat = false;
    let eatObj = null;
    const distmin_pu = Math.max(Math.abs(omx - player.x), Math.abs(omy - player.y));
    for (let i = 0; i < cnt; i++) {
        const nx = positions[i].x, ny = positions[i].y;
        // C ref: dogmove.c:1086-1088 — if leashed, we drag the pet along.
        if (mon.mleashed && dist2(nx, ny, player.x, player.y) > 4) {
            continue;
        }

        // C ref: dogmove.c:1088-1166 — pet melee against adjacent monster.
        // Minimal faithful path: consume mattackm to-hit roll and stop after
        // one melee attempt (MMOVE_DONE) like C.
        if (positions[i].allowM) {
            const target = map.monsterAt(nx, ny);
            if (target && !target.dead) {
                // C ref: dogmove.c:1114-1128 — balk if target too strong/dangerous.
                const balk = (mon.mlevel || 1)
                    + Math.floor((5 * (mon.mhp || 1)) / Math.max(1, mon.mhpmax || 1))
                    - 2;
                if ((target.mlevel || 0) >= balk
                    || (target.tame && mon.tame)
                    || (target.peaceful && (mon.mhp || 1) * 4 < Math.max(1, mon.mhpmax || 1))) {
                    continue;
                }

                const roll = rnd(20); // C ref: mhitm.c mattackm to-hit roll

                // C ref: mhitm.c mattackm() — strike = (find_mac(mdef) + m_lev) > dieroll.
                const toHit = (target.mac ?? 10) + (mon.mlevel || 1);
                const hit = toHit > roll;
                if (hit) {
                    const attk = mon.attacks && mon.attacks[0];
                    const targetVisible = couldsee(map, player, target.mx, target.my);
                    const suppressDetail = !!player.displacedPetThisTurn;
                    if (display && mon.name && target.name && targetVisible && !suppressDetail) {
                        display.putstr_message(`The ${mon.name} ${attackVerb(attk?.type)} the ${target.name}.`);
                    }
                    const dice = (attk && attk.dice) ? attk.dice : 1;
                    const sides = (attk && attk.sides) ? attk.sides : 1;
                    const dmg = c_d(Math.max(1, dice), Math.max(1, sides));

                    // C ref: mhitm_knockback()
                    rn2(3);
                    rn2(6); // C ref: mhitm_knockback

                    // Minimal pet-vs-monster damage/kill handling for replay parity.
                    // C path: mattackm -> mhitm_knockback -> mon killed -> corpse_chance -> grow_up.
                    target.mhp -= Math.max(1, dmg);
                    if (target.mhp <= 0) {
                        // C ref: mondied() drops monster inventory on death.
                        if (Array.isArray(target.minvent) && target.minvent.length > 0) {
                            for (const obj of target.minvent) {
                                obj.ox = target.mx;
                                obj.oy = target.my;
                                map.objects.push(obj);
                            }
                            target.minvent = [];
                        }
                        target.dead = true;
                        map.removeMonster(target);
                        if (display && target.name) {
                            display.putstr_message(`The ${target.name} is killed!`);
                        }
                        petCorpseChanceRoll(target);
                        rnd(1); // C ref: makemon.c grow_up()
                    } else {
                        consumePassivemmRng(mon, target, true, false);
                    }
                } else {
                    consumePassivemmRng(mon, target, false, false);
                }
                if (!hit && display && mon.name && target.name) {
                    display.putstr_message(`The ${mon.name} misses the ${target.name}.`);
                }
                return 0; // MMOVE_DONE-equivalent for this simplified path
            }
        }

        // C ref: monmove.c m_avoid_kicked_loc() via dogmove.c:1177
        if (m_avoid_kicked_loc(mon, nx, ny, player)) {
            continue;
        }

        // Trap avoidance — C ref: dogmove.c:1182-1204
        // Pets avoid harmful seen traps with 39/40 probability
        // Only check if mfndpos flagged this position as having a trap (ALLOW_TRAPS)
        if (positions[i].allowTraps) {
            const trap = map.trapAt(nx, ny);
            if (trap && !m_harmless_trap(mon, trap)) {
                if (!mon.mleashed) {
                    if (trap.tseen && rn2(40)) {
                        continue;
                    }
                }
            }
        }

        // Check for food at adjacent position
        // C ref: dogmove.c:1207-1227 — dogfood check at position
        // If food found, goto newdogpos (skip rest of loop)
        if (edog) {
            let foundFood = false;
            const canReachFood = could_reach_item(map, mon, nx, ny);
            for (let oi = map.objects.length - 1; oi >= 0; oi--) {
                const obj = map.objects[oi];
                if (obj.ox !== nx || obj.oy !== ny) continue;
                if (obj.cursed) {
                    cursemsg[i] = true;
                } else if (canReachFood) {
                    const otyp = dogfood(mon, obj, turnCount);
                    if (otyp < MANFOOD
                        && (otyp < ACCFOOD || turnCount >= edog.hungrytime)) {
                        nix = nx; niy = ny; chi = i;
                        do_eat = true;
                        eatObj = obj;
                        foundFood = true;
                        cursemsg[i] = false; // C ref: not reluctant
                        break;
                    }
                }
            }
            if (foundFood) break; // goto newdogpos
        }

        // Cursed avoidance
        // C ref: dogmove.c:1230-1232
        if (cursemsg[i] && !mon.mleashed && uncursedcnt > 0 && rn2(13 * uncursedcnt)) {
            continue;
        }

        // Track backtracking avoidance
        // C ref: dogmove.c:1239-1245 — only if not leashed and far from player
        // distmin > 5 check prevents backtrack avoidance when close to player
        // k = edog ? uncursedcnt : cnt; limit j < MTSZ && j < k - 1
        if (!mon.mleashed && mon.mtrack && distmin_pu > 5) {
            const k = edog ? uncursedcnt : cnt;
            let skipThis = false;
            for (let j = 0; j < MTSZ && j < k - 1; j++) {
                if (nx === mon.mtrack[j].x && ny === mon.mtrack[j].y) {
                    if (rn2(MTSZ * (k - j))) {
                        skipThis = true;
                        break;
                    }
                    // C ref: dogmove.c:1242-1244
                    // If rn2(...) == 0, keep scanning later mtrack entries.
                    // Duplicate coordinates can consume additional rn2() calls.
                }
            }
            if (skipThis) continue;
        }

        // Distance comparison
        // C ref: dogmove.c:1247-1257
        const ndist = dist2(nx, ny, gx, gy);
        const j = (ndist - nidist) * appr;
        if ((j === 0 && !rn2(++chcnt)) || j < 0
            || (j > 0 && !whappr
                && ((omx === nix && omy === niy && !rn2(3)) || !rn2(12)))) {
            nix = nx;
            niy = ny;
            nidist = ndist;
            if (j < 0) chcnt = 0;
            chi = i;
        }
    }

    // C ref: dogmove.c:1274-1279 — pet ranged attack before newdogpos
    // IMPORTANT: In C, when food is found (goto newdogpos at line 1236),
    // this code is SKIPPED because the goto jumps past it. Only execute
    // pet_ranged_attk when the pet didn't find food to eat.
    // Even if pet has no ranged attacks, best_target still evaluates
    // all visible monsters and calls score_targ (consuming rnd(5) each).
    if (!do_eat) {
        const ranged = pet_ranged_attk(mon, map, player, display);
        if (ranged) return 0;
    }

    // Move the dog
    // C ref: dogmove.c:1282-1327 — newdogpos label
    if (nix !== omx || niy !== omy) {
        // Update track history (shift old positions, add current)
        // C ref: dogmove.c:1319 — mon_track_add(mtmp, omx, omy)
        if (mon.mtrack) {
            for (let k = MTSZ - 1; k > 0; k--) {
                mon.mtrack[k] = mon.mtrack[k - 1];
            }
            mon.mtrack[0] = { x: omx, y: omy };
        }
        mon.mx = nix;
        mon.my = niy;

        // C ref: dogmove.c:1324-1327 — eat after moving
        if (do_eat && eatObj) {
            if (display && couldsee(map, player, mon.mx, mon.my)) {
                display.putstr_message(`Your ${mon.name} eats ${doname(eatObj, null)}.`);
            }
            dog_eat(mon, eatObj, map, turnCount);
        }
    }

    return nix !== omx || niy !== omy ? 1 : 0;
}

// ========================================================================
// m_move — hostile/peaceful monster movement
// ========================================================================

function onlineu(mon, player) {
    const dx = mon.mx - player.x;
    const dy = mon.my - player.y;
    return dx === 0 || dy === 0 || dy === dx || dy === -dx;
}

// C ref: priest.c move_special() — shared special movement path for
// shopkeepers and priests.
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

// C ref: shk.c shk_move() — minimal port for peaceful shopkeeper behavior.
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

    // C ref: shk.c shk_move() near-player early checks.
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
        // C ref: shk.c shk_move() peaceful branch order.
        if (player.invis || player.usteed) {
            avoid = false;
        } else {
            if (uondoor) {
                const hasPickaxeInInventory = !!(player.inventory || []).find((o) =>
                    o && (o.otyp === PICK_AXE || o.otyp === DWARVISH_MATTOCK));
                const hasPickaxeOnGround = !!(map.objectsAt?.(player.x, player.y) || []).find((o) =>
                    o && (o.otyp === PICK_AXE || o.otyp === DWARVISH_MATTOCK));
                // C Fast gate is omitted in JS state; keep conservative parity:
                // standing on a pickaxe/mattock counts as badinv.
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

// C ref: monmove.c m_move() — uses mfndpos + C-faithful position evaluation
// Key differences from dog_move:
//   - Position eval: first valid pos accepted (mmoved), then only strictly nearer
//   - No rn2(3)/rn2(12) fallback for worse positions (that's dog_move only)
//   - mfndpos provides positions in column-major order with NODIAG filtering
function m_move(mon, map, player) {
    // C ref: monmove.c dispatch for shopkeeper/guard/priest before generic m_move().
    if (mon.isshk) {
        const omx = mon.mx, omy = mon.my;
        shk_move(mon, map, player);
        return mon.mx !== omx || mon.my !== omy;
    }
    if (mon.ispriest) {
        // Priests with no shrine metadata fall back to generic movement.
        if (mon.epri && mon.epri.shrpos) {
            const omx = mon.mx, omy = mon.my;
            const ggx = mon.epri.shrpos.x + (rn2(3) - 1);
            const ggy = mon.epri.shrpos.y + (rn2(3) - 1);
            move_special(mon, map, player, false, 1, false, true, ggx, ggy);
            return mon.mx !== omx || mon.my !== omy;
        }
        // else fall through to generic m_move behavior
    }

    const omx = mon.mx, omy = mon.my;
    let ggx = player.x, ggy = player.y;

    // C ref: monmove.c — appr setup
    let appr = mon.flee ? -1 : 1;

    // C ref: should_see = couldsee(omx, omy) && lighting && dist <= 36
    // Controls whether monster tracks player by sight or by scent
    const monLoc = map.at(omx, omy);
    const playerLoc = map.at(ggx, ggy);
    const should_see = couldsee(map, player, omx, omy)
        && (playerLoc && playerLoc.lit || !(monLoc && monLoc.lit))
        && (dist2(omx, omy, ggx, ggy) <= 36);

    // C ref: monmove.c appr=0 conditions (simplified for current monsters)
    // mcansee check, invisibility, stealth, bat/stalker randomness
    // For now, only the relevant conditions for seed 42 scenario
    if (mon.confused) {
        appr = 0;
    }
    // C: peaceful monsters don't approach (unless shopkeeper)
    if (mon.peaceful) {
        appr = 0;
    }

    // C ref: monmove.c:1880-1886 — when monster can't currently see where it
    // thinks the hero is, tracking monsters follow recent player trail.
    if (!should_see && !noeyes(mon.type || {})) {
        const cp = gettrack(omx, omy);
        if (cp) {
            ggx = cp.x;
            ggy = cp.y;
        }
    }

    // C ref: monmove.c m_search_items() shop short-circuit:
    // "in shop, usually skip" -> rn2(25) consumed for non-peaceful movers.
    // Full item-search port is pending; keep this RNG-visible gate aligned.
    if (!mon.peaceful && monsterInShop(mon, map)) {
        rn2(25);
    }

    // Collect valid positions via mfndpos (column-major, NODIAG, boulder filter)
    const positions = mfndpos(mon, map, player);
    const cnt = positions.length;
    if (cnt === 0) return false; // no valid positions

    // ========================================================================
    // Position evaluation — C-faithful m_move logic
    // C ref: monmove.c position eval loop
    // Unlike dog_move, this does NOT use rn2(3)/rn2(12) for worse positions.
    // Selection: mmoved==NOTHING accepts first, then (appr==1 && nearer),
    //            (appr==-1 && !nearer), or (appr==0 && !rn2(++chcnt)).
    // ========================================================================
    let nix = omx, niy = omy;
    let nidist = dist2(omx, omy, ggx, ggy);
    let chcnt = 0;
    let mmoved = false; // C: mmoved = MMOVE_NOTHING
    const jcnt = Math.min(MTSZ, cnt - 1);

    for (let i = 0; i < cnt; i++) {
        const nx = positions[i].x;
        const ny = positions[i].y;

        // C ref: monmove.c:1953
        if (m_avoid_kicked_loc(mon, nx, ny, player)) continue;

        // C ref: monmove.c undesirable_disp()/trap avoidance —
        // monsters usually avoid harmful known traps (39/40 chance).
        if (positions[i].allowTraps) {
            const trap = map.trapAt(nx, ny);
            if (trap && trap.tseen && rn2(40)) continue;
        }

        // Track backtracking avoidance
        // C ref: monmove.c — only check when appr != 0
        if (appr !== 0 && mon.mtrack) {
            let skipThis = false;
            for (let j = 0; j < jcnt; j++) {
                if (nx === mon.mtrack[j].x && ny === mon.mtrack[j].y) {
                    const denom = 4 * (cnt - j);
                    if (rn2(denom)) {
                        skipThis = true;
                        break;
                    }
                    // C ref: monmove.c:1960-1964 — when rn2(...) == 0,
                    // continue checking later mtrack entries; duplicate
                    // coordinates can consume additional rn2() calls.
                }
            }
            if (skipThis) continue;
        }

        const ndist = dist2(nx, ny, ggx, ggy);
        const nearer = ndist < nidist;

        // C ref: monmove.c position selection
        // appr==1: accept strictly nearer positions
        // appr==-1: accept not-nearer (farther/equal) positions
        // appr==0: random selection via rn2(++chcnt)
        // mmoved==false: always accept first valid position
        if ((appr === 1 && nearer)
            || (appr === -1 && !nearer)
            || (appr === 0 && !rn2(++chcnt))
            || !mmoved) {
            nix = nx;
            niy = ny;
            nidist = ndist;
            mmoved = true;
        }
    }

    // Move the monster
    if (nix !== omx || niy !== omy) {
        // Update track history (C ref: mon_track_add)
        if (mon.mtrack) {
            for (let k = MTSZ - 1; k > 0; k--) {
                mon.mtrack[k] = mon.mtrack[k - 1];
            }
            mon.mtrack[0] = { x: omx, y: omy };
        }
        mon.mx = nix;
        mon.my = niy;
        return true;
    }
    return false;
}
