// commands.js -- Command dispatch
// Mirrors cmd.c from the C source.
// Maps keyboard input to game actions.

import { COLNO, ROWNO, DOOR, STAIRS, LADDER, FOUNTAIN, SINK, THRONE, ALTAR, GRAVE,
         POOL, LAVAPOOL, IRONBARS, TREE, ROOM, IS_DOOR, D_CLOSED, D_LOCKED,
         D_ISOPEN, D_NODOOR, ACCESSIBLE, IS_WALL, MAXLEVEL, VERSION_STRING,
         isok, A_STR, A_DEX, A_CON } from './config.js';
import { SQKY_BOARD, SLP_GAS_TRAP, FIRE_TRAP, PIT, SPIKED_PIT } from './symbols.js';
import { rn2, rnd, rnl, d, c_d } from './rng.js';
import { objectData, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
         TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
         WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS } from './objects.js';
import { nhgetch, ynFunction, getlin } from './input.js';
import { playerAttackMonster } from './combat.js';
import { makemon, setMakemonPlayerContext } from './makemon.js';
import { mons } from './monsters.js';
import { doname } from './mkobj.js';
import { observeObject, getDiscoveriesMenuLines } from './discovery.js';
import { showPager } from './pager.js';
import { handleZap } from './zap.js';
import { saveGame, saveFlags } from './storage.js';
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

