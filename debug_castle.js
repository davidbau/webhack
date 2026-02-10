import { initRng } from './js/rng.js';
import { resetLevelState } from './js/sp_lev.js';
import { getSpecialLevel, DUNGEONS_OF_DOOM } from './js/special_levels.js';

initRng(42);
resetLevelState();

const specialLevel = getSpecialLevel(DUNGEONS_OF_DOOM, 17);
console.log('Special level info:', {
    name: specialLevel.name,
    hasGenerator: !!specialLevel.generator
});

const level = specialLevel.generator();

console.log('\nLevel object keys:', Object.keys(level));
console.log('Has typGrid:', 'typGrid' in level);
console.log('Has grid:', 'grid' in level);
if (level.typGrid) {
    console.log('typGrid dimensions:', level.typGrid.length, 'x', level.typGrid[0]?.length);
}
if (level.grid) {
    console.log('grid dimensions:', level.grid.length, 'x', level.grid[0]?.length);
}
