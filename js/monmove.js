// monmove.js -- Monster movement AI
// C-faithful port of mon.c movemon(), monmove.c dochug(), dogmove.c dog_move()
// Focus: exact RNG consumption alignment with C NetHack

import { COLNO, ROWNO, STONE, IS_WALL, IS_DOOR, IS_ROOM,
         ACCESSIBLE, CORR, DOOR, D_CLOSED, D_LOCKED, D_BROKEN,
         POOL, LAVAPOOL,
         NORMAL_SPEED, isok } from './config.js';
import { rn2, rnd, c_d } from './rng.js';
import { monsterAttackPlayer } from './combat.js';
import { FOOD_CLASS, COIN_CLASS, BOULDER, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS } from './objects.js';
import { dogfood, dog_eat, can_carry, DOGFOOD, CADAVER, ACCFOOD, MANFOOD, APPORT,
         POISON, UNDEF, TABU } from './dog.js';
import { couldsee, m_cansee, do_clear_area } from './vision.js';
import { can_teleport } from './mondata.js';
import { PM_GRID_BUG, PM_IRON_GOLEM, PM_SHOPKEEPER, mons,
         PM_LEPRECHAUN,
         M1_FLY, M1_AMORPHOUS, M1_CLING, M1_SEE_INVIS, S_MIMIC,
         MZ_TINY, MZ_SMALL, MR_FIRE, MR_SLEEP, G_FREQ } from './monsters.js';
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

function hasGold(inv) {
    return Array.isArray(inv)
        && inv.some(o => o && o.oclass === COIN_CLASS && (o.quan ?? 1) > 0);
}

// C ref: mon.c:3243 corpse_chance() RNG.
function petCorpseChanceRoll(mon) {
    const mdat = mon?.type || {};
    const gfreq = (mdat.geno || 0) & G_FREQ;
    const verysmall = (mdat.size || 0) === MZ_TINY;
    const corpsetmp = 2 + (gfreq < 2 ? 1 : 0) + (verysmall ? 1 : 0);
    return rn2(corpsetmp);
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

            const monAtPos = map.monsterAt(nx, ny);
            // C ref: MON_AT — skip positions with other monsters (unless ALLOW_M)
            if (monAtPos && !allowM) continue;

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

            positions.push({
                x: nx,
                y: ny,
                allowTraps,
                allowM: !!(allowM && monAtPos),
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
    // C ref: mimic behavior — disguised mimics stay inert until disturbed.
    // Minimal parity gate: don't process roaming AI for mimic-class monsters.
    if (mon.type && mon.type.symbol === S_MIMIC) {
        return;
    }

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
    const nearby = (Math.abs(mon.mx - player.x) <= 1
                    && Math.abs(mon.my - player.y) <= 1);
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
        const playerHasGold = hasGold(player.inventory);
        const monHasGold = hasGold(mon.minvent);
        if (!playerHasGold && (monHasGold || rn2(2))) phase3Cond = true;
    }
    if (!phase3Cond && isWanderer) phase3Cond = !rn2(4);
    // skip Conflict check
    if (!phase3Cond && !monCanSee) phase3Cond = !rn2(4);
    if (!phase3Cond) phase3Cond = !!(mon.peaceful);

    if (phase3Cond) {
        // C ref: monmove.c dochug() routes shopkeepers through shk_move(),
        // not generic m_move; preserve RNG by skipping random position picking.
        if (mon.mndx === PM_SHOPKEEPER) {
            // No-op until full shk_move behavior is implemented.
        }
        // C ref: monmove.c:1743-1748 — meating check (inside m_move)
        // If monster is still eating, decrement meating and skip movement
        else if (mon.meating) {
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
    let curx = mon.mx, cury = mon.my;
    for (let dist = 0; dist < maxdist; dist++) {
        curx += dx;
        cury += dy;
        if (!isok(curx, cury)) break;
        // C ref: dogmove.c:679 — if pet can't see this cell, stop
        if (!m_cansee(mon, map, curx, cury)) break;
        // C ref: dogmove.c:682-683 — if pet thinks player is here, return player
        // For tame pets, mux/muy == u.ux/u.uy (see set_apparxy)
        if (player && curx === player.x && cury === player.y) {
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
    let curx = target.mx, cury = target.my;
    let dist = Math.max(Math.abs(target.mx - mon.mx), Math.abs(target.my - mon.my));

    for (; dist <= maxdist; ++dist) {
        curx += dx;
        cury += dy;
        if (!isok(curx, cury)) return false;
        // C ref: dogmove.c:717-718 — if pet can't see beyond, stop
        if (!m_cansee(mon, map, curx, cury)) return false;
        // C ref: dogmove.c:721-722 — player behind target
        if (player && curx === player.x && cury === player.y) return true;
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
    // C ref: dogmove.c:854 — blind pets can't see targets
    // mcansee is initialized TRUE for all new monsters (makemon.c:1298)
    // and only set FALSE by blinding effects. We check mon.mblind here.
    if (mon.mblind) return null;
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
                        target.dead = true;
                        map.removeMonster(target);
                        petCorpseChanceRoll(target);
                        rnd(1); // C ref: makemon.c grow_up()
                    } else {
                        // C ref: mhitm.c passivemm() for adjacent non-lethal outcomes.
                        rn2(3);
                    }
                } else {
                    // C ref: mhitm.c passivemm() on miss/non-kill interactions.
                    rn2(3);
                }
                if (roll === 20 && display && mon.name && target.name) {
                    display.putstr_message(`The ${mon.name} misses the ${target.name}.`);
                }
                return 0; // MMOVE_DONE-equivalent for this simplified path
            }
        }

        // Trap avoidance — C ref: dogmove.c:1182-1204
        // Pets avoid harmful seen traps with 39/40 probability
        // Only check if mfndpos flagged this position as having a trap (ALLOW_TRAPS)
        if (positions[i].allowTraps) {
            const trap = map.trapAt(nx, ny);
            if (trap && !m_harmless_trap(mon, trap)) {
                if (!mon.mleashed) {
                    if (trap.tseen && rn2(40))
                        continue;
                }
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
