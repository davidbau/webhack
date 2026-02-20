// do_wear.js -- Armor wearing/removing mechanics
// cf. do_wear.c — dowear, doputon, dotakeoff, doremring, doddoremarm, find_ac

import { nhgetch } from './input.js';
import { ARMOR_CLASS, RING_CLASS, AMULET_CLASS, objectData,
         ARM_SUIT, ARM_SHIELD, ARM_HELM, ARM_GLOVES, ARM_BOOTS, ARM_CLOAK, ARM_SHIRT } from './objects.js';
import { doname } from './mkobj.js';


// ============================================================
// 1. Armor slot mapping
// ============================================================

const ARMOR_SLOTS = {
    [ARM_SUIT]:   { prop: 'armor',   name: 'body armor' },
    [ARM_SHIELD]: { prop: 'shield',  name: 'shield' },
    [ARM_HELM]:   { prop: 'helmet',  name: 'helmet' },
    [ARM_GLOVES]: { prop: 'gloves',  name: 'gloves' },
    [ARM_BOOTS]:  { prop: 'boots',   name: 'boots' },
    [ARM_CLOAK]:  { prop: 'cloak',   name: 'cloak' },
    [ARM_SHIRT]:  { prop: 'shirt',   name: 'shirt' },
};

// ============================================================
// 2. Slot on/off effect stubs (hook points for future intrinsic effects)
// ============================================================

// TODO: cf. do_wear.c fingers_or_gloves() — "fingers" or "gloves" depending on worn gloves
// TODO: cf. do_wear.c off_msg() — message when taking off an item
// TODO: cf. do_wear.c on_msg() — message when putting on an item
// TODO: cf. do_wear.c toggle_stealth() — toggle stealth intrinsic for boots/cloak
// TODO: cf. do_wear.c toggle_displacement() — toggle displacement intrinsic for cloak

// cf. do_wear.c Boots_on/off — no-op stubs for future intrinsic effects
function Boots_on() {}
function Boots_off() {}

// cf. do_wear.c Cloak_on/off
function Cloak_on() {}
function Cloak_off() {}

// cf. do_wear.c Helmet_on/off
function Helmet_on() {}
function Helmet_off() {}
// TODO: cf. do_wear.c hard_helmet() — check if helmet is hard (non-cloth)

// cf. do_wear.c Gloves_on/off
function Gloves_on() {}
function Gloves_off() {}
// TODO: cf. do_wear.c wielding_corpse() — check if wielding a corpse (glove interaction)

// cf. do_wear.c Shield_on/off
function Shield_on() {}
function Shield_off() {}

// cf. do_wear.c Shirt_on/off
function Shirt_on() {}
function Shirt_off() {}

// cf. do_wear.c Armor_on/off (body armor / suit)
function Armor_on() {}
function Armor_off() {}
// TODO: cf. do_wear.c Armor_gone() — handle armor being destroyed while worn
// TODO: cf. do_wear.c dragon_armor_handling() — handle dragon scale mail transformation

// cf. do_wear.c Amulet_on/off
function Amulet_on() {}
function Amulet_off() {}

// cf. do_wear.c Ring_on/off
function Ring_on() {}
function Ring_off() {}
// TODO: cf. do_wear.c learnring() — learn ring type from wearing effects
// TODO: cf. do_wear.c adjust_attrib() — adjust attribute from ring effects
// TODO: cf. do_wear.c Ring_off_or_gone() — shared logic for ring removal
// TODO: cf. do_wear.c Ring_gone() — handle ring being destroyed while worn

// TODO: cf. do_wear.c Blindf_on() — apply effects when wearing a blindfold/towel
// TODO: cf. do_wear.c Blindf_off() — remove effects when taking off a blindfold/towel

const SLOT_ON = {
    [ARM_SUIT]: Armor_on,
    [ARM_SHIELD]: Shield_on,
    [ARM_HELM]: Helmet_on,
    [ARM_GLOVES]: Gloves_on,
    [ARM_BOOTS]: Boots_on,
    [ARM_CLOAK]: Cloak_on,
    [ARM_SHIRT]: Shirt_on,
};

