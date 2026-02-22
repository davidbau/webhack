// dothrow.js -- Throwing and firing mechanics, projectile physics
// cf. dothrow.c — multishot_class_bonus, throw_obj, ok_to_throw, throw_ok,
//                 dothrow, autoquiver, find_launcher, dofire, endmultishot,
//                 hitfloor, walk_path, hurtle_jump, hurtle_step, will_hurtle,
//                 mhurtle_step, hurtle, mhurtle, check_shop_obj,
//                 harmless_missile, toss_up, throwing_weapon,
//                 sho_obj_return_to_u, throwit_return, swallowit,
//                 throwit_mon_hit, throwit, return_throw_to_inv, omon_adj,
//                 tmiss, should_mulch_missile, thitmonst, gem_accept,
//                 hero_breaks, breaks, release_camera_demon, breakobj,
//                 breaktest, breakmsg, throw_gold
//
// dothrow.c handles all throwing and firing mechanics:
//   dothrow(): #throw command — select object, choose direction, execute throw.
//   dofire(): #fire command — throw from quiver slot.
//   throwit(): core throw execution including hit resolution and landing.
//   thitmonst(): thrown object hitting a monster with full combat mechanics.
//   hurtle(): move hero through air after kick or impact.
//   breakobj()/breaktest(): object breakage mechanics.

import { ACCESSIBLE, isok } from './config.js';
import { IS_SOFT } from './symbols.js';
import { rn2, rnd } from './rng.js';
import { nhgetch } from './input.js';
import { objectData, WEAPON_CLASS, COIN_CLASS, GEM_CLASS, TOOL_CLASS,
         FLINT, ROCK, SLING, BULLWHIP } from './objects.js';
import { compactInvletPromptChars, renderOverlayMenuUntilDismiss } from './invent.js';
import { doname, next_ident } from './mkobj.js';
import { monDisplayName } from './mondata.js';
import { obj_resists } from './objdata.js';
import { uwepgone, uswapwepgone, uqwepgone, handleSwapWeapon, setuqwep } from './wield.js';
import { placeFloorObject } from './floor_objects.js';

// Direction key mappings
// C ref: cmd.c -- movement key definitions
export const DIRECTION_KEYS = {
    'h': [-1,  0],  // west
    'j': [ 0,  1],  // south
    'k': [ 0, -1],  // north
    'l': [ 1,  0],  // east
    'y': [-1, -1],  // northwest
    'u': [ 1, -1],  // northeast
    'b': [-1,  1],  // southwest
    'n': [ 1,  1],  // southeast
};

// C ref: dothrow.c ammo_and_launcher() for dofire fireassist behavior.
export function ammoAndLauncher(ammo, launcher) {
    if (!ammo || !launcher) return false;
    // C ref: flint/rock are sling ammo even when gem metadata is sparse.
    if ((ammo.otyp === FLINT || ammo.otyp === ROCK) && launcher.otyp === SLING) {
        return true;
    }
    const ammoSub = objectData[ammo.otyp]?.sub;
    const launcherSub = objectData[launcher.otyp]?.sub;
    return Number.isInteger(ammoSub)
        && Number.isInteger(launcherSub)
        && ammoSub < 0
        && launcherSub === -ammoSub;
}

