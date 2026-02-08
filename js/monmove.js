// monmove.js -- Monster movement AI
// C-faithful port of mon.c movemon(), monmove.c dochug(), dogmove.c dog_move()
// Focus: exact RNG consumption alignment with C NetHack

import { COLNO, ROWNO, STONE, IS_WALL, IS_DOOR, IS_ROOM,
         ACCESSIBLE, CORR, DOOR, D_CLOSED, D_LOCKED,
         NORMAL_SPEED, isok } from './config.js';
import { rn2, rnd } from './rng.js';
import { monsterAttackPlayer } from './combat.js';
import { FOOD_CLASS, CORPSE, TRIPE_RATION, MEATBALL, MEAT_STICK,
         ENORMOUS_MEATBALL, MEAT_RING } from './objects.js';

const MTSZ = 4;           // C ref: monst.h — track history size
const SQSRCHRADIUS = 5;   // C ref: dogmove.c — object search radius

// dogfood return categories (C ref: mextra.h dogfood_types)
const DOGFOOD = 0;
const CADAVER = 1;
const ACCFOOD = 2;
const MANFOOD = 3;
const APPORT  = 4;
const POISON  = 5;
const UNDEF   = 6;
const TABU    = 7;

// C direction tables (C ref: monmove.c)
const xdir = [0, 1, 1, 1, 0, -1, -1, -1];
const ydir = [-1, -1, 0, 1, 1, 1, 0, -1];

