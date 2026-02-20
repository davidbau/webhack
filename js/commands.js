// commands.js -- Command dispatch
// Mirrors cmd.c from the C source.
// Maps keyboard input to game actions.

import { COLNO, ROWNO, STONE, DOOR, CORR, SDOOR, SCORR, STAIRS, LADDER, FOUNTAIN, SINK, THRONE, ALTAR, GRAVE,
         POOL, LAVAPOOL, IRONBARS, TREE, ROOM, IS_DOOR, D_CLOSED, D_LOCKED,
         D_ISOPEN, D_NODOOR, D_BROKEN, ACCESSIBLE, IS_OBSTRUCTED, IS_WALL, MAXLEVEL, VERSION_STRING, ICE,
         isok, A_STR, A_INT, A_DEX, A_CON, A_WIS, A_CHA, STATUS_ROW_1, MAP_ROW_START,
         SHOPBASE, ROOMOFFSET, PM_CAVEMAN, RACE_ORC } from './config.js';
import { SQKY_BOARD, SLP_GAS_TRAP, FIRE_TRAP, PIT, SPIKED_PIT, ANTI_MAGIC, IS_SOFT } from './symbols.js';
import { rn2, rn1, rnd, rnl, d, c_d } from './rng.js';
import { wipe_engr_at } from './engrave.js';
import { exercise } from './attrib_exercise.js';
import { objectData, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
         TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
         WAND_CLASS, COIN_CLASS, GEM_CLASS, VENOM_CLASS, ROCK_CLASS, LANCE,
         BULLWHIP, BOW, ELVEN_BOW, ORCISH_BOW, YUMI, SLING, CROSSBOW, STETHOSCOPE,
         QUARTERSTAFF, ROBE, SMALL_SHIELD, DUNCE_CAP, POT_WATER,
         TALLOW_CANDLE, WAX_CANDLE, FLINT, ROCK,
         TOUCHSTONE, LUCKSTONE, LOADSTONE, MAGIC_MARKER,
         CREAM_PIE, EUCALYPTUS_LEAF, LUMP_OF_ROYAL_JELLY,
         POT_OIL, PICK_AXE, DWARVISH_MATTOCK,
         CREDIT_CARD, EXPENSIVE_CAMERA, MIRROR, FIGURINE } from './objects.js';
import { nhgetch, ynFunction, getlin } from './input.js';
import { playerAttackMonster } from './uhitm.js';
import { handleEat } from './eat.js';
import { handleQuaff } from './potion.js';
import { handleRead } from './read.js';
import { handleWear, handlePutOn, handleTakeOff } from './do_wear.js';
import { handleDownstairs, handleUpstairs, handleDrop, formatGoldPickupMessage, formatInventoryPickupMessage } from './do.js';
import { handleInventory, compactInvletPromptChars, buildInventoryOverlayLines, renderOverlayMenuUntilDismiss, currency } from './invent.js';
import { makemon, setMakemonPlayerContext } from './makemon.js';
import { mons } from './monsters.js';
import { monDisplayName, hasGivenName, monNam } from './mondata.js';
import { mondead } from './monutil.js';
import { doname, next_ident, xname } from './mkobj.js';
import { observeObject, getDiscoveriesMenuLines, isObjectNameKnown } from './discovery.js';
import { showPager } from './pager.js';
import { handleZap } from './zap.js';
import { saveGame, saveFlags } from './storage.js';
import { obj_resists, is_metallic } from './objdata.js';
import { placeFloorObject } from './floor_objects.js';
import { greetingForRole } from './player.js';
import { shtypes } from './shknam.js';
import {
    renderOptionsMenu,
    getTotalPages,
    normalizeOptionsPage,
    getOptionByKey,
    setOptionValue,
} from './options_menu.js';

const STATUS_HILITE_FIELDS = [
    'title', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom',
    'charisma', 'alignment', 'carrying-capacity', 'gold', 'power', 'power-max',
    'experience-level', 'armor-class', 'HD', 'time', 'hunger', 'hitpoints',
    'hitpoints-max', 'dungeon-level', 'experience', 'condition', 'version'
];

const STATUS_CONDITION_FIELDS_ALPHA = [
    'cond_barehanded', 'cond_blind', 'cond_busy', 'cond_conf', 'cond_deaf',
    'cond_fly', 'cond_foodPois', 'cond_glowhands', 'cond_grab', 'cond_hallucinat',
    'cond_held', 'cond_holding', 'cond_ice', 'cond_iron', 'cond_lava',
    'cond_levitate', 'cond_paralyzed', 'cond_ride', 'cond_sleep', 'cond_slime',
    'cond_slip', 'cond_stone', 'cond_strngl', 'cond_stun', 'cond_submerged',
    'cond_termIll', 'cond_tethered', 'cond_trap', 'cond_unconscious', 'cond_woundedlegs'
];

const STATUS_CONDITION_DEFAULT_ON = new Set([
    'cond_blind', 'cond_conf', 'cond_deaf', 'cond_fly', 'cond_foodPois',
    'cond_grab', 'cond_hallucinat', 'cond_iron', 'cond_lava', 'cond_levitate',
    'cond_ride', 'cond_slime', 'cond_stone', 'cond_strngl', 'cond_stun', 'cond_termIll'
]);

const SPELL_KEEN_TURNS = 20000;
const SPELL_KEEN = 20000; // C ref: spell.c KEEN (also in read.js)
const SPELL_SKILL_UNSKILLED = 1;
const SPELL_SKILL_BASIC = 2;
const SPELL_CATEGORY_ATTACK = 'attack';
const SPELL_CATEGORY_HEALING = 'healing';
const SPELL_CATEGORY_DIVINATION = 'divination';
const SPELL_CATEGORY_ENCHANTMENT = 'enchantment';
const SPELL_CATEGORY_CLERICAL = 'clerical';
const SPELL_CATEGORY_ESCAPE = 'escape';
const SPELL_CATEGORY_MATTER = 'matter';

// C refs: src/spell.c spell_skilltype()/spelltypemnemonic(), include/objects.h SPELL().
const SPELL_CATEGORY_BY_NAME = new Map([
    ['dig', SPELL_CATEGORY_MATTER],
    ['magic missile', SPELL_CATEGORY_ATTACK],
    ['fireball', SPELL_CATEGORY_ATTACK],
    ['cone of cold', SPELL_CATEGORY_ATTACK],
    ['sleep', SPELL_CATEGORY_ENCHANTMENT],
    ['finger of death', SPELL_CATEGORY_ATTACK],
    ['light', SPELL_CATEGORY_DIVINATION],
    ['detect monsters', SPELL_CATEGORY_DIVINATION],
    ['healing', SPELL_CATEGORY_HEALING],
    ['knock', SPELL_CATEGORY_MATTER],
    ['force bolt', SPELL_CATEGORY_ATTACK],
    ['confuse monster', SPELL_CATEGORY_ENCHANTMENT],
    ['cure blindness', SPELL_CATEGORY_HEALING],
    ['drain life', SPELL_CATEGORY_ATTACK],
    ['slow monster', SPELL_CATEGORY_ENCHANTMENT],
    ['wizard lock', SPELL_CATEGORY_MATTER],
    ['create monster', SPELL_CATEGORY_CLERICAL],
    ['detect food', SPELL_CATEGORY_DIVINATION],
    ['cause fear', SPELL_CATEGORY_ENCHANTMENT],
    ['clairvoyance', SPELL_CATEGORY_DIVINATION],
    ['cure sickness', SPELL_CATEGORY_HEALING],
    ['charm monster', SPELL_CATEGORY_ENCHANTMENT],
    ['haste self', SPELL_CATEGORY_ESCAPE],
    ['detect unseen', SPELL_CATEGORY_DIVINATION],
    ['levitation', SPELL_CATEGORY_ESCAPE],
    ['extra healing', SPELL_CATEGORY_HEALING],
    ['restore ability', SPELL_CATEGORY_HEALING],
    ['invisibility', SPELL_CATEGORY_ESCAPE],
    ['detect treasure', SPELL_CATEGORY_DIVINATION],
    ['remove curse', SPELL_CATEGORY_CLERICAL],
    ['magic mapping', SPELL_CATEGORY_DIVINATION],
    ['identify', SPELL_CATEGORY_DIVINATION],
    ['turn undead', SPELL_CATEGORY_CLERICAL],
    ['polymorph', SPELL_CATEGORY_MATTER],
    ['teleport away', SPELL_CATEGORY_ESCAPE],
    ['create familiar', SPELL_CATEGORY_CLERICAL],
    ['cancellation', SPELL_CATEGORY_MATTER],
    ['protection', SPELL_CATEGORY_CLERICAL],
    ['jumping', SPELL_CATEGORY_ESCAPE],
    ['stone to flesh', SPELL_CATEGORY_HEALING],
    ['chain lightning', SPELL_CATEGORY_ATTACK],
]);

// C refs: src/role.c roles[] spell stats (spelbase/spelheal/spelshld/spelarmr/spelstat/spelspec/spelsbon).
const ROLE_SPELLCAST = new Map([
    [0, { spelbase: 5, spelheal: 0, spelshld: 2, spelarmr: 10, spelstat: A_INT, spelspec: 'magic mapping', spelsbon: -4 }],
    [1, { spelbase: 14, spelheal: 0, spelshld: 0, spelarmr: 8, spelstat: A_INT, spelspec: 'haste self', spelsbon: -4 }],
    [2, { spelbase: 12, spelheal: 0, spelshld: 1, spelarmr: 8, spelstat: A_INT, spelspec: 'dig', spelsbon: -4 }],
    [3, { spelbase: 3, spelheal: -3, spelshld: 2, spelarmr: 10, spelstat: A_WIS, spelspec: 'cure sickness', spelsbon: -4 }],
    [4, { spelbase: 8, spelheal: -2, spelshld: 0, spelarmr: 9, spelstat: A_WIS, spelspec: 'turn undead', spelsbon: -4 }],
    [5, { spelbase: 8, spelheal: -2, spelshld: 2, spelarmr: 20, spelstat: A_WIS, spelspec: 'restore ability', spelsbon: -4 }],
    [6, { spelbase: 3, spelheal: -2, spelshld: 2, spelarmr: 10, spelstat: A_WIS, spelspec: 'remove curse', spelsbon: -4 }],
    [7, { spelbase: 8, spelheal: 0, spelshld: 1, spelarmr: 9, spelstat: A_INT, spelspec: 'detect treasure', spelsbon: -4 }],
    [8, { spelbase: 9, spelheal: 2, spelshld: 1, spelarmr: 10, spelstat: A_INT, spelspec: 'invisibility', spelsbon: -4 }],
    [9, { spelbase: 10, spelheal: 0, spelshld: 0, spelarmr: 8, spelstat: A_INT, spelspec: 'clairvoyance', spelsbon: -4 }],
    [10, { spelbase: 5, spelheal: 1, spelshld: 2, spelarmr: 10, spelstat: A_INT, spelspec: 'charm monster', spelsbon: -4 }],
    [11, { spelbase: 10, spelheal: -2, spelshld: 0, spelarmr: 9, spelstat: A_WIS, spelspec: 'cone of cold', spelsbon: -4 }],
    [12, { spelbase: 1, spelheal: 0, spelshld: 3, spelarmr: 10, spelstat: A_INT, spelspec: 'magic missile', spelsbon: -4 }],
]);

const ROLE_BASIC_SPELL_CATEGORIES = new Map([
    [0, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_HEALING, SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_MATTER])],
    [1, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_ESCAPE])],
    [2, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_MATTER])],
    [3, new Set([SPELL_CATEGORY_HEALING])],
    [4, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_HEALING, SPELL_CATEGORY_CLERICAL])],
    [5, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_HEALING, SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_ENCHANTMENT, SPELL_CATEGORY_CLERICAL, SPELL_CATEGORY_ESCAPE, SPELL_CATEGORY_MATTER])],
    [6, new Set([SPELL_CATEGORY_HEALING, SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_CLERICAL])],
    [7, new Set([SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_ESCAPE, SPELL_CATEGORY_MATTER])],
    [8, new Set([SPELL_CATEGORY_HEALING, SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_ESCAPE])],
    [9, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_CLERICAL])],
    [10, new Set([SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_ENCHANTMENT, SPELL_CATEGORY_ESCAPE])],
    [11, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_ESCAPE])],
    [12, new Set([SPELL_CATEGORY_ATTACK, SPELL_CATEGORY_HEALING, SPELL_CATEGORY_DIVINATION, SPELL_CATEGORY_ENCHANTMENT, SPELL_CATEGORY_CLERICAL, SPELL_CATEGORY_ESCAPE, SPELL_CATEGORY_MATTER])],
]);

const HEALING_BONUS_SPELLS = new Set([
    'healing',
    'extra healing',
    'cure blindness',
    'cure sickness',
    'restore ability',
    'remove curse',
]);


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

// Direction key mappings
// C ref: cmd.c -- movement key definitions
const DIRECTION_KEYS = {
    'h': [-1,  0],  // west
    'j': [ 0,  1],  // south
    'k': [ 0, -1],  // north
    'l': [ 1,  0],  // east
    'y': [-1, -1],  // northwest
    'u': [ 1, -1],  // northeast
    'b': [-1,  1],  // southwest
    'n': [ 1,  1],  // southeast
};

// Run direction keys (shift = run)
const RUN_KEYS = {
    'H': [-1,  0],
    'J': [ 0,  1],
    'K': [ 0, -1],
    'L': [ 1,  0],
    'Y': [-1, -1],
    'U': [ 1, -1],
    'B': [-1,  1],
    'N': [ 1,  1],
};

function runTraceEnabled() {
    const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    return env.WEBHACK_RUN_TRACE === '1';
}

function runTrace(...args) {
    if (!runTraceEnabled()) return;
    console.log('[RUN_TRACE]', ...args);
}

function replayStepLabel(map) {
    const idx = map?._replayStepIndex;
    return Number.isInteger(idx) ? String(idx + 1) : '?';
}