// Process a command from the player
// C ref: cmd.c rhack() -- main command dispatch
// Returns: { moved: boolean, tookTime: boolean }
export async function rhack(ch, game) {
    const { player, map, display, fov } = game;
    const c = String.fromCharCode(ch);

    // C tty/keypad behavior in recorded traces: Enter acts like south movement.
    if (ch === 10 || ch === 13) {
        return await handleMovement(DIRECTION_KEYS.j, player, map, display, game);
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

    // Period = wait/search
    if (c === '.' || c === 's') {
        // C ref: do.c cmd_safety_prevention() — prevent wait/search when hostile adjacent
        // Gated on flags.safe_wait (default true) and !multi (always 0 for non-counted)
        if (game && game.flags && game.flags.safe_wait && !game.menuRequested) {
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
                // C ref: do.c cmd_safety_prevention() has distinct wait vs search warnings.
                if (c === 's') {
                    display.putstr_message("You already found a monster.  Use 'm' prefix to force another search.");
                } else {
                    display.putstr_message("Are you waiting to get hit?  Use 'm' prefix to force a no-op (to rest).");
                }
                return { moved: false, tookTime: false };
            }
        }
        // C ref: cmd.c -- '.' is rest, 's' is search
        if (c === 's') {
            // C ref: detect.c dosearch0() -- check adjacent squares for hidden things
            dosearch0(player, map, display);
        } 
        return { moved: false, tookTime: true };
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
        return await handleInventory(player, display);
    }

    // Wield weapon
    if (c === 'w') {
        return await handleWield(player, display);
    }

    // Wear armor
    if (c === 'W') {
        return await handleWear(player, display);
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

    // Read scroll/spellbook
    // C ref: read.c doread()
    if (c === 'r') {
        return await handleRead(player, display);
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
        const lines = getDiscoveriesMenuLines();
        if (!lines.length) {
            display.putstr_message("You haven't discovered anything yet.");
            return { moved: false, tookTime: false };
        }
        if (typeof display.renderOverlayMenu === 'function') {
            display.renderOverlayMenu(lines.concat([' (end)']));
        } else {
            display.renderChargenMenu(lines.concat([' (end)']), false);
        }
        await nhgetch();
        return { moved: false, tookTime: false };
    }

    // History (V)
    // C ref: pager.c dohistory()
    if (c === 'V') {
        return await handleHistory(game);
    }

    // Kick (Ctrl+D)
    if (ch === 4) {
        return await handleKick(player, map, display, game);
    }

    // Previous messages (Ctrl+P)
    if (ch === 16) {
        return await handlePrevMessages(display);
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
            if (game.flags.verbose) {
                display.putstr_message('Double m prefix, canceled.');
            }
            game.menuRequested = false;
        } else {
            game.menuRequested = true;
            if (game.flags.verbose) {
                display.putstr_message('Next command will request menu or move without autopickup/attack.');
            }
        }
        return { moved: false, tookTime: false };
    }

    // C ref: cmd.c:1671 do_fight() — 'F' prefix
    if (c === 'F') {
        if (game.forceFight) {
            if (game.flags.verbose) {
                display.putstr_message('Double fight prefix, canceled.');
            }
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
            if (game.flags.verbose) {
                display.putstr_message('Double run prefix, canceled.');
            }
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
            if (game.flags.verbose) {
                display.putstr_message('Double rush prefix, canceled.');
            }
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
    const oldX = player.x;
    const oldY = player.y;
    const nx = player.x + dir[0];
    const ny = player.y + dir[1];

    if (!isok(nx, ny)) {
        display.putstr_message("You can't move there.");
        return { moved: false, tookTime: false };
    }

    const loc = map.at(nx, ny);

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
                    // C ref: uhitm.c monflee(mtmp, rnd(6), FALSE, FALSE)
                    mon.flee = true;
                    mon.fleetim = rnd(6);
                }
                if (mon.tame) {
                    display.putstr_message(`You stop.  Your ${mon.name} is in the way!`);
                } else {
                    const label = mon.name ? mon.name.charAt(0).toUpperCase() + mon.name.slice(1) : 'It';
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
            const landedObjs = map.objectsAt(nx, ny);
            if (landedObjs.length > 0) {
                const seen = landedObjs[0];
                if (seen.oclass === COIN_CLASS) {
                    const count = seen.quan || 1;
                    const plural = count === 1 ? '' : 's';
                    display.putstr_message(`You see here ${count} gold piece${plural}.`);
                } else {
                    observeObject(seen);
                    display.putstr_message(`You see here ${doname(seen, null)}.`);
                }
            } else {
                display.putstr_message(`You swap places with your ${mon.name}.`);
                // Keep later same-turn combat messages from concatenating with displacement text.
                if (display && Object.prototype.hasOwnProperty.call(display, 'topMessage')) {
                    display.topMessage = null;
                }
            }
            game.forceFight = false; // Clear prefix (shouldn't reach here but be safe)
            return { moved: true, tookTime: true };
        }

        // Safety checks before attacking
        // C ref: flag.h flags.safe_pet - prevent attacking pets
        if (mon.tame && flags.safe_pet) {
            display.putstr_message("You cannot attack your pet!");
            game.forceFight = false;
            return { moved: false, tookTime: false };
        }

        // C ref: flag.h flags.confirm - confirm attacking peacefuls
        if (mon.peaceful && !mon.tame && flags.confirm) {
            const answer = await ynFunction(
                `Really attack ${mon.name}?`,
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
        rn2(19); // exercise(A_STR)
        const killed = playerAttackMonster(player, mon, display, map);
        if (killed) {
            map.removeMonster(mon);
        }
        player.moved = true;
        return { moved: false, tookTime: true };
    }

    // Check terrain
    if (IS_WALL(loc.typ)) {
        // C parity: failed movement into a wall generally doesn't emit
        // a standalone look-style terrain message.
        return { moved: false, tookTime: false };
    }

    if (loc.typ === 0) { // STONE
        // Keep behavior aligned with wall collision handling.
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
            rn2(19); // exercise(A_STR, TRUE) — C ref: attrib.c:506
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

    // Move the player
    player.x = nx;
    player.y = ny;
    player.moved = true;
    game.lastMoveDir = dir;
    maybeSmudgeEngraving(map, oldX, oldY, player.x, player.y);

    // Save nopick state before clearing prefix flags
    // C ref: cmd.c sets context.nopick based on iflags.menu_requested
    const nopick = game.menuRequested;

    // Clear prefix flags after successful movement
    game.menuRequested = false;
    game.forceFight = false;

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
    }

    // Helper function: Check if object class matches pickup_types string
    // C ref: pickup.c pickup_filter() and flags.pickup_types
    function shouldAutopickup(obj, pickupTypes) {
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
            // C uses "n gold piece(s)" format
            const count = gold.quan || 1;
            const plural = count === 1 ? '' : 's';
            display.putstr_message(`${count} gold piece${plural}.`);
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
            player.addToInventory(obj);
            map.removeObject(obj);
            display.putstr_message(`${obj.invlet} - ${doname(obj, player)}.`);
            pickedUp = true;
        }
    }

    // Show what's here if nothing was picked up
    // C ref: hack.c prints "You see here" only if nothing was picked up
    if (!pickedUp && objs.length > 0) {
        if (objs.length === 1) {
            const seen = objs[0];
            if (seen.oclass === COIN_CLASS) {
                const count = seen.quan || 1;
                const plural = count === 1 ? '' : 's';
                display.putstr_message(`You see here ${count} gold piece${plural}.`);
            } else {
                observeObject(seen);
                display.putstr_message(`You see here ${doname(seen, null)}.`);
            }
        } else {
            display.putstr_message(`You see here several objects.`);
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

// C ref: hack.c maybe_smudge_engr()
// On successful movement, attempt to smudge engravings at origin/destination.
function maybeSmudgeEngraving(map, x1, y1, x2, y2) {
    const engravings = map?.engravings;
    if (!Array.isArray(engravings) || engravings.length === 0) return;
    const hasEngraving = (x, y) => engravings.find(e => e.x === x && e.y === y && e.type !== 'headstone');
    if (hasEngraving(x1, y1)) {
        rnd(5);
    }
    if ((x2 !== x1 || y2 !== y1) && hasEngraving(x2, y2)) {
        rnd(5);
    }
}

// Handle running in a direction
// C ref: cmd.c do_run() -> hack.c domove() with context.run
async function handleRun(dir, player, map, display, fov, game) {
    let steps = 0;
    while (steps < 80) { // safety limit
        const result = await handleMovement(dir, player, map, display, game);
        if (!result.moved) break;
        steps++;

        // Stop if we see a monster, item, or interesting feature
        fov.compute(map, player.x, player.y);
        const shouldStop = checkRunStop(map, player, fov, dir);
        if (shouldStop) break;

        // Update display during run
        display.renderMap(map, player, fov);
        display.renderStatus(player);

        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 30));
    }
    return { moved: steps > 0, tookTime: steps > 0 };
}

// Check if running should stop
// C ref: hack.c lookaround() -- checks for interesting things while running
function checkRunStop(map, player, fov, dir) {
    // Check for visible monsters
    for (const mon of map.monsters) {
        if (mon.dead) continue;
        if (fov.canSee(mon.mx, mon.my)) return true;
    }

    // Check for objects at current position
    const objs = map.objectsAt(player.x, player.y);
    if (objs.length > 0) return true;

    // Check for interesting terrain
    const loc = map.at(player.x, player.y);
    if (loc && (loc.typ === STAIRS || loc.typ === FOUNTAIN)) return true;

    // Check if we're at a junction (corridor branches)
    let exits = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = player.x + dx;
            const ny = player.y + dy;
            if (isok(nx, ny)) {
                const nloc = map.at(nx, ny);
                if (nloc && ACCESSIBLE(nloc.typ)) exits++;
            }
        }
    }
    if (exits > 2) return true; // at a junction

    return false;
}

