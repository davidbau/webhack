// nethack.js -- Main entry point and game loop
// Mirrors allmain.c from the C source.
// This is the heart of the JS port: the game initialization and main loop.

import { COLNO, ROWNO, ROOM, STAIRS, NORMAL_SPEED, ACCESSIBLE, isok, A_DEX, A_CON,
         A_LAWFUL, A_NEUTRAL, A_CHAOTIC,
         RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC,
         FEMALE, MALE, TERMINAL_COLS } from './config.js';
import { initRng, rn2, rnd, rn1, getRngState, setRngState, getRngCallCount, setRngCallCount } from './rng.js';
import { Display } from './display.js';
import { initInput, nhgetch } from './input.js';
import { FOV } from './vision.js';
import { Player, roles, races, validRacesForRole, validAlignsForRoleRace,
         needsGenderMenu, rankOf, godForRoleAlign, isGoddess, greetingForRole,
         roleNameForGender, alignName, formatLoreText } from './player.js';
import { GameMap } from './map.js';
import { initLevelGeneration, makelevel, wallification, setGameSeed } from './dungeon.js';
import { rhack } from './commands.js';
import { movemon, settrack } from './monmove.js';
import { simulatePostLevelInit } from './u_init.js';
import { loadSave, deleteSave, hasSave, saveGame,
         loadFlags, deserializeRng,
         restGameState, restLev,
         listSavedData, clearAllData } from './storage.js';
import { savebones } from './bones.js';
import { buildEntry, saveScore, loadScores, formatTopTenEntry, formatTopTenHeader } from './topten.js';