const SLOT_OFF = {
    [ARM_SUIT]: Armor_off,
    [ARM_SHIELD]: Shield_off,
    [ARM_HELM]: Helmet_off,
    [ARM_GLOVES]: Gloves_off,
    [ARM_BOOTS]: Boots_off,
    [ARM_CLOAK]: Cloak_off,
    [ARM_SHIRT]: Shirt_off,
};


// ============================================================
// 3. Validation functions
// ============================================================

// cf. do_wear.c canwearobj() — check if player can wear this armor piece
function canwearobj(player, obj, display) {
    const sub = objectData[obj.otyp]?.sub;
    const slot = ARMOR_SLOTS[sub];
    if (!slot) return false;

    // Already wearing something in that slot?
    if (player[slot.prop]) {
        display.putstr_message(`You are already wearing ${doname(player[slot.prop], player)}.`);
        return false;
    }

    // Layering checks
    if (sub === ARM_SUIT && player.cloak) {
        display.putstr_message('You are wearing a cloak.');
        return false;
    }
    if (sub === ARM_SHIRT && (player.cloak || player.armor)) {
        if (player.cloak) {
            display.putstr_message('You are wearing a cloak.');
        } else {
            display.putstr_message('You are wearing body armor.');
        }
        return false;
    }
    // Bimanual weapon + shield
    if (sub === ARM_SHIELD && player.weapon && objectData[player.weapon.otyp]?.big) {
        display.putstr_message('You cannot wear a shield while wielding a two-handed weapon.');
        return false;
    }

    return true;
}

// cf. do_wear.c cursed() — check if item is cursed and print message
function cursed_check(obj, display) {
    if (obj && obj.cursed) {
        display.putstr_message("You can't. It is cursed.");
        obj.bknown = true;
        return true;
    }
    return false;
}

// ============================================================
// 4. Wear-state management stubs
// ============================================================

// TODO: cf. do_wear.c set_wear() — set wear-state flags on equipment
// TODO: cf. do_wear.c donning() — check if player is in process of putting on armor
// TODO: cf. do_wear.c doffing() — check if player is in process of taking off armor
// TODO: cf. do_wear.c cancel_doff() — cancel in-progress doffing
// TODO: cf. do_wear.c cancel_don() — cancel in-progress donning
// TODO: cf. do_wear.c stop_donning() — stop donning if item is taken away

// ============================================================
// 5. AC calculation
// ============================================================

// cf. do_wear.c find_ac() — recalculate player AC from all worn equipment
// C ref: ARM_BONUS(obj) = objects[otyp].a_ac + obj->spe - min(greatest_erosion, a_ac)
// Rings contribute only spe (enchantment), not base AC.
function find_ac(player) {
    let uac = 10; // base AC for human player form (mons[PM_HUMAN].ac = 10)
    const arm_bonus = (obj) => {
        if (!obj) return 0;
        const baseAc = Number(objectData[obj.otyp]?.oc1 || 0);
        const spe = Number(obj.spe || 0);
        const erosion = Math.max(Number(obj.oeroded || 0), Number(obj.oeroded2 || 0));
        return baseAc + spe - Math.min(erosion, baseAc);
    };
    uac -= arm_bonus(player.armor);   // uarm: body armor
    uac -= arm_bonus(player.cloak);   // uarmc
    uac -= arm_bonus(player.helmet);  // uarmh
    uac -= arm_bonus(player.boots);   // uarmf
    uac -= arm_bonus(player.shield);  // uarms
    uac -= arm_bonus(player.gloves);  // uarmg
    uac -= arm_bonus(player.shirt);   // uarmu
    if (player.leftRing)  uac -= Number(player.leftRing.spe  || 0);
    if (player.rightRing) uac -= Number(player.rightRing.spe || 0);
    player.ac = uac;
}

// TODO: cf. do_wear.c glibr() — slippery fingers: drop weapon/rings

// ============================================================
// 6. Utility stubs
// ============================================================

// TODO: cf. do_wear.c some_armor() — return armor worn in a given slot
// TODO: cf. do_wear.c stuck_ring() — check if ring is stuck due to gloves/etc
// TODO: cf. do_wear.c unchanger() — check if wearing an unchanging item
// TODO: cf. do_wear.c count_worn_stuff() — count number of worn items
// TODO: cf. do_wear.c armor_or_accessory_off() — take off armor or accessory

