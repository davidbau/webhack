// invent.js -- Inventory management
// cf. invent.c — ddoinv, display_inventory, display_pickinv, compactify, getobj, askchain

import { nhgetch, getlin } from './input.js';
import { COLNO, STATUS_ROW_1 } from './config.js';
import { objectData, WEAPON_CLASS, FOOD_CLASS, WAND_CLASS, SPBOOK_CLASS,
         FLINT, ROCK, SLING, MAGIC_MARKER, COIN_CLASS } from './objects.js';
import { doname, xname } from './mkobj.js';
import { promptDirectionAndThrowItem, ammoAndLauncher } from './dothrow.js';


// ============================================================
// Sort / classify helpers
// cf. invent.c — reorder_invent, sortloot, etc.
// ============================================================

// C ref: invent.c invletter_value() — sort order for inventory letters
function invletSortValue(ch) {
    if (ch === '$') return 0;
    if (ch >= 'a' && ch <= 'z') return ch.charCodeAt(0);
    if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) + 100;
    if (ch === '#') return 1000;
    return 2000 + ch.charCodeAt(0);
}

// C ref: invent.c compactify() — compress inventory letter list for prompts
export function compactInvletPromptChars(chars) {
    if (!chars) return '';
    const sorted = [...new Set(chars.split(''))].sort((a, b) => invletSortValue(a) - invletSortValue(b));
    if (sorted.length <= 5) return sorted.join('');
    const out = [];
    let i = 0;
    while (i < sorted.length) {
        const start = sorted[i];
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1].charCodeAt(0) === sorted[j].charCodeAt(0) + 1) {
            j++;
        }
        const runLen = j - i + 1;
        if (runLen >= 3) {
            out.push(start, '-', sorted[j]);
        } else {
            for (let k = i; k <= j; k++) out.push(sorted[k]);
        }
        i = j + 1;
    }
    return out.join('');
}

// C ref: invent.c currency() — pluralize gold currency name
export function currency(amount) {
    return amount === 1 ? 'zorkmid' : 'zorkmids';
}

// C ref: invent.c display_inventory() / display_pickinv()
export function buildInventoryOverlayLines(player) {
    const CLASS_NAMES = {
        1: 'Weapons', 2: 'Armor', 3: 'Rings', 4: 'Amulets',
        5: 'Tools', 6: 'Comestibles', 7: 'Potions', 8: 'Scrolls',
        9: 'Spellbooks', 10: 'Wands', 11: 'Coins', 12: 'Gems/Stones',
    };
    const INV_ORDER = [11, 4, 1, 2, 6, 8, 9, 7, 3, 10, 5, 12, 13, 14, 15];

    const groups = {};
    for (const item of player.inventory || []) {
        const cls = item?.oclass;
        if (!cls) continue;
        if (!groups[cls]) groups[cls] = [];
        groups[cls].push(item);
    }

    const lines = [];
    for (const cls of INV_ORDER) {
        if (cls === 11 && !groups[cls] && (player.gold || 0) > 0) {
            const gold = player.gold || 0;
            const goldLabel = gold === 1 ? 'gold piece' : 'gold pieces';
            lines.push('Coins');
            lines.push(`$ - ${gold} ${goldLabel}`);
            continue;
        }
        if (!groups[cls]) continue;
        lines.push(CLASS_NAMES[cls] || 'Other');
        for (const item of groups[cls]) {
            const named = doname(item, player);
            const invName = (item.oclass === WEAPON_CLASS)
                ? named.replace('(wielded)', '(weapon in right hand)')
                : named;
            lines.push(`${item.invlet} - ${invName}`);
        }
    }
    lines.push('(end)');
    return lines;
}

function buildInventoryPages(lines, rows = STATUS_ROW_1) {
    const contentRows = Math.max(1, rows - 1); // reserve one row for "--More--"
    const pages = [];
    for (let i = 0; i < lines.length; i += contentRows) {
        const chunk = lines.slice(i, i + contentRows);
        const hasMore = i + contentRows < lines.length;
        pages.push(hasMore ? [...chunk, '--More--'] : chunk);
    }
    return pages.length > 0 ? pages : [['--More--']];
}

