// ============================================================
// [FILE: core/js/resize.js]
// ResizeObserver на boardContainer → onResize(w, h, dpr).
// ============================================================

import { engineConfig } from './engine-config.js';

export function createResize({ target, onResize }) {

  let raf = null;
  let observer = null;

  function sync() {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const cssW = Math.round(rect.width);
    const cssH = Math.round(rect.height);
    if (cssW <= 0 || cssH <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, engineConfig.MAX_DPR || 1);
    onResize(cssW, cssH, dpr);
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      sync();
    });
  }

  observer = new ResizeObserver(schedule);
  observer.observe(target);

  sync();
  requestAnimationFrame(sync);
  setTimeout(sync, 100);

  return {
    sync,
    destroy() {
      if (observer) { observer.disconnect(); observer = null; }
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    },
  };
}