// ============================================================
// 7. Multi-item takeoff (A) stubs
// ============================================================

// TODO: cf. do_wear.c select_off() — mark item for takeoff in multi-remove
// TODO: cf. do_wear.c do_takeoff() — execute one step of multi-takeoff
// TODO: cf. do_wear.c take_off() — take off a specific item
// TODO: cf. do_wear.c better_not_take_that_off() — warn about taking off load-bearing item
// TODO: cf. do_wear.c reset_remarm() — reset multi-remove state
// TODO: cf. do_wear.c doddoremarm() — A command: take off multiple items
// TODO: cf. do_wear.c remarm_swapwep() — handle swapweapon during multi-remove
// TODO: cf. do_wear.c menu_remarm() — menu-driven multi-remove

// ============================================================
// 8. Armor destruction stubs
// ============================================================

// TODO: cf. do_wear.c wornarm_destroyed() — check if worn armor should be destroyed
// TODO: cf. do_wear.c maybe_destroy_armor() — maybe destroy armor by erosion/monster
// TODO: cf. do_wear.c destroy_arm() — destroy a worn piece of armor

// ============================================================
// 9. Stat adjustment stubs
// ============================================================

// TODO: cf. do_wear.c adj_abon() — adjust ability bonuses from armor

// ============================================================
// 10. Accessibility/getobj stubs
// ============================================================

// TODO: cf. do_wear.c inaccessible_equipment() — check if equipment is inaccessible
// TODO: cf. do_wear.c equip_ok() — general equipment validation callback
// TODO: cf. do_wear.c puton_ok() — validation for P command items
// TODO: cf. do_wear.c remove_ok() — validation for R command items
// TODO: cf. do_wear.c wear_ok() — validation for W command items
// TODO: cf. do_wear.c takeoff_ok() — validation for T command items
// TODO: cf. do_wear.c any_worn_armor_ok() — check if any worn armor is ok target
// TODO: cf. do_wear.c count_worn_armor() — count pieces of worn armor


// ============================================================
// Command handlers
// ============================================================

// Helper: collect all currently worn armor items
function getWornArmorItems(player) {
    const items = [];
    for (const sub of Object.keys(ARMOR_SLOTS)) {
        const prop = ARMOR_SLOTS[sub].prop;
        if (player[prop]) items.push(player[prop]);
    }
    return items;
}

// cf. do_wear.c dowear() — W command: wear a piece of armor
async function handleWear(player, display) {
    const wornSet = new Set(getWornArmorItems(player));
    const armor = (player.inventory || []).filter((o) => o.oclass === ARMOR_CLASS && !wornSet.has(o));
    if (armor.length === 0) {
        if (wornSet.size > 0) {
            display.putstr_message("You don't have anything else to wear.");
        } else {
            display.putstr_message('You have no armor to wear.');
        }
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`Wear what? [${armor.map(a => a.invlet).join('')}]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    const item = armor.find(a => a.invlet === c);
    if (!item) {
        display.putstr_message('Never mind.');
        return { moved: false, tookTime: false };
    }

    // Validate that we can wear this item in its slot
    if (!canwearobj(player, item, display)) {
        return { moved: false, tookTime: false };
    }

    const sub = objectData[item.otyp]?.sub;
    const slot = ARMOR_SLOTS[sub];
    player[slot.prop] = item;
    const onFn = SLOT_ON[sub];
    if (onFn) onFn();
    find_ac(player);
    display.putstr_message(`You are now wearing ${doname(item, player)}.`);
    return { moved: false, tookTime: true };
}

// cf. do_wear.c doputon() — P command: put on ring or amulet
async function handlePutOn(player, display) {
    const eligible = (player.inventory || []).filter((o) => {
        if (o.oclass === RING_CLASS && o !== player.leftRing && o !== player.rightRing) return true;
        if (o.oclass === AMULET_CLASS && o !== player.amulet) return true;
        return false;
    });
    if (eligible.length === 0) {
        display.putstr_message("You don't have anything else to put on.");
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`What do you want to put on? [${eligible.map(r => r.invlet).join('')}]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);
    const item = eligible.find(r => r.invlet === c);
    if (!item) {
        display.putstr_message('Never mind.');
        return { moved: false, tookTime: false };
    }

    if (item.oclass === RING_CLASS) {
        if (player.leftRing && player.rightRing) {
            display.putstr_message("You're already wearing two rings.");
            return { moved: false, tookTime: false };
        }
        if (!player.leftRing) player.leftRing = item;
        else player.rightRing = item;
        Ring_on();
    } else if (item.oclass === AMULET_CLASS) {
        if (player.amulet) {
            display.putstr_message("You're already wearing an amulet.");
            return { moved: false, tookTime: false };
        }
        player.amulet = item;
        Amulet_on();
    }

    find_ac(player);
    display.putstr_message(`You are now wearing ${doname(item, player)}.`);
    return { moved: false, tookTime: true };
}

