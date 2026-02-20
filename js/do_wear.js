// do_wear.js -- Armor wearing/removing mechanics
// cf. do_wear.c — dowear, doputon, dotakeoff, doremring, doddoremarm, find_ac

import { nhgetch } from './input.js';
import { ARMOR_CLASS, RING_CLASS, objectData } from './objects.js';
import { doname } from './mkobj.js';


// ============================================================
// 1. Message helpers
// ============================================================

// TODO: cf. do_wear.c fingers_or_gloves() — "fingers" or "gloves" depending on worn gloves
// TODO: cf. do_wear.c off_msg() — message when taking off an item
// TODO: cf. do_wear.c on_msg() — message when putting on an item
// TODO: cf. do_wear.c toggle_stealth() — toggle stealth intrinsic for boots/cloak
// TODO: cf. do_wear.c toggle_displacement() — toggle displacement intrinsic for cloak

// ============================================================
// 2. Boots on/off
// ============================================================

// TODO: cf. do_wear.c Boots_on() — apply effects when wearing boots
// TODO: cf. do_wear.c Boots_off() — remove effects when taking off boots

// ============================================================
// 3. Cloak on/off
// ============================================================

// TODO: cf. do_wear.c Cloak_on() — apply effects when wearing a cloak
// TODO: cf. do_wear.c Cloak_off() — remove effects when taking off a cloak

// ============================================================
// 4. Helmet on/off
// ============================================================

// TODO: cf. do_wear.c Helmet_on() — apply effects when wearing a helmet
// TODO: cf. do_wear.c Helmet_off() — remove effects when taking off a helmet
// TODO: cf. do_wear.c hard_helmet() — check if helmet is hard (non-cloth)

// ============================================================
// 5. Gloves on/off
// ============================================================

// TODO: cf. do_wear.c Gloves_on() — apply effects when wearing gloves
// TODO: cf. do_wear.c wielding_corpse() — check if wielding a corpse (glove interaction)
// TODO: cf. do_wear.c Gloves_off() — remove effects when taking off gloves

// ============================================================
// 6. Shield on/off
// ============================================================

// TODO: cf. do_wear.c Shield_on() — apply effects when wearing a shield
// TODO: cf. do_wear.c Shield_off() — remove effects when taking off a shield

// ============================================================
// 7. Shirt on/off
// ============================================================

// TODO: cf. do_wear.c Shirt_on() — apply effects when wearing a shirt
// TODO: cf. do_wear.c Shirt_off() — remove effects when taking off a shirt

// ============================================================
// 8. Dragon armor
// ============================================================

// TODO: cf. do_wear.c dragon_armor_handling() — handle dragon scale mail transformation

// ============================================================
// 9. Suit on/off
// ============================================================

// TODO: cf. do_wear.c Armor_on() — apply effects when wearing body armor
// TODO: cf. do_wear.c Armor_off() — remove effects when taking off body armor
// TODO: cf. do_wear.c Armor_gone() — handle armor being destroyed while worn

// ============================================================
// 10. Amulet on/off
// ============================================================

// TODO: cf. do_wear.c Amulet_on() — apply effects when wearing an amulet
// TODO: cf. do_wear.c Amulet_off() — remove effects when taking off an amulet

// ============================================================
// 11. Ring on/off
// ============================================================

// TODO: cf. do_wear.c learnring() — learn ring type from wearing effects
// TODO: cf. do_wear.c adjust_attrib() — adjust attribute from ring effects
// TODO: cf. do_wear.c Ring_on() — apply effects when putting on a ring
// TODO: cf. do_wear.c Ring_off_or_gone() — shared logic for ring removal
// TODO: cf. do_wear.c Ring_off() — remove effects when taking off a ring
// TODO: cf. do_wear.c Ring_gone() — handle ring being destroyed while worn

// ============================================================
// 12. Blindfold on/off
// ============================================================

// TODO: cf. do_wear.c Blindf_on() — apply effects when wearing a blindfold/towel
// TODO: cf. do_wear.c Blindf_off() — remove effects when taking off a blindfold/towel

// ============================================================
// 13. Wear-state management
// ============================================================

// TODO: cf. do_wear.c set_wear() — set wear-state flags on equipment
// TODO: cf. do_wear.c donning() — check if player is in process of putting on armor
// TODO: cf. do_wear.c doffing() — check if player is in process of taking off armor
// TODO: cf. do_wear.c cancel_doff() — cancel in-progress doffing
// TODO: cf. do_wear.c cancel_don() — cancel in-progress donning
// TODO: cf. do_wear.c stop_donning() — stop donning if item is taken away

