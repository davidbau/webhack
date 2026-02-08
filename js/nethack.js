// nethack.js -- Main entry point and game loop
// Mirrors allmain.c from the C source.
// This is the heart of the JS port: the game initialization and main loop.

import { COLNO, ROWNO, ROOM, STAIRS, NORMAL_SPEED, ACCESSIBLE, isok, A_DEX } from './config.js';
import { initRng, rn2, rnd, rn1 } from './rng.js';
import { Display } from './display.js';
import { initInput, nhgetch } from './input.js';
import { FOV } from './fov.js';
import { Player, roles } from './player.js';
import { GameMap } from './map.js';
import { initLevelGeneration, generateLevel, wallification } from './dungeon.js';
// populateLevel/populateObjects removed: monsters and objects are now
// created during generateLevel() via C-faithful makemon_gen/mkobj_gen
import { processCommand } from './commands.js';
import { moveMonsters } from './monmove.js';
import { simulatePostLevelInit } from './u_init.js';

// Parse URL parameters for game options
// Supports: ?wizard=1, ?seed=N, ?role=X
function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        wizard: params.get('wizard') === '1' || params.get('wizard') === 'true',
        seed: params.has('seed') ? parseInt(params.get('seed'), 10) : null,
        role: params.get('role') || null,
    };
}

// --- Game State ---
// C ref: decl.h -- globals are accessed via NH object (see DECISIONS.md #7)
class NetHackGame {
    constructor() {
        this.player = new Player();
        this.map = null;
        this.display = null;
        this.fov = new FOV();
        this.levels = {};     // cached levels by depth
        this.gameOver = false;
        this.gameOverReason = '';
        this.turnCount = 0;
        this.wizard = false;  // C ref: flags.debug (wizard mode)
        this.seerTurn = 0;    // C ref: context.seer_turn — clairvoyance timer
    }

