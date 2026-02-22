// hack.js -- Movement, running, and travel
// Mirrors hack.c from the C source.
// domove(), findtravelpath(), lookaround(), etc.

import { COLNO, ROWNO, STONE, DOOR, CORR, SDOOR, SCORR, STAIRS, LADDER, FOUNTAIN, SINK, THRONE, ALTAR, GRAVE,
         POOL, LAVAPOOL, IRONBARS, TREE, ROOM, IS_DOOR, D_CLOSED, D_LOCKED,
         D_ISOPEN, D_NODOOR, D_BROKEN, ACCESSIBLE, IS_OBSTRUCTED, IS_WALL, ICE,
         isok, A_STR, A_DEX, A_CON, A_WIS, MAP_ROW_START } from './config.js';
import { SQKY_BOARD, SLP_GAS_TRAP, FIRE_TRAP, PIT, SPIKED_PIT, ANTI_MAGIC } from './symbols.js';
import { rn2, rnd, rnl, d, c_d } from './rng.js';
import { exercise } from './attrib_exercise.js';
import { WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
         TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
         WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS } from './objects.js';
import { nhgetch } from './input.js';
import { playerAttackMonster } from './uhitm.js';
import { formatGoldPickupMessage, formatInventoryPickupMessage } from './do.js';
import { monDisplayName, monNam } from './mondata.js';
import { maybeSmudgeEngraving } from './engrave.js';
import { describeGroundObjectForPlayer, maybeHandleShopEntryMessage } from './shk.js';
import { observeObject } from './discovery.js';
import { DIRECTION_KEYS } from './dothrow.js';
import { dosearch0 } from './detect.js';
import { monsterNearby, monnear } from './monutil.js';
import { ynFunction } from './input.js';

// Run direction keys (shift = run)
export const RUN_KEYS = {
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

// Handle directional movement
// C ref: hack.c domove() -- the core movement function
export async function handleMovement(dir, player, map, display, game) {
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

    // C ref: hack.c:2741 escape_from_sticky_mon(x, y)
    // If hero is stuck to a monster and trying to move away, attempt escape.
    if (player.ustuck && (nx !== player.ustuck.mx || ny !== player.ustuck.my)) {
        const stuckMon = player.ustuck;
        if (stuckMon.dead || !monnear(stuckMon, player.x, player.y)) {
            // Monster died or is no longer adjacent — auto-release
            player.ustuck = null;
        } else {
            // C ref: hack.c:2645 rn2(!u.ustuck->mcanmove ? 8 : 40)
            const canMove = stuckMon.mcanmove !== false && !stuckMon.mfrozen;
            const escapeRoll = rn2(canMove ? 40 : 8);
            if (escapeRoll <= 2) {
                // Escape successful (cases 0, 1, 2)
                display.putstr_message(`You pull free from the ${monDisplayName(stuckMon)}.`);
                player.ustuck = null;
            } else if (escapeRoll === 3 && !canMove) {
                // Wake/release frozen monster, then check tame
                stuckMon.mfrozen = 1;
                stuckMon.sleeping = false;
                if (stuckMon.tame && !game?.flags?.conflict) {
                    display.putstr_message(`You pull free from the ${monDisplayName(stuckMon)}.`);
                    player.ustuck = null;
                } else {
                    display.putstr_message(`You cannot escape from the ${monDisplayName(stuckMon)}!`);
                    return { moved: false, tookTime: true };
                }
            } else {
                // Failed to escape
                if (stuckMon.tame && !game?.flags?.conflict) {
                    display.putstr_message(`You pull free from the ${monDisplayName(stuckMon)}.`);
                    player.ustuck = null;
                } else {
                    display.putstr_message(`You cannot escape from the ${monDisplayName(stuckMon)}!`);
                    return { moved: false, tookTime: true };
                }
            }
        }
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

// Handle running in a direction
// C ref: cmd.c do_run() -> hack.c domove() with context.run
export async function handleRun(dir, player, map, display, fov, game, runStyle = 'run') {
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

// BFS pathfinding for travel command
// C ref: hack.c findtravelpath()
export function findPath(map, startX, startY, endX, endY) {
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
export async function handleTravel(game) {
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

// Wait/search safety warning and execution helpers for rhack()
// C ref: do.c cmd_safety_prevention()
export function performWaitSearch(cmd, game, map, player, fov, display) {
    if (game && game.flags && game.flags.safe_wait
        && !game.menuRequested && !(game.multi > 0) && !game.occupation) {
        if (monsterNearby(map, player, fov)) {
            safetyWarning(cmd, game, display);
            return { moved: false, tookTime: false };
        }
    }
    resetSafetyWarningCounter(cmd, game);
    if (cmd === 's') {
        dosearch0(player, map, display, game);
    }
    return { moved: false, tookTime: true };
}

function safetyWarning(cmd, game, display) {
    const search = cmd === 's';
    const counterKey = search ? 'alreadyFoundFlag' : 'didNothingFlag';
    const cmddesc = search ? 'another search' : 'a no-op (to rest)';
    const act = search ? 'You already found a monster.' : 'Are you waiting to get hit?';

    if (!Number.isInteger(game[counterKey])) game[counterKey] = 0;
    const includeHint = !!(game.flags?.cmdassist || game[counterKey] === 0);
    if (!game.flags?.cmdassist) game[counterKey] += 1;

    const msg = includeHint ? `${act}  Use 'm' prefix to force ${cmddesc}.` : act;
    if (game.lastSafetyWarningMessage === msg) {
        clearTopline(display);
        return;
    }
    display.putstr_message(msg);
    game.lastSafetyWarningMessage = msg;
}

function resetSafetyWarningCounter(cmd, game) {
    if (cmd === 's') {
        game.alreadyFoundFlag = 0;
    } else {
        game.didNothingFlag = 0;
    }
    game.lastSafetyWarningMessage = '';
}

function clearTopline(display) {
    if (!display) return;
    if (typeof display.clearRow === 'function') display.clearRow(0);
    if ('topMessage' in display) display.topMessage = '';
    if ('messageNeedsMore' in display) display.messageNeedsMore = false;
}