// ============================================================
// 14. Count/selection
// ============================================================

// TODO: cf. do_wear.c count_worn_stuff() — count number of worn items
// TODO: cf. do_wear.c armor_or_accessory_off() — take off armor or accessory

// ============================================================
// 15. Takeoff/remove commands
// ============================================================

// TODO: cf. do_wear.c dotakeoff() — full T command implementation
// TODO: cf. do_wear.c ia_dotakeoff() — take off specific item by invlet
// TODO: cf. do_wear.c doremring() — R command: remove ring/amulet/blindfold
// TODO: cf. do_wear.c cursed() — check if item is cursed and print message
// TODO: cf. do_wear.c armoroff() — remove a piece of armor

// ============================================================
// 16. Wearing validation
// ============================================================

// TODO: cf. do_wear.c already_wearing() — check if already wearing item of this type
// TODO: cf. do_wear.c already_wearing2() — variant check for body armor
// TODO: cf. do_wear.c canwearobj() — check if player can wear this object

// ============================================================
// 17. Wear/puton dispatch
// ============================================================

// TODO: cf. do_wear.c accessory_or_armor_on() — dispatch wearing armor or accessory
// TODO: cf. do_wear.c dowear() — full W command implementation
// TODO: cf. do_wear.c doputon() — full P command implementation

// ============================================================
// 18. AC and slippery
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
// 19. Utility for other systems
// ============================================================

// TODO: cf. do_wear.c some_armor() — return armor worn in a given slot
// TODO: cf. do_wear.c stuck_ring() — check if ring is stuck due to gloves/etc
// TODO: cf. do_wear.c unchanger() — check if wearing an unchanging item

// ============================================================
// 20. Multi-item takeoff (A)
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
// 21. Armor destruction
// ============================================================

// TODO: cf. do_wear.c wornarm_destroyed() — check if worn armor should be destroyed
// TODO: cf. do_wear.c maybe_destroy_armor() — maybe destroy armor by erosion/monster
// TODO: cf. do_wear.c destroy_arm() — destroy a worn piece of armor

// ============================================================
// 22. Stat adjustments
// ============================================================

// TODO: cf. do_wear.c adj_abon() — adjust ability bonuses from armor

// ============================================================
// 23. Accessibility/getobj
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
// Extracted handlers (stub-level implementations)
// ============================================================

// cf. do_wear.c dowear() — simplified: no slot system, no canwearobj validation
async function handleWear(player, display) {
    const wornArmor = new Set([
        player.armor,
        player.shield,
        player.helmet,
        player.gloves,
        player.boots,
        player.cloak,
    ].filter(Boolean));
    const armor = player.inventory.filter((o) => o.oclass === ARMOR_CLASS && !wornArmor.has(o));
    if (armor.length === 0) {
        if (wornArmor.size > 0) {
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
    if (item) {
        player.armor = item;
        find_ac(player);
        display.putstr_message(`You are now wearing ${item.name}.`);
        return { moved: false, tookTime: true };
    }

    display.putstr_message("Never mind.");
    return { moved: false, tookTime: false };
}

// cf. do_wear.c doputon() — simplified: rings only, no amulet/blindfold
async function handlePutOn(player, display) {
    const rings = (player.inventory || []).filter((o) => o.oclass === RING_CLASS
        && o !== player.leftRing
        && o !== player.rightRing);
    if (rings.length === 0) {
        display.putstr_message("You don't have anything else to put on.");
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`What do you want to put on? [${rings.map(r => r.invlet).join('')}]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);
    const item = rings.find(r => r.invlet === c);
    if (!item) {
        display.putstr_message('Never mind.');
        return { moved: false, tookTime: false };
    }
    if (!player.leftRing) player.leftRing = item;
    else player.rightRing = item;
    display.putstr_message(`You are now wearing ${item.name}.`);
    return { moved: false, tookTime: true };
}

// cf. do_wear.c dotakeoff() — simplified: body armor only, resets AC to 10
async function handleTakeOff(player, display) {
    if (!player.armor) {
        display.putstr_message("You're not wearing any armor.");
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`You take off ${player.armor.name}.`);
    player.armor = null;
    find_ac(player);
    return { moved: false, tookTime: true };
}

export { handleWear, handlePutOn, handleTakeOff, find_ac };
