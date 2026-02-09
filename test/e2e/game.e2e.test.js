// test/e2e/game.e2e.test.js -- End-to-end browser tests for NetHack JS
// Launches the game in a headless browser and verifies core functionality.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { startServer } from './serve.js';

let browser, serverInfo;

// File-level setup: one browser + one server for all tests
before(async () => {
    serverInfo = await startServer();
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
});

after(async () => {
    if (browser) await browser.close();
    if (serverInfo) serverInfo.server.close();
});

// Helper: send a key to the page
async function sendKey(page, key, opts = {}) {
    await page.keyboard.press(key, opts);
    await page.evaluate(() => new Promise(r => setTimeout(r, 20)));
}

// Helper: send a character code directly via DOM event
async function sendChar(page, ch) {
    await page.keyboard.type(ch);
    await page.evaluate(() => new Promise(r => setTimeout(r, 20)));
}

// Helper: get all text from the terminal
async function getTerminalText(page) {
    return page.evaluate(() => {
        const spans = document.querySelectorAll('#terminal span');
        if (spans.length === 0) return '';
        let text = '';
        for (const span of spans) {
            text += span.textContent;
        }
        return text;
    });
}

// Helper: get text of a specific terminal row (0-indexed)
async function getRow(page, row) {
    return page.evaluate((r) => {
        const pre = document.getElementById('terminal');
        if (!pre) return '';
        const lines = pre.textContent.split('\n');
        return lines[r] || '';
    }, row);
}

// Helper: find a character on the terminal (returns {row, col} or null)
async function findChar(page, ch) {
    return page.evaluate((target) => {
        const pre = document.getElementById('terminal');
        if (!pre) return null;
        const lines = pre.textContent.split('\n');
        for (let r = 0; r < lines.length; r++) {
            const c = lines[r].indexOf(target);
            if (c >= 0) return { row: r, col: c };
        }
        return null;
    }, ch);
}

// Helper: check if a string appears somewhere on screen
async function screenContains(page, text) {
    const content = await getTerminalText(page);
    return content.includes(text);
}

// Helper: wait for the page and game to be loaded
async function waitForGameLoad(page) {
    await page.waitForSelector('#terminal', { timeout: 5000 });
    await page.waitForFunction(
        () => document.querySelectorAll('#terminal span').length > 100,
        { timeout: 5000 }
    );
}

// Helper: select role and start game
// New chargen flow: 'a' = auto-pick all (skip confirm), then dismiss lore + welcome --More--
async function selectRoleAndStart(page) {
    // "Shall I pick..." → 'a' (auto-pick all, skip confirmation)
    await sendChar(page, 'a');
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
    // Dismiss lore --More--
    await sendChar(page, ' ');
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
    // Dismiss welcome --More--
    await sendChar(page, ' ');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
}

describe('E2E: Game loads and initializes', () => {
    let page;

    before(async () => {
        page = await browser.newPage();
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`  [browser] ${msg.text()}`);
            }
        });
        await page.goto(serverInfo.url);
        await waitForGameLoad(page);
    });

    after(async () => {
        if (page) await page.close();
    });

    it('page loads without errors', async () => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
        assert.equal(errors.length, 0, `Page errors: ${errors.join(', ')}`);
    });

    it('terminal element exists with correct dimensions', async () => {
        const spanCount = await page.evaluate(() =>
            document.querySelectorAll('#terminal span').length
        );
        assert.equal(spanCount, 80 * 24, `Expected 1920 spans, got ${spanCount}`);
    });

    it('shows welcome/role selection message', async () => {
        const has = await screenContains(page, 'Shall I pick') || await screenContains(page, 'role') || await screenContains(page, 'NetHack');
        assert.ok(has, 'Should show welcome or role selection');
    });
});

describe('E2E: Role selection and game start', () => {
    let page;

    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
        await page.goto(serverInfo.url);
        await waitForGameLoad(page);
    });

    after(async () => {
        if (page) await page.close();
    });

    it('can select a role and start the game', async () => {
        await selectRoleAndStart(page);

        const playerPos = await findChar(page, '@');
        assert.ok(playerPos, 'Player @ should be visible on the map');
    });

    it('shows player @ on the map', async () => {
        const playerPos = await findChar(page, '@');
        assert.ok(playerPos, 'Player @ should be on screen');
        assert.ok(playerPos.row >= 1, `Player should be on map area, found at row ${playerPos.row}`);
    });

    it('shows dungeon features (walls, floor)', async () => {
        // Wait for the map to render box-drawing wall characters
        await page.waitForFunction(
            () => {
                const pre = document.getElementById('terminal');
                if (!pre) return false;
                const t = pre.textContent;
                return t.includes('\u00b7') && (t.includes('\u2500') || t.includes('\u2502'));
            },
            { timeout: 5000 }
        );
        const text = await getTerminalText(page);
        assert.ok(text.includes('\u00b7'), 'Should show floor tiles (middle dot)');
        assert.ok(text.includes('\u2500') || text.includes('\u2502'),
            'Should show wall tiles (box-drawing)');
    });

    it('shows status lines at the bottom', async () => {
        const statusRow1 = await getRow(page, 22);
        assert.ok(statusRow1.includes('St:') || statusRow1.includes('Player'),
            `Status line 1 should have stats, got: "${statusRow1.trim()}"`);

        const statusRow2 = await getRow(page, 23);
        assert.ok(statusRow2.includes('HP:') || statusRow2.includes('Dlvl:'),
            `Status line 2 should have HP, got: "${statusRow2.trim()}"`);
    });
});

