// Test object rendering with correct colors
// C ref: objects.c - each object has a color field used for display
import { test } from 'node:test';
import assert from 'assert';
import { mksobj } from '../../js/mkobj.js';
import { objectData } from '../../js/objects.js';
import {
    CLR_BLACK, CLR_RED, CLR_GREEN, CLR_BROWN, CLR_BLUE,
    CLR_MAGENTA, CLR_CYAN, CLR_GRAY, CLR_ORANGE, CLR_BRIGHT_GREEN,
    CLR_YELLOW, CLR_BRIGHT_BLUE, CLR_BRIGHT_MAGENTA, CLR_BRIGHT_CYAN, CLR_WHITE
} from '../../js/display.js';

test('object colors: objects have displayColor property from objectData', () => {
    // Test a few different object types
    const dagger = mksobj(10, false); // Some generic object
    assert.notStrictEqual(dagger.displayColor, undefined, 'Object should have displayColor');
    assert.strictEqual(typeof dagger.displayColor, 'number', 'displayColor should be a number');
});

test('object colors: displayColor matches objectData color', () => {
    // Create several objects and verify their colors match the data
    for (let otyp = 0; otyp < Math.min(50, objectData.length); otyp++) {
        if (!objectData[otyp]) continue;
        const obj = mksobj(otyp, false);
        assert.strictEqual(
            obj.displayColor,
            objectData[otyp].color,
            `Object ${objectData[otyp].name} (otyp ${otyp}) should have color ${objectData[otyp].color}`
        );
    }
});

test('object colors: gray objects use CLR_GRAY (7)', () => {
    // Find an object with gray color
    const grayObjIdx = objectData.findIndex(od => od && od.color === CLR_GRAY);
    if (grayObjIdx >= 0) {
        const obj = mksobj(grayObjIdx, false);
        assert.strictEqual(obj.displayColor, CLR_GRAY, `${objectData[grayObjIdx].name} should be CLR_GRAY`);
    }
});

test('object colors: colored objects use proper color constants', () => {
    // Test various colors if we can find objects with them
    const redObjIdx = objectData.findIndex(od => od && od.color === CLR_RED);
    if (redObjIdx >= 0) {
        const obj = mksobj(redObjIdx, false);
        assert.strictEqual(obj.displayColor, CLR_RED, `${objectData[redObjIdx].name} should be CLR_RED`);
    }

    const blueObjIdx = objectData.findIndex(od => od && od.color === CLR_BLUE);
    if (blueObjIdx >= 0) {
        const obj = mksobj(blueObjIdx, false);
        assert.strictEqual(obj.displayColor, CLR_BLUE, `${objectData[blueObjIdx].name} should be CLR_BLUE`);
    }

    const greenObjIdx = objectData.findIndex(od => od && od.color === CLR_GREEN);
    if (greenObjIdx >= 0) {
        const obj = mksobj(greenObjIdx, false);
        assert.strictEqual(obj.displayColor, CLR_GREEN, `${objectData[greenObjIdx].name} should be CLR_GREEN`);
    }
});

test('object colors: white objects use CLR_WHITE (15)', () => {
    const whiteObjIdx = objectData.findIndex(od => od && od.color === CLR_WHITE);
    if (whiteObjIdx >= 0) {
        const obj = mksobj(whiteObjIdx, false);
        assert.strictEqual(obj.displayColor, CLR_WHITE, `${objectData[whiteObjIdx].name} should be CLR_WHITE (15)`);
    }
});
