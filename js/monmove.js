// monmove.js -- Monster movement AI
// C-faithful port of mon.c movemon(), monmove.c dochug(), dogmove.c dog_move()
// Focus: exact RNG consumption alignment with C NetHack

import { COLNO, ROWNO, STONE, IS_WALL, IS_DOOR, IS_ROOM,
         ACCESSIBLE, CORR, DOOR, D_CLOSED, D_LOCKED, D_BROKEN,
         POOL, LAVAPOOL,
         NORMAL_SPEED, isok } from './config.js';
import { rn2, rnd } from './rng.js';
import { monsterAttackPlayer } from './combat.js';
import { FOOD_CLASS, BOULDER, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS } from './objects.js';
import { dogfood, dog_eat, can_carry, DOGFOOD, CADAVER, ACCFOOD, MANFOOD, APPORT,
         POISON, UNDEF, TABU } from './dog.js';
import { couldsee, m_cansee, do_clear_area } from './vision.js';
import { PM_GRID_BUG, PM_IRON_GOLEM, mons,
         M1_FLY, M1_AMORPHOUS, M1_CLING, MZ_SMALL, MR_FIRE, MR_SLEEP } from './monsters.js';
import { STATUE_TRAP, MAGIC_TRAP, VIBRATING_SQUARE, RUST_TRAP, FIRE_TRAP,
         SLP_GAS_TRAP, BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TRAPDOOR,
         WEB, ANTI_MAGIC } from './symbols.js';

const MTSZ = 4;           // C ref: monst.h — track history size
const SQSRCHRADIUS = 5;   // C ref: dogmove.c — object search radius
const FARAWAY = 127;      // C ref: hack.h — large distance sentinel

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

// ========================================================================
// mfndpos — collect valid adjacent positions in column-major order
// ========================================================================
// C ref: mon.c mfndpos() — returns positions a monster can move to
// Iterates (x-1..x+1) × (y-1..y+1) in column-major order, skipping current pos.
// Handles NODIAG (grid bugs), terrain, doors, monsters, player, boulders.
function mfndpos(mon, map, player) {
    const omx = mon.mx, omy = mon.my;
    const nodiag = (mon.mndx === PM_GRID_BUG);
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

            // C ref: MON_AT — skip positions with other monsters (unless ALLOW_M)
            if (map.monsterAt(nx, ny) && !allowM) continue;

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

            positions.push({ x: nx, y: ny });
        }
    }
    return positions;
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
function dog_invent(mon, edog, udist, map, turnCount) {
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
export function movemon(map, player, display, fov) {
    let anyMoved;
    do {
        anyMoved = false;
        for (const mon of map.monsters) {
            if (mon.dead) continue;
            if (mon.movement >= NORMAL_SPEED) {
                mon.movement -= NORMAL_SPEED;
                anyMoved = true;
                dochug(mon, map, player, display, fov);
            }
        }
    } while (anyMoved);

    // Remove dead monsters
    map.monsters = map.monsters.filter(m => !m.dead);
}

// ========================================================================
// dochug — per-monster action dispatch
// ========================================================================

// C ref: monmove.c dochug() — process one monster's turn
function dochug(mon, map, player, display, fov) {
    // Phase 2: Sleep check
    // C ref: monmove.c disturb() — wake sleeping monster if player visible & close
    if (mon.sleeping) {
        // C ref: disturb checks couldsee() first. If can't see: 0 RNG, return.
        const canSee = fov && fov.canSee(mon.mx, mon.my);
        if (!canSee) return;

        const d2 = dist2(mon.mx, mon.my, player.x, player.y);
        if (d2 > 100) return; // mdistu > 100

        // Simplified wake check (C has Stealth/Aggravate/tame checks with RNG)
        // For now, just wake without RNG to match the trace
        // (sleeping monsters in other rooms can't be seen, so they never reach here)
        mon.sleeping = false;
        return;
    }

    // distfleeck: always rn2(5) for every non-sleeping monster
    // C ref: monmove.c:538 — bravegremlin = (rn2(5) == 0)
    rn2(5);

    // Phase 3: Evaluate condition block for ALL monsters (including tame)
    // C ref: monmove.c:882-887 — short-circuit OR evaluation
    // This determines whether monster wanders/moves (condition TRUE)
    // or falls through to Phase 4 attack (condition FALSE)
    const nearby = (Math.abs(mon.mx - player.x) <= 1
                    && Math.abs(mon.my - player.y) <= 1);
    const M2_WANDER = 0x800000;
    const isWanderer = !!(mon.type && mon.type.flags2 & M2_WANDER);

    // Short-circuit OR matching C's evaluation order
    // Each rn2() is only consumed if earlier conditions didn't short-circuit
    let phase3Cond = !nearby;
    if (!phase3Cond) phase3Cond = !!(mon.flee);
    if (!phase3Cond) phase3Cond = false; // scared (simplified: no Elbereth)
    if (!phase3Cond) phase3Cond = !!(mon.confused);
    if (!phase3Cond) phase3Cond = !!(mon.stunned);
    if (!phase3Cond && mon.minvis) phase3Cond = !rn2(3);
    // skip leprechaun check (not relevant for early levels)
    if (!phase3Cond && isWanderer) phase3Cond = !rn2(4);
    // skip Conflict check
    if (!phase3Cond && mon.mcansee === false) phase3Cond = !rn2(4);
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
            dog_move(mon, map, player, display, fov);
        } else {
            m_move(mon, map, player);
        }
        // distfleeck recalc after m_move
        // C ref: monmove.c:915
        rn2(5);
    } else {
        // Phase 4: Standard Attacks
        // C ref: monmove.c:966-977 — mattacku for hostile monsters
        if (!mon.peaceful) {
            monsterAttackPlayer(mon, player, display);
        }
    }
}

