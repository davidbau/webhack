# PROJECT_PLAN

## Purpose

Create an HTML/JavaScript port of C NetHack 3.7.0 ("Royal Jelly") that is 100% faithful to original gameplay and character-based display, while adding a small set of usability enhancements outside the 24x80 game screen.

The codebase should remain readable and maintainable JavaScript, and the project should be positioned for availability within days of the official NetHack 3.7.0 release.

The intended outcome is a superior but historically accurate NetHack gameplay and community experience in a web browser.

## Success Criteria

1. Gameplay is indistinguishable from official terminal NetHack 3.7.0 ("Royal Jelly"), from character creation through ascension, including all objects, maps, monsters, and interactions.
2. Core gameplay RNG behavior matches C NetHack with sequence-level fidelity in validated replay scenarios.
3. The 24x80 terminal experience matches C NetHack exactly, including:
   - screen rendering and message behavior,
   - keyboard handling and command flow,
   - menu appearance/behavior across pregame, in-game, and postgame,
   - line-drawing glyph behavior according to selected player options.
4. Testing infrastructure is both high-fidelity and high-utility:
   - validates parity for RNG, screen output, and gameplay semantics,
   - runs quickly enough for frequent iteration,
   - provides strong divergence diagnostics for realistic gameplay traces,
   - includes session-fidelity tooling (precision) and code-coverage tooling (completeness).
5. Codebase quality remains high:
   - readable and maintainable JavaScript architecture,
   - comprehensive documentation for code and workflows,
   - accurate project history and lessons-learned records.
6. Release timing supports publication within days of official NetHack 3.7.0 release.

## Secondary Goals

1. Build a state-of-the-art JavaScript self-play agent that behaves in a humanlike way:
   - explores effectively,
   - handles combat and survival,
   - manages hunger,
   - identifies, collects, and uses useful items,
   - progresses through dungeon exploration and advancement.
2. Use the self-play agent for two concrete product purposes:
   - generate C NetHack gameplay traces to support parity testing workflows,
   - provide a post-game demonstration mode shown after the player answers "no" to "play again" (any key or click returns to normal game launch flow).
3. Provide browser-side companion materials outside the 80x24 play area:
   - quick reference aids (for example, reference cards and running inventory views),
   - in-browser reading/scrolling access to Guidebook, Spoilers, and game history during play.
4. Produce and validate a new WCST-style Spoilers manual that preserves gameplay accuracy for NetHack 3.7.0 while consolidating high-quality strategy guidance.

## Non-Goals

1. Graphical tile rendering systems are out of scope for initial release.
2. Multiplayer features are out of scope for initial release.
3. Public modding/plugin API design is out of scope for initial release.
4. Mobile-specific UI/UX redesign is out of scope for initial release.
5. New gameplay or balance behavior beyond faithful NetHack 3.7.0 parity is out of scope.
6. Alternate control paradigms (for example mouse-first or gamepad-first control schemes) are out of scope.
7. New game content systems (new roles, monsters, branches, quests) are out of scope.
8. Account/cloud platform features (profiles, cloud saves, social systems) are out of scope.
9. Large architectural/framework rewrites not required for parity or release readiness are out of scope.

## Milestones

Milestones use a hybrid model: phase completion + parity gates + release-timing gates.

1. Phase 0 complete: rough playable faithful draft
   - Browser port launches and supports basic level-1 gameplay.
   - Initial implementation attempts C-faithful behavior.
2. Phase 1 complete: testing infrastructure foundation
   - Session recording/replay infrastructure exists for gameplay sessions, UI interactions, and map sessions.
   - Fast strict session tests exist and intentionally expose many fidelity failures.
3. Phase 2 active: testing burndown
   - Port C logic into JS to drive session tests toward green across semantics, PRNG, typgrid, and screen parity.
4. Phase 3 planned: full-coverage closure
   - Maintain C-to-JS audit table (file-by-file and function-by-function mapping).
   - Run and maintain JS code-coverage tooling to identify unexercised codepaths.
   - Build targeted sessions to drive coverage toward 100% and debug residual parity gaps.
5. Phase 4 planned: architectural stabilization
   - Refactor for robustness, readability, maintainability, performance, and design quality while preserving parity.
6. Phase 5 parallel track (running across Phases 2/3/4): self-play agent development
   - Improve agent depth and breadth of play.
   - Use agent output for trace generation and demonstration-mode requirements.
