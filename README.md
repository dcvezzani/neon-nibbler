# Neon Nibbler

An original, mobile-first arcade maze-chase game for the browser. Steer **Nib**, a small glowing drone, through a neon circuit maze. Collect every **spark** while four rogue **Glitches** hunt you:

| Glitch | Shape | Behaviour |
|---|---|---|
| **Rook** | crimson triangle | Hunts you directly |
| **Lure** | violet diamond | Aims 4 tiles ahead of you to cut you off |
| **Splice** | lime hexagon | Flanks you using Rook's position |
| **Skitter** | amber square | Chases from afar, backs off when within 8 tiles |

Eat a **Surge Core** to Overload the Glitches. While they're pale and flickering you can catch them for 200, 400, 800 and 1600 points.

Plain HTML5 Canvas and JavaScript modules. No build step, no runtime dependencies, no audio files.

## Run it

```bash
npm start
```

Then open http://localhost:8080/. The server also prints a network address so you can open the game **on your phone** when it's on the same Wi-Fi.

Any static file server works too. The game is just the files in this folder.

## Install on your phone (play offline)

Installing to the home screen and offline play need the game served over **HTTPS**, for example on GitHub Pages or Netlify. Open the URL on your phone, then:

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** menu → *Install app* (or *Add to Home screen*).

After one online visit the game works with no connection. On `localhost` the offline service worker is off by default so development isn't served stale files. Add `?sw=1` to the URL to test it locally.

## Controls

| | Touchscreen | Keyboard |
|---|---|---|
| Steer | Swipe anywhere. The turn registers mid-swipe, and you can chain turns without lifting your finger | Arrow keys or W A S D |
| Optional D-pad | Settings → *On-screen D-pad* | |
| Start / continue | Tap | Enter or Space |
| Pause | Pause button (top right) | P or Escape |
| Sound and vibration | Sound button or Settings | M |

Turns are buffered for half a second, so you can swipe early and Nib takes the turn as soon as the path opens. Resuming from pause gives a 3-2-1 countdown. The game pauses itself when you switch apps or lock the phone.

## Tests

```bash
npm test
```

Unit tests for all game rules run headlessly in Node (`test/`). They cover the maze, movement, buffering, swipes, every Glitch targeting rule, the Scatter/Chase schedule, Overload, scoring, lives, levels, pause, determinism, layout, storage and the offline file list.

```bash
npm run e2e
```

Browser checks with Playwright and Chromium (`e2e/`). They cover phone gestures, touch steering, layout at 320×568, 390×844, 844×390 and 1440×900, button and D-pad sizes, settings persistence, background pause, offline play, running without audio, desktop keyboard play and the game-over screen. Screenshots go to `e2e/output/`. These checks need the `playwright` package and its Chromium available to Node.

## Manual device checklist

Automated checks can't cover these. Try them on a real iPhone (Safari, installed to the home screen) and a real Android phone (Chrome):

- [ ] Swiping feels responsive; chained turns (an L-shaped drag) work; the D-pad works when on.
- [ ] Sound starts on the first tap, and works again after locking and unlocking the phone and after a call.
- [ ] Every event has its own sound: spark (alternating blip), Surge Core, Overload hum (stops when Overload ends), catching a Glitch, fragment returning home, bonus, extra life, losing a life, level clear, game start.
- [ ] Android vibrates on losing a life, catching a Glitch, eating a Surge Core and clearing a level. Muting stops both sound and vibration.
- [ ] Mute survives closing and reopening the app.
- [ ] Overloaded Glitches look pale with flickering scanlines, and flash during the last 2 seconds.
- [ ] Walls flash when a level is cleared; level 2 walls are a different colour.
- [ ] Play two full levels and a game over at a steady frame rate, including busy Overload moments.
- [ ] The home-screen icon and name look right, and the game opens full screen.
- [ ] Nothing sits under the notch or home indicator, in portrait or landscape.

## Project layout

```
index.html, manifest.webmanifest, sw.js, icons/
src/core/     pure game logic (no DOM): maze, movement, player, swipe, enemies, levels, game, loop
src/render/   canvas renderer
src/input/    keyboard, touch swipes, D-pad
src/ui/       layout (fit, safe areas, orientation) and DOM controls
src/audio/    synthesized sound effects and haptics
test/, e2e/   unit tests and browser checks
openspec/     specs and change proposals (spec-driven development with OpenSpec)
tools/        dev server and icon generator
```

When you change a game file, add it to `FILES` in `sw.js` and bump `VERSION`. A unit test fails if a file is missing from the list.
