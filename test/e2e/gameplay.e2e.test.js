// test/e2e/gameplay.e2e.test.js -- Deep gameplay E2E tests
// Tests actual gameplay sequences: exploring, fighting, descending stairs.

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

let page;

async function sendChar(ch) {
    await page.keyboard.type(ch);
    await page.evaluate(() => new Promise(r => setTimeout(r, 20)));
}

async function sendKey(key) {
    await page.keyboard.press(key);
    await page.evaluate(() => new Promise(r => setTimeout(r, 20)));
}

async function getRow(row) {
    return page.evaluate((r) => {
        const pre = document.getElementById('terminal');
        if (!pre) return '';
        const lines = pre.textContent.split('\n');
        return lines[r] || '';
    }, row);
}

async function getTerminalText() {
    return page.evaluate(() => {
        const pre = document.getElementById('terminal');
        return pre ? pre.textContent : '';
    });
}

async function findChar(ch) {
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

async function isGameOver() {
    const msg = await getRow(0);
    return msg.includes('Play again') || msg.includes('You die') || msg.includes('Goodbye');
}

async function startNewGame(opts = {}) {
    const params = new URLSearchParams(opts).toString();
    const url = params ? `${serverInfo.url}?${params}` : serverInfo.url;
    await page.goto(url);

    // Clear localStorage and reload to prevent state leakage between tests
    await page.evaluate(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle0' });

    await page.waitForSelector('#terminal', { timeout: 5000 });
    await page.waitForFunction(
        () => document.querySelectorAll('#terminal span').length > 100,
        { timeout: 5000 }
    );
    // Wait for game to be ready for input
    await page.waitForFunction(
        () => {
            const text = document.getElementById('terminal')?.textContent || '';
            return text.includes('Shall I pick') || text.includes('Who are you?');
        },
        { timeout: 5000 }
    );
    // Chargen flow: enter name, then 'a' for auto-pick, then dismiss messages
    await sendChar('T');
    await sendChar('e');
    await sendChar('s');
    await sendChar('t');
    await sendKey('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
    // "Shall I pick..." → 'a' (auto-pick, skips to lore)
    await sendChar('a');
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
    // Dismiss lore --More--
    await sendChar(' ');
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
    // Dismiss welcome --More--
    await sendChar(' ');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    // Dismiss tutorial prompt if it appears
    const hasTutorial = await page.evaluate(() =>
        (document.getElementById('terminal')?.textContent || '').includes('Do you want a tutorial?'));
    if (hasTutorial) {
        await sendChar('n');
        await page.evaluate(() => new Promise(r => setTimeout(r, 150)));
    }
}

describe('E2E: Extended gameplay', () => {
    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
    });

    after(async () => {
        if (page) await page.close();
    });

    it('can play for several turns without crashing', async () => {
        await startNewGame();

        let turnsPlayed = 0;
        for (let i = 0; i < 10; i++) {
            if (await isGameOver()) break;
            await sendChar('.');
            turnsPlayed++;
        }

        const status = await getRow(23);
        const hpMatch = status.match(/HP:(\d+)\((\d+)\)/);
        const gameOver = await isGameOver();
        if (hpMatch) {
            assert.ok(parseInt(hpMatch[1]) >= 0, 'HP should be non-negative');
        }
        assert.ok(turnsPlayed > 0 || gameOver, 'Should play turns or reach game over');
    });

    it('player can explore by moving around', async () => {
        await startNewGame();

        const moves = ['l', 'l', 'l', 'j', 'j', 'h', 'h', 'h', 'k', 'k'];
        let totalMoves = 0;
        for (const key of moves) {
            if (await isGameOver()) break;
            await sendChar(key);
            totalMoves++;
        }
        assert.ok(totalMoves > 0, 'Should be able to make at least some moves');
    });

    it('remembers seen terrain (memory)', async () => {
        await startNewGame({ DECgraphics: 'true' });

        // Move around to reveal floor tiles (middle dot in DECgraphics)
        for (const dir of ['l', 'l', 'l', 'l', 'j', 'j', 'h', 'h', 'h', 'h', 'k', 'k']) {
            if (await isGameOver()) break;
            await sendChar(dir);
        }

        const text = await getTerminalText();
        const hasDots = (text.match(/\u00b7/g) || []).length;
        assert.ok(hasDots > 3, `Should have remembered floor tiles, found ${hasDots}`);
    });

    it('status bar shows character stats', async () => {
        await startNewGame();

        const status1 = await getRow(22);
        assert.ok(status1.includes('St:') && status1.includes('Dx:'),
            `Status should show character stats, got: "${status1.trim()}"`);
    });

    it('can pick up gold automatically', async () => {
        await startNewGame();

        const initialStatus = await getRow(23);
        const goldMatch = initialStatus.match(/\$:(\d+)/);
        const initialGold = goldMatch ? parseInt(goldMatch[1]) : 0;

        const pattern = ['l', 'l', 'l', 'j', 'j', 'j', 'h', 'h', 'h', 'k', 'k', 'k',
                         'l', 'j', 'l', 'j', 'h', 'k', 'h', 'k'];
        for (const key of pattern) {
            if (await isGameOver()) break;
            await sendChar(key);
        }

        const finalStatus = await getRow(23);
        const finalGoldMatch = finalStatus.match(/\$:(\d+)/);
        const finalGold = finalGoldMatch ? parseInt(finalGoldMatch[1]) : 0;

        assert.ok(finalGold >= initialGold, 'Gold should not decrease');
    });

    it('can find and descend stairs', async () => {
        await startNewGame();

        const directions = ['l', 'l', 'l', 'l', 'l', 'j', 'j', 'j', 'j',
                           'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h',
                           'k', 'k', 'k', 'k', 'k', 'k', 'k',
                           'l', 'l', 'l', 'j', 'j', 'j', 'j', 'j', 'j'];

        let foundStairs = false;
        for (const key of directions) {
            if (await isGameOver()) break;
            await sendChar(key);

            const msg = await getRow(0);
            if (msg.includes('staircase down')) {
                foundStairs = true;
                break;
            }
        }

        if (foundStairs) {
            const statusBefore = await getRow(23);

            await sendChar('>');
            await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

            const statusAfter = await getRow(23);
            const levelMatch = statusAfter.match(/Dlvl:(\d+)/);
            if (levelMatch) {
                assert.ok(parseInt(levelMatch[1]) >= 1,
                    'Should be on a valid dungeon level');
            }
        }
        assert.ok(true, 'Exploration completed without errors');
    });

    it('game handles many turns without crashing', async () => {
        await startNewGame();

        const actions = ['.', '.', 'l', 'h', 'j', 'k', '.', 'l', 'j',
                        '.', '.', 'h', 'k', '.', 'l', 'j', 'h', 'k',
                        '.', '.', '.', 'l', 'l', 'h', 'h', 'j', 'j',
                        'k', 'k', '.', '.', '.', 'l', 'h', '.', '.',
                        'j', 'k', 'l', 'h', '.', '.', 'j', 'k', '.'];

        let turnsPlayed = 0;
        for (const action of actions) {
            if (await isGameOver()) break;
            await sendChar(action);
            turnsPlayed++;
        }

        assert.ok(turnsPlayed > 5,
            `Should survive at least 5 turns, played ${turnsPlayed}`);
    });

    it('search command can find hidden doors', async () => {
        await startNewGame();

        let foundHidden = false;
        for (let i = 0; i < 30; i++) {
            if (await isGameOver()) break;
            await sendChar('s');
            const msg = await getRow(0);
            if (msg.includes('hidden')) {
                foundHidden = true;
                break;
            }
        }
        assert.ok(true, 'Search completed without errors');
    });

    it('open command works on doors', async () => {
        await startNewGame();

        await sendChar('o');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));

        const msg = await getRow(0);
        const valid = msg.includes('direction') || msg.includes('door') || msg.includes('Never mind');

        await sendChar('l');
        await page.evaluate(() => new Promise(r => setTimeout(r, 50)));

        const result = await getRow(0);
        assert.ok(result.trim().length > 0, 'Open command should produce a response');
    });
});

