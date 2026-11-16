// Canvas renderer. Draws the 448x576 logical playfield at full device
// resolution. Walls are pre-rendered (with glow) once per level and resize.
import { VIEW_W, VIEW_H, TILE, COLS, MAZE_ROWS, MAZE_TOP, DX, DY, UNITS } from '../core/constants.js';
import { T_WALL, T_DOOR } from '../core/constants.js';
import { GLITCH_INFO } from '../core/enemies.js';
import {
  isFlashing, SPARK, CORE, BONUS_TILE, DYING_STEPS, DYING_FREEZE_STEPS, COUNTDOWN_STEPS,
} from '../core/game.js';
import { getLevel } from '../core/levels.js';

export const WALL_COLORS = ['#5b6cff', '#19e3c8', '#ff3dac', '#9dff3a', '#ffb02e', '#c45cff'];
export const wallColorFor = (level) => WALL_COLORS[(level - 1) % WALL_COLORS.length];

const NIB = '#3ef2ff';
const SPARK_COLOR = '#ffe9c2';
const MAZE_Y = MAZE_TOP * TILE;
const MAZE_H = MAZE_ROWS * TILE;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
export const HUD_DIGITS = 18; // logical px; >= 10 CSS px even on a 320 px phone with the D-pad
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const toPx = (u) => u / (UNITS / TILE);              // units -> logical px
const ex = (e) => toPx(e.x);
const ey = (e) => toPx(e.y) + MAZE_Y;

export function createRenderer(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let k = 1;
  let cacheKey = '';
  let walls = null, wallsWhite = null;
  const floats = [];
  const isTouch = opts.isTouch ?? false;

  function resize(layout) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(layout.pf.w * dpr));
    canvas.height = Math.max(1, Math.round(layout.pf.h * dpr));
    k = canvas.width / VIEW_W;
    cacheKey = '';
  }

  function ensureWalls(maze, level) {
    const key = `${level}|${canvas.width}x${canvas.height}`;
    if (key === cacheKey) return;
    cacheKey = key;
    walls = buildWalls(maze, wallColorFor(level), k, canvas.width, canvas.height);
    wallsWhite = buildWalls(maze, '#ffffff', k, canvas.width, canvas.height);
  }

  function handleEvent(e, now) {
    if (e.type === 'catch' || e.type === 'bonus') {
      floats.push({ text: String(e.points), x: toPx(e.x), y: toPx(e.y) + MAZE_Y, t0: now, color: e.type === 'catch' ? '#ffffff' : '#ffe066' });
    }
  }

  function draw(game, now, ui = {}) {
    const s = game.state;
    ensureWalls(s.maze, s.level);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const flashWhite = s.phase === 'levelClear' && Math.floor(s.phaseTimer / 15) % 2 === 1;
    ctx.drawImage(flashWhite ? wallsWhite : walls, 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    if (s.phase !== 'start') {
      drawItems(ctx, game, now);
      if (s.bonus) drawBonus(ctx, s.bonus.kind, 14 * TILE, (BONUS_TILE.y + MAZE_TOP) * TILE + 8, 1);
      if (s.phase !== 'gameOver') drawEntities(ctx, s, now);
      drawFloats(ctx, floats, now);
    }
    drawHud(ctx, s, ui);
    drawOverlay(ctx, s, now, { isTouch, ...ui });
  }

  return { resize, draw, handleEvent, get scale() { return k; } };
}

