// Touch / pointer steering: swipe anywhere (except on UI controls).
// Uses Pointer Events and the pure recogniser in core/swipe.js.
import { createSwipe } from '../core/swipe.js';
import { NONE } from '../core/constants.js';

export const isUiTarget = (el) => !!(el && el.closest && el.closest('button, .panel, #dpad'));

export function attachTouch(target, { onDir, onTap, onAnyInput, threshold }) {
  const swipe = createSwipe(threshold);
  let pointerId = null;

  const down = (e) => {
    onAnyInput?.();
    if (pointerId !== null || isUiTarget(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    swipe.start(e.clientX, e.clientY);
  };
  const move = (e) => {
    if (e.pointerId !== pointerId) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) {
      const d = swipe.move(ev.clientX, ev.clientY);
      if (d !== NONE) onDir(d);
    }
  };
  const up = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (swipe.end()) onTap();
  };
  const cancel = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    swipe.cancel();
  };

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);

  // Block page gestures: scrolling, pull-to-refresh, pinch and double-tap zoom.
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };
  target.addEventListener('touchmove', stop, { passive: false });
  target.addEventListener('gesturestart', stop);
  target.addEventListener('dblclick', stop);
  target.addEventListener('contextmenu', stop);
}