// Parse URL parameters for game options
// Supports: ?wizard=1, ?seed=N, ?role=X
function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        wizard: params.get('wizard') === '1' || params.get('wizard') === 'true',
        seed: params.has('seed') ? parseInt(params.get('seed'), 10) : null,
        role: params.get('role') || null,
        reset: params.get('reset') === '1' || params.get('reset') === 'true',
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
        this.occupation = null; // C ref: cmd.c go.occupation — multi-turn action
        this.seed = 0;        // original game seed (for save/restore)
        // RNG accessors for storage.js (avoids circular imports)
        this._rngAccessors = {
            getRngState, setRngState, getRngCallCount, setRngCallCount,
        };
        // C ref: role.c rfilter — chargen filtering state
        // true = filtered out (unacceptable)
        this.rfilter = {
            roles: new Array(roles.length).fill(false),
            races: new Array(races.length).fill(false),
            genders: new Array(2).fill(false),  // [MALE, FEMALE]
            aligns: new Array(3).fill(false),   // indexed by align+1: [chaotic, neutral, lawful]
        };
    }

    // Initialize a new game
    // C ref: allmain.c early_init() + moveloop_preamble()
    async init() {
        // Parse URL params
        const urlOpts = parseUrlParams();
        this.wizard = urlOpts.wizard;

        // Initialize display
        this.display = new Display('game');

        // Initialize input
        initInput();

        // Handle ?reset=1 — prompt to delete all saved data
        if (urlOpts.reset) {
            await this.handleReset();
        }

        // Load user flags (C ref: flags struct from flag.h)
        this.flags = loadFlags();

        // Check for saved game before RNG init
        const saveData = loadSave();
        if (saveData) {
            const restored = await this.restoreFromSave(saveData, urlOpts);
            if (restored) return;
            // User declined restore -- delete save (NetHack tradition)
            deleteSave();
        }

        // Initialize RNG with seed from URL or random
        const seed = urlOpts.seed !== null
            ? urlOpts.seed
            : Math.floor(Math.random() * 0xFFFFFFFF);
        this.seed = seed;
        initRng(seed);
        setGameSeed(seed);

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
            this.player.race = RACE_HUMAN;
            this.player.gender = FEMALE;
            this.player.alignment = A_NEUTRAL;
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
            const initResult = simulatePostLevelInit(this.player, this.map, 1);
            this.seerTurn = initResult.seerTurn;
        }

        // Apply flags
        this.player.showExp = this.flags.showexp;

        // Initial display
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov);
        this.display.renderStatus(this.player);
    }

    // Restore game state from a save.
    // Returns true if restored, false if user declined.
    async restoreFromSave(saveData, urlOpts) {
        this.display.putstr_message('Saved game found. Restore? [yn]');
        const ans = await nhgetch();
        if (String.fromCharCode(ans) !== 'y') {
            this.display.putstr_message('Save deleted.');
            return false;
        }

        // Restore game state (player, inventory, equip, context)
        // C ref: dorecover() → restgamestate()
        const gs = saveData.gameState;

        // Replay o_init: init RNG with saved seed, run initLevelGeneration
        this.seed = gs.seed;
        initRng(gs.seed);
        setGameSeed(gs.seed);
        initLevelGeneration();

        // Now overwrite RNG state with the saved state
        const restoredCtx = deserializeRng(gs.rng);
        setRngState(restoredCtx);
        setRngCallCount(gs.rngCallCount);

        // Restore game state: player + inventory + equip + context
        const restored = restGameState(gs);
        this.player = restored.player;
        this.wizard = restored.wizard;
        this.turnCount = restored.turnCount;
        this.seerTurn = restored.seerTurn;

        // Restore current level (saved first in v2 format)
        // C ref: dorecover() → getlev() for current level
        const currentDepth = saveData.currentDepth;
        this.levels = {};
        if (saveData.currentLevel) {
            this.levels[currentDepth] = restLev(saveData.currentLevel);
        }

        // Restore other cached levels
        // C ref: dorecover() → getlev() loop for other levels
        for (const [depth, levelData] of Object.entries(saveData.otherLevels || {})) {
            this.levels[Number(depth)] = restLev(levelData);
        }

        // Set current level
        this.player.dungeonLevel = currentDepth;
        this.map = this.levels[currentDepth];

        // Restore messages
        if (restored.messages.length > 0) {
            this.display.messages = restored.messages;
        }

        // Delete save (single-save semantics)
        deleteSave();

        // Load flags (C ref: flags struct)
        this.flags = restored.flags || loadFlags();
        this.player.showExp = this.flags.showexp;

        // Render
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.display.renderMap(this.map, this.player, this.fov);
        this.display.renderStatus(this.player);
        this.display.putstr_message('Game restored.');
        return true;
    }

    // Player role selection -- faithful C chargen flow
    // C ref: role.c player_selection() -- choose role, race, gender, alignment
    async playerSelection() {
        // Phase 1: "Shall I pick character's race, role, gender and alignment for you?"
        this.display.putstr_message(
            "Shall I pick character's race, role, gender and alignment for you? [ynaq]"
        );
        const pickCh = await nhgetch();
        const pickC = String.fromCharCode(pickCh);

        if (pickC === 'q') {
            window.location.reload();
            return;
        }

        if (pickC === 'y' || pickC === 'a') {
            // Auto-pick all attributes randomly
            await this._autoPickAll(pickC === 'y');
            return;
        }

        // 'n' or anything else → manual selection
        await this._manualSelection();
    }

    // Auto-pick all chargen attributes randomly
    // C ref: role.c plnamesiz auto-pick path
    async _autoPickAll(showConfirm) {
        // Pick role
        let roleIdx = rn2(roles.length);
        // Pick race
        const vr = validRacesForRole(roleIdx);
        let raceIdx = vr[rn2(vr.length)];
        // Pick gender
        let gender;
        if (roles[roleIdx].forceGender === 'female') {
            gender = FEMALE;
            rn2(1); // C consumes rn2(1) for forced gender
        } else {
            gender = rn2(2); // 0=male, 1=female
        }
        // Pick alignment
        const va = validAlignsForRoleRace(roleIdx, raceIdx);
        let align = va[rn2(va.length)];

        this.player.roleIndex = roleIdx;
        this.player.race = raceIdx;
        this.player.gender = gender;
        this.player.alignment = align;

        if (showConfirm) {
            // Show confirmation screen
            const confirmed = await this._showConfirmation(roleIdx, raceIdx, gender, align);
            if (!confirmed) {
                // 'n' → restart from manual selection
                await this._manualSelection();
                return;
            }
        }

        // Apply the selection
        this.player.initRole(roleIdx);
        this.player.alignment = align;

        // Show lore and welcome
        await this._showLoreAndWelcome(roleIdx, raceIdx, gender, align);
    }

    // C ref: role.c ok_role/ok_race/ok_gend/ok_align — filter checks
    _okRole(i) { return !this.rfilter.roles[i]; }
    _okRace(i) { return !this.rfilter.races[i]; }
    _okGend(g) { return !this.rfilter.genders[g]; }
    _okAlign(a) { return !this.rfilter.aligns[a + 1]; } // a: -1,0,1 → index 0,1,2
    _hasFilters() {
        return this.rfilter.roles.some(Boolean) || this.rfilter.races.some(Boolean) ||
               this.rfilter.genders.some(Boolean) || this.rfilter.aligns.some(Boolean);
    }
    _filterLabel() {
        return this._hasFilters() ? 'Reset role/race/&c filtering' : 'Set role/race/&c filtering';
    }

    // Show the ~ filter menu (PICK_ANY multi-select)
    // C ref: role.c reset_role_filtering() — four sections with toggle selection
    async _showFilterMenu() {
        const lines = [];
        const prompt = this._hasFilters()
            ? 'Pick all that apply and/or unpick any that no longer apply'
            : 'Pick all that apply';
        lines.push(prompt);
        lines.push('');

        // Build item list: letter → { type, index, selected }
        const items = [];

        // Section 1: Unacceptable roles
        lines.push('Unacceptable roles');
        for (let i = 0; i < roles.length; i++) {
            const ch = roles[i].menuChar;
            const sel = this.rfilter.roles[i];
            const article = roles[i].menuArticle || 'a';
            const nameDisplay = roles[i].namef
                ? `${roles[i].name}/${roles[i].namef}`
                : roles[i].name;
            lines.push(` ${ch} ${sel ? '+' : '-'} ${article} ${nameDisplay}`);
            items.push({ ch, type: 'roles', index: i, selected: sel });
        }

        // Section 2: Unacceptable races (uppercase to avoid conflict with role letters)
        // C ref: setup_racemenu uses highc(this_ch) in filter mode
        lines.push('Unacceptable races');
        for (let i = 0; i < races.length; i++) {
            const ch = races[i].menuChar.toUpperCase();
            const sel = this.rfilter.races[i];
            lines.push(` ${ch} ${sel ? '+' : '-'} ${races[i].name}`);
            items.push({ ch, type: 'races', index: i, selected: sel });
        }

        // Section 3: Unacceptable genders (uppercase)
        // C ref: setup_gendmenu uses highc(this_ch) in filter mode
        lines.push('Unacceptable genders');
        const genderChars = ['M', 'F'];
        const genderNames = ['male', 'female'];
        for (let i = 0; i < 2; i++) {
            const ch = genderChars[i];
            const sel = this.rfilter.genders[i];
            lines.push(` ${ch} ${sel ? '+' : '-'} ${genderNames[i]}`);
            items.push({ ch, type: 'genders', index: i, selected: sel });
        }

        // Section 4: Unacceptable alignments (uppercase)
        // C ref: setup_algnmenu uses highc(this_ch) in filter mode
        lines.push('Unacceptable alignments');
        const alignChars = ['L', 'N', 'C'];
        const alignNames = ['lawful', 'neutral', 'chaotic'];
        const alignIndices = [2, 1, 0]; // A_LAWFUL=1→idx2, A_NEUTRAL=0→idx1, A_CHAOTIC=-1→idx0
        for (let i = 0; i < 3; i++) {
            const ch = alignChars[i];
            const sel = this.rfilter.aligns[alignIndices[i]];
            lines.push(` ${ch} ${sel ? '+' : '-'} ${alignNames[i]}`);
            items.push({ ch, type: 'aligns', index: alignIndices[i], selected: sel });
        }

        lines.push('(end)');

        // Build a lookup from char to item indices (some chars are reused across sections)
        // In C, each item has a unique accelerator; we use the same scheme
        const charToItems = {};
        for (let i = 0; i < items.length; i++) {
            if (!charToItems[items[i].ch]) charToItems[items[i].ch] = [];
            charToItems[items[i].ch].push(i);
        }

        // Render and handle input loop
        // PICK_ANY: user toggles items, Enter/Esc to finish
        this.display.renderChargenMenu(lines, true);

        while (true) {
            const ch = await nhgetch();
            const c = String.fromCharCode(ch);

            if (c === '\r' || c === '\n' || c === ' ') {
                // Confirm: apply current selections
                for (const item of items) {
                    this.rfilter[item.type][item.index] = item.selected;
                }
                return;
            }

            if (ch === 27) { // ESC
                // Cancel: no changes
                return;
            }

            // Toggle items matching this character
            if (charToItems[c]) {
                for (const idx of charToItems[c]) {
                    items[idx].selected = !items[idx].selected;
                }
                // Re-render the menu with updated selections
                const updatedLines = [];
                updatedLines.push(lines[0]); // prompt
                updatedLines.push('');
                let itemIdx = 0;

                updatedLines.push('Unacceptable roles');
                for (let i = 0; i < roles.length; i++) {
                    const item = items[itemIdx++];
                    const article = roles[i].menuArticle || 'a';
                    const nameDisplay = roles[i].namef
                        ? `${roles[i].name}/${roles[i].namef}`
                        : roles[i].name;
                    updatedLines.push(` ${item.ch} ${item.selected ? '+' : '-'} ${article} ${nameDisplay}`);
                }

                updatedLines.push('Unacceptable races');
                for (let i = 0; i < races.length; i++) {
                    const item = items[itemIdx++];
                    updatedLines.push(` ${item.ch} ${item.selected ? '+' : '-'} ${races[i].name}`);
                }

                updatedLines.push('Unacceptable genders');
                for (let g = 0; g < 2; g++) {
                    const item = items[itemIdx++];
                    updatedLines.push(` ${item.ch} ${item.selected ? '+' : '-'} ${genderNames[g]}`);
                }

                updatedLines.push('Unacceptable alignments');
                for (let ai = 0; ai < 3; ai++) {
                    const item = items[itemIdx++];
                    updatedLines.push(` ${item.ch} ${item.selected ? '+' : '-'} ${alignNames[ai]}`);
                }

                updatedLines.push('(end)');
                this.display.renderChargenMenu(updatedLines, true);
            }
        }
    }

    // Manual selection loop: role → race → gender → alignment
    // C ref: role.c player_selection() manual path
    async _manualSelection() {
        let roleIdx = -1;
        let raceIdx = -1;
        let gender = -1;
        let align = -128; // A_NONE
        let isFirstMenu = true;

        // Selection loop
        selectionLoop:
        while (true) {
            // Determine what we still need to pick
            // C order: role → race → gender → alignment
            // But navigation keys can jump to any step

            // --- ROLE ---
            if (roleIdx < 0) {
                const result = await this._showRoleMenu(raceIdx, gender, align, isFirstMenu);
                isFirstMenu = false;
                if (result.action === 'quit') { window.location.reload(); return; }
                if (result.action === 'pick-race') { raceIdx = -1; roleIdx = -1; continue; }
                if (result.action === 'pick-gender') { gender = -1; roleIdx = -1; continue; }
                if (result.action === 'pick-align') { align = -128; roleIdx = -1; continue; }
                if (result.action === 'filter') { await this._showFilterMenu(); isFirstMenu = true; continue; }
                if (result.action === 'selected') {
                    roleIdx = result.value;
                    // Force gender if needed
                    if (roles[roleIdx].forceGender === 'female') {
                        gender = FEMALE;
                        rn2(1); // C consumes rn2(1) for forced gender
                    }
                }
            }

            // --- RACE ---
            if (roleIdx >= 0 && raceIdx < 0) {
                const validRaces = validRacesForRole(roleIdx).filter(ri => this._okRace(ri));
                // Filter down to valid races given current constraints
                if (validRaces.length === 1) {
                    raceIdx = validRaces[0];
                    // Will show as forced in next menu
                } else {
                    const result = await this._showRaceMenu(roleIdx, gender, align, isFirstMenu);
                    isFirstMenu = false;
                    if (result.action === 'quit') { window.location.reload(); return; }
                    if (result.action === 'pick-role') { roleIdx = -1; raceIdx = -1; gender = -1; align = -128; continue; }
                    if (result.action === 'pick-gender') { gender = -1; continue; }
                    if (result.action === 'pick-align') { align = -128; continue; }
                    if (result.action === 'filter') { await this._showFilterMenu(); roleIdx = -1; raceIdx = -1; gender = -1; align = -128; isFirstMenu = true; continue; }
                    if (result.action === 'selected') {
                        raceIdx = result.value;
                    }
                }
            }

            // --- GENDER ---
            if (roleIdx >= 0 && raceIdx >= 0 && gender < 0) {
                if (!needsGenderMenu(roleIdx)) {
                    gender = roles[roleIdx].forceGender === 'female' ? FEMALE : MALE;
                } else {
                    const result = await this._showGenderMenu(roleIdx, raceIdx, align, isFirstMenu);
                    isFirstMenu = false;
                    if (result.action === 'quit') { window.location.reload(); return; }
                    if (result.action === 'pick-role') { roleIdx = -1; raceIdx = -1; gender = -1; align = -128; continue; }
                    if (result.action === 'pick-race') { raceIdx = -1; gender = -1; continue; }
                    if (result.action === 'pick-align') { align = -128; continue; }
                    if (result.action === 'filter') { await this._showFilterMenu(); roleIdx = -1; raceIdx = -1; gender = -1; align = -128; isFirstMenu = true; continue; }
                    if (result.action === 'selected') {
                        gender = result.value;
                    }
                }
            }

            // --- ALIGNMENT ---
            if (roleIdx >= 0 && raceIdx >= 0 && gender >= 0 && align === -128) {
                const validAligns = validAlignsForRoleRace(roleIdx, raceIdx).filter(a => this._okAlign(a));
                if (validAligns.length === 1) {
                    align = validAligns[0];
                } else {
                    const result = await this._showAlignMenu(roleIdx, raceIdx, gender, isFirstMenu);
                    isFirstMenu = false;
                    if (result.action === 'quit') { window.location.reload(); return; }
                    if (result.action === 'pick-role') { roleIdx = -1; raceIdx = -1; gender = -1; align = -128; continue; }
                    if (result.action === 'pick-race') { raceIdx = -1; align = -128; continue; }
                    if (result.action === 'pick-gender') { gender = -1; align = -128; continue; }
                    if (result.action === 'filter') { await this._showFilterMenu(); roleIdx = -1; raceIdx = -1; gender = -1; align = -128; isFirstMenu = true; continue; }
                    if (result.action === 'selected') {
                        align = result.value;
                    }
                }
            }

            // --- CONFIRMATION ---
            if (roleIdx >= 0 && raceIdx >= 0 && gender >= 0 && align !== -128) {
                const confirmed = await this._showConfirmation(roleIdx, raceIdx, gender, align);
                if (confirmed) {
                    // Apply selection
                    this.player.roleIndex = roleIdx;
                    this.player.race = raceIdx;
                    this.player.gender = gender;
                    this.player.alignment = align;
                    this.player.initRole(roleIdx);
                    this.player.alignment = align;
                    // Show lore and welcome
                    await this._showLoreAndWelcome(roleIdx, raceIdx, gender, align);
                    return;
                } else {
                    // Start over
                    roleIdx = -1;
                    raceIdx = -1;
                    gender = -1;
                    align = -128;
                    isFirstMenu = true;
                    continue;
                }
            }
        }
    }

    // Build the header line showing current selections
    // C ref: role.c plnamesiz — "<role> <race> <gender> <alignment>"
    _buildHeaderLine(roleIdx, raceIdx, gender, align) {
        const parts = [];
        // Role
        if (roleIdx >= 0) {
            const female = gender === FEMALE;
            parts.push(roleNameForGender(roleIdx, female));
        } else {
            parts.push('<role>');
        }
        // Race
        if (raceIdx >= 0) {
            parts.push(races[raceIdx].name);
        } else {
            parts.push('<race>');
        }
        // Gender
        if (gender === FEMALE) {
            parts.push('female');
        } else if (gender === MALE) {
            parts.push('male');
        } else {
            parts.push('<gender>');
        }
        // Alignment
        if (align !== -128) {
            parts.push(alignName(align));
        } else {
            parts.push('<alignment>');
        }
        return parts.join(' ');
    }

    // Show role menu and wait for selection
    async _showRoleMenu(raceIdx, gender, align, isFirstMenu) {
        const lines = [];
        lines.push(' Pick a role or profession');
        lines.push('');
        lines.push(' ' + this._buildHeaderLine(-1, raceIdx, gender, align));
        lines.push('');

        // Role items
        const roleLetters = {};
        for (let i = 0; i < roles.length; i++) {
            const role = roles[i];
            // Filter by ~ filtering
            if (!this._okRole(i)) continue;
            // Filter by race constraint if race is already picked
            if (raceIdx >= 0 && !role.validRaces.includes(raceIdx)) continue;
            // Filter by alignment constraint if alignment is already picked
            if (align !== -128 && !role.validAligns.includes(align)) continue;

            const ch = role.menuChar;
            const article = role.menuArticle || 'a';
            const nameDisplay = role.namef
                ? `${role.name}/${role.namef}`
                : role.name;
            lines.push(` ${ch} - ${article} ${nameDisplay}`);
            roleLetters[ch] = i;
        }

        // Extra items
        lines.push(' * * Random');
        lines.push(' / - Pick race first');
        lines.push(' " - Pick gender first');
        lines.push(' [ - Pick alignment first');
        lines.push(` ~ - ${this._filterLabel()}`);
        lines.push(' q - Quit');
        lines.push(' (end)');

        this.display.renderChargenMenu(lines, isFirstMenu);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        if (c === 'q') return { action: 'quit' };
        if (c === '/') return { action: 'pick-race' };
        if (c === '"') return { action: 'pick-gender' };
        if (c === '[') return { action: 'pick-align' };
        if (c === '~') return { action: 'filter' };
        if (c === '*') {
            // Random role from valid ones
            const validKeys = Object.keys(roleLetters);
            const pick = validKeys[rn2(validKeys.length)];
            return { action: 'selected', value: roleLetters[pick] };
        }
        if (roleLetters[c] !== undefined) {
            return { action: 'selected', value: roleLetters[c] };
        }
        // Invalid key: re-show
        return { action: 'selected', value: -1 };
    }

    // Show race menu and wait for selection
    async _showRaceMenu(roleIdx, gender, align, isFirstMenu) {
        const role = roles[roleIdx];
        const validRaces = validRacesForRole(roleIdx);

        // Check if alignment is forced across all valid races for this role
        // If so, show the forced alignment in the header
        const allAligns = new Set();
        for (const ri of validRaces) {
            for (const a of validAlignsForRoleRace(roleIdx, ri)) {
                allAligns.add(a);
            }
        }
        const alignForHeader = allAligns.size === 1 ? [...allAligns][0] : align;

        const lines = [];
        lines.push('Pick a race or species');
        lines.push('');
        lines.push(this._buildHeaderLine(roleIdx, -1, gender, alignForHeader));
        lines.push('');

        const raceLetters = {};
        for (const ri of validRaces) {
            const race = races[ri];
            // Filter by ~ filtering
            if (!this._okRace(ri)) continue;
            // Filter by alignment constraint if already set
            if (align !== -128) {
                const vAligns = validAlignsForRoleRace(roleIdx, ri);
                if (!vAligns.includes(align)) continue;
            }
            lines.push(`${race.menuChar} - ${race.name}`);
            raceLetters[race.menuChar] = ri;
        }
        lines.push('* * Random');

        // Navigation — C ref: wintty.c menu navigation items
        // Order: ?, ", constraint notes, [, ~, q, (end)
        lines.push('');
        lines.push('? - Pick another role first');

        // Only show gender nav if gender not forced
        if (gender < 0 && needsGenderMenu(roleIdx)) {
            lines.push('" - Pick gender first');
        }

        // Constraint notes
        if (role.forceGender === 'female') {
            lines.push('    role forces female');
        }
        if (allAligns.size === 1) {
            lines.push('    role forces ' + alignName([...allAligns][0]));
        }

        // Alignment navigation if not forced
        if (align === -128 && allAligns.size > 1) {
            lines.push('[ - Pick alignment first');
        }

        lines.push(`~ - ${this._filterLabel()}`);
        lines.push('q - Quit');
        lines.push('(end)');

        this.display.renderChargenMenu(lines, isFirstMenu);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        if (c === 'q') return { action: 'quit' };
        if (c === '?') return { action: 'pick-role' };
        if (c === '/') return { action: 'pick-race' };
        if (c === '"') return { action: 'pick-gender' };
        if (c === '[') return { action: 'pick-align' };
        if (c === '~') return { action: 'filter' };
        if (c === '*') {
            const validKeys = Object.keys(raceLetters);
            const pick = validKeys[rn2(validKeys.length)];
            return { action: 'selected', value: raceLetters[pick] };
        }
        if (raceLetters[c] !== undefined) {
            return { action: 'selected', value: raceLetters[c] };
        }
        return { action: 'selected', value: -1 };
    }

    // Show gender menu
    async _showGenderMenu(roleIdx, raceIdx, align, isFirstMenu) {
        const role = roles[roleIdx];
        const validAligns = validAlignsForRoleRace(roleIdx, raceIdx);
        const lines = [];
        lines.push('Pick a gender or sex');
        lines.push('');

        // Build header with current alignment if forced
        const alignDisplay = validAligns.length === 1 ? validAligns[0] : -128;
        lines.push(this._buildHeaderLine(roleIdx, raceIdx, -1, alignDisplay));
        lines.push('');

        const genderOptions = [];
        if (this._okGend(MALE)) { lines.push('m - male'); genderOptions.push(MALE); }
        if (this._okGend(FEMALE)) { lines.push('f - female'); genderOptions.push(FEMALE); }
        lines.push('* * Random');

        // Navigation — C ref: wintty.c menu navigation items
        // Order: ?, /, constraint notes, [, ~, q, (end)
        lines.push('');
        lines.push('? - Pick another role first');

        // Only show "/" if there are multiple valid races for this role
        const validRaces = validRacesForRole(roleIdx);
        if (validRaces.length > 1) {
            lines.push('/ - Pick another race first');
        }

        // Constraint notes (after ? and / nav items)
        if (validRaces.length === 1) {
            lines.push('    role forces ' + races[validRaces[0]].name);
        }
        if (validAligns.length === 1) {
            // C ref: "role forces" if role has only one alignment, "race forces" if race restricts it
            const forcer = role.validAligns.length === 1 ? 'role' : 'race';
            lines.push(`    ${forcer} forces ` + alignName(validAligns[0]));
        }

        // Alignment nav if multiple options
        if (align === -128 && validAligns.length > 1) {
            lines.push('[ - Pick alignment first');
        }

        lines.push(`~ - ${this._filterLabel()}`);
        lines.push('q - Quit');
        lines.push('(end)');

        this.display.renderChargenMenu(lines, isFirstMenu);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        if (c === 'q') return { action: 'quit' };
        if (c === '?') return { action: 'pick-role' };
        if (c === '/') return { action: 'pick-race' };
        if (c === '"') return { action: 'pick-gender' };
        if (c === '[') return { action: 'pick-align' };
        if (c === '~') return { action: 'filter' };
        if (c === 'm' && this._okGend(MALE)) return { action: 'selected', value: MALE };
        if (c === 'f' && this._okGend(FEMALE)) return { action: 'selected', value: FEMALE };
        if (c === '*') {
            if (genderOptions.length > 0) return { action: 'selected', value: genderOptions[rn2(genderOptions.length)] };
            return { action: 'selected', value: rn2(2) };
        }
        return { action: 'selected', value: -1 };
    }

    // Show alignment menu
    async _showAlignMenu(roleIdx, raceIdx, gender, isFirstMenu) {
        const validAligns = validAlignsForRoleRace(roleIdx, raceIdx);
        const lines = [];
        lines.push('Pick an alignment or creed');
        lines.push('');
        lines.push(this._buildHeaderLine(roleIdx, raceIdx, gender, -128));
        lines.push('');

        const alignLetters = {};
        const alignChars = { [A_LAWFUL]: 'l', [A_NEUTRAL]: 'n', [A_CHAOTIC]: 'c' };
        for (const a of validAligns) {
            // Filter by ~ filtering
            if (!this._okAlign(a)) continue;
            const ch = alignChars[a];
            lines.push(`${ch} - ${alignName(a)}`);
            alignLetters[ch] = a;
        }
        lines.push('* * Random');

        // Navigation — C ref: wintty.c menu navigation items
        // Order: ?, /, constraint notes, ", ~, q, (end)
        lines.push('');
        lines.push('? - Pick another role first');

        // Only show "/" if there are multiple valid races for this role
        const role = roles[roleIdx];
        const validRacesForAlign = validRacesForRole(roleIdx);
        if (validRacesForAlign.length > 1) {
            lines.push('/ - Pick another race first');
        }

        // Constraint notes (after ? and / nav items)
        if (validRacesForAlign.length === 1) {
            lines.push('    role forces ' + races[validRacesForAlign[0]].name);
        }
        if (role.forceGender === 'female') {
            lines.push('    role forces female');
        }

        // Gender nav if gender is not forced
        if (needsGenderMenu(roleIdx)) {
            lines.push('" - Pick another gender first');
        }

        lines.push(`~ - ${this._filterLabel()}`);
        lines.push('q - Quit');
        lines.push('(end)');

        this.display.renderChargenMenu(lines, isFirstMenu);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        if (c === 'q') return { action: 'quit' };
        if (c === '?') return { action: 'pick-role' };
        if (c === '/') return { action: 'pick-race' };
        if (c === '"') return { action: 'pick-gender' };
        if (c === '~') return { action: 'filter' };
        if (c === '*') {
            const pick = validAligns[rn2(validAligns.length)];
            return { action: 'selected', value: pick };
        }
        if (alignLetters[c] !== undefined) {
            return { action: 'selected', value: alignLetters[c] };
        }
        return { action: 'selected', value: -128 };
    }

    // Show confirmation screen
    // Returns true if confirmed, false if user wants to restart
    async _showConfirmation(roleIdx, raceIdx, gender, align) {
        const female = gender === FEMALE;
        const rName = roleNameForGender(roleIdx, female);
        const raceName = races[raceIdx].adj;
        const genderStr = female ? 'female' : 'male';
        const alignStr = alignName(align);
        const confirmText = `${this.player.name.toLowerCase()} the ${alignStr} ${genderStr} ${raceName} ${rName}`;

        const lines = [];
        lines.push('Is this ok? [ynq]');
        lines.push('');
        lines.push(confirmText);
        lines.push('');
        lines.push('y * Yes; start game');
        lines.push('n - No; choose role again');
        lines.push('q - Quit');
        lines.push('(end)');

        this.display.renderChargenMenu(lines, false);
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        if (c === 'q') { window.location.reload(); return false; }
        return c === 'y';
    }

    // Show lore text and welcome message
    async _showLoreAndWelcome(roleIdx, raceIdx, gender, align) {
        const female = gender === FEMALE;

        // Get deity name for the alignment
        let deityName = godForRoleAlign(roleIdx, align);
        let goddess = isGoddess(roleIdx, align);

        // Priest special case: gods are null, pick from random role's pantheon
        // C ref: role.c role_init() — if Priest has no gods, pick random role's gods
        // This must consume the same RNG as C
        if (!deityName) {
            // Find a role that has gods via rn2
            let donorRole;
            do {
                donorRole = rn2(roles.length);
            } while (!roles[donorRole].gods[0]);
            // Use donor role's gods
            deityName = godForRoleAlign(donorRole, align);
            goddess = isGoddess(donorRole, align);
            // Store the donor pantheon on the role temporarily
            // so lore text references are correct
        }

        const godOrGoddess = goddess ? 'goddess' : 'god';
        const rankTitle = rankOf(1, roleIdx, female);
        const loreText = formatLoreText(deityName, godOrGoddess, rankTitle);
        const loreLines = loreText.split('\n');

        // Calculate offset for lore text display
        // C ref: The lore text is displayed with an offset that allows the map to show through
        let maxLoreWidth = 0;
        for (const line of loreLines) {
            if (line.length > maxLoreWidth) maxLoreWidth = line.length;
        }
        const loreOffx = Math.max(0, TERMINAL_COLS - maxLoreWidth - 1);

        // Add --More-- at the end
        loreLines.push('--More--');

        // Render lore text overlaid on screen
        this.display.renderLoreText(loreLines, loreOffx);

        // Wait for key to dismiss lore
        await nhgetch();

        // Clear the lore text area
        for (let r = 0; r < loreLines.length && r < this.display.rows - 2; r++) {
            for (let c = loreOffx; c < this.display.cols; c++) {
                this.display.setCell(c, r, ' ', 7);
            }
        }

        // Welcome message
        // C ref: allmain.c welcome() — "<greeting> <name>, welcome to NetHack!  You are a <align> <gender?> <race> <role>."
        const greeting = greetingForRole(roleIdx);
        const rName = roleNameForGender(roleIdx, female);
        const raceAdj = races[raceIdx].adj;
        const alignStr = alignName(align);

        // C only shows gender in welcome when role has gendered variants or forced gender
        // For Priestess/Cavewoman: gender is implicit in the role name, so it's omitted
        // For Valkyrie: forceGender is set, so gender word is omitted
        // For others: include gender if the role name doesn't change and gender isn't forced
        let genderStr = '';
        if (roles[roleIdx].namef || roles[roleIdx].forceGender) {
            // Gender implicit in role name or forced — omit gender word
        } else {
            genderStr = female ? 'female ' : 'male ';
        }

        const welcomeMsg = `${greeting} ${this.player.name.toLowerCase()}, welcome to NetHack!  You are a ${alignStr} ${genderStr}${raceAdj} ${rName}.`;
        this.display.putstr_message(welcomeMsg);

        // Show --More-- after welcome
        // Need to determine where the message ended (may have wrapped to 2 lines)
        const moreStr = '--More--';
        let moreRow = 0;
        let moreCol;

        if (welcomeMsg.length <= this.display.cols) {
            // Message fits on one line
            if (welcomeMsg.length + 8 >= this.display.cols) {
                // --More-- won't fit on same line, wrap to next line
                moreRow = 1;
                moreCol = 0;
            } else {
                // --More-- fits on same line with space
                moreRow = 0;
                moreCol = welcomeMsg.length + 1;
            }
        } else {
            // Message wrapped to two lines
            // Find where the first line broke (last space before cols)
            let breakPoint = welcomeMsg.lastIndexOf(' ', this.display.cols);
            if (breakPoint === -1) breakPoint = this.display.cols;

            const wrapped = welcomeMsg.substring(breakPoint).trim();
            if (wrapped.length + 8 >= this.display.cols) {
                // --More-- won't fit after wrapped text, use row 2
                moreRow = 2;
                moreCol = 0;
            } else {
                // --More-- fits after wrapped text on row 1
                moreRow = 1;
                moreCol = wrapped.length + 1;
            }
        }

        this.display.putstr(moreCol, moreRow, moreStr, 2); // CLR_GREEN
        await nhgetch();
        this.display.clearRow(0);
        if (moreRow > 0) this.display.clearRow(1);
        if (moreRow > 1) this.display.clearRow(2);
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
            this.map = makelevel(depth);
            wallification(this.map);
            this.levels[depth] = this.map;
        }

        this.player.dungeonLevel = depth;
        this.placePlayerOnLevel();

        // Bones level message
        if (this.map.isBones) {
            this.display.putstr_message('You get an eerie feeling...');
        }

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

    // Handle ?reset=1 — list saved data and prompt for deletion
    async handleReset() {
        const items = listSavedData();
        if (items.length === 0) {
            this.display.putstr_message('No saved data found.');
            await nhgetch();
        } else {
            this.display.putstr_message('Saved data found:');
            // Show each item on rows 2+
            for (let i = 0; i < items.length && i < 18; i++) {
                this.display.putstr(2, 2 + i, `- ${items[i].label}`, 7);
            }
            this.display.putstr(0, 2 + Math.min(items.length, 18),
                'Delete all saved data? [yn]', 15);
            const ch = await nhgetch();
            if (String.fromCharCode(ch) === 'y') {
                clearAllData();
                this.display.putstr_message('All saved data deleted.');
            } else {
                this.display.putstr_message('Cancelled.');
            }
            // Clear the listing rows
            for (let i = 0; i < 20; i++) {
                this.display.clearRow(2 + i);
            }
        }
        // Remove ?reset from URL and reload clean
        const url = new URL(window.location.href);
        url.searchParams.delete('reset');
        window.history.replaceState({}, '', url.toString());
    }

    // Main game loop
    // C ref: allmain.c moveloop() -> moveloop_core()
    async gameLoop() {
        while (!this.gameOver) {
            // C ref: allmain.c moveloop_core() — occupation check before input
            if (this.occupation) {
                const cont = this.occupation.fn(this);
                if (!cont) {
                    this.occupation = null;
                }
                // Occupation turn takes time: run full turn effects
                settrack(this.player);
                movemon(this.map, this.player, this.display, this.fov);
                this.simulateTurnEnd();
                if (this.player.isDead) {
                    this.gameOver = true;
                    this.gameOverReason = 'killed';
                    savebones(this);
                }
                this.fov.compute(this.map, this.player.x, this.player.y);
                this.display.renderMap(this.map, this.player, this.fov);
                this.display.renderStatus(this.player);
                continue;
            }

            // Get player input
            // C ref: allmain.c moveloop_core() -- rhack(0) gets and processes command
            const ch = await nhgetch();
            this.display.clearRow(0); // clear message line

            // Process command
            const result = await rhack(ch, this);

            // If time passed, process turn effects
            // C ref: allmain.c moveloop_core() -- context.move handling
            if (result.tookTime) {
                // C ref: allmain.c moveloop_core() -> settrack() before movemon
                settrack(this.player);

                // Move monsters
                // C ref: allmain.c moveloop_core() -> movemon()
                movemon(this.map, this.player, this.display, this.fov);

                // C ref: allmain.c — new turn setup (after both hero and monsters done)
                this.simulateTurnEnd();

                // Check for death
                if (this.player.isDead) {
                    if (!this.player.deathCause) {
                        this.player.deathCause = 'died';
                    }
                    this.gameOver = true;
                    this.gameOverReason = 'killed';
                    savebones(this);
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

        // C ref: allmain.c:289-295 regen_hp()
        // heal = (u.ulevel + ACURR(A_CON)) > rn2(100); only when hp < max
        if (this.player.hp < this.player.hpmax) {
            const con = this.player.attributes ? this.player.attributes[A_CON] : 10;
            const heal = (this.player.level + con) > rn2(100) ? 1 : 0;
            if (heal) {
                this.player.hp = Math.min(this.player.hp + heal, this.player.hpmax);
            }
        }

        // C ref: allmain.c:351 dosounds() — ambient sounds
        // sounds.c:202-339 — chain of feature-dependent checks with short-circuit &&
        this.dosounds();

        // C ref: allmain.c:353 gethungry()
        // eat.c:3186 — rn2(20) for accessory hunger timing
        rn2(20);
        // Also decrement hunger counter for gameplay
        this.player.hunger--;
        if (this.player.hunger <= 0) {
            this.display.putstr_message('You faint from lack of food.');
            this.player.hunger = 1;
            this.player.hp -= rnd(3);
            if (this.player.hp <= 0) {
                this.player.deathCause = 'starvation';
            }
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

        // Note: regen_hp() with rn2(100) is now handled above (before dosounds)
    }

    // C ref: sounds.c:202-339 dosounds() — ambient level sounds
    // Each feature check uses short-circuit && so rn2() is only called
    // when the feature exists. Fountains/sinks don't return early;
    // all others return on a triggered sound.
    dosounds() {
        const f = this.map.flags;
        if (f.nfountains && !rn2(400)) { rn2(3); }  // fountain msg
        if (f.nsinks && !rn2(300)) { rn2(2); }       // sink msg
        if (f.has_court && !rn2(200)) { return; }     // throne sound
        if (f.has_swamp && !rn2(200)) { rn2(2); return; }
        if (f.has_vault && !rn2(200)) { rn2(2); return; }
        if (f.has_beehive && !rn2(200)) { return; }
        if (f.has_morgue && !rn2(200)) { return; }
        if (f.has_barracks && !rn2(200)) { rn2(3); return; }
        if (f.has_zoo && !rn2(200)) { return; }
        if (f.has_shop && !rn2(200)) { rn2(2); return; }
        if (f.has_temple && !rn2(200)) { return; }
    }

    // Display game over screen
    // C ref: end.c done() -> topten() -> outrip()
    async showGameOver() {
        // Delete save file — game is over
        deleteSave();

        const p = this.player;
        const deathCause = p.deathCause || this.gameOverReason || 'died';

        // Calculate final score (simplified C formula from end.c)
        // C ref: end.c done_in_by(), calc_score()
        // Base score is accumulated from exp + kills during play
        // Add gold
        p.score += p.gold;
        // Add 50 per dungeon level below 1
        if (p.dungeonLevel > 1) {
            p.score += (p.dungeonLevel - 1) * 50;
        }
        // Depth bonus for deep levels
        if (p.maxDungeonLevel > 20) {
            p.score += (p.maxDungeonLevel - 20) * 1000;
        }
        // Escaped bonus
        if (this.gameOverReason === 'escaped') {
            p.score += p.gold; // double gold for escaping
        }

        // Word-wrap death description for tombstone (max ~16 chars per line)
        const deathLines = this.wrapDeathText(deathCause, 16);

        // Show tombstone if flags.tombstone is enabled
        if (this.flags && this.flags.tombstone) {
            const year = String(new Date().getFullYear());
            this.display.renderTombstone(p.name, p.gold, deathLines, year);
            // Press any key prompt below tombstone
            this.display.putstr(0, 20, '(Press any key)', 7);
            await nhgetch();
        }

        // Build and save topten entry
        const entry = buildEntry(p, this.gameOverReason, roles, races);
        const rank = saveScore(entry);

        // Display topten list
        const scores = loadScores();
        this.display.clearScreen();

        const header = formatTopTenHeader();
        let row = 0;
        this.display.putstr(0, row++, header, 14); // CLR_WHITE

        // Show entries around the player's rank
        // Find the player's entry index in scores (0-based)
        const playerIdx = rank > 0 ? rank - 1 : 0;
        const showStart = Math.max(0, playerIdx - 5);
        const showEnd = Math.min(scores.length, playerIdx + 6);

        if (showStart > 0) {
            this.display.putstr(0, row++, '  ...', 7);
        }

        for (let i = showStart; i < showEnd; i++) {
            const lines = formatTopTenEntry(scores[i], i + 1);
            const isPlayer = (i === playerIdx);
            const color = isPlayer ? 10 : 7; // CLR_YELLOW : CLR_GRAY
            for (const line of lines) {
                if (row < this.display.rows - 2) {
                    this.display.putstr(0, row++, line.substring(0, this.display.cols), color);
                }
            }
        }

        if (showEnd < scores.length) {
            this.display.putstr(0, row++, '  ...', 7);
        }

        // Farewell message
        row = Math.min(row + 1, this.display.rows - 3);
        const female = p.gender === FEMALE;
        const roleName = roleNameForGender(p.roleIndex, female);
        const farewell = `Goodbye ${p.name} the ${roleName}...`;
        this.display.putstr(0, row++, farewell, 14);

        // Play again prompt
        row = Math.min(row + 1, this.display.rows - 1);
        this.display.putstr(0, row, 'Play again? [yn] ', 14);
        const ch = await nhgetch();
        if (String.fromCharCode(ch) === 'y') {
            window.location.reload();
        }
    }

    // Word-wrap a death description to fit within maxWidth chars per line.
    // Returns array of up to 4 lines.
    wrapDeathText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let current = '';
        for (const word of words) {
            if (current.length === 0) {
                current = word;
            } else if (current.length + 1 + word.length <= maxWidth) {
                current += ' ' + word;
            } else {
                lines.push(current);
                current = word;
            }
        }
        if (current) lines.push(current);
        // Limit to 4 lines
        return lines.slice(0, 4);
    }
}

// --- Entry Point ---
// Start the game when the page loads
window.addEventListener('DOMContentLoaded', async () => {
    const game = new NetHackGame();
    await game.init();
    await game.gameLoop();
});