// --- walls ---------------------------------------------------------------------
function buildWalls(maze, color, k, w, h) {
  const band = document.createElement('canvas');
  band.width = w; band.height = h;
  const b = band.getContext('2d');
  const wall = (x, y) => maze.tileAt(x, y) === T_WALL;
  const OUT = 3, IN = 5; // band sits 3..5 px inside the wall edge
  // Rectangles are snapped to whole device pixels so neighbouring tiles share
  // exact edges (no hairline seams at fractional scales).
  const R = (v) => Math.round(v * k);
  const box = (x0, y0, x1, y1) => b.fillRect(R(x0), R(y0), R(x1) - R(x0), R(y1) - R(y0));
  const rects = (inset) => {
    for (let y = 0; y < MAZE_ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!wall(x, y)) continue;
        const l = wall(x - 1, y) ? 0 : inset, r = wall(x + 1, y) ? 0 : inset;
        const t = wall(x, y - 1) ? 0 : inset, bt = wall(x, y + 1) ? 0 : inset;
        const px = x * TILE, py = MAZE_Y + y * TILE;
        box(px + l, py + t, px + TILE - r, py + TILE - bt);
      }
    }
  };
  b.fillStyle = color;
  rects(OUT);
  b.globalCompositeOperation = 'destination-out';
  rects(IN);
  // Concave corners: join the bands with a small elbow.
  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!wall(x, y)) continue;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (wall(x + dx, y) && wall(x, y + dy) && !wall(x + dx, y + dy)) {
          const cx = x * TILE + (dx < 0 ? 0 : TILE), cy = MAZE_Y + y * TILE + (dy < 0 ? 0 : TILE);
          const sq = (n) => { const x0 = dx < 0 ? cx : cx - n, y0 = dy < 0 ? cy : cy - n; box(x0, y0, x0 + n, y0 + n); };
          b.globalCompositeOperation = 'source-over';
          sq(IN);
          b.globalCompositeOperation = 'destination-out';
          sq(OUT);
        }
      }
    }
  }
  b.globalCompositeOperation = 'source-over';

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const o = out.getContext('2d');
  o.shadowColor = color;
  o.shadowBlur = 7 * k;
  o.drawImage(band, 0, 0);
  o.drawImage(band, 0, 0);
  o.shadowBlur = 0;
  o.globalAlpha = 0.9;
  o.drawImage(band, 0, 0);
  o.globalAlpha = 1;
  // Forge door
  o.setTransform(k, 0, 0, k, 0, 0);
  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (maze.tileAt(x, y) === T_DOOR) {
        o.fillStyle = '#ff8ad8';
        o.fillRect(x * TILE, MAZE_Y + y * TILE + 6, TILE, 3);
      }
    }
  }
  return out;
}

// --- items -------------------------------------------------------------------------
function drawItems(ctx, game, now) {
  const s = game.state;
  ctx.fillStyle = SPARK_COLOR;
  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (s.items[y * COLS + x] === SPARK) ctx.fillRect(x * TILE + 6.5, MAZE_Y + y * TILE + 6.5, 3, 3);
    }
  }
  const pulse = 0.5 + 0.5 * Math.sin(now / 160);
  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (s.items[y * COLS + x] !== CORE) continue;
      const cx = x * TILE + 8, cy = MAZE_Y + y * TILE + 8;
      ctx.fillStyle = `rgba(255, 233, 194, ${0.15 + 0.2 * pulse})`;
      ctx.beginPath(); ctx.arc(cx, cy, 7 + pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = SPARK_COLOR; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, 4.5 + pulse * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// --- entities ------------------------------------------------------------------------
function polygon(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function shapePath(ctx, shape, x, y, scale = 1) {
  const r = 7 * scale;
  switch (shape) {
    case 'triangle':
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.08); ctx.lineTo(x + r, y + r * 0.85); ctx.lineTo(x - r, y + r * 0.85); ctx.closePath(); break;
    case 'diamond':
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.12); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.12); ctx.lineTo(x - r, y); ctx.closePath(); break;
    case 'hexagon':
      polygon(ctx, x, y, r * 1.05, 6, -Math.PI / 2); break;
    case 'square':
    default: {
      const h = r * 0.92, c = 2.5 * scale;
      ctx.beginPath();
      ctx.moveTo(x - h + c, y - h); ctx.lineTo(x + h - c, y - h); ctx.quadraticCurveTo(x + h, y - h, x + h, y - h + c);
      ctx.lineTo(x + h, y + h - c); ctx.quadraticCurveTo(x + h, y + h, x + h - c, y + h);
      ctx.lineTo(x - h + c, y + h); ctx.quadraticCurveTo(x - h, y + h, x - h, y + h - c);
      ctx.lineTo(x - h, y - h + c); ctx.quadraticCurveTo(x - h, y - h, x - h + c, y - h);
      ctx.closePath();
    }
  }
}

export function drawGlitchIcon(ctx, info, x, y, scale = 1) {
  ctx.fillStyle = hexA(info.color, 0.22);
  shapePath(ctx, info.shape, x, y, scale * 1.35); ctx.fill();
  ctx.fillStyle = hexA(info.color, 0.9);
  shapePath(ctx, info.shape, x, y, scale); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
}

