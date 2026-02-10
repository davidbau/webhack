// test_check_log_format.js - Check the actual log format

import { initRng, enableRngLog, getRngLog } from './js/rng.js';

enableRngLog();
initRng(163);

// Make a few RNG calls
import { rn2 } from './js/rng.js';
rn2(10);
rn2(20);
rn2(30);

const log = getRngLog();

console.log('Raw log entries:');
for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    console.log(`[${i}] length=${entry.length}, chars=[${Array.from(entry).map((c, i) => `${i}:'${c}'(${c.charCodeAt(0)})`).slice(0, 15).join(', ')}]`);
    console.log(`     content: "${entry}"`);
}

console.log('\\nTesting regex on first entry:');
const first = log[0];
console.log(`Input: "${first}"`);
console.log(`After replace /^\\\\d+\\\\s+/: "${first.replace(/^\\d+\\s+/, '')}"`);
console.log(`Match test: ${/^\\d+\\s+/.test(first)}`);
