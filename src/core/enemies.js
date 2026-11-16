// The four Glitches: targeting, intersection decisions, Forge routines.
import { DX, DY, DIRS, NONE, LEFT, UP, DOWN, opposite } from './constants.js';
import { tileCenter, WHO_GLITCH, DOOR_ROW } from './maze.js';
import { advance, tileX, tileY } from './movement.js';

export const ROOK = 0, LURE = 1, SPLICE = 2, SKITTER = 3;

export const GLITCH_INFO = [
  { name: 'Rook', role: 'Hunts you directly', color: '#ff3355', shape: 'triangle', corner: { x: 25, y: -3 } },
  { name: 'Lure', role: 'Cuts you off ahead', color: '#c45cff', shape: 'diamond', corner: { x: 2, y: -3 } },
  { name: 'Splice', role: 'Flanks with Rook', color: '#9dff3a', shape: 'hexagon', corner: { x: 27, y: 31 } },
  { name: 'Skitter', role: 'Keeps its distance', color: '#ffb02e', shape: 'square', corner: { x: 0, y: 31 } },
];

// Forge geometry (maze tiles). The door spans two columns; its centre line is
// the boundary between them.
export const EXIT_ROW = DOOR_ROW - 1;      // tile row just above the door
export const HOUSE_ROW = DOOR_ROW + 2;     // middle row inside the Forge
export const DOOR_X = 14 * 256;            // unit x of the door centre line
const HOUSE_X = [DOOR_X, DOOR_X, 12 * 256, 16 * 256];

export function createGlitches() {
  return GLITCH_INFO.map((info, id) => ({ id, ...info, x: 0, y: 0, dir: LEFT, state: 'house', frightened: false }));
}

export function resetGlitches(glitches) {
  for (const g of glitches) {
    g.frightened = false;
    g.x = HOUSE_X[g.id];
    if (g.id === ROOK) {
      g.y = tileCenter(EXIT_ROW);
      g.state = 'active';
      g.dir = LEFT;
    } else {
      g.y = tileCenter(HOUSE_ROW);
      g.state = 'house';
      g.dir = g.id === LURE ? DOWN : UP;
    }
  }
}

// --- targeting -------------------------------------------------------------
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

/**
 * Chase target for a Glitch. `nib` = { tx, ty, facing }, `rook` = { tx, ty }.
 */
export function chaseTarget(id, self, nib, rook) {
  switch (id) {
    case ROOK:
      return { x: nib.tx, y: nib.ty };
    case LURE:
      return { x: nib.tx + DX[nib.facing] * 4, y: nib.ty + DY[nib.facing] * 4 };
    case SPLICE: {
      const px = nib.tx + DX[nib.facing] * 2;
      const py = nib.ty + DY[nib.facing] * 2;
      return { x: 2 * px - rook.tx, y: 2 * py - rook.ty };
    }
    case SKITTER:
      return dist2(self.tx, self.ty, nib.tx, nib.ty) > 64 ? { x: nib.tx, y: nib.ty } : { ...GLITCH_INFO[SKITTER].corner };
    default:
      throw new Error(`unknown glitch ${id}`);
  }
}

export const scatterTarget = (id) => ({ ...GLITCH_INFO[id].corner });
export const fragmentTarget = () => ({ x: 13, y: EXIT_ROW });

// --- decisions -------------------------------------------------------------
/** Exits a Glitch may take from tile (tx, ty) heading `dir` (never reverse). */
export function allowedExits(maze, tx, ty, dir) {
  return DIRS.filter((d) => d !== opposite(dir) && maze.walkable(tx + DX[d], ty + DY[d], WHO_GLITCH));
}

/** Closest-to-target exit with tie order up, left, down, right. */
export function chooseDirection(maze, tx, ty, dir, target) {
  const exits = allowedExits(maze, tx, ty, dir);
  if (!exits.length) return opposite(dir);
  let best = NONE, bestD = Infinity;
  for (const d of exits) { // DIRS order gives the tie-break
    const dd = dist2(tx + DX[d], ty + DY[d], target.x, target.y);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function chooseRandomDirection(maze, tx, ty, dir, rng) {
  const exits = allowedExits(maze, tx, ty, dir);
  if (!exits.length) return opposite(dir);
  return exits[rng.int(exits.length)];
}

// --- movement --------------------------------------------------------------
function moveToward(g, tx, ty, speed) {
  let left = speed;
  if (g.x !== tx) {
    const s = Math.min(left, Math.abs(tx - g.x));
    g.dir = tx > g.x ? 3 : 1;
    g.x += Math.sign(tx - g.x) * s;
    left -= s;
  }
  if (g.x === tx && g.y !== ty && left > 0) {
    const s = Math.min(left, Math.abs(ty - g.y));
    g.dir = ty > g.y ? DOWN : UP;
    g.y += Math.sign(ty - g.y) * s;
  }
  return g.x === tx && g.y === ty;
}

/**
 * Moves one Glitch for one step. `ctx` provides maze, rng, mode
 * ('scatter'|'chase'), nib and rook tile info, and an `onEvent` callback.
 */
export function updateGlitch(g, speed, ctx) {
  const { maze } = ctx;
  switch (g.state) {
    case 'house':
      return; // waiting; bobbing is drawn by the renderer
    case 'leaving':
      if (moveToward(g, DOOR_X, tileCenter(EXIT_ROW), speed)) {
        g.state = 'active';
        g.dir = LEFT;
      }
      return;
    case 'entering':
      if (moveToward(g, DOOR_X, tileCenter(HOUSE_ROW), speed)) {
        g.state = 'leaving';
        g.frightened = false;
        ctx.onEvent({ type: 'fragmentHome', glitch: g.id });
      }
      return;
    case 'fragment':
    case 'active': {
      advance(g, speed, (e, tx, ty) => {
        if (e.state === 'fragment' && ty === EXIT_ROW && (tx === 13 || tx === 14)) {
          e.state = 'entering';
          return NONE;
        }
        if (e.state === 'active' && e.frightened) return chooseRandomDirection(maze, tx, ty, e.dir, ctx.rng);
        return chooseDirection(maze, tx, ty, e.dir, targetFor(e, ctx));
      });
      if (g.state === 'entering') g.moving = true;
      return;
    }
    default:
      throw new Error(`bad glitch state ${g.state}`);
  }
}

export function targetFor(g, ctx) {
  if (g.state === 'fragment') return fragmentTarget();
  if (ctx.mode === 'scatter') return scatterTarget(g.id);
  return chaseTarget(g.id, { tx: tileX(g), ty: tileY(g) }, ctx.nib, ctx.rook);
}

export function glitchSpeed(g, lvl, maze) {
  if (g.state === 'fragment') return lvl.fragmentSpeed;
  if (g.state !== 'active') return lvl.homeSpeed;
  if (maze.isTunnel(tileX(g), tileY(g))) return lvl.tunnelSpeed;
  return g.frightened ? lvl.frightSpeed : lvl.glitchSpeed;
}
