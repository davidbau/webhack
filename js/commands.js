// commands.js -- Command dispatch
// Mirrors cmd.c from the C source.
// Maps keyboard input to game actions.

import { COLNO, ROWNO, DOOR, STAIRS, FOUNTAIN, ROOM, IS_DOOR, D_CLOSED, D_LOCKED,
         D_ISOPEN, D_NODOOR, ACCESSIBLE, IS_WALL, MAXLEVEL, VERSION_STRING,
         isok, A_STR, A_DEX, A_CON } from './config.js';
import { SQKY_BOARD } from './symbols.js';
import { rn2, rnd, rnl, d } from './rng.js';
import { objectData } from './objects.js';
import { nhgetch, ynFunction, getlin } from './input.js';
import { playerAttackMonster } from './combat.js';
import { makemon } from './makemon.js';
import { mons } from './monsters.js';
import { doname } from './mkobj.js';
import { showPager } from './pager.js';
import { handleZap } from './zap.js';
import { saveGame, loadFlags, saveFlags, OPTION_DEFS } from './storage.js';

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
        // C ref: cmd.c -- '.' is rest, 's' is search
        if (c === 's') {
            display.putstr_message('You search...');
            // C ref: detect.c dosearch0() -- check adjacent squares for hidden things
            dosearch0(player, map, display);
        } else {
            display.putstr_message('You wait.');
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
        return await handleOpen(player, map, display);
    }

    // Close door
    if (c === 'c') {
        return await handleClose(player, map, display);
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
        display.putstr_message("You haven't discovered anything yet.");
        return { moved: false, tookTime: false };
    }

    // History (V)
    // C ref: pager.c dohistory()
    if (c === 'V') {
        return await handleHistory(game);
    }

    // Kick (Ctrl+D)
    if (ch === 4) {
        return await handleKick(player, map, display);
    }

    // Previous messages (Ctrl+P)
    if (ch === 16) {
        return handlePrevMessages(display);
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
        // Simplified: tame/peaceful monsters are displaced (swap positions)
        // BUT: 'F' prefix (forceFight) forces attack even on peaceful monsters
        const shouldDisplace = (mon.tame || mon.peaceful) && !game.forceFight;

        if (shouldDisplace) {
            // Pet displacement: swap positions
            // C ref: hack.c:2142-2156 — remove_monster + place_monster swaps positions
            const oldPlayerX = player.x;
            const oldPlayerY = player.y;
            mon.mx = oldPlayerX;
            mon.my = oldPlayerY;
            player.x = nx;
            player.y = ny;
            player.moved = true;
            display.putstr_message(`You swap places with ${mon.name}.`);
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
        display.putstr_message("It's a wall.");
        return { moved: false, tookTime: false };
    }

    if (loc.typ === 0) { // STONE
        display.putstr_message("It's solid stone.");
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
        }
        // TODO: implement other trap effects (fire, pit, etc.) with RNG
    }

    // Autopickup — C ref: hack.c:3265 pickup(1)
    // C ref: pickup.c pickup() checks flags.pickup && !context.nopick
    const objs = map.objectsAt(nx, ny);
    let pickedUp = false;
    if (game.flags.pickup && !nopick && objs.length > 0) {
        // Pick up first non-gold item
        const obj = objs.find(o => o.oclass !== 11); // not gold
        if (obj) {
            player.addToInventory(obj);
            map.removeObject(obj);
            display.putstr_message(`${obj.invlet} - ${obj.name}.`);
            pickedUp = true;
        }
    }

    // Show what's here if autopickup didn't happen
    // C ref: hack.c prints "You see here" only if nothing was picked up
    if (!pickedUp && objs.length > 0) {
        if (objs.length === 1) {
            display.putstr_message(`You see here ${objs[0].name}.`);
        } else {
            display.putstr_message(`You see here several objects.`);
        }
    }

    // Check for stairs
    // C ref: do.c:738 flags.verbose gates "There is a staircase..."
    if (game.flags.verbose && loc.typ === STAIRS) {
        if (loc.flags === 1) {
            display.putstr_message('There is a staircase up here.');
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
        display.putstr_message('There is nothing here to pick up.');
        return { moved: false, tookTime: false };
    }

    // Pick up first non-gold item
    const obj = objs.find(o => o.oclass !== 11); // not gold
    if (!obj) {
        display.putstr_message('There is nothing here to pick up.');
        return { moved: false, tookTime: false };
    }

    player.addToInventory(obj);
    map.removeObject(obj);
    display.putstr_message(`${obj.invlet} - ${obj.name}.`);
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
    display.putstr_message('You descend the staircase.');

    // Generate new level (changeLevel sets player.dungeonLevel)
    game.changeLevel(newDepth);
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
    display.putstr_message('You climb the staircase.');
    game.changeLevel(newDepth);
    return { moved: false, tookTime: true };
}

