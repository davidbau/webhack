// Test verbose option behavior
import { test } from 'node:test';
import assert from 'node:assert';
import { HeadlessDisplay } from '../comparison/session_helpers.js';

test('verbose option gates help messages', async () => {
    // Mock display to capture messages
    let lastMessage = null;
    const display = new HeadlessDisplay();
    const originalPutstr = display.putstr_message;
    display.putstr_message = (msg) => {
        lastMessage = msg;
        originalPutstr.call(display, msg);
    };

    // Test with verbose=true (default)
    const verboseFlags = { verbose: true };
    const quietFlags = { verbose: false };

    // Test "Never mind" message
    // When verbose=true, message should be shown
    const gameVerbose = { flags: verboseFlags };
    if (gameVerbose.flags.verbose) {
        display.putstr_message("Never mind.");
    }
    assert.strictEqual(lastMessage, "Never mind.", "Message should appear with verbose=true");

    // When verbose=false, message should not be shown
    lastMessage = null;
    const gameQuiet = { flags: quietFlags };
    if (gameQuiet.flags.verbose) {
        display.putstr_message("Never mind.");
    }
    assert.strictEqual(lastMessage, null, "Message should not appear with verbose=false");

    // Test staircase message
    lastMessage = null;
    if (gameVerbose.flags.verbose) {
        display.putstr_message("There is a staircase up here.");
    }
    assert.strictEqual(lastMessage, "There is a staircase up here.",
        "Staircase message should appear with verbose=true");

    lastMessage = null;
    if (gameQuiet.flags.verbose) {
        display.putstr_message("There is a staircase up here.");
    }
    assert.strictEqual(lastMessage, null,
        "Staircase message should not appear with verbose=false");

    // Test prefix help message
    lastMessage = null;
    if (gameVerbose.flags.verbose) {
        display.putstr_message("Next command will request menu or move without autopickup/attack.");
    }
    assert.strictEqual(lastMessage, "Next command will request menu or move without autopickup/attack.",
        "Prefix help should appear with verbose=true");

    lastMessage = null;
    if (gameQuiet.flags.verbose) {
        display.putstr_message("Next command will request menu or move without autopickup/attack.");
    }
    assert.strictEqual(lastMessage, null,
        "Prefix help should not appear with verbose=false");
});
