// Shared grid movement for Nib and the Glitches, in integer sub-pixel units.
// Entities travel along tile centre lines and only change direction at tile
// centres. A step that would pass a centre is split: move to the centre, ask
// `decide` for the direction to take, then spend the rest of the distance.
import { UNITS, HALF, DX, DY, NONE } from './constants.js';
import { unitToTile, wrapUnits } from './maze.js';

/** Distance from the entity to the next tile centre in its direction of travel. */
export function distanceToCenter(e) {
  const pos = DX[e.dir] !== 0 ? e.x : e.y;
  const sign = DX[e.dir] + DY[e.dir];
  const past = (((pos - HALF) % UNITS) + UNITS) % UNITS; // distance past the previous centre (+ direction)
  if (past === 0) return 0;
  return sign > 0 ? UNITS - past : past;
}

export const atCenter = (e) =>
  (((e.x - HALF) % UNITS) + UNITS) % UNITS === 0 && (((e.y - HALF) % UNITS) + UNITS) % UNITS === 0;

export const tileX = (e) => unitToTile(e.x);
export const tileY = (e) => unitToTile(e.y);

/**
 * Moves `e` up to `dist` units. `decide(e, tx, ty)` is called at every tile
 * centre reached (including the starting one) and returns the direction to
 * leave in, or NONE to stop there. Returns the distance actually moved.
 */
export function advance(e, dist, decide) {
  let moved = 0;
  let guard = 0;
  while (dist > 0 && e.dir !== NONE && guard++ < 8) {
    let step;
    if (atCenter(e)) {
      const nd = decide(e, tileX(e), tileY(e));
      if (nd === NONE) { e.moving = false; break; }
      e.dir = nd;
      step = Math.min(dist, UNITS);
    } else {
      step = Math.min(dist, distanceToCenter(e));
    }
    e.x = wrapUnits(e.x + DX[e.dir] * step);
    e.y += DY[e.dir] * step;
    dist -= step;
    moved += step;
  }
  return moved;
}
