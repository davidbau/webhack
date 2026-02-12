// test/e2e/startup.e2e.test.js -- Critical game startup validation
// This test MUST pass before any commit. It catches browser-specific errors
// that Node.js unit tests miss (like 'process is not defined').

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { startServer } from './serve.js';

let browser, serverInfo;

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

describe('E2E: Critical startup checks', () => {
    it('game starts without console errors', async () => {
        const page = await browser.newPage();

        // Collect all console errors from the start
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Filter out 404s (missing resources are OK if game still works)
                if (!text.includes('404')) {
                    consoleErrors.push(text);
                }
            }
        });

        // Collect all page errors (uncaught exceptions)
        const pageErrors = [];
        page.on('pageerror', err => {
            pageErrors.push(err.message);
        });

        try {
            // Load the page
            await page.goto(serverInfo.url);

            // Clear localStorage and reload to prevent state leakage between tests
            await page.evaluate(() => localStorage.clear());
            await page.reload({ waitUntil: 'networkidle0' });

            // Wait for terminal to be ready
            await page.waitForSelector('#terminal', { timeout: 5000 });

            // CRITICAL: Wait for game to be ready for input
            await page.waitForFunction(
                () => {
                    const text = document.getElementById('terminal')?.textContent || '';
                    return text.includes('Shall I pick') || text.includes('Who are you?');
                },
                { timeout: 5000 }
            );

            // Enter name first
            await page.keyboard.type('Test');
            await page.keyboard.press('Enter');
            await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
            // Auto-select role and start game (this triggers makerooms())
            await page.keyboard.type('a'); // Auto-pick all (skips to lore)
            await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
            await page.keyboard.press('Space'); // Dismiss lore
            await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
            await page.keyboard.press('Space'); // Dismiss welcome
            await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

            // Wait for player @ to appear on the map (proves game started and rendered)
            await page.waitForFunction(
                () => {
                    const pre = document.getElementById('terminal');
                    if (!pre) return false;
                    return pre.textContent.includes('@');
                },
                { timeout: 5000 }
            );

            const playerFound = await page.evaluate(() => {
                const pre = document.getElementById('terminal');
                if (!pre) return false;
                return pre.textContent.includes('@');
            });

            assert.ok(playerFound, 'Player @ should be visible on map after game start');

            // CRITICAL: Fail if ANY console or page errors occurred
            if (consoleErrors.length > 0) {
                assert.fail(`Console errors during startup:\n${consoleErrors.join('\n')}`);
            }

            if (pageErrors.length > 0) {
                assert.fail(`Page errors during startup:\n${pageErrors.join('\n')}`);
            }

        } finally {
            await page.close();
        }
    });

    it('game renders map with dungeon features', async () => {
        const page = await browser.newPage();

        try {
            await page.goto(serverInfo.url);

            // Clear localStorage and reload to prevent state leakage between tests
            await page.evaluate(() => localStorage.clear());
            await page.reload({ waitUntil: 'networkidle0' });

            await page.waitForSelector('#terminal', { timeout: 5000 });

            // Wait for game to be ready for input
            await page.waitForFunction(
                () => {
                    const text = document.getElementById('terminal')?.textContent || '';
                    return text.includes('Shall I pick') || text.includes('Who are you?');
                },
                { timeout: 5000 }
            );

            // Start game - enter name first
            await page.keyboard.type('Test');
            await page.keyboard.press('Enter');
            await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
            await page.keyboard.type('a'); // Auto-pick all (skips to lore)
            await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
            await page.keyboard.press('Space'); // Dismiss lore
            await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
            await page.keyboard.press('Space'); // Dismiss welcome
            await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

            // Wait for game to start and render map with dungeon features
            // DECgraphics is on by default: @ (player), . (floor), box-drawing walls
            try {
                await page.waitForFunction(
                    () => {
                        const pre = document.getElementById('terminal');
                        if (!pre) return false;
                        const text = pre.textContent;
                        // Accept ASCII (-/|) or box-drawing wall chars
                        const hasWalls = (text.includes('-') && text.includes('|')) ||
                                         /[\u2500-\u257F]/.test(text);
                        const hasFloor = text.includes('.') || text.includes('\u00b7');
                        return text.includes('@') && hasFloor && hasWalls;
                    },
                    { timeout: 5000 }
                );
            } catch (e) {
                // Debug: show what's actually on screen
                const content = await page.evaluate(() => document.getElementById('terminal')?.textContent || 'NO TERMINAL');
                console.error('Timeout waiting for map. Terminal content:');
                console.error(content.substring(0, 500));
                throw e;
            }

            // Double-check dungeon characters are present
            const hasDungeonChars = await page.evaluate(() => {
                const pre = document.getElementById('terminal');
                if (!pre) return false;
                const text = pre.textContent;
                const hasWalls = (text.includes('-') && text.includes('|')) ||
                                 /[\u2500-\u257F]/.test(text);
                const hasFloor = text.includes('.') || text.includes('\u00b7');
                return text.includes('@') && hasFloor && hasWalls;
            });

            assert.ok(hasDungeonChars, 'Map should show player, floor, and wall characters');

        } finally {
            await page.close();
        }
    });

    it('no unguarded Node.js API usage (static check)', async () => {
        // This is a belt-and-suspenders check: verify no js files have
        // unguarded process.env references that would break in browsers
        const { readFileSync, readdirSync, statSync } = await import('fs');
        const { join } = await import('path');

        function walkDir(dir) {
            const files = [];
            for (const file of readdirSync(dir)) {
                const path = join(dir, file);
                if (statSync(path).isDirectory()) {
                    if (file !== 'node_modules') {
                        files.push(...walkDir(path));
                    }
                } else if (file.endsWith('.js')) {
                    files.push(path);
                }
            }
            return files;
        }

        const jsFiles = walkDir('js');
        const violations = [];

        for (const file of jsFiles) {
            const content = readFileSync(file, 'utf8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Skip comments
                if (line.trim().startsWith('//')) continue;

                // Check for unguarded process usage
                if (/\bprocess\b/.test(line) && !/typeof process/.test(line)) {
                    violations.push(`${file}:${i+1}: ${line.trim()}`);
                }
            }
        }

        if (violations.length > 0) {
            assert.fail(
                `Found unguarded Node.js API usage in browser code:\n${violations.join('\n')}\n\n` +
                `Guard with: typeof process !== 'undefined' && ...`
            );
        }
    });
});