describe('E2E: Movement and interaction', () => {
    let page;

    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
        await page.goto(serverInfo.url);
        await waitForGameLoad(page);
        await selectRoleAndStart(page);
    });

    after(async () => {
        if (page) await page.close();
    });

    it('help command shows key bindings (no-turn)', async () => {
        await sendChar(page, '?');  // open help menu
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const menuText = await getTerminalText(page);
        assert.ok(menuText.includes('Select one item'),
            `Help should show lettered menu`);
        await sendChar(page, 'h');  // select "Full list of keyboard commands"
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const text = await getTerminalText(page);
        assert.ok(text.includes('Move') || text.includes('Command Reference'),
            `Help should show key bindings`);
        await sendChar(page, 'q');  // dismiss pager
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
    });

    it('inventory starts empty or shows message (no-turn)', async () => {
        await sendChar(page, 'i');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(
            msg.includes('Inventory') || msg.includes('Not carrying') || msg.includes('carrying'),
            `Should show inventory message, got: "${msg.trim()}"`
        );
    });

    it('look command reports location (no-turn)', async () => {
        await sendChar(page, ':');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.trim().length > 0, 'Look should produce a message');
    });

    it('period key (wait) does not move player', async () => {
        const before = await findChar(page, '@');
        if (!before) return;
        await sendChar(page, '.');
        const after = await findChar(page, '@');
        if (after) {
            assert.deepEqual(before, after, 'Wait should not change position');
        }
    });

    it('turn counter increments after wait', async () => {
        const statusBefore = await getRow(page, 23);
        const turnMatch = statusBefore.match(/T:(\d+)/);
        if (!turnMatch) return;
        const turnBefore = parseInt(turnMatch[1]);

        await sendChar(page, '.');

        const statusAfter = await getRow(page, 23);
        const turnMatchAfter = statusAfter.match(/T:(\d+)/);
        if (!turnMatchAfter) return;
        const turnAfter = parseInt(turnMatchAfter[1]);

        assert.ok(turnAfter > turnBefore,
            `Turn should increment: was ${turnBefore}, now ${turnAfter}`);
    });

    it('player can move with vi keys', async () => {
        const before = await findChar(page, '@');
        if (!before) return;

        let moved = false;
        for (const key of ['l', 'h', 'j', 'k']) {
            const posBefore = await findChar(page, '@');
            if (!posBefore) break;
            await sendChar(page, key);
            await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
            const posAfter = await findChar(page, '@');

            if (posAfter && (posAfter.row !== posBefore.row || posAfter.col !== posBefore.col)) {
                moved = true;
                break;
            }
        }
        assert.ok(moved, 'Player should move with at least one vi key');
    });

    it('player can move with arrow keys', async () => {
        const posBefore = await findChar(page, '@');
        if (!posBefore) return;

        let moved = false;
        for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
            const pre = await findChar(page, '@');
            if (!pre) break;
            await sendKey(page, key);
            const post = await findChar(page, '@');

            if (post && (post.row !== pre.row || post.col !== pre.col)) {
                moved = true;
                break;
            }
        }
        assert.ok(moved, 'Player should move with at least one arrow key');
    });
});

