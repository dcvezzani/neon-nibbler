import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, collides, isFlashing, SPARK, CORE, READY_STEPS, DYING_STEPS, CATCH_STEPS,
  LEVEL_CLEAR_STEPS, GAME_OVER_LOCK_STEPS, COUNTDOWN_STEPS, BONUS_STEPS, BONUS_TILE,
} from '../src/core/game.js';
import { getLevel, overloadSeconds } from '../src/core/levels.js';
import { tileCenter } from '../src/core/maze.js';
import { tileX, tileY } from '../src/core/movement.js';
import { COLS, MAZE_ROWS, UP, DOWN, LEFT, RIGHT, secs } from '../src/core/constants.js';
import { ROOK, LURE, SPLICE, SKITTER } from '../src/core/enemies.js';

function started(seed = 1) {
  const game = createGame({ seed });
  game.newGame();
  game.drainEvents();
  return game;
}
function toPlaying(game) { while (game.phase === 'ready') game.step(); }
/** Keep every Glitch in the Forge and never release them. */
function lockForge(game, keepRook = false) {
  const s = game.state;
  s.lvl = { ...s.lvl, releaseSparks: [Infinity, Infinity, Infinity], idleReleaseSteps: Infinity };
  if (!keepRook) {
    const r = s.glitches[ROOK];
    r.state = 'house'; r.x = 14 * 256; r.y = tileCenter(14);
  }
}
const idx = (x, y) => y * COLS + x;
function putUnderNib(game, item) {
  const s = game.state;
  const i = idx(tileX(s.player), tileY(s.player));
  if (!s.items[i]) s.remaining += 1;
  s.items[i] = item;
}
function stepUntil(game, pred, max = 5000) {
  for (let i = 0; i < max; i++) { if (pred()) return i; game.step(); }
  throw new Error('condition not reached');
}

// --- collectibles -------------------------------------------------------------
test('fresh level is fully stocked; tunnel, start and Forge surroundings hold nothing', () => {
  const game = started();
  const s = game.state;
  const total = s.maze.sparks.length + s.maze.cores.length;
  assert.equal(s.remaining, total);
  const layout = s.maze.layout;
  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = layout[y][x];
      const item = game.itemAt(x, y);
      if (ch === '.') assert.equal(item, SPARK);
      else if (ch === 'o') assert.equal(item, CORE);
      else assert.equal(item, 0, `tile ${x},${y} '${ch}'`);
    }
  }
  assert.equal(game.itemAt(0, s.maze.tunnelRow), 0);
  assert.equal(game.itemAt(...s.maze.start), 0);
  assert.equal(game.itemAt(12, 11), 0); // ring above the Forge
});

test('eating a spark adds 10, eating a core adds 50 and Overloads every glitch not going home', () => {
  const game = started();
  toPlaying(game);
  lockForge(game, true);
  const s = game.state;
  s.player.moving = false;
  putUnderNib(game, SPARK);
  game.step();
  assert.equal(s.score, 10);
  assert.ok(game.drainEvents().some((e) => e.type === 'spark'));
  s.glitches[SPLICE].state = 'fragment';
  putUnderNib(game, CORE);
  game.step();
  assert.equal(s.score, 60);
  assert.equal(s.glitches[ROOK].frightened, true);
  assert.equal(s.glitches[LURE].frightened, true);       // waiting in the Forge
  assert.equal(s.glitches[SPLICE].frightened, false);    // returning home
  assert.equal(s.overloadTimer > 0, true);
});

function catchGlitch(game, id) {
  const s = game.state;
  const gl = s.glitches[id];
  gl.state = 'active';
  gl.x = tileCenter(tileX(s.player)); gl.y = tileCenter(tileY(s.player));
  game.step();
  const ev = game.drainEvents().find((e) => e.type === 'catch');
  while (game.phase === 'catch') game.step();
  return ev;
}

test('catch combo: 200, 400, 800, 1600 within one Overload (total 3000)', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  putUnderNib(game, CORE);
  game.step();
  const base = s.score;
  const pts = [ROOK, LURE, SPLICE, SKITTER].map((id) => {
    s.glitches[id].frightened = true;
    return catchGlitch(game, id).points;
  });
  assert.deepEqual(pts, [200, 400, 800, 1600]);
  assert.equal(s.score - base, 3000);
});

