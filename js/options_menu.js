/**
 * NetHack Options Menu
 *
 * Interactive two-page options menu matching C NetHack 3.7 exactly.
 * Displays current option values and allows toggling.
 */

import { loadFlags, saveFlags } from './storage.js';

/**
 * Options menu data structure matching C NetHack
 * Each option has: name, key, type (bool/text/number), category, page
 */
export const OPTIONS_DATA = {
    // Page 1 - General & Behavior
    page1: [
        {
            category: 'General',
            options: [
                { key: 'a', name: 'fruit', type: 'text', flag: 'fruit', default: 'slime mold', help: 'name of a fruit you enjoy eating' },
                { key: 'b', name: 'number_pad', type: 'bool', flag: 'number_pad', help: 'use the number pad for movement' }
            ]
        },
        {
            category: 'Behavior',
            options: [
                { key: 'c', name: 'autodig', type: 'bool', flag: 'autodig', help: 'dig if moving towards stone' },
                { key: 'd', name: 'autoopen', type: 'bool', flag: 'autoopen', help: 'open doors if moving towards one' },
                { key: 'e', name: 'autopickup', type: 'bool', flag: 'pickup', help: 'automatically pick up items' },
                { key: 'f', name: 'autopickup exceptions', type: 'count', flag: 'autopickup_exceptions', help: 'exceptions to autopickup' },
                { key: 'g', name: 'autoquiver', type: 'bool', flag: 'autoquiver', help: 'automatically fill quiver' },
                { key: 'h', name: 'autounlock', type: 'text', flag: 'autounlock', default: 'apply-key', help: 'method for unlocking' },
                { key: 'i', name: 'cmdassist', type: 'bool', flag: 'cmdassist', help: 'provide assistance with commands' },
                { key: 'j', name: 'dropped_nopick', type: 'bool', flag: 'dropped_nopick', help: 'do not autopickup dropped items', suffix: '(for autopickup)' },
                { key: 'k', name: 'fireassist', type: 'bool', flag: 'fireassist', help: 'provide assistance with firing' },
                { key: 'l', name: 'pickup_stolen', type: 'bool', flag: 'pickup_stolen', help: 'autopickup stolen items', suffix: '(for autopickup)' },
                { key: 'm', name: 'pickup_thrown', type: 'bool', flag: 'pickup_thrown', help: 'autopickup thrown items', suffix: '(for autopickup)' },
                { key: 'n', name: 'pickup_types', type: 'text', flag: 'pickup_types', default: 'all', help: 'types to autopickup', suffix: '(for autopickup)' },
                { key: 'o', name: 'pushweapon', type: 'bool', flag: 'pushweapon', help: 'push old weapon into second slot' }
            ]
        }
    ],

    // Page 2 - Map & Status
    page2: [
        {
            category: 'Map',
            options: [
                { key: 'a', name: 'bgcolors', type: 'bool', flag: 'bgcolors', help: 'use background colors' },
                { key: 'b', name: 'color', type: 'bool', flag: 'color', help: 'use color for display' },
                { key: 'c', name: 'customcolors', type: 'bool', flag: 'customcolors', help: 'use custom colors' },
                { key: 'd', name: 'customsymbols', type: 'bool', flag: 'customsymbols', help: 'use custom symbols' },
                { key: 'e', name: 'hilite_pet', type: 'bool', flag: 'hilite_pet', help: 'highlight pets' },
                { key: 'f', name: 'hilite_pile', type: 'bool', flag: 'hilite_pile', help: 'highlight piles of objects' },
                { key: 'g', name: 'showrace', type: 'bool', flag: 'showrace', help: 'show race in status' },
                { key: 'h', name: 'sparkle', type: 'bool', flag: 'sparkle', help: 'sparkle effect for resists' },
                { key: 'i', name: 'symset', type: 'text', flag: 'symset', default: 'default', help: 'symbol set to use' }
            ]
        },
        {
            category: 'Status',
            options: [
                { key: 'j', name: 'hitpointbar', type: 'bool', flag: 'hitpointbar', help: 'show hitpoint bar' },
                { key: 'k', name: 'menu colors', type: 'count', flag: 'menucolors', help: 'menu color rules' },
                { key: 'l', name: 'showexp', type: 'bool', flag: 'showexp', help: 'show experience points' },
                { key: 'm', name: 'status condition fields', type: 'count', flag: 'statusconditions', count: 16, help: 'status condition fields' },
                { key: 'n', name: 'status highlight rules', type: 'count', flag: 'statushighlights', help: 'status highlight rules' },
                { key: 'o', name: 'statuslines', type: 'number', flag: 'statuslines', default: 2, help: 'number of status lines' },
                { key: 'p', name: 'time', type: 'bool', flag: 'time', help: 'show elapsed time' }
            ]
        }
    ]
};