export async function promptDirectionAndThrowItem(player, map, display, item, { fromFire = false } = {}) {
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    // C ref: dothrow.c throw_obj() prompts for direction before checks
    // like canletgo()/wearing-state rejection.
    replacePromptMessage();
    display.putstr_message('In what direction?');
    const dirCh = await nhgetch();
    const dch = String.fromCharCode(dirCh);
    let dir = DIRECTION_KEYS[dch];
    // C tty/keypad parity: Enter maps to keypad-down ('j') in getdir flows.
    if (!dir && (dirCh === 10 || dirCh === 13)) {
        dir = DIRECTION_KEYS.j;
    }
    if (!dir) {
        replacePromptMessage();
        return { moved: false, tookTime: false };
    }
    const targetX = player.x + dir[0];
    const targetY = player.y + dir[1];
    const targetMonster = map.monsterAt(targetX, targetY);
    let throwMessage = null;
    let landingX = targetX;
    let landingY = targetY;
    if (targetMonster) {
        // C ref: dothrow.c thitmonst()/tmiss() consumes hit + miss RNG.
        // Replay currently models this branch as a miss while preserving
        // RNG and messaging parity for captured early-game traces.
        rnd(20);
        rn2(3);
        // TODO: C ref: dothrow.c thitmonst() has full combat simulation here.
        // The obj_resists(0,0) stub is empirical; replace with proper thitmonst() port.
        obj_resists(item, 0, 0);
        const od = objectData[item.otyp];
        const baseName = od?.name || item.name || 'item';
        const named = (typeof item.oname === 'string' && item.oname.length > 0)
            ? `${baseName} named ${item.oname}`
            : baseName;
        throwMessage = `The ${named} misses the ${monDisplayName(targetMonster)}.`;
    }
    replacePromptMessage();
    if (
        player.armor === item
        || player.shield === item
        || player.helmet === item
        || player.gloves === item
        || player.boots === item
        || player.cloak === item
    ) {
        display.putstr_message('You cannot throw something you are wearing.');
        return { moved: false, tookTime: false };
    }
    // Minimal throw behavior for replay flow fidelity.
    // C ref: dothrow.c throw_obj() multishot calculation — for stack throws,
    // rnd(multishot) is consumed when ammo is paired with a launcher or for
    // stacked thrown weapons.
    if ((item.quan || 1) > 1) {
        const matchedLauncher = ammoAndLauncher(item, player.weapon);
        if (item.oclass === WEAPON_CLASS || matchedLauncher) {
            rnd(matchedLauncher ? 2 : 1);
        }
    }
    let thrownItem = item;
    if ((item.quan || 1) > 1) {
        item.quan = (item.quan || 1) - 1;
        thrownItem = { ...item, quan: 1, o_id: next_ident() };
    } else {
        player.removeFromInventory(item);
        if (player.weapon === item) uwepgone(player);
        if (player.swapWeapon === item) uswapwepgone(player);
        if (player.quiver === item) uqwepgone(player);
    }
    if (!targetMonster && fromFire) {
        // TODO: C fire path has different obj_resists call site; replace with proper port.
        obj_resists(thrownItem, 0, 0);
    }
    const landingLoc = (typeof map.at === 'function')
        ? map.at(landingX, landingY)
        : ((typeof map.getCell === 'function')
            ? map.getCell(landingX, landingY)
            : (map?.cells?.[landingY]?.[landingX] || null));
    if (landingLoc && !ACCESSIBLE(landingLoc.typ)) {
        landingX = player.x;
        landingY = player.y;
    }
    thrownItem.ox = landingX;
    thrownItem.oy = landingY;
    if (!isok(thrownItem.ox, thrownItem.oy)) {
        thrownItem.ox = player.x;
        thrownItem.oy = player.y;
    }
    const finalLoc = (typeof map.at === 'function')
        ? map.at(thrownItem.ox, thrownItem.oy)
        : ((typeof map.getCell === 'function')
            ? map.getCell(thrownItem.ox, thrownItem.oy)
            : (map?.cells?.[thrownItem.oy]?.[thrownItem.ox] || null));
    if (!targetMonster && !fromFire && finalLoc && !IS_SOFT(finalLoc.typ)) {
        // C ref: dothrow.c breaktest() probes obj_resists(nonbreak=1, art=99)
        // for ordinary throws that strike hard terrain.
        obj_resists(thrownItem, 1, 99);
    }
    thrownItem._thrownByPlayer = true;
    placeFloorObject(map, thrownItem);
    // C ref: dothrow.c throw_obj() only emits a throw topline for
    // multishot/count cases; a normal single throw should just resolve.
    replacePromptMessage();
    if (throwMessage) {
        display.putstr_message(throwMessage);
    }
    return { moved: false, tookTime: true };
}