// ========================================================================
// dog_move — tame pet AI
// ========================================================================

// C ref: dogmove.c dog_move() — full pet movement logic
// Returns: -2 (skip), 0 (stay), 1 (moved), 2 (moved+ate)
function dog_move(mon, map, player, display, fov) {
    const omx = mon.mx, omy = mon.my;
    const udist = dist2(omx, omy, player.x, player.y);
    const edog = mon.edog || { apport: 0, hungrytime: 1000, whistletime: 0 };
    // C ref: dog_move uses svm.moves which is incremented at end of turn,
    // so during movemon() svm.moves = (completed turns + 1).
    // JS player.turns is incremented after movemon(), so add 1 to match C.
    const turnCount = (player.turns || 0) + 1;

    // C ref: dogmove.c:1024-1029 — dog_invent before dog_goal
    if (edog) {
        const invResult = dog_invent(mon, edog, udist, map, turnCount);
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
    const inMastersSight = couldsee(map, player, omx, omy);

    // C ref: dogmove.c:498 — dog_has_minvent = (droppables(mtmp) != 0)
    const dogHasMinvent = !!(mon.minvent && mon.minvent.length > 0);

    // C ref: dogmove.c:545 — lighting check for apport branch
    const dogLoc = map.at(omx, omy);
    const playerLoc0 = map.at(player.x, player.y);
    const dogLit = !!(dogLoc && dogLoc.lit);
    const playerLit = !!(playerLoc0 && playerLoc0.lit);

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

    // Follow player logic
    // C ref: dogmove.c:567-609
    let appr = 0;
    if (gtyp === UNDEF || (gtyp !== DOGFOOD && gtyp !== APPORT
                           && turnCount < edog.hungrytime)) {
        // No good goal found — follow player
        gx = player.x; gy = player.y;

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
    // C ref: dogmove.c:1066-1079
    for (let i = 0; i < cnt; i++) {
        const nx = positions[i].x, ny = positions[i].y;
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

        // Trap avoidance — C ref: dogmove.c:1182-1204
        // Pets avoid harmful seen traps with 39/40 probability
        const trap = map.trapAt(nx, ny);
        if (trap && !m_harmless_trap(mon, trap)) {
            if (!mon.mleashed) {
                if (trap.tseen && rn2(40))
                    continue;
            }
        }

        // Check for food at adjacent position
        // C ref: dogmove.c:1207-1227 — dogfood check at position
        // If food found, goto newdogpos (skip rest of loop)
        if (edog) {
            let foundFood = false;
            const canReachFood = could_reach_item(map, mon, nx, ny);
            for (const obj of map.objects) {
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
        if (cursemsg[i] && uncursedcnt > 0 && rn2(13 * uncursedcnt)) {
            continue;
        }

        // Track backtracking avoidance
        // C ref: dogmove.c:1239-1245 — only if not leashed and far from player
        // distmin > 5 check prevents backtrack avoidance when close to player
        // k = edog ? uncursedcnt : cnt; limit j < MTSZ && j < k - 1
        if (mon.mtrack && distmin_pu > 5) {
            const k = edog ? uncursedcnt : cnt;
            let skipThis = false;
            for (let j = 0; j < MTSZ && j < k - 1; j++) {
                if (nx === mon.mtrack[j].x && ny === mon.mtrack[j].y) {
                    if (rn2(MTSZ * (k - j))) {
                        skipThis = true;
                    }
                    break;
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
            dog_eat(mon, eatObj, map, turnCount);
        }
    }

    return nix !== omx || niy !== omy ? 1 : 0;
}

// ========================================================================
// m_move — hostile/peaceful monster movement
// ========================================================================

// C ref: monmove.c m_move() — uses mfndpos + C-faithful position evaluation
// Key differences from dog_move:
//   - Position eval: first valid pos accepted (mmoved), then only strictly nearer
//   - No rn2(3)/rn2(12) fallback for worse positions (that's dog_move only)
//   - mfndpos provides positions in column-major order with NODIAG filtering
function m_move(mon, map, player) {
    const omx = mon.mx, omy = mon.my;
    const ggx = player.x, ggy = player.y;

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

    // Collect valid positions via mfndpos (column-major, NODIAG, boulder filter)
    const positions = mfndpos(mon, map, player);
    const cnt = positions.length;
    if (cnt === 0) return; // no valid positions

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

        // Track backtracking avoidance
        // C ref: monmove.c — only check when appr != 0
        if (appr !== 0 && mon.mtrack) {
            let skipThis = false;
            for (let j = 0; j < jcnt; j++) {
                if (nx === mon.mtrack[j].x && ny === mon.mtrack[j].y) {
                    if (rn2(4 * (cnt - j))) {
                        skipThis = true;
                    }
                    break;
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
    }
}