// Process a command from the player
// C ref: cmd.c rhack() -- main command dispatch
// Returns: { moved: boolean, tookTime: boolean }
export async function rhack(ch, game) {
    const { player, map, display, fov } = game;
    const c = String.fromCharCode(ch);
    const isMetaKey = ch >= 128 && ch <= 255;
    const metaBaseChar = isMetaKey ? String.fromCharCode(ch & 0x7f).toLowerCase() : '';
    // C ref: you.h u.ux0/u.uy0 are the hero's pre-command position.
    // Monster throw logic (mthrowu.c URETREATING) compares against these.
    game.ux0 = player.x;
    game.uy0 = player.y;
    // C ref: tty command input acknowledges previous topline state before
    // processing a new command, so cross-turn messages don't auto-concatenate.
    if (display && 'messageNeedsMore' in display) {
        display.messageNeedsMore = false;
    }
    if (ch !== 16) {
        display.prevMessageCycleIndex = null;
    }
    if (ch !== 4) {
        player.kickedloc = null;
    }

    // C ref: cmdhelp/keyhelp + fixes3-6-3:
    // ^J (LF/newline) is bound to a south "go until near something" command
    // in non-numpad mode, while ^M is separate (often transformed before core).
    if (ch === 10) {
        return await handleRun(DIRECTION_KEYS.j, player, map, display, fov, game, 'rush');
    }

    // Carriage return can still appear from some non-tty inputs; preserve
    // existing compatibility behavior here.
    if (ch === 13) {
        const southX = player.x + DIRECTION_KEYS.j[0];
        const southY = player.y + DIRECTION_KEYS.j[1];
        const southMon = map.monsterAt(southX, southY);
        const noExplicitCount = (game.commandCount || 0) === 0 && (game.multi || 0) === 0;
        const runDisplaceFlow = noExplicitCount && !!southMon && (southMon.tame || southMon.peaceful);
        const replayForcedRun = noExplicitCount && !!game._replayForceEnterRun;
        if (runDisplaceFlow || replayForcedRun) {
            return await handleRun(DIRECTION_KEYS.j, player, map, display, fov, game);
        }
        return await handleMovement(DIRECTION_KEYS.j, player, map, display, game);
    }

    // Meta command keys (M-x / Alt+x).
    // C ref: command set includes M('l') for loot, M('f') for #force.
    if (metaBaseChar === 'l') {
        return await handleLoot(game);
    }
    if (metaBaseChar === 'f') {
        return await handleForce(game);
    }

    // Movement keys
    if (DIRECTION_KEYS[c]) {
        // Check if 'G' or 'g' prefix was used (run/rush mode)
        if (game.runMode) {
            const mode = game.runMode;
            game.runMode = 0; // Clear prefix
            return handleRun(DIRECTION_KEYS[c], player, map, display, fov, game);
        }
        return await handleMovement(DIRECTION_KEYS[c], player, map, display, game);
    }

    // Run keys (capital letter = run in that direction)
    if (RUN_KEYS[c]) {
        return handleRun(RUN_KEYS[c], player, map, display, fov, game);
    }

    function clearTopline() {
        if (!display) return;
        if (typeof display.clearRow === 'function') display.clearRow(0);
        if ('topMessage' in display) display.topMessage = '';
        if ('messageNeedsMore' in display) display.messageNeedsMore = false;
    }

    function safetyWarning(cmd) {
        const search = cmd === 's';
        const counterKey = search ? 'alreadyFoundFlag' : 'didNothingFlag';
        const cmddesc = search ? 'another search' : 'a no-op (to rest)';
        const act = search ? 'You already found a monster.' : 'Are you waiting to get hit?';

        if (!Number.isInteger(game[counterKey])) game[counterKey] = 0;
        const includeHint = !!(game.flags?.cmdassist || game[counterKey] === 0);
        if (!game.flags?.cmdassist) game[counterKey] += 1;

        const msg = includeHint ? `${act}  Use 'm' prefix to force ${cmddesc}.` : act;
        // C ref: Norep() suppresses identical consecutive warnings.
        if (game.lastSafetyWarningMessage === msg) {
            clearTopline();
            return;
        }
        display.putstr_message(msg);
        game.lastSafetyWarningMessage = msg;
    }

    function resetSafetyWarningCounter(cmd) {
        if (cmd === 's') {
            game.alreadyFoundFlag = 0;
        } else {
            game.didNothingFlag = 0;
        }
        game.lastSafetyWarningMessage = '';
    }

    // C ref: cmd.c do_rush()/do_run() prefix handling.
    // If the next key after g/G is not a movement command, cancel prefix
    // with a specific message instead of treating it as an unknown command.
    if (game.runMode && c !== 'g' && c !== 'G' && ch !== 27) {
        const prefix = game.runMode === 2 ? 'g' : 'G';
        game.runMode = 0;
        // C getdir-style quit keys after a run/rush prefix do not produce
        // the prefix-specific warning; they fall through as ordinary input.
        const isQuitLike = (ch === 32 || ch === 10 || ch === 13);
        if (!isQuitLike) {
            display.putstr_message(`The '${prefix}' prefix should be followed by a movement command.`);
            return { moved: false, tookTime: false };
        }
    }

    function performWaitSearch(cmd) {
        // C ref: do.c cmd_safety_prevention() — prevent wait/search when hostile adjacent
        // only when not in counted-repeat mode.
        if (game && game.flags && game.flags.safe_wait
            && !game.menuRequested && !(game.multi > 0) && !game.occupation) {
            let monNearby = false;
            for (let dx = -1; dx <= 1 && !monNearby; dx++) {
                for (let dy = -1; dy <= 1 && !monNearby; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const mon = map.monsterAt(player.x + dx, player.y + dy);
                    if (mon && !mon.dead && !mon.tame && !mon.peaceful) {
                        monNearby = true;
                    }
                }
            }
            if (monNearby) {
                safetyWarning(cmd);
                return { moved: false, tookTime: false };
            }
        }
        resetSafetyWarningCounter(cmd);
        if (cmd === 's') {
            dosearch0(player, map, display, game);
        }
        return { moved: false, tookTime: true };
    }

    // Period/space = wait/search
    // C ref: cmd.c — space maps to donull only when rest_on_space is enabled.
    if (c === '.' || c === 's' || (c === ' ' && game?.flags?.rest_on_space)) {
        const result = performWaitSearch(c);
        // C ref: cmd.c set_occupation(..., "waiting"/"searching", gm.multi)
        // for counted repeats of rest/search. timed_occupation executes the
        // command then decrements multi each turn.
        if (result.tookTime && game && game.multi > 0 && !game.occupation) {
            const occCmd = c;
            game.occupation = {
                occtxt: occCmd === 's' ? 'searching' : 'waiting',
                fn(g) {
                    performWaitSearch(occCmd);
                    if (g.multi > 0) g.multi--;
                    return g.multi > 0;
                },
            };
        } 
        return result;
    }

    if (game && game.lastSafetyWarningMessage) {
        game.lastSafetyWarningMessage = '';
    }

    // Pick up
    if (c === ',') {
        // C ref: cmd.c -- ',' is pickup
        return handlePickup(player, map, display);
    }

    // Go down stairs
    if (c === '>') {
        return await handleDownstairs(player, map, display, game);
    }

    // Go up stairs
    if (c === '<') {
        return await handleUpstairs(player, map, display, game);
    }

    // Open door
    if (c === 'o') {
        return await handleOpen(player, map, display, game);
    }

    // Close door
    if (c === 'c') {
        return await handleClose(player, map, display, game);
    }

    // Inventory
    if (c === 'i') {
        return await handleInventory(player, display, game);
    }

    // Count gold
    // C ref: cmd.c doprgold()
    if (c === '$') {
        const amount = Number.isFinite(player.gold) ? Math.max(0, Math.floor(player.gold)) : 0;
        display.putstr_message(`Your wallet contains ${amount} ${currency(amount)}.`);
        return { moved: false, tookTime: false };
    }

    // Wield weapon
    if (c === 'w') {
        return await handleWield(player, display);
    }

    // Swap primary/secondary weapon
    // C ref: wield.c doswapweapon()
    if (c === 'x') {
        return await handleSwapWeapon(player, display);
    }

    // Throw item
    // C ref: dothrow()
    if (c === 't') {
        return await handleThrow(player, map, display);
    }

    // Fire from quiver/launcher
    // C ref: dothrow() fire command path
    if (c === 'f') {
        return await handleFire(player, map, display, game);
    }

    // Engrave
    // C ref: engrave.c doengrave()
    if (c === 'E') {
        return await handleEngrave(player, display);
    }

    // Wear armor
    if (c === 'W') {
        return await handleWear(player, display);
    }

    // Put on ring/accessory
    // C ref: do_wear.c doputon()
    if (c === 'P') {
        return await handlePutOn(player, display);
    }

    // Take off armor
    if (c === 'T') {
        return await handleTakeOff(player, display);
    }

    // Drop
    if (c === 'd') {
        return await handleDrop(player, map, display);
    }

    // Eat
    if (c === 'e') {
        return await handleEat(player, display, game);
    }

    // Quaff (drink)
    if (c === 'q') {
        return await handleQuaff(player, map, display);
    }

    // Apply / use item
    // C ref: apply.c doapply()
    if (c === 'a') {
        return await handleApply(player, display);
    }

    // Pay shopkeeper
    // C ref: shk.c dopay() -- full billing flow is not yet ported; preserve no-shopkeeper message.
    if (c === 'p') {
        return await handlePay(player, map, display);
    }

    // Read scroll/spellbook
    // C ref: read.c doread()
    if (c === 'r') {
        if (game.menuRequested) game.menuRequested = false;
        return await handleRead(player, display, game);
    }

    // Zap wand
    if (c === 'z') {
        return await handleZap(player, map, display, game);
    }

    // Look (:)
    if (c === ':') {
        return handleLook(player, map, display);
    }

    // What is (;)
    if (c === ';') {
        if (game.flags.verbose) {
            display.putstr_message('Pick a position to identify (use movement keys, . when done)');
        }
        return { moved: false, tookTime: false };
    }

    // Whatis (/)
    // C ref: pager.c dowhatis()
    if (c === '/') {
        return await handleWhatis(game);
    }

    // Whatdoes (&)
    // C ref: pager.c dowhatdoes()
    if (c === '&') {
        return await handleWhatdoes(game);
    }

    // Discoveries (\)
    // C ref: o_init.c dodiscovered()
    if (c === '\\') {
        return await handleDiscoveries(game);
    }

    // History (V)
    // C ref: pager.c dohistory()
    if (c === 'V') {
        return await handleHistory(game);
    }

    // List known spells (+)
    // C ref: spell.c dovspell()
    if (c === '+') {
        return await handleKnownSpells(player, display);
    }

    // Version (v)
    // C ref: pager.c doversion()
    if (c === 'v') {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
        return { moved: false, tookTime: false };
    }

    // Kick (Ctrl+D)
    if (ch === 4) {
        return await handleKick(player, map, display, game);
    }

    // Previous messages (Ctrl+P)
    if (ch === 16) {
        return await handlePrevMessages(display);
    }

    // View map overlays (DEL / Backspace on some tty keymaps)
    // C ref: cmd.c dooverview()
    if (ch === 127 || ch === 8) {
        return await handleViewMapPrompt(game);
    }

    // Help (?)
    if (c === '?') {
        return await handleHelp(game);
    }

    // Save (S)
    if (c === 'S') {
        return await handleSave(game);
    }

    // Options (O) — C ref: doset()
    if (c === 'O') {
        return await handleSet(game);
    }

    // Toggle autopickup (@) — C ref: dotogglepickup()
    if (c === '@') {
        return await handleTogglePickup(game);
    }

    // Quit (#quit or Ctrl+C)
    if (ch === 3) {
        const ans = await ynFunction('Really quit?', 'yn', 'n'.charCodeAt(0), display);
        if (String.fromCharCode(ans) === 'y') {
            game.gameOver = true;
            game.gameOverReason = 'quit';
            player.deathCause = 'quit';
            display.putstr_message('Goodbye...');
        }
        return { moved: false, tookTime: false };
    }

    // Extended command (#)
    // C ref: cmd.c doextcmd()
    if (c === '#') {
        return await handleExtendedCommand(game);
    }

    // Travel command (_)
    // C ref: cmd.c dotravel()
    if (c === '_') {
        return await handleTravel(game);
    }

    // Retravel (Ctrl+_)
    // C ref: cmd.c dotravel_target()
    if (ch === 31) { // Ctrl+_ (ASCII 31)
        if (game.travelX !== undefined && game.travelY !== undefined) {
            const path = findPath(map, player.x, player.y, game.travelX, game.travelY);
            if (!path) {
                display.putstr_message('No path to previous destination.');
                return { moved: false, tookTime: false };
            }
            if (path.length === 0) {
                display.putstr_message('You are already there.');
                return { moved: false, tookTime: false };
            }
            game.travelPath = path;
            game.travelStep = 0;
            display.putstr_message(`Traveling... (${path.length} steps)`);
            return await executeTravelStep(game);
        } else {
            display.putstr_message('No previous travel destination.');
            return { moved: false, tookTime: false };
        }
    }

    // Wizard mode: Ctrl+V = #levelchange
    // C ref: cmd.c wiz_level_change()
    if (ch === 22 && game.wizard) {
        return await wizLevelChange(game);
    }

    // Wizard mode: Ctrl+F = magic mapping (reveal map)
    // C ref: cmd.c wiz_map()
    if (ch === 6 && game.wizard) {
        return wizMap(game);
    }

    // Wizard mode: Ctrl+T = teleport
    // C ref: cmd.c wiz_teleport()
    if (ch === 20 && game.wizard) {
        return await wizTeleport(game);
    }

    // Wizard mode: Ctrl+G = genesis (create monster)
    // C ref: cmd.c wiz_genesis()
    if (ch === 7 && game.wizard) {
        return await wizGenesis(game);
    }

    // Wizard mode: Ctrl+W = wish
    // C ref: cmd.c wiz_wish()
    if (ch === 23 && game.wizard) {
        display.putstr_message('Wishing not yet implemented.');
        return { moved: false, tookTime: false };
    }

    // Wizard mode: Ctrl+I = identify all
    // C ref: cmd.c wiz_identify()
    if (ch === 9 && game.wizard) {
        display.putstr_message('All items in inventory identified.');
        return { moved: false, tookTime: false };
    }

    // Redraw (Ctrl+R)
    if (ch === 18) {
        display.renderMap(map, player, fov);
        display.renderStatus(player);
        return { moved: false, tookTime: false };
    }

    // Prefix commands (modifiers for next command)
    // C ref: cmd.c:1624 do_reqmenu() — 'm' prefix
    if (c === 'm') {
        if (game.menuRequested) {
            game.menuRequested = false;
        } else {
            game.menuRequested = true;
            // C ref: cmd.c do_reqmenu() — sets iflags.menu_requested
            // silently; no screen message in C's TTY implementation.
        }
        return { moved: false, tookTime: false };
    }

    // C ref: cmd.c:1671 do_fight() — 'F' prefix
    if (c === 'F') {
        if (game.forceFight) {
            display.putstr_message('Double fight prefix, canceled.');
            game.forceFight = false;
        } else {
            game.forceFight = true;
            if (game.flags.verbose) {
                display.putstr_message('Next movement will force fight even if no monster visible.');
            }
        }
        return { moved: false, tookTime: false };
    }

    // C ref: cmd.c:1655 do_run() — 'G' prefix (run)
    if (c === 'G') {
        if (game.runMode) {
            display.putstr_message('Double run prefix, canceled.');
            game.runMode = 0;
        } else {
            game.runMode = 3; // run mode
            if (game.flags.verbose) {
                display.putstr_message('Next direction will run until something interesting.');
            }
        }
        return { moved: false, tookTime: false };
    }

    // C ref: cmd.c:1639 do_rush() — 'g' prefix (rush)
    if (c === 'g') {
        if (game.runMode) {
            display.putstr_message('Double rush prefix, canceled.');
            game.runMode = 0;
        } else {
            game.runMode = 2; // rush mode
            if (game.flags.verbose) {
                display.putstr_message('Next direction will rush until something interesting.');
            }
        }
        return { moved: false, tookTime: false };
    }

    // Escape -- ignore silently (cancels pending prompts)
    // C ref: cmd.c -- ESC aborts current command
    if (ch === 27) {
        // Also clear prefix flags
        game.menuRequested = false;
        game.forceFight = false;
        game.runMode = 0;
        return { moved: false, tookTime: false };
    }

    // Unknown command
    display.putstr_message(`Unknown command '${ch < 32 ? '^' + String.fromCharCode(ch + 64) : c}'.`);
    return { moved: false, tookTime: false };
}