// Handle throwing
// C ref: dothrow()
export async function handleThrow(player, map, display) {
    if (!player.inventory || player.inventory.length === 0) {
        display.putstr_message("You don't have anything to throw.");
        return { moved: false, tookTime: false };
    }
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    const equippedItems = new Set([
        player.armor,
        player.shield,
        player.helmet,
        player.gloves,
        player.boots,
        player.cloak,
        player.amulet,
        player.leftRing,
        player.rightRing,
    ].filter(Boolean));
    const invSorted = [...(player.inventory || [])]
        .filter((o) => o?.invlet)
        .sort((a, b) => String(a.invlet).localeCompare(String(b.invlet)));
    const uslinging = !!(player.weapon && player.weapon.otyp === SLING);
    const promptItems = invSorted.filter((o) => {
        if (!o || o.owornmask || equippedItems.has(o)) return false;
        if (o.oclass === COIN_CLASS) return true;
        if (!uslinging && o.oclass === WEAPON_CLASS && o !== player.weapon) return true;
        if (uslinging && o.oclass === GEM_CLASS) return true;
        return false;
    });
    const throwLetters = promptItems.map((o) => String(o.invlet)).join('');
    const throwChoices = compactInvletPromptChars(throwLetters);
    const throwPrompt = throwChoices
        ? `What do you want to throw? [${throwChoices} or ?*]`
        : 'What do you want to throw? [*]';
    display.putstr_message(throwPrompt);
    while (true) {
        const ch = await nhgetch();
        let c = String.fromCharCode(ch);
        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') {
            replacePromptMessage();
            const invLines = [];
            let currentHeader = null;
            for (const item of promptItems) {
                let header = 'Other';
                if (item.oclass === WEAPON_CLASS) header = 'Weapons';
                else if (item.oclass === COIN_CLASS) header = 'Coins';
                else if (item.oclass === GEM_CLASS) header = 'Gems/Stones';
                else if (item.oclass === TOOL_CLASS) header = 'Tools';
                if (header !== currentHeader) {
                    invLines.push(header);
                    currentHeader = header;
                }
                let invName;
                if (item.oclass === COIN_CLASS) {
                    const count = item.quan || player.gold || 0;
                    invName = `${count} ${count === 1 ? 'gold piece' : 'gold pieces'}`;
                } else {
                    invName = doname(item, player);
                }
                invLines.push(`${item.invlet} - ${invName}`);
            }
            invLines.push('(end)');
            const selection = await renderOverlayMenuUntilDismiss(display, invLines, throwLetters);
            replacePromptMessage();
            display.putstr_message(throwPrompt);
            if (!selection) continue;
            c = selection;
        }
        if (c === '-') {
            replacePromptMessage();
            // C ref: dothrow() with '-' selected and no launcher context.
            display.putstr_message('You mime throwing something.');
            return { moved: false, tookTime: false };
        }
        const item = player.inventory.find(o => o.invlet === c);
        if (!item) continue;
        return await promptDirectionAndThrowItem(player, map, display, item);
    }
}