function clearInventoryOverlayArea(display, lines = []) {
    if (!display || !Number.isInteger(display.rows) || !Number.isInteger(display.cols)) return;
    if (!Number.isInteger(STATUS_ROW_1)) return;
    let maxcol = 0;
    for (const line of lines) {
        const len = String(line || '').length;
        if (len > maxcol) maxcol = len;
    }
    const menuOffx = Math.max(10, Math.min(display.cols, display.cols - maxcol - 2));
    const menuRows = Math.min(STATUS_ROW_1, display.rows);
    if (typeof display.setCell === 'function') {
        for (let r = 0; r < menuRows; r++) {
            for (let col = menuOffx; col < display.cols; col++) {
                display.setCell(col, r, ' ', 7, 0);
            }
        }
        return;
    }
    if (typeof display.clearRow === 'function') {
        for (let r = 0; r < menuRows; r++) {
            display.clearRow(r);
        }
    }
}

function drawInventoryPage(display, lines) {
    clearInventoryOverlayArea(display, lines);
    if (typeof display.renderOverlayMenu === 'function') {
        display.renderOverlayMenu(lines);
    } else {
        display.renderChargenMenu(lines, false);
    }
}

function isMenuDismissKey(ch) {
    return ch === 32 || ch === 27 || ch === 10 || ch === 13;
}

export async function renderOverlayMenuUntilDismiss(display, lines, allowedSelectionChars = '') {
    const allowedSelections = new Set((allowedSelectionChars || '').split(''));
    let menuOffx = null;
    if (typeof display.renderOverlayMenu === 'function') {
        menuOffx = display.renderOverlayMenu(lines);
    } else {
        menuOffx = display.renderChargenMenu(lines, false);
    }

    let selection = null;
    while (true) {
        const ch = await nhgetch();
        if (isMenuDismissKey(ch)) break;
        const c = String.fromCharCode(ch);
        if (allowedSelections.has(c)) {
            selection = c;
            break;
        }
    }

    const menuRows = Math.min(lines.length, STATUS_ROW_1);
    if (typeof display.setCell === 'function'
        && Number.isInteger(display.cols)
        && Number.isInteger(menuOffx)) {
        for (let r = 0; r < menuRows; r++) {
            for (let col = menuOffx; col < display.cols; col++) {
                display.setCell(col, r, ' ', 7, 0);
            }
        }
    } else if (typeof display.clearRow === 'function') {
        for (let r = 0; r < menuRows; r++) {
            display.clearRow(r);
        }
    }

    return selection;
}

