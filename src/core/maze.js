// Maze parsing, tile queries, tunnel wrapping and layout validation.
import {
  COLS, MAZE_ROWS, UNITS, HALF, MAZE_W_UNITS, DX, DY, DIRS,
  T_WALL, T_PATH, T_TUNNEL, T_DOOR, T_FORGE,
} from './constants.js';
import { MAZE_LAYOUT } from './mazeData.js';

const CHAR_TILE = {
  '#': T_WALL, '.': T_PATH, 'o': T_PATH, ' ': T_PATH, 'P': T_PATH,
  'T': T_TUNNEL, '-': T_DOOR, 'F': T_FORGE,
};

// Who is moving: decides which tiles are walkable.
export const WHO_PLAYER = 'player';
export const WHO_GLITCH = 'glitch';          // Scatter / Chase / Overloaded outside the Forge
export const WHO_GLITCH_HOME = 'glitchHome'; // leaving or returning to the Forge

export function parseMaze(layout = MAZE_LAYOUT) {
  if (layout.length !== MAZE_ROWS) throw new Error(`maze must have ${MAZE_ROWS} rows`);
  const tiles = [];
  const sparks = [];
  const cores = [];
  let start = null;
  layout.forEach((row, y) => {
    if (row.length !== COLS) throw new Error(`maze row ${y} must have ${COLS} columns`);
    const line = [];
    [...row].forEach((ch, x) => {
      if (!(ch in CHAR_TILE)) throw new Error(`unknown maze char '${ch}' at ${x},${y}`);
      line.push(CHAR_TILE[ch]);
      if (ch === '.') sparks.push([x, y]);
      if (ch === 'o') cores.push([x, y]);
      if (ch === 'P') start = [x, y];
    });
    tiles.push(line);
  });
  if (!start) throw new Error('maze has no player start (P)');
  return createMaze(tiles, { sparks, cores, start, layout });
}

function createMaze(tiles, meta) {
  const wrapX = (x) => ((x % COLS) + COLS) % COLS;
  const tileAt = (x, y) => (y < 0 || y >= MAZE_ROWS ? T_WALL : tiles[y][wrapX(x)]);
  const walkable = (x, y, who = WHO_PLAYER) => {
    const t = tileAt(x, y);
    if (t === T_PATH || t === T_TUNNEL) return true;
    if (who === WHO_GLITCH_HOME) return t === T_DOOR || t === T_FORGE;
    return false;
  };
  const neighbours = (x, y, who) => DIRS.filter((d) => walkable(x + DX[d], y + DY[d], who));
  return {
    tiles,
    ...meta,
    tileAt,
    walkable,
    neighbours,
    wrapX,
    isTunnel: (x, y) => tileAt(x, y) === T_TUNNEL,
    tunnelRow: tiles.findIndex((row) => row[0] === T_TUNNEL),
  };
}

// --- unit/tile helpers ---------------------------------------------------
export const tileCenter = (t) => t * UNITS + HALF;
export const unitToTile = (u) => Math.floor(u / UNITS);
export const wrapUnits = (u) => ((u % MAZE_W_UNITS) + MAZE_W_UNITS) % MAZE_W_UNITS;

// --- validation ----------------------------------------------------------
/**
 * Checks the layout rules from the maze-board spec. Returns a list of
 * problems (empty when the layout is valid).
 */
export function validateLayout(maze) {
  const problems = [];
  const { layout } = maze;
  const norm = (ch) => (ch === 'P' ? ' ' : ch);
  layout.forEach((row, y) => {
    const a = [...row].map(norm).join('');
    const b = [...a].reverse().join('');
    if (a !== b) problems.push(`row ${y} is not mirror-symmetric`);
  });

  // Connectivity from the player start, counting tunnel wrap.
  const key = (x, y) => `${x},${y}`;
  const seen = new Set([key(...maze.start)]);
  const queue = [maze.start];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const d of maze.neighbours(x, y, WHO_PLAYER)) {
      const nx = maze.wrapX(x + DX[d]);
      const ny = y + DY[d];
      if (!seen.has(key(nx, ny))) { seen.add(key(nx, ny)); queue.push([nx, ny]); }
    }
  }
  let walkableCount = 0;
  for (let y = 0; y < MAZE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!maze.walkable(x, y, WHO_PLAYER)) continue;
      walkableCount++;
      if (!seen.has(key(x, y))) problems.push(`tile ${x},${y} is not reachable from the start`);
      if (maze.neighbours(x, y, WHO_PLAYER).length < 2) problems.push(`tile ${x},${y} is a dead end`);
    }
  }
  if (maze.cores.length !== 4) problems.push(`expected 4 Surge Cores, found ${maze.cores.length}`);
  const quadrants = new Set(maze.cores.map(([x, y]) => `${x < COLS / 2 ? 'L' : 'R'}${y < MAZE_ROWS / 2 ? 'T' : 'B'}`));
  if (quadrants.size !== 4) problems.push('Surge Cores must be one per quadrant');
  const total = maze.sparks.length + maze.cores.length;
  if (total < 220 || total > 260) problems.push(`spark+core total ${total} is outside 220-260`);
  if (maze.tunnelRow < 0 || maze.tiles[maze.tunnelRow][COLS - 1] !== T_TUNNEL) problems.push('missing wrap tunnel');
  const doors = maze.tiles.flatMap((row, y) => row.map((t, x) => (t === T_DOOR ? [x, y] : null)).filter(Boolean));
  if (!doors.length || new Set(doors.map(([, y]) => y)).size !== 1) problems.push('Forge door must be one opening on a single row');
  return { problems, walkableCount };
}

export const DOOR_ROW = MAZE_LAYOUT.findIndex((r) => r.includes('-'));
