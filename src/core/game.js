// Top-level game simulation. Pure: no DOM, canvas or audio. Advance it with
// step() at a fixed 60 Hz; read `events` for sounds, haptics and pop-ups.
import { COLS, MAZE_ROWS, NONE, secs, opposite } from './constants.js';
import { parseMaze } from './maze.js';
import { createRng } from './rng.js';
import { getLevel } from './levels.js';
import { createPlayer, resetPlayer, setIntent as playerIntent, updatePlayer } from './player.js';
import { tileX, tileY } from './movement.js';
import {
  createGlitches, resetGlitches, updateGlitch, glitchSpeed, ROOK, LURE, SPLICE, SKITTER,
} from './enemies.js';

export const READY_STEPS = secs(2);
export const CATCH_STEPS = secs(0.5);
export const DYING_FREEZE_STEPS = secs(0.5);
export const DYING_STEPS = secs(2);
export const LEVEL_CLEAR_STEPS = secs(2);
export const GAME_OVER_LOCK_STEPS = secs(1);
export const COUNTDOWN_STEPS = secs(3);
export const BONUS_STEPS = secs(9.5);
export const BONUS_AT = [70, 170];
export const BONUS_TILE = { x: 13, y: 17 };
export const EXTRA_LIFE_SCORE = 10000;
export const START_LIVES = 3;
export const SPARK = 1, CORE = 2;
const ACTIVE_PHASES = new Set(['ready', 'playing', 'catch', 'dying', 'levelClear']);
const RELEASE_ORDER = [LURE, SPLICE, SKITTER];

export function createGame({ seed = 1, highScore = 0, maze = parseMaze() } = {}) {
  const g = {
    maze,
    rng: createRng(seed),
    phase: 'start',
    phaseTimer: 0,
    paused: false,
    countdown: 0,
    tick: 0,
    score: 0,
    high: highScore,
    lives: START_LIVES,
    level: 1,
    lvl: getLevel(1),
    extraLifeGiven: false,
    items: new Uint8Array(COLS * MAZE_ROWS),
    remaining: 0,
    eatenThisLevel: 0,
    player: createPlayer(maze),
    glitches: createGlitches(),
    modeIndex: 0,
    modeTimer: 0,
    overloadTimer: 0,
    combo: 0,
    releaseCounter: 0,
    idleSteps: 0,
    bonus: null,
    sparkAlt: false,
    events: [],
  };
  resetGlitches(g.glitches);
  refill(g);

  const api = {
    state: g,
    get phase() { return g.phase; },
    get mode() { return currentMode(g); },
    newGame: () => newGame(g),
    confirm: () => confirm(g),
    setIntent: (dir) => { if (g.phase === 'ready' || g.phase === 'playing' || g.phase === 'catch') playerIntent(g.player, dir, g.tick); },
    step: () => step(g),
    pause: () => pause(g),
    resume: () => resume(g),
    togglePause: () => (g.paused ? resume(g) : pause(g)),
    quit: () => quit(g),
    drainEvents: () => g.events.splice(0),
    snapshot: () => snapshot(g),
    itemAt: (x, y) => g.items[y * COLS + x],
  };
  return api;
}

// --- setup -------------------------------------------------------------------
function refill(g) {
  g.items.fill(0);
  for (const [x, y] of g.maze.sparks) g.items[y * COLS + x] = SPARK;
  for (const [x, y] of g.maze.cores) g.items[y * COLS + x] = CORE;
  g.remaining = g.maze.sparks.length + g.maze.cores.length;
  g.eatenThisLevel = 0;
}

function resetRound(g) {
  resetPlayer(g.player, g.maze);
  resetGlitches(g.glitches);
  g.modeIndex = 0;
  g.modeTimer = 0;
  g.overloadTimer = 0;
  g.combo = 0;
  g.releaseCounter = 0;
  g.idleSteps = 0;
  g.bonus = null;
  setPhase(g, 'ready', READY_STEPS);
  emit(g, 'ready');
}

function newGame(g) {
  g.score = 0;
  g.lives = START_LIVES;
  g.level = 1;
  g.lvl = getLevel(1);
  g.extraLifeGiven = false;
  g.paused = false;
  g.countdown = 0;
  refill(g);
  emit(g, 'gameStart');
  resetRound(g);
}

function nextLevel(g) {
  g.level += 1;
  g.lvl = getLevel(g.level);
  refill(g);
  emit(g, 'levelStart', { level: g.level });
  resetRound(g);
}