// cf. do_wear.c dotakeoff() — T command: take off a piece of armor
async function handleTakeOff(player, display) {
    const worn = getWornArmorItems(player);
    if (worn.length === 0) {
        display.putstr_message("You're not wearing any armor.");
        return { moved: false, tookTime: false };
    }

    let item;
    if (worn.length === 1) {
        item = worn[0];
    } else {
        display.putstr_message(`What do you want to take off? [${worn.map(a => a.invlet).join('')}]`);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        item = worn.find(a => a.invlet === c);
        if (!item) {
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
    }

    // Layering: can't remove suit if cloak worn, can't remove shirt if cloak or suit worn
    const sub = objectData[item.otyp]?.sub;
    if (sub === ARM_SUIT && player.cloak) {
        display.putstr_message("You can't take that off while wearing a cloak.");
        return { moved: false, tookTime: false };
    }
    if (sub === ARM_SHIRT && (player.cloak || player.armor)) {
        if (player.cloak) {
            display.putstr_message("You can't take that off while wearing a cloak.");
        } else {
            display.putstr_message("You can't take that off while wearing body armor.");
        }
        return { moved: false, tookTime: false };
    }

    // Cursed check
    if (cursed_check(item, display)) {
        return { moved: false, tookTime: false };
    }

    const slot = ARMOR_SLOTS[sub];
    player[slot.prop] = null;
    const offFn = SLOT_OFF[sub];
    if (offFn) offFn();
    find_ac(player);
    display.putstr_message(`You take off ${doname(item, player)}.`);
    return { moved: false, tookTime: true };
}

// cf. do_wear.c doremring() — R command: remove ring or amulet
async function handleRemove(player, display) {
    const accessories = [];
    if (player.leftRing) accessories.push(player.leftRing);
    if (player.rightRing) accessories.push(player.rightRing);
    if (player.amulet) accessories.push(player.amulet);

    if (accessories.length === 0) {
        display.putstr_message("You aren't wearing any accessories.");
        return { moved: false, tookTime: false };
    }

    let item;
    if (accessories.length === 1) {
        item = accessories[0];
    } else {
        display.putstr_message(`What do you want to remove? [${accessories.map(a => a.invlet).join('')}]`);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        item = accessories.find(a => a.invlet === c);
        if (!item) {
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
    }

    // Cursed check
    if (cursed_check(item, display)) {
        return { moved: false, tookTime: false };
    }

    if (item === player.leftRing) {
        player.leftRing = null;
        Ring_off();
    } else if (item === player.rightRing) {
        player.rightRing = null;
        Ring_off();
    } else if (item === player.amulet) {
        player.amulet = null;
        Amulet_off();
    }

    find_ac(player);
    display.putstr_message(`You remove ${doname(item, player)}.`);
    return { moved: false, tookTime: true };
}

export {
    handleWear, handlePutOn, handleTakeOff, handleRemove, find_ac,
    canwearobj, cursed_check,
    Boots_on, Boots_off, Cloak_on, Cloak_off, Helmet_on, Helmet_off,
    Gloves_on, Gloves_off, Shield_on, Shield_off, Shirt_on, Shirt_off,
    Armor_on, Armor_off, Amulet_on, Amulet_off, Ring_on, Ring_off,
};