/**
 * Render options menu to a 24x80 grid
 * @param {number} page - Page number (1 or 2)
 * @param {boolean} showHelp - Whether to show help text
 * @param {object} flags - Current flag values from storage
 * @returns {object} - {screen: string[], attrs: string[]}
 */
export function renderOptionsMenu(page, showHelp, flags) {
    const screen = Array(24).fill('').map(() => ' '.repeat(80));
    const attrs = Array(24).fill('').map(() => '0'.repeat(80));

    let row = 0;

    // Header (exactly 20 chars with padding)
    screen[row] = ' Options            ' + ' '.repeat(60);
    row += 1;

    // Blank line (exactly 20 chars)
    screen[row] = ' '.repeat(20) + ' '.repeat(60);
    row += 1;

    // Help text
    if (showHelp) {
        screen[row] = ' Use command \'#optionsfull\' to get the complete options list.                   ';
        row += 1;
        screen[row] = ' ? - hide help      ' + ' '.repeat(60);
    } else {
        screen[row] = ' ? - show help      ' + ' '.repeat(60);
    }
    row += 1;

    // Get page data
    const pageData = page === 1 ? OPTIONS_DATA.page1 : OPTIONS_DATA.page2;

    // Render each category
    for (const category of pageData) {
        // Blank line before category (exactly 20 chars)
        screen[row] = ' '.repeat(20) + ' '.repeat(60);
        row += 1;

        // Category header (indented with 2 spaces, total 40 chars)
        const catHeader = '  ' + category.category;
        screen[row] = catHeader.padEnd(40, ' ') + ' '.repeat(40);
        row += 1;

        // Render options
        for (const opt of category.options) {
            if (row >= 23) break; // Save room for footer

            // Format: " a - option_name              [value]        "
            // Key and name part
            let line = ' ' + opt.key + ' - ' + opt.name;

            // Pad to exactly column 28 for value alignment
            line = line.padEnd(28, ' ');

            // Get value
            const value = getOptionValue(opt, flags);
            line += '[' + value + ']';

            // Pad after value - C NetHack has specific padding
            if (opt.suffix) {
                // Pad to column 45 before suffix
                line = line.padEnd(45, ' ');
                line += opt.suffix;
            }

            // Pad to exactly 80
            line = line.padEnd(80, ' ');
            screen[row] = line;
            row += 1;

            // Show help text if enabled
            if (showHelp && opt.help) {
                const helpLine = '     ' + opt.help;
                screen[row] = helpLine + ' '.repeat(80 - helpLine.length);
                row += 1;

                // Blank line after help
                if (row < 23) {
                    screen[row] = ' '.repeat(80);
                    row += 1;
                }
            }
        }
    }

    // Footer - page indicator
    const footer = ' (' + page + ' of 2)           ';
    screen[23] = footer + ' '.repeat(80 - footer.length);

    return { screen, attrs };
}

/**
 * Get display value for an option
 */
function getOptionValue(opt, flags) {
    const flagValue = flags[opt.flag];

    switch (opt.type) {
        case 'bool':
            // [X] or [ ]
            // Special case: number_pad shows "0=off" or "1=on" instead of X/
            if (opt.name === 'number_pad') {
                return flagValue ? '1=on' : '0=off';
            }
            return flagValue ? 'X' : ' ';

        case 'text':
            // [value]
            return flagValue || opt.default || '';

        case 'number':
            // [N]
            const num = flagValue !== undefined ? flagValue : opt.default;
            return String(num);

        case 'count':
            // [(N currently set)]
            const count = opt.count !== undefined ? opt.count : (flagValue || 0);
            return '(' + count + ' currently set)';

        default:
            return '';
    }
}

/**
 * Toggle an option value
 */
export function toggleOption(page, key, flags) {
    const pageData = page === 1 ? OPTIONS_DATA.page1 : OPTIONS_DATA.page2;

    // Find the option
    for (const category of pageData) {
        const opt = category.options.find(o => o.key === key);
        if (opt) {
            if (opt.type === 'bool') {
                // Toggle boolean
                flags[opt.flag] = !flags[opt.flag];
                saveFlags(flags);
                return true;
            }
            // For text/number types, would need input dialog (not implemented yet)
            return false;
        }
    }
    return false;
}