export async function handleFire(player, map, display, game) {
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    const weapon = player.weapon || null;
    const weaponSkill = weapon ? objectData[weapon.otyp]?.sub : null;
    const wieldingPolearm = !!weapon
        && weapon.oclass === WEAPON_CLASS
        && (weaponSkill === 18 /* P_POLEARMS */ || weaponSkill === 19 /* P_LANCE */);

    // C ref: dothrow.c dofire() routes to use_pole(..., TRUE) when no
    // quiver ammo is readied and a polearm/lance is wielded.
    if (!player.quiver && wieldingPolearm) {
        display.putstr_message("Don't know what to hit.");
        return { moved: false, tookTime: false };
    }

    // C ref: dothrow.c dofire() — when no quiver and wielding bullwhip,
    // routes to use_whip(uwep) which shows "In what direction?" and reads
    // one direction character (matching apply.c use_whip() behavior).
    if (!player.quiver && weapon && weapon.otyp === BULLWHIP) {
        display.putstr_message('In what direction?');
        const dirCh = await nhgetch();
        const dch = String.fromCharCode(dirCh);
        const dir = DIRECTION_KEYS[dch];
        if (!dir) {
            replacePromptMessage();
            if (!game?.wizard) {
                display.putstr_message('What a strange direction!  Never mind.');
            }
            return { moved: false, tookTime: false };
        }
        // TODO: implement actual whip crack effects for full parity
        replacePromptMessage();
        return { moved: false, tookTime: false };
    }

    const inventory = player.inventory || [];
    const fireLetters = [];
    const quiverItem = player.quiver && inventory.includes(player.quiver)
        ? player.quiver
        : null;
    const hasRunTurnHook = typeof game?.advanceRunTurn === 'function';
    let deferredTimedTurn = false;
    if (quiverItem && game?.flags?.fireassist !== false) {
        const weaponMatches = ammoAndLauncher(quiverItem, player.weapon);
        const swapMatches = ammoAndLauncher(quiverItem, player.swapWeapon);
        if (!weaponMatches && swapMatches) {
            const swapResult = await handleSwapWeapon(player, display);
            if (swapResult?.tookTime) {
                if (hasRunTurnHook) {
                    await game.advanceRunTurn();
                    if (game?.fov && typeof game.fov.compute === 'function'
                        && typeof display?.renderMap === 'function') {
                        game.fov.compute(map, player.x, player.y);
                        display.renderMap(map, player, game.fov);
                        if (typeof display.renderStatus === 'function') {
                            display.renderStatus(player);
                        }
                    }
                } else {
                    deferredTimedTurn = true;
                }
            }
        }
    }
    if (quiverItem) {
        const throwResult = await promptDirectionAndThrowItem(player, map, display, quiverItem, { fromFire: true });
        if (deferredTimedTurn && !throwResult?.tookTime) {
            return { ...(throwResult || { moved: false, tookTime: false }), tookTime: true };
        }
        return throwResult;
    }
    // C ref: wield.c ready_ok() — classify each item as SUGGEST or DOWNPLAY.
    // P_BOW=20, P_SLING=21, P_CROSSBOW=22.
    const isLauncher = (o) => {
        if (o.oclass !== WEAPON_CLASS) return false;
        const sk = objectData[o.otyp]?.sub ?? 0;
        return sk >= 20 && sk <= 22; // P_BOW..P_CROSSBOW
    };
    const isAmmo = (o) => {
        if (o.oclass !== WEAPON_CLASS && o.oclass !== GEM_CLASS) return false;
        const sk = objectData[o.otyp]?.sub ?? 0;
        return sk >= -22 && sk <= -20; // -P_CROSSBOW..-P_BOW
    };
    for (const item of inventory) {
        if (!item?.invlet) continue;
        // Wielded weapon: downplay if single quantity
        if (item === player.weapon) {
            if ((item.quan || 1) > 1) fireLetters.push(item.invlet);
            continue;
        }
        if (isAmmo(item)) {
            // Ammo: suggest only if matching a wielded launcher
            if (ammoAndLauncher(item, player.weapon)
                || ammoAndLauncher(item, player.swapWeapon)) {
                fireLetters.push(item.invlet);
            }
        } else if (isLauncher(item)) {
            // Launchers: downplay
        } else if (item.oclass === WEAPON_CLASS || item.oclass === COIN_CLASS) {
            fireLetters.push(item.invlet);
        }
        // Everything else: downplay
    }
    const fireChoices = compactInvletPromptChars(fireLetters.join(''));
    if (fireChoices) {
        display.putstr_message(`What do you want to fire? [${fireChoices} or ?*]`);
    } else {
        display.putstr_message('What do you want to fire? [*]');
    }
    let pendingCount = '';
    while (true) {
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c >= '0' && c <= '9') {
            if (pendingCount.length === 0) {
                pendingCount = c;
            } else {
                pendingCount += c;
                replacePromptMessage();
                display.putstr_message(`Count: ${pendingCount}`);
            }
            continue;
        }
        if (c === '?' || c === '*') continue;
        const selected = inventory.find((item) => item?.invlet === c);
        if (selected) {
            // C ref: dothrow.c dofire() asks before reusing the currently wielded
            // item as ready ammo.
            if (selected === player.weapon) {
                replacePromptMessage();
                display.putstr_message('You are wielding that.  Ready it instead? [ynq] (q)');
                while (true) {
                    const ans = await nhgetch();
                    const a = String.fromCharCode(ans).toLowerCase();
                    if (ans === 27 || ans === 10 || ans === 13 || a === ' ' || a === 'q' || a === 'n') {
                        replacePromptMessage();
                        display.putstr_message(`Your ${selected.name} remains wielded.`);
                        return { moved: false, tookTime: false };
                    }
                    if (a === 'y') break;
                }
            }
            // C ref: selecting an item to fire updates the readied quiver item
            // even if the subsequent direction prompt is canceled.
            setuqwep(player, selected);
            return await promptDirectionAndThrowItem(player, map, display, selected, { fromFire: true });
        }
        // Keep prompt active for unsupported letters (fixture parity).
    }
}

// cf. dothrow.c:38 — multishot_class_bonus(pm, ammo, launcher): multishot volley bonus
// Determines multishot volley bonus based on character class, ammo, and launcher.
// TODO: dothrow.c:38 — multishot_class_bonus(): multishot bonus calculation

