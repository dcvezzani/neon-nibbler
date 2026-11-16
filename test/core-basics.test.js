import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { parseMaze, validateLayout, WHO_PLAYER, WHO_GLITCH, WHO_GLITCH_HOME, tileCenter } from '../src/core/maze.js';
import { UNITS, LEFT, RIGHT, UP, DOWN, NONE, MAZE_W_UNITS, COLS } from '../src/core/constants.js';
import { advance, atCenter, tileX, tileY } from '../src/core/movement.js';

test('rng: same seed gives same sequence, different seeds differ', () => {
  const a = createRng(42), b = createRng(42), c = createRng(7);
  const sa = Array.from({ length: 20 }, () => a.next());
  const sb = Array.from({ length: 20 }, () => b.next());
  const sc = Array.from({ length: 20 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});

const maze = parseMaze();

test('maze: layout passes validateLayout (symmetry, connected, no dead ends, 4 cores, count)', () => {
  const { problems } = validateLayout(maze);
  assert.deepEqual(problems, []);
  const total = maze.sparks.length + maze.cores.length;
  assert.ok(total >= 220 && total <= 260, `total ${total}`);
});

test('maze: walls are never walkable; Forge and door only for glitches going home', () => {
  assert.equal(maze.walkable(0, 0, WHO_PLAYER), false);
  assert.equal(maze.walkable(0, 0, WHO_GLITCH_HOME), false);
  // door at row 12, cols 13-14; Forge interior row 13
  assert.equal(maze.walkable(13, 12, WHO_PLAYER), false);
  assert.equal(maze.walkable(13, 12, WHO_GLITCH), false);
  assert.equal(maze.walkable(13, 12, WHO_GLITCH_HOME), true);
  assert.equal(maze.walkable(13, 13, WHO_PLAYER), false);
  assert.equal(maze.walkable(13, 13, WHO_GLITCH_HOME), true);
  assert.equal(maze.walkable(1, 1, WHO_PLAYER), true);
});

test('maze: tunnel wraps on both edges', () => {
  const r = maze.tunnelRow;
  assert.ok(r > 10 && r < 20);
  assert.equal(maze.walkable(-1, r, WHO_PLAYER), true);   // left of col 0 -> col 27
  assert.equal(maze.walkable(COLS, r, WHO_PLAYER), true); // right of col 27 -> col 0
  assert.equal(maze.wrapX(-1), 27);
  assert.equal(maze.wrapX(28), 0);
});

const straight = (e, tx, ty) => (maze.walkable(tx + [0, -1, 0, 1][e.dir], ty + [-1, 0, 1, 0][e.dir]) ? e.dir : NONE);

test('movement: entity stops at the centre of the tile before a wall', () => {
  const e = { x: tileCenter(3), y: tileCenter(1), dir: LEFT, moving: true };
  for (let i = 0; i < 100; i++) advance(e, 30, straight);
  assert.equal(e.x, tileCenter(1));
  assert.equal(e.moving, false);
  assert.ok(atCenter(e));
});

test('movement: never skips a tile centre (decide called once per tile)', () => {
  const e = { x: tileCenter(1), y: tileCenter(1), dir: RIGHT, moving: true };
  const seen = [];
  for (let i = 0; i < 200 && e.moving; i++) advance(e, 64, (en, tx, ty) => { seen.push(tx); return straight(en, tx, ty); });
  for (let i = 1; i < seen.length; i++) assert.equal(seen[i], seen[i - 1] + 1);
  assert.equal(seen.at(-1), 26);
});

test('movement: leaving the left edge on the tunnel row reappears on the right, same direction', () => {
  const r = maze.tunnelRow;
  const e = { x: tileCenter(0), y: tileCenter(r), dir: LEFT, moving: true };
  advance(e, UNITS, straight);
  assert.equal(tileX(e), 27);
  assert.equal(e.dir, LEFT);
  assert.ok(e.x >= 0 && e.x < MAZE_W_UNITS);
  const f = { x: tileCenter(27), y: tileCenter(r), dir: RIGHT, moving: true };
  advance(f, UNITS, straight);
  assert.equal(tileX(f), 0);
  assert.equal(f.dir, RIGHT);
  assert.equal(tileY(f), r);
});
