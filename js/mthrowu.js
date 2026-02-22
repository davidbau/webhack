// mthrowu.js -- Monster ranged attacks (throwing)
// C ref: mthrowu.c — thrwmu(), m_throw(), monshoot(), select_rwep(), lined_up()
// Also includes weapon wield helpers used before ranged/melee attacks.
//
// INCOMPLETE / MISSING vs C mthrowu.c:
// - select_rwep: simplified priority (C has cockatrice eggs, pies, boulders, launchers)
// - m_throw: no ohitmon() full damage calculation (erosion, material bonuses)
// - m_throw: corpse creation uses corpse_chance + mkcorpstat (faithful to C mondied)
// - thrwmu: polearm attack path not implemented (C:1169)
// - thrwmu: mon_wield_item not called before select_rwep (C:1157)
// - monmulti: prince/lord/mplayer multishot bonuses not modeled
// - No spitmu (acid/venom spit) implementation
// - No breamu (breath weapon) implementation
// - No buzzmu (spell ray) implementation

import { ACCESSIBLE, IS_OBSTRUCTED, IS_DOOR, IS_WALL,
         D_CLOSED, D_LOCKED, IRONBARS, SINK, isok, A_STR } from './config.js';
import { rn2, rnd } from './rng.js';
import { exercise } from './attrib_exercise.js';
import { newexplevel } from './exper.js';
import { BOULDER, WEAPON_CLASS, CORPSE, objectData } from './objects.js';
import { doname, mkcorpstat } from './mkobj.js';
import { couldsee, m_cansee } from './vision.js';
import { monDisplayName } from './mondata.js';
import { mons, AT_WEAP, G_NOCORPSE } from './monsters.js';
import { distmin, mondead, BOLT_LIM } from './monutil.js';
import { placeFloorObject } from './floor_objects.js';
import { corpse_chance } from './mon.js';

// C ref: mthrowu.c blocking_terrain() subset used by lined_up().
function blockingTerrainForLinedup(map, x, y) {
    if (!isok(x, y)) return true;
    const loc = map.at(x, y);
    if (!loc) return true;
    if (IS_OBSTRUCTED(loc.typ)) return true;
    if (IS_DOOR(loc.typ) && (loc.flags & (D_CLOSED | D_LOCKED))) return true;
    return false;
}

// C ref: mthrowu.c linedup()/lined_up() for monster vs hero.
export function linedUpToPlayer(mon, map, player, fov = null) {
    const ax = Number.isInteger(mon.mux) ? mon.mux : player.x;
    const ay = Number.isInteger(mon.muy) ? mon.muy : player.y;
    const bx = mon.mx;
    const by = mon.my;
    const tbx = ax - bx;
    const tby = ay - by;
    if (!tbx && !tby) return false;

    if (!(!tbx || !tby || Math.abs(tbx) === Math.abs(tby))) return false;
    if (distmin(tbx, tby, 0, 0) >= BOLT_LIM) return false;

    // C ref: if target is hero square, use couldsee(mon_pos), otherwise clear_path().
    const inSight = (ax === player.x && ay === player.y)
        // C ref: linedup() uses couldsee(bx, by) for hero target.
        // Use current FOV COULD_SEE bitmap when available.
        ? ((fov && typeof fov.couldSee === 'function')
            ? fov.couldSee(bx, by)
            : couldsee(map, player, bx, by))
        // C ref: linedup() uses clear_path(ax, ay, bx, by) for non-hero target.
        : m_cansee({ mx: ax, my: ay }, map, bx, by);
    if (inSight) return true;

    // C ref: hero target uses boulderhandling=2.
    const dx = Math.sign(ax - bx);
    const dy = Math.sign(ay - by);
    let cx = bx;
    let cy = by;
    let boulderspots = 0;
    do {
        cx += dx;
        cy += dy;
        if (blockingTerrainForLinedup(map, cx, cy)) return false;
        const objs = map.objectsAt?.(cx, cy) || [];
        if (objs.some((o) => o && !o.buried && o.otyp === BOULDER)) boulderspots++;
    } while (cx !== ax || cy !== ay);
    const denom = 2 + boulderspots;
    return rn2(denom) < 2;
}

// C ref: weapon.c select_rwep() — select best ranged weapon from monster inventory.
// Deterministic (no RNG). Returns the weapon object or null.
function select_rwep(mon) {
    const inv = mon.minvent || [];
    if (inv.length === 0) return null;
    for (const obj of inv) {
        if (!obj) continue;
        const od = objectData[obj.otyp];
        if (!od) continue;
        if (od.oc_class === WEAPON_CLASS) return obj;
    }
    return null;
}

function monsterUseup(mon, obj) {
    if (!mon || !obj) return;
    const inv = mon.minvent || [];
    const idx = inv.indexOf(obj);
    if (idx < 0) return;
    const qty = Number.isInteger(obj.quan) ? obj.quan : 1;
    if (qty > 1) {
        obj.quan = qty - 1;
        return;
    }
    inv.splice(idx, 1);
    if (mon.weapon === obj) mon.weapon = null;
}

