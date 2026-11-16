# Proposal

## Why

We want an original arcade maze-chase game that people play mainly on their phones, built spec-first so each mechanic has a written, testable contract before code exists. This first change defines a complete playable loop (maze, player, collectibles, four enemy personalities, lives and levels) designed for touchscreens in portrait first, while still playable with a keyboard on desktop.

The game takes inspiration from the classic dot-eating maze genre but has its own identity. **Neon Nibbler** stars *Nib*, a small glowing drone, collecting *sparks* in a neon circuit maze while four rogue *Glitch* drones (Rook, Lure, Splice and Skitter) hunt it. It does not reuse any existing game's name, characters, maze layout, art or sounds.

## What Changes

- New static web game (HTML5 Canvas + vanilla JS ES modules, no build step), **mobile first**: designed for phone touchscreens in portrait, also working in landscape and on desktop.
- Installable to the home screen as a full-screen web app (PWA) that plays offline after the first visit.
- Touch controls: swipe anywhere to steer, with the direction taken mid-swipe, and an optional on-screen D-pad that can be turned on in settings. Arrow keys and WASD still work on desktop. All inputs feed the same buffered-turn system.
- Phone-friendly screen handling: fills the screen inside notches and system bars, never scrolls, zooms or pull-to-refreshes during play, and pauses automatically when the app goes to the background.
- An original 28×31 tile maze inside a 28×36 tile playfield (3 HUD rows on top, 2 on the bottom), with a horizontal wrap tunnel and a central enemy home called *the Forge*.
- Sparks (10 pts) and 4 Surge Cores (50 pts). Eating a core makes the Glitches *Overloaded* (vulnerable) for a limited time, and catching them scores 200 → 400 → 800 → 1600.
- Four Glitch enemies that switch between Scatter, Chase and Overloaded on a timer, each with its own targeting rule (direct, ambush, flank, shy).
- Bonus pickups, an extra life at 10,000 points, 3 starting lives, level progression with rising difficulty, and a game over.
- HUD with score, saved high score, lives and level, plus large touch buttons for pause, sound and settings.
- Retro sound effects synthesized with the Web Audio API, and short vibrations on key events on devices that support it, both controlled by one sound toggle.
- A headless test suite for game logic using Node's built-in test runner.

## Capabilities

### New Capabilities
- `app-shell`: How the game fits and behaves on a device: viewport fitting and scaling, orientation, safe areas, blocking page gestures during play, app lifecycle, install and offline play, and frame-rate targets.
- `maze-board`: The tile grid, playfield layout, maze layout rules, walls, the wrap tunnel and the enemy home.
- `player-movement`: How Nib moves through the maze: swipe, D-pad and keyboard input, grid-aligned motion, input buffering, wall blocking and tunnel wrapping.
- `collectibles-scoring`: Sparks, Surge Cores, bonus pickups, point values, the enemy-catch combo and extra lives.
- `enemy-ai`: Glitch release from the Forge, the Scatter/Chase schedule, per-enemy targeting, Overloaded behaviour, returning home after being caught, and speeds.
- `game-flow`: Start screen, round start, collisions and life loss, level completion and progression, pause, and game over.
- `hud`: On-screen score, high score saving, lives and level indicators, and the touch buttons for pause, sound and settings.
- `sound-and-haptics`: Synthesized sound effects, vibration feedback, unlocking audio on first touch, and the sound toggle.

### Modified Capabilities
- None. This is the first change in the project.

## Impact

- New project files: `index.html`, `manifest.webmanifest`, `sw.js` (offline cache), app icons, `src/` (core logic, rendering, input, UI, audio), `test/`, and a minimal `package.json` that only holds scripts for `node --test` and a static server.
- No runtime dependencies. Development needs Node 18 or newer for tests. Installing as an app needs HTTPS hosting; local testing on a phone needs the dev server reachable on the local network.
- Uses browser `localStorage` (high score, settings), the Web Audio API, the Vibration API where available, and a service worker.
- Must be checked by hand on a real iPhone (Safari) and Android phone (Chrome).