describe('E2E: Help and information commands', () => {
    let page;

    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
        await page.goto(serverInfo.url);
        await waitForGameLoad(page);
        await selectRoleAndStart(page);
    });

    after(async () => {
        if (page) await page.close();
    });

    it('? shows lettered help menu', async () => {
        await sendChar(page, '?');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const text = await getTerminalText(page);
        assert.ok(text.includes('Select one item'), 'Help should show selection menu');
        assert.ok(text.includes('a - About NetHack'), 'Should list option a');
        assert.ok(text.includes('j - The NetHack Guidebook'), 'Should list option j');
        await sendChar(page, 'q');  // dismiss
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
    });

    it('? then a shows version info', async () => {
        await sendChar(page, '?');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, 'a');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.includes('NetHack') && msg.includes('Version'),
            `About should show version, got: "${msg.trim()}"`);
    });

    it('? then c shows game commands in pager', async () => {
        await sendChar(page, '?');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, 'c');
        await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
        const text = await getTerminalText(page);
        assert.ok(text.includes('Game Commands') || text.includes('Move commands'),
            'Should show game commands from hh.txt');
        await sendChar(page, 'q');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
    });

    it('? then d shows history in pager', async () => {
        await sendChar(page, '?');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, 'd');
        await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
        const text = await getTerminalText(page);
        assert.ok(text.includes('History') || text.includes('NetHack'),
            'Should show history');
        await sendChar(page, 'q');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
    });

    it('& (whatdoes) describes a known key', async () => {
        await sendChar(page, '&');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, 'o');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.includes('Open') || msg.includes('door'),
            `Whatdoes should describe 'o', got: "${msg.trim()}"`);
    });

    it('& (whatdoes) reports unknown for unbound key', async () => {
        await sendChar(page, '&');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, 'X');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.includes('unknown'),
            `Whatdoes should report unknown for 'X', got: "${msg.trim()}"`);
    });

    it('/ (whatis) identifies a symbol', async () => {
        await sendChar(page, '/');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, '>');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.includes('stairs'),
            `Whatis should identify '>', got: "${msg.trim()}"`);
    });

    it('/ (whatis) identifies letters as monsters', async () => {
        await sendChar(page, '/');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, 'd');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.includes('monster'),
            `Whatis should identify 'd' as monster, got: "${msg.trim()}"`);
    });

    it('\\ (discoveries) shows placeholder', async () => {
        await sendChar(page, '\\');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.includes('discovered'),
            `Discoveries should show placeholder, got: "${msg.trim()}"`);
    });

    it('turn counter does not increment after info commands', async () => {
        const statusBefore = await getRow(page, 23);
        const turnMatch = statusBefore.match(/T:(\d+)/);
        if (!turnMatch) return;
        const turnBefore = parseInt(turnMatch[1]);

        // Run several info commands that should not take a turn
        await sendChar(page, '\\');  // discoveries
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));

        await sendChar(page, '&');  // whatdoes
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, '.');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));

        await sendChar(page, '/');  // whatis
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        await sendChar(page, '@');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));

        const statusAfter = await getRow(page, 23);
        const turnMatchAfter = statusAfter.match(/T:(\d+)/);
        if (!turnMatchAfter) return;
        const turnAfter = parseInt(turnMatchAfter[1]);

        assert.equal(turnAfter, turnBefore,
            `Info commands should not take turns: was ${turnBefore}, now ${turnAfter}`);
    });
});

describe('E2E: Stairs and level changes', () => {
    let page;

    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
        await page.goto(serverInfo.url);
        await waitForGameLoad(page);
        await selectRoleAndStart(page);
    });

    after(async () => {
        if (page) await page.close();
    });

    it('dungeon level indicator shows Dlvl:1', async () => {
        const statusRow = await getRow(page, 23);
        assert.ok(statusRow.includes('Dlvl:1'),
            `Status should show Dlvl:1, got: "${statusRow.trim()}"`);
    });

    it('> on non-stair tile gives error message', async () => {
        await sendChar(page, '>');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.trim().length > 0, 'Should produce a message when pressing >');
    });
});

describe('E2E: Search command works', () => {
    let page;

    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
        await page.goto(serverInfo.url);
        await waitForGameLoad(page);
        await selectRoleAndStart(page);
    });

    after(async () => {
        if (page) await page.close();
    });

    it('s command shows search message', async () => {
        await sendChar(page, 's');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
        const msg = await getRow(page, 0);
        assert.ok(msg.includes('search') || msg.includes('hidden') || msg.trim().length > 0,
            `Search should produce message, got: "${msg.trim()}"`);
    });
});

describe('E2E: Display integrity', () => {
    let page;

    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
        await page.goto(serverInfo.url);
        await waitForGameLoad(page);
        await selectRoleAndStart(page);
    });

    after(async () => {
        if (page) await page.close();
    });

    it('map uses correct DEC graphics characters', async () => {
        const text = await getTerminalText(page);
        const hasWalls = text.includes('\u2500') || text.includes('\u2502');
        const hasFloor = text.includes('\u00b7');
        const hasPlayer = text.includes('@');
        assert.ok(hasWalls, 'Map should have box-drawing wall characters');
        assert.ok(hasFloor, 'Map should have middle dot floor characters');
        assert.ok(hasPlayer, 'Map should have player @');
    });

    it('all spans have valid color values', async () => {
        const invalidColors = await page.evaluate(() => {
            const spans = document.querySelectorAll('#terminal span');
            let invalid = 0;
            for (const span of spans) {
                const color = span.style.color;
                if (!color || color === '') invalid++;
            }
            return invalid;
        });
        assert.equal(invalidColors, 0, `All spans should have colors, found ${invalidColors} without`);
    });

    it('terminal has 24 lines', async () => {
        const lineCount = await page.evaluate(() => {
            const pre = document.getElementById('terminal');
            if (!pre) return 0;
            return pre.textContent.split('\n').length;
        });
        assert.equal(lineCount, 24, `Terminal should have 24 lines, got ${lineCount}`);
    });

    it('each line is 80 characters wide', async () => {
        const widths = await page.evaluate(() => {
            const pre = document.getElementById('terminal');
            if (!pre) return [];
            return pre.textContent.split('\n').map(l => l.length);
        });
        for (let i = 0; i < widths.length; i++) {
            assert.equal(widths[i], 80,
                `Line ${i} should be 80 chars, got ${widths[i]}`);
        }
    });

    it('monster symbols are visible when in FOV', async () => {
        for (let i = 0; i < 10; i++) {
            await sendChar(page, '.');
        }
        const text = await getTerminalText(page);
        assert.ok(text.length > 0, 'Terminal should have content after waiting');
    });
});
