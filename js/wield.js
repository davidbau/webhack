// wield.js -- Weapon wielding, swapping, quivering, and two-weapon combat
// cf. wield.c — setuwep, dowield, doswapweapon, chwepon, welded, twoweapon

import { nhgetch } from './input.js';
import { objectData, WEAPON_CLASS, TOOL_CLASS, GEM_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS } from './objects.js';
import { doname } from './mkobj.js';

// ============================================================
// 1. Slot setters
// ============================================================

// cf. wield.c:100 — setuwep(obj): set hero's main weapon slot
function setuwep(player, obj) {
    player.weapon = obj;
}

// cf. wield.c:280 — setuswapwep(obj): set secondary weapon slot
function setuswapwep(player, obj) {
    player.swapWeapon = obj;
}

// cf. wield.c:271 — setuqwep(obj): set quivered ammunition slot
function setuqwep(player, obj) {
    player.quiver = obj;
}

// cf. wield.c:864 — uwepgone(): force-remove main weapon (consumed/destroyed)
function uwepgone(player) {
    player.weapon = null;
}

// cf. wield.c:879 — uswapwepgone(): force-remove secondary weapon
function uswapwepgone(player) {
    player.swapWeapon = null;
}

// cf. wield.c:888 — uqwepgone(): force-remove quivered weapon
function uqwepgone(player) {
    player.quiver = null;
}

// ============================================================
// 2. Validation helpers
// ============================================================

// cf. wield.c:1042 — welded(obj): test if hero's main weapon is welded to hand
// Returns true if weapon is cursed (simplified; C checks erodeable_wep/tin_opener).
function welded(player) {
    if (player.weapon && player.weapon.cursed) {
        player.weapon.bknown = true;
        return true;
    }
    return false;
}

// cf. wield.c:1052 — weldmsg(obj): print "X is welded to your hand!" message
function weldmsg(player, display) {
    if (!player.weapon) return;
    player.weapon.bknown = true;
    display.putstr_message(`${doname(player.weapon, player)} welded to your hand!`);
}

// cf. wield.c:756 — can_twoweapon(): stub — always false
function can_twoweapon() {
    return false;
}

// ============================================================
// 3. ready_weapon — core wield logic
// ============================================================

// cf. wield.c:163 — ready_weapon(wep): perform the actual wield
function ready_weapon(player, display, wep) {
    if (wep === null) {
        if (player.weapon) {
            setuwep(player, null);
            display.putstr_message('You are bare handed.');
            return { tookTime: true };
        }
        display.putstr_message('You are already bare handed.');
        return { tookTime: false };
    }

    // Can't wield worn armor/rings/amulet
    if (wep === player.armor || wep === player.shield || wep === player.helmet
        || wep === player.gloves || wep === player.boots || wep === player.cloak
        || wep === player.amulet) {
        display.putstr_message('You cannot wield that!');
        return { tookTime: false };
    }

    // Bimanual + shield check
    if (objectData[wep.otyp]?.big && player.shield) {
        display.putstr_message('You cannot wield a two-handed weapon while wearing a shield.');
        return { tookTime: false };
    }

    setuwep(player, wep);
    display.putstr_message(`${wep.invlet} - ${doname(wep, player)}.`);
    return { tookTime: true };
}

// ============================================================
// 4. Command handlers
// ============================================================

// Helper to clear prompt line (same pattern used throughout commands.js)
function replacePromptMessage(display) {
    if (typeof display.clearRow === 'function') display.clearRow(0);
    display.topMessage = null;
    display.messageNeedsMore = false;
}