// Handle inventory display
// C ref: invent.c ddoinv()
export async function handleInventory(player, display, game) {
    if (player.inventory.length === 0 && (player.gold || 0) <= 0) {
        display.putstr_message('Not carrying anything.');
        return { moved: false, tookTime: false };
    }

    const lines = buildInventoryOverlayLines(player);
    const pages = buildInventoryPages(lines, STATUS_ROW_1);
    let pageIndex = 0;

    drawInventoryPage(display, pages[pageIndex] || []);
    const invByLetter = new Map();
    for (const item of player.inventory || []) {
        if (item?.invlet) invByLetter.set(String(item.invlet), item);
    }
    const clearTopline = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        if (display && Object.hasOwn(display, 'topMessage')) display.topMessage = null;
        if (display && Object.hasOwn(display, 'messageNeedsMore')) display.messageNeedsMore = false;
    };
    // C tty/menu parity: inventory stays up until an explicit dismissal key.
    // Non-dismiss keys can be consumed without closing the menu frame.
    while (true) {
        const ch = await nhgetch();
        // C tty parity: space advances pages when present; otherwise it
        // dismisses the inventory only at the end of the final page.
        if (ch === 32) {
            if (pageIndex + 1 < pages.length) {
                pageIndex++;
                drawInventoryPage(display, pages[pageIndex] || []);
                continue;
            }
            break;
        }
        if (ch === 62) { // '>'
            if (pageIndex + 1 < pages.length) {
                pageIndex++;
                drawInventoryPage(display, pages[pageIndex] || []);
            }
            continue;
        }
        if (ch === 98 && pageIndex > 0) { // b
            pageIndex--;
            drawInventoryPage(display, pages[pageIndex] || []);
            continue;
        }
        if (ch === 60 && pageIndex > 0) { // '<'
            pageIndex--;
            drawInventoryPage(display, pages[pageIndex] || []);
            continue;
        }
        if (ch === 94 && pageIndex > 0) { // '^'
            pageIndex = 0;
            drawInventoryPage(display, pages[pageIndex] || []);
            continue;
        }
        if (ch === 124 && pageIndex + 1 < pages.length) { // '|'
            pageIndex = pages.length - 1;
            drawInventoryPage(display, pages[pageIndex] || []);
            continue;
        }
        if (ch === 27 || ch === 10 || ch === 13) break;
        const c = String.fromCharCode(ch);
        if (c === ':') {
            // C tty menu parity: ':' enters in-menu incremental search.
            // We keep menu rows in place and update only topline prompt text.
            await getlin('Search for: ', display);
            continue;
        }
        const selected = invByLetter.get(c);
        if (selected) {
            const baseName = xname({ ...selected, quan: 1 });
            const noun = xname(selected);
            const lowerBaseName = baseName.toLowerCase();
            const isLightSource = (
                lowerBaseName === 'oil lamp'
                || lowerBaseName === 'brass lantern'
                || lowerBaseName === 'magic lamp'
                || lowerBaseName === 'wax candle'
                || lowerBaseName === 'tallow candle'
            );
            const isRubbableLamp = (lowerBaseName === 'oil lamp' || lowerBaseName === 'magic lamp');
            const isWornArmor = (
                selected === player.armor
                || selected === player.shield
                || selected === player.helmet
                || selected === player.gloves
                || selected === player.boots
                || selected === player.cloak
            );
            const stackCanShoot = ammoAndLauncher(selected, player.weapon);
            let menuOffx = 34;
            const displayCols = Number.isInteger(display.cols) ? display.cols : COLNO;
            if (typeof display.setCell === 'function'
                && Number.isInteger(displayCols)
                && Number.isInteger(display.rows)) {
                let maxcol = 0;
                for (const line of lines) {
                    if (line.length > maxcol) maxcol = line.length;
                }
                menuOffx = Math.max(10, displayCols - maxcol - 2);
            }
            const rawActions = ((selected.quan || 1) > 1)
                ? (() => {
                    const stackUsesThrowMenu = (selected.oclass === WEAPON_CLASS
                        || selected.otyp === FLINT
                        || selected.otyp === ROCK);
                    if (stackUsesThrowMenu) {
                        const actions = [];
                        if (selected === player.quiver) {
                            actions.push("- - Quiver '-' to un-ready these items");
                        }
                        actions.push(`c - Name this stack of ${noun}`);
                        actions.push('d - Drop this stack');
                        actions.push('E - Write on the ground with one of these items');
                        actions.push(stackCanShoot
                            ? `f - Shoot one of these with your wielded ${xname({ ...player.weapon, quan: 1 })}`
                            : 'f - Throw one of these');
                        actions.push('i - Adjust inventory by assigning new letter');
                        actions.push('I - Adjust inventory by splitting this stack');
                        if (selected.otyp === FLINT || selected.otyp === ROCK) {
                            actions.push('R - Rub something on this stone');
                        }
                        actions.push(stackCanShoot
                            ? "t - Shoot one of these (same as 'f')"
                            : "t - Throw one of these (same as 'f')");
                        actions.push('w - Wield this stack in your hands');
                        actions.push('/ - Look up information about these');
                        actions.push('(end)');
                        return actions;
                    }
                    const actions = [
                        `c - Name this stack of ${noun}`,
                        'd - Drop this stack',
                        'i - Adjust inventory by assigning new letter',
                        'I - Adjust inventory by splitting this stack',
                        't - Throw one of these',
                        'w - Wield this stack in your hands',
                        '/ - Look up information about these',
                        '(end)',
                    ];
                    if (selected.oclass === FOOD_CLASS) {
                        actions.splice(2, 0, 'e - Eat one of these');
                    }
                    return actions;
                })()
                : (selected.oclass === SPBOOK_CLASS
                    ? [
                        `c - Name this specific ${noun}`,
                        'd - Drop this item',
                        'i - Adjust inventory by assigning new letter',
                        'r - Study this spellbook',
                        't - Throw this item',
                        'w - Wield this item in your hands',
                        '/ - Look up information about this',
                        '(end)',
                    ]
                : ((selected === player.weapon && selected.oclass === WEAPON_CLASS)
                    ? [
                        "- - Wield '-' to un-wield this weapon",
                        `c - Name this specific ${noun}`,
                        'd - Drop this item',
                        'E - Engrave on the floor with this item',
                        'i - Adjust inventory by assigning new letter',
                        "Q - Quiver this item for easy throwing with 'f'ire",
                        't - Throw this item',
                        'x - Ready this as an alternate weapon',
                        '/ - Look up information about this',
                        '(end)',
                    ]
                    : (isWornArmor
                        ? [
                            `c - Name this specific ${noun}`,
                            'i - Adjust inventory by assigning new letter',
                            'T - Take off this armor',
                            '/ - Look up information about this',
                            '(end)',
                        ]
                        : (selected.oclass === WAND_CLASS
                        ? [
                            'a - Break this wand',
                            `c - Name this specific ${noun}`,
                            'd - Drop this item',
                            'E - Engrave on the floor with this item',
                            'i - Adjust inventory by assigning new letter',
                            't - Throw this item',
                            'w - Wield this item in your hands',
                            'z - Zap this wand to release its magic',
                            '/ - Look up information about this',
                            '(end)',
                        ]
                    : [
                        ...(selected.otyp === MAGIC_MARKER
                            ? ['a - Write on something with this marker']
                            : isLightSource
                            ? [selected.lamplit
                                ? 'a - Snuff out this light source'
                                : 'a - Light this light source']
                            : baseName.toLowerCase() === 'stethoscope'
                            ? ['a - Listen through the stethoscope']
                            : []),
                        `c - Name this specific ${noun}`,
                        'd - Drop this item',
                        ...(selected.otyp === MAGIC_MARKER
                            ? ['E - Scribble graffiti on the floor']
                            : []),
                        'i - Adjust inventory by assigning new letter',
                        ...(isRubbableLamp ? [`R - Rub this ${noun}`] : []),
                        't - Throw this item',
                        'w - Wield this item in your hands',
                        '/ - Look up information about this',
                        '(end)',
                    ]))));

            const promptText = `Do what with the ${noun}?`;
            const maxAction = rawActions.reduce((m, line) => Math.max(m, line.length), promptText.length);
            menuOffx = Math.max(10, displayCols - maxAction - 2);
            const pad = ' '.repeat(menuOffx);
            const stackActions = rawActions.map((line) => `${pad}${line}`);
            const actionPrompt = `${pad}${promptText}`;
            if (game && typeof game.renderCurrentScreen === 'function') {
                game.renderCurrentScreen();
            }
            if (typeof display.setCell === 'function'
                && Number.isInteger(display.cols)
                && Number.isInteger(display.rows)) {
                // Clear only the rows we will repaint for this submenu so
                // underlying map glyphs below remain visible, matching tty flow.
                const maxActionRow = Math.min(STATUS_ROW_1 - 1, stackActions.length + 1);
                for (let r = 0; r <= maxActionRow; r++) {
                    for (let col = menuOffx; col < display.cols; col++) {
                        display.setCell(col, r, ' ', 7, 0);
                    }
                }
            }
            if (typeof display.putstr === 'function' && typeof display.clearRow === 'function') {
                display.clearRow(0);
                display.putstr(0, 0, pad, 7, 0);
                display.putstr(menuOffx, 0, promptText, 7, 1);
                if (display && Object.hasOwn(display, 'topMessage')) display.topMessage = actionPrompt;
                if (display && Object.hasOwn(display, 'messageNeedsMore')) display.messageNeedsMore = false;
            } else {
                display.putstr_message(actionPrompt);
            }
            if (typeof display.putstr === 'function') {
                for (let i = 0; i < stackActions.length; i++) {
                    if (typeof display.clearRow === 'function') display.clearRow(i + 2);
                    display.putstr(0, i + 2, stackActions[i]);
                }
            }
            const actionKeys = new Set(rawActions.map((line) => String(line || '').charAt(0)));
            while (true) {
                const actionCh = await nhgetch();
                if (actionCh === 32 || actionCh === 27 || actionCh === 10 || actionCh === 13) {
                    if (typeof display.clearRow === 'function') {
                        for (let i = 0; i < stackActions.length; i++) {
                            display.clearRow(i + 2);
                        }
                    }
                    clearTopline();
                    return { moved: false, tookTime: false };
                }
                const actionKey = String.fromCharCode(actionCh);
                if (!actionKeys.has(actionKey)) continue;
                if (typeof display.clearRow === 'function') {
                    for (let i = 0; i < stackActions.length; i++) {
                        display.clearRow(i + 2);
                    }
                }
                clearTopline();
                if ((actionKey === 'f' || actionKey === 't') && game?.map) {
                    return await promptDirectionAndThrowItem(
                        player,
                        game.map,
                        display,
                        selected,
                        { fromFire: stackCanShoot }
                    );
                }
                if (actionKey === 'i') {
                    // cf. invent.c doorganize() / #adjust — reassign inventory letter
                    if (game && typeof game.renderCurrentScreen === 'function') {
                        game.renderCurrentScreen();
                    }
                    const inv = player.inventory || [];
                    const usedLetters = new Set(inv.map(o => o.invlet));
                    // Build available-letter string for prompt
                    const allLetters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    let availStr = '';
                    {
                        let i = 0;
                        while (i < allLetters.length) {
                            const ch = allLetters[i];
                            if (!usedLetters.has(ch) || ch === selected.invlet) {
                                // Find run of consecutive available letters
                                let j = i;
                                while (j + 1 < allLetters.length
                                    && (!usedLetters.has(allLetters[j + 1]) || allLetters[j + 1] === selected.invlet)) {
                                    j++;
                                }
                                if (availStr) availStr += '';
                                if (j - i >= 2) {
                                    availStr += `${allLetters[i]}-${allLetters[j]}`;
                                } else {
                                    for (let k = i; k <= j; k++) availStr += allLetters[k];
                                }
                                i = j + 1;
                            } else {
                                i++;
                            }
                        }
                    }
                    const adjustPrompt = `Adjust letter to what [${availStr}] (? see used letters)?`;
                    display.putstr_message(adjustPrompt);
                    const adjCh = await nhgetch();
                    const adjChar = String.fromCharCode(adjCh);
                    if (adjCh === 27 || adjCh === 10 || adjCh === 13 || adjCh === 32) {
                        clearTopline();
                        display.putstr_message('Never mind.');
                        return { moved: false, tookTime: false };
                    }
                    if (/^[a-zA-Z]$/.test(adjChar)) {
                        // Swap if another item has that letter
                        const other = inv.find(o => o !== selected && o.invlet === adjChar);
                        if (other) {
                            other.invlet = selected.invlet;
                        }
                        selected.invlet = adjChar;
                    }
                    clearTopline();
                    return { moved: false, tookTime: false };
                }
                if (actionKey === 'c') {
                    if (game && typeof game.renderCurrentScreen === 'function') {
                        game.renderCurrentScreen();
                    }
                    const namedInput = await getlin(`What do you want to name this ${baseName}? `, display);
                    if (namedInput !== null) {
                        const nextName = namedInput.trim();
                        selected.oname = nextName;
                    }
                    clearTopline();
                }
                return { moved: false, tookTime: false };
            }
        }
    }
    clearTopline();

    return { moved: false, tookTime: false };
}