test('catch pause freezes play for about half a second', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  putUnderNib(game, CORE);
  game.step();
  const gl = s.glitches[ROOK];
  gl.state = 'active'; gl.x = tileCenter(tileX(s.player)); gl.y = tileCenter(tileY(s.player));
  game.step();
  assert.equal(game.phase, 'catch');
  const frag = [gl.x, gl.y];
  for (let i = 0; i < CATCH_STEPS - 1; i++) game.step();
  assert.deepEqual([gl.x, gl.y], frag, 'nothing moves during the catch pause');
  game.step();
  assert.equal(game.phase, 'playing');
});

test('a new core restarts the combo at 200', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  putUnderNib(game, CORE); game.step();
  s.glitches[ROOK].frightened = true; catchGlitch(game, ROOK);
  s.glitches[LURE].frightened = true; catchGlitch(game, LURE);
  putUnderNib(game, CORE); game.step();
  s.glitches[SPLICE].frightened = true;
  assert.equal(catchGlitch(game, SPLICE).points, 200);
});

test('extra life once when the score first reaches 10,000', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  s.score = 9995;
  putUnderNib(game, SPARK); game.step();
  assert.equal(s.lives, 4);
  assert.ok(game.drainEvents().some((e) => e.type === 'extraLife'));
  s.score = 19995;
  putUnderNib(game, SPARK); game.step();
  assert.equal(s.lives, 4);
});

test('bonus appears after 70 eaten, is collected for its value, and expires otherwise', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  s.eatenThisLevel = 69;
  putUnderNib(game, SPARK); game.step();
  assert.ok(s.bonus, 'bonus spawned');
  assert.equal(s.bonus.value, getLevel(1).bonus.value);
  const before = s.score;
  s.player.x = tileCenter(BONUS_TILE.x); s.player.y = tileCenter(BONUS_TILE.y);
  game.step();
  assert.equal(s.bonus, null);
  assert.equal(s.score, before + 100);
  const ev = game.drainEvents().find((e) => e.type === 'bonus');
  assert.equal(ev.points, 100);

  // Second bonus at 170: let it expire.
  s.player.x = tileCenter(1); s.player.y = tileCenter(1); s.player.moving = false;
  s.eatenThisLevel = 169;
  putUnderNib(game, SPARK); game.step();
  assert.ok(s.bonus);
  const score = s.score;
  for (let i = 0; i < BONUS_STEPS; i++) game.step();
  assert.equal(s.bonus, null);
  assert.equal(s.score, score);
  assert.ok(game.drainEvents().some((e) => e.type === 'bonusExpire'));
});

test('bonus value rises with level: 100 at level 1 up to 5000 from level 13', () => {
  assert.equal(getLevel(1).bonus.value, 100);
  assert.equal(getLevel(13).bonus.value, 5000);
  assert.equal(getLevel(40).bonus.value, 5000);
  for (let L = 1; L < 13; L++) assert.ok(getLevel(L + 1).bonus.value >= getLevel(L).bonus.value);
});

// --- enemy modes and release ---------------------------------------------------
test('mode schedule: Scatter -> Chase after 7 s at level 1, and active glitches reverse', () => {
  const game = started();
  toPlaying(game);
  lockForge(game, true); // only Rook moves, Nib parked at the start
  const s = game.state;
  s.player.moving = false;
  assert.equal(game.mode, 'scatter');
  for (let i = 0; i < secs(7) - 1; i++) game.step();
  assert.equal(game.mode, 'scatter');
  const before = s.glitches[ROOK].dir;
  game.step();
  assert.equal(game.mode, 'chase');
  assert.equal(s.glitches[ROOK].dir, (before + 2) % 4);
});

test('Overload pauses the schedule: 6 s Overload 3 s into Scatter -> Chase 4 s after it ends', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  for (let i = 0; i < secs(3); i++) game.step();
  putUnderNib(game, CORE);
  let endTick = null, changeTick = null;
  for (let i = 0; i < secs(20) && changeTick === null; i++) {
    game.step();
    for (const e of game.drainEvents()) {
      if (e.type === 'overloadEnd') endTick = e.tick;
      if (e.type === 'modeChange') changeTick = e.tick;
    }
  }
  assert.ok(endTick !== null);
  assert.ok(Math.abs(changeTick - endTick - secs(4)) <= 1, `change ${changeTick - endTick} steps after Overload`);
});