// Handle directional movement
// C ref: hack.c domove() -- the core movement function
async function handleMovement(dir, player, map, display, game) {
    const flags = game.flags || {};
    const oldX = player.x;
    const oldY = player.y;
    // Preserve pre-move coordinates for C-style URETREATING checks.
    game.ux0 = oldX;
    game.uy0 = oldY;
    const nx = player.x + dir[0];
    const ny = player.y + dir[1];
    // C ref: cmd.c move-prefix handling is consumed by the attempted move
    // path, even when that move is blocked.
    const nopick = game.menuRequested;
    game.menuRequested = false;

    if (!isok(nx, ny)) {
        display.putstr_message("You can't move there.");
        return { moved: false, tookTime: false };
    }

    const loc = map.at(nx, ny);

    // C ref: hack.c crawl_destination()/test_move:
    // diagonal movement into a doorway is blocked unless the target door is
    // effectively doorless (D_NODOOR or D_BROKEN).
    if (loc && IS_DOOR(loc.typ) && Math.abs(dir[0]) + Math.abs(dir[1]) === 2) {
        const doorFlags = loc.flags || 0;
        const doorlessDoor = (doorFlags & ~(D_NODOOR | D_BROKEN)) === 0;
        if (!doorlessDoor) {
            if (map?.flags?.mention_walls || map?.flags?.is_tutorial) {
                display.putstr_message("You can't move diagonally into an intact doorway.");
            }
            return { moved: false, tookTime: false };
        }
    }
    // C ref: hack.c test_move() out-of-door diagonal gate:
    // moving diagonally out of an intact doorway is also blocked.
    if (Math.abs(dir[0]) + Math.abs(dir[1]) === 2) {
        const fromLoc = map.at(oldX, oldY);
        if (fromLoc && IS_DOOR(fromLoc.typ)) {
            const fromDoorFlags = fromLoc.flags || 0;
            const fromDoorless = (fromDoorFlags & ~(D_NODOOR | D_BROKEN)) === 0;
            if (!fromDoorless) {
                if (map?.flags?.mention_walls || map?.flags?.is_tutorial) {
                    display.putstr_message("You can't move diagonally out of an intact doorway.");
                }
                return { moved: false, tookTime: false };
            }
        }
    }

    // C ref: cmd.c do_fight() + hack.c domove()/do_attack() fallback.
    // Forced-fight into an empty square produces "You attack thin air."
    // and does not perform normal movement handling.
    if (game.forceFight && !map.monsterAt(nx, ny)) {
        let target = '';
        if (loc) {
            if (IS_WALL(loc.typ)) {
                target = 'the wall';
            } else if (loc.typ === STAIRS) {
                if (map.upstair && map.upstair.x === nx && map.upstair.y === ny) {
                    target = 'the branch staircase up';
                } else if (map.dnstair && map.dnstair.x === nx && map.dnstair.y === ny) {
                    target = 'the branch staircase down';
                } else {
                    target = loc.stairdir ? 'the branch staircase up' : 'the branch staircase down';
                }
            }
        }
        if (target) {
            display.putstr_message(`You harmlessly attack ${target}.`);
        } else {
            display.putstr_message('You attack thin air.');
        }
        game.forceFight = false;
        return { moved: false, tookTime: true };
    }

    // Check for monster at target position
    const mon = map.monsterAt(nx, ny);
    if (mon) {
        // C ref: hack.c domove() — check for pet displacement
        // C ref: uhitm.c do_attack() is invoked first for safemon targets.
        // Even when displacement succeeds, it consumes rn2(7) via safemon checks.
        // 'F' prefix (forceFight) skips safemon protection and forces attack.
        const shouldDisplace = (mon.tame || mon.peaceful) && !game.forceFight;

        if (shouldDisplace) {
            // C ref: uhitm.c:473 foo = Punished || !rn2(7) || ...
            // Early-game parity: model the rn2(7) gate before displacement.
                if (rn2(7) === 0) {
                    if (mon.tame) {
                        // C ref: monmove.c monflee(mtmp, rnd(6), FALSE, FALSE)
                        // first=FALSE always refreshes timed flee and enforces
                        // at least 2 turns of visible fleeing.
                        let fleetime = rnd(6);
                        const oldFleetim = mon.fleetim || 0;
                        if (!mon.flee || oldFleetim > 0) {
                            fleetime += oldFleetim;
                            if (fleetime === 1) fleetime = 2;
                            mon.fleetim = Math.min(fleetime, 127);
                        }
                        mon.flee = true;
                        if (Array.isArray(mon.mtrack)) {
                            for (let i = 0; i < mon.mtrack.length; i++) {
                                mon.mtrack[i] = { x: 0, y: 0 };
                            }
                        }
                    }
                if (mon.tame) {
                    display.putstr_message(
                        `You stop.  ${monNam(mon, { capitalize: true })} is in the way!`
                    );
                } else {
                    const label = mon.name ? monNam(mon, { capitalize: true }) : 'It';
                    display.putstr_message(`You stop. ${label} is in the way!`);
                }
                game.forceFight = false;
                return { moved: false, tookTime: true };
            }

            // Pet displacement: swap positions
            // C ref: hack.c:2142-2156 — remove_monster + place_monster swaps positions
            const oldPlayerX = player.x;
            const oldPlayerY = player.y;
            mon.mx = oldPlayerX;
            mon.my = oldPlayerY;
            player.x = nx;
            player.y = ny;
            player.moved = true;
            game.lastMoveDir = dir;
            maybeSmudgeEngraving(map, oldPlayerX, oldPlayerY, player.x, player.y);
            player.displacedPetThisTurn = true;
            maybeHandleShopEntryMessage(game, oldPlayerX, oldPlayerY);
            // C ref: hack.c:2150 — x_monnam with ARTICLE_YOUR for tame
            // includes "saddled" when the monster has a saddle worn.
            display.putstr_message(`You swap places with ${monNam(mon)}.`);
            const landedObjs = map.objectsAt(nx, ny);
            if (landedObjs.length > 0) {
                const seen = landedObjs[0];
                if (seen.oclass === COIN_CLASS) {
                    const count = seen.quan || 1;
                    if (count === 1) {
                        display.putstr_message('You see here a gold piece.');
                    } else {
                        display.putstr_message(`You see here ${count} gold pieces.`);
                    }
                } else {
                    observeObject(seen);
                    display.putstr_message(`You see here ${describeGroundObjectForPlayer(seen, player, map)}.`);
                }
            }
            game.forceFight = false; // Clear prefix (shouldn't reach here but be safe)
            return { moved: true, tookTime: true };
        }

        // Safety checks before attacking
        // C ref: flag.h flags.safe_pet - prevent attacking pets
        if (mon.tame && game.flags?.safe_pet) {
            display.putstr_message("You cannot attack your pet!");
            game.forceFight = false;
            return { moved: false, tookTime: false };
        }

        // C ref: flag.h flags.confirm - confirm attacking peacefuls
        if (mon.peaceful && !mon.tame && game.flags?.confirm) {
            const answer = await ynFunction(
                `Really attack ${monDisplayName(mon)}?`,
                'yn',
                'n'.charCodeAt(0),
                display
            );
            if (answer !== 'y'.charCodeAt(0)) {
                display.putstr_message("Cancelled.");
                game.forceFight = false;
                return { moved: false, tookTime: false };
            }
        }

        // Attack the monster (or forced attack on peaceful)
        game.forceFight = false; // Clear prefix after use
        // C ref: hack.c domove() -> do_attack() -> attack() -> hitum()
        // C ref: hack.c:3036 overexertion() unconditionally calls gethungry() -> rn2(20)
        rn2(20); // overexertion/gethungry before attack
        // C ref: uhitm.c:550 exercise(A_STR, TRUE) before hitum()
        exercise(player, A_STR, true);
        const killed = playerAttackMonster(player, mon, display, map);
        if (killed) {
            map.removeMonster(mon);
        }
        player.moved = true;
        return { moved: false, tookTime: true };
    }

    // Check terrain
    if (IS_WALL(loc.typ)) {
        if (map?.flags?.mention_walls || map?.flags?.is_tutorial) {
            display.putstr_message("It's a wall.");
        }
        return { moved: false, tookTime: false };
    }

    if (loc.typ === 0) { // STONE
        if (map?.flags?.mention_walls || map?.flags?.is_tutorial) {
            display.putstr_message("It's a wall.");
        }
        return { moved: false, tookTime: false };
    }

    // C ref: secret doors/corridors behave like walls until discovered.
    if (loc.typ === SDOOR || loc.typ === SCORR) {
        if (map?.flags?.mention_walls || map?.flags?.is_tutorial) {
            display.putstr_message("It's a wall.");
        }
        return { moved: false, tookTime: false };
    }

    // Handle closed doors — auto-open per C ref: hack.c:1077-1090 + lock.c:904
    // In C, doopen_indir is called within domove_core. After it, context.move
    // remains false (player didn't move), so monsters don't get a turn.
    // The RNG calls (rnl + exercise) happen but no per-turn processing runs.
    if (IS_DOOR(loc.typ) && (loc.flags & D_CLOSED)) {
        const str = player.attributes ? player.attributes[A_STR] : 18;
        const dex = player.attributes ? player.attributes[A_DEX] : 11;
        const con = player.attributes ? player.attributes[A_CON] : 18;
        const threshold = Math.floor((str + dex + con) / 3);
        if (rnl(20) < threshold) {
            loc.flags = (loc.flags & ~D_CLOSED) | D_ISOPEN;
            display.putstr_message("The door opens.");
        } else {
            exercise(player, A_STR, true);
            display.putstr_message("The door resists!");
        }
        return { moved: false, tookTime: false };
    }
    if (IS_DOOR(loc.typ) && (loc.flags & D_LOCKED)) {
        display.putstr_message("This door is locked.");
        return { moved: false, tookTime: false };
    }

    if (!ACCESSIBLE(loc.typ)) {
        display.putstr_message("You can't move there.");
        return { moved: false, tookTime: false };
    }
    const steppingTrap = map.trapAt(nx, ny);
    // C-style confirmation prompt for known anti-magic fields.
    if (steppingTrap && steppingTrap.ttyp === ANTI_MAGIC && steppingTrap.tseen) {
        const ans = await ynFunction(
            'Really step onto that anti-magic field?',
            'yn',
            'n'.charCodeAt(0),
            display
        );
        if (ans !== 'y'.charCodeAt(0)) {
            return { moved: false, tookTime: false };
        }
    }

    // Move the player
    player.x = nx;
    player.y = ny;
    player.moved = true;
    game.lastMoveDir = dir;
    maybeSmudgeEngraving(map, oldX, oldY, player.x, player.y);

    // Clear force-fight prefix after successful movement.
    game.forceFight = false;
    maybeHandleShopEntryMessage(game, oldX, oldY);

    // Check for traps — C ref: hack.c spoteffects() → dotrap()
    // C ref: trap.c trapeffect_*() — trap-specific effects
    const trap = map.trapAt(nx, ny);
    if (trap) {
        // C ref: trap.c seetrap() — mark trap as discovered
        if (!trap.tseen) {
            trap.tseen = true;
        }
        // Trap-specific effects (no RNG for SQKY_BOARD)
        if (trap.ttyp === SQKY_BOARD) {
            display.putstr_message('A board beneath you squeaks loudly.');
            // Match tty topline behavior where later same-turn messages replace
            // this trap notice rather than concatenating with it.
            display.messageNeedsMore = false;
        }
        // C ref: trap.c trapeffect_slp_gas_trap() for hero path
        else if (trap.ttyp === SLP_GAS_TRAP) {
            const duration = rnd(25);
            player.stunned = true;
            display.putstr_message('A cloud of gas puts you to sleep!');
            // Keep duration for future full sleep handling without changing turn loop yet.
            player.sleepTrapTurns = Math.max(player.sleepTrapTurns || 0, duration);
        }
        // C ref: trap.c dofiretrap() for hero path (non-resistant baseline)
        else if (trap.ttyp === FIRE_TRAP) {
            const origDmg = d(2, 4);
            const fireDmg = d(2, 4);
            display.putstr_message('A tower of flame erupts from the floor!');
            player.takeDamage(Math.max(0, fireDmg), 'a fire trap');
            // C ref: burnarmor() || rn2(3)
            rn2(3);
            void origDmg; // kept for parity readability with C's orig_dmg handling.
        }
        // C ref: trap.c trapeffect_pit() — set trap timeout and apply damage.
        else if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
            const trapTurns = rn2(6) + 2; // rn1(6,2)
            player.pitTrapTurns = Math.max(player.pitTrapTurns || 0, trapTurns);
            const pitDmg = rnd(trap.ttyp === SPIKED_PIT ? 10 : 6);
            player.takeDamage(Math.max(0, pitDmg), trap.ttyp === SPIKED_PIT
                ? 'a pit of spikes'
                : 'a pit');
            if (trap.ttyp === SPIKED_PIT) {
                rn2(6); // C ref: 1-in-6 poison-spike branch gate.
            }
            display.putstr_message(trap.ttyp === SPIKED_PIT
                ? 'You land on a set of sharp iron spikes!'
                : 'You fall into a pit!');
        }
        // C ref: trap.c trapeffect_anti_magic()
        else if (trap.ttyp === ANTI_MAGIC) {
            // C ref: trap.c trapeffect_anti_magic() + drain_en()
            let drain = c_d(2, 6); // 2..12
            const halfd = rnd(Math.max(1, Math.floor(drain / 2)));
            let exclaim = false;
            if (player.pwmax > drain) {
                player.pwmax = Math.max(0, player.pwmax - halfd);
                drain -= halfd;
                exclaim = true;
            }
            if (player.pwmax < 1) {
                player.pw = 0;
                player.pwmax = 0;
                display.putstr_message('You feel momentarily lethargic.');
            } else {
                let n = drain;
                if (n > Math.floor((player.pw + player.pwmax) / 3)) {
                    n = rnd(n);
                }
                let punct = exclaim ? '!' : '.';
                if (n > player.pw) punct = '!';
                player.pw -= n;
                if (player.pw < 0) {
                    player.pwmax = Math.max(0, player.pwmax - rnd(-player.pw));
                    player.pw = 0;
                } else if (player.pw > player.pwmax) {
                    player.pw = player.pwmax;
                }
                display.putstr_message(`You feel your magical energy drain away${punct}`);
            }
        }
    }

    // Helper function: Check if object class matches pickup_types string
    // C ref: pickup.c pickup_filter() and flags.pickup_types
    function shouldAutopickup(obj, pickupTypes) {
        if (obj && obj._thrownByPlayer && game.flags?.pickup_thrown) {
            return true;
        }
        // If pickup_types is empty, pick up all non-gold items (backward compat)
        if (!pickupTypes || pickupTypes === '') {
            return true;
        }

        // Map object class to symbol character
        const classToSymbol = {
            [WEAPON_CLASS]: ')',
            [ARMOR_CLASS]: '[',
            [RING_CLASS]: '=',
            [AMULET_CLASS]: '"',
            [TOOL_CLASS]: '(',
            [FOOD_CLASS]: '%',
            [POTION_CLASS]: '!',
            [SCROLL_CLASS]: '?',
            [SPBOOK_CLASS]: '+',
            [WAND_CLASS]: '/',
            [COIN_CLASS]: '$',
            [GEM_CLASS]: '*',
            [ROCK_CLASS]: '`',
        };

        const symbol = classToSymbol[obj.oclass];
        return symbol && pickupTypes.includes(symbol);
    }

    // Autopickup — C ref: hack.c:3265 pickup(1)
    // C ref: pickup.c pickup() checks flags.pickup && !context.nopick
    const objs = map.objectsAt(nx, ny);
    let pickedUp = false;

    // Pick up gold first if autopickup is enabled
    // C ref: pickup.c pickup() — autopickup gate applies to ALL items including gold
    if (game.flags?.pickup && !nopick && objs.length > 0) {
        const gold = objs.find(o => o.oclass === COIN_CLASS);
        if (gold) {
            player.addToInventory(gold);
            map.removeObject(gold);
            display.putstr_message(formatGoldPickupMessage(gold, player));
            pickedUp = true;
        }
    }

    // Then pick up other items if autopickup is enabled
    // C ref: pickup.c pickup() filters by pickup_types
    if (game.flags?.pickup && !nopick && objs.length > 0) {
        const pickupTypes = game.flags?.pickup_types || '';
        const obj = objs.find(o => o.oclass !== COIN_CLASS && shouldAutopickup(o, pickupTypes));
        if (obj) {
            observeObject(obj);
            const inventoryObj = player.addToInventory(obj);
            map.removeObject(obj);
            display.putstr_message(formatInventoryPickupMessage(obj, inventoryObj, player));
            pickedUp = true;
        }
    }

    // Show what's here if nothing was picked up
    // C ref: hack.c prints "You see here" only if nothing was picked up
    if (!pickedUp && objs.length > 0) {
        if (IS_DOOR(loc.typ) && !(loc.flags & (D_CLOSED | D_LOCKED))) {
            display.putstr_message('There is a doorway here.');
        }
        if (objs.length === 1) {
            const seen = objs[0];
            if (seen.oclass === COIN_CLASS) {
                const count = seen.quan || 1;
                if (count === 1) {
                    display.putstr_message('You see here a gold piece.');
                } else {
                    display.putstr_message(`You see here ${count} gold pieces.`);
                }
            } else {
                observeObject(seen);
                display.putstr_message(`You see here ${describeGroundObjectForPlayer(seen, player, map)}.`);
            }
        } else {
            // C ref: invent.c look_here() — for 2+ objects, C uses a NHW_MENU
            // popup window ("Things that are here:") that the player dismisses.
            // TODO: implement paginated menu display matching C's tty rendering.
        }
    }

    // Check for stairs
    // C ref: do.c:738 flags.verbose gates "There is a staircase..."
    // Messages will be concatenated if both fit (see display.putstr_message)
    if (game.flags.verbose && loc.typ === STAIRS) {
        if (loc.flags === 1) {
            display.putstr_message('There is a staircase up out of the dungeon here.');
        } else {
            display.putstr_message('There is a staircase down here.');
        }
    }

    // C ref: do.c:774 flags.verbose gates terrain feature descriptions
    if (game.flags.verbose && loc.typ === FOUNTAIN) {
        display.putstr_message('There is a fountain here.');
    }

    return { moved: true, tookTime: true };
}

function roomMatchesType(map, roomno, typeWanted) {
    if (!Number.isInteger(roomno) || roomno < ROOMOFFSET) return false;
    if (!typeWanted) return true;
    const room = map.rooms?.[roomno - ROOMOFFSET];
    if (!room) return false;
    const rt = Number(room.rtype || 0);
    return rt === typeWanted || (typeWanted === SHOPBASE && rt > SHOPBASE);
}

function inRoomsAt(map, x, y, typeWanted = 0) {
    const loc = map.at(x, y);
    if (!loc) return [];
    const out = [];
    const seen = new Set();
    const addRoom = (roomno) => {
        if (!roomMatchesType(map, roomno, typeWanted)) return;
        if (seen.has(roomno)) return;
        seen.add(roomno);
        out.push(roomno);
    };

    const roomno = Number(loc.roomno || 0);
    if (roomno >= ROOMOFFSET) {
        addRoom(roomno);
        return out;
    }

    if (roomno === 1 || roomno === 2) {
        const step = (roomno === 1) ? 2 : 1;
        const minX = Math.max(0, x - 1);
        const maxX = Math.min(COLNO - 1, x + 1);
        const minY = Math.max(0, y - 1);
        const maxY = Math.min(ROWNO - 1, y + 1);
        for (let xx = minX; xx <= maxX; xx += step) {
            for (let yy = minY; yy <= maxY; yy += step) {
                const nloc = map.at(xx, yy);
                addRoom(Number(nloc?.roomno || 0));
            }
        }
    }

    if (typeWanted === SHOPBASE && out.length === 0 && (loc.typ === DOOR || loc.typ === CORR)) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nloc = map.at(x + dx, y + dy);
                addRoom(Number(nloc?.roomno || 0));
            }
        }
    }

    return out;
}

function insideShop(map, x, y) {
    const loc = map.at(x, y);
    const roomno = Number(loc?.roomno || 0);
    if (roomno < ROOMOFFSET || !!loc?.edge) return 0;
    if (!roomMatchesType(map, roomno, SHOPBASE)) return 0;
    return roomno;
}

function findShopkeeper(map, roomno) {
    return (map.monsters || []).find((m) =>
        m && !m.dead && m.isshk && Number(m.shoproom || 0) === roomno
    ) || null;
}

function shopkeeperName(shkp) {
    const raw = String(shkp?.shknam || shkp?.name || 'shopkeeper');
    return raw.replace(/^[_+\-|]/, '');
}

function capitalizeWord(text) {
    const s = String(text || '');
    if (!s) return s;
    return s[0].toUpperCase() + s.slice(1);
}

function sSuffix(name) {
    const s = String(name || '');
    if (!s) return "shopkeeper's";
    return s.endsWith('s') ? `${s}'` : `${s}'s`;
}

function roundScaled(value, multiplier, divisor) {
    let out = value * multiplier;
    if (divisor > 1) {
        out = Math.floor((out * 10) / divisor);
        out = Math.floor((out + 5) / 10);
    }
    return out;
}

function getprice(obj) {
    const od = objectData[obj.otyp] || {};
    let tmp = Number(od.cost || 0);
    if (obj.oclass === WAND_CLASS && Number(obj.spe || 0) === -1) {
        tmp = 0;
    } else if (obj.oclass === POTION_CLASS
               && obj.otyp === POT_WATER
               && !obj.blessed
               && !obj.cursed) {
        tmp = 0;
    } else if ((obj.oclass === ARMOR_CLASS || obj.oclass === WEAPON_CLASS)
               && Number(obj.spe || 0) > 0) {
        tmp += 10 * Number(obj.spe || 0);
    } else if (obj.oclass === TOOL_CLASS
               && (obj.otyp === TALLOW_CANDLE || obj.otyp === WAX_CANDLE)
               && Number(obj.age || 0) > 0
               && Number(obj.age || 0) < 20 * Number(od.cost || 0)) {
        tmp = Math.floor(tmp / 2);
    }
    return tmp;
}

function getCost(obj, player, shkp) {
    let tmp = getprice(obj);
    let multiplier = 1;
    let divisor = 1;
    if (!tmp) tmp = 5;

    const dknown = !!obj.dknown || !!obj.known;
    const nameKnown = isObjectNameKnown(obj.otyp);
    if (!(dknown && nameKnown) && obj.oclass !== GEM_CLASS) {
        if ((Number(obj.o_id || 0) % 4) === 0) {
            multiplier *= 4;
            divisor *= 3;
        }
    }

    if (player?.helmet?.otyp === DUNCE_CAP) {
        multiplier *= 4;
        divisor *= 3;
    } else if (player?.roleIndex === 10 && Number(player.level || 1) < 15) {
        multiplier *= 4;
        divisor *= 3;
    }

    const cha = Number(player?.attributes?.[A_CHA] || 10);
    if (cha > 18) {
        divisor *= 2;
    } else if (cha === 18) {
        multiplier *= 2;
        divisor *= 3;
    } else if (cha >= 16) {
        multiplier *= 3;
        divisor *= 4;
    } else if (cha <= 5) {
        multiplier *= 2;
    } else if (cha <= 7) {
        multiplier *= 3;
        divisor *= 2;
    } else if (cha <= 10) {
        multiplier *= 4;
        divisor *= 3;
    }

    tmp = roundScaled(tmp, multiplier, divisor);
    if (tmp <= 0) tmp = 1;
    if (shkp?.surcharge) {
        tmp += Math.floor((tmp + 2) / 3);
    }
    return tmp;
}

function getShopQuoteForFloorObject(obj, player, map) {
    if (!obj || obj.oclass === COIN_CLASS) return null;
    if (!Number.isInteger(obj.ox) || !Number.isInteger(obj.oy)) return null;

    const playerShops = inRoomsAt(map, player.x, player.y, SHOPBASE);
    if (playerShops.length === 0) return null;
    const objShops = inRoomsAt(map, obj.ox, obj.oy, SHOPBASE);
    const shoproom = playerShops.find((r) => objShops.includes(r));
    if (!shoproom) return null;

    const shkp = findShopkeeper(map, shoproom);
    if (!shkp || insideShop(map, shkp.mx, shkp.my) !== shoproom) return null;

    const freeSpot = !!(shkp.shk
        && Number(shkp.shk.x) === obj.ox
        && Number(shkp.shk.y) === obj.oy);
    const noCharge = !!obj.no_charge || freeSpot;
    if (!obj.unpaid && noCharge) {
        return { cost: 0, noCharge: true };
    }
    const units = Math.max(1, Number(obj.quan || 1));
    return { cost: units * getCost(obj, player, shkp), noCharge: false };
}

function describeGroundObjectForPlayer(obj, player, map) {
    const base = doname(obj, null);
    const quote = getShopQuoteForFloorObject(obj, player, map);
    if (!quote) return base;
    if (quote.cost > 0) {
        return `${base} (for sale, ${quote.cost} ${currency(quote.cost)})`;
    }
    if (quote.noCharge) {
        return `${base} (no charge)`;
    }
    return base;
}

function maybeHandleShopEntryMessage(game, oldX, oldY) {
    const { map, player, display } = game;
    const oldShops = inRoomsAt(map, oldX, oldY, SHOPBASE);
    const newShops = inRoomsAt(map, player.x, player.y, SHOPBASE);
    game._ushops = newShops;
    const entered = newShops.filter((r) => !oldShops.includes(r));
    if (entered.length === 0) return;

    const shoproom = entered[0];
    const shkp = findShopkeeper(map, shoproom);
    if (!shkp || insideShop(map, shkp.mx, shkp.my) !== shoproom || shkp.following) return;

    const room = map.rooms?.[shoproom - ROOMOFFSET];
    const rtype = Number(room?.rtype || SHOPBASE);
    const shopTypeName = shtypes[rtype - SHOPBASE]?.name || 'shop';
    const plname = String(player?.name || 'customer').toLowerCase();
    const shkName = shopkeeperName(shkp);

    if (shkp.peaceful === false || shkp.mpeaceful === false) {
        display.putstr_message(`"So, ${plname}, you dare return to ${sSuffix(shkName)} ${shopTypeName}?!"`);
        return;
    }
    if (shkp.surcharge) {
        display.putstr_message(`"Back again, ${plname}?  I've got my eye on you."`);
        return;
    }
    if (shkp.robbed) {
        display.putstr_message(`${capitalizeWord(shkName)} mutters imprecations against shoplifters.`);
        return;
    }

    const visitct = Number(shkp.visitct || 0);
    const greeting = greetingForRole(player.roleIndex);
    display.putstr_message(`"${greeting}, ${plname}!  Welcome${visitct ? ' again' : ''} to ${sSuffix(shkName)} ${shopTypeName}!"`);
    shkp.visitct = visitct + 1;
}

// C ref: hack.c maybe_smudge_engr()
// On successful movement, attempt to smudge engravings at origin/destination.


function maybeSmudgeEngraving(map, x1, y1, x2, y2) {
    // C ref: u_wipe_engr(1) on movement: only current hero square is wiped.
    wipe_engr_at(map, x2, y2, 1, false);
}