// Handle opening a door
// C ref: do.c doopen()
async function handleOpen(player, map, display) {
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

    if (loc.flags & D_ISOPEN || loc.flags === D_NODOOR) {
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
async function handleClose(player, map, display) {
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
            lines.push(` ${item.invlet} - ${doname(item, player)}`);
        }
    }
    lines.push(' (end)');

    display.renderChargenMenu(lines, true);
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
        // C ref: wield.c:dowield sets multi=0 (no time cost)
        return { moved: false, tookTime: false };
    }

    const weapon = weapons.find(w => w.invlet === c);
    if (weapon) {
        player.weapon = weapon;
        display.putstr_message(`${weapon.invlet} - ${weapon.name} (weapon in hand).`);
        // C ref: wield.c:dowield sets multi=0 (no time cost)
        return { moved: false, tookTime: false };
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

    display.putstr_message(`Drop what? [${player.inventory.map(o => o.invlet).join('')}]`);
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    const item = player.inventory.find(o => o.invlet === c);
    if (item) {
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

    display.putstr_message("Never mind.");
    return { moved: false, tookTime: false };
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

// Handle quaffing a potion
// C ref: potion.c dodrink()
async function handleQuaff(player, map, display) {
    // C ref: potion.c:540-550 — check for fountain first
    const loc = map.at(player.x, player.y);
    if (loc && loc.typ === FOUNTAIN) {
        display.putstr_message('Drink from the fountain?');
        const ans = await nhgetch();
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
            const heal = d(4, 4) + 2;
            player.heal(heal);
            display.putstr_message(`You feel better. (${heal} HP restored)`);
        } else if (item.name.includes('extra healing')) {
            const heal = d(8, 4) + 4;
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
        if (loc.typ === STAIRS && loc.flags === 1) msg += 'There is a staircase up here. ';
        else if (loc.typ === STAIRS && loc.flags === 0) msg += 'There is a staircase down here. ';
        else if (loc.typ === FOUNTAIN) msg += 'There is a fountain here. ';
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
async function handleKick(player, map, display) {
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

    display.putstr_message("Thump!");
    return { moved: false, tookTime: true };
}

// Handle previous messages
// C ref: cmd.c doprev_message()
function handlePrevMessages(display) {
    const recent = display.messages.slice(-5);
    if (recent.length === 0) {
        display.putstr_message('No previous messages.');
    } else {
        display.putstr_message(recent.join(' | ').substring(0, 79));
    }
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
                if (rn2(7) === 0) {
                    loc.typ = DOOR;
                    loc.flags = D_CLOSED;
                    display.putstr_message('You find a hidden door!');
                    found = true;
                }
            }
            // Find secret corridors
            if (loc.typ === 15) { // SCORR
                if (rn2(7) === 0) {
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

// Handle options (O) — C ref: cmd.c doset()
// Metadata-driven from OPTION_DEFS (mirrors C allopt[])
async function handleSet(game) {
    const { display, player } = game;
    const flags = game.flags;

    // C ref: options.c doset_simple() — show current options
    const lines = [];
    lines.push('Current Options:');
    lines.push('');
    lines.push('Press a letter to toggle an option, ESC to exit');
    lines.push('');

    // Group options by category for better readability
    const categories = {
        'Gameplay': ['pickup', 'safe_pet', 'confirm'],
        'Display': ['showexp', 'color', 'time', 'lit_corridor'],
        'Interface': ['verbose', 'tombstone', 'rest_on_space', 'number_pad'],
    };

    for (const [category, optNames] of Object.entries(categories)) {
        lines.push(`${category}:`);
        for (const optName of optNames) {
            const def = OPTION_DEFS.find(d => d.name === optName);
            if (def && def.type === 'boolean') {
                const value = flags[def.name] ? 'ON' : 'OFF';
                lines.push(`  ${def.menuChar}) ${def.label}: ${value}`);
            }
        }
        lines.push('');
    }

    lines.push('Note: Some options (autopickup behavior, msg_window) not yet fully implemented.');
    lines.push('      number_pad changes movement keys (1-9 for directions).');

    await showPager(display, lines.join('\n'), 'Options');

    // After showing pager, ask if user wants to toggle an option
    display.putstr_message('Toggle option (letter) or ESC: ');
    const ch = await nhgetch();
    const c = String.fromCharCode(ch);

    if (ch === 27) { // ESC
        display.putstr_message('Never mind.');
        return { moved: false, tookTime: false };
    }

    // Find matching option by menuChar
    const def = OPTION_DEFS.find(d => d.menuChar === c);
    if (def && def.type === 'boolean') {
        flags[def.name] = !flags[def.name];
        display.putstr_message(`${def.label}: ${flags[def.name] ? 'ON' : 'OFF'}`);

        // Apply side-effects for specific flags
        if (def.name === 'showexp') {
            player.showExp = flags.showexp;
        }
        if (def.name === 'time') {
            player.showTime = flags.time;
        }
        // Update global flags for input handler
        window.gameFlags = flags;

        saveFlags(flags);
    } else {
        display.putstr_message(`No option '${c}'.`);
    }
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
                `Unknown extended command: ${cmd}. Try: levelchange, map, teleport, genesis, quit.`
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
