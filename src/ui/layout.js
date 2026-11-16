// Screen layout. `computeLayout` is pure (testable in Node); `readViewport`
// and `applyLayout` touch the DOM.
import { VIEW_W, VIEW_H, TILE, HUD_TOP_ROWS } from '../core/constants.js';

export const BUTTON = 44;           // minimum touch target (CSS px)
export const DPAD_CELL = 60;        // each D-pad arrow (>= 56 CSS px)
export const DPAD_GAP = 4;
export const DPAD_SIZE = DPAD_CELL * 3 + DPAD_GAP * 2;
const MARGIN = 12;                  // breathing room around the D-pad
const ASPECT = VIEW_W / VIEW_H;

/**
 * @param {{vw:number, vh:number, insets:{top:number,right:number,bottom:number,left:number}, dpad:boolean}} v
 * @returns layout in CSS px: playfield rect + scale, top button bar rect, D-pad rect (or null)
 */
export function computeLayout({ vw, vh, insets, dpad }) {
  const left = insets.left, top = insets.top;
  const availW = Math.max(0, vw - insets.left - insets.right);
  const availH = Math.max(0, vh - insets.top - insets.bottom);
  const portrait = vh >= vw;

  // Fit the playfield into a box; reserve room above it when the HUD rows
  // are shorter than a 44 px button so buttons never cover maze tiles.
  const hudPerW = (HUD_TOP_ROWS * TILE) / VIEW_W;   // HUD height per px of playfield width
  const noPadW = BUTTON / hudPerW;                    // width at which the HUD is 44 px tall
  const fit = (boxW, boxH) => {
    // Solve exactly: playfield height + pad <= boxH, where pad = max(0, 44 - hud).
    let w = boxH * ASPECT;
    if (w < noPadW) w = Math.min(noPadW, (boxH - BUTTON) / (1 / ASPECT - hudPerW));
    w = Math.max(0, Math.min(boxW, w));
    const scale = w / VIEW_W;
    const hud = HUD_TOP_ROWS * TILE * scale;
    return { w, h: w / ASPECT, scale, pad: Math.max(0, BUTTON - hud) };
  };

  let pf, dpadRect = null;
  if (portrait) {
    const reserve = dpad ? DPAD_SIZE + MARGIN * 2 : 0;
    const f = fit(availW, availH - reserve);
    const used = f.h + f.pad + reserve;
    const y0 = top + (dpad ? 0 : Math.max(0, (availH - used) / 2));
    pf = { x: left + (availW - f.w) / 2, y: y0 + f.pad, w: f.w, h: f.h, scale: f.scale, pad: f.pad };
    if (dpad) {
      const below = top + availH - (pf.y + pf.h);
      dpadRect = { x: left + (availW - DPAD_SIZE) / 2, y: pf.y + pf.h + Math.max(MARGIN, (below - DPAD_SIZE) / 2), size: DPAD_SIZE };
    }
  } else {
    const reserve = dpad ? DPAD_SIZE + MARGIN * 2 : 0;
    const f = fit(availW - reserve, availH);
    let x = left + (availW - f.w) / 2;                       // centred
    if (dpad) x = Math.min(x, left + availW - reserve - f.w); // shift left only if needed
    pf = { x, y: top + f.pad + (availH - f.h - f.pad) / 2, w: f.w, h: f.h, scale: f.scale, pad: f.pad };
    if (dpad) {
      const rightStart = pf.x + pf.w;
      const space = left + availW - rightStart;
      dpadRect = { x: rightStart + (space - DPAD_SIZE) / 2, y: top + (availH - DPAD_SIZE) / 2, size: DPAD_SIZE };
    }
  }
  const hudH = HUD_TOP_ROWS * TILE * pf.scale;
  const bar = { x: pf.x, y: pf.y - pf.pad, w: pf.w, h: hudH + pf.pad };
  return { portrait, pf, bar, dpad: dpadRect, vw, vh, insets };
}

export function readViewport(probe) {
  const cs = getComputedStyle(probe);
  const px = (v) => Number.parseFloat(v) || 0;
  const vv = window.visualViewport;
  return {
    vw: Math.round(vv ? vv.width : window.innerWidth),
    vh: Math.round(vv ? vv.height : window.innerHeight),
    insets: { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) },
  };
}

export function applyLayout(L, els) {
  const { canvas, bar, dpad } = els;
  const s = canvas.style;
  s.left = `${L.pf.x}px`; s.top = `${L.pf.y}px`; s.width = `${L.pf.w}px`; s.height = `${L.pf.h}px`;
  // Button bar: right-aligned over the top HUD rows, buttons vertically centred.
  bar.style.left = `${L.bar.x}px`;
  bar.style.top = `${L.bar.y + Math.max(0, (L.bar.h - BUTTON) / 2)}px`;
  bar.style.width = `${L.bar.w - 4}px`;
  bar.style.height = `${BUTTON}px`;
  if (L.dpad) {
    dpad.hidden = false;
    Object.assign(dpad.style, { left: `${L.dpad.x}px`, top: `${L.dpad.y}px`, width: `${L.dpad.size}px`, height: `${L.dpad.size}px` });
  } else {
    dpad.hidden = true;
  }
}
