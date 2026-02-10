#!/usr/bin/env node
/**
 * Trace what happens when delphi room is placed
 */

// After Room 1 split, we have:
// LEFT: (0, 0) to (32, 20)
// RIGHT: (48, 0) to (79, 20)

// Delphi room from oracle.lua: x=4, y=3, w=3, h=3 (relative to parent Room 1)
// Room 1 is at (35, 6), so delphi is at (35+4, 6+3) = (39, 9)
// Delphi bounds: (39, 9) to (41, 11)
// With borders: (38, 8) to (42, 12)

const delphi_r2 = {
    lx: 38,
    ly: 8,
    hx: 42,
    hy: 12
};

const left_rect = {
    lx: 0,
    ly: 0,
    hx: 32,
    hy: 20
};

const right_rect = {
    lx: 48,
    ly: 0,
    hx: 79,
    hy: 20
};

console.log('Delphi room (nested): (39, 9) to (41, 11)');
console.log(`Delphi r2 (with borders): (${delphi_r2.lx}, ${delphi_r2.ly}) to (${delphi_r2.hx}, ${delphi_r2.hy})`);
console.log(`\nLEFT rect: (${left_rect.lx}, ${left_rect.ly}) to (${left_rect.hx}, ${left_rect.hy})`);
console.log(`RIGHT rect: (${right_rect.lx}, ${right_rect.ly}) to (${right_rect.hx}, ${right_rect.hy})`);

// Check if delphi intersects with LEFT
const left_intersects = !(delphi_r2.lx > left_rect.hx || delphi_r2.ly > left_rect.hy ||
                          delphi_r2.hx < left_rect.lx || delphi_r2.hy < left_rect.ly);

// Check if delphi intersects with RIGHT
const right_intersects = !(delphi_r2.lx > right_rect.hx || delphi_r2.ly > right_rect.hy ||
                           delphi_r2.hx < right_rect.lx || delphi_r2.hy < right_rect.ly);

console.log(`\nDoes delphi intersect LEFT? ${left_intersects}`);
console.log(`Does delphi intersect RIGHT? ${right_intersects}`);

console.log('\n==> Delphi room is INSIDE Room 1 (35,6)-(45,14), which is between LEFT and RIGHT');
console.log('==> So delphi does NOT intersect with either split rectangle');
console.log('==> Delphi is NOT the cause of the missing rectangle');