// ============================================================
// TODO stubs — functions from invent.c not yet implemented
// ============================================================

// --- 1. Sort / classify ---
// TODO: cf. invent.c inuse_classify() — classify object as worn/wielded for loot sorting
// TODO: cf. invent.c loot_classify() — classify object for loot menu grouping
// TODO: cf. invent.c loot_xname() — extended name for loot menu display
// TODO: cf. invent.c sortloot_cmp() — comparison function for sortloot
// TODO: cf. invent.c sortloot() — sort a chain of objects for display
// TODO: cf. invent.c unsortloot() — free sorted loot list
// TODO: cf. invent.c reorder_invent() — reorder hero inventory by class

// --- 2. Inventory add / remove ---
// TODO: cf. invent.c assigninvlet() — assign an inventory letter to an object
// TODO: cf. invent.c merge_choice() — ask player about merging with existing stack
// TODO: cf. invent.c merged() — check and perform object merging
// TODO: cf. invent.c addinv_core0() — core add-to-inventory (phase 0)
// TODO: cf. invent.c addinv_core1() — core add-to-inventory (phase 1, assign letter)
// TODO: cf. invent.c addinv_core2() — core add-to-inventory (phase 2, merge)
// TODO: cf. invent.c addinv() — add object to hero inventory
// TODO: cf. invent.c addinv_before() — add object before a specific inventory item
// TODO: cf. invent.c addinv_nomerge() — add object without attempting merge
// TODO: cf. invent.c carry_obj_effects() — side effects of carrying an object
// TODO: cf. invent.c hold_another_object() — check if hero can hold another object

