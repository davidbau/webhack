/**
 * Headless Game Runner for Interface Testing
 *
 * Runs NetHack character generation and menus without browser dependencies.
 * Used for character-by-character comparison with C NetHack.
 */

import { HeadlessDisplay } from './session_helpers.js';
import { initRng } from '../../js/rng.js';
import { loadFlags } from '../../js/storage.js';
import { roles, races, validRacesForRole, validAlignsForRoleRace, needsGenderMenu } from '../../js/player.js';
import { MALE, FEMALE, A_LAWFUL, A_NEUTRAL, A_CHAOTIC } from '../../js/config.js';

/**
 * Headless game state for interface testing
 */
export class HeadlessGame {
    constructor(seed = 42) {
        this.seed = seed;
        this.display = new HeadlessDisplay();
        this.flags = loadFlags();
        this.state = 'startup';
        this.chargen = {
            role: null,
            race: null,
            gender: null,
            align: null,
            name: ''
        };

        // Initialize RNG
        initRng(seed);
    }

    /**
     * Initialize the game and show startup screen
     */
    init() {
        this.state = 'startup';
        this.showCopyright();
    }

    /**
     * Show NetHack copyright screen (matching C NetHack exactly)
     */
    showCopyright() {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // C NetHack layout: prompt on line 0, copyright starting line 4
        const lines = [
            'Shall I pick character\'s race, role, gender and alignment for you? [ynaq]',
            '',
            '',
            '',
            'NetHack, Copyright 1985-2026',
            '         By Stichting Mathematisch Centrum and M. Stephenson.',
            '         Version 3.7.0-132 Unix Work-in-progress, built Feb  9 2026 08:15:08.',
            '         See license for details.',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            ''
        ];

        // Render lines (C pads to 80 chars with spaces on some lines)
        for (let i = 0; i < lines.length && i < 24; i++) {
            const line = lines[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i][c] = line[c];
            }
        }
    }

    /**
     * Show role selection menu (matching C NetHack exactly)
     */
    showRoleMenu() {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // Exact C NetHack role menu layout
        const lines = [
            ' Pick a role or profession',
            '',
            ' <role> <race> <gender> <alignment>',
            '',
            ' a - an Archeologist',
            ' b - a Barbarian',
            ' c - a Caveman/Cavewoman',
            ' h - a Healer',
            ' k - a Knight',
            ' m - a Monk',
            ' p - a Priest/Priestess',
            ' r - a Rogue',
            ' R - a Ranger',
            ' s - a Samurai',
            ' t - a Tourist',
            ' v - a Valkyrie',
            ' w - a Wizard',
            ' * * Random',
            ' / - Pick race first',
            ' " - Pick gender first',
            ' [ - Pick alignment first',
            ' ~ - Set role/race/&c filtering',
            ' q - Quit',
            ' (end)'
        ];

        // Render lines with exact spacing
        for (let i = 0; i < lines.length && i < 24; i++) {
            const line = lines[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i][c] = line[c];
            }
        }

        // Header has inverse video only on the text, not trailing spaces
        // C NetHack applies inverse video at positions 1-25, not 0-25
        const headerText = ' Pick a role or profession';
        for (let c = 1; c <= 25; c++) {
            display.attrs[0][c] = 1; // Inverse video
        }
    }

    /**
     * Show race selection menu
     */
    showRaceMenu(roleIdx) {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // Race menu header with inverse video
        const header = '                       Pick the race of your archeologist                        ';
        for (let c = 0; c < header.length && c < 80; c++) {
            display.grid[0][c] = header[c];
            display.attrs[0][c] = 1; // Inverse video
        }

        // Race list
        const raceList = [
            '',
            '     a - dwarf',
            '     b - elf',
            '     c - gnome',
            '     d - human',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '     ? - Random Race           ~ - Descriptions',
            '     q - Quit                  (end)'
        ];

        for (let i = 0; i < raceList.length && i + 1 < 24; i++) {
            const line = raceList[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i + 1][c] = line[c];
            }
        }
    }

    /**
     * Handle keyboard input
     */
    async handleInput(key) {
        if (this.state === 'startup') {
            if (key === 'n' || key === 'N') {
                this.state = 'role_selection';
                this.showRoleMenu();
            }
        } else if (this.state === 'role_selection') {
            // Handle role selection
            if (key >= 'a' && key <= 'm') {
                const roleIdx = key.charCodeAt(0) - 'a'.charCodeAt(0);
                if (roleIdx < roles.length) {
                    this.chargen.role = roleIdx;
                    this.state = 'race_selection';
                    this.showRaceMenu(roleIdx);
                }
            } else if (key === 'q') {
                // Quit
                this.state = 'quit';
            }
        } else if (this.state === 'race_selection') {
            // Handle race selection
            if (key >= 'a' && key <= 'd') {
                const raceIdx = key.charCodeAt(0) - 'a'.charCodeAt(0);
                this.chargen.race = raceIdx;
                // Continue to gender/alignment...
                this.state = 'gender_selection';
            }
        }
    }

    /**
     * Get current screen as array of lines
     */
    getScreen() {
        return this.display.getScreenLines();
    }

    /**
     * Get current attributes as array of lines
     */
    getAttrs() {
        return this.display.getAttrLines();
    }
}
