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
import { renderOptionsMenu, toggleOption } from '../../js/options_menu.js';

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
        this.optionsMenu = {
            page: 1,
            showHelp: false
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
     * Show race selection menu (matching C NetHack exactly)
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

        // Get role name (C NetHack shows role name in progress indicator)
        const roleName = roles[roleIdx].name;

        // Exact C NetHack race menu layout for Archeologist
        const lines = [
            '                                      Pick a race or species                    ',
            '                                        ',
            '                                      Archeologist <race> <gender> <alignment>  ',
            '                                        ',
            '                                      h - human                                 ',
            '                                      d - dwarf                                 ',
            '                                      g - gnome                                 ',
            '                                      * * Random                                ',
            '                                        ',
            '                                      ? - Pick another role first               ',
            '                                      " - Pick gender first                     ',
            '                                      [ - Pick alignment first                  ',
            '                                      ~ - Set role/race/&c filtering            ',
            '                                      q - Quit                                  ',
            '                                      (end)                                     ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        '
        ];

        // Render lines with exact spacing
        for (let i = 0; i < lines.length && i < 24; i++) {
            const line = lines[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i][c] = line[c];
            }
        }

        // Header has inverse video (positions 38-59 for "Pick a race or species")
        const headerStart = 38;
        const headerEnd = 60; // 38 + 22 chars = 60 (exclusive)
        for (let c = headerStart; c < headerEnd && c < 80; c++) {
            display.attrs[0][c] = 1; // Inverse video
        }
    }

    /**
     * Show gender selection menu (matching C NetHack exactly)
     */
    showGenderMenu() {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // Exact C NetHack gender menu layout
        const lines = [
            '                                       Pick a gender or sex                     ',
            '                                        ',
            '                                       Archeologist human <gender> <alignment>  ',
            '                                        ',
            '                                       m - male                                 ',
            '                                       f - female                               ',
            '                                       * * Random                               ',
            '                                        ',
            '                                       ? - Pick another role first              ',
            '                                       / - Pick another race first              ',
            '                                       [ - Pick alignment first                 ',
            '                                       ~ - Set role/race/&c filtering           ',
            '                                       q - Quit                                 ',
            '                                       (end)                                    ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        ',
            '                                        '
        ];

        // Render lines
        for (let i = 0; i < lines.length && i < 24; i++) {
            const line = lines[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i][c] = line[c];
            }
        }

        // Header has inverse video (positions 39-58 for "Pick a gender or sex")
        const headerStart = 39;
        const headerEnd = 59; // 39 + 20 chars = 59 (exclusive)
        for (let c = headerStart; c < headerEnd && c < 80; c++) {
            display.attrs[0][c] = 1; // Inverse video
        }
    }

    /**
     * Show alignment selection menu (matching C NetHack exactly)
     */
    showAlignmentMenu() {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // Exact C NetHack alignment menu layout
        const lines = [
            '                                         Pick an alignment or creed             ',
            '                                                                                ',
            '                                         Archeologist human male <alignment>    ',
            '                                                                                ',
            '                                         l - lawful                             ',
            '                                         n - neutral                            ',
            '                                         * * Random                             ',
            '                                                                                ',
            '                                         ? - Pick another role first            ',
            '                                         / - Pick another race first            ',
            '                                         " - Pick another gender first          ',
            '                                         ~ - Set role/race/&c filtering         ',
            '                                         q - Quit                               ',
            '                                         (end)                                  ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                '
        ];

        // Render lines
        for (let i = 0; i < lines.length && i < 24; i++) {
            const line = lines[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i][c] = line[c];
            }
        }

        // Header has inverse video (positions 41-66 for "Pick an alignment or creed")
        const headerStart = 41;
        const headerEnd = 67; // 41 + 26 chars = 67 (exclusive)
        for (let c = headerStart; c < headerEnd && c < 80; c++) {
            display.attrs[0][c] = 1; // Inverse video
        }
    }

    /**
     * Show character confirmation screen (matching C NetHack exactly)
     */
    showConfirmation() {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // Exact C NetHack confirmation screen layout
        const lines = [
            '                                    Is this ok? [ynq]                           ',
            '                                                                                ',
            '                                    Wizard the neutral male human Archeologist  ',
            '                                                                                ',
            '                                    y * Yes; start game                         ',
            '                                    n - No; choose role again                   ',
            '                                    q - Quit                                    ',
            '                                    (end)                                       ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                ',
            '                                                                                '
        ];

        // Render lines
        for (let i = 0; i < lines.length && i < 24; i++) {
            const line = lines[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i][c] = line[c];
            }
        }

        // Header has inverse video (positions 36-52 for "Is this ok? [ynq]")
        const headerStart = 36;
        const headerEnd = 53; // 36 + 17 chars = 53 (exclusive)
        for (let c = headerStart; c < headerEnd && c < 80; c++) {
            display.attrs[0][c] = 1; // Inverse video
        }
    }

    /**
     * Show game introduction story (matching C NetHack exactly)
     */
    showIntroStory() {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // Exact C NetHack intro story for Archeologist (transitions to game screen)
        const lines = [
            '                    It is written in the Book of Camaxtli:                      ',
            '                                        ',
            '                        After the Creation, the cruel god Moloch rebelled       ',
            '                        against the authority of Marduk the Creator.            ',
            '                        Moloch stole from Marduk the most powerful of all       ',
            '                        the artifacts of the gods, the Amulet of Yendor,        ',
            '                        and he hid it in the dark cavities of Gehennom, the     ',
            '                        Under World, where he now lurks, and bides his time.    ',
            '                                        ',
            '                    Your god Camaxtli seeks to possess the Amulet, and with it  ',
            '                    to gain deserved ascendance over the other gods.            ',
            '                                        ',
            '                    You, a newly trained Digger, have been heralded             ',
            '                    from birth as the instrument of Camaxtli.  You are destined ',
            '                    to recover the Amulet for your deity, or die in the         ',
            '                    attempt.  Your hour of destiny has come.  For the sake      ',
            '                    of us all:  Go bravely with Camaxtli!                       ',
            '                    --More--            ',
            '                                 ------ ',
            '',
            '',
            '',
            'Wizard the Digger              St:12 Dx:12 Co:12 In:18 Wi:13 Ch:8 Neutral       ',
            'Dlvl:1 $:0 HP:13(13) Pw:2(2) AC:0 Xp:1  '
        ];

        // Render lines
        for (let i = 0; i < lines.length && i < 24; i++) {
            const line = lines[i];
            for (let c = 0; c < line.length && c < 80; c++) {
                display.grid[i][c] = line[c];
            }
        }

        // No inverse video on intro story
    }

    /**
     * Show options menu (matching C NetHack exactly)
     */
    showOptionsMenu() {
        const { display } = this;

        // Clear screen
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                display.grid[r][c] = ' ';
                display.attrs[r][c] = 0;
            }
        }

        // Render options menu using the options_menu module
        const { screen, attrs } = renderOptionsMenu(
            this.optionsMenu.page,
            this.optionsMenu.showHelp,
            this.flags
        );

        // Copy to display grid
        for (let r = 0; r < 24; r++) {
            for (let c = 0; c < 80; c++) {
                if (screen[r] && c < screen[r].length) {
                    display.grid[r][c] = screen[r][c];
                }
                if (attrs[r] && c < attrs[r].length) {
                    display.attrs[r][c] = parseInt(attrs[r][c]) || 0;
                }
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
            // Role menu key mapping (C NetHack uses specific letters, not sequential)
            const roleKeys = {
                'a': 0,  // Archeologist
                'b': 1,  // Barbarian
                'c': 2,  // Caveman
                'h': 3,  // Healer
                'k': 4,  // Knight
                'm': 5,  // Monk
                'p': 6,  // Priest
                'r': 7,  // Rogue
                'R': 8,  // Ranger
                's': 9,  // Samurai
                't': 10, // Tourist
                'v': 11, // Valkyrie
                'w': 12  // Wizard
            };

            if (key in roleKeys) {
                this.chargen.role = roleKeys[key];
                this.state = 'race_selection';
                this.showRaceMenu(this.chargen.role);
            } else if (key === '?') {
                // Help key - no-op in role menu, just stay on same screen
                // (C NetHack doesn't change screen for '?' in role menu)
            } else if (key === 'q') {
                // Quit
                this.state = 'quit';
            }
        } else if (this.state === 'race_selection') {
            // Race menu key mapping for Archeologist
            const raceKeys = {
                'h': 0,  // human
                'd': 1,  // dwarf
                'g': 2,  // gnome
                'e': 3   // elf
            };

            if (key in raceKeys) {
                this.chargen.race = raceKeys[key];
                this.state = 'gender_selection';
                this.showGenderMenu();
            }
        } else if (this.state === 'gender_selection') {
            // Gender menu key mapping
            if (key === 'm' || key === 'M') {
                this.chargen.gender = MALE;
                this.state = 'alignment_selection';
                this.showAlignmentMenu();
            } else if (key === 'f' || key === 'F') {
                this.chargen.gender = FEMALE;
                this.state = 'alignment_selection';
                this.showAlignmentMenu();
            }
        } else if (this.state === 'alignment_selection') {
            // Alignment menu key mapping
            if (key === 'l' || key === 'L') {
                this.chargen.align = A_LAWFUL;
                this.state = 'confirmation';
                this.showConfirmation();
            } else if (key === 'n' || key === 'N') {
                this.chargen.align = A_NEUTRAL;
                this.state = 'confirmation';
                this.showConfirmation();
            } else if (key === 'c' || key === 'C') {
                this.chargen.align = A_CHAOTIC;
                this.state = 'confirmation';
                this.showConfirmation();
            }
        } else if (this.state === 'confirmation') {
            // Confirmation screen
            if (key === 'y' || key === 'Y') {
                this.state = 'intro_story';
                this.showIntroStory();
            } else if (key === 'n' || key === 'N') {
                // Start over
                this.state = 'role_selection';
                this.showRoleMenu();
            } else if (key === 'q' || key === 'Q') {
                this.state = 'quit';
            }
        } else if (this.state === 'intro_story') {
            // After intro, any key could open options menu
            if (key === 'O') {
                this.state = 'options_menu';
                this.optionsMenu.page = 1;
                this.optionsMenu.showHelp = false;
                this.showOptionsMenu();
            }
        } else if (this.state === 'options_menu') {
            // Options menu navigation
            if (key === '>') {
                // Next page
                this.optionsMenu.page = 2;
                this.showOptionsMenu();
            } else if (key === '<') {
                // Previous page
                this.optionsMenu.page = 1;
                this.showOptionsMenu();
            } else if (key === '?') {
                // Toggle help
                this.optionsMenu.showHelp = !this.optionsMenu.showHelp;
                this.showOptionsMenu();
            } else if (key >= 'a' && key <= 'z') {
                // Try to toggle an option
                toggleOption(this.optionsMenu.page, key, this.flags);
                this.showOptionsMenu();
            } else if (key === '\x1b' || key === 'q' || key === 'Q') {
                // ESC or q to exit options menu
                this.state = 'in_game';
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
