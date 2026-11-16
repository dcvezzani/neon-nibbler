// Renders the app icons to PNG with the pre-installed Playwright Chromium.
// Usage: npm run icons   (development only; the PNGs are committed)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const html = (size, maskable) => `<!doctype html><body style="margin:0;background:#000">
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const c = document.getElementById('c'), x = c.getContext('2d'), S = ${size}, M = ${maskable};
x.fillStyle = M ? '#050a1c' : '#000'; x.fillRect(0, 0, S, S);
const k = M ? S * 0.0028 : S * 0.0036; // content scale (maskable keeps a safe zone)
const cx = S / 2, cy = S / 2;
function hex(r) { x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); }
// neon ring of sparks
x.fillStyle = '#ffe9c2';
for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const r = 108 * k; x.fillRect(cx + Math.cos(a) * r - 5 * k, cy + Math.sin(a) * r - 5 * k, 10 * k, 10 * k); }
x.shadowColor = '#3ef2ff'; x.shadowBlur = 30 * k;
x.fillStyle = 'rgba(62,242,255,0.18)'; hex(86 * k); x.fill();
x.fillStyle = '#082634'; hex(62 * k); x.fill();
x.strokeStyle = '#3ef2ff'; x.lineWidth = 14 * k; x.lineJoin = 'round'; hex(62 * k); x.stroke();
x.shadowBlur = 0;
x.strokeStyle = '#ffffff'; x.lineWidth = 20 * k; x.lineCap = 'round';
x.beginPath(); x.moveTo(cx + 26 * k, cy - 28 * k); x.lineTo(cx + 26 * k, cy + 28 * k); x.stroke();
// pink spark being eaten
x.fillStyle = '#ff3dac'; x.shadowColor = '#ff3dac'; x.shadowBlur = 20 * k;
x.beginPath(); x.arc(cx + 118 * k, cy, 0, 0, 7); x.fill();
</script></body>`;

const out = [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true],
];
const browser = await chromium.launch();
for (const [name, size, maskable] of out) {
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: size, height: size } });
  page.on('pageerror', (e) => console.error('icon script error:', e.message));
  await page.setContent(html(size, maskable));
  const buf = await page.locator('#c').screenshot();
  fs.writeFileSync(path.join(root, 'icons', name), buf);
  console.log('wrote icons/' + name);
  await page.close();
}
await browser.close();