// cf. wield.c:350 — dowield(): #wield command
// Moved from commands.js handleWield
async function handleWield(player, display) {
    // Weld check
    if (welded(player)) {
        weldmsg(player, display);
        return { moved: false, tookTime: false };
    }

    const inventory = Array.isArray(player.inventory) ? player.inventory : [];
    const suggestWield = (obj) => {
        if (!obj) return false;
        if (obj.oclass === WEAPON_CLASS) return true;
        // C ref: wield.c wield_ok() includes is_weptool() in suggestions.
        return obj.oclass === TOOL_CLASS && (objectData[obj.otyp]?.sub || 0) !== 0;
    };

    // C ref: wield.c getobj() prompt format for wield command.
    const letters = inventory.filter(suggestWield).map((item) => item.invlet).join('');
    const wieldPrompt = letters.length > 0
        ? `What do you want to wield? [- ${letters} or ?*]`
        : 'What do you want to wield? [- or ?*]';
    display.putstr_message(wieldPrompt);

    while (true) {
        const ch = await nhgetch();
        let c = String.fromCharCode(ch);

        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage(display);
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') continue;

        if (c === '-') {
            replacePromptMessage(display);
            const result = ready_weapon(player, display, null);
            return { moved: false, tookTime: result.tookTime };
        }

        const item = inventory.find((o) => o.invlet === c);
        if (!item) continue;

        // C ref: wield.c dowield() — selecting uswapwep triggers doswapweapon().
        if (player.swapWeapon && item === player.swapWeapon) {
            const oldwep = player.weapon || null;
            setuwep(player, player.swapWeapon);
            setuswapwep(player, oldwep);
            replacePromptMessage(display);
            if (player.swapWeapon) {
                display.putstr_message(`${player.swapWeapon.invlet} - ${doname(player.swapWeapon, player)}.`);
            } else {
                display.putstr_message('You have no secondary weapon readied.');
            }
            return { moved: false, tookTime: true };
        }

        replacePromptMessage(display);
        // Clear from swap slot if this item was there
        if (player.swapWeapon === item) {
            setuswapwep(player, null);
        }
        const result = ready_weapon(player, display, item);
        return { moved: false, tookTime: result.tookTime };
    }
}

// cf. wield.c:456 — doswapweapon(): #swap command
// Moved from commands.js handleSwapWeapon
async function handleSwapWeapon(player, display) {
    // Weld check
    if (welded(player)) {
        weldmsg(player, display);
        return { moved: false, tookTime: false };
    }

    const oldwep = player.weapon || null;
    if (!player.swapWeapon) {
        if (!player.weapon) {
            display.putstr_message('You are already bare handed.');
            return { moved: false, tookTime: false };
        }
        display.putstr_message('You have no secondary weapon readied.');
        // C ref: doswapweapon() consumes a turn even when swap slot is empty.
        return { moved: false, tookTime: true };
    }
    setuwep(player, player.swapWeapon);
    setuswapwep(player, oldwep);
    if (player.swapWeapon) {
        display.putstr_message(`${player.swapWeapon.invlet} - ${doname(player.swapWeapon, player)}.`);
    } else {
        display.putstr_message('You have no secondary weapon readied.');
    }
    return { moved: false, tookTime: true };
}

// cf. wield.c:499+507 — dowieldquiver() / doquiver_core(): Q command
async function handleQuiver(player, display) {
    const inventory = Array.isArray(player.inventory) ? player.inventory : [];

    // C ref: wield.c ready_ok() — suggest ammo, missiles, gems; downplay launchers
    const quiverEligible = inventory.filter((obj) => {
        if (!obj) return false;
        if (obj === player.weapon) return false;
        if (obj.oclass === WEAPON_CLASS) return true;
        if (obj.oclass === GEM_CLASS) return true;
        if (obj.oclass === TOOL_CLASS) return true;
        return false;
    });

    const letters = quiverEligible.map((item) => item.invlet).join('');
    const prompt = letters.length > 0
        ? `What do you want to ready? [- ${letters} or ?*]`
        : 'What do you want to ready? [- or ?*]';
    display.putstr_message(prompt);

    while (true) {
        const ch = await nhgetch();
        let c = String.fromCharCode(ch);

        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage(display);
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') continue;

        if (c === '-') {
            replacePromptMessage(display);
            setuqwep(player, null);
            display.putstr_message('You now have no ammunition readied.');
            return { moved: false, tookTime: false };
        }

        const item = inventory.find((o) => o.invlet === c);
        if (!item) continue;

        replacePromptMessage(display);
        setuqwep(player, item);
        display.putstr_message(`${doname(item, player)} ready to be thrown.`);
        return { moved: false, tookTime: false };
    }
}

export {
    setuwep, setuswapwep, setuqwep,
    uwepgone, uswapwepgone, uqwepgone,
    welded, weldmsg, can_twoweapon,
    ready_weapon,
    handleWield, handleSwapWeapon, handleQuiver,
};