// --- control -----------------------------------------------------------------
function confirm(g) {
  if (g.phase === 'start') newGame(g);
  else if (g.phase === 'gameOver' && g.phaseTimer <= 0) { g.phase = 'start'; emit(g, 'toStart'); }
}

function pause(g) {
  if (g.paused || !ACTIVE_PHASES.has(g.phase)) return false;
  g.paused = true;
  g.countdown = 0;
  emit(g, 'pause');
  return true;
}

function resume(g) {
  if (!g.paused) return false;
  g.paused = false;
  g.countdown = COUNTDOWN_STEPS;
  emit(g, 'resume');
  return true;
}

function quit(g) {
  g.paused = false;
  g.countdown = 0;
  g.phase = 'start';
  emit(g, 'quit');
}

// --- stepping ----------------------------------------------------------------
function setPhase(g, phase, steps = 0) { g.phase = phase; g.phaseTimer = steps; }
function emit(g, type, data = {}) { g.events.push({ type, tick: g.tick, ...data }); }

function step(g) {
  if (g.paused) return;
  if (g.countdown > 0) { g.countdown -= 1; return; }
  g.tick += 1;
  switch (g.phase) {
    case 'start':
      return;
    case 'ready':
      if (--g.phaseTimer <= 0) { setPhase(g, 'playing'); emit(g, 'go'); }
      return;
    case 'playing':
      return playStep(g);
    case 'catch':
      if (--g.phaseTimer <= 0) setPhase(g, 'playing');
      return;
    case 'dying':
      g.phaseTimer -= 1;
      if (g.phaseTimer === DYING_STEPS - DYING_FREEZE_STEPS) emit(g, 'deathAnim');
      if (g.phaseTimer <= 0) {
        g.lives -= 1;
        if (g.lives <= 0) {
          setPhase(g, 'gameOver', GAME_OVER_LOCK_STEPS);
          emit(g, 'gameOver', { score: g.score });
        } else {
          resetRound(g);
        }
      }
      return;
    case 'levelClear':
      if (--g.phaseTimer <= 0) nextLevel(g);
      return;
    case 'gameOver':
      if (g.phaseTimer > 0) g.phaseTimer -= 1;
      return;
    default:
      throw new Error(`bad phase ${g.phase}`);
  }
}

export function currentMode(g) { return g.modeIndex % 2 === 0 ? 'scatter' : 'chase'; }

function addScore(g, n) {
  const before = g.score;
  g.score += n;
  if (g.score > g.high) g.high = g.score;
  if (!g.extraLifeGiven && before < EXTRA_LIFE_SCORE && g.score >= EXTRA_LIFE_SCORE) {
    g.extraLifeGiven = true;
    g.lives += 1;
    emit(g, 'extraLife');
  }
}

function startOverload(g) {
  const steps = g.lvl.overloadSteps;
  g.combo = 0;
  for (const gl of g.glitches) {
    if (gl.state === 'fragment' || gl.state === 'entering') continue;
    if (steps > 0) gl.frightened = true;
    if (gl.state === 'active') gl.dir = opposite(gl.dir);
  }
  if (steps > 0) {
    g.overloadTimer = steps;
    emit(g, 'overloadStart');
  }
}

function endOverload(g) {
  g.overloadTimer = 0;
  for (const gl of g.glitches) gl.frightened = false;
  emit(g, 'overloadEnd');
}

function eat(g) {
  const p = g.player;
  const tx = tileX(p), ty = tileY(p);
  if (ty < 0 || ty >= MAZE_ROWS) return;
  const i = ty * COLS + tx;
  const item = g.items[i];
  if (!item) return;
  g.items[i] = 0;
  g.remaining -= 1;
  g.eatenThisLevel += 1;
  g.releaseCounter += 1;
  g.idleSteps = 0;
  if (item === SPARK) {
    g.sparkAlt = !g.sparkAlt;
    addScore(g, 10);
    emit(g, 'spark', { alt: g.sparkAlt });
  } else {
    addScore(g, 50);
    emit(g, 'core');
    startOverload(g);
  }
  if (BONUS_AT.includes(g.eatenThisLevel)) {
    g.bonus = { ...g.lvl.bonus, timer: BONUS_STEPS };
    emit(g, 'bonusSpawn');
  }
}

