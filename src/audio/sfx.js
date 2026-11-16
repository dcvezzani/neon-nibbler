// Synthesized sound effects (Web Audio API, no audio files) and haptics.
// Everything is guarded: without Web Audio or vibration the game stays silent.

const VIBRATION = {
  death: [120],
  catch: [30],
  core: [20],
  levelClear: [40, 60, 40],
};

export function createSfx({ isMuted }) {
  let ctx = null;
  let master = null;
  let overload = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = isMuted() ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** Call from a user gesture (tap, click, key) to satisfy autoplay rules. */
  function unlock() {
    const c = ensure();
    if (c && c.state !== 'running') c.resume().catch(() => {});
  }

  function tone({ type = 'square', from, to = from, dur = 0.1, vol = 0.3, at = 0, slide = 'exp' }) {
    if (!ctx || ctx.state !== 'running' || isMuted()) return;
    try {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      if (to !== from) {
        if (slide === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
        else o.frequency.linearRampToValueAtTime(to, t + dur);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* ignore audio errors */ }
  }

  const seq = (notes, step, opts) => notes.forEach((f, i) => tone({ from: f, dur: step * 0.9, at: i * step, ...opts }));

  function vibrate(kind) {
    if (isMuted()) return;
    try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(VIBRATION[kind]); } catch { /* unsupported */ }
  }

  function startOverload() {
    if (!ctx || ctx.state !== 'running' || overload) return;
    try {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 180;
      lfo.frequency.value = 7;
      lfoGain.gain.value = 60;
      g.gain.value = 0.07;
      lfo.connect(lfoGain).connect(o.frequency);
      o.connect(g).connect(master);
      o.start(); lfo.start();
      overload = { o, lfo, g };
    } catch { overload = null; }
  }

  function stopOverload() {
    if (!overload) return;
    try {
      const t = ctx.currentTime;
      overload.g.gain.setTargetAtTime(0, t, 0.01);
      overload.o.stop(t + 0.06);
      overload.lfo.stop(t + 0.06);
    } catch { /* already stopped */ }
    overload = null;
  }

  function handle(e) {
    switch (e.type) {
      case 'spark':
        tone({ type: 'square', from: e.alt ? 620 : 520, to: e.alt ? 470 : 390, dur: 0.06, vol: 0.12 });
        break;
      case 'core':
        tone({ type: 'triangle', from: 200, to: 900, dur: 0.28, vol: 0.3 });
        vibrate('core');
        break;
      case 'overloadStart': startOverload(); break;
      case 'overloadEnd': stopOverload(); break;
      case 'catch':
        seq([660, 880, 1320], 0.05, { type: 'square', vol: 0.2 });
        vibrate('catch');
        break;
      case 'fragmentHome':
        tone({ type: 'sine', from: 700, to: 300, dur: 0.18, vol: 0.12 });
        break;
      case 'bonus':
        seq([988, 1319], 0.08, { type: 'triangle', vol: 0.25 });
        break;
      case 'extraLife':
        seq([523, 659, 784, 1047, 784, 1047], 0.07, { type: 'square', vol: 0.18 });
        break;
      case 'death':
        stopOverload();
        vibrate('death');
        break;
      case 'deathAnim':
        tone({ type: 'sawtooth', from: 760, to: 90, dur: 1.1, vol: 0.22 });
        tone({ type: 'square', from: 140, to: 60, dur: 0.15, vol: 0.2, at: 1.2 });
        break;
      case 'levelClear':
        stopOverload();
        seq([392, 523, 659, 784, 1047], 0.08, { type: 'triangle', vol: 0.25 });
        vibrate('levelClear');
        break;
      case 'gameStart':
        seq([330, 494, 392, 659, 587, 784], 0.11, { type: 'square', vol: 0.16 });
        break;
      case 'pause':
      case 'quit':
      case 'gameOver':
        stopOverload();
        break;
      default:
        break;
    }
  }

  return {
    unlock,
    handle,
    /** Re-apply mute state (sound and vibration). */
    setMuted(m) {
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.01);
      if (m) stopOverload();
    },
    /** Resume overload ambience after a pause if Overload is still active. */
    syncOverload(active) { if (active) startOverload(); else stopOverload(); },
    suspend() { stopOverload(); try { ctx?.suspend(); } catch { /* ignore */ } },
    resume() { try { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); } catch { /* ignore */ } },
    get context() { return ctx; },
  };
}