// --- 3. Object consumption ---
// TODO: cf. invent.c useupall() — consume entire stack of an object
// TODO: cf. invent.c useup() — consume one item from a stack
// TODO: cf. invent.c consume_obj_charge() — consume a charge from a wand/tool
// TODO: cf. invent.c useupf() — consume one item from floor stack

// --- 4. Free / delete ---
// TODO: cf. invent.c freeinv_core() — core free-from-inventory
// TODO: cf. invent.c freeinv() — remove object from hero inventory chain
// TODO: cf. invent.c delallobj() — delete all objects at a location
// TODO: cf. invent.c delobj() — delete a single object
// TODO: cf. invent.c delobj_core() — core object deletion

// --- 5. Object queries ---
// TODO: cf. invent.c sobj_at() — find specific object type at location
// TODO: cf. invent.c nxtobj() — find next object of given type in chain
// TODO: cf. invent.c carrying() — check if hero carries object of given type
// TODO: cf. invent.c carrying_stoning_corpse() — check for cockatrice corpse in inventory
// TODO: cf. invent.c u_carried_gloves() — check if hero carries gloves
// TODO: cf. invent.c u_have_novel() — check if hero has a novel
// TODO: cf. invent.c o_on() — find object by id in a chain
// TODO: cf. invent.c obj_here() — check if specific object is at location
// TODO: cf. invent.c g_at() — find gold at location

