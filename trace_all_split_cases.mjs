#!/usr/bin/env node
/**
 * Check all 4 possible rectangles from split_rects
 */

const COLNO = 80, ROWNO = 21, XLIM = 4, YLIM = 3;

const old_r = { lx: 0, ly: 0, hx: 79, hy: 20 };
const r2 = { lx: 34, ly: 5, hx: 46, hy: 15 };  // Room 1 with borders

console.log('Checking all 4 split_rects cases for Room 1:\n');

// TOP
const topSpace = r2.ly - old_r.ly - 1;
const topThresh = (old_r.hy < ROWNO - 1 ? 2 * YLIM : YLIM + 1) + 4;
const topPasses = topSpace > topThresh;
console.log(`1. TOP: ${topSpace} > ${topThresh}? ${topPasses}`);
if (topPasses) {
    const rect = { lx: old_r.lx, ly: old_r.ly, hx: old_r.hx, hy: r2.ly - 2 };
    console.log(`   Would create: (${rect.lx},${rect.ly}) to (${rect.hx},${rect.hy})`);
    console.log(`   Size: ${rect.hx - rect.lx + 1} x ${rect.hy - rect.ly + 1}`);
}

// LEFT
const leftSpace = r2.lx - old_r.lx - 1;
const leftThresh = (old_r.hx < COLNO - 1 ? 2 * XLIM : XLIM + 1) + 4;
const leftPasses = leftSpace > leftThresh;
console.log(`\n2. LEFT: ${leftSpace} > ${leftThresh}? ${leftPasses}`);
if (leftPasses) {
    const rect = { lx: old_r.lx, ly: old_r.ly, hx: r2.lx - 2, hy: old_r.hy };
    console.log(`   Would create: (${rect.lx},${rect.ly}) to (${rect.hx},${rect.hy})`);
    console.log(`   Size: ${rect.hx - rect.lx + 1} x ${rect.hy - rect.ly + 1}`);
}

// BOTTOM
const bottomSpace = old_r.hy - r2.hy - 1;
const bottomThresh = (old_r.ly > 0 ? 2 * YLIM : YLIM + 1) + 4;
const bottomPasses = bottomSpace > bottomThresh;
console.log(`\n3. BOTTOM: ${bottomSpace} > ${bottomThresh}? ${bottomPasses}`);
if (bottomPasses) {
    const rect = { lx: old_r.lx, ly: r2.hy + 2, hx: old_r.hx, hy: old_r.hy };
    console.log(`   Would create: (${rect.lx},${rect.ly}) to (${rect.hx},${rect.hy})`);
    console.log(`   Size: ${rect.hx - rect.lx + 1} x ${rect.hy - rect.ly + 1}`);
}

// RIGHT
const rightSpace = old_r.hx - r2.hx - 1;
const rightThresh = (old_r.lx > 0 ? 2 * XLIM : XLIM + 1) + 4;
const rightPasses = rightSpace > rightThresh;
console.log(`\n4. RIGHT: ${rightSpace} > ${rightThresh}? ${rightPasses}`);
if (rightPasses) {
    const rect = { lx: r2.hx + 2, ly: old_r.ly, hx: old_r.hx, hy: old_r.hy };
    console.log(`   Would create: (${rect.lx},${rect.ly}) to (${rect.hx},${rect.hy})`);
    console.log(`   Size: ${rect.hx - rect.lx + 1} x ${rect.hy - rect.ly + 1}`);
}

const passing = [topPasses, leftPasses, bottomPasses, rightPasses];
const numPassing = passing.filter(Boolean).length;

console.log(`\n========================================`);
console.log(`Total rectangles that pass threshold: ${numPassing}`);
console.log(`C has: 1 rectangle`);
console.log(`\nMystery: Which ONE rectangle does C keep?`);

// Check if LEFT and RIGHT overlap or can be merged
if (leftPasses && rightPasses) {
    console.log(`\nLEFT and RIGHT both pass. Gap between them:`);
    console.log(`LEFT ends at x=${r2.lx - 2}, RIGHT starts at x=${r2.hx + 2}`);
    console.log(`Gap: ${r2.hx + 2 - (r2.lx - 2) - 1} columns`);
}
