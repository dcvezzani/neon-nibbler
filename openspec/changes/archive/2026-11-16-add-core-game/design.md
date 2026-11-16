# Design

## Context

This is a new project with no code yet. See proposal.md for motivation and the specs under `specs/` for required behaviour. Constraints: mobile first (iOS Safari and Android Chrome, portrait first), desktop keyboard play still supported, vanilla JS ES modules, no build step, no runtime dependencies, and game logic testable in Node without a DOM.

## Goals / Non-Goals

**Goals:**
- Keep pure simulation (no DOM, no canvas, no audio) separate from presentation, so every spec scenario about rules can be tested headlessly.
- Make the simulation deterministic (fixed step, seeded RNG) so tests and replays are repeatable.
- Make touch input feel immediate: directions register mid-swipe and feed the same buffered-turn logic as keys.
- Keep frame time low on mid-range phones: pre-rendered maze, few draw calls per frame, no per-frame allocations in the hot loop.
- Keep all tunable numbers (speeds, timers, values, swipe threshold) in one place.

**Non-Goals:**
- Gamepad controls, tilt controls, multiple mazes, two-player mode, intermission animations, online leaderboards. These can come in later changes.
- Native app store builds. The game is installed as a web app.
- Copying any existing arcade game's exact timings or quirks (such as known overflow bugs or no-turn zones).

## Decisions

### D1. Module layout

```
index.html              viewport meta, canvas, UI overlay, <script type="module" src="src/main.js">
manifest.webmanifest    name, icons, display: fullscreen/standalone, orientation: portrait
sw.js                   service worker: versioned precache of all game files
icons/                  app icons (192, 512, maskable) drawn for this game
src/core/               pure logic, no DOM. Imported by both the browser and tests
  constants.js          grid size, tile ids, directions, units per tile, swipe threshold
  maze.js               parse layout strings, tile queries, tunnel wrap, layout checks
  mazeData.js           the original 28x31 layout as an array of strings
  levels.js             per-level table: speeds, Overload time, bonus kind/value
  rng.js                small seeded PRNG (mulberry32)
  movement.js           shared tile/sub-tile movement for player and enemies
  player.js             input buffer, turning, reversal
  enemies.js            targeting, decisions, mode schedule, Forge release, return home
  game.js               top-level state machine, scoring, collisions, events list
  swipe.js              pure swipe recogniser (points in -> directions out), unit-testable
src/input/              keyboard.js, touch.js (pointer events -> swipe.js), dpad.js
src/render/             canvas drawing (maze, entities, HUD, screens)
src/ui/                 layout.js (fit + safe areas + orientation), buttons, settings panel
src/audio/sfx.js        Web Audio synthesis + vibration, subscribes to game events
src/storage.js          try/catch wrappers around localStorage (high score, settings)
src/main.js             wiring, lifecycle, requestAnimationFrame loop
test/*.test.js          node --test
```

Alternative considered: a single HTML file (as in the seed prompt). We chose separate modules because tests need to import logic without a browser, and one large file is hard to review against specs.

### D2. Fixed-timestep simulation with event output

`game.step(inputIntent)` advances exactly 1/60 s. `main.js` uses an accumulator: it runs as many steps as the real time elapsed calls for (capped at 5 per frame to avoid a runaway), then renders. On 90/120 Hz phones this means some frames render without a new step; render interpolation is not needed at these speeds. `step` appends **events** (`sparkEaten`, `coreEaten`, `glitchCaught`, `lifeLost`, `levelCleared`, ...) to a queue that audio, haptics and the floating-score renderer read.

### D3. Position representation

Positions are stored in integer **sub-pixel units**: 1 tile = 16 px, and each px is split into 16 units, so 1 tile = 256 units. Speeds are units per step. Integer math avoids float drift that breaks "exactly at tile center" checks and keeps determinism. Because the top speed (returning fragments at 200%, about 64 units or 1/4 tile per step; see D6) is well under 1 tile per step, an entity can never skip a tile. When a step would carry it past a center, movement is split: move to the center, make the decision, then spend the rest of the step's distance in the new direction.

