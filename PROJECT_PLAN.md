# PROJECT PLAN

## Background

> *"Never build a dungeon you wouldn't be happy to spend the night in yourself."*
> — Terry Pratchett, quoted in the NetHack 3.6.0 release notes

NetHack is the greatest game most people have never heard of. First released on July 28, 1987, it is a single-player dungeon exploration game in which a character descends through procedurally generated levels, fights monsters, solves puzzles, and ultimately retrieves the Amulet of Yendor from the depths of Gehennom to offer it to their deity and achieve ascension. The game runs in a terminal. The hero is an `@` sign. A newt is a `:`. A dragon is a `D`. The entire world—objects, monsters, traps, terrain—is rendered in 24 lines of 80 columns of text characters. It is arguably the most complex and deeply interactive single-player game ever created, with interaction rules so thorough that the community's highest compliment is: *"The DevTeam thinks of everything."*

NetHack is maintained by a secretive volunteer group known simply as the DevTeam, whose release schedule is governed by a single policy: *"When it's ready."* They mean it. After releasing version 3.4.3 in December 2003, the DevTeam went silent for **twelve years**. During that gap, the community created dozens of fan variants, the NetHack Wiki ran humorous "next version pools" where fans bet on the release date, and a leak of work-in-progress code in 2014 fueled a fresh round of speculation. Then, in December 2015, NetHack 3.6.0 appeared—focused on infrastructure modernization rather than gameplay changes.

The 3.6.x series continued through 3.6.7 (February 2023, a security patch), but the real action has been happening on the 3.7 development branch. NetHack 3.7.0 represents the most ambitious set of gameplay changes in the game's 38-year history: a Gehennom overhaul, themed rooms, four new monsters including the dreaded genetic engineer (who polymorphs you and teleports away), dragon scale mail granting two extrinsics instead of one, nerfed unicorn horns (a meta-shattering shock to a generation of players who kept one in every kit), mirrored special levels, and much more.

As of early 2026, 3.7.0 remains unreleased. The DevTeam's README warns: *"Don't treat NetHack-3.7 branch as released code."* The community plays it on the Hardfought server. Variants have already forked from it. Prediction markets give it roughly even odds of shipping this year. Everyone waits. The DevTeam thinks of everything—except telling you when.

## Motivation

This project exists at the intersection of two unlikely forces.

The first is the pending release of NetHack 3.7.0. Whenever the DevTeam finally ships it, there will be a moment of intense community excitement—players who haven't thought about NetHack in years coming back to see what changed, newcomers drawn in by the buzz, and a brief window in which the world's attention turns to the Mazes of Menace. That window is an opportunity to offer the community a high-quality way to play instantly in any browser, with no installation, no configuration, and no `.nethackrc` to debug.

The second is the rise of AI-assisted software development. In February 2025, Andrej Karpathy coined the term **"vibe coding"** to describe a new way of working: describe what you want to an AI, accept its code without reading the diffs, paste error messages back when things break, and see what happens. *"I 'Accept All' always,"* he wrote. *"I don't read the diffs anymore."* The idea went viral, became Collins Dictionary's Word of the Year, and by early 2026 had matured into what Karpathy now calls **"agentic engineering"**—the same core approach, but with more structure, more oversight, and the recognition that orchestrating AI agents to produce real software is itself *"an art and science and expertise."*

This project is a test of that proposition at scale. Can AI agents, directed by a human who understands the game deeply, produce a faithful port of one of the most complex single-player codebases in gaming history? Not a toy demo or a weekend throwaway, but a real, playable, parity-correct reimplementation—tens of thousands of lines of readable JavaScript that match NetHack's behavior down to the random number generator, ready to ship the day the official release drops?

We believe the answer is yes. But the Amulet of Yendor is not retrieved by believing. It is retrieved by careful, systematic descent through every level of the dungeon, one step at a time. You bring a light source. You check for traps. You test unidentified potions on your pet before drinking them yourself. This document is the light source.

## Purpose

Create **Royal Jelly,** an HTML/JavaScript port of C NetHack 3.7.0 that is 100% faithful to original gameplay and character-based display, while adding a small set of usability enhancements outside the 24×80 game screen. The codename refers to this project—the vibe-coded JS port—not to the official 3.7.0 release itself, which has no codename.

The codebase should remain readable and maintainable JavaScript—not compiled or transpiled from C, but hand-ported so that every function can be read and understood alongside the original source. The project should be positioned for publication within days of the official NetHack 3.7.0 release.

The intended outcome is a superior but historically accurate NetHack gameplay and community experience in a web browser.

## Success Criteria

1. Gameplay is indistinguishable from official terminal NetHack 3.7.0, from character creation through ascension, including all objects, maps, monsters, and interactions.
2. Core gameplay RNG behavior matches C NetHack with sequence-level fidelity in validated replay scenarios.
3. The 24×80 terminal experience matches C NetHack exactly, including:
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
   - manages hunger (a matter of life and death, as any Valkyrie who starved on dungeon level 3 can attest),
   - identifies, collects, and uses useful items,
   - progresses through dungeon exploration and advancement.