// Handle picking up items
// C ref: pickup.c pickup()
function handlePickup(player, map, display) {
    const objs = map.objectsAt(player.x, player.y);
    if (objs.length === 0) {
        const loc = map.at(player.x, player.y);
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
        const count = gold.quan || 1;
        const plural = count === 1 ? '' : 's';
        display.putstr_message(`${count} gold piece${plural}.`);
        return { moved: false, tookTime: true };
    }

    // Pick up first other item
    // TODO: show menu if multiple items (like C NetHack)
    const obj = objs[0];
    if (!obj) {
        display.putstr_message('There is nothing here to pick up.');
        return { moved: false, tookTime: false };
    }

    player.addToInventory(obj);
    map.removeObject(obj);
    observeObject(obj);
    display.putstr_message(`${obj.invlet} - ${doname(obj, player)}.`);
    return { moved: false, tookTime: true };
}

// Handle going downstairs
// C ref: do.c dodown()
async function handleDownstairs(player, map, display, game) {
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
async function handleUpstairs(player, map, display, game) {
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

// Handle opening a door
// C ref: do.c doopen()
async function handleOpen(player, map, display, game) {
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
    const loc = map.at(nx, ny);

    if (!loc || !IS_DOOR(loc.typ)) {
        display.putstr_message("There's no door there.");
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
        return { moved: false, tookTime: true };
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
            rn2(19); // exercise(A_STR, TRUE)
            display.putstr_message("The door resists!");
        }
        return { moved: false, tookTime: true };
    }

    return { moved: false, tookTime: false };
}

// Handle closing a door
// C ref: do.c doclose()
async function handleClose(player, map, display, game) {
    display.putstr_message('In what direction?');
    const dirCh = await nhgetch();
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
    const loc = map.at(nx, ny);

    if (!loc || !IS_DOOR(loc.typ)) {
        display.putstr_message("There's no door there.");
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

// Handle inventory display
// C ref: invent.c ddoinv()
async function handleInventory(player, display) {
    if (player.inventory.length === 0) {
        display.putstr_message('Not carrying anything.');
        return { moved: false, tookTime: false };
    }

    // Group items by class, display in C inventory order
    // C ref: invent.c display_inventory() / display_pickinv()
    const CLASS_NAMES = {
        1: 'Weapons', 2: 'Armor', 3: 'Rings', 4: 'Amulets',
        5: 'Tools', 6: 'Comestibles', 7: 'Potions', 8: 'Scrolls',
        9: 'Spellbooks', 10: 'Wands', 11: 'Coins', 12: 'Gems/Stones',
    };
    const INV_ORDER = [11, 4, 1, 2, 6, 8, 9, 7, 3, 10, 5, 12, 13, 14, 15];

    const groups = {};
    for (const item of player.inventory) {
        const cls = item.oclass;
        if (!groups[cls]) groups[cls] = [];
        groups[cls].push(item);
    }

    const lines = [];
    for (const cls of INV_ORDER) {
        if (!groups[cls]) continue;
        lines.push(` ${CLASS_NAMES[cls] || 'Other'}`);
        for (const item of groups[cls]) {
            const invName = doname(item, player)
                .replace('(wielded)', '(weapon in right hand)');
            lines.push(` ${item.invlet} - ${invName}`);
        }
    }
    lines.push(' (end)');

    if (typeof display.renderOverlayMenu === 'function') {
        display.renderOverlayMenu(lines);
    } else {
        display.renderChargenMenu(lines, false);
    }
    await nhgetch(); // wait for dismissal

    return { moved: false, tookTime: false };
}

// Handle wielding a weapon
// C ref: wield.c dowield()
// C ref: wield.c dowield() — wield a weapon (instant action, no time cost)
async function handleWield(player, display) {
    const weapons = player.inventory.filter(o => o.oclass === 1); // WEAPON_CLASS
    if (weapons.length === 0) {
        display.putstr_message('You have no weapons to wield.');
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`Wield what? [${weapons.map(w => w.invlet).join('')} or - for bare hands]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    if (c === '-') {
        player.weapon = null;
        display.putstr_message('You are now empty-handed.');
        // C ref: wield.c:dowield returns ECMD_TIME (wielding takes a turn)
        return { moved: false, tookTime: true };
    }

    const weapon = weapons.find(w => w.invlet === c);
    if (weapon) {
        player.weapon = weapon;
        display.putstr_message(`${weapon.invlet} - ${weapon.name} (weapon in hand).`);
        // C ref: wield.c:dowield returns ECMD_TIME (wielding takes a turn)
        return { moved: false, tookTime: true };
    }

    display.putstr_message("Never mind.");
    return { moved: false, tookTime: false };
}

// Handle wearing armor
// C ref: do_wear.c dowear()
async function handleWear(player, display) {
    const armor = player.inventory.filter(o => o.oclass === 2); // ARMOR_CLASS
    if (armor.length === 0) {
        display.putstr_message('You have no armor to wear.');
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`Wear what? [${armor.map(a => a.invlet).join('')}]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    const item = armor.find(a => a.invlet === c);
    if (item) {
        player.armor = item;
        player.ac = item.ac + (item.enchantment || 0);
        display.putstr_message(`You are now wearing ${item.name}.`);
        return { moved: false, tookTime: true };
    }

    display.putstr_message("Never mind.");
    return { moved: false, tookTime: false };
}

// Handle taking off armor
// C ref: do_wear.c dotakeoff()
async function handleTakeOff(player, display) {
    if (!player.armor) {
        display.putstr_message("You're not wearing any armor.");
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`You take off ${player.armor.name}.`);
    player.armor = null;
    player.ac = 10;
    return { moved: false, tookTime: true };
}

// Handle dropping an item
// C ref: do.c dodrop()
async function handleDrop(player, map, display) {
    if (player.inventory.length === 0) {
        display.putstr_message("You don't have anything to drop.");
        return { moved: false, tookTime: false };
    }

    while (true) {
        display.putstr_message('What do you want to drop? [*]');
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        if (ch === 27 || c === ' ') {
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?' || c === '*') {
            continue;
        }

        const item = player.inventory.find(o => o.invlet === c);
        if (!item) continue;

        // Unequip if necessary
        if (player.weapon === item) player.weapon = null;
        if (player.armor === item) { player.armor = null; player.ac = 10; }

        player.removeFromInventory(item);
        item.ox = player.x;
        item.oy = player.y;
        map.objects.push(item);
        display.putstr_message(`You drop ${item.name}.`);
        return { moved: false, tookTime: true };
    }
}

// Handle eating
// C ref: eat.c doeat() → start_eating() → eatfood() occupation
async function handleEat(player, display, game) {
    const food = player.inventory.filter(o => o.oclass === 6); // FOOD_CLASS
    if (food.length === 0) {
        display.putstr_message("You don't have anything to eat.");
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`Eat what? [${food.map(f => f.invlet).join('')}]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    const item = food.find(f => f.invlet === c);
    if (item) {
        const od = objectData[item.otyp];
        const reqtime = (od ? od.delay : 0) + 1; // C ref: eat.c reqtime = oc_delay + 1
        const baseNutr = od ? od.nutrition : 200;
        // C ref: eat.c nmod calculation — nutrition distributed per bite
        // nmod < 0 means add -nmod each turn; nmod > 0 means add 1 some turns
        const nmod = (reqtime === 0 || baseNutr === 0) ? 0
            : (baseNutr >= reqtime) ? -Math.floor(baseNutr / reqtime)
            : reqtime % baseNutr;
        let usedtime = 0;

        // C ref: eat.c bite() — apply incremental nutrition
        function doBite() {
            if (nmod < 0) {
                player.hunger += (-nmod);
                player.nutrition += (-nmod);
            } else if (nmod > 0 && (usedtime % nmod)) {
                player.hunger += 1;
                player.nutrition += 1;
            }
        }

        // First bite (turn 1) — mirrors C start_eating() + bite()
        usedtime++;
        doBite();
        display.putstr_message(`You begin eating the ${item.name}.`);

        if (reqtime > 1) {
            // Set occupation for remaining turns — C ref: set_occupation(eatfood, ...)
            game.occupation = {
                fn: () => {
                    usedtime++;
                    if (usedtime >= reqtime) {
                        // Done eating — mirrors C done_eating()
                        // Apply remaining nutrition not yet distributed
                        player.removeFromInventory(item);
                        display.putstr_message(`You finish eating the ${item.name}.`);
                        return 0; // done
                    }
                    doBite();
                    return 1; // continue
                },
                txt: `eating ${item.name}`,
                xtime: reqtime,
            };
        } else {
            // Single-turn food — eat instantly
            player.removeFromInventory(item);
            display.putstr_message(`This ${item.name} is delicious!`);
        }
        return { moved: false, tookTime: true };
    }

    display.putstr_message("Never mind.");
    return { moved: false, tookTime: false };
}

// Handle reading
// C ref: read.c doread()
async function handleRead(player, display) {
    // Keep prompt active until explicit cancel, matching tty flow.
    while (true) {
        display.putstr_message('What do you want to read? [*]');
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);
        if (ch === 27 || c === ' ') {
            display.putstr_message('Never mind.');
            return { moved: false, tookTime: false };
        }
        if (c === '?') {
            // In C this can show item help/menu; return to prompt afterward.
            continue;
        }
        // Keep waiting for a supported selection.
    }
}

// Handle quaffing a potion
// C ref: potion.c dodrink()
async function handleQuaff(player, map, display) {
    // C ref: potion.c:540-550 — check for fountain first
    const loc = map.at(player.x, player.y);
    if (loc && loc.typ === FOUNTAIN) {
        display.putstr_message('Drink from the fountain?');
        const ans = await nhgetch();
        display.topMessage = null;
        if (String.fromCharCode(ans) === 'y') {
            drinkfountain(player, map, display);
            return { moved: false, tookTime: true };
        }
    }

    const potions = player.inventory.filter(o => o.oclass === 7); // POTION_CLASS
    if (potions.length === 0) {
        display.putstr_message("You don't have anything to drink.");
        return { moved: false, tookTime: false };
    }

    display.putstr_message(`Drink what? [${potions.map(p => p.invlet).join('')}]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    const item = potions.find(p => p.invlet === c);
    if (item) {
        player.removeFromInventory(item);
        // Simple potion effects
        if (item.name.includes('healing')) {
            const heal = c_d(4, 4) + 2;
            player.heal(heal);
            display.putstr_message(`You feel better. (${heal} HP restored)`);
        } else if (item.name.includes('extra healing')) {
            const heal = c_d(8, 4) + 4;
            player.heal(heal);
            display.putstr_message(`You feel much better. (${heal} HP restored)`);
        } else {
            display.putstr_message("Hmm, that tasted like water.");
        }
        return { moved: false, tookTime: true };
    }

    display.putstr_message("Never mind.");
    return { moved: false, tookTime: false };
}

// C ref: fountain.c:243 drinkfountain() — drink from a fountain
function drinkfountain(player, map, display) {
    const loc = map.at(player.x, player.y);
    const mgkftn = loc && loc.blessedftn === 1;
    const fate = rnd(30);

    // C ref: fountain.c:254 — blessed fountain jackpot
    if (mgkftn && (player.luck || 0) >= 0 && fate >= 10) {
        display.putstr_message('Wow!  This makes you feel great!');
        rn2(6); // rn2(A_MAX) — random starting attribute
        // adjattrib loop — simplified, no RNG for basic case
        display.putstr_message('A wisp of vapor escapes the fountain...');
        rn2(19); // exercise(A_WIS, TRUE)
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
            rn2(19); // exercise(A_WIS, TRUE)
            break;
        case 20:
            display.putstr_message('The water is foul!  You gag and vomit.');
            rn2(20) + 11; // rn1(20, 11) = rn2(20) + 11 for morehungry
            break;
        case 21:
            display.putstr_message('The water is contaminated!');
            rn2(4) + 3; // rn1(4, 3) for poison_strdmg
            rnd(10);    // damage
            rn2(19);    // exercise(A_CON, FALSE)
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

    if (!msg) msg = 'You see nothing special.';
    display.putstr_message(msg.substring(0, 79));
    return { moved: false, tookTime: false };
}

// Handle kicking
// C ref: dokick.c dokick()
async function handleKick(player, map, display, game) {
    display.putstr_message('In what direction?');
    const dirCh = await nhgetch();
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
    const loc = map.at(nx, ny);

    if (!loc) return { moved: false, tookTime: false };

    // Kick a monster
    const mon = map.monsterAt(nx, ny);
    if (mon) {
        display.putstr_message(`You kick the ${mon.name}!`);
        const damage = rnd(4) + player.strDamage;
        mon.mhp -= Math.max(1, damage);
        if (mon.mhp <= 0) {
            mon.dead = true;
            display.putstr_message(`The ${mon.name} dies!`);
            map.removeMonster(mon);
        }
        return { moved: false, tookTime: true };
    }

    // Kick a locked door
    if (IS_DOOR(loc.typ) && (loc.flags & D_LOCKED)) {
        if (rn2(4)) {
            display.putstr_message("WHAMMM!!!");
            loc.flags = D_ISOPEN;
        } else {
            display.putstr_message("WHAMMM!!! The door holds.");
        }
        return { moved: false, tookTime: true };
    }

    // Kick a closed door
    if (IS_DOOR(loc.typ) && (loc.flags & D_CLOSED)) {
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
        rn2(2);
        rn2(2);
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
    rn2(2); // exercise(A_DEX, FALSE)
    const dex = player.attributes?.[A_DEX] || 10;
    if (dex >= 16 || rn2(3) !== 0) {
        display.putstr_message("You kick at empty space.");
    } else {
        display.putstr_message("Dumb move!  You strain a muscle.");
        rn2(2); // exercise(A_STR, FALSE)
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

    // C ref: topl.c:102 mode 's' (single)
    // Shows messages one at a time on top line, cycling backwards
    // User can press Ctrl+P repeatedly to see older messages

    let messageIndex = messages.length - 1; // Start with most recent message

    while (true) {
        // Show current message on top line
        // C ref: redotoplin(cw->data[cw->maxcol])
        if (messageIndex >= 0 && messageIndex < messages.length) {
            display.putstr_message(messages[messageIndex]);
        }

        // Move to next older message for next iteration
        // C ref: cw->maxcol--
        messageIndex--;

        // Wrap around to newest if we've gone past oldest
        // C ref: if (cw->maxcol < 0) cw->maxcol = cw->rows - 1
        if (messageIndex < 0) {
            messageIndex = messages.length - 1;
        }

        // Wait for user input
        // C ref: } while (morc == C('p'))
        const ch = await nhgetch();

        // If user presses Ctrl+P again, continue to next older message
        if (ch === 16) { // Ctrl+P
            continue;
        } else {
            // Any other key exits
            break;
        }
    }

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
        // For now, show simple "ON" message
        // TODO: Add pickup_types support ("ON, for $ objects" etc.)
        msg = 'Autopickup: ON, for all objects.';
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
        display.putstr_message(`${VERSION_STRING} -- a game by the NetHack DevTeam.`);
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
export function dosearch0(player, map, display) {
    let found = false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = player.x + dx;
            const ny = player.y + dy;
            if (!isok(nx, ny)) continue;
            const loc = map.at(nx, ny);
            if (!loc) continue;

            // Find secret doors
            // C ref: detect.c -- secret doors become regular doors
            if (loc.typ === 14) { // SDOOR
                if (rnl(7) === 0) {
                    loc.typ = DOOR;
                    loc.flags = D_CLOSED;
                    display.putstr_message('You find a hidden door!');
                    found = true;
                }
            }
            // Find secret corridors
            if (loc.typ === 15) { // SCORR
                if (rnl(7) === 0) {
                    loc.typ = 24; // CORR
                    display.putstr_message('You find a hidden passage!');
                    found = true;
                }
            }
        }
    }
    if (!found) {
        // No message on search failure (matches C behavior)
    }
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

    function renderCenteredList(lines, left = 41) {
        display.clearScreen();
        for (let i = 0; i < lines.length && i < display.rows; i++) {
            display.putstr(left, i, lines[i].substring(0, Math.max(0, display.cols - left)));
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

    // Interactive loop - C ref: options.c doset() menu loop
    while (true) {
        drawOptions();

        // Get input - C ref: options.c menu input loop
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        // Check for exit
        if (ch === 27 || c === 'q') { // ESC or q
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
async function handleExtendedCommand(game) {
    const { display } = game;
    const input = await getlin('# ', display);
    if (input === null || input.trim() === '') {
        return { moved: false, tookTime: false };
    }
    const cmd = input.trim().toLowerCase();
    switch (cmd) {
        case 'o':
        case 'options':
        case 'optionsfull':
            return await handleSet(game);
        case 'n':
        case 'name': {
            // C ref: do_name.c docallcmd() / do_mname()
            // Minimal faithful flow for replay traces:
            // ask what to name, allow dungeon-level naming, then getlin text.
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
                // Keep waiting for a supported selection.
            }
        }
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
        default:
            display.putstr_message(
                `Unknown extended command: ${cmd}. Try: options, levelchange, map, teleport, genesis, quit.`
            );
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
    const input = await getlin('To what level do you want to change? ', display);
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
    display.putstr_message(`You are now on dungeon level ${level}.`);
    game.changeLevel(level);
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
        const row = cursorY + (game.flags.msg_window ? 3 : 1);
        const oldCell = display.grid[row][cursorX];
        display.setCell(cursorX, row, 'X', 14); // White X for cursor
        display.render();

        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        // Restore cell
        display.setCell(cursorX, row, oldCell.ch, oldCell.color);

        // Handle cursor movement
        if (c === 'h' && cursorX > 0) cursorX--;
        else if (c === 'l' && cursorX < COLNO - 1) cursorX++;
        else if (c === 'k' && cursorY > 0) cursorY--;
        else if (c === 'j' && cursorY < ROWNO - 1) cursorY++;
        else if (c === 'y' && cursorX > 0 && cursorY > 0) { cursorX--; cursorY--; }
        else if (c === 'u' && cursorX < COLNO - 1 && cursorY > 0) { cursorX++; cursorY--; }
        else if (c === 'b' && cursorX > 0 && cursorY < ROWNO - 1) { cursorX--; cursorY++; }
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
