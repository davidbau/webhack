// do.js -- Miscellaneous player actions
// cf. do.c — dodrop, dodown, doup, flooreffects, goto_level, donull, dowipe

import { nhgetch, ynFunction } from './input.js';
import { STAIRS } from './config.js';
import { COIN_CLASS } from './objects.js';
import { doname } from './mkobj.js';
import { placeFloorObject } from './floor_objects.js';
import { uwepgone, uswapwepgone, uqwepgone } from './wield.js';
import { observeObject } from './discovery.js';
import { compactInvletPromptChars, buildInventoryOverlayLines, renderOverlayMenuUntilDismiss } from './invent.js';


// ============================================================
// Pickup message helpers (used by handlePickup in commands.js)
// ============================================================

export function formatGoldPickupMessage(gold, player) {
    const count = gold?.quan || 1;
    const plural = count === 1 ? '' : 's';
    const total = player?.gold || count;
    if (total !== count) {
        return `$ - ${count} gold piece${plural} (${total} in total).`;
    }
    return `$ - ${count} gold piece${plural}.`;
}

export function formatInventoryPickupMessage(pickedObj, inventoryObj, player) {
    const pickedCount = Number(pickedObj?.quan || 1);
    const total = Number(inventoryObj?.quan || pickedCount);
    const slot = String(inventoryObj?.invlet || pickedObj?.invlet || '?');
    let detail = doname(pickedObj, null);
    if (player?.quiver === inventoryObj) {
        detail += ' (at the ready)';
    }
    if (total > pickedCount) {
        detail += ` (${total} in total)`;
    }
    return `${slot} - ${detail}.`;
}


// ============================================================
// 1. Drop mechanics
// ============================================================

// TODO: cf. do.c dodrop() — full drop command (menu_drop, count handling)
// TODO: cf. do.c drop() — drop a single object
// TODO: cf. do.c dropx() — drop helper with floor effects
// TODO: cf. do.c dropy() — place object on floor at hero location
// TODO: cf. do.c dropz() — drop into water/lava
// TODO: cf. do.c canletgo() — check if object can be released (cursed ball etc)
// TODO: cf. do.c doddrop() — drop from inventory prompt
// TODO: cf. do.c menu_drop() — menu-driven multi-drop
// TODO: cf. do.c menudrop_split() — split stack for partial drop
// TODO: cf. do.c better_not_try_to_drop_that() — warn about dropping quest artifact etc

// Handle dropping an item
// C ref: do.c dodrop()
export async function handleDrop(player, map, display) {
    if (player.inventory.length === 0) {
        display.putstr_message("You don't have anything to drop.");
        return { moved: false, tookTime: false };
    }

    const dropChoices = compactInvletPromptChars(player.inventory.map((o) => o.invlet).join(''));
    let countMode = false;
    let countDigits = '';
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    while (true) {
        replacePromptMessage();
        if (countMode && countDigits.length > 1) {
            display.putstr_message(`Count: ${countDigits}`);
        } else {
            display.putstr_message(`What do you want to drop? [${dropChoices} or ?*]`);
        }
        const ch = await nhgetch();
        let c = String.fromCharCode(ch);
        if (ch === 22) { // Ctrl+V
            countMode = true;
            countDigits = '';
            continue;
        }
        if (countMode && c >= '0' && c <= '9') {
            countDigits += c;
            continue;
        }
        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') {
            replacePromptMessage();
            const invLines = buildInventoryOverlayLines(player);
            const selection = await renderOverlayMenuUntilDismiss(display, invLines, dropChoices);
            if (!selection) continue;
            c = selection;
        }

        const item = player.inventory.find(o => o.invlet === c);
        if (!item) continue;

        const isWornArmor =
            player.armor === item
            || player.shield === item
            || player.helmet === item
            || player.gloves === item
            || player.boots === item
            || player.cloak === item
            || player.amulet === item;
        if (isWornArmor) {
            replacePromptMessage();
            display.putstr_message('You cannot drop something you are wearing.');
            return { moved: false, tookTime: false };
        }

        // Unequip weapon slots if dropping the item.
        if (player.weapon === item) uwepgone(player);
        if (player.swapWeapon === item) uswapwepgone(player);
        if (player.quiver === item) uqwepgone(player);

        player.removeFromInventory(item);
        item.ox = player.x;
        item.oy = player.y;
        placeFloorObject(map, item);
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
        display.putstr_message(`You drop ${doname(item, null)}.`);
        return { moved: false, tookTime: true };
    }
}


// ============================================================
// 2. Floor effects
// ============================================================

