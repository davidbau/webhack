#!/usr/bin/env node
/**
 * Trace Room 1 rectangle split calculation
 */

// Room 1 from oracle.lua: x=3, y=3, xalign="center", yalign="center", w=11, h=9

const COLNO = 80;
const ROWNO = 21;
const XLIM = 4;
const YLIM = 3;

// Grid to absolute conversion (C code lines 1600-1621)
let xtmp = 3, ytmp = 3, wtmp = 11, htmp = 9;
let xaltmp = 2; // CENTER
let yaltmp = 2; // CENTER

// Line 1600-1601
let xabs = Math.floor(((xtmp - 1) * COLNO) / 5) + 1;
let yabs = Math.floor(((ytmp - 1) * ROWNO) / 5) + 1;

console.log(`Initial position: xabs=${xabs}, yabs=${yabs}`);

// Line 1602-1611 (xalign = CENTER)
xabs += Math.floor(((COLNO / 5) - wtmp) / 2);

// Line 1612-1621 (yalign = CENTER)
yabs += Math.floor(((ROWNO / 5) - htmp) / 2);

console.log(`After alignment: xabs=${xabs}, yabs=${yabs}`);

// Line 1623-1630 (boundary checks)
if (xabs + wtmp - 1 > COLNO - 2) {
    xabs = COLNO - wtmp - 3;
    console.log(`X boundary adjustment: xabs=${xabs}`);
}
if (xabs < 2) {
    xabs = 2;
    console.log(`X min adjustment: xabs=${xabs}`);
}
if (yabs + htmp - 1 > ROWNO - 2) {
    yabs = ROWNO - htmp - 3;
    console.log(`Y boundary adjustment: yabs=${yabs}`);
}
if (yabs < 2) {
    yabs = 2;
    console.log(`Y min adjustment: yabs=${yabs}`);
}

console.log(`Final position: xabs=${xabs}, yabs=${yabs}`);
console.log(`Room bounds: (${xabs}, ${yabs}) to (${xabs + wtmp - 1}, ${yabs + htmp - 1})`);

// Line 1634-1637 (r2 calculation)
// Note: rndpos = 0 for explicit positions
const rndpos = 0;
const r2 = {
    lx: xabs - 1,
    ly: yabs - 1,
    hx: xabs + wtmp + rndpos,
    hy: yabs + htmp + rndpos
};

console.log(`\nr2 (with borders): (${r2.lx}, ${r2.ly}) to (${r2.hx}, ${r2.hy})`);

// Simulate split_rects
const old_r = { lx: 0, ly: 0, hx: 79, hy: 20 };

console.log(`\nSimulating split_rects:`);
console.log(`old_r: (${old_r.lx}, ${old_r.ly}) to (${old_r.hx}, ${old_r.hy})`);

// TOP
const topSpace = r2.ly - old_r.ly - 1;
const topThreshold = (old_r.hy < ROWNO - 1 ? 2 * YLIM : YLIM + 1) + 4;
console.log(`\nTOP: ${topSpace} > ${topThreshold}? ${topSpace > topThreshold}`);
if (topSpace > topThreshold) {
    console.log(`  Would add: (${old_r.lx}, ${old_r.ly}) to (${old_r.hx}, ${r2.ly - 2})`);
}

// LEFT
const leftSpace = r2.lx - old_r.lx - 1;
const leftThreshold = (old_r.hx < COLNO - 1 ? 2 * XLIM : XLIM + 1) + 4;
console.log(`\nLEFT: ${leftSpace} > ${leftThreshold}? ${leftSpace > leftThreshold}`);
if (leftSpace > leftThreshold) {
    console.log(`  Would add: (${old_r.lx}, ${old_r.ly}) to (${r2.lx - 2}, ${old_r.hy})`);
}

// BOTTOM
const bottomSpace = old_r.hy - r2.hy - 1;
const bottomThreshold = (old_r.ly > 0 ? 2 * YLIM : YLIM + 1) + 4;
console.log(`\nBOTTOM: ${bottomSpace} > ${bottomThreshold}? ${bottomSpace > bottomThreshold}`);
if (bottomSpace > bottomThreshold) {
    console.log(`  Would add: (${old_r.lx}, ${r2.hy + 2}) to (${old_r.hx}, ${old_r.hy})`);
}

// RIGHT
const rightSpace = old_r.hx - r2.hx - 1;
const rightThreshold = (old_r.lx > 0 ? 2 * XLIM : XLIM + 1) + 4;
console.log(`\nRIGHT: ${rightSpace} > ${rightThreshold}? ${rightSpace > rightThreshold}`);
if (rightSpace > rightThreshold) {
    console.log(`  Would add: (${r2.hx + 2}, ${old_r.ly}) to (${old_r.hx}, ${old_r.hy})`);
}

let rectCount = 0;
if (topSpace > topThreshold) rectCount++;
if (leftSpace > leftThreshold) rectCount++;
if (bottomSpace > bottomThreshold) rectCount++;
if (rightSpace > rightThreshold) rectCount++;

console.log(`\n==> Total rectangles that should be added: ${rectCount}`);
console.log(`==> C has: 1 rectangle (from rn2(1) in trace)`);
