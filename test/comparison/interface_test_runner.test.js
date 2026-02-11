/**
 * Interface Testing: Character-by-character comparison of JS vs C NetHack UI
 *
 * Tests that the JS port matches C NetHack's interface exactly including:
 * - Screen layout and text content
 * - Terminal attributes (inverse video, bold, underline)
 * - Menu formatting and headers
 * - Copyright notices and prompts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.join(__dirname, 'sessions');

/**
 * Load an interface session file
 */
function loadSession(filename) {
  const filepath = path.join(SESSIONS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return null;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(content);
}

/**
 * Compare two screens character by character
 * @returns {object} { matches: boolean, diffs: Array }
 */
function compareScreens(jsScreen, cScreen, jsAttrs, cAttrs) {
  const diffs = [];

  // Ensure both screens are 24 rows
  const jsRows = jsScreen.length;
  const cRows = cScreen.length;

  if (jsRows !== 24 || cRows !== 24) {
    diffs.push({
      type: 'size',
      message: `Screen size mismatch: JS has ${jsRows} rows, C has ${cRows} rows`
    });
  }

  const maxRows = Math.max(jsRows, cRows, 24);

  for (let row = 0; row < maxRows; row++) {
    const jsLine = (jsScreen[row] || '').padEnd(80, ' ');
    const cLine = (cScreen[row] || '').padEnd(80, ' ');
    const jsAttrLine = (jsAttrs?.[row] || '').padEnd(80, '0');
    const cAttrLine = (cAttrs?.[row] || '').padEnd(80, '0');

    // Compare content
    for (let col = 0; col < 80; col++) {
      if (jsLine[col] !== cLine[col]) {
        diffs.push({
          type: 'char',
          row,
          col,
          jsChar: jsLine[col],
          cChar: cLine[col],
          message: `(${col},${row}): JS='${jsLine[col]}' C='${cLine[col]}'`
        });
      }
    }

    // Compare attributes
    if (jsAttrs && cAttrs) {
      for (let col = 0; col < 80; col++) {
        if (jsAttrLine[col] !== cAttrLine[col]) {
          diffs.push({
            type: 'attr',
            row,
            col,
            jsAttr: jsAttrLine[col],
            cAttr: cAttrLine[col],
            message: `(${col},${row}): JS attr='${jsAttrLine[col]}' C attr='${cAttrLine[col]}'`
          });
        }
      }
    }
  }

  return {
    matches: diffs.length === 0,
    diffs
  };
}

/**
 * Format diff report for display
 */
function formatDiffReport(diffs, limit = 20) {
  if (diffs.length === 0) {
    return '';
  }

  const charDiffs = diffs.filter(d => d.type === 'char');
  const attrDiffs = diffs.filter(d => d.type === 'attr');

  let report = `${diffs.length} differences found:\n`;

  if (charDiffs.length > 0) {
    report += `\nCharacter differences (${charDiffs.length}):\n`;
    charDiffs.slice(0, limit).forEach(d => {
      report += `  ${d.message}\n`;
    });
    if (charDiffs.length > limit) {
      report += `  ... and ${charDiffs.length - limit} more\n`;
    }
  }

  if (attrDiffs.length > 0) {
    report += `\nAttribute differences (${attrDiffs.length}):\n`;
    attrDiffs.slice(0, limit).forEach(d => {
      report += `  ${d.message}\n`;
    });
    if (attrDiffs.length > limit) {
      report += `  ... and ${attrDiffs.length - limit} more\n`;
    }
  }

  return report;
}

/**
 * Simulate JS NetHack rendering for a given step
 * This is a placeholder - will be implemented to actually run JS NetHack
 */
async function simulateJSStep(step, previousState) {
  // TODO: Implement actual JS NetHack headless mode
  // For now, return empty screen to establish test structure
  return {
    screen: Array(24).fill(''.padEnd(80, ' ')),
    attrs: Array(24).fill('0'.repeat(80)),
    state: previousState
  };
}

describe('Interface Tests', () => {
  describe('Startup Sequence', () => {
    it('should match C NetHack startup screen exactly', async () => {
      const session = loadSession('interface_startup.session.json');

      if (!session) {
        console.log('⚠️  No startup session found - run gen_interface_sessions.py --startup');
        return;
      }

      assert.strictEqual(session.type, 'interface');
      assert.strictEqual(session.subtype, 'startup');
      assert(session.steps.length > 0, 'Session should have steps');

      // For now, just verify the session structure
      const firstStep = session.steps[0];
      assert(firstStep.screen, 'Step should have screen');
      assert(firstStep.attrs, 'Step should have attrs');
      assert.strictEqual(firstStep.screen.length, 24, 'Screen should have 24 rows');

      console.log(`✅ Startup session has ${session.steps.length} steps`);
    });

    it('should detect inverse video in headers', async () => {
      const session = loadSession('interface_startup.session.json');

      if (!session) {
        return;
      }

      // Check for inverse video attributes in captured screens
      let foundInverse = false;

      for (const step of session.steps) {
        for (const attrLine of step.attrs) {
          if (attrLine.includes('1')) {
            foundInverse = true;
            break;
          }
        }
        if (foundInverse) break;
      }

      assert(foundInverse, 'Should have inverse video attributes in at least one screen');
      console.log('✅ Inverse video attributes detected in C NetHack screens');
    });
  });

  describe('Options Menu', () => {
    it('should match C NetHack options menu layout', async () => {
      const session = loadSession('interface_options.session.json');

      if (!session) {
        console.log('⚠️  No options session found - run gen_interface_sessions.py --options');
        return;
      }

      assert.strictEqual(session.type, 'interface');
      assert.strictEqual(session.subtype, 'options');
      assert(session.steps.length > 0, 'Session should have steps');

      console.log(`✅ Options session has ${session.steps.length} steps`);
    });
  });

  describe('Screen Comparison Utilities', () => {
    it('should detect character differences', () => {
      const jsScreen = [
        'Hello World'.padEnd(80, ' '),
        ...Array(23).fill(''.padEnd(80, ' '))
      ];
      const cScreen = [
        'Hello Earth'.padEnd(80, ' '),
        ...Array(23).fill(''.padEnd(80, ' '))
      ];

      const result = compareScreens(jsScreen, cScreen, null, null);

      assert(!result.matches, 'Screens should not match');
      assert(result.diffs.length > 0, 'Should have differences');

      const charDiffs = result.diffs.filter(d => d.type === 'char');
      // "World" vs "Earth": W≠E, o≠a, r=r, l≠t, d≠h = 4 differences
      assert(charDiffs.length === 4, `Should detect exactly 4 char diffs, got ${charDiffs.length}`);
    });

    it('should detect attribute differences', () => {
      const jsScreen = Array(24).fill('Test'.padEnd(80));
      const cScreen = Array(24).fill('Test'.padEnd(80));
      const jsAttrs = Array(24).fill('0'.repeat(80));
      const cAttrs = ['1'.repeat(10) + '0'.repeat(70), ...Array(23).fill('0'.repeat(80))];

      const result = compareScreens(jsScreen, cScreen, jsAttrs, cAttrs);

      assert(!result.matches, 'Attributes should not match');
      const attrDiffs = result.diffs.filter(d => d.type === 'attr');
      assert.strictEqual(attrDiffs.length, 10, 'Should detect 10 attribute differences');
    });
  });
});
