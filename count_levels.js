import { listSpecialLevels } from './js/special_levels.js';

const levels = listSpecialLevels();
console.log('Total registered special levels:', levels.length);

const byBranch = {};
for (const l of levels) {
  if (!byBranch[l.dnum]) byBranch[l.dnum] = [];
  byBranch[l.dnum].push(l);
}

console.log('\nBy branch:');
console.log('- Dungeons of Doom:', byBranch[0]?.length || 0);
console.log('- Sokoban:', byBranch[2]?.length || 0);
console.log('- Fort Ludios:', byBranch[4]?.length || 0);
console.log('- Gehennom:', byBranch[5]?.length || 0);
console.log('- Vlads Tower:', byBranch[6]?.length || 0);