// C ref: mthrowu.c monmulti() — compute multishot count.
// Consumes rnd(multishot) when multishot > 0 and quan > 1.
function monmulti(mon, otmp) {
    let multishot = 1;
    const quan = otmp.quan ?? 1;
    const od = objectData[otmp.otyp];
    if (quan > 1 && od && od.oc_class === WEAPON_CLASS && !mon.confused) {
        multishot = rnd(multishot);
    }
    if (multishot > quan) multishot = quan;
    if (multishot < 1) multishot = 1;
    return multishot;
}

function thrownObjectName(obj, player) {
    if (!obj) return 'a weapon';
    const oneShot = { ...obj, quan: 1, dknown: true };
    return doname(oneShot, player);
}

// C ref: mthrowu.c m_throw() — simulate projectile flight.
// Consumes rn2(5) at each step, plus hit/damage rolls on collision.
export function m_throw(mon, startX, startY, dx, dy, range, weapon, map, player, display, game) {
    let x = startX;
    let y = startY;
    let dropX = startX;
    let dropY = startY;

    // C ref: mthrowu.c:601 — misfire check for cursed/greased weapons
    if ((weapon.cursed || weapon.greased) && (dx || dy) && !rn2(7)) {
        dx = rn2(3) - 1;
        dy = rn2(3) - 1;
        if (!dx && !dy) {
            return { drop: true, x: startX, y: startY }; // missile drops at thrower's feet
        }
    }

    const od = objectData[weapon.otyp];

    // C ref: mthrowu.c:531-548 MT_FLIGHTCHECK — check if a cell blocks missile flight
    function flightBlocked(bx, by, pre, forcehit) {
        const nx = bx + dx, ny = by + dy;
        if (!isok(nx, ny)) return true;
        const nloc = map.at(nx, ny);
        if (!nloc) return true;
        if (IS_OBSTRUCTED(nloc.typ)) return true;
        if (IS_DOOR(nloc.typ) && (nloc.flags & (D_CLOSED | D_LOCKED))) return true;
        if (nloc.typ === IRONBARS && forcehit) return true;
        // Current-cell sink check (only in non-pre check)
        if (!pre) {
            const cloc = map.at(bx, by);
            if (cloc && cloc.typ === SINK) return true;
        }
        return false;
    }

    // C ref: mthrowu.c:618 — pre-flight check: if first cell is blocked, drop immediately
    if (flightBlocked(startX, startY, true, 0)) {
        return { drop: true, x: startX, y: startY };
    }

    // C ref: mthrowu.c:652 — main flight loop
    while (range-- > 0) {
        x += dx;
        y += dy;
        if (!isok(x, y)) break;
        const loc = map.at(x, y);
        if (!loc) break;
        if (ACCESSIBLE(loc.typ)) {
            dropX = x;
            dropY = y;
        }

        // Check for monster at this position
        const mtmp = map.monsterAt(x, y);
        if (mtmp && !mtmp.dead) {
            const mac = mtmp.mac ?? 10;
            const hitThreshold = 5 + mac;
            const dieRoll = rnd(20);
            if (hitThreshold < dieRoll) {
                if (!range) break;
            } else {
                const sdam = od ? (od.sdam || 0) : 0;
                let damage = sdam > 0 ? rnd(sdam) : 0;
                damage += (weapon.spe || 0);
                if (damage < 1) damage = 1;

                mtmp.mhp -= damage;
                if (mtmp.mhp <= 0) {
                    // C ref: mthrowu.c:459-464 — mondied() when mon_moving
                    mondead(mtmp, map);
                    map.removeMonster(mtmp);
                    const exp = (mtmp.mlevel + 1) * (mtmp.mlevel + 1);
                    player.exp += exp;
                    player.score += exp;
                    newexplevel(player, display);
                    // C ref: mon.c:3257-3259 — mondied() calls corpse_chance + make_corpse
                    const mdat2 = mons[mtmp.mndx] || {};
                    if (corpse_chance(mtmp)
                        && !(((mdat2.geno || 0) & G_NOCORPSE) !== 0)) {
                        const corpse = mkcorpstat(CORPSE, mtmp.mndx || 0, true,
                            mtmp.mx, mtmp.my, map);
                        if (corpse) corpse.age = (player.turns || 0) + 1;
                    }
                }
                break;
            }
        }

        // Check for player at this position
        if (x === player.x && y === player.y) {
            const sdam = od ? (od.sdam || 0) : 0;
            let dam = sdam > 0 ? rnd(sdam) : 0;
            dam += (weapon.spe || 0);
            if (dam < 1) dam = 1;
            const hitv = 3 - distmin(player.x, player.y, mon.mx, mon.my) + 8 + (weapon.spe || 0);
            const dieRoll = rnd(20);
            if (game && game.occupation) {
                if (game.occupation.occtxt === 'waiting' || game.occupation.occtxt === 'searching') {
                    if (display) display.putstr_message(`You stop ${game.occupation.occtxt}.`);
                }
                game.occupation = null;
                game.multi = 0;
            }
            if (player.ac + hitv <= dieRoll) {
                if (display) {
                    let missMsg = 'It misses.';
                    const verbose = game?.flags?.verbose !== false;
                    if (player.blind || !verbose) {
                        missMsg = 'It misses.';
                    } else if (player.ac + hitv <= dieRoll - 2) {
                        const objName = thrownObjectName(weapon, player);
                        const capName = objName.charAt(0).toUpperCase() + objName.slice(1);
                        missMsg = `${capName} misses you.`;
                    } else {
                        missMsg = `You are almost hit by ${thrownObjectName(weapon, player)}.`;
                    }
                    if (display.topMessage && display.messageNeedsMore
                        && Number.isInteger(display.cols)) {
                        const combined = `${display.topMessage}  ${missMsg}`;
                        if (combined.length + 9 >= display.cols) {
                            missMsg = null;
                        }
                    }
                    if (missMsg) display.putstr_message(missMsg);
                }
            } else {
                if (display) {
                    display.putstr_message(`You are hit by ${thrownObjectName(weapon, player)}!`);
                }
                if (player.takeDamage) {
                    player.takeDamage(dam, monDisplayName(mon));
                } else {
                    player.hp -= dam;
                }
                exercise(player, A_STR, false);
                break;
            }
        }

        // C ref: mthrowu.c:772-773 — forcehit + MT_FLIGHTCHECK(FALSE, forcehit)
        const forcehit = !rn2(5);
        if (!range || flightBlocked(x, y, false, forcehit)) break;
    }
    return { drop: true, x: dropX, y: dropY };
}