7. Phase 6 planned: HTML/JS surrounding experience
   - Improve JavaScript/browser packaging and surrounding UX through collaborative iteration with human designers.
   - Deliver help and assistance outside the 80x24 core game area (for example quick-reference guidance for beginners, contextual "what is this" support, running inventory views, and related aids).
   - Provide demonstration autoplay when the user is not actively playing (for example after game over or between games).
   - Provide up-to-date spoilers for 3.7.0 in a witty, high-quality style, plus an integrated reading experience that includes NetHack history, the official Guidebook, and updated spoilers without disrupting core gameplay.
8. Official-release trigger milestone (external date)
   - When official NetHack 3.7.0 releases, switch to final release mode immediately.
   - Freeze scope to must-hit parity and release-critical fixes.
   - Treat official release as a mandatory parity re-baseline event:
     - regenerate/refresh reference sessions and test artifacts against official code,
     - audit upstream code diffs and map each change through the C-to-JS correspondence table,
     - use coverage-guided targeted sessions to verify changed paths are exercised and corrected.
9. Public release milestone
   - Publish within 1-2 days of official NetHack 3.7.0 release with must-hit criteria satisfied.

## Phasing Strategy

1. Treat parity failures as the primary prioritization signal.
2. Port behavior from C source directly rather than fitting to traces with JS-only heuristics.
3. Keep Phase 5 (self-play) in parallel so it accelerates trace generation and demonstration requirements without blocking parity burndown.
4. Keep scope narrow near official-release trigger: prioritize must-hit criteria and release blockers over secondary expansion.
5. Preserve fast, diagnostic-rich test loops throughout all phases.

## Risks and Mitigations

1. Risk: latent parity drift in rare paths not yet exercised in current sessions.
   - Mitigation:
   - maintain and expand the C-to-JS audit map (file/function correspondence),
   - maintain resilient, fast, high-coverage targeted sessions for uncovered or low-confidence logic.
2. Risk: detailed parity work surfaces probable bugs in official C NetHack.
   - Mitigation:
   - document findings with precise repro steps, expected/actual behavior, and reasoning,
   - keep reports concise and developer-actionable,
   - submit to official NetHack dev team when evidence is strong.

## Working Principles

1. C NetHack source is the behavior specification.
   - Use traces/tests to detect divergence, but resolve behavior by porting C logic paths.
2. Prioritize by first meaningful divergence.
   - Use failing unit/session tests to decide what to fix next.
   - Keep work incremental and re-test frequently.
3. Reduce harness gameplay awareness over time.
   - Replay/session harnesses should drive inputs and compare outputs, not emulate gameplay rules.
   - Long-term target: no gameplay semantics in harness code.
4. Keep one source of runtime truth.
   - Core game/runtime code should own command/turn/prompt behavior.
   - Avoid duplicate behavior implementations across game and test layers.
5. Keep fidelity checks strict and lossless.
   - Never relax PRNG, typgrid, or screen checks to gain speed.
   - Optimize diagnostics and plumbing, not semantic rigor.
6. Make debugging fast and actionable.
   - Preserve first-divergence reporting with enough context to diagnose quickly.
   - Prefer simple, auditable tools and data flow.
7. Use evidence-driven infrastructure changes.
   - Add new tracing/instrumentation only when divergence evidence shows it is needed.
   - Avoid broad infrastructure expansion without demonstrated payoff.
8. Preserve 24x80 fidelity; place enhancements outside core play.
   - Core terminal gameplay behavior remains historically accurate.
   - Browser UX enhancements should not alter canonical in-screen behavior.
9. Maintain explicit auditability.
   - Keep C↔JS correspondence documentation current.
   - Track coverage and close uncovered paths with targeted sessions.
10. Share progress continuously with quality gates.
    - Commit and push meaningful, test-backed improvements frequently.
    - Keep mainline collaboration-friendly for parallel contributors.
11. Operate agents autonomously with strict regression discipline.
    - Commit frequently and merge from main frequently to reduce integration drift.
    - Use tests as a hard regression gate before pushing shared branches/mainline changes.
    - If merges introduce regressions, fix regressions before push.
    - If clean integration cannot be achieved without regressions, abandon that patch line and restart from the newer checkpoint rather than pushing degraded behavior.
12. Handle upstream transitions as execution mode changes.
    - On official 3.7.0 release, re-baseline quickly and focus only on release-critical parity closure.
13. Report probable upstream bugs responsibly.
    - Document concise repro steps and reasoning before reporting to the official NetHack dev team.