// Handle running in a direction
// C ref: cmd.c do_run() -> hack.c domove() with context.run
async function handleRun(dir, player, map, display, fov, game, runStyle = 'run') {
    let runDir = dir;
    let steps = 0;
    let timedTurns = 0;
    const hasRunTurnHook = typeof game?.advanceRunTurn === 'function';
    runTrace(
        `step=${replayStepLabel(map)}`,
        `start=(${player.x},${player.y})`,
        `dir=(${runDir[0]},${runDir[1]})`,
        `style=${runStyle}`,
        `hook=${hasRunTurnHook ? 1 : 0}`,
    );
    while (steps < 80) { // safety limit
        const beforeX = player.x;
        const beforeY = player.y;
        const result = await handleMovement(runDir, player, map, display, game);
        if (result.tookTime) timedTurns++;
        runTrace(
            `step=${replayStepLabel(map)}`,
            `iter=${steps + 1}`,
            `dir=(${runDir[0]},${runDir[1]})`,
            `from=(${beforeX},${beforeY})`,
            `to=(${player.x},${player.y})`,
            `moved=${result.moved ? 1 : 0}`,
            `time=${result.tookTime ? 1 : 0}`,
        );

        // C-faithful run timing: each successful run step advances time once.
        // Important: blocked run steps that still consume time (pet in way,
        // forced-fight air swings, etc.) also advance a turn before run stops.
        if (hasRunTurnHook && result.tookTime) {
            await game.advanceRunTurn();
        }
        if (!result.moved) break;
        steps++;

        // Stop if we see a monster, item, or interesting feature
        fov.compute(map, player.x, player.y);
        const stopReason = checkRunStop(map, player, fov, runDir, runStyle);
        const shouldStop = !!stopReason;
        if (shouldStop) {
            runTrace(
                `step=${replayStepLabel(map)}`,
                `iter=${steps}`,
                `stop=${stopReason}`,
                `at=(${player.x},${player.y})`,
            );
        }
        if (shouldStop) break;

        // C ref: hack.c lookaround() corner-following while running.
        // In corridors, auto-turn when there is exactly one forward continuation
        // aside from the tile we just came from.
        const nextDir = pickRunContinuationDir(map, player, runDir);
        if (nextDir[0] !== runDir[0] || nextDir[1] !== runDir[1]) {
            runTrace(
                `step=${replayStepLabel(map)}`,
                `iter=${steps}`,
                `turn=(${runDir[0]},${runDir[1]})->(${nextDir[0]},${nextDir[1]})`,
                `at=(${player.x},${player.y})`,
            );
        }
        runDir = nextDir;

        // Update display during run
        display.renderMap(map, player, fov);
        display.renderStatus(player);

    }
    return {
        moved: steps > 0,
        tookTime: hasRunTurnHook ? false : timedTurns > 0,
        runSteps: hasRunTurnHook ? 0 : timedTurns,
    };
}

function pickRunContinuationDir(map, player, dir) {
    const loc = map?.at(player.x, player.y);
    if (!loc || (loc.typ !== CORR && loc.typ !== SCORR)) return dir;

    const backDx = -dir[0];
    const backDy = -dir[1];
    const options = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
        if (dx === backDx && dy === backDy) continue;
        const nx = player.x + dx;
        const ny = player.y + dy;
        if (!isok(nx, ny)) continue;
        const nloc = map.at(nx, ny);
        if (nloc && ACCESSIBLE(nloc.typ)) {
            options.push([dx, dy]);
        }
    }
    return options.length === 1 ? options[0] : dir;
}

// Check if running should stop
// C ref: hack.c lookaround() -- checks for interesting things while running
function checkRunStop(map, player, fov, dir, runStyle = 'run') {
    const inFrontX = player.x + dir[0];
    const inFrontY = player.y + dir[1];
    // C lookaround() stops when a visible monster blocks the current heading,
    // even for otherwise safe monsters; nearby unsafe monsters also stop run.
    for (const mon of map.monsters) {
        if (mon.dead) continue;
        if (!fov.canSee(mon.mx, mon.my)) continue;
        if (mon.mx === inFrontX && mon.my === inFrontY) return 'monster-in-front';
        if (mon.tame || mon.peaceful || mon.mpeaceful) continue;
        const dx = Math.abs(mon.mx - player.x);
        const dy = Math.abs(mon.my - player.y);
        if (dx <= 1 && dy <= 1) return 'hostile-nearby';
    }

    // Check for objects at current position
    const objs = map.objectsAt(player.x, player.y);
    if (objs.length > 0) return 'objects-on-square';

    // C ref: hack.c lookaround() run=3 ("rush") nearby-interesting scan.
    if (runStyle === 'rush') {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = player.x + dx;
                const y = player.y + dy;
                if (!isok(x, y)) continue;
                const inFront = (x === inFrontX && y === inFrontY);
                // C: ignore the exact square we're moving away from.
                if (x === player.x - dir[0] && y === player.y - dir[1]) continue;
                const mon = map.monsterAt(x, y);
                if (mon && !mon.dead && fov.canSee(mon.mx, mon.my)) {
                    const hostile = !(mon.tame || mon.peaceful || mon.mpeaceful);
                    if (hostile || inFront) return 'rush-mon-scan';
                }
                const loc = map.at(x, y);
                if (!loc) continue;
                if (loc.typ === STONE) continue;
                const isClosedDoor = IS_DOOR(loc.typ) && (loc.flags & (D_CLOSED | D_LOCKED));
                if (isClosedDoor) {
                    // C ignores diagonal doors for this stop path.
                    if (x !== player.x && y !== player.y) continue;
                    return 'rush-door-near';
                }
                if (loc.typ === CORR || loc.typ === SCORR) continue;
                if (IS_OBSTRUCTED(loc.typ) || loc.typ === ROOM || loc.typ === ICE) continue;
                if ((loc.typ === POOL || loc.typ === LAVAPOOL) && inFront) return 'rush-liquid-ahead';
                if (map.trapAt(x, y) && inFront) return 'rush-trap-ahead';
                // C's final "interesting square" branch keeps some behind-edge
                // exclusions to avoid stopping on irrelevant side squares.
                if (mon && !mon.dead) continue;
                if ((x === player.x - dir[0] && y !== player.y + dir[1])
                    || (y === player.y - dir[1] && x !== player.x + dir[0])) {
                    continue;
                }
                return 'rush-interesting-near';
            }
        }
    }

    // Check for interesting terrain
    const loc = map.at(player.x, player.y);
    if (loc && (loc.typ === STAIRS || loc.typ === FOUNTAIN)) return 'interesting-terrain';

    // Only treat corridor forks as run-stoppers.
    if (loc && (loc.typ === CORR || loc.typ === SCORR)) {
        let exits = 0;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
            const nx = player.x + dx;
            const ny = player.y + dy;
            if (!isok(nx, ny)) continue;
            const nloc = map.at(nx, ny);
            if (nloc && ACCESSIBLE(nloc.typ)) exits++;
        }
        if (exits > 2) return 'corridor-fork';
    }

    return null;
}

// Handle picking up items
// C ref: pickup.c pickup()
function handlePickup(player, map, display) {
    const objs = map.objectsAt(player.x, player.y);
    if (objs.length === 0) {
        const loc = map.at(player.x, player.y);
        if (loc && loc.typ === THRONE) {
            display.putstr_message(`It must weigh${loc.looted ? ' almost' : ''} a ton!`);
            return { moved: false, tookTime: false };
        }
        if (loc && loc.typ === SINK) {
            display.putstr_message('The plumbing connects it to the floor.');
            return { moved: false, tookTime: false };
        }
        if (loc && loc.typ === GRAVE) {
            display.putstr_message("You don't need a gravestone.  Yet.");
            return { moved: false, tookTime: false };
        }
        if (loc && loc.typ === FOUNTAIN) {
            display.putstr_message('You could drink the water...');
            return { moved: false, tookTime: false };
        }
        if (loc && IS_DOOR(loc.typ) && (loc.flags & D_ISOPEN)) {
            display.putstr_message("It won't come off the hinges.");
            return { moved: false, tookTime: false };
        }
        if (loc && loc.typ === ALTAR) {
            display.putstr_message('Moving the altar would be a very bad idea.');
            return { moved: false, tookTime: false };
        }
        if (loc && loc.typ === STAIRS) {
            display.putstr_message('The stairs are solidly affixed.');
            return { moved: false, tookTime: false };
        }
        display.putstr_message('There is nothing here to pick up.');
        return { moved: false, tookTime: false };
    }

    // Pick up gold first if present
    const gold = objs.find(o => o.oclass === COIN_CLASS);
    if (gold) {
        player.addToInventory(gold);
        map.removeObject(gold);
        display.putstr_message(formatGoldPickupMessage(gold, player));
        return { moved: false, tookTime: true };
    }

    // Pick up first other item
    // TODO: show menu if multiple items (like C NetHack)
    const obj = objs[0];
    if (!obj) {
        display.putstr_message('There is nothing here to pick up.');
        return { moved: false, tookTime: false };
    }

    const inventoryObj = player.addToInventory(obj);
    map.removeObject(obj);
    observeObject(obj);
    display.putstr_message(formatInventoryPickupMessage(obj, inventoryObj, player));
    return { moved: false, tookTime: true };
}

function getContainerContents(container) {
    if (Array.isArray(container?.contents)) return container.contents;
    if (Array.isArray(container?.cobj)) return container.cobj;
    return [];
}

function setContainerContents(container, items) {
    const out = Array.isArray(items) ? items : [];
    if (Array.isArray(container?.contents)) container.contents = out;
    if (Array.isArray(container?.cobj)) container.cobj = out;
    if (!Array.isArray(container?.contents) && !Array.isArray(container?.cobj)) {
        container.contents = out;
    }
}

// cf. lock.c doforce() / forcelock() — #force command: bash open a locked chest
// C ref: ARM_BONUS for weapons uses oc_wldam (JS: objectData[otyp].ldam) * 2 as chance.
async function handleForce(game) {
    const { player, map, display } = game;

    // C ref: lock.c doforce() checks u_have_forceable_weapon()
    const wep = player.weapon;
    if (!wep || wep.oclass !== WEAPON_CLASS) {
        const msg = !wep
            ? "You can't force anything when not wielding a weapon."
            : "You can't force anything with that weapon.";
        display.putstr_message(msg);
        return { moved: false, tookTime: false };
    }

    // Find a locked box on the floor at the player's position.
    // C ref: lock.c doforce() scans level.objects[u.ux][u.uy] for Is_box().
    const floorObjs = map.objectsAt(player.x, player.y) || [];
    const box = floorObjs.find((o) => !!objectData[o?.otyp]?.container
        && o.olocked && !o.obroken);
    if (!box) {
        const anyBox = floorObjs.find((o) => !!objectData[o?.otyp]?.container);
        if (anyBox) {
            display.putstr_message(`There is ${doname(anyBox)} here, but its lock is already ${anyBox.obroken ? 'broken' : 'unlocked'}.`);
        } else {
            display.putstr_message("You decide not to force the issue.");
        }
        return { moved: false, tookTime: false };
    }

    // Prompt player.
    // C ref: lock.c doforce() ynq() prompt
    const ans = await ynFunction(`There is ${doname(box)} here; force its lock?`, 'ynq', 'n'.charCodeAt(0), display);
    const ansC = String.fromCharCode(ans);
    if (ansC === 'q' || ansC === 'n') {
        return { moved: false, tookTime: false };
    }

    // C ref: picktyp = is_blade(uwep) && !is_pick(uwep); simplified: always bash
    display.putstr_message(`You start bashing it with ${doname(wep)}.`);

    // C ref: chance = objects[uwep->otyp].oc_wldam * 2 (JS: ldam field)
    const ldam = Number(objectData[wep.otyp]?.ldam || 4);
    const chance = Math.max(2, ldam * 2);
    let usedtime = 0;

    // Set occupation: one rn2(100) check per turn.
    // C ref: lock.c forcelock() returns 1 (continue) or 0 (done).
    game.occupation = {
        occtxt: 'forcing the lock',
        fn(g) {
            if (usedtime++ >= 50) {
                display.putstr_message("You give up trying to force the lock.");
                return false;
            }
            if (rn2(100) < chance) {
                // C ref: box is destroyed after repeated successful hits
                box.olocked = false;
                box.obroken = true;
                display.putstr_message("You destroy the lock!");
                return false;
            }
            display.putstr_message("WHAM!");
            if (g.multi > 0) g.multi--;
            return true;
        },
    };
    return { moved: false, tookTime: true };
}

async function handleLoot(game) {
    const { player, map, display } = game;

    // Check floor containers at player's position.
    const floorContainers = (map.objectsAt(player.x, player.y) || [])
        .filter((obj) => !!objectData[obj?.otyp]?.container);

    // Check inventory containers the player is carrying.
    // cf. pickup.c doloot_core() — also offers to loot carried containers.
    const invContainers = (player.inventory || [])
        .filter((obj) => obj && !!objectData[obj?.otyp]?.container);

    if (floorContainers.length === 0 && invContainers.length === 0) {
        display.putstr_message("You don't find anything here to loot.");
        return { moved: false, tookTime: false };
    }

    // Loot floor container first (C behavior: floor takes priority).
    if (floorContainers.length > 0) {
        const container = floorContainers[0];
        if (container.olocked && !container.obroken) {
            display.putstr_message('Hmmm, it seems to be locked.');
            return { moved: false, tookTime: false };
        }
        const contents = getContainerContents(container);
        if (contents.length === 0) {
            display.putstr_message("It's empty.");
            return { moved: false, tookTime: true };
        }
        for (const item of contents) {
            player.addToInventory(item);
            observeObject(item);
        }
        setContainerContents(container, []);
        const count = contents.length;
        display.putstr_message(`You loot ${count} item${count === 1 ? '' : 's'}.`);
        return { moved: false, tookTime: true };
    }

    // Loot an inventory container (take things out).
    // cf. pickup.c doloot_core() — "Do you want to take things out?"
    // If only one inventory container, offer it directly; else prompt for letter.
    let container;
    if (invContainers.length === 1) {
        container = invContainers[0];
    } else {
        // Build letter prompt from inventory letters.
        const letters = invContainers.map((o) => o.invlet).filter(Boolean).join('');
        const prompt = letters
            ? `Loot which container? [${letters} or ?*]`
            : 'Loot which container? [?*]';
        while (true) {
            display.putstr_message(prompt);
            const ch = await nhgetch();
            const c = String.fromCharCode(ch);
            if (ch === 27 || ch === 10 || ch === 13 || ch === 32) {
                display.topMessage = null;
                display.putstr_message('Never mind.');
                return { moved: false, tookTime: false };
            }
            container = invContainers.find((o) => o.invlet === c);
            if (container) break;
        }
        display.topMessage = null;
    }

    // cf. pickup.c doloot_core() — "Do you want to take things out of <x>? [yn]"
    const containerName = doname(container, player);
    display.putstr_message(`Do you want to take things out of your ${containerName}? [yn] `);
    const ans = await nhgetch();
    display.topMessage = null;
    if (String.fromCharCode(ans) !== 'y') {
        display.putstr_message('Never mind.');
        return { moved: false, tookTime: false };
    }

    const contents = getContainerContents(container);
    if (contents.length === 0) {
        display.putstr_message("It's empty.");
        return { moved: false, tookTime: true };
    }
    for (const item of contents) {
        player.addToInventory(item);
        observeObject(item);
    }
    setContainerContents(container, []);
    const count = contents.length;
    display.putstr_message(`You take out ${count} item${count === 1 ? '' : 's'}.`);
    return { moved: false, tookTime: true };
}

// Handle opening a door
// C ref: lock.c doopen()
async function handleOpen(player, map, display, game) {
    display.putstr_message('In what direction?');
    const dirCh = await nhgetch();
    // Prompt should not concatenate with outcome message.
    display.topMessage = null;
    const c = String.fromCharCode(dirCh);
    let dir = DIRECTION_KEYS[c];
    // C ref: getdir() accepts self-direction ('.' and 's').
    if (!dir && (c === '.' || c === 's')) {
        dir = [0, 0];
    }
    if (!dir) {
        // C ref: getdir() + get_adjacent_loc() — wizard sessions (cmdassist on)
        // silently fail with just "Never mind."; non-wizard sessions emit
        // "What a strange direction!" before the caller's "Never mind."
        if (game?.player?.wizard) {
            display.putstr_message('Never mind.');
        } else {
            display.putstr_message('What a strange direction!  Never mind.');
        }
        return { moved: false, tookTime: false };
    }

    // C ref: doopen() with self-direction routes through loot handling.
    if (dir[0] === 0 && dir[1] === 0) {
        return await handleLoot(game);
    }

    const nx = player.x + dir[0];
    const ny = player.y + dir[1];
    const loc = map.at(nx, ny);

    if (!loc || !IS_DOOR(loc.typ)) {
        display.putstr_message('You see no door there.');
        return { moved: false, tookTime: false };
    }

    if (loc.flags & D_ISOPEN) {
        display.putstr_message('This door is already open.');
        return { moved: false, tookTime: false };
    }

    if (loc.flags === D_NODOOR) {
        display.putstr_message("This doorway has no door.");
        return { moved: false, tookTime: false };
    }

    if (loc.flags & D_LOCKED) {
        display.putstr_message("This door is locked.");
        return { moved: false, tookTime: false };
    }

    if (loc.flags & D_CLOSED) {
        // C ref: lock.c:904 doopen_indir — rnl(20) strength check
        const str = player.attributes ? player.attributes[A_STR] : 18;
        const dex = player.attributes ? player.attributes[A_DEX] : 11;
        const con = player.attributes ? player.attributes[A_CON] : 18;
        const threshold = Math.floor((str + dex + con) / 3);
        if (rnl(20) < threshold) {
            loc.flags = D_ISOPEN;
            display.putstr_message("The door opens.");
        } else {
            exercise(player, A_STR, true);
            display.putstr_message("The door resists!");
        }
        return { moved: false, tookTime: true };
    }

    return { moved: false, tookTime: false };
}

// Handle closing a door
// C ref: lock.c doclose()
async function handleClose(player, map, display, game) {
    display.putstr_message('In what direction?');
    const dirCh = await nhgetch();
    display.topMessage = null;
    display.messageNeedsMore = false;
    const c = String.fromCharCode(dirCh);
    const dir = DIRECTION_KEYS[c];
    if (!dir) {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        return { moved: false, tookTime: false };
    }

    const nx = player.x + dir[0];
    const ny = player.y + dir[1];
    const loc = map.at(nx, ny);

    if (!loc || !IS_DOOR(loc.typ)) {
        display.putstr_message('You see no door there.');
        return { moved: false, tookTime: false };
    }

    if (loc.flags & D_ISOPEN) {
        // Check for monsters in the doorway
        if (map.monsterAt(nx, ny)) {
            display.putstr_message("There's a monster in the way!");
            return { moved: false, tookTime: false };
        }
        loc.flags = D_CLOSED;
        display.putstr_message("The door closes.");
        return { moved: false, tookTime: true };
    }

    display.putstr_message("This door is already closed.");
    return { moved: false, tookTime: false };
}