    // Initialize a new game
    // C ref: allmain.c early_init() + moveloop_preamble()
    async init() {
        // Parse URL params
        const urlOpts = parseUrlParams();
        this.wizard = urlOpts.wizard;

        // Initialize RNG with seed from URL or random
        const seed = urlOpts.seed !== null
            ? urlOpts.seed
            : Math.floor(Math.random() * 0xFFFFFFFF);
        initRng(seed);

        // Initialize display
        this.display = new Display('game');

        // Initialize input
        initInput();

        // Show welcome message
        // C ref: allmain.c -- welcome messages
        const wizStr = this.wizard ? ' [WIZARD MODE]' : '';
        const seedStr = urlOpts.seed !== null ? ` (seed:${seed})` : '';
        this.display.putstr_message(`NetHack JS -- Welcome to the Mazes of Menace!${wizStr}${seedStr}`);

        // One-time level generation init (init_objects + dungeon structure)
        // C ref: early_init() — happens once before any level generation
        initLevelGeneration();

        // Player selection
        // C ref: In wizard mode, auto-selects Valkyrie/Human/Female/Neutral
        // with NO RNG consumption. In normal mode, interactive selection.
        if (this.wizard) {
            // Wizard mode: auto-select Valkyrie (index 11)
            this.player.initRole(11); // PM_VALKYRIE
            this.player.name = 'Wizard';
            this.player.gender = 1; // female
        } else {
            await this.playerSelection();
        }

        // Generate first level
        // C ref: mklev() — bones rn2(3) + makelevel
        this.changeLevel(1);

        // Place player at upstair position
        // C ref: u_on_upstairs() — no RNG
        this.placePlayerOnLevel();

        // Post-level initialization: pet, inventory, attributes, welcome
        // C ref: allmain.c newgame() — makedog through welcome(TRUE)
        if (this.wizard) {
            simulatePostLevelInit(this.player, this.map, 1);
        }

        // Initial display
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov);
        this.display.renderStatus(this.player);
    }

    // Player role selection
    // C ref: role.c player_selection() -- choose role, race, gender, alignment
    async playerSelection() {
        this.display.putstr_message('Choose your role:');

        // Build role menu
        const items = roles.map((role, idx) => ({
            letter: String.fromCharCode(97 + idx),
            text: role.name,
            index: idx,
        }));

        // Simple role selection: show options and wait for key
        let menuText = '';
        for (const item of items) {
            menuText += `${item.letter}) ${item.text}  `;
        }
        this.display.putstr(0, 2, menuText.substring(0, 79), 7); // CLR_GRAY

        // Show second line if needed
        if (menuText.length > 79) {
            this.display.putstr(0, 3, menuText.substring(79, 158), 7);
        }

        this.display.putstr_message('Pick a role [a-m, or * for random]:');
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        let roleIdx;
        if (c === '*' || c === ' ') {
            roleIdx = rn2(roles.length);
        } else {
            roleIdx = ch - 97; // 'a' = 0
            if (roleIdx < 0 || roleIdx >= roles.length) {
                roleIdx = rn2(roles.length);
            }
        }

        this.player.initRole(roleIdx);
        this.player.name = `Player the ${roles[roleIdx].name}`;

        // Ask for player name
        this.display.clearRow(2);
        this.display.clearRow(3);
        this.display.putstr_message(`You are a ${roles[roleIdx].name}. Press any key to begin.`);
        await nhgetch();
    }

    // Generate or retrieve a level
    // C ref: dungeon.c -- level management
    changeLevel(depth) {
        // Cache current level
        if (this.map) {
            this.levels[this.player.dungeonLevel] = this.map;
        }

        // Check cache
        if (this.levels[depth]) {
            this.map = this.levels[depth];
        } else {
            // Generate new level
            this.map = generateLevel(depth);
            wallification(this.map);
            this.levels[depth] = this.map;
        }

        this.player.dungeonLevel = depth;
        this.placePlayerOnLevel();

        // Update display
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov);
        this.display.renderStatus(this.player);
    }

    // Place player on the current level
    // C ref: allmain.c moveloop_preamble() -> places hero at stair position
    placePlayerOnLevel() {
        // For level 1, there are no upstairs; place in a room
        // For deeper levels, place at upstair (came from above)
        const hasUpstair = this.map.upstair.x > 0 && this.map.upstair.y > 0;
        if (hasUpstair && this.player.dungeonLevel > 1) {
            this.player.x = this.map.upstair.x;
            this.player.y = this.map.upstair.y;
            return;
        }

        // Find a room to place player
        if (this.map.rooms.length > 0) {
            const room = this.map.rooms[0];
            this.player.x = Math.floor((room.lx + room.hx) / 2);
            this.player.y = Math.floor((room.ly + room.hy) / 2);
            return;
        }

        // Fallback: find any accessible square
        for (let x = 1; x < COLNO - 1; x++) {
            for (let y = 1; y < ROWNO - 1; y++) {
                const loc = this.map.at(x, y);
                if (loc && ACCESSIBLE(loc.typ)) {
                    this.player.x = x;
                    this.player.y = y;
                    return;
                }
            }
        }
    }

    // Main game loop
    // C ref: allmain.c moveloop() -> moveloop_core()
    async gameLoop() {
        while (!this.gameOver) {
            // Get player input
            // C ref: allmain.c moveloop_core() -- rhack(0) gets and processes command
            const ch = await nhgetch();
            this.display.clearRow(0); // clear message line

            // Process command
            const result = await processCommand(ch, this);

            // If time passed, process turn effects
            // C ref: allmain.c moveloop_core() -- context.move handling
            if (result.tookTime) {
                // Move monsters
                // C ref: allmain.c moveloop_core() -> movemon()
                moveMonsters(this.map, this.player, this.display, this.fov);

                // C ref: allmain.c — new turn setup (after both hero and monsters done)
                this.simulateTurnEnd();

                // Check for death
                if (this.player.isDead) {
                    this.gameOver = true;
                    this.gameOverReason = 'killed';
                }
            }

            // Recompute FOV
            this.fov.compute(this.map, this.player.x, this.player.y);

            // Render
            this.display.renderMap(this.map, this.player, this.fov);
            this.display.renderStatus(this.player);
        }

        // Game over
        await this.showGameOver();
    }

    // C ref: mon.c mcalcmove() — calculate monster's movement for a turn
    // Randomly rounds speed to a multiple of NORMAL_SPEED (12).
    // Returns the movement to ADD for this turn.
    mcalcmove(mon) {
        let mmove = mon.speed;
        // C ref: mon.c:1143-1146 — random rounding for non-standard speeds
        const mmoveAdj = mmove % NORMAL_SPEED;
        mmove -= mmoveAdj;
        if (rn2(NORMAL_SPEED) < mmoveAdj) {
            mmove += NORMAL_SPEED;
        }
        return mmove;
    }

    // C ref: allmain.c moveloop_core() — per-turn effects after monster movement
    // Called once per turn after movemon() is done.
    // Order matches C: mcalcmove → rn2(70) → dosounds → gethungry → engrave wipe → seer_turn
    simulateTurnEnd() {
        this.turnCount++;
        this.player.turns = this.turnCount;

        // C ref: allmain.c:221 mcalcdistress() — no RNG at startup (regen, shapeshift checks)

        // C ref: allmain.c:226-227 — reallocate movement to monsters via mcalcmove
        for (const mon of this.map.monsters) {
            if (mon.dead) continue;
            mon.movement += this.mcalcmove(mon);
        }

        // C ref: allmain.c:232-236 — occasionally spawn a new monster
        // rn2(70) on normal dungeon levels (rn2(25) if demigod, rn2(50) below stronghold)
        rn2(70);

        // C ref: allmain.c:241 — svm.moves++ (already done via this.turnCount++)

        // --- Once-per-turn effects ---

        // C ref: allmain.c:351 dosounds() — ambient sounds
        // sounds.c:213 — rn2(400) for fountain sound check
        rn2(400);

        // C ref: allmain.c:353 gethungry()
        // eat.c:3186 — rn2(20) for accessory hunger timing
        rn2(20);
        // Also decrement hunger counter for gameplay
        this.player.hunger--;
        if (this.player.hunger <= 0) {
            this.display.putstr_message('You faint from lack of food.');
            this.player.hunger = 1;
            this.player.hp -= rnd(3);
        }
        if (this.player.hunger === 150) {
            this.display.putstr_message('You are beginning to feel weak.');
        }
        if (this.player.hunger === 300) {
            this.display.putstr_message('You are beginning to feel hungry.');
        }

        // C ref: allmain.c:359 — engrave wipe check
        // rn2(40 + ACURR(A_DEX) * 3) — for Valkyrie with DEX ~14, this is rn2(82)
        const dex = this.player.attributes ? this.player.attributes[A_DEX] : 14;
        rn2(40 + dex * 3);

        // --- Once-per-hero-took-time effects ---

        // C ref: allmain.c:408-414 — seer_turn (clairvoyance timer)
        // Checked after hero took time; initially seer_turn=0 so fires on turn 1
        if (this.turnCount >= this.seerTurn) {
            // rn1(31, 15) = 15 + rn2(31), range 15..45
            this.seerTurn = this.turnCount + rn1(31, 15);
        }

        // C ref: allmain.c:289-293 regen_hp() — deterministic, no RNG
        // Simplified: hero regens 1 HP every 3 turns if below max
        if (this.player.hp < this.player.hpmax && this.turnCount % 3 === 0) {
            this.player.hp++;
        }
    }

    // Display game over screen
    // C ref: end.c done()
    async showGameOver() {
        let msg;
        switch (this.gameOverReason) {
            case 'killed':
                msg = `You died on dungeon level ${this.player.dungeonLevel}. Score: ${this.player.score}. Press any key.`;
                break;
            case 'quit':
                msg = `You quit on dungeon level ${this.player.dungeonLevel}. Score: ${this.player.score}. Press any key.`;
                break;
            case 'escaped':
                msg = `You escaped the dungeon! Score: ${this.player.score}. Press any key.`;
                break;
            default:
                msg = `Game over. Score: ${this.player.score}. Press any key.`;
        }
        this.display.putstr_message(msg);
        await nhgetch();

        // Offer to restart
        this.display.putstr_message('Play again? [yn] ');
        const ch = await nhgetch();
        if (String.fromCharCode(ch) === 'y') {
            // Reload page to restart
            window.location.reload();
        }
    }
}

// --- Entry Point ---
// Start the game when the page loads
window.addEventListener('DOMContentLoaded', async () => {
    const game = new NetHackGame();
    await game.init();
    await game.gameLoop();
});
