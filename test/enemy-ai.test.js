import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMaze, tileCenter } from '../src/core/maze.js';
import { createRng } from '../src/core/rng.js';
import { getLevel } from '../src/core/levels.js';
import {
  chaseTarget, scatterTarget, chooseDirection, chooseRandomDirection, allowedExits, glitchSpeed,
  ROOK, LURE, SPLICE, SKITTER, GLITCH_INFO,
} from '../src/core/enemies.js';
import { UP, LEFT, DOWN, RIGHT, opposite } from '../src/core/constants.js';

const maze = parseMaze();

test('four distinct glitches: names, colours and shapes all differ', () => {
  assert.equal(GLITCH_INFO.length, 4);
  for (const key of ['name', 'color', 'shape']) assert.equal(new Set(GLITCH_INFO.map((g) => g[key])).size, 4);
});

test('scatter targets are fixed corners outside the maze', () => {
  assert.deepEqual(scatterTarget(ROOK), { x: 25, y: -3 });   // top-right
  assert.ok(scatterTarget(LURE).x < 14 && scatterTarget(LURE).y < 0);     // top-left
  assert.ok(scatterTarget(SPLICE).x > 14 && scatterTarget(SPLICE).y > 30); // bottom-right
  assert.ok(scatterTarget(SKITTER).x < 14 && scatterTarget(SKITTER).y > 30); // bottom-left
});

const nib = (tx, ty, facing) => ({ tx, ty, facing });

test('Rook chase targets Nib\'s tile', () => {
  assert.deepEqual(chaseTarget(ROOK, { tx: 1, ty: 1 }, nib(10, 20, LEFT), { tx: 1, ty: 1 }), { x: 10, y: 20 });
});

test('Lure chase targets 4 tiles ahead of Nib', () => {
  assert.deepEqual(chaseTarget(LURE, { tx: 1, ty: 1 }, nib(10, 20, LEFT), { tx: 1, ty: 1 }), { x: 6, y: 20 });
});

test('Splice flank vector: Nib (10,20) up, Rook (8,22) -> (12,14)', () => {
  assert.deepEqual(chaseTarget(SPLICE, { tx: 1, ty: 1 }, nib(10, 20, UP), { tx: 8, ty: 22 }), { x: 12, y: 14 });
});

test('Skitter chases when far, retreats to its corner when within 8 tiles', () => {
  assert.deepEqual(chaseTarget(SKITTER, { tx: 10, ty: 8 }, nib(10, 20, LEFT), null), { x: 10, y: 20 }); // 12 away
  assert.deepEqual(chaseTarget(SKITTER, { tx: 10, ty: 15 }, nib(10, 20, LEFT), null), scatterTarget(SKITTER)); // 5 away
  assert.deepEqual(chaseTarget(SKITTER, { tx: 10, ty: 12 }, nib(10, 20, LEFT), null), scatterTarget(SKITTER)); // exactly 8
});

test('decision: picks the exit whose next tile is closest to the target', () => {
  // Tile (5,8) heading down: exits left and down (up is a reversal, right is a wall).
  assert.deepEqual(allowedExits(maze, 5, 8, DOWN).sort(), [LEFT, DOWN].sort());
  assert.equal(chooseDirection(maze, 5, 8, DOWN, { x: 0, y: 8 }), LEFT);
  assert.equal(chooseDirection(maze, 5, 8, DOWN, { x: 5, y: 30 }), DOWN);
});

test('decision: ties broken in order up, left, down, right', () => {
  // Tile (5,5) heading right: exits up, down, right. Target equidistant above/below.
  assert.equal(chooseDirection(maze, 5, 5, RIGHT, { x: 5, y: 5 }), UP);
});

test('decision: never reverses voluntarily', () => {
  // Row 1, col 3 heading right: only right and left are open; left is closer but is a reversal.
  assert.equal(chooseDirection(maze, 3, 1, RIGHT, { x: 0, y: 1 }), RIGHT);
});

test('decision: never enters the Forge door', () => {
  // Tile (13,11) is above the door: down must never be chosen even if the target is inside.
  assert.notEqual(chooseDirection(maze, 13, 11, LEFT, { x: 13, y: 14 }), DOWN);
  assert.ok(!allowedExits(maze, 13, 11, LEFT).includes(DOWN));
});

test('overloaded wandering is seeded: same seed same choices, always an allowed exit', () => {
  const a = createRng(5), b = createRng(5);
  const exits = allowedExits(maze, 5, 5, RIGHT);
  const seenDirs = new Set();
  for (let i = 0; i < 50; i++) {
    const da = chooseRandomDirection(maze, 5, 5, RIGHT, a);
    assert.equal(da, chooseRandomDirection(maze, 5, 5, RIGHT, b));
    assert.ok(exits.includes(da));
    assert.notEqual(da, opposite(RIGHT));
    seenDirs.add(da);
  }
  assert.ok(seenDirs.size > 1, 'uses more than one exit');
});

test('speeds: tunnel slower than corridor, overloaded slower, fragments fastest', () => {
  const lvl = getLevel(1);
  const g = { state: 'active', frightened: false, x: tileCenter(5), y: tileCenter(5) };
  const corridor = glitchSpeed(g, lvl, maze);
  const tunnel = glitchSpeed({ ...g, x: tileCenter(1), y: tileCenter(maze.tunnelRow) }, lvl, maze);
  const fright = glitchSpeed({ ...g, frightened: true }, lvl, maze);
  const frag = glitchSpeed({ ...g, state: 'fragment' }, lvl, maze);
  assert.ok(tunnel < corridor);
  assert.ok(fright < corridor);
  for (let L = 1; L <= 25; L++) {
    const l = getLevel(L);
    assert.ok(l.fragmentSpeed > Math.max(l.nibSpeed, l.glitchSpeed), `level ${L}`);
  }
  assert.ok(frag > corridor);
});
