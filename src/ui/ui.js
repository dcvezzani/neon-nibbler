// DOM controls over the canvas: pause / sound / settings buttons, the pause
// panel and the settings panel. Keeps their visibility in sync with the game.
export function createUi(doc, { onPause, onResume, onQuit, onToggleSound, onToggleDpad, onAnyInput }) {
  const $ = (id) => doc.getElementById(id);
  const els = {
    canvas: $('game'), bar: $('top-buttons'), dpad: $('dpad'),
    pause: $('btn-pause'), sound: $('btn-sound'), settings: $('btn-settings'),
    pausePanel: $('pause-panel'), resume: $('btn-resume'), quit: $('btn-quit'),
    settingsPanel: $('settings-panel'), tglSound: $('tgl-sound'), tglDpad: $('tgl-dpad'), close: $('btn-settings-close'),
  };
  let settingsOpen = false;
  const press = (el, fn) => el.addEventListener('click', (e) => { e.preventDefault(); onAnyInput?.(); fn(); });

  press(els.pause, onPause);
  press(els.resume, onResume);
  press(els.quit, onQuit);
  press(els.sound, onToggleSound);
  press(els.tglSound, onToggleSound);
  press(els.tglDpad, onToggleDpad);
  press(els.settings, () => { settingsOpen = true; });
  press(els.close, () => { settingsOpen = false; });

  let last = '';
  function sync(game, settings) {
    const s = game.state;
    const playing = !s.paused && s.countdown === 0 && ['ready', 'playing', 'catch', 'dying', 'levelClear'].includes(s.phase);
    const key = `${playing}|${s.paused}|${settingsOpen}|${settings.muted}|${settings.dpad}`;
    if (key === last) return;
    last = key;
    els.pause.hidden = !playing;
    els.sound.hidden = playing;
    els.settings.hidden = playing;
    els.pausePanel.hidden = !s.paused || settingsOpen;
    els.settingsPanel.hidden = !settingsOpen;
    els.sound.setAttribute('aria-pressed', String(settings.muted));
    els.sound.setAttribute('aria-label', settings.muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off');
    els.tglSound.setAttribute('aria-checked', String(!settings.muted));
    els.tglDpad.setAttribute('aria-checked', String(settings.dpad));
    if (!els.pausePanel.hidden) els.resume.focus({ preventScroll: true });
  }

  return {
    els,
    sync,
    get settingsOpen() { return settingsOpen; },
    closeSettings() { settingsOpen = false; },
  };
}
