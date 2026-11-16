// Safe wrappers around localStorage. Every access is guarded so the game still
// runs (with session-only values) when storage is blocked or throws.
const KEY_HIGH = 'neonNibbler.highScore';
const KEY_SETTINGS = 'neonNibbler.settings';
export const DEFAULT_SETTINGS = Object.freeze({ muted: false, dpad: false });

function defaultStore() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function createStorage(store = defaultStore()) {
  const memory = new Map();
  const get = (k) => {
    try { if (store) return store.getItem(k); } catch { /* blocked */ }
    return memory.has(k) ? memory.get(k) : null;
  };
  const set = (k, v) => {
    memory.set(k, v);
    try { if (store) store.setItem(k, v); } catch { /* blocked: keep in memory */ }
  };
  return {
    loadHighScore() {
      const n = Number.parseInt(get(KEY_HIGH) ?? '0', 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
    saveHighScore(score) {
      if (score > this.loadHighScore()) set(KEY_HIGH, String(score));
    },
    loadSettings() {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(get(KEY_SETTINGS) ?? '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
    },
    saveSettings(settings) { set(KEY_SETTINGS, JSON.stringify({ muted: !!settings.muted, dpad: !!settings.dpad })); },
  };
}