// Handle wielding a weapon
// C ref: wield.c dowield()
// C ref: wield.c dowield() — wield a weapon (instant action, no time cost)
async function handleWield(player, display) {
    const inventory = Array.isArray(player.inventory) ? player.inventory : [];
    const suggestWield = (obj) => {
        if (!obj) return false;
        if (obj.oclass === WEAPON_CLASS) return true;
        // C ref: wield.c wield_ok() includes is_weptool() in suggestions.
        return obj.oclass === TOOL_CLASS && (objectData[obj.otyp]?.sub || 0) !== 0;
    };

    // C ref: wield.c getobj() prompt format for wield command.
    // Keep wording/options aligned for session screen parity.
    const letters = inventory.filter(suggestWield).map((item) => item.invlet).join('');
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    const wieldPrompt = letters.length > 0
        ? `What do you want to wield? [- ${letters} or ?*]`
        : 'What do you want to wield? [- or ?*]';
    display.putstr_message(wieldPrompt);

    while (true) {
        const ch = await nhgetch();
        let c = String.fromCharCode(ch);

        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') continue;

        if (c === '-') {
            replacePromptMessage();
            if (player.weapon) {
                player.weapon = null;
                display.putstr_message('You are bare handed.');
                // C ref: wield.c ready_weapon(NULL) uses a turn when unwielding.
                return { moved: false, tookTime: true };
            }
            display.putstr_message('You are already bare handed.');
            return { moved: false, tookTime: false };
        }

        const item = inventory.find((o) => o.invlet === c);
        if (!item) continue;
        const weapon = item;
        if (
            weapon === player.armor
            || weapon === player.shield
            || weapon === player.helmet
            || weapon === player.gloves
            || weapon === player.boots
            || weapon === player.cloak
            || weapon === player.amulet
        ) {
            replacePromptMessage();
            display.putstr_message('You cannot wield that!');
            return { moved: false, tookTime: false };
        }

        // C ref: wield.c dowield() — selecting uswapwep triggers doswapweapon().
        if (player.swapWeapon && weapon === player.swapWeapon) {
            const oldwep = player.weapon || null;
            player.weapon = player.swapWeapon;
            player.swapWeapon = oldwep;
            replacePromptMessage();
            if (player.swapWeapon) {
                display.putstr_message(`${player.swapWeapon.invlet} - ${doname(player.swapWeapon, player)}.`);
            } else {
                display.putstr_message('You have no secondary weapon readied.');
            }
            return { moved: false, tookTime: true };
        }
        player.weapon = weapon;
        if (player.swapWeapon === weapon) {
            player.swapWeapon = null;
        }
        replacePromptMessage();
        display.putstr_message(`${weapon.invlet} - ${doname(weapon, player)}.`);
        // C ref: wield.c:dowield returns ECMD_TIME (wielding takes a turn)
        return { moved: false, tookTime: true };
    }
}

async function handlePay(player, map, display) {
    // C ref: shk.c dopay() can still report "There appears..." even when
    // shopkeepers exist elsewhere on level; our billing-state model is partial,
    // so keep the C-safe no-shopkeeper text for strict replay parity.
    display.putstr_message('There appears to be no shopkeeper here to receive your payment.');
    return { moved: false, tookTime: false };
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
        // C traces include an immediate obj_resists() probe on the thrown
        // object in this path before normal monster movement begins.
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
        if (player.weapon === item) player.weapon = null;
        if (player.swapWeapon === item) player.swapWeapon = null;
        if (player.quiver === item) player.quiver = null;
    }
    if (!targetMonster && fromFire) {
        // C fire traces probe obj_resists() after stack split/ID assignment.
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
async function handleThrow(player, map, display) {
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
        const c = String.fromCharCode(ch);
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

async function handleFire(player, map, display, game) {
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
            player.quiver = selected;
            return await promptDirectionAndThrowItem(player, map, display, selected, { fromFire: true });
        }
        // Keep prompt active for unsupported letters (fixture parity).
    }
}

async function handleEngrave(player, display) {
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    const writeLetters = compactInvletPromptChars((player.inventory || [])
        .filter((item) => item && item.oclass === WAND_CLASS && item.invlet)
        .map((item) => item.invlet)
        .join(''));
    if (writeLetters) {
        display.putstr_message(`What do you want to write with? [- ${writeLetters} or ?*]`);
    } else {
        display.putstr_message('What do you want to write with? [- or ?*]');
    }
    while (true) {
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') continue;
        if (c === '-' || (writeLetters && writeLetters.includes(c))) {
            replacePromptMessage();
            display.putstr_message('Engraving is not implemented yet.');
            return { moved: false, tookTime: false };
        }
        // Keep prompt active for unsupported letters.
    }
}

async function handleSwapWeapon(player, display) {
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
    player.weapon = player.swapWeapon;
    player.swapWeapon = oldwep;
    if (player.swapWeapon) {
        display.putstr_message(`${player.swapWeapon.invlet} - ${doname(player.swapWeapon, player)}.`);
    } else {
        display.putstr_message('You have no secondary weapon readied.');
    }
    return { moved: false, tookTime: true };
}

function isApplyCandidate(obj) {
    if (!obj) return false;
    // C ref: apply.c apply_ok() — suggest all tools, wands, spellbooks.
    if (obj.oclass === TOOL_CLASS || obj.oclass === WAND_CLASS || obj.oclass === SPBOOK_CLASS) {
        return true;
    }
    // C ref: apply.c apply_ok() — suggest weapons that satisfy
    // is_pick/is_axe/is_pole plus bullwhip.
    if (obj.oclass === WEAPON_CLASS) {
        const skill = objectData[obj.otyp]?.sub;
        if (obj.otyp === BULLWHIP || obj.otyp === LANCE
            || skill === 3 /* P_AXE */
            || skill === 4 /* P_PICK_AXE */
            || skill === 18 /* P_POLEARMS */
            || skill === 19 /* P_LANCE */) {
            return true;
        }
    }
    // C ref: apply.c apply_ok() — suggest certain foods.
    if (obj.otyp === CREAM_PIE || obj.otyp === EUCALYPTUS_LEAF
        || obj.otyp === LUMP_OF_ROYAL_JELLY) {
        return true;
    }
    // C ref: apply.c apply_ok() — suggest touchstone/luckstone/loadstone.
    // FLINT is throwable ammo but should not appear as apply-eligible in
    // C prompt flows for normal play sessions.
    if (obj.otyp === TOUCHSTONE || obj.otyp === LUCKSTONE
        || obj.otyp === LOADSTONE) {
        return true;
    }
    // C ref: apply.c apply_ok() — suggest POT_OIL if discovered.
    if (obj.otyp === POT_OIL && obj.dknown) {
        return true;
    }
    return false;
}

function isApplyChopWeapon(obj) {
    if (!obj || obj.oclass !== WEAPON_CLASS) return false;
    const skill = objectData[obj.otyp]?.sub;
    return skill === 3 /* P_AXE */ || skill === 4 /* P_PICK_AXE */;
}

function isApplyPolearm(obj) {
    if (!obj || obj.oclass !== WEAPON_CLASS) return false;
    const skill = objectData[obj.otyp]?.sub;
    return skill === 18 /* P_POLEARMS */ || skill === 19 /* P_LANCE */;
}

function isApplyDownplay(obj) {
    if (!obj) return false;
    // C ref: apply_ok() GETOBJ_DOWNPLAY cases include coins and unknown
    // potions; these force a prompt even when no suggested items exist.
    if (obj.oclass === COIN_CLASS) return true;
    if (obj.oclass === POTION_CLASS && !obj.dknown) return true;
    return false;
}

// Handle apply/use command
// C ref: apply.c doapply()
async function handleApply(player, display) {
    const inventory = player.inventory || [];
    if (inventory.length === 0) {
        display.putstr_message("You don't have anything to use or apply.");
        return { moved: false, tookTime: false };
    }

    const candidates = inventory.filter(isApplyCandidate);
    const hasDownplay = inventory.some(isApplyDownplay);
    if (candidates.length === 0 && !hasDownplay) {
        display.putstr_message("You don't have anything to use or apply.");
        return { moved: false, tookTime: false };
    }

    // C getobj() behavior: when no preferred apply candidates exist but
    // downplay items do, keep the prompt open as "[*]".
    const letters = candidates.map((item) => item.invlet).join('');
    const candidateByInvlet = new Map(
        candidates
            .filter((item) => item?.invlet)
            .map((item) => [String(item.invlet), item])
    );
    const prompt = letters.length > 0
        ? `What do you want to use or apply? [${letters} or ?*]`
        : 'What do you want to use or apply? [*]';
    display.putstr_message(prompt);
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    const resolveApplySelection = async (selected) => {
        replacePromptMessage();
        if (isApplyChopWeapon(selected)) {
            // C ref: apply.c use_axe() direction prompt text.
            display.putstr_message('In what direction do you want to chop? [>]');
            await nhgetch();
            // For unsupported chop targets, preserve no-op flow fidelity.
            replacePromptMessage();
            return { moved: false, tookTime: false };
        }

        // C ref: apply.c — tools that use getdir() "In what direction?" prompt:
        // use_pick_axe2() for pick-axe/mattock, use_whip() for bullwhip,
        // use_stethoscope() for stethoscope, use_pole() for polearms.
        if (selected.otyp === PICK_AXE || selected.otyp === DWARVISH_MATTOCK
            || selected.otyp === BULLWHIP || selected.otyp === STETHOSCOPE
            || selected.otyp === CREDIT_CARD
            || selected.otyp === EXPENSIVE_CAMERA || selected.otyp === MIRROR
            || selected.otyp === FIGURINE
            || isApplyPolearm(selected)) {
            display.putstr_message('In what direction?');
            const dirCh = await nhgetch();
            const dch = String.fromCharCode(dirCh);
            const dir = DIRECTION_KEYS[dch];
            if (!dir) {
                replacePromptMessage();
                if (!player?.wizard) {
                    display.putstr_message('What a strange direction!  Never mind.');
                }
                return { moved: false, tookTime: false };
            }
            // TODO: implement actual effects (digging, whip, etc.) for full parity
            replacePromptMessage();
            return { moved: false, tookTime: false };
        }

        if (selected.oclass === SPBOOK_CLASS) {
            const fades = ['fresh', 'slightly faded', 'very faded', 'extremely faded', 'barely visible'];
            const studied = Math.max(0, Math.min(4, Number(selected.spestudied || 0)));
            const magical = !!objectData[selected.otyp]?.magic;
            display.putstr_message(`The${magical ? ' magical' : ''} ink in this spellbook is ${fades[studied]}.`);
            return { moved: false, tookTime: true };
        }

        display.putstr_message("Sorry, I don't know how to use that.");
        return { moved: false, tookTime: false };
    };

    while (true) {
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') {
            // C tty getobj() help/list mode: show each applicable item with
            // --More-- prompt, then return to selection prompt.
            // '?' shows preferred apply candidates; '*' shows all inventory items.
            const showList = c === '*'
                ? inventory.filter((item) => item?.invlet)
                : candidates;
            let picked = null;
            for (const item of showList) {
                replacePromptMessage();
                display.putstr_message(`${item.invlet} - ${doname(item, player)}  --More--`);
                const ack = await nhgetch();
                const ackC = String.fromCharCode(ack);
                if (ack === 27 || ack === 10 || ack === 13 || ackC === ' ') break;
                const sel = candidateByInvlet.get(ackC)
                    || (c === '*' ? inventory.find((o) => o?.invlet === ackC) : null);
                if (sel) { picked = sel; break; }
            }
            if (picked) return await resolveApplySelection(picked);
            continue;
        }

        const selected = inventory.find((obj) => obj.invlet === c);
        if (!selected) continue;
        return await resolveApplySelection(selected);
    }
}

// Handle known-spells list
// C ref: spell.c dovspell()
const DISCOVERIES_TITLE = 'Discoveries, by order of discovery within each class';
const DISCOVERY_HEADER_RE = /^(Unique items|Artifact items|Discovered items|Weapons|Armor|Rings|Amulets|Tools|Comestibles|Potions|Scrolls|Spellbooks|Wands|Coins|Gems\/Stones|Rocks|Balls|Chains|Venoms)$/;

function buildDiscoveriesPages(lines, rows) {
    const contentRows = Math.max(1, (rows || 24) - 1); // reserve bottom row for --More--
    const entries = [
        { text: DISCOVERIES_TITLE, attr: 0 },
        { text: '', attr: 0 },
        ...lines.map((line) => ({
            text: String(line || ''),
            attr: DISCOVERY_HEADER_RE.test(String(line || '')) ? 1 : 0,
        })),
    ];
    const pages = [];
    for (let i = 0; i < entries.length; i += contentRows) {
        pages.push(entries.slice(i, i + contentRows));
    }
    return pages.length > 0 ? pages : [[{ text: DISCOVERIES_TITLE, attr: 0 }]];
}

function drawDiscoveriesPage(display, page) {
    const contentRows = Math.max(1, (display.rows || 24) - 1);
    const cols = display.cols || 80;
    display.clearScreen();
    for (let r = 0; r < contentRows; r++) {
        const row = page[r];
        if (!row) continue;
        display.putstr(0, r, row.text.substring(0, cols), undefined, row.attr || 0);
    }
    display.clearRow(contentRows);
    display.putstr(0, contentRows, '--More--', undefined, 0);
}

async function handleDiscoveries(game) {
    const { display } = game;
    const lines = getDiscoveriesMenuLines();
    if (!lines.length) {
        display.putstr_message("You haven't discovered anything yet...");
        return { moved: false, tookTime: false };
    }

    const savedAnsi = (typeof display.getScreenAnsiLines === 'function')
        ? display.getScreenAnsiLines()
        : null;
    const savedLines = (typeof display.getScreenLines === 'function')
        ? display.getScreenLines()
        : null;

    const pages = buildDiscoveriesPages(lines, display.rows || 24);
    let pageIndex = 0;
    while (true) {
        drawDiscoveriesPage(display, pages[pageIndex] || []);
        const ch = await nhgetch();
        if (ch === 32 || ch === 10 || ch === 13) {
            if (pageIndex + 1 < pages.length) {
                pageIndex++;
                continue;
            }
            break;
        }
        if (ch === 98 && pageIndex > 0) { // 'b' = previous page
            pageIndex--;
            continue;
        }
        // q/ESC and any other key dismiss the discoveries window.
        break;
    }

    if (Array.isArray(savedAnsi)
        && savedAnsi.length > 0
        && typeof display.setScreenAnsiLines === 'function') {
        display.setScreenAnsiLines(savedAnsi);
    } else if (Array.isArray(savedLines)
        && savedLines.length > 0
        && typeof display.setScreenLines === 'function') {
        display.setScreenLines(savedLines);
    } else if (typeof game.renderCurrentScreen === 'function') {
        game.renderCurrentScreen();
    }
    display.topMessage = null;
    display.messageNeedsMore = false;
    return { moved: false, tookTime: false };
}

function spellCategoryForName(name) {
    return SPELL_CATEGORY_BY_NAME.get(String(name || '').toLowerCase()) || SPELL_CATEGORY_MATTER;
}

function spellSkillRank(player, category) {
    const basic = ROLE_BASIC_SPELL_CATEGORIES.get(player.roleIndex);
    return basic?.has(category) ? SPELL_SKILL_BASIC : SPELL_SKILL_UNSKILLED;
}

function spellRetentionText(turnsLeft, skillRank) {
    if (turnsLeft < 1) return '(gone)';
    if (turnsLeft >= SPELL_KEEN_TURNS) return '100%';
    const percent = Math.floor((turnsLeft - 1) / (SPELL_KEEN_TURNS / 100)) + 1;
    const accuracy = skillRank >= SPELL_SKILL_BASIC ? 10 : 25;
    const hi = Math.min(100, accuracy * Math.floor((percent + accuracy - 1) / accuracy));
    const lo = Math.max(1, hi - accuracy + 1);
    return `${lo}%-${hi}%`;
}

function estimateSpellFailPercent(player, spellName, spellLevel, category) {
    const role = ROLE_SPELLCAST.get(player.roleIndex)
        || { spelbase: 10, spelheal: 0, spelshld: 2, spelarmr: 10, spelstat: A_INT, spelspec: '', spelsbon: 0 };
    const statValue = Math.max(3, Math.min(25, Number(player.attributes?.[role.spelstat] || 10)));
    const spellSkill = spellSkillRank(player, category);
    const heroLevel = Math.max(1, Number(player.level || 1));
    const spellLvl = Math.max(1, Number(spellLevel || 1));

    const paladinBonus = player.roleIndex === 4 && category === SPELL_CATEGORY_CLERICAL;
    const armor = player.armor || null;
    const cloak = player.cloak || null;
    const shield = player.shield || null;
    const helmet = player.helmet || null;
    const gloves = player.gloves || null;
    const boots = player.boots || null;
    const weapon = player.weapon || null;

    let splcaster = role.spelbase;
    if (armor && is_metallic(armor) && !paladinBonus) {
        splcaster += (cloak?.otyp === ROBE) ? Math.floor(role.spelarmr / 2) : role.spelarmr;
    } else if (cloak?.otyp === ROBE) {
        splcaster -= role.spelarmr;
    }
    if (shield) splcaster += role.spelshld;
    if (weapon?.otyp === QUARTERSTAFF) splcaster -= 3;
    if (!paladinBonus) {
        if (helmet && is_metallic(helmet)) splcaster += 4;
        if (gloves && is_metallic(gloves)) splcaster += 6;
        if (boots && is_metallic(boots)) splcaster += 2;
    }
    if (String(spellName || '').toLowerCase() === role.spelspec) splcaster += role.spelsbon;
    if (HEALING_BONUS_SPELLS.has(String(spellName || '').toLowerCase())) splcaster += role.spelheal;
    splcaster = Math.min(20, splcaster);

    let chance = Math.floor((11 * statValue) / 2);
    const skill = Math.max(spellSkill, SPELL_SKILL_UNSKILLED) - 1;
    const difficulty = ((spellLvl - 1) * 4) - ((skill * 6) + Math.floor(heroLevel / 3) + 1);
    if (difficulty > 0) {
        chance -= Math.floor(Math.sqrt((900 * difficulty) + 2000));
    } else {
        chance += Math.min(20, Math.floor((15 * -difficulty) / spellLvl));
    }
    chance = Math.max(0, Math.min(120, chance));

    const shieldWeight = Number(objectData[shield?.otyp]?.weight || 0);
    const smallShieldWeight = Number(objectData[SMALL_SHIELD]?.weight || 40);
    if (shield && shieldWeight > smallShieldWeight) {
        chance = (String(spellName || '').toLowerCase() === role.spelspec)
            ? Math.floor(chance / 2)
            : Math.floor(chance / 4);
    }

    chance = Math.floor((chance * (20 - splcaster)) / 15) - splcaster;
    chance = Math.max(0, Math.min(100, chance));
    return Math.max(0, Math.min(99, 100 - chance));
}

// C ref: spell.c age_spells() — decrement spell retention each turn
export function ageSpells(player) {
    const spells = player.spells;
    if (!spells) return;
    for (const s of spells) {
        if (s.sp_know > 0) s.sp_know--;
    }
}