2. Use the self-play agent for two concrete product purposes:
   - generate C NetHack gameplay traces to support parity testing workflows,
   - provide a post-game demonstration mode shown after the player answers "no" to "play again?" (any key or click returns to normal game launch flow).
3. Provide browser-side companion materials outside the 80×24 play area:
   - quick reference aids (reference cards and running inventory views, for players who can never remember whether `q` quaffs or `Q` quivers),
   - in-browser reading/scrolling access to Guidebook, Spoilers, and game history during play.
4. Produce and validate a new WCST-style Spoilers manual that preserves gameplay accuracy for NetHack 3.7.0 while consolidating high-quality strategy guidance in a voice worthy of the game.

## Non-Goals

> *Like the Oracle, we must know what questions not to answer.*

1. Graphical tile rendering is out of scope. The `@` sign has looked fine since 1987.
2. Multiplayer features are out of scope.
3. Public modding/plugin API design is out of scope.
4. Mobile-specific UI/UX redesign is out of scope.
5. New gameplay or balance changes beyond faithful 3.7.0 parity are out of scope. We port the dungeon; we do not redesign it.
6. Alternate control paradigms (mouse-first, gamepad-first) are out of scope.
7. New game content (new roles, monsters, branches, quests) are out of scope.
8. Account/cloud platform features (profiles, cloud saves, social systems) are out of scope.
9. Large architectural rewrites not required for parity or release readiness are out of scope.

## Milestones

Milestones use a hybrid model: phase completion + parity gates + release-timing gates.

1. **Phase 0: Rough playable draft**
   - Browser port launches and supports basic level-1 gameplay.
   - Initial implementation attempts C-faithful behavior.
2. **Phase 1: Testing infrastructure foundation**
   - Session recording/replay infrastructure exists for gameplay sessions, UI interactions, and map sessions.
   - Fast strict session tests exist and intentionally expose many fidelity failures.
3. **Phase 2: Testing burndown** *(active)*
   - Port C logic into JS to drive session tests toward green across semantics, PRNG, typgrid, and screen parity.
4. **Phase 3: Full-coverage closure** *(planned)*
   - Maintain C-to-JS audit table (file-by-file and function-by-function mapping).
   - Run and maintain JS code-coverage tooling to identify unexercised codepaths.
   - Build targeted sessions to drive coverage toward 100% and debug residual parity gaps.
5. **Phase 4: Architectural stabilization** *(planned)*
   - Refactor for robustness, readability, maintainability, performance, and design quality while preserving parity.
6. **Phase 5: Self-play agent** *(parallel track, running across Phases 2–4)*
   - Improve agent depth and breadth of play.
   - Use agent output for trace generation and demonstration-mode requirements.
7. **Phase 6: Surrounding experience** *(planned)*
   - Improve JavaScript/browser packaging and surrounding UX through collaborative iteration with human designers.
   - Deliver help and assistance outside the 80×24 core game area (quick-reference guidance for beginners, contextual "what is this?" support, running inventory views).
   - Provide demonstration autoplay when the user is not actively playing.
   - Provide up-to-date 3.7.0 spoilers in a witty, high-quality style, plus an integrated reading experience including NetHack history, the official Guidebook, and updated spoilers—without disrupting core gameplay.
8. **Official-release trigger** *(external date)*
   - When official NetHack 3.7.0 releases, switch to final release mode immediately.
   - Freeze scope to must-hit parity and release-critical fixes.
   - Treat official release as a mandatory parity re-baseline event:
     - regenerate/refresh reference sessions and test artifacts against official code,
     - audit upstream code diffs and map each change through the C-to-JS correspondence table,
     - use coverage-guided targeted sessions to verify changed paths are exercised and corrected.
9. **Public release**
   - Publish within 1–2 days of official NetHack 3.7.0 release with must-hit criteria satisfied.

## Phasing Strategy

1. Treat parity failures as the primary prioritization signal.
2. Port behavior from C source directly rather than fitting to traces with JS-only heuristics.
3. Keep Phase 5 (self-play) in parallel so it accelerates trace generation and demonstration requirements without blocking parity burndown.
4. Keep scope narrow near official-release trigger: prioritize must-hit criteria and release blockers over secondary expansion.
5. Preserve fast, diagnostic-rich test loops throughout all phases.

## Risks and Mitigations

1. **Latent parity drift in rare paths not yet exercised.**
   Many of NetHack's deepest interactions involve rare events—polymorphed quest leaders, artifact theft while engulfed, riding a steed over a polymorph trap. Paths like these are easy to miss and hard to test.
   - *Mitigation:* Maintain and expand the C-to-JS audit map (file/function correspondence). Maintain resilient, fast, high-coverage targeted sessions for uncovered or low-confidence logic.

