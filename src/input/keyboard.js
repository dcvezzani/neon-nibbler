// Keyboard: arrows + WASD steer; Enter/Space confirm; P/Escape pause; M sound.
import { UP, LEFT, DOWN, RIGHT } from '../core/constants.js';

const DIR_KEYS = {
  ArrowUp: UP, ArrowLeft: LEFT, ArrowDown: DOWN, ArrowRight: RIGHT,
  KeyW: UP, KeyA: LEFT, KeyS: DOWN, KeyD: RIGHT,
};

export function attachKeyboard(target, { onDir, onConfirm, onPause, onMute, onAnyInput }) {
  const handler = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    onAnyInput?.();
    if (e.code in DIR_KEYS) {
      e.preventDefault();
      onDir(DIR_KEYS[e.code]);
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (!e.repeat && !(e.target instanceof HTMLButtonElement)) onConfirm();
    } else if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      e.preventDefault();
      onPause();
    } else if (e.code === 'KeyM' && !e.repeat) {
      onMute();
    }
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}