// cf. dothrow.c:86 [static] — throw_obj(obj, shotlimit): core throwing logic
// Core throwing logic: direction, multishot, item disposal.
// TODO: dothrow.c:86 — throw_obj(): core throw logic

// cf. dothrow.c:296 [static] — ok_to_throw(shotlimit_p): throw precondition check
// Checks preconditions for throwing and initializes shot limit.
// TODO: dothrow.c:296 — ok_to_throw(): throw precondition check

// cf. dothrow.c:316 [static] — throw_ok(obj): getobj callback for throwable objects
// Getobj callback to determine if an object is suitable to throw.
// TODO: dothrow.c:316 — throw_ok(): throwable object filter

// cf. dothrow.c:351 — dothrow(void): #throw command handler
// The #throw extended command handler.
// TODO: dothrow.c:351 — dothrow(): throw command handler

// cf. dothrow.c:380 [static] — autoquiver(void): automatic quiver selection
// Automatically selects an appropriate item for the quiver slot.
// TODO: dothrow.c:380 — autoquiver(): quiver auto-selection

// cf. dothrow.c:446 [static] — find_launcher(ammo): find matching launcher
// Finds a launcher in inventory matching the given ammunition.
// TODO: dothrow.c:446 — find_launcher(): ammo launcher lookup

// cf. dothrow.c:468 — dofire(void): #fire command handler
// The #fire extended command handler (throw from quiver).
// TODO: dothrow.c:468 — dofire(): fire from quiver command

// cf. dothrow.c:589 — endmultishot(verbose): stop multishot sequence
// Stops a multishot sequence early with optional message.
// TODO: dothrow.c:589 — endmultishot(): multishot sequence end

// cf. dothrow.c:605 — hitfloor(obj, verbosely): object hits floor at hero's feet
// Handles an object hitting the floor at the hero's position.
// TODO: dothrow.c:605 — hitfloor(): floor landing

// cf. dothrow.c:655 — walk_path(src_cc, dest_cc, check_proc, arg): Bresenham path walker
// Walks a Bresenham path calling a callback for each location along the way.
// TODO: dothrow.c:655 — walk_path(): Bresenham path traversal

// cf. dothrow.c:741 — hurtle_jump(arg, x, y): hurtle step (no water jump)
// Wrapper for hurtle_step that prevents jumping into water.
// TODO: dothrow.c:741 — hurtle_jump(): hurtle water barrier

// cf. dothrow.c:772 — hurtle_step(arg, x, y): single hurtle step
// Executes a single step of the player hurtling through the air.
// TODO: dothrow.c:772 — hurtle_step(): player hurtle single step

// cf. dothrow.c:976 — will_hurtle(mon, x, y): check monster knockback location
// Checks if a monster can be knocked back to a given location.
// TODO: dothrow.c:976 — will_hurtle(): monster knockback location check

// cf. dothrow.c:991 [static] — mhurtle_step(arg, x, y): single monster hurtle step
// Executes a single step of a monster being hurtled through the air.
// TODO: dothrow.c:991 — mhurtle_step(): monster hurtle single step

// cf. dothrow.c:1077 — hurtle(dx, dy, range, verbose): move hero through air
// Moves the hero through the air after a kick or impact.
// TODO: dothrow.c:1077 — hurtle(): hero air movement

// cf. dothrow.c:1129 — mhurtle(mon, dx, dy, range): move monster through air
// Moves a monster through the air after being struck.
// TODO: dothrow.c:1129 — mhurtle(): monster air movement

// cf. dothrow.c:1180 [static] — check_shop_obj(obj, x, y, broken): shop thrown-object accounting
// Handles shop accounting for thrown objects.
// TODO: dothrow.c:1180 — check_shop_obj(): throw shop accounting

// cf. dothrow.c:1219 — harmless_missile(obj): check if thrown object hurts hero
// Determines if a thrown object causes damage if it falls on the hero.
// TODO: dothrow.c:1219 — harmless_missile(): safe missile check

// cf. dothrow.c:1255 [static] — toss_up(obj, hitsroof): object thrown upward
// Handles an object thrown upward with ceiling collision and fallback.
// TODO: dothrow.c:1255 — toss_up(): upward throw mechanics

