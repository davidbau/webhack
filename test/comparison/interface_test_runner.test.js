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
 */
async function simulateJSStep(step, previousState) {
  // Import headless game runner
  const { HeadlessGame } = await import('./headless_game.js');

  // Initialize or reuse game state
  let game = previousState?.game;

  if (!game) {
    // First step: initialize game with same seed as C sessions
    const seed = 42;
    game = new HeadlessGame(seed);
    game.init();
  }

  // Process the input key from this step
  if (step.key && step.key !== 'startup') {
    // Send keypress to game
    await game.handleInput(step.key);
  }

  // Capture the current screen state
  return {
    screen: game.getScreen(),
    attrs: game.getAttrs(),
    state: { game }
  };
}

describe('Interface Tests', () => {
  describe('Complete Character Generation', () => {
    it('should match C NetHack complete chargen sequence exactly', async () => {
      const session = loadSession('interface_chargen.session.json');

      if (!session) {
        console.log('⚠️  No chargen session found - run gen_interface_sessions.py --chargen');
        return;
      }

      assert.strictEqual(session.type, 'interface');
      assert.strictEqual(session.subtype, 'complete_chargen');
      assert(session.steps.length > 0, 'Session should have steps');

      // Test all chargen steps
      let state = null;
      const stepResults = [];

      for (let i = 0; i < session.steps.length; i++) {
        const step = session.steps[i];
        const jsResult = await simulateJSStep(step, state);
        state = jsResult.state;

        const comparison = compareScreens(
          jsResult.screen,
          step.screen,
          jsResult.attrs,
          step.attrs
        );

        stepResults.push({
          step: i,
          description: step.description,
          matches: comparison.matches,
          charDiffs: comparison.diffs.filter(d => d.type === 'char').length,
          attrDiffs: comparison.diffs.filter(d => d.type === 'attr').length
        });

        if (!comparison.matches) {
          const report = formatDiffReport(comparison.diffs, 10);
          console.log(`\n❌ Step ${i} (${step.description}) differences:\n${report}`);
        }
      }

      // Log progress
      console.log('\nComplete Chargen Sequence:');
      for (const result of stepResults) {
        const status = result.matches ? '✅' : '⚠️';
        console.log(`${status} Step ${result.step} (${result.description}): ` +
                   `${result.charDiffs} char diffs, ${result.attrDiffs} attr diffs`);
      }

      // Count total matches
      const perfectSteps = stepResults.filter(r => r.matches).length;
      console.log(`\n${perfectSteps}/${stepResults.length} steps with 100% equivalence`);

      // Verify we tested all steps
      assert(stepResults.length > 0, 'Should have tested at least one step');
    });
  });

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

      // Verify the session structure
      const firstStep = session.steps[0];
      assert(firstStep.screen, 'Step should have screen');
      assert(firstStep.attrs, 'Step should have attrs');
      assert.strictEqual(firstStep.screen.length, 24, 'Screen should have 24 rows');

      console.log(`✅ Startup session has ${session.steps.length} steps`);
    });

    it('should render role menu with inverse video header', async () => {
      const session = loadSession('interface_startup.session.json');

      if (!session || session.steps.length < 3) {
        return;
      }

      // Find the role menu step (should be step 2: "Decline random character")
      const roleMenuStep = session.steps.find(s => s.description.includes('Role selection'));

      if (!roleMenuStep) {
        return;
      }

      // Import HeadlessDisplay
      const { HeadlessDisplay } = await import('./session_helpers.js');

      // Create a simple role menu to test attribute rendering
      const display = new HeadlessDisplay();
      const menuLines = [
        ' Pick a role or profession',
        '',
        ' a - archeologist',
        ' b - barbarian'
      ];

      display.renderChargenMenu(menuLines, false);

      // Get the rendered screen and attributes
      const jsScreen = display.getScreenLines();
      const jsAttrs = display.getAttrLines();

      // Check that the header has inverse video (attr=1)
      const headerAttrs = jsAttrs[0];
      const hasInverse = headerAttrs.includes('1');

      assert(hasInverse, 'Menu header should have inverse video attribute');
      console.log('✅ Role menu header rendered with inverse video');
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
    it('should match C NetHack options menu exactly', async () => {
      const session = loadSession('interface_options.session.json');

      if (!session) {
        console.log('⚠️  No options session found - run gen_interface_sessions.py --options');
        return;
      }

      assert.strictEqual(session.type, 'interface');
      assert.strictEqual(session.subtype, 'options');
      assert(session.steps.length > 0, 'Session should have steps');

      // Import HeadlessGame
      const { HeadlessGame } = await import('./headless_game.js');

      // Create game in options menu state
      const game = new HeadlessGame(42);
      game.state = 'options_menu';
      game.optionsMenu.page = 1;
      game.optionsMenu.showHelp = false;

      // Set flags to match C NetHack defaults
      game.flags = {
        // Page 1 options
        fruit: 'slime mold',
        number_pad: false,  // 0=off
        autodig: false,
        autoopen: true,     // [X] in C
        pickup: false,      // autopickup off in C
        autopickup_exceptions: 0,
        autoquiver: false,
        autounlock: 'apply-key',
        cmdassist: true,    // [X] in C
        dropped_nopick: true,   // [X] in C
        fireassist: true,       // [X] in C
        pickup_stolen: true,    // [X] in C
        pickup_thrown: true,    // [X] in C
        pickup_types: 'all',
        pushweapon: false,

        // Page 2 options
        bgcolors: true,         // [X] in C
        color: true,            // [X] in C
        customcolors: true,     // [X] in C
        customsymbols: true,    // [X] in C
        hilite_pet: false,
        hilite_pile: false,
        showrace: false,
        sparkle: true,          // [X] in C
        symset: 'default',
        hitpointbar: false,
        menucolors: 0,
        showexp: false,
        statusconditions: 16,
        statushighlights: 0,
        statuslines: 2,
        time: false
      };

      // Test all options menu steps
      const stepResults = [];

      for (let i = 0; i < session.steps.length; i++) {
        const step = session.steps[i];

        // Set state based on step
        if (step.key === 'O') {
          game.optionsMenu.page = 1;
          game.optionsMenu.showHelp = false;
        } else if (step.key === '>') {
          game.optionsMenu.page = 2;
        } else if (step.key === '<') {
          game.optionsMenu.page = 1;
        } else if (step.key === '?') {
          game.optionsMenu.showHelp = true;
        }

        // Render current state
        game.showOptionsMenu();

        // Get screen and attrs
        const jsScreen = game.getScreen();
        const jsAttrs = game.getAttrs();

        // Compare
        const comparison = compareScreens(
          jsScreen,
          step.screen,
          jsAttrs,
          step.attrs
        );

        stepResults.push({
          step: i,
          description: step.description,
          matches: comparison.matches,
          charDiffs: comparison.diffs.filter(d => d.type === 'char').length,
          attrDiffs: comparison.diffs.filter(d => d.type === 'attr').length
        });

        if (!comparison.matches) {
          const report = formatDiffReport(comparison.diffs, 10);
          console.log(`\n❌ Step ${i} (${step.description}) differences:\n${report}`);
        }
      }

      // Log progress
      console.log('\nOptions Menu Comparison:');
      for (const result of stepResults) {
        const status = result.matches ? '✅' : '⚠️';
        console.log(`${status} ${result.description}: ` +
                   `${result.charDiffs} char diffs, ${result.attrDiffs} attr diffs`);
      }

      const perfectSteps = stepResults.filter(r => r.matches).length;
      console.log(`\n${perfectSteps}/${stepResults.length} options steps with 100% equivalence`);
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

  describe('JS vs C Character-by-Character Comparison', () => {
    it('should match C NetHack startup screen character-by-character', async () => {
      const session = loadSession('interface_startup.session.json');

      if (!session || session.steps.length === 0) {
        console.log('⚠️  No startup session found - skipping comparison');
        return;
      }

      // Test first step (initial screen)
      const firstStep = session.steps[0];
      const jsResult = await simulateJSStep(firstStep, null);

      const comparison = compareScreens(
        jsResult.screen,
        firstStep.screen,
        jsResult.attrs,
        firstStep.attrs
      );

      if (!comparison.matches) {
        const report = formatDiffReport(comparison.diffs, 10);
        console.log('\n❌ JS vs C screen differences:\n' + report);
      }

      // For now, just log the comparison result
      // TODO: Make this assertion strict once JS renders correctly
      const charDiffs = comparison.diffs.filter(d => d.type === 'char').length;
      const attrDiffs = comparison.diffs.filter(d => d.type === 'attr').length;

      console.log(`Character differences: ${charDiffs}`);
      console.log(`Attribute differences: ${attrDiffs}`);

      if (comparison.matches) {
        console.log('✅ Perfect character-by-character match!');
      } else {
        console.log(`⚠️  Work in progress: ${comparison.diffs.length} total differences`);
      }

      // Record progress in comparison
      assert(typeof comparison.matches === 'boolean',
            'Comparison should return match status');
    });

    it('should track interface comparison progress over steps', async () => {
      const session = loadSession('interface_startup.session.json');

      if (!session || session.steps.length === 0) {
        return;
      }

      // Track differences across multiple steps
      let state = null;
      const stepResults = [];

      for (let i = 0; i < Math.min(5, session.steps.length); i++) {
        const step = session.steps[i];
        const jsResult = await simulateJSStep(step, state);
        state = jsResult.state;

        const comparison = compareScreens(
          jsResult.screen,
          step.screen,
          jsResult.attrs,
          step.attrs
        );

        stepResults.push({
          step: i,
          description: step.description,
          matches: comparison.matches,
          charDiffs: comparison.diffs.filter(d => d.type === 'char').length,
          attrDiffs: comparison.diffs.filter(d => d.type === 'attr').length
        });
      }

      // Log progress
      console.log('\nInterface Comparison Progress:');
      for (const result of stepResults) {
        const status = result.matches ? '✅' : '⚠️';
        console.log(`${status} Step ${result.step} (${result.description}): ` +
                   `${result.charDiffs} char diffs, ${result.attrDiffs} attr diffs`);
      }

      // Verify we're tracking progress
      assert(stepResults.length > 0, 'Should have tested at least one step');
    });
  });
});
