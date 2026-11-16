// Pure swipe recogniser: feed it pointer positions, get directions back.
// A direction registers once the finger has moved `threshold` CSS px from the
// anchor, without waiting for it to lift. The anchor then follows the finger
// so turns can be chained in one drag.
import { UP, LEFT, DOWN, RIGHT, NONE, SWIPE_THRESHOLD } from './constants.js';

export function createSwipe(threshold = SWIPE_THRESHOLD) {
  let active = false;
  let ax = 0, ay = 0;
  let last = NONE;
  let fired = false;

  return {
    start(x, y) { active = true; ax = x; ay = y; last = NONE; fired = false; },
    /** Returns a direction when a new one registers, otherwise NONE. */
    move(x, y) {
      if (!active) return NONE;
      const dx = x - ax, dy = y - ay;
      if (Math.hypot(dx, dy) < threshold) return NONE;
      const dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? LEFT : RIGHT) : (dy < 0 ? UP : DOWN);
      ax = x; ay = y; // anchor follows the finger
      if (dir === last) return NONE;
      last = dir;
      fired = true;
      return dir;
    },
    /** Ends the gesture. Returns true when it was a tap (no direction registered). */
    end() { const tap = active && !fired; active = false; return tap; },
    cancel() { active = false; },
    get active() { return active; },
  };
}
