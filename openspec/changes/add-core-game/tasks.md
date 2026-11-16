# Tasks

## 1. Project scaffolding and app shell

- [x] 1.1 Create `package.json` (type: module, scripts `test` = `node --test`, `start` = static server bound to `0.0.0.0` so a phone on the same network can open it), `.gitignore`, and the `src/core`, `src/input`, `src/render`, `src/ui`, `src/audio`, `test` folders; verify `npm test` runs without error
- [x] 1.2 Create `index.html` with the mobile viewport meta (`viewport-fit=cover`), black edge-to-edge background, gesture-blocking CSS (no scroll, zoom, pull-to-refresh, text selection, long-press menu), a canvas and a DOM overlay for buttons; verify in Playwright iPhone emulation that double-tap and swipes neither zoom nor scroll the page
- [x] 1.3 Implement `src/ui/layout.js` (fit 448×576 into the safe-area-reduced visual viewport; portrait vs landscape/desktop placement; DPR-sized canvas, capped at 3; recompute on resize/rotation); verify with Playwright screenshots at 320×568, 390×844 portrait, 844×390 landscape and 1440×900 that the playfield fits, keeps its ratio and is sharp

## 2. Maze board

- [x] 2.1 Add `constants.js` (grid sizes, HUD rows, tile ids, directions, units per tile, swipe threshold) and `rng.js` (seeded PRNG); verify with a test that the same seed gives the same sequence
- [x] 2.2 Write the original 28×31 layout in `mazeData.js` and a parser in `maze.js` (tile queries, walkability per entity state, tunnel wrap); verify with tests for wall/Forge/door walkability and tunnel wrap on both edges
- [x] 2.3 Implement `validateLayout()` (symmetry, connectivity from `P`, no dead ends, 4 cores, spark+core total 220–260) and verify the layout passes it in a test
- [x] 2.4 Render the maze (glowing walls pre-rendered to an offscreen canvas per level and per resize, level-based color); verify by hand that the maze sits in rows 3–33 and recolors per level

## 3. Player movement and input

- [x] 3.1 Implement shared sub-tile movement in `movement.js` (move toward center, split steps at centers, wall stop, tunnel wrap); verify with tests that entities stop at walls, never skip tiles and wrap correctly
- [x] 3.2 Implement `player.js`: continuous motion, instant reversal, perpendicular turns at centers, 0.5 s input buffer; verify tests for early turn, buffer expiry, replacement by newer input and mid-tile reversal
- [x] 3.3 Implement the pure swipe recogniser `swipe.js` (20 px threshold, dominant axis, mid-swipe registration, anchor reset for chained turns); verify tests for the swipe-left, tiny-movement and L-shaped-drag scenarios
- [x] 3.4 Implement `touch.js` (Pointer Events on the game surface, first pointer only, ignore touches that start on buttons) and `keyboard.js` (arrows + WASD, preventDefault), both feeding one `setIntent`; verify a test that the same timed directions via swipe paths and via keys give the same path, and verify in Playwright touch emulation that swiping steers Nib
- [x] 3.5 Implement the fixed-timestep loop in `main.js`; verify a test that Nib covers the same distance over the same game time with 30 vs 144 fps render pacing
- [x] 3.6 Render Nib (hex drone with directional visor); verify by hand the visor tracks direction

## 4. Collectibles and scoring

- [x] 4.1 Implement spark/core placement and eating in `game.js` with score and event output; verify tests: fresh level fully stocked with excluded tiles empty, spark +10, core +50
- [x] 4.2 Implement the catch combo (200/400/800/1600, reset on new core) and the extra life at 10,000 (once only); verify tests for both scenarios in the collectibles-scoring spec
- [x] 4.3 Implement bonus pickups (spawn at 70 and 170 eaten, 9–10 s lifetime, level-based value from `levels.js`); verify tests for collect and expire, and verify by hand the floating score text

## 5. Enemy AI