// --- 6. Splitting ---
// TODO: cf. invent.c splittable() — check if object stack can be split

// --- 7. getobj / ggetobj ---
// TODO: cf. invent.c taking_off() — check if action is a take-off operation
// TODO: cf. invent.c mime_action() — mime gesture for empty-handed action
// TODO: cf. invent.c any_obj_ok() — check if any object is acceptable for action
// TODO: cf. invent.c getobj_hands_txt() — text for empty-hand prompts
// TODO: cf. invent.c getobj() — prompt player to select an inventory object
// TODO: cf. invent.c silly_thing() — message for using silly object
// TODO: cf. invent.c ckvalidcat() — check if object belongs to valid category
// TODO: cf. invent.c ckunpaid() — check if object is unpaid
// TODO: cf. invent.c wearing_armor() — check if hero is wearing armor
// TODO: cf. invent.c is_worn() — check if object is being worn
// TODO: cf. invent.c is_inuse() — check if object is in use (worn/wielded)
// TODO: cf. invent.c safeq_xprname() — safe extended name for quit prompts
// TODO: cf. invent.c safeq_shortxprname() — safe short extended name for quit prompts
// TODO: cf. invent.c ggetobj() — get object with class filter
// TODO: cf. invent.c askchain() — ask about each object in a chain

// --- 8. Identification ---
// TODO: cf. invent.c reroll_menu() — reroll identification menu
// TODO: cf. invent.c set_cknown_lknown() — set container/lock known flags
// TODO: cf. invent.c fully_identify_obj() — fully identify an object
// TODO: cf. invent.c identify() — identify objects (scroll of identify)
// TODO: cf. invent.c menu_identify() — menu-driven identification
// TODO: cf. invent.c count_unidentified() — count unidentified objects in inventory
// TODO: cf. invent.c identify_pack() — identify entire pack
// TODO: cf. invent.c learn_unseen_invent() — learn about unseen inventory