Alternative: float tile coordinates with an epsilon. Rejected because of drift and harder-to-reproduce tests.

### D4. Input: one intent stream from three sources

- **Swipe** (`touch.js` + `swipe.js`): uses Pointer Events on the full-screen game surface (with `touch-action: none`), tracking only the first active pointer. When the pointer has moved ≥ 20 CSS px from its anchor, the dominant axis gives a direction, an intent is emitted, and the anchor resets to the current point so the same finger can chain turns. Pointers that start on a button are ignored by the swipe recogniser. `swipe.js` is pure (takes points, returns directions), so thresholds and chaining are unit-tested.
- **D-pad** (`dpad.js`): four DOM buttons emitting intents on `pointerdown`. Off by default; setting saved.
- **Keyboard** (`keyboard.js`): arrows and WASD with `preventDefault`.

All three call one `setIntent(dir)` that timestamps the intent in game time. Every step: if the intent is opposite to the current direction, reverse right away. Otherwise, if it is perpendicular and Nib is at (or crosses) a tile center where that direction is open, turn there. The intent is cleared once taken, replaced, or after 30 steps (0.5 s). Swipes are naturally "early", so the buffer is what makes swipe play feel forgiving.

Alternative considered: a virtual joystick. Rejected because maze games need discrete 4-way turns and a joystick drifts between directions.

### D5. Enemy decision and modes

- Decisions are made once per tile, when a Glitch reaches a tile center, using the rule in the enemy-ai spec (no reversal, straight-line distance, tie order up/left/down/right). Forced reversals from mode switches set a "reverse pending" flag honoured on the next step.
- A per-level schedule array `[7,20,7,20,5,20,5,Infinity]` (seconds) drives the global Scatter/Chase phase. The timer is not advanced while Overload is active.
- Forge release uses per-Glitch spark counters (Lure 0, Splice 30, Skitter 60 on level 1; lower later) plus a 4 s idle timer. The Forge has its own small movement routine (bob, move to the door column, go up through the door).
- Returning fragments target the tile above the door, then are routed into the Forge and leave again with the normal exit routine.
- Overload randomness comes from the seeded RNG, never `Math.random`.

### D6. Level table (initial values, tuned during play testing)

Base speed: 1 tile = 256 units, base 100% = 7.5 tiles/s ≈ 32 units/step.

| Level | Nib | Glitch | Glitch Overload | Glitch tunnel | Overload s | Bonus (value) |
|------:|----:|-------:|----------------:|--------------:|-----------:|---------------|
| 1     | 80% | 75%    | 50%             | 40%           | 6          | Byte (100)    |
| 2     | 85% | 80%    | 55%             | 45%           | 5          | Chip (300)    |
| 3–4   | 90% | 85%    | 55%             | 45%           | 4          | Disk (500)    |
| 5–8   | 100%| 95%    | 60%             | 50%           | 3 → 2      | Gem/Bolt ... (700–2000) |
| 9–20  | 100%| 95%    | 60%             | 50%           | 2 → 1      | ... (3000–5000) |
| 21+   | 90% | 95%    | –               | 50%           | 0          | Crown (5000)  |

Returning fragments always move at 200%. Level 1 speeds are slightly gentler than a keyboard game would use, since swipe turns are less precise; tune on real phones. Tests check the progression rule, not exact numbers.

### D7. Maze layout authoring

The maze is written as 31 strings of 28 characters in `mazeData.js`: `#` wall, `.` spark, `o` Surge Core, ` ` empty path, `T` tunnel, `-` Forge door, `F` Forge interior, `P` player start, plus markers for Glitch starts and the bonus spot. The layout is drawn fresh (not traced from any existing game). Corridors are one tile wide, as in the genre; on a 390 px phone a tile is about 14 CSS px, so the design favours longer straight runs and fewer tight zig-zags to suit swipe control. `validateLayout()` checks symmetry, connectivity (BFS from `P`), no dead ends, exactly 4 cores and the spark count.

### D8. Screen layout and rendering