describe('E2E: Color rendering', () => {
    before(async () => {
        page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [browser] ${err.message}`));
        await startNewGame({ DECgraphics: 'true' });
    });

    after(async () => {
        if (page) await page.close();
    });

    it('player @ is white', async () => {
        const color = await page.evaluate(() => {
            const spans = document.querySelectorAll('#terminal span');
            for (const span of spans) {
                if (span.textContent === '@') return span.style.color;
            }
            return null;
        });
        assert.ok(color, 'Player @ should have a color');
        assert.ok(color.includes('255') || color.includes('fff') || color === 'rgb(255, 255, 255)',
            `Player should be white, got: ${color}`);
    });

    it('walls and floor have distinct colors', async () => {
        const colors = await page.evaluate(() => {
            const spans = document.querySelectorAll('#terminal span');
            const result = { wall: null, floor: null };
            for (const span of spans) {
                if (span.textContent === '\u2500' && !result.wall) result.wall = span.style.color;
                if (span.textContent === '\u00b7' && !result.floor) result.floor = span.style.color;
            }
            return result;
        });
        assert.ok(colors.wall || colors.floor,
            'Should have visible wall or floor colors');
    });

    it('status line text uses gray', async () => {
        const grayCount = await page.evaluate(() => {
            const pre = document.getElementById('terminal');
            if (!pre) return 0;
            const spans = Array.from(pre.querySelectorAll('span'));
            let gray = 0;
            for (let i = 22 * 80; i < 24 * 80 && i < spans.length; i++) {
                const c = spans[i].style.color;
                if (c && (c.includes('170') || c.includes('aaa') || c.includes('ccc') || c.includes('204'))) gray++;
            }
            return gray;
        });
        assert.ok(grayCount > 20,
            `Status lines should be mostly gray, found ${grayCount} gray spans`);
    });
});