test('overload warning flash covers only the last 2 seconds', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  putUnderNib(game, CORE);
  game.step();
  assert.equal(isFlashing(s), false);
  while (s.overloadTimer > secs(2)) game.step();
  assert.equal(isFlashing(s), true);
});

test('level 21+: a core gives no vulnerable time, Glitches only reverse', () => {
  assert.equal(overloadSeconds(21), 0);
  const game = started();
  const s = game.state;
  s.level = 21; s.lvl = getLevel(21);
  toPlaying(game);
  lockForge(game, true);
  s.player.moving = false;
  for (let i = 0; i < 20; i++) game.step();
  const dir = s.glitches[ROOK].dir;
  putUnderNib(game, CORE);
  game.step();
  assert.equal(s.glitches[ROOK].frightened, false);
  assert.equal(s.overloadTimer, 0);
  assert.notEqual(s.glitches[ROOK].dir, dir);
});

test('release order: Lure, then Splice, then Skitter', () => {
  const game = started(3);
  const s = game.state;
  const order = [];
  for (let i = 0; i < secs(30) && order.length < 3; i++) {
    game.step();
    if (game.phase !== 'playing' && game.phase !== 'ready' && game.phase !== 'catch') break;
    for (const id of [LURE, SPLICE, SKITTER]) if (s.glitches[id].state !== 'house' && !order.includes(id)) order.push(id);
  }
  assert.deepEqual(order, [LURE, SPLICE, SKITTER]);
});

test('idle timer releases the next waiting glitch when Nib eats nothing', () => {
  const game = started();
  toPlaying(game);
  const s = game.state;
  s.player.moving = false; // eats nothing
  game.step();
  assert.equal(s.glitches[LURE].state, 'leaving'); // threshold 0
  assert.equal(s.glitches[SPLICE].state, 'house');
  for (let i = 0; i < s.lvl.idleReleaseSteps - 2; i++) game.step();
  assert.equal(s.glitches[SPLICE].state, 'house');
  game.step(); game.step();
  assert.notEqual(s.glitches[SPLICE].state, 'house');
});

test('caught glitch returns to the Forge as a fragment, enters, and leaves in normal mode', () => {
  const game = started();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  s.player.x = tileCenter(1); s.player.y = tileCenter(29);
  putUnderNib(game, CORE); game.step();
  const gl = s.glitches[ROOK];
  gl.frightened = true;
  catchGlitch(game, ROOK);
  assert.equal(gl.state, 'fragment');
  const seen = new Set();
  stepUntil(game, () => { seen.add(gl.state); return gl.state === 'active' && seen.has('leaving'); }, secs(30));
  assert.ok(seen.has('entering'));
  assert.equal(gl.frightened, false);
  assert.equal(gl.state, 'active');
});

// --- flow ------------------------------------------------------------------------
test('collision: same tile and swapped tiles (including across the tunnel edge)', () => {
  assert.equal(collides([5, 5], [6, 5], [7, 5], [6, 5]), true);
  assert.equal(collides([5, 5], [6, 5], [6, 5], [5, 5]), true);
  assert.equal(collides([27, 14], [0, 14], [0, 14], [27, 14]), true);
  assert.equal(collides([5, 5], [6, 5], [8, 5], [7, 5]), false);
});

test('losing a life: lives drop, positions reset, eaten sparks stay eaten, READY round starts', () => {
  const game = started();
  toPlaying(game);
  const s = game.state;
  for (let i = 0; i < 30; i++) game.step();
  const remaining = s.remaining;
  const eatenTile = s.maze.sparks.find(([x, y]) => game.itemAt(x, y) === 0);
  assert.ok(eatenTile, 'some spark was eaten');
  const rook = s.glitches[ROOK];
  rook.state = 'active'; rook.frightened = false; rook.x = s.player.x; rook.y = s.player.y;
  game.step();
  assert.equal(game.phase, 'dying');
  for (let i = 0; i < DYING_STEPS; i++) game.step();
  assert.equal(s.lives, 2);
  assert.equal(game.phase, 'ready');
  assert.equal(s.remaining, remaining);
  assert.equal(game.itemAt(...eatenTile), 0);
  assert.equal(tileY(s.player), s.maze.start[1]);
  assert.equal(s.glitches[LURE].state, 'house');
});

