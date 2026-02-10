// test_check_themeroom_args.js - Check THEMEROOM_ARGS array

import { readFileSync } from 'fs';

// Read the file and parse to find THEMEROOM_ARGS
const content = readFileSync('./js/themerms.js', 'utf8');

// Find the array definition
const match = content.match(/const THEMEROOM_ARGS = \[([\s\S]*?)\];/);

if (match) {
    const arrayContent = match[1];
    const numbers = arrayContent.match(/\d+/g);

    console.log('THEMEROOM_ARGS array:');
    console.log(`  Array length: ${numbers.length}`);
    console.log(`  Values: [${numbers.join(', ')}]`);
    console.log();

    // Check for gaps
    const numArray = numbers.map(n => parseInt(n));
    console.log('Checking for continuity:');
    for (let i = 1; i < numArray.length; i++) {
        const diff = numArray[i] - numArray[i-1];
        if (diff > 1) {
            console.log(`  Gap at index ${i}: ${numArray[i-1]} -> ${numArray[i]} (diff=${diff})`);
        }
    }
} else {
    console.log('Could not find THEMEROOM_ARGS definition');
}

// Also import and check at runtime
import('./js/themerms.js').then(module => {
    // Can't access const, but let's check the function behavior
    console.log('\nRuntime check would require exporting THEMEROOM_ARGS.');
    console.log('Based on static analysis, array has 30 elements but should call rn2() 30 times.');
});
