// Shared constants for the pure game simulation. No DOM access here.

export const COLS = 28;            // playfield / maze width in tiles
export const ROWS = 36;            // playfield height in tiles
export const MAZE_ROWS = 31;       // maze height in tiles
export const MAZE_TOP = 3;         // first playfield row used by the maze
export const HUD_TOP_ROWS = 3;
export const HUD_BOTTOM_ROWS = 2;
export const TILE = 16;            // logical pixels per tile
export const VIEW_W = COLS * TILE; // 448
export const VIEW_H = ROWS * TILE; // 576

// Sub-pixel units: 16 units per logical pixel, so one tile is 256 units.
export const UNITS = 256;
export const HALF = UNITS / 2;
export const MAZE_W_UNITS = COLS * UNITS;

export const STEP_HZ = 60;
export const BASE_SPEED = 32;      // units per step at 100% (7.5 tiles/s)

export const SWIPE_THRESHOLD = 20; // CSS px a finger must move to register a direction
export const BUFFER_STEPS = 30;    // a buffered turn lasts 0.5 s

// Directions are indexes in tie-break order: up, left, down, right.
export const UP = 0, LEFT = 1, DOWN = 2, RIGHT = 3, NONE = -1;
export const DIRS = [UP, LEFT, DOWN, RIGHT];
export const DX = [0, -1, 0, 1];
export const DY = [-1, 0, 1, 0];
export const DIR_NAMES = ['up', 'left', 'down', 'right'];
export const opposite = (d) => (d < 0 ? NONE : (d + 2) % 4);

// Tile ids
export const T_WALL = 0, T_PATH = 1, T_TUNNEL = 2, T_DOOR = 3, T_FORGE = 4;

// Seconds -> simulation steps
export const secs = (s) => Math.round(s * STEP_HZ);