test('READY: nothing moves for about 2 seconds, then play starts', () => {
  const game = started();
  const s = game.state;
  const pos = [s.player.x, s.glitches[ROOK].x];
  for (let i = 0; i < READY_STEPS - 1; i++) game.step();
  assert.deepEqual([s.player.x, s.glitches[ROOK].x], pos);
  game.step();
  assert.equal(game.phase, 'playing');
});

test('clearing the maze flashes then starts level 2 with everything restored', () => {
  const game = started();
  toPlaying(game);
  const s = game.state;
  s.player.moving = false;
  s.items.fill(0);
  s.remaining = 0;
  putUnderNib(game, SPARK);
  game.step();
  assert.equal(game.phase, 'levelClear');
  for (let i = 0; i < LEVEL_CLEAR_STEPS; i++) game.step();
  assert.equal(s.level, 2);
  assert.equal(s.remaining, s.maze.sparks.length + s.maze.cores.length);
  assert.equal(game.phase, 'ready');
});

test('difficulty progression to level 21: never easier, harder each level until limits', () => {
  for (let L = 1; L <= 20; L++) {
    const a = getLevel(L), b = getLevel(L + 1);
    assert.ok(b.glitchSpeed >= a.glitchSpeed, `speed L${L + 1}`);
    assert.ok(b.overloadSteps <= a.overloadSteps, `overload L${L + 1}`);
    assert.ok(b.glitchSpeed > a.glitchSpeed || b.overloadSteps < a.overloadSteps, `L${L + 1} harder than L${L}`);
  }
  for (const L of [21, 22, 30]) assert.equal(getLevel(L).overloadSteps, 0);
});

test('game over on the last life; input locked for 1 s; then back to start', () => {
  const game = started();
  toPlaying(game);
  const s = game.state;
  s.lives = 1;
  const rook = s.glitches[ROOK];
  rook.state = 'active'; rook.x = s.player.x; rook.y = s.player.y;
  game.step();
  for (let i = 0; i < DYING_STEPS; i++) game.step();
  assert.equal(game.phase, 'gameOver');
  game.confirm();
  assert.equal(game.phase, 'gameOver', 'touch during lock is ignored');
  for (let i = 0; i < GAME_OVER_LOCK_STEPS; i++) game.step();
  game.confirm();
  assert.equal(game.phase, 'start');
});

test('high score updates live while the score is higher', () => {
  const game = createGame({ highScore: 15 });
  game.newGame();
  toPlaying(game);
  lockForge(game);
  const s = game.state;
  s.player.moving = false;
  putUnderNib(game, SPARK); game.step();
  assert.equal(s.high, 15);
  putUnderNib(game, SPARK); game.step();
  assert.equal(s.high, 20);
});

test('pause: no game time passes while paused or during the 3-2-1 countdown', () => {
  const game = started();
  toPlaying(game);
  for (let i = 0; i < 100; i++) game.step();
  const snap = game.snapshot();
  assert.equal(game.pause(), true);
  for (let i = 0; i < 300; i++) game.step();
  assert.equal(game.snapshot(), snap);
  game.resume();
  for (let i = 0; i < COUNTDOWN_STEPS; i++) game.step();
  assert.equal(game.snapshot(), snap);
  game.step();
  assert.notEqual(game.snapshot(), snap);
});

test('quit from pause returns to the start screen', () => {
  const game = started();
  toPlaying(game);
  game.pause();
  game.quit();
  assert.equal(game.phase, 'start');
  assert.equal(game.state.paused, false);
});

test('determinism: same seed and timed inputs give identical state at every step', () => {
  const script = new Map([[150, UP], [200, LEFT], [260, DOWN], [400, RIGHT], [520, UP], [700, LEFT], [900, DOWN], [1200, RIGHT]]);
  function run() {
    const game = createGame({ seed: 99 });
    game.newGame();
    const snaps = [];
    for (let t = 0; t < 4000; t++) {
      if (script.has(t % 1300)) game.setIntent(script.get(t % 1300));
      game.step();
      if (game.phase === 'gameOver') game.confirm();
      snaps.push(game.snapshot());
    }
    return snaps;
  }
  const a = run(), b = run();
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.equal(a[i], b[i], `step ${i}`);
});
