// Nib: continuous movement, instant reversal and buffered turns.
import { DX, DY, NONE, BUFFER_STEPS, opposite, LEFT } from './constants.js';
import { tileCenter, WHO_PLAYER } from './maze.js';
import { advance, atCenter, tileX, tileY } from './movement.js';

export function createPlayer(maze) {
  const p = { x: 0, y: 0, dir: LEFT, facing: LEFT, moving: true, intent: null };
  resetPlayer(p, maze);
  return p;
}

export function resetPlayer(p, maze) {
  const [sx, sy] = maze.start;
  // Start on the line between the start tile and the tile to its right.
  p.x = tileCenter(sx) + tileCenter(0);
  p.y = tileCenter(sy);
  p.dir = LEFT;
  p.facing = LEFT;
  p.moving = true;
  p.intent = null;
}

/** Records a direction input. A newer input always replaces an older one. */
export function setIntent(p, dir, step) {
  p.intent = { dir, step };
}

/** Advances Nib by `speed` units for one simulation step. */
export function updatePlayer(p, maze, speed, step) {
  const it = p.intent;
  if (it && step - it.step >= BUFFER_STEPS) p.intent = null;

  if (p.intent) {
    const d = p.intent.dir;
    if (p.moving && d === p.dir) {
      p.intent = null; // already going that way
    } else if (p.moving && d === opposite(p.dir)) {
      p.dir = d; // instant reversal, anywhere
      p.facing = d;
      p.intent = null;
    } else if (!p.moving && atCenter(p) && maze.walkable(tileX(p) + DX[d], tileY(p) + DY[d], WHO_PLAYER)) {
      p.dir = d;
      p.facing = d;
      p.moving = true;
      p.intent = null;
    }
  }
  if (!p.moving) return 0;

  return advance(p, speed, (e, tx, ty) => {
    const want = e.intent ? e.intent.dir : NONE;
    if (want !== NONE && maze.walkable(tx + DX[want], ty + DY[want], WHO_PLAYER)) {
      e.intent = null;
      e.facing = want;
      return want;
    }
    if (maze.walkable(tx + DX[e.dir], ty + DY[e.dir], WHO_PLAYER)) return e.dir;
    return NONE; // wall ahead: stop at this centre
  });
}