- [x] 5.1 Implement targeting functions for Scatter corners and Rook, Lure, Splice and Skitter chase rules; verify a test for every targeting scenario in the enemy-ai spec, including the exact tile examples
- [x] 5.2 Implement the intersection decision rule (no reversal, no walls/door, closest straight-line distance, tie order up/left/down/right); verify tests for closest-direction choice and no voluntary reversal
- [x] 5.3 Implement the Scatter/Chase schedule with forced reversal on mode switch and pause during Overload; verify tests for the 7 s switch and the Overload-paused timeline example
- [x] 5.4 Implement Forge release (Rook outside, release order, per-Glitch spark thresholds, idle timer) and the Forge exit routine; verify tests for release order and idle release
- [x] 5.5 Implement Overload (reverse, slow down, seeded random choices, warning flash in last 2 s, length from level table) and caught fragments returning to and leaving the Forge; verify tests for seeded wandering, the flash window and full return-and-respawn
- [x] 5.6 Apply per-level/per-state speeds including tunnel slowdown and 200% fragments; verify a test that a Glitch is slower in the tunnel than in a corridor
- [x] 5.7 Render Glitches (four shapes/colors with heading dot, Overloaded pale flicker, warning flash, fragment); verify by hand on a phone-sized screen that each state is distinct and readable

## 6. Game flow, HUD and touch UI

- [x] 6.1 Implement the game state machine (start → READY → playing → catch pause / life lost / level clear → game over → start); verify tests for life loss with sparks kept, level clear refill, game over on last life, and the 1-second input lock on GAME OVER
- [x] 6.2 Implement collision detection including tile swapping (with tunnel wrap); verify tests for same-tile and swap collisions, including at the tunnel edge
- [x] 6.3 Implement difficulty progression from `levels.js`; verify a test that walks levels 1–21 and checks the progression rule and zero Overload from level 21
- [x] 6.4 Implement pause (button, P/Escape) with Resume/Quit and a 3-second resume countdown, plus a determinism test running two seeded simulations with identical inputs; verify both tests pass and that no timer advances while paused or counting down
- [x] 6.5 Implement `storage.js` and the canvas HUD (score, high score with live update and persistence, reserve-life icons, level number and bonus icons); verify tests for high score save/load and blocked storage, and verify at 320 px width that HUD text is at least 10 CSS px and does not overlap
- [x] 6.6 Implement the DOM touch UI: pause, sound and settings buttons (≥ 44×44 CSS px, inside safe areas, touch and click), the settings panel (sound, D-pad toggles, saved), and the D-pad (≥ 56 px arrows, pointerdown, placed below the maze in portrait and beside it in landscape); verify in Playwright that button sizes meet the minimums, nothing overlaps the maze, and settings persist after reload
- [x] 6.7 Draw the start screen (title, Glitch roster, device-appropriate controls hint, tap to start), READY, PAUSED, GAME OVER and level-clear flash; verify by hand each screen appears at the right time on phone and desktop

## 7. Sound and haptics

- [ ] 7.1 Implement `sfx.js` with AudioContext creation on the first pointer/key event, `resume()` after every pause/background return, guarded calls, and synthesized effects for every event in the sound-and-haptics spec (alternating spark blip); verify by hand on an iPhone that sound starts on the first tap and works again after locking and unlocking, and that no audio files are requested
- [ ] 7.2 Implement the Overload ambience loop, haptic patterns via feature-detected `navigator.vibrate`, and the sound toggle (button, settings, M key; saved; muted indicator; also disables vibration); verify by hand on Android that vibration fires on life lost and stops when muted, and a test that the game runs with `AudioContext` and `vibrate` absent

## 8. Lifecycle, install and offline

- [x] 8.1 Implement lifecycle handling (pause, stop the loop and suspend audio on `visibilitychange`/`pagehide`; stay paused on return; re-run layout on `pageshow`); verify in Playwright that hiding the page pauses the game and no game time passes while hidden
- [x] 8.2 Add `manifest.webmanifest`, original app icons (192, 512, maskable) and iOS home-screen meta tags; verify Chrome's Application panel reports the manifest as installable and the icon shows correctly
- [x] 8.3 Implement `sw.js` (versioned precache of all game files, cache first, old caches removed on activate, new version used by the second launch) with registration skipped on localhost unless a flag is set; verify in Playwright with the network set offline after one visit that the game loads and plays

## 9. Integration checks

- [x] 9.1 Write `README.md` (how to run, how to open on a phone on the same network, how to install, controls, how to test, manual device checklist); verify the documented commands work as written
- [ ] 9.2 Play through at least two full levels and a game over on a real iPhone (Safari, installed to home screen) and a real Android phone (Chrome) using the checklist, including steady ~60 fps during Overload; verify `npm test` and `openspec validate add-core-game --strict` both pass

## Workflow follow-up

- Archive the change with `openspec archive add-core-game` once implementation is reviewed, so the specs move into `openspec/specs/`.
- Verify the archived specs with `openspec validate --specs --strict`.