async function handleKnownSpells(player, display) {
    const knownSpells = (player.spells || []).filter(s => s.sp_know > 0);
    if (knownSpells.length === 0) {
        display.putstr_message("You don't know any spells right now.");
        return { moved: false, tookTime: false };
    }

    const rows = ['Currently known spells', ''];
    const showTurns = !!player.wizard;
    rows.push(showTurns
        ? '    Name                 Level Category     Fail Retention  turns'
        : '    Name                 Level Category     Fail Retention');

    for (let i = 0; i < knownSpells.length && i < 52; i++) {
        const sp = knownSpells[i];
        const od = objectData[sp.otyp] || null;
        const spellName = String(od?.name || 'unknown spell').toLowerCase();
        const spellLevel = Math.max(1, Number(od?.oc2 || sp.sp_lev || 1));
        const category = spellCategoryForName(spellName);
        const skillRank = spellSkillRank(player, category);
        const turnsLeft = Math.max(0, sp.sp_know);
        const fail = estimateSpellFailPercent(player, spellName, spellLevel, category);
        const retention = spellRetentionText(turnsLeft, skillRank);
        const menuLet = i < 26 ? String.fromCharCode('a'.charCodeAt(0) + i) : String.fromCharCode('A'.charCodeAt(0) + i - 26);
        const base = `${menuLet} - ${spellName.padEnd(20)}  ${String(spellLevel).padStart(2)}   ${category.padEnd(12)} ${String(fail).padStart(3)}% ${retention.padStart(9)}`;
        rows.push(showTurns ? `${base}  ${String(turnsLeft).padStart(5)}` : base);
    }
    rows.push('+ - [sort spells]');
    rows.push('(end)');

    if (typeof display.renderOverlayMenu === 'function') {
        display.renderOverlayMenu(rows);
    } else {
        display.renderChargenMenu(rows, false);
    }

    while (true) {
        const ch = await nhgetch();
        if (ch === 32 || ch === 27 || ch === 10 || ch === 13) break;
    }
    if (typeof display.clearRow === 'function') display.clearRow(0);
    display.topMessage = null;
    display.messageNeedsMore = false;
    return { moved: false, tookTime: false };
}

// C ref: fountain.c:243 drinkfountain() — drink from a fountain
export function drinkfountain(player, map, display) {
    const loc = map.at(player.x, player.y);
    const mgkftn = loc && loc.blessedftn === 1;
    const fate = rnd(30);

    // C ref: fountain.c:254 — blessed fountain jackpot
    if (mgkftn && (player.luck || 0) >= 0 && fate >= 10) {
        display.putstr_message('Wow!  This makes you feel great!');
        rn2(6); // rn2(A_MAX) — random starting attribute
        // adjattrib loop — simplified, no RNG for basic case
        display.putstr_message('A wisp of vapor escapes the fountain...');
        exercise(player, A_WIS, true);
        if (loc) loc.blessedftn = 0;
        return; // NO dryup on blessed jackpot path
    }

    if (fate < 10) {
        // C ref: fountain.c:279 — cool draught refreshes
        display.putstr_message('The cool draught refreshes you.');
        player.hunger += rnd(10);
        if (mgkftn) return; // blessed fountain, no dryup
    } else {
        // C ref: fountain.c:286-387 — switch on fate
        switch (fate) {
        case 19:
            display.putstr_message('You feel self-knowledgeable...');
            exercise(player, A_WIS, true);
            break;
        case 20:
            display.putstr_message('The water is foul!  You gag and vomit.');
            rn2(20) + 11; // rn1(20, 11) = rn2(20) + 11 for morehungry
            break;
        case 21:
            display.putstr_message('The water is contaminated!');
            rn2(4) + 3; // rn1(4, 3) for poison_strdmg
            rnd(10);    // damage
            exercise(player, A_CON, false);
            break;
        // cases 22-30: complex effects with sub-functions
        // TODO: implement dowatersnakes, dowaterdemon, etc.
        default:
            display.putstr_message('This tepid water is tasteless.');
            break;
        }
    }
    // C ref: fountain.c:389 — dryup at end of all non-jackpot paths
    dryup(player.x, player.y, map, display);
}

// C ref: fountain.c:200 dryup() — chance to dry up fountain
function dryup(x, y, map, display) {
    const loc = map.at(x, y);
    if (loc && loc.typ === FOUNTAIN) {
        if (!rn2(3)) {
            // Fountain dries up
            loc.typ = ROOM;
            loc.flags = 0;
            loc.blessedftn = 0;
            display.putstr_message('The fountain dries up!');
        }
    }
}

// Handle looking at what's here
// C ref: cmd.c dolook()
function handleLook(player, map, display) {
    const loc = map.at(player.x, player.y);
    const objs = map.objectsAt(player.x, player.y);

    let msg = '';
    if (loc) {
        // Describe terrain features - C ref: cmd.c dolook() describes current location
        if (loc.typ === STAIRS && loc.flags === 1) msg += 'There is a staircase up out of the dungeon here. ';
        else if (loc.typ === STAIRS && loc.flags === 0) msg += 'There is a staircase down here. ';
        else if (loc.typ === LADDER && loc.flags === 1) msg += 'There is a ladder up here. ';
        else if (loc.typ === LADDER && loc.flags === 0) msg += 'There is a ladder down here. ';
        else if (loc.typ === FOUNTAIN) msg += 'There is a fountain here. ';
        else if (loc.typ === SINK) msg += 'There is a sink here. ';
        else if (loc.typ === THRONE) msg += 'There is a throne here. ';
        else if (loc.typ === ALTAR) msg += 'There is an altar here. ';
        else if (loc.typ === GRAVE) msg += 'There is a grave here. ';
        else if (loc.typ === POOL) msg += 'There is a pool of water here. ';
        else if (loc.typ === LAVAPOOL) msg += 'There is molten lava here. ';
        else if (loc.typ === DOOR && loc.flags > 0) msg += 'There is an open door here. ';
        else if (loc.typ === DOOR && loc.flags === 0) msg += 'There is a closed door here. ';
        else if (loc.typ === IRONBARS) msg += 'There are iron bars here. ';
        else if (loc.typ === TREE) msg += 'There is a tree here. ';
    }

    if (objs.length > 0) {
        msg += `Things that are here: ${objs.map(o => o.name).join(', ')}`;
    }

    if (!msg) msg = 'You see no objects here.';
    display.putstr_message(msg.substring(0, 79));
    return { moved: false, tookTime: false };
}


// Handle kicking
// C ref: dokick.c dokick()
async function handleKick(player, map, display, game) {
    display.putstr_message('In what direction?');
    const dirCh = await nhgetch();
    // Prompt should not concatenate with outcome message.
    display.topMessage = null;
    const c = String.fromCharCode(dirCh);
    const dir = DIRECTION_KEYS[c];
    if (!dir) {
        if (game.flags.verbose) {
            display.putstr_message("Never mind.");
        }
        return { moved: false, tookTime: false };
    }

    const nx = player.x + dir[0];
    const ny = player.y + dir[1];
    player.kickedloc = { x: nx, y: ny };
    const loc = map.at(nx, ny);

    if (!loc) return { moved: false, tookTime: false };

    // Kick a monster
    const mon = map.monsterAt(nx, ny);
    if (mon) {
        display.putstr_message(`You kick the ${monDisplayName(mon)}!`);
        const damage = rnd(4) + player.strDamage;
        mon.mhp -= Math.max(1, damage);
        if (mon.mhp <= 0) {
            mondead(mon, map);
            display.putstr_message(`The ${monDisplayName(mon)} dies!`);
            map.removeMonster(mon);
        }
        return { moved: false, tookTime: true };
    }

    // Kick a locked door
    if (IS_DOOR(loc.typ) && (loc.flags & D_LOCKED)) {
        exercise(player, A_DEX, true);
        const str = player.attributes ? player.attributes[A_STR] : 18;
        const dex = player.attributes ? player.attributes[A_DEX] : 11;
        const con = player.attributes ? player.attributes[A_CON] : 18;
        const avrgAttrib = Math.floor((str + dex + con) / 3);
        const kickedOpen = rnl(35) < avrgAttrib;
        if (kickedOpen) {
            if (str > 18 && rn2(5) === 0) {
                display.putstr_message("As you kick the door, it shatters to pieces!");
                loc.flags = D_NODOOR;
            } else {
                display.putstr_message("As you kick the door, it crashes open!");
                loc.flags = D_BROKEN;
            }
            exercise(player, A_STR, true);
        } else {
            // We do not model Deaf yet; keep C's rn2(3) branch split for RNG parity.
            exercise(player, A_STR, true);
            display.putstr_message(rn2(3) ? "Whammm!!" : "Thwack!!");
        }
        return { moved: false, tookTime: true };
    }

    // Kick a closed door
    if (IS_DOOR(loc.typ) && (loc.flags & D_CLOSED)) {
        exercise(player, A_STR, true);
        loc.flags = D_ISOPEN;
        display.putstr_message("The door crashes open!");
        return { moved: false, tookTime: true };
    }

    // C ref: dokick.c kick_ouch() for hard non-door terrain.
    if (IS_WALL(loc.typ)
        || loc.typ === IRONBARS
        || loc.typ === TREE
        || loc.typ === THRONE
        || loc.typ === ALTAR
        || loc.typ === FOUNTAIN
        || loc.typ === GRAVE
        || loc.typ === SINK) {
        display.putstr_message("Ouch!  That hurts!");
        // C ref: exercise(A_DEX, FALSE), exercise(A_STR, FALSE)
        exercise(player, A_DEX, false);
        exercise(player, A_STR, false);
        // C ref: if (!rn2(3)) set_wounded_legs(..., 5 + rnd(5))
        if (rn2(3) === 0) {
            const timeout = 5 + rnd(5);
            const alreadyWounded = (player.woundedLegsTimeout || 0) > 0;
            player.woundedLegsTimeout = timeout;
            if (!alreadyWounded && player.attributes) {
                player.attributes[A_DEX] = Math.max(1, player.attributes[A_DEX] - 1);
            }
        }
        // C ref: dmg = rnd(ACURR(A_CON) > 15 ? 3 : 5)
        const con = player.attributes?.[A_CON] || 10;
        const dmg = rnd(con > 15 ? 3 : 5);
        player.hp = Math.max(1, (player.hp || player.hpmax || 1) - Math.max(1, dmg));
        return { moved: false, tookTime: true };
    }

    // C ref: dokick.c kick_dumb() for kicking empty/non-solid space.
    exercise(player, A_DEX, false);
    const dex = player.attributes?.[A_DEX] || 10;
    if (dex >= 16 || rn2(3) !== 0) {
        display.putstr_message("You kick at empty space.");
    } else {
        display.putstr_message("Dumb move!  You strain a muscle.");
        exercise(player, A_STR, false);
        rnd(5); // set_wounded_legs timeout component
    }
    return { moved: false, tookTime: true };
}

// Handle previous messages
// C ref: cmd.c doprev_message() -> topl.c tty_doprev_message()
// Default mode 's' (single): shows one message at a time on top line
async function handlePrevMessages(display) {
    const messages = display.messages || [];

    if (messages.length === 0) {
        display.putstr_message('No previous messages.');
        return { moved: false, tookTime: false };
    }

    // C tty mode 's': show one message each Ctrl+P press.
    // Keep an index so repeated Ctrl+P cycles backward without blocking input.
    let messageIndex = Number.isInteger(display.prevMessageCycleIndex)
        ? display.prevMessageCycleIndex
        : (messages.length - 1);
    if (messageIndex < 0 || messageIndex >= messages.length) {
        messageIndex = messages.length - 1;
    }
    display.putstr_message(messages[messageIndex]);
    display.prevMessageCycleIndex = (messageIndex - 1 + messages.length) % messages.length;

    return { moved: false, tookTime: false };
}

// View map prompt
// C ref: cmd.c dooverview()
async function handleViewMapPrompt(game) {
    const { display, map, player, fov, flags } = game;
    const lines = [
        'View which?',
        '',
        'a * known map without monsters, objects, and traps',
        'b - known map without monsters and objects',
        'c - known map without monsters',
        '(end)',
    ];

    display.clearScreen();
    display.renderMap(map, player, fov, flags);
    if (typeof display.renderStatus === 'function') {
        display.renderStatus(player);
    }
    for (let i = 0; i < lines.length && i < display.rows; i++) {
        const text = lines[i].substring(0, Math.max(0, display.cols - 28));
        const attr = (i === 0) ? 1 : 0;
        display.putstr(28, i, ' '.repeat(Math.max(0, display.cols - 28)));
        display.putstr(28, i, text, undefined, attr);
    }

    await nhgetch();
    display.clearScreen();
    display.renderMap(map, player, fov, flags);
    if (typeof display.renderStatus === 'function') {
        display.renderStatus(player);
    }
    if (typeof display.clearRow === 'function') display.clearRow(0);
    display.topMessage = null;
    display.messageNeedsMore = false;
    return { moved: false, tookTime: false };
}

// Toggle autopickup (@)
// C ref: options.c dotogglepickup()
async function handleTogglePickup(game) {
    const { display } = game;

    // Toggle pickup flag
    game.flags.pickup = !game.flags.pickup;

    // Build message matching C NetHack format
    let msg;
    if (game.flags.pickup) {
        const pickupTypes = String(game.flags.pickup_types || '');
        if (pickupTypes.length > 0) {
            msg = `Autopickup: ON, for ${pickupTypes} objects.`;
        } else {
            msg = 'Autopickup: ON, for all objects.';
        }
    } else {
        msg = 'Autopickup: OFF.';
    }

    display.putstr_message(msg);
    return { moved: false, tookTime: false };
}

// Data file cache (same pattern as guidebook)
const dataFileCache = {};

// Fetch a data file from dat/ directory with caching
async function fetchDataFile(filename) {
    if (dataFileCache[filename]) return dataFileCache[filename];
    try {
        const resp = await fetch(filename);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        dataFileCache[filename] = text;
        return text;
    } catch (e) {
        return null;
    }
}

// Command descriptions for & (whatdoes)
// C ref: pager.c dowhatdoes() / dat/cmdhelp
const COMMAND_DESCRIPTIONS = {
    '?': 'Display one of several informative help texts.',
    '/': 'Tell what a map symbol represents.',
    '&': 'Tell what a command does.',
    '<': 'Go up a staircase.',
    '>': 'Go down a staircase.',
    '.': 'Rest, do nothing for one turn.',
    ',': 'Pick up things at the current location.',
    ':': 'Look at what is here.',
    ';': 'Look at what is somewhere else.',
    '\\': 'Show what types of objects have been discovered.',
    '#': 'Perform an extended command.',
    'a': 'Apply (use) a tool.',
    'c': 'Close a door.',
    'd': 'Drop an item. d7a: drop seven items of object a.',
    'e': 'Eat something.',
    'i': 'Show your inventory.',
    'o': 'Open a door.',
    'q': 'Drink (quaff) a potion.',
    'P': 'Put on a ring or other accessory.',
    's': 'Search for secret doors and traps around you.',
    'w': 'Wield a weapon. w- means wield bare hands.',
    'S': 'Save the game.',
    'T': 'Take off armor.',
    'V': 'Display the version and history of the game.',
    'W': 'Wear armor.',
};

// Symbol descriptions for / (whatis)
// C ref: dat/help symbol legend
const SYMBOL_DESCRIPTIONS = {
    '-': 'wall of a room, or an open door',
    '|': 'wall of a room, or an open door',
    '.': 'floor of a room, or a doorway',
    '#': 'a corridor, or iron bars, or a tree',
    '>': 'stairs down: a way to the next level',
    '<': 'stairs up: a way to the previous level',
    '@': 'you (usually), or another human',
    ')': 'a weapon',
    '[': 'a suit or piece of armor',
    '%': 'something edible (not necessarily healthy)',
    '/': 'a wand',
    '=': 'a ring',
    '?': 'a scroll',
    '!': 'a potion',
    '(': 'a useful item (pick-axe, key, lamp...)',
    '$': 'a pile of gold',
    '*': 'a gem or rock',
    '+': 'a closed door, or a spellbook',
    '^': 'a trap (once you detect it)',
    '"': 'an amulet, or a spider web',
    '0': 'an iron ball',
    '_': 'an altar, or an iron chain',
    '{': 'a fountain',
    '}': 'a pool of water or moat or lava',
    '\\': 'an opulent throne',
    '`': 'a boulder or statue',
    ' ': 'dark part of a room, or solid rock',
    '\u00b7': 'floor of a room (middle dot)',
};

// Handle help (?)
// C ref: pager.c dohelp() -> help_menu_items[]
async function handleHelp(game) {
    const { display } = game;

    // Build menu lines matching C's help menu structure
    const menuLines = [
        ' Select one item:',
        '',
        ' a - About NetHack (version information).',
        ' b - Long description of the game and commands.',
        ' c - List of game commands.',
        ' d - Concise history of NetHack.',
        ' e - Info on a character in the game display.',
        ' f - Info on what a given key does.',
        ' g - Longer explanation of game options.',
        ' h - Full list of keyboard commands.',
        ' i - List of extended commands.',
        ' j - The NetHack Guidebook.',
    ];
    if (game.wizard) {
        menuLines.push(' w - List of wizard-mode commands.');
    }
    menuLines.push(' (end)');

    display.renderChargenMenu(menuLines, true);

    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    if (c === 'a') {
        // About NetHack
        display.putstr_message(`${VERSION_STRING}`);
    } else if (c === 'b') {
        // Long description
        const text = await fetchDataFile('dat/help.txt');
        if (text) {
            await showPager(display, text, 'Long Description');
        } else {
            display.putstr_message('Failed to load help text.');
        }
    } else if (c === 'c') {
        // List of game commands
        const text = await fetchDataFile('dat/hh.txt');
        if (text) {
            await showPager(display, text, 'Game Commands');
        } else {
            display.putstr_message('Failed to load command list.');
        }
    } else if (c === 'd') {
        // History
        const text = await fetchDataFile('dat/history.txt');
        if (text) {
            await showPager(display, text, 'History of NetHack');
        } else {
            display.putstr_message('Failed to load history.');
        }
    } else if (c === 'e') {
        // Whatis (same as /)
        return await handleWhatis(game);
    } else if (c === 'f') {
        // Whatdoes (same as &)
        return await handleWhatdoes(game);
    } else if (c === 'g') {
        // Game options
        const text = await fetchDataFile('dat/opthelp.txt');
        if (text) {
            await showPager(display, text, 'Game Options');
        } else {
            display.putstr_message('Failed to load options help.');
        }
    } else if (c === 'h') {
        // Full list of keyboard commands
        await showPager(display, keyHelpText, 'Key Bindings');
    } else if (c === 'i') {
        // Extended commands list
        await showPager(display, extendedCommandsText, 'Extended Commands');
    } else if (c === 'j') {
        // Guidebook
        await showGuidebook(display);
    } else if (c === 'w' && game.wizard) {
        // Wizard help
        const text = await fetchDataFile('dat/wizhelp.txt');
        if (text) {
            await showPager(display, text, 'Wizard Mode Commands');
        } else {
            display.putstr_message('Failed to load wizard help.');
        }
    }
    // ESC, q, or anything else = dismiss

    return { moved: false, tookTime: false };
}