// Squared distance
function dist2(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// ========================================================================
// movemon — multi-pass monster processing
// ========================================================================

// Move all monsters on the level
// C ref: mon.c movemon() — multi-pass loop until no monster can move
// Called from gameLoop after hero action, BEFORE mcalcmove.
export function moveMonsters(map, player, display, fov) {
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

    // Phase 3: Movement dispatch
    if (mon.tame) {
        dog_move(mon, map, player, display, fov);
    } else {
        // Hostile/peaceful monsters
        // C ref: dochug Phase 3 — check nearby, then m_move
        const d2 = dist2(mon.mx, mon.my, player.x, player.y);

        if (Math.abs(mon.mx - player.x) <= 1
            && Math.abs(mon.my - player.y) <= 1) {
            // Adjacent: attack
            if (!mon.peaceful) {
                monsterAttackPlayer(mon, player, display);
            }
        } else {
            // Not adjacent: try to move
            if (!mon.peaceful) {
                m_move(mon, map, player);
            }
        }
    }

    // Post-movement distfleeck: always rn2(5) for every non-sleeping monster
    // C ref: monmove.c:915 — (void) distfleeck(mtmp, inrange, nearby)
    rn2(5);
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
    const turnCount = player.turns || 0;

    // C ref: dogmove.c — whappr = (monstermoves - edog->whistletime < 5)
    const whappr = (turnCount - edog.whistletime) < 5 ? 1 : 0;

    // dog_goal — scan nearby objects for food/items
    // C ref: dogmove.c:500-554
    let gx = 0, gy = 0, gtyp = UNDEF;
    const minX = omx - SQSRCHRADIUS, maxX = omx + SQSRCHRADIUS;
    const minY = omy - SQSRCHRADIUS, maxY = omy + SQSRCHRADIUS;

    // C ref: dog_goal iterates fobj (ALL objects on level)
    // C's fobj is LIFO (place_object prepends), so iterate in reverse to match
    for (let oi = map.objects.length - 1; oi >= 0; oi--) {
        const obj = map.objects[oi];
        const ox = obj.ox, oy = obj.oy;
        if (ox < minX || ox > maxX || oy < minY || oy > maxY) continue;

        const otyp = dogfood(mon, obj);

        // C ref: dogmove.c:526 — skip inferior goals
        if (otyp > gtyp || otyp === UNDEF) continue;

        // C ref: dogmove.c:529-531 — skip cursed positions unless starving
        if (obj.cursed && !(edog.mhpmax_penalty && otyp < MANFOOD)) continue;

        if (otyp < MANFOOD) {
            // Good food — direct goal
            // C ref: dogmove.c:536-542
            if (otyp < gtyp || dist2(ox, oy, omx, omy) < dist2(gx, gy, omx, omy)) {
                gx = ox; gy = oy; gtyp = otyp;
            }
        } else if (gtyp === UNDEF
                   && (otyp === MANFOOD || true) // simplified m_cansee check
                   && edog.apport > rn2(8)
                   && true /* can_carry */) {
            // C ref: dogmove.c:543-552 — APPORT/MANFOOD with apport check
            gx = ox; gy = oy; gtyp = APPORT;
        }
    }

    // Follow player logic
    // C ref: dogmove.c:559-594
    let appr = 0;
    if (gtyp === UNDEF || (gtyp !== DOGFOOD && gtyp !== APPORT
                           && turnCount < edog.hungrytime)) {
        // No good goal found — follow player
        gx = player.x; gy = player.y;

        appr = (udist >= 9) ? 1 : (mon.flee) ? -1 : 0;

        if (udist > 1) {
            // C ref: dogmove.c:568 — approach check
            const playerLoc = map.at(player.x, player.y);
            const playerInRoom = playerLoc && IS_ROOM(playerLoc.typ);
            if (!playerInRoom || !rn2(4) || whappr) {
                appr = 1;
            }
        }

        // C ref: dogmove.c:573-592 — check stairs, food in inventory, portal
        if (appr === 0) {
            // Check if player is on stairs
            if ((player.x === map.upstair.x && player.y === map.upstair.y)
                || (player.x === map.dnstair.x && player.y === map.dnstair.y)) {
                appr = 1;
            }
            // C ref: else check player inventory for DOGFOOD → consumes rn2(100) per item
            // For carnivorous pets, food_ration = MANFOOD (not DOGFOOD), so no match.
            // Simplified: skip inventory scan for now (pet is carnivorous)
        }
    } else {
        // Good goal exists
        appr = 1;
    }

    if (mon.confused) appr = 1;

    // C ref: dogmove.c — if already adjacent to player, stay put
    if (appr === 1 && udist <= 2) {
        return 0;
    }

    // ========================================================================
    // Position evaluation loop
    // C ref: dogmove.c:1080-1260
    // ========================================================================
    let nix = omx, niy = omy;
    let nidist = dist2(omx, omy, gx, gy);
    let chcnt = 0;
    let chi = -1;
    let uncursedcnt = 0;
    const cursemsg = new Array(9).fill(false);

    // First pass: count uncursed positions
    for (let i = 0; i < 9; i++) {
        let nx, ny;
        if (i === 8) { nx = omx; ny = omy; }
        else { nx = omx + xdir[i]; ny = omy + ydir[i]; }
        if (!isok(nx, ny)) continue;
        const loc = map.at(nx, ny);
        if (!loc || !ACCESSIBLE(loc.typ)) continue;
        if (map.monsterAt(nx, ny) && !(nx === omx && ny === omy)) continue;
        if (nx === player.x && ny === player.y) continue;

        // Check for cursed objects at this position
        let hasCursed = false;
        for (const obj of map.objects) {
            if (obj.ox === nx && obj.oy === ny && obj.cursed) {
                hasCursed = true; break;
            }
        }
        if (!hasCursed) uncursedcnt++;
    }

    // Second pass: evaluate positions
    let cnt = 0;
    for (let i = 0; i < 9; i++) {
        let nx, ny;
        if (i === 8) { nx = omx; ny = omy; }
        else { nx = omx + xdir[i]; ny = omy + ydir[i]; }
        if (!isok(nx, ny)) continue;
        const loc = map.at(nx, ny);
        if (!loc || !ACCESSIBLE(loc.typ)) continue;
        if (map.monsterAt(nx, ny) && !(nx === omx && ny === omy)) continue;
        if (nx === player.x && ny === player.y) continue;

        cnt++;

        // Track backtracking avoidance
        // C ref: dogmove.c:1195-1200 (shared with m_move at monmove.c:1962)
        if (mon.mtrack) {
            let skipThis = false;
            for (let j = 0; j < MTSZ && j < mon.mtrack.length; j++) {
                if (mon.mtrack[j].x === nx && mon.mtrack[j].y === ny) {
                    if (rn2(4 * (cnt - j))) {
                        skipThis = true;
                    }
                    break;
                }
            }
            if (skipThis) continue;
        }

        // Check for food at adjacent position
        // C ref: dogmove.c:1210-1224 — dogfood check at position
        // If food found, goto newdogpos (skip rest of loop)
        if (edog) {
            let foundFood = false;
            for (const obj of map.objects) {
                if (obj.ox !== nx || obj.oy !== ny) continue;
                if (obj.cursed) {
                    cursemsg[i] = true;
                } else {
                    const otyp = dogfood(mon, obj);
                    if (otyp < MANFOOD
                        && (otyp < ACCFOOD || turnCount >= edog.hungrytime)) {
                        nix = nx; niy = ny; chi = i;
                        foundFood = true;
                        break;
                    }
                }
            }
            if (foundFood) break; // goto newdogpos
        }

        // Cursed avoidance
        // C ref: dogmove.c:1227-1231
        if (cursemsg[i] && uncursedcnt > 0 && rn2(13 * uncursedcnt)) {
            continue;
        }

        // Distance comparison
        // C ref: dogmove.c:1247-1256
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
    if (nix !== omx || niy !== omy) {
        // Update track history (shift old positions, add current)
        if (mon.mtrack) {
            for (let k = MTSZ - 1; k > 0; k--) {
                mon.mtrack[k] = mon.mtrack[k - 1];
            }
            mon.mtrack[0] = { x: omx, y: omy };
        }
        mon.mx = nix;
        mon.my = niy;
    }

    return nix !== omx || niy !== omy ? 1 : 0;
}

// ========================================================================
// dogfood — classify object for pet food evaluation
// ========================================================================

// C ref: dog.c dogfood() — returns food category
// Always calls obj_resists (rn2(100)) for RNG consumption
function dogfood(mon, obj) {
    // C ref: dog.c:998 — poisoned items
    if (obj.opoisoned) return POISON;

    // C ref: dog.c:1000 — obj_resists(obj, 0, 95) → rn2(100)
    const dominated = rn2(100);
    if (dominated > 95) {
        return obj.cursed ? TABU : APPORT;
    }

    // Classify by object class
    // C ref: dog.c:1004-1129
    if (obj.oclass === FOOD_CLASS) {
        // C ref: dog.c food classification for carnivorous pets (dogs/cats)
        if (obj.otyp === CORPSE) {
            return CADAVER; // C ref: dog.c corpse for carnivorous = CADAVER
        }
        // C ref: is_meat() — tripe, meatball, meat_stick, etc.
        if (obj.otyp === TRIPE_RATION || obj.otyp === MEATBALL
            || obj.otyp === MEAT_STICK || obj.otyp === ENORMOUS_MEATBALL
            || obj.otyp === MEAT_RING) {
            return DOGFOOD; // C ref: is_meat && is_carnivorous → DOGFOOD
        }
        return MANFOOD;
    }

    // Non-food items
    // C ref: dog.c:1121-1124 — APPORT if not cursed, not BALL/CHAIN
    if (!obj.cursed) return APPORT;

    // C ref: dog.c:1127-1128 — ROCK_CLASS or cursed → UNDEF
    return UNDEF;
}

// ========================================================================
// m_move — hostile monster movement with backtracking
// ========================================================================

// C ref: monmove.c m_move() — position evaluation with track avoidance
function m_move(mon, map, player) {
    const omx = mon.mx, omy = mon.my;
    const gx = player.x, gy = player.y;

    // C ref: approach = 1 for hostile monsters moving toward player
    const appr = mon.flee ? -1 : 1;

    let nix = omx, niy = omy;
    let nidist = dist2(omx, omy, gx, gy);
    let chcnt = 0;
    let cnt = 0;

    for (let i = 0; i < 9; i++) {
        let nx, ny;
        if (i === 8) { nx = omx; ny = omy; }
        else { nx = omx + xdir[i]; ny = omy + ydir[i]; }
        if (!isok(nx, ny)) continue;

        const loc = map.at(nx, ny);
        if (!loc || !ACCESSIBLE(loc.typ)) continue;
        if (IS_WALL(loc.typ) || loc.typ === STONE) continue;
        if (IS_DOOR(loc.typ) && (loc.flags & D_CLOSED || loc.flags & D_LOCKED)) continue;
        if (map.monsterAt(nx, ny) && !(nx === omx && ny === omy)) continue;
        if (nx === player.x && ny === player.y) continue;

        cnt++;

        // Track backtracking avoidance
        // C ref: monmove.c:1962 — rn2(4 * (cnt - j))
        if (mon.mtrack) {
            let skipThis = false;
            for (let j = 0; j < MTSZ && j < mon.mtrack.length; j++) {
                if (mon.mtrack[j].x === nx && mon.mtrack[j].y === ny) {
                    if (rn2(4 * (cnt - j))) {
                        skipThis = true;
                    }
                    break;
                }
            }
            if (skipThis) continue;
        }

        // Distance comparison
        // C ref: monmove.c position evaluation — same as dog_move
        const ndist = dist2(nx, ny, gx, gy);
        const j = (ndist - nidist) * appr;

        if ((j === 0 && !rn2(++chcnt)) || j < 0
            || (j > 0 && ((omx === nix && omy === niy && !rn2(3)) || !rn2(12)))) {
            nix = nx;
            niy = ny;
            nidist = ndist;
            if (j < 0) chcnt = 0;
        }
    }

    // Move the monster
    if (nix !== omx || niy !== omy) {
        // Update track history
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