// TODO: cf. do.c boulder_hits_pool() — boulder falls into pool/lava/moat
// TODO: cf. do.c flooreffects() — effects of object landing on floor (sink, altar, etc)
// TODO: cf. do.c obj_no_longer_held() — cleanup when object leaves inventory


// ============================================================
// 3. Altar/sink/fountain interactions
// ============================================================

// TODO: cf. do.c doaltarobj() — drop object on altar (BUC identification)
// TODO: cf. do.c trycall() — prompt to name object class after altar drop
// TODO: cf. do.c polymorph_sink() — polymorph effect at kitchen sink
// TODO: cf. do.c teleport_sink() — teleportation effect at kitchen sink
// TODO: cf. do.c dosinkring() — drop ring into kitchen sink effects


// ============================================================
// 4. Stair commands
// ============================================================

// TODO: cf. do.c u_stuck_cannot_go() — check if engulfed/grabbed preventing movement

// Handle going downstairs
// C ref: do.c dodown()
export async function handleDownstairs(player, map, display, game) {
    const loc = map.at(player.x, player.y);
    if (!loc || loc.typ !== STAIRS || loc.flags !== 0) {
        display.putstr_message("You can't go down here.");
        return { moved: false, tookTime: false };
    }

    // Go to next level
    const newDepth = player.dungeonLevel + 1;
    if (newDepth > player.maxDungeonLevel) {
        player.maxDungeonLevel = newDepth;
    }
    // Generate new level (changeLevel sets player.dungeonLevel)
    game.changeLevel(newDepth, 'down');
    return { moved: false, tookTime: true };
}

// Handle going upstairs
// C ref: do.c doup()
export async function handleUpstairs(player, map, display, game) {
    const loc = map.at(player.x, player.y);
    if (!loc || loc.typ !== STAIRS || loc.flags !== 1) {
        display.putstr_message("You can't go up here.");
        return { moved: false, tookTime: false };
    }

    if (player.dungeonLevel <= 1) {
        const ans = await ynFunction('Escape the dungeon?', 'yn', 'n'.charCodeAt(0), display);
        if (String.fromCharCode(ans) === 'y') {
            game.gameOver = true;
            game.gameOverReason = 'escaped';
            player.deathCause = 'escaped';
            display.putstr_message('You escape the dungeon...');
        }
        return { moved: false, tookTime: false };
    }

    const newDepth = player.dungeonLevel - 1;
    game.changeLevel(newDepth, 'up');
    return { moved: false, tookTime: true };
}


// ============================================================
// 5. Level transitions
// ============================================================

// TODO: cf. do.c goto_level() — change dungeon level (main level transition logic)
// TODO: cf. do.c schedule_goto() — schedule a deferred level change
// TODO: cf. do.c deferred_goto() — execute a scheduled level change
// TODO: cf. do.c save_currentstate() — save current level state before transition
// TODO: cf. do.c currentlevel_rewrite() — rewrite current level after transition
// TODO: cf. do.c badspot() — check if landing spot is unsuitable
// TODO: cf. do.c u_collide_m() — handle hero colliding with monster on arrival
// TODO: cf. do.c familiar_level_msg() — "You have a sense of déjà vu" message
// TODO: cf. do.c final_level() — handle arrival on the Astral Plane
// TODO: cf. do.c hellish_smoke_mesg() — Gehennom smoke flavor messages
// TODO: cf. do.c temperature_change_msg() — temperature change on level transition
// TODO: cf. do.c maybe_lvltport_feedback() — feedback after level teleport


// ============================================================
// 6. Corpse revival
// ============================================================

// TODO: cf. do.c revive_corpse() — revive a corpse into a monster
// TODO: cf. do.c revive_mon() — internal revive helper
// TODO: cf. do.c zombify_mon() — turn corpse into zombie


// ============================================================
// 7. Null/wait/wipe
// ============================================================

// TODO: cf. do.c donull() — do nothing (wait/search command)
// TODO: cf. do.c wipeoff() — wipe face while blinded (continuation)
// TODO: cf. do.c dowipe() — start wiping face
// TODO: cf. do.c cmd_safety_prevention() — prevent dangerous commands
// TODO: cf. do.c danger_uprops() — check dangerous hero properties
// TODO: cf. do.c engulfer_digests_food() — engulfing monster digests held food


// ============================================================
// 8. Wounded legs
// ============================================================

// TODO: cf. do.c legs_in_no_shape() — check if legs are too wounded to act
// TODO: cf. do.c set_wounded_legs() — set wounded legs condition
// TODO: cf. do.c heal_legs() — heal wounded legs