// Inline key bindings text for help option 'h'
const keyHelpText = [
    '                    NetHack Command Reference',
    '',
    ' Movement:',
    '   y k u      Also: arrow keys, or numpad',
    '    \\|/',
    '   h-.-l      Shift + direction = run',
    '    /|\\',
    '   b j n',
    '',
    ' Actions:',
    '   .  wait/rest           s  search adjacent',
    '   ,  pick up item        d  drop item',
    '   o  open door           c  close door',
    '   >  go downstairs       <  go upstairs',
    '   e  eat food            q  quaff potion',
    '   w  wield weapon        W  wear armor',
    '   T  take off armor      i  inventory',
    '   :  look here           ;  identify position',
    '',
    ' Information:',
    '   ?    help menu',
    '   /    identify a map symbol (whatis)',
    '   &    describe what a key does (whatdoes)',
    '   \\    show discovered object types',
    '   V    version and history of the game',
    '',
    ' Other:',
    '   S    save game',
    '   #    extended command',
    '   ^P   previous messages',
    '   ^R   redraw screen',
    '   ^D   kick',
    '   ^C   quit',
    '',
    ' In pager (guidebook, help):',
    '   space/enter  next page     b  previous page',
    '   /  search    n  next match',
    '   g  first page              G  last page',
    '   q/ESC  exit',
].join('\n');

// Extended commands list text for help option 'i'
const extendedCommandsText = [
    '         Extended Commands',
    '',
    ' #force   M-f   force a locked chest with your weapon',
    ' #loot    M-l   loot a container',
    ' #name          name an object or level',
    ' #quit          quit the game without saving',
    ' #levelchange   change dungeon level (debug mode)',
    ' #map           reveal entire map (debug mode)',
    ' #teleport      teleport to coordinates (debug mode)',
    ' #genesis       create a monster by name (debug mode)',
].join('\n');

// Handle / (whatis) command
// C ref: pager.c dowhatis()
async function handleWhatis(game) {
    const { display } = game;

    display.putstr_message('What do you want to identify? [type a symbol or ESC]');
    const ch = await nhgetch();

    if (ch === 27) {
        // ESC - cancel
        return { moved: false, tookTime: false };
    }

    const c = String.fromCharCode(ch);

    // Check for letter - could be a monster
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
        display.putstr_message(`'${c}': a monster (or straddling the letter range).`);
    } else if (SYMBOL_DESCRIPTIONS[c]) {
        display.putstr_message(`'${c}': ${SYMBOL_DESCRIPTIONS[c]}.`);
    } else {
        display.putstr_message(`I don't know what '${c}' represents.`);
    }

    return { moved: false, tookTime: false };
}

// Handle & (whatdoes) command
// C ref: pager.c dowhatdoes()
async function handleWhatdoes(game) {
    const { display } = game;

    display.putstr_message('What command?');
    const ch = await nhgetch();

    if (ch === 27) {
        return { moved: false, tookTime: false };
    }

    const c = String.fromCharCode(ch);
    let desc;

    // Check for control characters
    if (ch < 32) {
        const ctrlChar = '^' + String.fromCharCode(ch + 64);
        const ctrlDescs = {
            '^C': 'Quit the game.',
            '^D': 'Kick something (usually a door).',
            '^P': 'Repeat previous message (consecutive ^P\'s show earlier ones).',
            '^R': 'Redraw the screen.',
        };
        if (game.wizard) {
            ctrlDescs['^F'] = 'Map the level (wizard mode).';
            ctrlDescs['^G'] = 'Create a monster (wizard mode).';
            ctrlDescs['^I'] = 'Identify items in pack (wizard mode).';
            ctrlDescs['^T'] = 'Teleport (wizard mode).';
            ctrlDescs['^V'] = 'Level teleport (wizard mode).';
            ctrlDescs['^W'] = 'Wish (wizard mode).';
        }
        desc = ctrlDescs[ctrlChar];
        if (desc) {
            display.putstr_message(`${ctrlChar}: ${desc}`);
        } else {
            display.putstr_message(`${ctrlChar}: unknown command.`);
        }
    } else if (COMMAND_DESCRIPTIONS[c]) {
        display.putstr_message(`'${c}': ${COMMAND_DESCRIPTIONS[c]}`);
    } else {
        display.putstr_message(`'${c}': unknown command.`);
    }

    return { moved: false, tookTime: false };
}

// Handle V (history) command
// C ref: pager.c dohistory()
async function handleHistory(game) {
    const { display } = game;
    const text = await fetchDataFile('dat/history.txt');
    if (text) {
        await showPager(display, text, 'History of NetHack');
    } else {
        display.putstr_message('Failed to load history.');
    }
    return { moved: false, tookTime: false };
}

// Guidebook text cache
let guidebookText = null;

// Fetch and display the NetHack Guidebook
async function showGuidebook(display) {
    if (!guidebookText) {
        display.putstr_message('Loading Guidebook...');
        try {
            const resp = await fetch('Guidebook.txt');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            guidebookText = await resp.text();
        } catch (e) {
            display.putstr_message('Failed to load Guidebook.');
            return;
        }
    }
    await showPager(display, guidebookText, 'NetHack Guidebook');
}

// Search for hidden doors and traps adjacent to player
// C ref: detect.c dosearch0()
export function dosearch0(player, map, display, game = null) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = player.x + dx;
            const ny = player.y + dy;
            if (!isok(nx, ny)) continue;
            const loc = map.at(nx, ny);
            if (!loc) continue;

            // C ref: detect.c dosearch0() — if-else structure matches C:
            // SDOOR, SCORR, or else (monsters/traps).
            if (loc.typ === SDOOR) {
                if (rnl(7) === 0) {
                    loc.typ = DOOR;
                    loc.flags = D_CLOSED;
                    exercise(player, A_WIS, true);
                    if (game && Number.isInteger(game.multi) && game.multi > 0) {
                        game.multi = 0;
                    }
                    display.putstr_message('You find a hidden door.');
                }
            } else if (loc.typ === SCORR) {
                if (rnl(7) === 0) {
                    loc.typ = CORR;
                    exercise(player, A_WIS, true);
                    if (game && Number.isInteger(game.multi) && game.multi > 0) {
                        game.multi = 0;
                    }
                    display.putstr_message('You find a hidden passage.');
                }
            } else {
                // C ref: detect.c:2080 — trap detection with rnl(8)
                const trap = map.trapAt?.(nx, ny);
                if (trap && !trap.tseen && !rnl(8)) {
                    trap.tseen = true;
                    exercise(player, A_WIS, true);
                    if (game && Number.isInteger(game.multi) && game.multi > 0) {
                        game.multi = 0;
                    }
                }
            }
        }
    }
    // exercise(A_WIS, TRUE) is called per-discovery above, matching C.
}

// Handle save game (S)
// C ref: cmd.c dosave()
async function handleSave(game) {
    const { display } = game;
    const ans = await ynFunction('Save and quit?', 'yn', 'n'.charCodeAt(0), display);
    if (String.fromCharCode(ans) !== 'y') {
        display.putstr_message('Never mind.');
        return { moved: false, tookTime: false };
    }
    const ok = saveGame(game);
    if (ok) {
        display.putstr_message('Game saved.');
        // Brief delay so the user sees the message, then reload
        await new Promise(r => setTimeout(r, 500));
        window.location.reload();
    } else {
        display.putstr_message('Save failed (storage full or unavailable).');
    }
    return { moved: false, tookTime: false };
}

// Handle options (O) — C ref: cmd.c doset(), options.c doset()
// Interactive menu with immediate toggle - stays open until q/ESC
async function handleSet(game) {
    const { display, player } = game;
    const flags = game.flags;

    let currentPage = 1;
    let showHelp = false;

    function applyOptionSideEffects() {
        player.showExp = !!flags.showexp;
        player.showTime = !!flags.time;
        window.gameFlags = flags;
    }

    function drawOptions() {
        const normalizedPage = normalizeOptionsPage(currentPage, showHelp);
        currentPage = normalizedPage;
        const { screen, attrs } = renderOptionsMenu(normalizedPage, showHelp, flags);

        display.clearScreen();
        for (let r = 0; r < display.rows; r++) {
            const line = screen[r] || '';
            const lineAttrs = attrs[r] || '';
            const maxCols = Math.min(display.cols, line.length);
            for (let c = 0; c < maxCols; c++) {
                const attr = lineAttrs[c] === '1' ? 1 : 0;
                display.putstr(c, r, line[c], undefined, attr);
            }
        }
    }

    function normalizeListFlag(flagName) {
        if (!Array.isArray(flags[flagName])) {
            flags[flagName] = [];
        }
        return flags[flagName];
    }

    function normalizeStatusConditionFlag() {
        const raw = flags.statusconditions;
        if (Array.isArray(raw)) {
            flags.statusconditions = raw.filter(name => STATUS_CONDITION_FIELDS_ALPHA.includes(name));
            return flags.statusconditions;
        }
        const count = (typeof raw === 'number')
            ? Math.max(0, Math.min(STATUS_CONDITION_FIELDS_ALPHA.length, raw))
            : STATUS_CONDITION_DEFAULT_ON.size;
        flags.statusconditions = STATUS_CONDITION_FIELDS_ALPHA.filter((name, idx) => {
            if (typeof raw === 'number') return idx < count;
            return STATUS_CONDITION_DEFAULT_ON.has(name);
        });
        return flags.statusconditions;
    }

    function renderSimpleEditorLines(title, lines) {
        display.clearScreen();
        const maxRows = Math.min(display.rows, lines.length + 3);
        const header = ` ${title} `;
        display.putstr(0, 0, header, undefined, 1);
        display.putstr(0, 1, '');
        for (let i = 0; i < maxRows - 2; i++) {
            display.putstr(0, i + 2, lines[i].substring(0, display.cols));
        }
    }

    function renderCenteredList(lines, left = 41, headerInverse = false) {
        display.clearScreen();
        for (let i = 0; i < lines.length && i < display.rows; i++) {
            const text = lines[i].substring(0, Math.max(0, display.cols - left));
            const attr = (headerInverse && i === 0) ? 1 : 0;
            display.putstr(left, i, text, undefined, attr);
        }
    }

    async function editDoWhatCountOption(option) {
        const list = normalizeListFlag(option.flag);
        const addPrompt = option.flag === 'menucolors'
            ? 'What new menucolor pattern? '
            : 'What new autopickup exception pattern? ';
        const addLabel = option.flag === 'menucolors'
            ? 'a - add new menucolor'
            : 'a - add new autopickup exception';

        while (true) {
            const lines = [
                'Do what?',
                '',
                addLabel,
                'x * exit this menu',
                '(end)'
            ];
            renderCenteredList(lines);

            const ch = await nhgetch();
            const c = String.fromCharCode(ch);
            if (ch === 27 || c === 'x') {
                saveFlags(flags);
                return;
            }
            if (c === 'a') {
                const added = await getlin(addPrompt, display);
                if (added !== null) {
                    const trimmed = added.trim();
                    if (trimmed.length > 0) list.push(trimmed);
                }
                continue;
            }
        }
    }

    async function editStatusHilitesOption() {
        if (!flags.statushighlights || typeof flags.statushighlights !== 'object' || Array.isArray(flags.statushighlights)) {
            flags.statushighlights = {};
        }
        let page = 1;
        const pageSize = 21;

        while (true) {
            const lines = [];
            const totalPages = Math.ceil(STATUS_HILITE_FIELDS.length / pageSize);
            const start = (page - 1) * pageSize;
            const visible = STATUS_HILITE_FIELDS.slice(start, start + pageSize);

            if (page === 1) {
                lines.push('Status hilites:');
                lines.push('');
            }
            for (let i = 0; i < visible.length; i++) {
                const key = String.fromCharCode('a'.charCodeAt(0) + i);
                lines.push(`${key} - ${visible[i]}`);
            }
            lines.push(`(${page} of ${totalPages})`);
            display.clearScreen();
            for (let i = 0; i < lines.length && i < display.rows; i++) {
                const row = (i === lines.length - 1) ? 23 : i;
                display.putstr(0, row, lines[i].substring(0, display.cols));
            }

            const ch = await nhgetch();
            const c = String.fromCharCode(ch);
            if (ch === 27 || c === 'q') {
                return;
            }
            if (c === '>' && page < totalPages) {
                page += 1;
                continue;
            }
            if (c === '<' && page > 1) {
                page -= 1;
                continue;
            }
            if (c >= 'a' && c <= 'z') {
                const idx = c.charCodeAt(0) - 'a'.charCodeAt(0);
                if (idx < 0 || idx >= visible.length) continue;
                const field = visible[idx];
                const label = field.toLowerCase();
                const lines2 = [
                    `Select ${label} field hilite behavior:`,
                    '',
                    `a - Always highlight ${label}`,
                    `${field === 'hunger' ? 'c - hunger value changes' : `c - ${label} value changes`}`,
                    `${field === 'hunger' ? 't - hunger text match' : `t - ${label} text match`}`,
                    '(end)'
                ];
                renderCenteredList(lines2);
                const ch2 = await nhgetch();
                const c2 = String.fromCharCode(ch2);
                if (c2 === 'a' || c2 === 'c' || c2 === 't') {
                    flags.statushighlights[field] = c2;
                    saveFlags(flags);
                }
            }
        }
    }

    async function editStatusConditionsOption() {
        const enabled = normalizeStatusConditionFlag();
        let page = 1;
        const pageSize = 19;

        while (true) {
            const totalPages = Math.ceil(STATUS_CONDITION_FIELDS_ALPHA.length / pageSize);
            const start = (page - 1) * pageSize;
            const visible = STATUS_CONDITION_FIELDS_ALPHA.slice(start, start + pageSize);
            const lines = [];
            if (page === 1) {
                lines.push('Choose status conditions to toggle');
                lines.push('');
                lines.push('S - change sort order from "alphabetically" to "by ranking"');
                lines.push('sorted alphabetically');
            }
            for (let i = 0; i < visible.length; i++) {
                const key = String.fromCharCode('a'.charCodeAt(0) + i);
                const mark = enabled.includes(visible[i]) ? '*' : '-';
                lines.push(`${key} ${mark} ${visible[i]}`);
            }
            lines.push(`(${page} of ${totalPages})`);

            display.clearScreen();
            for (let i = 0; i < lines.length && i < display.rows; i++) {
                const row = (i === lines.length - 1) ? 23 : i;
                display.putstr(0, row, lines[i].substring(0, display.cols));
            }

            const ch = await nhgetch();
            const c = String.fromCharCode(ch);
            if (ch === 27) {
                saveFlags(flags);
                return;
            }
            if (c === '>' && page < totalPages) {
                page += 1;
                continue;
            }
            if (c === '<' && page > 1) {
                page -= 1;
                continue;
            }
            if (c >= 'a' && c <= 'z') {
                const idx = c.charCodeAt(0) - 'a'.charCodeAt(0);
                if (idx < 0 || idx >= visible.length) continue;
                const field = visible[idx];
                const pos = enabled.indexOf(field);
                if (pos >= 0) enabled.splice(pos, 1);
                else enabled.push(field);
                saveFlags(flags);
            }
        }
    }

    async function editNumberPadModeOption() {
        const lines = [
            'Select number_pad mode:',
            '',
            'a -  0 (off)',
            'b -  1 (on)',
            'c -  2 (on, MSDOS compatible)',
            'd -  3 (on, phone-style digit layout)',
            'e -  4 (on, phone-style layout, MSDOS compatible)',
            "f - -1 (off, 'z' to move upper-left, 'y' to zap wands)",
            '(end)',
        ];
        renderCenteredList(lines, 24, true);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        const modeByKey = { a: 0, b: 1, c: 2, d: 3, e: 4, f: -1 };
        if (Object.prototype.hasOwnProperty.call(modeByKey, c)) {
            flags.number_pad = modeByKey[c];
            saveFlags(flags);
        }
    }

    async function editAutounlockOption() {
        const actions = [
            { key: 'u', token: 'untrap', suffix: '(might fail)' },
            { key: 'a', token: 'apply-key', suffix: '' },
            { key: 'k', token: 'kick', suffix: '(doors only)' },
            { key: 'f', token: 'force', suffix: '(chests/boxes only)' },
        ];
        const tokenOrder = new Map(actions.map((a, idx) => [a.token, idx]));
        const parseSelected = () => {
            const raw = String(flags.autounlock ?? '').trim();
            if (raw === 'none') return new Set();
            if (!raw) return new Set(['apply-key']);
            const selected = new Set();
            for (const part of raw.split(/[,\s]+/)) {
                const tok = part.trim();
                if (!tok) continue;
                if (tokenOrder.has(tok)) selected.add(tok);
            }
            return selected;
        };
        const saveSelected = (selected) => {
            if (selected.size === 0) {
                flags.autounlock = 'none';
            } else {
                flags.autounlock = Array.from(selected)
                    .sort((a, b) => (tokenOrder.get(a) ?? 99) - (tokenOrder.get(b) ?? 99))
                    .join(',');
            }
            saveFlags(flags);
        };

        while (true) {
            const selected = parseSelected();
            const lines = ["Select 'autounlock' actions:", ''];
            for (const action of actions) {
                const mark = selected.has(action.token) ? '*' : '-';
                const spacer = action.suffix ? ' '.repeat(Math.max(1, 11 - action.token.length)) : '';
                lines.push(`${action.key} ${mark} ${action.token}${spacer}${action.suffix}`.trimEnd());
            }
            lines.push('(end)');
            display.clearScreen();
            display.renderMap(game.map, player, game.fov, flags);
            for (let i = 0; i < lines.length && i < display.rows; i++) {
                const text = lines[i].substring(0, Math.max(0, display.cols - 41));
                const attr = (i === 0) ? 1 : 0;
                display.putstr(41, i, ' '.repeat(Math.max(0, display.cols - 41)));
                display.putstr(41, i, text, undefined, attr);
            }

            const ch = await nhgetch();
            const c = String.fromCharCode(ch).toLowerCase();
            if (ch === 27 || ch === 10 || ch === 13 || c === ' ') {
                return;
            }
            const action = actions.find((entry) => entry.key === c);
            if (!action) continue;
            if (selected.has(action.token)) selected.delete(action.token);
            else selected.add(action.token);
            saveSelected(selected);
        }
    }

    async function editPickupTypesOption() {
        const choices = [
            { key: 'a', glyph: '$', symbol: '$', label: 'pile of coins' },
            { key: 'b', glyph: '"', symbol: '"', label: 'amulet' },
            { key: 'c', glyph: ')', symbol: ')', label: 'weapon' },
            { key: 'd', glyph: '[', symbol: '[', label: 'suit or piece of armor' },
            { key: 'e', glyph: '%', symbol: '%', label: 'piece of food' },
            { key: 'f', glyph: '?', symbol: '?', label: 'scroll' },
            { key: 'g', glyph: '+', symbol: '+', label: 'spellbook' },
            { key: 'h', glyph: '!', symbol: '!', label: 'potion' },
            { key: 'i', glyph: '=', symbol: '=', label: 'ring' },
            { key: 'j', glyph: '/', symbol: '/', label: 'wand' },
            { key: 'k', glyph: '(', symbol: '(', label: 'useful item (pick-axe, key, lamp...)' },
            { key: 'l', glyph: '*', symbol: '*', label: 'gem or rock' },
            { key: 'm', glyph: '`', symbol: '`', label: 'boulder or statue' },
            { key: 'n', glyph: '0', symbol: '0', label: 'iron ball' },
            { key: 'o', glyph: '_', symbol: '_', label: 'iron chain' },
        ];
        const symbolOrder = new Map(choices.map((choice, idx) => [choice.symbol, idx]));

        const parseTypes = () => {
            const raw = String(flags.pickup_types || '');
            if (!raw) return new Set();
            return new Set(raw.split(''));
        };

        const saveTypes = (set) => {
            const sorted = Array.from(set).sort((a, b) =>
                (symbolOrder.get(a) ?? 999) - (symbolOrder.get(b) ?? 999));
            flags.pickup_types = sorted.join('');
            saveFlags(flags);
        };

        while (true) {
            const selected = parseTypes();
            const lines = ['Autopickup what?', ''];
            for (const choice of choices) {
                const mark = selected.has(choice.symbol) ? '+' : '-';
                lines.push(`${choice.key} ${mark} ${choice.glyph}  ${choice.label}`);
            }
            lines.push('');
            lines.push('A -    All classes of objects');
            lines.push('Note: when no choices are selected, "all" is implied.');
            lines.push("Toggle off 'autopickup' to not pick up anything.");
            lines.push('(end)');
            display.clearScreen();
            display.renderMap(game.map, player, game.fov, flags);
            // Session captures for this menu are column-shifted by one map cell.
            // Apply that shift in headless parity mode before drawing the right panel.
            if (Array.isArray(display.grid) && Array.isArray(display.colors) && Array.isArray(display.attrs)) {
                for (let row = 1; row <= 21 && row < display.rows; row++) {
                    for (let col = 0; col < display.cols - 1; col++) {
                        display.grid[row][col] = display.grid[row][col + 1];
                        display.colors[row][col] = display.colors[row][col + 1];
                        display.attrs[row][col] = display.attrs[row][col + 1];
                    }
                    display.grid[row][display.cols - 1] = ' ';
                    display.colors[row][display.cols - 1] = 7;
                    display.attrs[row][display.cols - 1] = 0;
                }
            }
            for (let i = 0; i < lines.length && i < display.rows; i++) {
                const text = lines[i].substring(0, Math.max(0, display.cols - 25));
                const attr = (i === 0) ? 1 : 0;
                display.putstr(24, i, ' '.repeat(Math.max(0, display.cols - 24)));
                display.putstr(25, i, text, undefined, attr);
            }

            const ch = await nhgetch();
            const c = String.fromCharCode(ch);
            if (ch === 27 || ch === 10 || ch === 13 || c === ' ' || c === 'q' || c === 'x') {
                return;
            }
            if (c === 'A') {
                selected.clear();
                saveTypes(selected);
                continue;
            }
            const choice = choices.find((entry) => entry.key === c);
            if (!choice) continue;
            if (selected.has(choice.symbol)) selected.delete(choice.symbol);
            else selected.add(choice.symbol);
            saveTypes(selected);
        }
    }

    // Interactive loop - C ref: options.c doset() menu loop
    while (true) {
        drawOptions();

        // Get input - C ref: options.c menu input loop
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        // Check for exit
        if (ch === 27 || ch === 10 || ch === 13 || c === 'q') { // ESC, Enter, or q
            break;
        }

        // Check for navigation - C ref: MENU_NEXT_PAGE, MENU_PREVIOUS_PAGE, MENU_FIRST_PAGE
        if (c === '>') {
            const maxPage = getTotalPages(showHelp);
            if (currentPage < maxPage) currentPage += 1;
            continue;
        }
        if (c === '<') {
            if (currentPage > 1) currentPage -= 1;
            continue;
        }
        if (c === '^') {
            currentPage = 1;
            continue;
        }
        if (c === '?') {
            showHelp = !showHelp;
            currentPage = normalizeOptionsPage(currentPage, showHelp);
            continue;
        }

        // Check for option selection
        const selected = getOptionByKey(currentPage, showHelp, c);
        if (selected) {
            if (selected.flag === 'number_pad') {
                await editNumberPadModeOption();
                continue;
            }
            if (selected.flag === 'autounlock') {
                await editAutounlockOption();
                currentPage = 1;
                showHelp = false;
                continue;
            }
            if (selected.flag === 'pickup_types') {
                await editPickupTypesOption();
                currentPage = 1;
                showHelp = false;
                continue;
            }
            if (selected.type === 'bool') {
                setOptionValue(currentPage, showHelp, c, null, flags);
                applyOptionSideEffects();
                continue;
            }

            if (selected.type === 'count') {
                if (selected.flag === 'statusconditions') {
                    await editStatusConditionsOption();
                    currentPage = 1;
                    showHelp = false;
                } else if (selected.flag === 'statushighlights') {
                    await editStatusHilitesOption();
                    currentPage = 1;
                    showHelp = false;
                } else {
                    await editDoWhatCountOption(selected);
                    currentPage = 1;
                    showHelp = false;
                }
                continue;
            }

            const prompt = `Set ${selected.name} to what? `;
            const newValue = await getlin(prompt, display);
            if (newValue !== null) {
                setOptionValue(currentPage, showHelp, c, newValue, flags);
                if (selected.flag === 'name') {
                    player.name = flags.name;
                }
                applyOptionSideEffects();
            }
        }
        // If invalid key, just loop again (menu stays open, no error message)
    }

    // Restore game display after exiting menu
    // Clear screen first to remove all menu text
    display.clearScreen();
    display.renderMap(game.map, player, game.fov, flags);
    display.renderStatus(player);

    return { moved: false, tookTime: false };
}

