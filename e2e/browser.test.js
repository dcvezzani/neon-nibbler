// Browser checks with Playwright (uses the pre-installed Chromium).
// Run: npm run e2e   Screenshots are written to e2e/output/.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'output');
fs.mkdirSync(outDir, { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://localhost:${PORT}/`;

let server, browser;
before(async () => {
  server = spawn(process.execPath, [path.join(root, 'tools', 'serve.mjs'), '--port', String(PORT)], { stdio: 'pipe' });
  await new Promise((resolve) => server.stdout.once('data', resolve));
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.kill(); });

const iphone = devices['iPhone 13'];
async function open(ctxOpts, url = `${BASE}?seed=3`) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__neonNibbler);
  return { ctx, page, errors };
}
const nn = (page, fn, arg) => page.evaluate(fn, arg);
const phase = (page) => nn(page, () => window.__neonNibbler.game.phase);
async function waitPhase(page, p) { await page.waitForFunction((x) => window.__neonNibbler.game.phase === x, p, { timeout: 8000 }); }

async function touchSwipe(page, from, to, { lift = true, steps = 8 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps, y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  const end = async () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  if (lift) await end();
  return end;
}

test('phone: double-tap and swipes neither zoom nor scroll the page (1.2)', async () => {
  const { ctx, page, errors } = await open(iphone);
  await page.touchscreen.tap(200, 400);
  await page.touchscreen.tap(200, 400);
  await touchSwipe(page, { x: 200, y: 120 }, { x: 200, y: 600 });  // swipe down from the top
  await touchSwipe(page, { x: 200, y: 600 }, { x: 200, y: 150 });
  await page.waitForTimeout(300);
  const v = await page.evaluate(() => ({ scale: visualViewport.scale, sy: scrollY, st: document.scrollingElement.scrollTop, sel: String(getSelection()) }));
  assert.equal(v.scale, 1);
  assert.equal(v.sy, 0);
  assert.equal(v.st, 0);
  assert.equal(v.sel, '');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('phone: tap starts, swipe steers Nib, direction registers before the finger lifts (3.4)', async () => {
  const { ctx, page, errors } = await open(iphone);
  assert.equal(await phase(page), 'start');
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await nn(page, () => {
    const g = window.__neonNibbler.game; const orig = g.setIntent;
    window.__intents = []; g.setIntent = (d) => { window.__intents.push(d); orig(d); };
  });
  const lift = await touchSwipe(page, { x: 200, y: 400 }, { x: 200, y: 360 }, { lift: false }); // up, still touching
  assert.deepEqual(await nn(page, () => window.__intents), [0], 'Up registered once, mid-swipe');
  await lift();
  await page.waitForFunction(() => window.__neonNibbler.game.state.player.dir === 0, null, { timeout: 3000 });
  await page.screenshot({ path: path.join(outDir, 'phone-playing.png') });
  assert.deepEqual(errors, []);
  await ctx.close();
});

for (const [name, vp, mobile] of [['320x568', { width: 320, height: 568 }, true], ['390x844', { width: 390, height: 844 }, true], ['844x390', { width: 844, height: 390 }, true], ['1440x900', { width: 1440, height: 900 }, false]]) {
  test(`layout ${name}: playfield fits, keeps its ratio and is drawn at device resolution (1.3)`, async () => {
    const dpr = mobile ? 3 : 1;
    const { ctx, page, errors } = await open({ viewport: vp, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    for (const dpad of [false, true]) {
      await nn(page, (d) => { window.__neonNibbler.settings.dpad = d; window.__neonNibbler.relayout(); }, dpad);
      const m = await page.evaluate(() => {
        const c = document.getElementById('game');
        const r = c.getBoundingClientRect();
        const btns = [...document.querySelectorAll('#top-buttons button:not([hidden]), #dpad:not([hidden]) button')].map((b) => {
          const q = b.getBoundingClientRect(); return { id: b.id || b.dataset.dir, x: q.x, y: q.y, w: q.width, h: q.height, dpad: b.classList.contains('dpad-btn') };
        });
        return { r: { x: r.x, y: r.y, w: r.width, h: r.height }, cw: c.width, ch: c.height, btns, L: window.__neonNibbler.layout };
      });
      assert.ok(m.r.x >= -0.5 && m.r.y >= -0.5 && m.r.x + m.r.w <= vp.width + 0.5 && m.r.y + m.r.h <= vp.height + 0.5, 'inside viewport');
      assert.ok(Math.abs(m.r.w / m.r.h - 448 / 576) < 0.01, 'aspect ratio');
      assert.equal(m.cw, Math.round(m.L.pf.w * dpr), 'canvas backing store = CSS width x DPR');
      const maze = { x: m.r.x, y: m.r.y + (48 / 576) * m.r.h, w: m.r.w, h: (496 / 576) * m.r.h };
      for (const b of m.btns) {
        assert.ok(b.w >= (b.dpad ? 56 : 44) - 0.5 && b.h >= (b.dpad ? 56 : 44) - 0.5, `${b.id} size ${b.w}x${b.h}`);
        const hit = b.x < maze.x + maze.w - 0.5 && maze.x < b.x + b.w - 0.5 && b.y < maze.y + maze.h - 0.5 && maze.y < b.y + b.h - 0.5;
        assert.ok(!hit, `${b.id} overlaps the maze`);
      }
      await page.screenshot({ path: path.join(outDir, `layout-${name}${dpad ? '-dpad' : ''}.png`) });
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test('settings panel: D-pad and sound toggles apply at once and persist after reload (6.6)', async () => {
  const { ctx, page } = await open(iphone);
  await page.click('#btn-settings');
  await page.waitForSelector('#settings-panel:not([hidden])');
  await page.click('#tgl-dpad');
  await page.click('#tgl-sound');
  await page.click('#btn-settings-close');
  assert.equal(await page.isVisible('#dpad'), true);
  assert.equal(await page.getAttribute('#btn-sound', 'aria-pressed'), 'true');
  await page.reload();
  await page.waitForFunction(() => window.__neonNibbler);
  assert.equal(await page.isVisible('#dpad'), true, 'D-pad still on');
  assert.equal(await page.getAttribute('#btn-sound', 'aria-pressed'), 'true', 'still muted');
  // D-pad press registers immediately
  await page.touchscreen.tap(195, 300);
  await waitPhase(page, 'playing');
  const up = await page.$('.dpad-btn[data-dir="2"]');
  const box = await up.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const dir = await nn(page, () => window.__neonNibbler.game.state.player.intent?.dir ?? window.__neonNibbler.game.state.player.dir);
  assert.equal(dir, 2);
  await ctx.close();
});

test('lifecycle: hiding the page pauses the game; no game time passes; resume shows a countdown (8.1)', async () => {
  const { ctx, page } = await open(iphone);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const t0 = await nn(page, () => window.__neonNibbler.game.state.tick);
  await page.waitForTimeout(800);
  const t1 = await nn(page, () => window.__neonNibbler.game.state.tick);
  assert.equal(t1, t0, 'no game time while hidden');
  assert.equal(await nn(page, () => window.__neonNibbler.game.state.paused), true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(400);
  assert.equal(await nn(page, () => window.__neonNibbler.game.state.paused), true, 'stays paused on return');
  assert.equal(await page.isVisible('#pause-panel'), true);
  await page.screenshot({ path: path.join(outDir, 'paused.png') });
  await page.click('#btn-resume');
  assert.ok(await nn(page, () => window.__neonNibbler.game.state.countdown) > 0, 'countdown running');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'countdown.png') });
  await ctx.close();
});

test('offline: after one online visit the game loads and plays with no network (8.3)', async () => {
  const { ctx, page, errors } = await open(iphone, `${BASE}?sw=1`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__neonNibbler);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await ctx.setOffline(false);
  assert.deepEqual(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)), []);
  await ctx.close();
});

test('no Web Audio or vibration: game runs silently without errors; no audio files requested (7.2)', async () => {
  const ctx = await browser.newContext(iphone);
  await ctx.addInitScript(() => {
    delete window.AudioContext; delete window.webkitAudioContext;
    try { Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true }); } catch { /* ignore */ }
  });
  const page = await ctx.newPage();
  const errors = [], audioReqs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (/\.(mp3|ogg|wav|m4a|aac|opus|flac)(\?|$)/i.test(r.url()) || r.resourceType() === 'media') audioReqs.push(r.url()); });
  await page.goto(`${BASE}?seed=5`);
  await page.waitForFunction(() => window.__neonNibbler);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  // Force a few sound/haptic events.
  await page.evaluate(() => {
    const { game } = window.__neonNibbler;
    const s = game.state;
    const i = Math.floor(s.player.y / 256) * 28 + Math.floor(s.player.x / 256);
    s.items[i] = 2; s.remaining += 1;
  });
  await page.waitForTimeout(1500);
  assert.deepEqual(errors, []);
  assert.deepEqual(audioReqs, []);
  await ctx.close();
});

test('desktop: Enter starts, arrows steer, P pauses and resumes, M toggles sound, clicks work', async () => {
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await page.screenshot({ path: path.join(outDir, 'desktop-start.png') });
  await page.keyboard.press('Enter');
  await waitPhase(page, 'playing');
  await page.keyboard.press('ArrowUp');
  assert.equal(await nn(page, () => window.__neonNibbler.game.state.player.intent?.dir ?? window.__neonNibbler.game.state.player.dir), 0);
  await page.keyboard.press('KeyP');
  assert.equal(await page.isVisible('#pause-panel'), true);
  await page.keyboard.press('KeyP');
  assert.ok(await nn(page, () => window.__neonNibbler.game.state.countdown) > 0);
  await page.keyboard.press('KeyM');
  assert.equal(await nn(page, () => window.__neonNibbler.settings.muted), true);
  await page.waitForTimeout(3300);
  await page.screenshot({ path: path.join(outDir, 'desktop-playing.png') });
  await page.click('#btn-pause');
  await page.click('#btn-sound');
  assert.equal(await nn(page, () => window.__neonNibbler.settings.muted), false, 'mouse click toggles sound');
  await page.click('#btn-quit');
  assert.equal(await phase(page), 'start');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('game over screen ignores the first second of taps, then returns to start', async () => {
  const { ctx, page } = await open(iphone);
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'playing');
  await page.evaluate(() => {
    const s = window.__neonNibbler.game.state;
    s.lives = 1;
    const r = s.glitches[0]; r.state = 'active'; r.frightened = false; r.x = s.player.x; r.y = s.player.y;
  });
  await waitPhase(page, 'gameOver');
  await page.touchscreen.tap(195, 420);
  assert.equal(await phase(page), 'gameOver');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, 'game-over.png') });
  await page.touchscreen.tap(195, 420);
  await waitPhase(page, 'start');
  await ctx.close();
});
