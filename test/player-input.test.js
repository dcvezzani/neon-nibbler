import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMaze, tileCenter } from '../src/core/maze.js';
import { createPlayer, setIntent, updatePlayer } from '../src/core/player.js';
import { createSwipe } from '../src/core/swipe.js';
import { createStepper } from '../src/core/loop.js';
import { UP, DOWN, LEFT, RIGHT, NONE, UNITS } from '../src/core/constants.js';
import { tileX, tileY } from '../src/core/movement.js';

const maze = parseMaze();
function at(col, row, dir) {
  const p = createPlayer(maze);
  p.x = tileCenter(col); p.y = tileCenter(row); p.dir = dir; p.facing = dir; p.moving = true;
  return p;
}
function run(p, steps, speed = 26, from = 0) {
  for (let s = from; s < from + steps; s++) updatePlayer(p, maze, speed, s);
}

test('player: keeps moving without input and stops at a wall', () => {
  const p = at(5, 1, LEFT);
  run(p, 200);
  assert.equal(tileX(p), 1);
  assert.equal(p.moving, false);
  assert.equal(p.x, tileCenter(1));
});

test('player: early turn executes at the intersection (buffering)', () => {
  // Row 5 moving left from col 13; first upward opening is col 11, two tiles away.
  const p = at(13, 5, LEFT);
  setIntent(p, UP, 0);
  run(p, 25);
  assert.equal(p.dir, UP);
  assert.equal(tileX(p), 11);
  assert.ok(tileY(p) <= 5);
});

test('player: buffered turn expires after 0.5 s', () => {
  // From col 10 the next upward opening is col 5, ~49 steps away at speed 26.
  const p = at(10, 5, LEFT);
  setIntent(p, UP, 0);
  run(p, 70);
  assert.equal(p.intent, null);
  assert.equal(tileY(p), 5, 'stayed on row 5');
  assert.ok(tileX(p) < 5, 'passed col 5 without turning');
});

test('player: newer input replaces the buffered one', () => {
  const p = at(12, 5, LEFT);
  setIntent(p, UP, 0);
  setIntent(p, DOWN, 1);
  let turnedUp = false;
  for (let s = 1; s < 30; s++) { updatePlayer(p, maze, 40, s); if (p.dir === UP) turnedUp = true; }
  assert.equal(turnedUp, false, 'did not take the replaced Up turn at col 11');
  assert.equal(p.dir, DOWN);
  assert.equal(tileX(p), 8);
});

test('player: reverses instantly mid-tile', () => {
  const p = at(3, 1, RIGHT);
  p.x += UNITS / 2; // halfway between tiles 3 and 4
  const x0 = p.x;
  setIntent(p, LEFT, 0);
  updatePlayer(p, maze, 26, 0);
  assert.equal(p.dir, LEFT);
  assert.equal(p.x, x0 - 26);
});

test('player: stopped at a wall starts again when an open direction is pressed', () => {
  const p = at(2, 1, LEFT);
  run(p, 30);
  assert.equal(p.moving, false);
  setIntent(p, DOWN, 30);
  run(p, 5, 26, 30);
  assert.equal(p.moving, true);
  assert.equal(p.dir, DOWN);
});

test('swipe: direction registers after 20 px, before lift', () => {
  const s = createSwipe(20);
  s.start(100, 100);
  assert.equal(s.move(90, 102), NONE);
  assert.equal(s.move(80, 104), LEFT); // 20 px left, 4 px down
  assert.equal(s.move(70, 105), NONE); // same direction: no repeat
  assert.equal(s.end(), false);
});

test('swipe: tiny movement registers nothing and counts as a tap', () => {
  const s = createSwipe(20);
  s.start(50, 50);
  assert.equal(s.move(60, 55), NONE);
  assert.equal(s.end(), true);
});

test('swipe: L-shaped drag registers Left then Up without lifting', () => {
  const s = createSwipe(20);
  s.start(200, 200);
  const out = [];
  for (let i = 1; i <= 30; i++) { const d = s.move(200 - i, 200); if (d !== NONE) out.push(d); }
  for (let i = 1; i <= 30; i++) { const d = s.move(170, 200 - i); if (d !== NONE) out.push(d); }
  assert.deepEqual(out, [LEFT, UP]);
});

test('loop: same game time at 30 and 144 fps gives the same distance', () => {
  function simulate(fps) {
    const p = at(1, 5, RIGHT);
    let s = 0;
    const stepper = createStepper(() => { updatePlayer(p, maze, 26, s++); });
    for (let i = 0; i < fps * 2; i++) stepper.advance(1000 / fps);
    return { steps: s, x: p.x };
  }
  const a = simulate(30), b = simulate(144);
  assert.equal(a.steps, 120);
  assert.equal(b.steps, 120);
  assert.equal(a.x, b.x);
});
