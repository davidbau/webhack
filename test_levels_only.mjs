// Test only actual playable level files
import { readdirSync } from 'fs';

async function testAll() {
  const levelFiles = readdirSync('js/levels')
    .filter(f => f.endsWith('.js'))
    // Exclude library/helper files
    .filter(f => !['nhcore.js', 'nhlib.js', 'quest.js', 'themerms.js', 'dungeon.js', 'hellfill.js', 'minefill.js'].includes(f))
    .sort();

  const broken = [];
  const working = [];

  for (const file of levelFiles) {
    try {
      await import(`./js/levels/${file}?t=${Date.now()}`);
      working.push(file);
    } catch (err) {
      broken.push({ file, error: err.message.split('\n')[0] });
    }
  }

  console.log(`Working: ${working.length}/${levelFiles.length} (${Math.round(working.length/levelFiles.length*100)}%)`);
  if (broken.length > 0) {
    console.log(`Broken: ${broken.length}/${levelFiles.length}\n`);
    broken.forEach(({ file, error }) => {
      console.log(`  ❌ ${file}: ${error}`);
    });
  } else {
    console.log('🎉 All actual level files working!');
  }
}

testAll();
