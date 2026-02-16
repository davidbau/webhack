import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderOptionsMenu } from '../../js/options_menu.js';
import { DEFAULT_FLAGS } from '../../js/storage.js';

function findNumberPadLine(flags) {
    const { screen } = renderOptionsMenu(1, false, { ...DEFAULT_FLAGS, ...flags });
    return screen.find((line) => line.includes('number_pad')) || '';
}

describe('options menu number_pad mode rendering', () => {
    it('shows 0=off for mode 0', () => {
        const line = findNumberPadLine({ number_pad: 0 });
        assert.match(line, /\[0=off\]/);
    });

    it('shows 1=on for mode 1/true', () => {
        const lineBool = findNumberPadLine({ number_pad: true });
        const lineOne = findNumberPadLine({ number_pad: 1 });
        assert.match(lineBool, /\[1=on\]/);
        assert.match(lineOne, /\[1=on\]/);
    });

    it('shows mode-specific C-style labels for 2, 3, 4, -1', () => {
        assert.match(findNumberPadLine({ number_pad: 2 }), /\[2=on, MSDOS compatible\]/);
        assert.match(findNumberPadLine({ number_pad: 3 }), /\[3=on, phone-style digit layout\]/);
        assert.match(findNumberPadLine({ number_pad: 4 }), /\[4=on, phone-style layout, MSDOS compatible\]/);
        assert.match(findNumberPadLine({ number_pad: -1 }), /\[-1=off, 'z' to move upper-left, 'y' to zap wands\]/);
    });
});