function drawGlitch(ctx, g, s, now, x, y) {
  if (g.state === 'fragment' || g.state === 'entering') {
    const a = now / 120;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = g.color; ctx.lineWidth = 1.6; ctx.strokeRect(-3, -3, 6, 6);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const scared = g.frightened && !(isFlashing(s) && Math.floor(now / 200) % 2 === 1);
  if (g.state === 'house') y += Math.sin(now / 180 + g.id * 1.7) * 2;
  if (scared) {
    ctx.fillStyle = 'rgba(223, 230, 255, 0.2)';
    shapePath(ctx, g.shape, x, y, 1.35); ctx.fill();
    ctx.fillStyle = 'rgba(223, 230, 255, 0.88)';
    shapePath(ctx, g.shape, x, y); ctx.fill();
    ctx.save(); shapePath(ctx, g.shape, x, y); ctx.clip();
    ctx.fillStyle = 'rgba(20, 26, 60, 0.45)';
    const off = Math.floor(now / 60) % 3;
    for (let yy = y - 9 + off; yy < y + 9; yy += 3) ctx.fillRect(x - 9, yy, 18, 1);
    ctx.restore();
    // jittery eyes
    ctx.fillStyle = '#26305e';
    ctx.fillRect(x - 3.5, y - 1.5, 2, 2); ctx.fillRect(x + 1.5, y - 1.5, 2, 2);
    return;
  }
  drawGlitchIcon(ctx, g, x, y);
  const d = g.dir < 0 ? 2 : g.dir;
  const exx = x + DX[d] * 2.4, eyy = y + DY[d] * 2.4 + 0.5;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(exx, eyy, 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a0f24'; ctx.beginPath(); ctx.arc(exx + DX[d] * 1, eyy + DY[d] * 1, 1.15, 0, Math.PI * 2); ctx.fill();
}

export function drawNibShape(ctx, x, y, facing, visorAlpha = 1, r = 7) {
  ctx.fillStyle = 'rgba(62, 242, 255, 0.18)';
  polygon(ctx, x, y, r * 1.45, 6, 0); ctx.fill();
  ctx.fillStyle = '#082634';
  polygon(ctx, x, y, r, 6, 0); ctx.fill();
  ctx.strokeStyle = NIB; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
  // visor bar on the facing side
  const f = facing < 0 ? 1 : facing;
  const px = -DY[f], py = DX[f];
  const vx = x + DX[f] * r * 0.42, vy = y + DY[f] * r * 0.42;
  ctx.strokeStyle = `rgba(255, 255, 255, ${visorAlpha})`;
  ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(vx - px * r * 0.45, vy - py * r * 0.45); ctx.lineTo(vx + px * r * 0.45, vy + py * r * 0.45); ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawNibShards(ctx, x, y, p) {
  const n = 8;
  ctx.fillStyle = `rgba(62, 242, 255, ${1 - p})`;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const d = 2 + p * 22;
    const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
    const sz = 3 * (1 - p * 0.6);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(a + p * 6); ctx.fillRect(-sz / 2, -sz / 2, sz, sz); ctx.restore();
  }
  if (p < 0.25) { ctx.fillStyle = `rgba(255,255,255,${1 - p * 4})`; ctx.beginPath(); ctx.arc(x, y, 6 + p * 20, 0, Math.PI * 2); ctx.fill(); }
}

function drawWrapped(ctx, x, draw) {
  draw(x);
  if (x < TILE) draw(x + VIEW_W);
  if (x > VIEW_W - TILE) draw(x - VIEW_W);
}

function drawEntities(ctx, s, now) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, MAZE_Y, VIEW_W, MAZE_H); ctx.clip();
  const p = s.player;
  const dyingElapsed = s.phase === 'dying' ? DYING_STEPS - s.phaseTimer : -1;
  const deathAnim = dyingElapsed >= DYING_FREEZE_STEPS;
  if (!deathAnim && s.phase !== 'levelClear') {
    for (const g of s.glitches) drawWrapped(ctx, ex(g), (x) => drawGlitch(ctx, g, s, now, x, ey(g)));
  }
  if (deathAnim) {
    const prog = (dyingElapsed - DYING_FREEZE_STEPS) / (DYING_STEPS - DYING_FREEZE_STEPS);
    drawNibShards(ctx, ex(p), ey(p), Math.min(1, prog));
  } else {
    const flicker = s.phase === 'playing' && p.moving ? 0.65 + 0.35 * Math.sin(now / 45) : 1;
    drawWrapped(ctx, ex(p), (x) => drawNibShape(ctx, x, ey(p), p.facing, flicker));
  }
  ctx.restore();
}