- `index.html` uses `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`, a black `html/body` with `overflow: hidden`, `overscroll-behavior: none`, `touch-action: none`, `user-select: none` and `-webkit-touch-callout: none`.
- `layout.js` reads the visual viewport size (`100dvh`-safe) minus `env(safe-area-inset-*)` and chooses: **portrait** = playfield full width at the top, remaining height below for the D-pad; **landscape/desktop** = playfield at full height, centred, D-pad to the right. Recomputed on `resize` and `orientationchange`.
- The canvas backing store is sized to CSS size × `devicePixelRatio` (capped at 3) and drawn with a transform, so text and glow are sharp. Wall outlines and glow are pre-rendered once per level/resize to an offscreen canvas; per-frame drawing is the cached maze, remaining sparks, entities, HUD.
- The HUD text is drawn on the canvas; buttons, settings and D-pad are DOM elements over it (accessible, easy hit areas).
- Palette: black background; walls glow, cycling by level through electric blue-violet, teal, magenta and lime; sparks are small warm-white squares; cores are pulsing rings.
- Nib: a rounded hexagonal drone with a bright visor bar pointing in its facing direction. Loss animation: Nib breaks into pixel shards.
- Glitches: geometric shapes (triangle, diamond, hexagon, square) with an eye-dot pointing where they head. Overloaded: pale grey-white with scanline flicker. Fragments: a small spinning core.

### D9. Audio and haptics

`sfx.js` creates the `AudioContext` on the first `pointerdown`/`keydown` (autoplay rules) and calls `resume()` on every later resume from pause or background, since iOS suspends it. All calls are guarded so missing Web Audio means silence. Effects are short oscillator + gain envelopes. Haptics call `navigator.vibrate` with short patterns (life lost 120 ms, catch 30 ms, core 20 ms, level clear 40-60-40) only when available and sound is on. One master gain gives mute.

### D10. Lifecycle

`visibilitychange` (and `pagehide`) → pause the game, cancel the animation frame, suspend audio. Resume only on the player's tap, followed by the 3-second countdown from the game-flow spec. On `pageshow` from the back/forward cache, re-run layout.

### D11. Install and offline

`manifest.webmanifest` declares name, short name, theme/background black, `display: fullscreen` with `standalone` fallback, `orientation: portrait`, and icons including a maskable one. `sw.js` precaches a fixed list of all game files under a version key; it serves cache first and, on activation of a new version, deletes old caches. The page registers the worker and, when a new worker is waiting, activates it on the next launch so a new version is used by the second launch. iOS uses `apple-touch-icon` and `apple-mobile-web-app-capable` meta tags.

### D12. Testing

`node --test` runs `test/`. Tests drive `game.js` with scripted intents and a fixed seed, and drive `swipe.js` with scripted pointer paths. Each rules scenario maps to at least one test. Device scenarios (layout, safe areas, gestures, install, offline, haptics, frame rate) are checked with Playwright mobile emulation (iPhone and Pixel profiles, touch enabled) for layout and input, plus a manual checklist on a real iPhone and Android phone for install, audio, haptics and performance.

## Risks / Trade-offs

- [Swipes feel imprecise in a one-tile-wide maze] → Mid-swipe registration, chaining, 0.5 s buffer, gentler level 1 speeds, optional D-pad. Tune the 20 px threshold on real phones.
- [Small tiles on narrow phones] → Glow and bright colours keep entities readable; layout favours long corridors; HUD text minimum size enforced.
- [iOS Safari quirks (audio suspension, no vibration, toolbar resizing the viewport)] → Resume audio on each resume, feature-detect vibration, use visual viewport for layout.
- [Service worker serving stale files during development] → Version key bumped per release; dev server path skips registration on `localhost` unless a flag is set.
- [Tab or app switches cause big time jumps] → Pause on visibility change and cap catch-up steps.
- [Original maze could feel unbalanced] → Keep the layout in data, validate it automatically, and tune after play tests.

## Open Questions

- Final names and art for the bonus pickups past level 4 (pure presentation).
- Exact level-table numbers and the swipe threshold after play testing on real phones (within the rules in the specs).