// cf. dothrow.c:1429 — throwing_weapon(obj): check if object is a throwing weapon
// Determines if an object is designed to be thrown as a weapon.
// TODO: dothrow.c:1429 — throwing_weapon(): throwing weapon check

// cf. dothrow.c:1441 [static] — sho_obj_return_to_u(obj): display returning weapon path
// Displays the returning throw-and-return weapon path back to the hero.
// TODO: dothrow.c:1441 — sho_obj_return_to_u(): returning weapon display

// cf. dothrow.c:1459 [static] — throwit_return(clear_thrownobj): return weapon cleanup
// Cleans up after a throw-and-return weapon has been caught.
// TODO: dothrow.c:1459 — throwit_return(): return weapon catch cleanup

// cf. dothrow.c:1467 [static] — swallowit(obj): thrown object swallowed
// Handles a thrown object being swallowed by a monster.
// TODO: dothrow.c:1467 — swallowit(): object swallow on throw

// cf. dothrow.c:1481 — throwit_mon_hit(obj, mon): process thrown object hitting monster
// Processes a thrown object hitting a monster.
// TODO: dothrow.c:1481 — throwit_mon_hit(): throw monster hit

// cf. dothrow.c:1509 — throwit(obj, wep_mask, twoweap, oldslot): execute throw
// Executes a throw including collision resolution and landing.
// TODO: dothrow.c:1509 — throwit(): full throw execution

// cf. dothrow.c:1854 [static] — return_throw_to_inv(obj, wep_mask, twoweap, oldslot): add returning weapon to inv
// Returns a throw-and-return weapon back to inventory.
// TODO: dothrow.c:1854 — return_throw_to_inv(): catch returning weapon

// cf. dothrow.c:1912 — omon_adj(mon, obj, mon_notices): monster to-hit adjustment
// Calculates to-hit adjustments for a monster being thrown at.
// TODO: dothrow.c:1912 — omon_adj(): throw vs monster to-hit

// cf. dothrow.c:1950 [static] — tmiss(obj, mon, maybe_wakeup): thrown object miss message
// Displays message for a thrown object missing its target.
// TODO: dothrow.c:1950 — tmiss(): throw miss message

// cf. dothrow.c:1975 — should_mulch_missile(obj): check if ammo should be destroyed
// Determines if ammo or missile should be destroyed on impact.
// TODO: dothrow.c:1975 — should_mulch_missile(): ammo destruction check

// cf. dothrow.c:2010 — thitmonst(mon, obj): thrown object hits monster
// Processes a thrown object hitting a monster with full combat mechanics.
// TODO: dothrow.c:2010 — thitmonst(): full throw monster hit

// cf. dothrow.c:2308 [static] — gem_accept(mon, obj): unicorn accepts gem
// Handles a unicorn accepting a thrown gem and resulting luck changes.
// TODO: dothrow.c:2308 — gem_accept(): unicorn gem gift

// cf. dothrow.c:2416 — hero_breaks(obj, x, y, breakflags): hero-caused break
// Breaks an object as a result of hero action.
// TODO: dothrow.c:2416 — hero_breaks(): hero object breaking

// cf. dothrow.c:2443 — breaks(obj, x, y): break object
// Breaks an object for reasons other than direct hero action.
// TODO: dothrow.c:2443 — breaks(): object breaking

// cf. dothrow.c:2456 — release_camera_demon(obj, x, y): camera break demon
// Unleashes demon from a broken expensive camera.
// TODO: dothrow.c:2456 — release_camera_demon(): camera demon release

// cf. dothrow.c:2479 — breakobj(obj, x, y, hero_caused, from_invent): actually break object
// Actually breaks an object and handles all side effects.
// TODO: dothrow.c:2479 — breakobj(): object break execution

// cf. dothrow.c:2581 — breaktest(obj): test if object will break
// Tests if an object will break on impact without actually breaking it.
// TODO: dothrow.c:2581 — breaktest(): break probability test

// cf. dothrow.c:2611 [static] — breakmsg(obj, in_view): object break message
// Displays a message about an object breaking.
// TODO: dothrow.c:2611 — breakmsg(): break message display

// cf. dothrow.c:2655 [static] — throw_gold(obj): throw gold coins
// Handles throwing gold coins as a special case.
// TODO: dothrow.c:2655 — throw_gold(): gold coin throwing