function drawFloats(ctx, floats, now) {
  ctx.font = `800 10px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    const age = (now - f.t0) / 1000;
    if (age > 1.1) { floats.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, 2.2 - age * 2);
    const y = f.y - 11 - age * 6; // above the catch spot so Nib never hides it
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
}

// --- bonus pickups -------------------------------------------------------------------
export function drawBonus(ctx, kind, x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
  switch (kind) {
    case 'byte':
      ctx.fillStyle = '#3cff8f'; ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#04210f'; for (let i = 0; i < 4; i++) ctx.fillRect(-3.5 + (i % 2) * 4, -3.5 + Math.floor(i / 2) * 4, 3, 3);
      break;
    case 'chip':
      ctx.fillStyle = '#5fb7ff'; ctx.fillRect(-4.5, -4, 9, 8);
      ctx.fillStyle = '#cfe9ff'; for (let i = -3; i <= 3; i += 3) { ctx.fillRect(i - 0.5, -6.5, 1, 2.5); ctx.fillRect(i - 0.5, 4, 1, 2.5); }
      break;
    case 'disk':
      ctx.strokeStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'gem':
      ctx.fillStyle = '#4ff0ff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, -1); ctx.lineTo(0, 6); ctx.lineTo(-6, -1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-1, -4, 2, 3);
      break;
    case 'bolt':
      ctx.fillStyle = '#fff04d'; ctx.beginPath(); ctx.moveTo(1, -7); ctx.lineTo(-5, 1); ctx.lineTo(-0.5, 1); ctx.lineTo(-2, 7); ctx.lineTo(5, -1.5); ctx.lineTo(0.5, -1.5); ctx.closePath(); ctx.fill();
      break;
    case 'key':
      ctx.strokeStyle = '#ff9f43'; ctx.beginPath(); ctx.arc(-2.5, -2.5, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.5, -0.5); ctx.lineTo(5, 5); ctx.moveTo(3, 3); ctx.lineTo(4.5, 1.5); ctx.stroke();
      break;
    case 'prism':
      ctx.fillStyle = '#ff5ad1'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7cf9ff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(1.5, 5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      break;
    case 'crown':
    default:
      ctx.fillStyle = '#ffdf4d'; ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-6, -4); ctx.lineTo(-3, 0); ctx.lineTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// --- HUD -----------------------------------------------------------------------------
function drawHud(ctx, s, ui) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `800 10px ${SANS}`;
  ctx.fillStyle = 'rgba(62, 242, 255, 0.8)';
  ctx.fillText('SCORE', 10, 16);
  ctx.textAlign = 'center';
  ctx.fillText('HIGH SCORE', VIEW_W / 2 - 10, 16);
  ctx.font = `700 ${HUD_DIGITS}px ${MONO}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(String(s.score), 10, 38);
  ctx.textAlign = 'center';
  ctx.fillText(String(s.high), VIEW_W / 2 - 10, 38);

  // Bottom HUD: reserve lives, level and recent bonus icons.
  const by = (MAZE_TOP + MAZE_ROWS) * TILE + TILE; // centre of the two bottom rows
  if (s.phase !== 'start') {
    const reserve = Math.max(0, s.lives - 1);
    for (let i = 0; i < Math.min(reserve, 6); i++) drawNibShape(ctx, 16 + i * 20, by, 3, 1, 6);
  }
  ctx.textAlign = 'right';
  ctx.font = `700 11px ${MONO}`;
  ctx.fillStyle = 'rgba(233, 247, 255, 0.85)';
  const lvText = `LV ${s.level}`;
  ctx.fillText(lvText, VIEW_W - 8, by + 4);
  const first = Math.max(1, s.level - 6);
  let x = VIEW_W - 8 - ctx.measureText(lvText).width - 14;
  for (let L = s.level; L >= first; L--) { drawBonus(ctx, getLevel(L).bonus.kind, x, by, 0.85); x -= 17; }

  if (ui.muted) {
    ctx.textAlign = 'center';
    ctx.font = `800 9px ${SANS}`;
    ctx.fillStyle = '#ff3dac';
    ctx.fillText('SOUND OFF', VIEW_W / 2 - 40, by + 3);
  }
}

