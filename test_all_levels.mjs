// Test all level files to find broken ones
import { readdirSync } from 'fs';

async function testAll() {
  const levelFiles = readdirSync('js/levels')
    .filter(f => f.endsWith('.js'))
    .sort();

  const broken = [];
  const working = [];

  for (const file of levelFiles) {
    try {
      await import(`./js/levels/${file}`);
      working.push(file);
    } catch (err) {
      broken.push({ file, error: err.message.split('\n')[0] });
    }
  }

  console.log(`Working: ${working.length}/${levelFiles.length}`);
  console.log(`Broken: ${broken.length}/${levelFiles.length}\n`);

  if (broken.length > 0) {
    console.log('Broken files:');
    broken.forEach(({ file, error }) => {
      console.log(`  ❌ ${file}: ${error}`);
    });
  }
}

testAll();
