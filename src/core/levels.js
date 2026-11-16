// Per-level tuning. Tests check the progression rule from the game-flow spec,
// not these exact numbers, so they can be tuned after play testing.
import { BASE_SPEED, secs } from './constants.js';

const pct = (p) => Math.round(BASE_SPEED * p / 100);

const BONUSES = [
  { from: 1, kind: 'byte', name: 'Byte', value: 100 },
  { from: 2, kind: 'chip', name: 'Chip', value: 300 },
  { from: 3, kind: 'disk', name: 'Disk', value: 500 },
  { from: 5, kind: 'gem', name: 'Gem', value: 700 },
  { from: 7, kind: 'bolt', name: 'Bolt', value: 1000 },
  { from: 9, kind: 'key', name: 'Key', value: 2000 },
  { from: 11, kind: 'prism', name: 'Prism', value: 3000 },
  { from: 13, kind: 'crown', name: 'Crown', value: 5000 },
];

//            L1  L2  L3  L4  L5  L6  L7+
const GLITCH = [75, 80, 85, 85, 90, 90, 95];
const FRIGHT = [50, 55, 55, 55, 60, 60, 60];
const TUNNEL = [40, 45, 45, 45, 50, 50, 50];
const NIB = [80, 85, 90, 90, 100, 100, 100];
const OVERLOAD_EARLY = [6, 5, 5, 4, 4, 3, 3]; // L1..L7, then falls to 0 at L21

export const SCATTER_CHASE = [7, 20, 7, 20, 5, 20, 5, Infinity];

export function overloadSeconds(level) {
  if (level <= 7) return OVERLOAD_EARLY[level - 1];
  if (level >= 21) return 0;
  return (3 * (21 - level)) / 14;
}

export function getLevel(level) {
  const i = Math.min(level, 7) - 1;
  const bonus = [...BONUSES].reverse().find((b) => level >= b.from);
  return {
    level,
    nibSpeed: pct(level >= 21 ? 90 : NIB[i]),
    glitchSpeed: pct(GLITCH[i]),
    frightSpeed: pct(FRIGHT[i]),
    tunnelSpeed: pct(TUNNEL[i]),
    homeSpeed: pct(50),
    fragmentSpeed: pct(200),
    overloadSteps: secs(overloadSeconds(level)),
    flashSteps: secs(2),
    schedule: SCATTER_CHASE.map((s) => (s === Infinity ? Infinity : secs(s))),
    releaseSparks: level === 1 ? [0, 30, 60] : level === 2 ? [0, 0, 50] : [0, 0, 0],
    idleReleaseSteps: secs(level <= 4 ? 4 : 3),
    bonus,
  };
}

export function bonusFor(level) { return getLevel(level).bonus; }