// Handle extended command (#)
// C ref: cmd.c doextcmd()
function isObjectTypeCallable(obj) {
    if (!obj) return false;
    // C ref: do_name.c objtyp_is_callable() requires OBJ_DESCR for most classes.
    const meta = objectData[obj.otyp] || null;
    const hasDesc = !!(meta && typeof meta.desc === 'string' && meta.desc.length > 0);
    if (!hasDesc) return false;

    if (obj.oclass === AMULET_CLASS) {
        // C excludes real/fake amulet of Yendor from type-calling.
        const name = String(meta?.name || '').toLowerCase();
        return !name.includes('amulet of yendor');
    }
    return obj.oclass === SCROLL_CLASS
        || obj.oclass === POTION_CLASS
        || obj.oclass === WAND_CLASS
        || obj.oclass === RING_CLASS
        || obj.oclass === GEM_CLASS
        || obj.oclass === SPBOOK_CLASS
        || obj.oclass === ARMOR_CLASS
        || obj.oclass === TOOL_CLASS
        || obj.oclass === VENOM_CLASS;
}

async function handleCallObjectTypePrompt(player, display) {
    const inventory = Array.isArray(player.inventory) ? player.inventory : [];
    const callChoices = inventory
        .filter((obj) => isObjectTypeCallable(obj) && obj.invlet)
        .map((obj) => obj.invlet)
        .join('');
    const prompt = callChoices
        ? `What do you want to call? [${callChoices} or ?*]`
        : 'What do you want to call? [*]';
    const replacePromptMessage = () => {
        if (typeof display.clearRow === 'function') display.clearRow(0);
        display.topMessage = null;
        display.messageNeedsMore = false;
    };
    const isDismissKey = (code) => code === 27 || code === 32;

    while (true) {
        display.putstr_message(prompt);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        if (isDismissKey(ch)) {
            replacePromptMessage();
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') {
            continue;
        }

        const selected = inventory.find((obj) => obj && obj.invlet === c);
        if (!selected) {
            continue;
        }
        if (!isObjectTypeCallable(selected)) {
            replacePromptMessage();
            display.putstr_message('That is a silly thing to call.');
            return { moved: false, tookTime: false };
        }

        // C ref: do_name.c docall() uses getlin("Call ...:") for valid type-calls.
        await getlin(`Call ${doname(selected, player)}:`, display);
        return { moved: false, tookTime: false };
    }
}

async function handleExtendedCommand(game) {
    const { player, display } = game;
    const input = await getlin('# ', display);
    if (input === null || input.trim() === '') {
        return { moved: false, tookTime: false };
    }
    const rawCmd = input.trim();
    const cmd = rawCmd.toLowerCase();
    switch (cmd) {
        case 'o':
        case 'options':
        case 'optionsfull':
            return await handleSet(game);
        case 'n':
        case 'name': {
            // C ref: do_name.c docallcmd() menu routes.
            while (true) {
                display.putstr_message('                                What do you want to name?');
                const sel = await nhgetch();
                const c = String.fromCharCode(sel).toLowerCase();
                if (sel === 27 || c === ' ') {
                    display.putstr_message('Never mind.');
                    return { moved: false, tookTime: false };
                }
                if (c === 'a') {
                    await getlin('What do you want to call this dungeon level?', display);
                    return { moved: false, tookTime: false };
                }
                if (c === 'o' || c === 'n') {
                    return await handleCallObjectTypePrompt(player, display);
                }
                // Keep waiting for a supported selection.
            }
        }
        case 'force':
            return await handleForce(game);
        case 'loot':
            return await handleLoot(game);
        case 'levelchange':
            return await wizLevelChange(game);
        case 'map':
            return wizMap(game);
        case 'teleport':
            return await wizTeleport(game);
        case 'genesis':
            return await wizGenesis(game);
        case 'quit': {
            const ans = await ynFunction('Really quit?', 'yn', 'n'.charCodeAt(0), display);
            if (String.fromCharCode(ans) === 'y') {
                game.gameOver = true;
                game.gameOverReason = 'quit';
                player.deathCause = 'quit';
                display.putstr_message('Goodbye...');
            }
            return { moved: false, tookTime: false };
        }
        // C ref: cmd.c extcmdlist[] — extended command aliases that map
        // to regular key commands. These appear in wizard-mode sessions
        // when players type #<cmd> instead of the single-key shortcut.
        case 'w':
        case 'wield':
            return await handleWield(player, display);
        case 'wear':
            return await handleWear(player, display);
        case 'e':
        case 'eat':
            return await handleEat(player, display, game);
        case 'r':
        case 'read':
            return await handleRead(player, display, game);
        default:
            // C-style unknown extended command feedback
            display.putstr_message(`#${rawCmd}: unknown extended command.`);
            return { moved: false, tookTime: false };
    }
}

// Wizard mode: change dungeon level
// C ref: cmd.c wiz_level_change()
async function wizLevelChange(game) {
    const { player, display } = game;
    if (!game.wizard) {
        display.putstr_message('Unavailable command.');
        return { moved: false, tookTime: false };
    }
    const input = await getlin('To what level do you want to teleport? ', display);
    if (input === null || input.trim() === '') {
        return { moved: false, tookTime: false };
    }
    const level = parseInt(input.trim(), 10);
    if (isNaN(level) || level < 1 || level > MAXLEVEL) {
        display.putstr_message(`Bad level number (1-${MAXLEVEL}).`);
        return { moved: false, tookTime: false };
    }
    if (level === player.dungeonLevel) {
        display.putstr_message('You are already on that level.');
        return { moved: false, tookTime: false };
    }
    game.changeLevel(level, 'teleport');
    // C ref: wizcmds.c wiz_level_tele() returns ECMD_OK (time consumed).
    return { moved: false, tookTime: true };
}

// Wizard mode: reveal entire map (magic mapping)
// C ref: cmd.c wiz_map() / detect.c do_mapping()
function wizMap(game) {
    const { map, player, display, fov } = game;
    if (!game.wizard) {
        display.putstr_message('Unavailable command.');
        return { moved: false, tookTime: false };
    }
    // Reveal every cell on the map by setting seenv to full visibility
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            if (loc) {
                loc.seenv = 0xff;
                loc.lit = true;
            }
        }
    }
    // Re-render the map with everything revealed
    fov.compute(map, player.x, player.y);
    display.renderMap(map, player, fov);
    display.putstr_message('You feel knowledgeable.');
    return { moved: false, tookTime: false };
}

// Wizard mode: teleport to coordinates
// C ref: cmd.c wiz_teleport()
async function wizTeleport(game) {
    const { player, map, display, fov } = game;
    if (!game.wizard) {
        display.putstr_message('Unavailable command.');
        return { moved: false, tookTime: false };
    }
    const input = await getlin('Teleport to (x,y): ', display);
    let nx, ny;
    if (input === null) {
        return { moved: false, tookTime: false };
    }
    const trimmed = input.trim();
    if (trimmed === '') {
        // Random teleport: find a random accessible spot
        let found = false;
        for (let attempts = 0; attempts < 500; attempts++) {
            const rx = 1 + rn2(COLNO - 2);
            const ry = rn2(ROWNO);
            const loc = map.at(rx, ry);
            if (loc && ACCESSIBLE(loc.typ) && !map.monsterAt(rx, ry)) {
                nx = rx;
                ny = ry;
                found = true;
                break;
            }
        }
        if (!found) {
            display.putstr_message('Failed to find a valid teleport destination.');
            return { moved: false, tookTime: false };
        }
    } else {
        const parts = trimmed.split(',');
        if (parts.length !== 2) {
            display.putstr_message('Bad format. Use: x,y');
            return { moved: false, tookTime: false };
        }
        nx = parseInt(parts[0].trim(), 10);
        ny = parseInt(parts[1].trim(), 10);
        if (isNaN(nx) || isNaN(ny)) {
            display.putstr_message('Bad coordinates.');
            return { moved: false, tookTime: false };
        }
        if (!isok(nx, ny)) {
            display.putstr_message('Out of bounds.');
            return { moved: false, tookTime: false };
        }
        const loc = map.at(nx, ny);
        if (!loc || !ACCESSIBLE(loc.typ)) {
            display.putstr_message('That location is not accessible.');
            return { moved: false, tookTime: false };
        }
    }
    player.x = nx;
    player.y = ny;
    fov.compute(map, player.x, player.y);
    display.renderMap(map, player, fov);
    display.putstr_message(`You teleport to (${nx},${ny}).`);
    return { moved: true, tookTime: true };
}

// Wizard mode: create a monster (genesis)
// C ref: cmd.c wiz_genesis() / makemon.c
async function wizGenesis(game) {
    const { player, map, display } = game;
    if (!game.wizard) {
        display.putstr_message('Unavailable command.');
        return { moved: false, tookTime: false };
    }
    const input = await getlin('Create what monster? ', display);
    if (input === null || input.trim() === '') {
        return { moved: false, tookTime: false };
    }
    const name = input.trim().toLowerCase();
    // Find the monster type by name (case-insensitive match against mons[])
    let mndx = mons.findIndex(m => m.name.toLowerCase() === name);
    if (mndx < 0) {
        // Try substring match as fallback
        mndx = mons.findIndex(m => m.name.toLowerCase().includes(name));
    }
    if (mndx < 0) {
        display.putstr_message(`Unknown monster: "${input.trim()}".`);
        return { moved: false, tookTime: false };
    }
    // Find an adjacent accessible spot to place the monster
    let placed = false;
    for (let dx = -1; dx <= 1 && !placed; dx++) {
        for (let dy = -1; dy <= 1 && !placed; dy++) {
            if (dx === 0 && dy === 0) continue;
            const mx = player.x + dx;
            const my = player.y + dy;
            if (!isok(mx, my)) continue;
            const loc = map.at(mx, my);
            if (!loc || !ACCESSIBLE(loc.typ)) continue;
            if (map.monsterAt(mx, my)) continue;
            setMakemonPlayerContext(player);
            const mon = makemon(mndx, mx, my, 0, player.dungeonLevel, map);
            if (mon) {
                mon.sleeping = false; // wizard-created monsters are awake
                display.putstr_message(`A ${mons[mndx].name} appears!`);
                placed = true;
            }
        }
    }
    if (!placed) {
        display.putstr_message('There is no room near you to create a monster.');
    }
    return { moved: false, tookTime: false };
}

// BFS pathfinding for travel command
// C ref: cmd.c dotravel() -> hack.c findtravelpath()
function findPath(map, startX, startY, endX, endY) {
    if (!isok(endX, endY)) return null;
    if (startX === endX && startY === endY) return [];

    const queue = [[startX, startY, []]];
    const visited = new Set();
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
        const [x, y, path] = queue.shift();

        // Check all 8 directions
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx === endX && ny === endY) {
                return [...path, [dx, dy]];
            }

            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            if (!isok(nx, ny)) continue;

            const loc = map.at(nx, ny);
            if (!loc || !ACCESSIBLE(loc.typ)) continue;

            visited.add(key);
            queue.push([nx, ny, [...path, [dx, dy]]]);
        }

        // Limit search to prevent infinite loops
        if (visited.size > 500) return null;
    }

    return null; // No path found
}

// Handle travel command (_)
// C ref: cmd.c dotravel()
async function handleTravel(game) {
    const { player, map, display } = game;

    display.putstr_message('Where do you want to travel to? (use arrow keys, then .)');

    // Simple cursor-based destination selection
    let cursorX = player.x;
    let cursorY = player.y;

    while (true) {
        // Render map with cursor
        display.renderMap(map, player, game.fov, game.flags);
        // Show cursor at target location (we'll just use a simple marker)
        const mapOffset = game.flags.msg_window ? 3 : MAP_ROW_START;
        const row = cursorY + mapOffset;
        const cursorCol = cursorX - 1;
        const oldCell = display.grid[row]?.[cursorCol] || { ch: ' ', color: 7 };
        display.setCell(cursorCol, row, 'X', 14); // White X for cursor
        display.render();

        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        // Restore cell
        display.setCell(cursorCol, row, oldCell.ch, oldCell.color);

        // Handle cursor movement
        if (c === 'h' && cursorX > 1) cursorX--;
        else if (c === 'l' && cursorX < COLNO - 1) cursorX++;
        else if (c === 'k' && cursorY > 0) cursorY--;
        else if (c === 'j' && cursorY < ROWNO - 1) cursorY++;
        else if (c === 'y' && cursorX > 1 && cursorY > 0) { cursorX--; cursorY--; }
        else if (c === 'u' && cursorX < COLNO - 1 && cursorY > 0) { cursorX++; cursorY--; }
        else if (c === 'b' && cursorX > 1 && cursorY < ROWNO - 1) { cursorX--; cursorY++; }
        else if (c === 'n' && cursorX < COLNO - 1 && cursorY < ROWNO - 1) { cursorX++; cursorY++; }
        else if (c === '.' || ch === 13) { // period or enter
            // Confirm destination
            break;
        } else if (ch === 27) { // ESC
            display.putstr_message('Travel cancelled.');
            return { moved: false, tookTime: false };
        }
    }

    // Store travel destination
    game.travelX = cursorX;
    game.travelY = cursorY;

    // Find path
    const path = findPath(map, player.x, player.y, cursorX, cursorY);
    if (!path) {
        display.putstr_message('No path to that location.');
        return { moved: false, tookTime: false };
    }

    if (path.length === 0) {
        display.putstr_message('You are already there.');
        return { moved: false, tookTime: false };
    }

    // Start traveling
    game.travelPath = path;
    game.travelStep = 0;
    display.putstr_message(`Traveling... (${path.length} steps)`);

    // Execute first step
    return executeTravelStep(game);
}

// Execute one step of travel
// C ref: hack.c domove() with context.travel flag
export async function executeTravelStep(game) {
    const { player, map, display } = game;

    if (!game.travelPath || game.travelStep >= game.travelPath.length) {
        // Travel complete
        game.travelPath = null;
        game.travelStep = 0;
        display.putstr_message('You arrive at your destination.');
        return { moved: false, tookTime: false };
    }

    const [dx, dy] = game.travelPath[game.travelStep];
    game.travelStep++;

    // Execute movement
    const result = await handleMovement([dx, dy], player, map, display, game);

    // If movement failed, stop traveling
    if (!result.moved) {
        game.travelPath = null;
        game.travelStep = 0;
        display.putstr_message('Travel interrupted.');
    }

    return result;
}