// --- 9. Display ---
// TODO: cf. invent.c update_inventory() — update permanent inventory window
// TODO: cf. invent.c doperminv() — display permanent inventory
// TODO: cf. invent.c obj_to_let() — convert object to inventory letter
// TODO: cf. invent.c prinv() — print inventory item
// TODO: cf. invent.c xprname() — extended name for inventory display
// TODO: cf. invent.c dispinv_with_action() — display inventory with action prompt
// TODO: cf. invent.c ddoinv() — full inventory display command
// TODO: cf. invent.c find_unpaid() — find unpaid items in inventory
// TODO: cf. invent.c free_pickinv_cache() — free pick-inventory cache
// TODO: cf. invent.c display_pickinv() — display pick-from-inventory menu
// TODO: cf. invent.c display_inventory() — display full inventory
// TODO: cf. invent.c repopulate_perminvent() — repopulate permanent inventory window
// TODO: cf. invent.c display_used_invlets() — show which inventory letters are in use

// --- 10. Counting ---
// TODO: cf. invent.c count_unpaid() — count unpaid items
// TODO: cf. invent.c count_buc() — count blessed/uncursed/cursed items
// TODO: cf. invent.c tally_BUCX() — tally BUC status of inventory
// TODO: cf. invent.c count_contents() — count items in a container
// TODO: cf. invent.c dounpaid() — list unpaid items
// TODO: cf. invent.c this_type_only() — filter for specific object type
// TODO: cf. invent.c dotypeinv() — type-filtered inventory display

// --- 11. Look here ---
// TODO: cf. invent.c dfeature_at() — describe dungeon feature at location
// TODO: cf. invent.c look_here() — look at objects at hero location
// TODO: cf. invent.c dolook() — look command
// TODO: cf. invent.c will_feel_cockatrice() — check if touching will petrify
// TODO: cf. invent.c feel_cockatrice() — handle touching cockatrice corpse

// --- 12. Stacking / merging ---
// TODO: cf. invent.c stackobj() — try to merge object into existing stack
// TODO: cf. invent.c mergable() — check if two objects can merge

// --- 13. Print equipment ---
// TODO: cf. invent.c doprgold() — print gold amount
// TODO: cf. invent.c doprwep() — print wielded weapon
// TODO: cf. invent.c noarmor() — check if hero wears no armor
// TODO: cf. invent.c doprarm() — print worn armor
// TODO: cf. invent.c doprring() — print worn rings
// TODO: cf. invent.c dopramulet() — print worn amulet
// TODO: cf. invent.c tool_being_used() — check if tool is in active use
// TODO: cf. invent.c doprtool() — print tools in use
// TODO: cf. invent.c doprinuse() — print all items in use

// --- 14. Inventory letters ---
// TODO: cf. invent.c let_to_name() — convert inventory letter to class name
// TODO: cf. invent.c free_invbuf() — free inventory buffer
// TODO: cf. invent.c reassign() — reassign inventory letters
// TODO: cf. invent.c check_invent_gold() — check inventory gold consistency
// TODO: cf. invent.c adjust_ok() — check if inventory adjustment is ok
// TODO: cf. invent.c adjust_gold_ok() — check if gold adjustment is ok
// TODO: cf. invent.c doorganize() — organize inventory (adjust command)
// TODO: cf. invent.c adjust_split() — adjust by splitting a stack
// TODO: cf. invent.c doorganize_core() — core inventory organization

// --- 15. Monster / container inventory ---
// TODO: cf. invent.c invdisp_nothing() — display "nothing" for empty inventory
// TODO: cf. invent.c worn_wield_only() — filter to worn/wielded items only
// TODO: cf. invent.c display_minventory() — display monster inventory
// TODO: cf. invent.c cinv_doname() — container inventory doname
// TODO: cf. invent.c cinv_ansimpleoname() — container inventory simple name
// TODO: cf. invent.c display_cinventory() — display container inventory
// TODO: cf. invent.c only_here() — filter objects at current location
// TODO: cf. invent.c display_binventory() — display buried inventory

// --- 16. Permanent inventory ---
// TODO: cf. invent.c prepare_perminvent() — prepare permanent inventory display
// TODO: cf. invent.c sync_perminvent() — sync permanent inventory with actual
// TODO: cf. invent.c perm_invent_toggled() — handle permanent inventory toggle
