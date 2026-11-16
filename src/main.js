// Browser entry point: wires the pure game to rendering, input, UI, audio,
// storage and the page lifecycle.
import { createGame } from './core/game.js';
import { createStepper } from './core/loop.js';
import { SWIPE_THRESHOLD } from './core/constants.js';
import { createRenderer } from './render/renderer.js';
import { computeLayout, readViewport, applyLayout } from './ui/layout.js';
import { createUi } from './ui/ui.js';
import { attachKeyboard } from './input/keyboard.js';
import { attachTouch } from './input/touch.js';
import { attachDpad } from './input/dpad.js';
import { createSfx } from './audio/sfx.js';
import { createStorage } from './storage.js';

const params = new URLSearchParams(location.search);
const storage = createStorage();
const settings = storage.loadSettings();
const seed = Number(params.get('seed')) || ((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
const game = createGame({ seed, highScore: storage.loadHighScore() });
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const sfx = createSfx({ isMuted: () => settings.muted });
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, { isTouch });
const probe = document.getElementById('safe-probe');

function saveHigh() { storage.saveHighScore(game.state.high); }
function setMuted(m) { settings.muted = m; storage.saveSettings(settings); sfx.setMuted(m); }

const ui = createUi(document, {
  onAnyInput: () => sfx.unlock(),
  onPause: () => game.pause(),
  onResume: () => { sfx.resume(); game.resume(); },
  onQuit: () => { saveHigh(); game.quit(); },
  onToggleSound: () => setMuted(!settings.muted),
  onToggleDpad: () => { settings.dpad = !settings.dpad; storage.saveSettings(settings); relayout(); },
});

let layout = null;
function relayout() {
  layout = computeLayout({ ...readViewport(probe), dpad: settings.dpad });
  applyLayout(layout, ui.els);
  renderer.resize(layout);
}

function confirm() {
  if (ui.settingsOpen) return;
  if (game.state.paused) { sfx.resume(); game.resume(); return; }
  game.confirm();
}

const inputHandlers = {
  onDir: (d) => game.setIntent(d),
  onAnyInput: () => sfx.unlock(),
};
attachTouch(document, { ...inputHandlers, threshold: SWIPE_THRESHOLD, onTap: confirm });
attachDpad(ui.els.dpad, inputHandlers);
attachKeyboard(window, {
  ...inputHandlers,
  onConfirm: confirm,
  onPause: () => {
    if (ui.settingsOpen) { ui.closeSettings(); return; }
    if (game.state.paused) { sfx.resume(); game.resume(); } else game.pause();
  },
  onMute: () => setMuted(!settings.muted),
});

// --- main loop ------------------------------------------------------------------
const stepper = createStepper(() => game.step());
let raf = 0;
let last = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min(now - last, 250) : 0;
  last = now;
  stepper.advance(dt);
  for (const e of game.drainEvents()) {
    sfx.handle(e);
    renderer.handleEvent(e, now);
    if (e.type === 'gameOver') saveHigh();
  }
  const s = game.state;
  sfx.syncOverload(s.overloadTimer > 0 && !s.paused && s.countdown === 0 && (s.phase === 'playing' || s.phase === 'catch'));
  ui.sync(game, settings);
  renderer.draw(game, now, { muted: settings.muted });
}
function startLoop() { if (!raf) { last = 0; stepper.reset(); raf = requestAnimationFrame(frame); } }
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

// --- lifecycle ---------------------------------------------------------------------
function onHidden() { game.pause(); saveHigh(); stopLoop(); sfx.suspend(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) onHidden(); else startLoop(); });
window.addEventListener('pagehide', onHidden);
window.addEventListener('pageshow', () => { relayout(); startLoop(); });
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', () => setTimeout(relayout, 50));
window.visualViewport?.addEventListener('resize', relayout);

relayout();
startLoop();

// --- install / offline ---------------------------------------------------------------
const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ('serviceWorker' in navigator && (!localHost || params.has('sw'))) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
}

// Handle for debugging and automated browser checks.
window.__neonNibbler = { game, settings, get layout() { return layout; }, relayout, sfx };
