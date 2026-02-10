// Analyze the split that reduced pool from 3 to 2
const XLIM = 4, YLIM = 3, COLNO = 80, ROWNO = 21;

const old_r = {lx: 19, ly: 0, hx: 44, hy: 11};
const r2 = {lx: 25, ly: 1, hx: 34, hy: 7};

console.log('Analyzing split:');
console.log(`  Original rect: (${old_r.lx},${old_r.ly})-(${old_r.hx},${old_r.hy})`);
console.log(`  Room placed:   (${r2.lx},${r2.ly})-(${r2.hx},${r2.hy})`);
console.log('');

// Check each potential new rectangle
console.log('Top rect check:');
const top_height = r2.ly - old_r.ly - 1;
const top_min = (old_r.hy < ROWNO - 1 ? 2 * YLIM : YLIM + 1) + 4;
console.log(`  Height: ${r2.ly} - ${old_r.ly} - 1 = ${top_height}`);
console.log(`  Min required: ${top_min}`);
console.log(`  Would add: ${top_height > top_min ? 'YES' : 'NO'}`);

console.log('\nLeft rect check:');
const left_width = r2.lx - old_r.lx - 1;
const left_min = (old_r.hx < COLNO - 1 ? 2 * XLIM : XLIM + 1) + 4;
console.log(`  Width: ${r2.lx} - ${old_r.lx} - 1 = ${left_width}`);
console.log(`  Min required: ${left_min}`);
console.log(`  Would add: ${left_width > left_min ? 'YES' : 'NO'}`);

console.log('\nBottom rect check:');
const bottom_height = old_r.hy - r2.hy - 1;
const bottom_min = (old_r.ly > 0 ? 2 * YLIM : YLIM + 1) + 4;
console.log(`  Height: ${old_r.hy} - ${r2.hy} - 1 = ${bottom_height}`);
console.log(`  Min required: ${bottom_min}`);
console.log(`  Would add: ${bottom_height > bottom_min ? 'YES' : 'NO'}`);

console.log('\nRight rect check:');
const right_width = old_r.hx - r2.hx - 1;
const right_min = (old_r.lx > 0 ? 2 * XLIM : XLIM + 1) + 4;
console.log(`  Width: ${old_r.hx} - ${r2.hx} - 1 = ${right_width}`);
console.log(`  Min required: ${right_min}`);
console.log(`  Would add: ${right_width > right_min ? 'YES' : 'NO'}`);

console.log('\n' + '='.repeat(50));
console.log('Summary: Split removed 1 rect, would add only 1 new rect');
console.log('Net change: 3 - 1 + 1 = 3... but got 2?');
