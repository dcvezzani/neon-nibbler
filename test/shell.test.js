import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createStorage, DEFAULT_SETTINGS } from '../src/storage.js';
import { computeLayout, BUTTON, DPAD_CELL } from '../src/ui/layout.js';
import { createGame } from '../src/core/game.js';
import { createSwipe } from '../src/core/swipe.js';
import { UP, LEFT, DOWN, RIGHT, NONE, VIEW_W, VIEW_H, TILE } from '../src/core/constants.js';

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('storage: high score survives a reload (new storage object, same store)', () => {
  const store = memStore();
  const a = createStorage(store);
  a.saveHighScore(3000);
  a.saveHighScore(5000);
  a.saveHighScore(4000); // lower: ignored
  assert.equal(createStorage(store).loadHighScore(), 5000);
});

test('storage: blocked storage still works for the session and starts at 0', () => {
  const s = createStorage(throwing);
  assert.equal(s.loadHighScore(), 0);
  assert.deepEqual(s.loadSettings(), { ...DEFAULT_SETTINGS });
  s.saveHighScore(1200);
  assert.equal(s.loadHighScore(), 1200);
  assert.doesNotThrow(() => s.saveSettings({ muted: true, dpad: true }));
  assert.deepEqual(s.loadSettings(), { muted: true, dpad: true });
});

test('storage: settings (sound, D-pad) persist', () => {
  const store = memStore();
  createStorage(store).saveSettings({ muted: true, dpad: true });
  assert.deepEqual(createStorage(store).loadSettings(), { muted: true, dpad: true });
});

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const mazeRect = (pf) => ({ x: pf.x, y: pf.y + 3 * TILE * pf.scale, w: pf.w, h: 31 * TILE * pf.scale });

for (const [vw, vh, insets] of [[320, 568, none], [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }], [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }], [1440, 900, none], [768, 1024, none]]) {
  for (const dpad of [false, true]) {
    test(`layout ${vw}x${vh} dpad=${dpad}: fits the safe area, keeps ratio, nothing covers the maze`, () => {
      const L = computeLayout({ vw, vh, insets, dpad });
      const { pf } = L;
      const eps = 0.01;
      assert.ok(pf.x >= insets.left - eps && pf.x + pf.w <= vw - insets.right + eps, 'inside horizontally');
      assert.ok(pf.y - pf.pad >= insets.top - eps && pf.y + pf.h <= vh - insets.bottom + eps, 'inside vertically');
      assert.ok(Math.abs(pf.w / pf.h - VIEW_W / VIEW_H) < 1e-6, 'aspect ratio');
      assert.ok(L.bar.h >= BUTTON - eps, 'button bar fits a 44 px button above the maze');
      const maze = mazeRect(pf);
      assert.ok(L.bar.y + L.bar.h <= maze.y + eps, 'buttons stay above the maze');
      if (dpad) {
        const d = { x: L.dpad.x, y: L.dpad.y, w: L.dpad.size, h: L.dpad.size };
        assert.ok(!overlaps(d, maze), 'D-pad does not cover the maze');
        assert.ok(d.x >= insets.left - eps && d.x + d.w <= vw - insets.right + eps && d.y + d.h <= vh - insets.bottom + eps, 'D-pad inside safe area');
        assert.ok(DPAD_CELL >= 56);
      } else {
        assert.equal(L.dpad, null);
      }
      if (vw <= 320) assert.ok(pf.scale * 18 >= 10, `HUD digits ${pf.scale * 18} CSS px`);
    });
  }
}

test('layout: portrait phone without D-pad uses the full safe-area width', () => {
  const L = computeLayout({ vw: 390, vh: 844, insets: none, dpad: false });
  assert.equal(L.pf.w, 390);
  const L2 = computeLayout({ vw: 390, vh: 844, insets: none, dpad: true });
  assert.equal(L2.pf.w, 390);
  assert.ok(L2.dpad.y > L2.pf.y + L2.pf.h);
});

test('layout: landscape keeps the maze centred when there is room for the D-pad', () => {
  const L = computeLayout({ vw: 1440, vh: 900, insets: none, dpad: true });
  assert.ok(Math.abs(L.pf.x + L.pf.w / 2 - 720) < 1);
  assert.ok(L.dpad.x >= L.pf.x + L.pf.w);
});

test('offline: the service worker precaches every game file', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  const listed = new Set([...sw.matchAll(/'([^']+\.(?:js|css|html|png|webmanifest))'/g)].map((m) => m[1]));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  const needed = [...walk('src'), ...walk('icons'), 'index.html', 'manifest.webmanifest'].map((p) => p.split(path.sep).join('/'));
  for (const f of needed) assert.ok(listed.has(f), `${f} missing from sw.js FILES`);
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  for (const icon of manifest.icons) assert.ok(fs.existsSync(icon.src), `${icon.src} exists`);
  assert.equal(manifest.orientation, 'portrait');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));
});

test('one input model: same timed directions by swipe and by key give the same path', () => {
  const plan = [[130, LEFT], [180, UP], [260, RIGHT], [330, DOWN], [420, LEFT], [520, UP]];
  function viaKeys() {
    const g = createGame({ seed: 4 }); g.newGame();
    const out = [];
    for (let t = 0; t < 700; t++) {
      for (const [at, d] of plan) if (at === t) g.setIntent(d);
      g.step(); out.push(g.snapshot());
    }
    return out;
  }
  function viaSwipes() {
    const g = createGame({ seed: 4 }); g.newGame();
    const sw = createSwipe(20);
    const vec = { [UP]: [0, -1], [DOWN]: [0, 1], [LEFT]: [-1, 0], [RIGHT]: [1, 0] };
    const out = [];
    for (let t = 0; t < 700; t++) {
      for (const [at, d] of plan) {
        if (at !== t) continue;
        sw.start(200, 300);
        for (let i = 1; i <= 25; i++) { const r = sw.move(200 + vec[d][0] * i, 300 + vec[d][1] * i); if (r !== NONE) g.setIntent(r); }
        sw.end();
      }
      g.step(); out.push(g.snapshot());
    }
    return out;
  }
  assert.deepEqual(viaSwipes(), viaKeys());
});