function updateMode(g) {
  if (g.overloadTimer > 0) {
    g.overloadTimer -= 1;
    if (g.overloadTimer === 0) endOverload(g);
    return;
  }
  const limit = g.lvl.schedule[g.modeIndex];
  g.modeTimer += 1;
  if (g.modeTimer >= limit) {
    g.modeIndex += 1;
    g.modeTimer = 0;
    for (const gl of g.glitches) if (gl.state === 'active') gl.dir = opposite(gl.dir);
    emit(g, 'modeChange', { mode: currentMode(g) });
  }
}

function updateRelease(g) {
  g.idleSteps += 1;
  const idx = RELEASE_ORDER.findIndex((id) => g.glitches[id].state === 'house');
  if (idx < 0) return;
  const gl = g.glitches[RELEASE_ORDER[idx]];
  if (g.releaseCounter >= g.lvl.releaseSparks[idx]) {
    gl.state = 'leaving';
  } else if (g.idleSteps >= g.lvl.idleReleaseSteps) {
    gl.state = 'leaving';
    g.idleSteps = 0;
  }
}

function playStep(g) {
  const p = g.player;
  const pPrev = [tileX(p), tileY(p)];
  const gPrev = g.glitches.map((gl) => [tileX(gl), tileY(gl)]);

  updatePlayer(p, g.maze, g.lvl.nibSpeed, g.tick);
  eat(g);
  if (g.remaining === 0) {
    if (g.overloadTimer > 0) endOverload(g);
    g.bonus = null;
    setPhase(g, 'levelClear', LEVEL_CLEAR_STEPS);
    emit(g, 'levelClear', { level: g.level });
    return;
  }

  updateMode(g);
  updateRelease(g);

  const rook = g.glitches[ROOK];
  const ctx = {
    maze: g.maze,
    rng: g.rng,
    mode: currentMode(g),
    nib: { tx: tileX(p), ty: tileY(p), facing: p.facing },
    rook: { tx: tileX(rook), ty: tileY(rook) },
    onEvent: (e) => emit(g, e.type, e),
  };
  for (const gl of g.glitches) updateGlitch(gl, glitchSpeed(gl, g.lvl, g.maze), ctx);

  if (g.bonus) {
    const px = tileX(p), py = tileY(p);
    if (py === BONUS_TILE.y && (px === BONUS_TILE.x || px === BONUS_TILE.x + 1)) {
      addScore(g, g.bonus.value);
      emit(g, 'bonus', { points: g.bonus.value, kind: g.bonus.kind, x: 14 * 256, y: BONUS_TILE.y * 256 + 128 });
      g.bonus = null;
    } else if (--g.bonus.timer <= 0) {
      g.bonus = null;
      emit(g, 'bonusExpire');
    }
  }

  checkCollisions(g, pPrev, gPrev);
}

export function collides(pPrev, pNow, gPrev, gNow) {
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  return same(pNow, gNow) || (same(pPrev, gNow) && same(gPrev, pNow));
}

function checkCollisions(g, pPrev, gPrev) {
  const p = g.player;
  const pNow = [tileX(p), tileY(p)];
  let killed = false;
  g.glitches.forEach((gl, i) => {
    if (gl.state !== 'active') return;
    if (!collides(pPrev, pNow, gPrev[i], [tileX(gl), tileY(gl)])) return;
    if (gl.frightened) {
      g.combo = Math.min(g.combo + 1, 4);
      const points = 200 * 2 ** (g.combo - 1);
      gl.frightened = false;
      gl.state = 'fragment';
      addScore(g, points);
      emit(g, 'catch', { points, glitch: gl.id, x: gl.x, y: gl.y });
      setPhase(g, 'catch', CATCH_STEPS);
    } else {
      killed = true;
    }
  });
  if (killed) {
    if (g.overloadTimer > 0) { g.overloadTimer = 0; for (const gl of g.glitches) gl.frightened = false; emit(g, 'overloadEnd'); }
    g.bonus = null;
    setPhase(g, 'dying', DYING_STEPS);
    emit(g, 'death');
  }
}

function snapshot(g) {
  return JSON.stringify({
    tick: g.tick, phase: g.phase, score: g.score, lives: g.lives, level: g.level,
    mode: currentMode(g), overload: g.overloadTimer, remaining: g.remaining,
    p: [g.player.x, g.player.y, g.player.dir],
    gl: g.glitches.map((x) => [x.x, x.y, x.dir, x.state, x.frightened]),
    rng: g.rng.state,
  });
}

export { NONE };

/** True while Overloaded Glitches should flash as a warning (last 2 s). */
export function isFlashing(g) { return g.overloadTimer > 0 && g.overloadTimer <= g.lvl.flashSteps; }