2. **Parity work surfaces probable bugs in official C NetHack.**
   When you port 200,000 lines of C at the level of individual RNG calls, you find things. Some of them are bugs upstream.
   - *Mitigation:* Document findings with precise repro steps, expected/actual behavior, and reasoning. Keep reports concise and developer-actionable. Submit to official NetHack dev team when evidence is strong. A good bug report is a gift; a vague one is a wasted wish.

3. **The DevTeam ships before we're ready.**
   The official release date is unknowable by design. We might get a week's warning. We might get none.
   - *Mitigation:* Continuous tracking of the 3.7 development branch. Release-trigger milestone designed for rapid re-baselining. Keep the project in a "could ship in 48 hours" posture at all times.

4. **AI agent limitations produce subtle correctness failures.**
   Agentic engineering works until it doesn't. AI agents can produce plausible-looking code that passes tests but diverges from C behavior in edge cases the tests don't cover.
   - *Mitigation:* Strict parity testing discipline. Human review of all critical game logic. Working principle: trust the C source, not the AI's intuition.

## Working Principles

> *You read the fortune cookie. It says:*

1. **C NetHack source is the behavior specification.**
   Use traces and tests to detect divergence, but resolve behavior by porting C logic paths. When in doubt, read the C.

2. **Prioritize by first meaningful divergence.**
   Use failing unit/session tests to decide what to fix next. Keep work incremental and re-test frequently. Fix the first wrong thing first.

3. **Reduce harness gameplay awareness over time.**
   Replay/session harnesses should drive inputs and compare outputs, not emulate gameplay rules. Long-term target: no gameplay semantics in harness code.

4. **Keep one source of runtime truth.**
   Core game/runtime code should own command/turn/prompt behavior. Avoid duplicate behavior implementations across game and test layers. Two sources of truth is zero sources of truth.

5. **Keep fidelity checks strict and lossless.**
   Never relax PRNG, typgrid, or screen checks to gain speed. Optimize diagnostics and plumbing, not semantic rigor. A passing test that doesn't check what it claims to check is worse than a failing one.

6. **Make debugging fast and actionable.**
   Preserve first-divergence reporting with enough context to diagnose quickly. Prefer simple, auditable tools and data flow. When the trail goes cold, add instrumentation—but only the instrumentation you need.

7. **Use evidence-driven infrastructure changes.**
   Add new tracing or instrumentation only when divergence evidence shows it is needed. Avoid broad infrastructure expansion without demonstrated payoff. Yak-shaving is the cockatrice of engineering projects: it looks harmless until you're stone dead.

8. **Preserve 24×80 fidelity; place enhancements outside core play.**
   Core terminal gameplay behavior remains historically accurate. Browser UX enhancements must not alter canonical in-screen behavior. The game inside the rectangle is sacred.

9. **Maintain explicit auditability.**
   Keep C↔JS correspondence documentation current. Track coverage and close uncovered paths with targeted sessions. If you can't explain why the JS does what it does by pointing at the C, something is wrong.

10. **Share progress continuously with quality gates.**
    Commit and push meaningful, test-backed improvements frequently. Keep mainline collaboration-friendly for parallel contributors.

11. **Operate agents autonomously with strict regression discipline.**
    Commit frequently and merge from main frequently to reduce integration drift. Use tests as a hard regression gate before pushing. If merges introduce regressions, fix them before push. If clean integration cannot be achieved, abandon that patch line and restart from the newer checkpoint rather than pushing degraded behavior. Time saved by pushing broken code is borrowed at ruinous interest.

12. **Handle upstream transitions as execution mode changes.**
    On official 3.7.0 release, re-baseline quickly and focus only on release-critical parity closure. This is the Astral Plane: scope narrows, intensity increases, every move matters.

13. **Report probable upstream bugs responsibly.**
    Document concise repro steps and reasoning before reporting to the official NetHack dev team.

## Issue Tracking Workflow

1. Declare dependencies explicitly in issues.
   - Use `Blocked by #<issue>` for prerequisites.
   - Use `Blocks #<issue>` for downstream work.
2. Track dependency state in project workflow.
   - Use status values `Ready`, `Blocked`, `In Progress`, `Done`.
3. Use parent/child issue structure for larger outcomes.
   - Parent issue defines the outcome.
   - Child issues define concrete implementation/test/documentation tasks.
   - Parent issue checklist links all child issues.
4. Enforce execution discipline.
   - Default rule: do not start an issue while declared blockers are open.
   - Exception: if a blocker link is stale or incorrect, opportunistic work is allowed; update the dependency links as part of that work.
5. Keep issue tracking clean and current.
   - Perform periodic triage reviews of open issues.
   - Close obsolete or canceled issues explicitly with a short rationale.
   - Update issue descriptions promptly when new evidence changes scope, root cause, or priority.
6. Keep agents issue-driven and autonomous.
   - If no work is pending, pull the next actionable issue.
   - If starting new work not covered by an issue, create one before or at start.
   - Agent identity is directory-based (directory name defines agent name).
   - Track active agent ownership with agent labels in issues.