// --- overlays --------------------------------------------------------------------------
function glowText(ctx, text, x, y, font, color, blur = 10) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function messageBox(ctx, y, h = 22) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(9 * TILE, y - h / 2, 10 * TILE, h);
}

function drawOverlay(ctx, s, now, ui) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const msgY = (MAZE_TOP + 17) * TILE + 8; // just below the Forge
  const blink = Math.floor(now / 450) % 2 === 0;

  if (s.phase === 'start') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, MAZE_Y, VIEW_W, MAZE_H);
    glowText(ctx, 'NEON', VIEW_W / 2, 112, `900 46px ${SANS}`, '#ff3dac', 16);
    glowText(ctx, 'NIBBLER', VIEW_W / 2, 158, `900 46px ${SANS}`, NIB, 16);
    drawNibShape(ctx, VIEW_W / 2, 206, 3, 0.7 + 0.3 * Math.sin(now / 120), 10);
    ctx.font = `700 11px ${SANS}`;
    ctx.fillStyle = 'rgba(233,247,255,0.7)';
    ctx.fillText('THE GLITCHES', VIEW_W / 2, 244);
    GLITCH_INFO.forEach((info, i) => {
      const y = 272 + i * 30;
      drawGlitchIcon(ctx, info, 112, y);
      ctx.textAlign = 'left';
      ctx.font = `800 14px ${SANS}`;
      ctx.fillStyle = info.color;
      ctx.fillText(info.name.toUpperCase(), 132, y);
      ctx.font = `500 11px ${SANS}`;
      ctx.fillStyle = 'rgba(233,247,255,0.75)';
      ctx.fillText(info.role, 222, y + 1);
      ctx.textAlign = 'center';
    });
    ctx.font = `700 12px ${SANS}`;
    ctx.fillStyle = 'rgba(233,247,255,0.9)';
    ctx.fillText(ui.isTouch ? 'SWIPE ANYWHERE TO STEER' : 'ARROW KEYS OR WASD TO STEER', VIEW_W / 2, 408);
    ctx.font = `500 11px ${SANS}`;
    ctx.fillStyle = 'rgba(233,247,255,0.65)';
    ctx.fillText('Spark 10  ·  Surge Core 50  ·  Overloaded Glitch 200+', VIEW_W / 2, 428);
    if (!ui.isTouch) ctx.fillText('P pause  ·  M sound', VIEW_W / 2, 446);
    if (blink) glowText(ctx, ui.isTouch ? 'TAP TO START' : 'PRESS ENTER TO START', VIEW_W / 2, 488, `900 18px ${SANS}`, '#ffe066', 8);
    return;
  }
  if (s.phase === 'ready') {
    messageBox(ctx, msgY);
    glowText(ctx, 'READY', VIEW_W / 2, msgY + 1, `900 15px ${SANS}`, '#ffe066', 8);
  }
  if (s.phase === 'gameOver') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, MAZE_Y, VIEW_W, MAZE_H);
    glowText(ctx, 'GAME OVER', VIEW_W / 2, 250, `900 34px ${SANS}`, '#ff3dac', 14);
    ctx.font = `700 16px ${MONO}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE ${s.score}`, VIEW_W / 2, 296);
    if (s.score >= s.high && s.score > 0) { ctx.font = `800 12px ${SANS}`; ctx.fillStyle = '#ffe066'; ctx.fillText('NEW HIGH SCORE', VIEW_W / 2, 320); }
    if (s.phaseTimer <= 0 && blink) glowText(ctx, ui.isTouch ? 'TAP TO CONTINUE' : 'PRESS ENTER TO CONTINUE', VIEW_W / 2, 380, `900 15px ${SANS}`, '#ffe066', 8);
  }
  if (s.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, MAZE_Y, VIEW_W, MAZE_H);
  } else if (s.countdown > 0) {
    const n = Math.ceil(s.countdown / (COUNTDOWN_STEPS / 3));
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, MAZE_Y, VIEW_W, MAZE_H);
    glowText(ctx, String(n), VIEW_W / 2, MAZE_Y + MAZE_H / 2, `900 64px ${SANS}`, NIB, 18);
  }
}

function hexA(hex, a) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export { VIEW_H };
