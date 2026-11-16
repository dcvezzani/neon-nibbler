// Optional on-screen D-pad: each arrow registers its direction on touch down.
export function attachDpad(root, { onDir, onAnyInput }) {
  for (const btn of root.querySelectorAll('.dpad-btn')) {
    const dir = Number(btn.dataset.dir);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onAnyInput?.();
      btn.classList.add('pressed');
      onDir(dir);
    });
    const release = () => btn.classList.remove('pressed');
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  }
}