// C ref: mthrowu.c thrwmu() — monster throws at player.
// Returns true if the monster acted (threw something).
export function thrwmu(mon, map, player, display, game) {
    const otmp = select_rwep(mon);
    if (!otmp) return false;

    if (!linedUpToPlayer(mon, map, player)) return false;

    const targetX = Number.isInteger(mon.mux) ? mon.mux : player.x;
    const targetY = Number.isInteger(mon.muy) ? mon.muy : player.y;
    const ux0 = Number.isInteger(game?.ux0) ? game.ux0 : player.x;
    const uy0 = Number.isInteger(game?.uy0) ? game.uy0 : player.y;
    const retreating = distmin(player.x, player.y, mon.mx, mon.my)
        > distmin(ux0, uy0, mon.mx, mon.my);
    const retreatRange = BOLT_LIM - distmin(mon.mx, mon.my, targetX, targetY);
    if (retreating && retreatRange > 0 && rn2(retreatRange)) return false;

    const dm = distmin(mon.mx, mon.my, targetX, targetY);
    const multishot = monmulti(mon, otmp);
    const available = Number.isInteger(otmp.quan) ? otmp.quan : 1;
    const shots = Math.max(1, Math.min(multishot, available));

    if (display) {
        display.putstr_message(`The ${monDisplayName(mon)} throws ${thrownObjectName(otmp, player)}!`);
    }

    const ddx = Math.sign(targetX - mon.mx);
    const ddy = Math.sign(targetY - mon.my);

    for (let i = 0; i < shots; i++) {
        const projectile = {
            ...otmp,
            quan: 1,
            ox: mon.mx,
            oy: mon.my,
            invlet: null,
        };
        monsterUseup(mon, otmp);
        const result = m_throw(mon, mon.mx, mon.my, ddx, ddy, dm, projectile, map, player, display, game);
        if (result?.drop && isok(result.x, result.y)) {
            const spot = map.at(result.x, result.y);
            if (spot && ACCESSIBLE(spot.typ)) {
                projectile.ox = result.x;
                projectile.oy = result.y;
                placeFloorObject(map, projectile);
            }
        }
        if (mon.dead) break;
    }

    return true;
}

// Check if a monster has any AT_WEAP attacks (can throw weapons).
export function hasWeaponAttack(mon) {
    const attacks = mon.attacks || (mon.type && mon.type.attacks) || [];
    return attacks.some(a => a && a.type === AT_WEAP);
}

function chooseMonsterWieldWeapon(mon) {
    if (!Array.isArray(mon?.minvent)) return null;
    for (const obj of mon.minvent) {
        if (!obj || obj.oclass !== WEAPON_CLASS) continue;
        return obj;
    }
    return null;
}

export function maybeMonsterWieldBeforeAttack(mon, player, display, fov) {
    if (!hasWeaponAttack(mon)) return false;
    if (mon.weapon) return false;
    const wieldObj = chooseMonsterWieldWeapon(mon);
    if (!wieldObj) return false;
    mon.weapon = wieldObj;
    // C ref: weapon.c:888 — wield message gated by canseemon(mon)
    const visible = !fov?.canSee || (fov.canSee(mon.mx, mon.my)
        && !player?.blind && !mon.minvis);
    if (display && visible) {
        display.putstr_message(`The ${monDisplayName(mon)} wields ${thrownObjectName(wieldObj, player)}!`);
    }
    return true;
}
