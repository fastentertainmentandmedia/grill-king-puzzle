// ============================================================
// [FILE: core/js/render.js]
// ============================================================

import { gameConfig as cfg } from '../../game/js/config.js';
import { renderItem } from './item-renderer.js';

export function createRenderer(container) {

  const CELLS_PER_SHELF = cfg.ROWS_PER_SHELF * cfg.COLS_PER_SHELF;

  let builtShelfCount = 0;
  let builtTotalSlots = 0;

  function buildSkeleton(shelfCount) {
    container.innerHTML = '';

    const board = document.createElement('div');
    board.className = 'board';

    for (let s = 0; s < shelfCount; s++) {
      const shelf = document.createElement('div');
      shelf.className = 'shelf';
      shelf.style.gridTemplateColumns = `repeat(${cfg.COLS_PER_SHELF}, 1fr)`;
      shelf.style.gridTemplateRows = `repeat(${cfg.ROWS_PER_SHELF}, 1fr)`;

      for (let j = 0; j < CELLS_PER_SHELF; j++) {
        const idx = s * CELLS_PER_SHELF + j;
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = String(idx);

        const itemsWrap = document.createElement('div');
        itemsWrap.className = 'cell-items';
        itemsWrap.style.gridTemplateColumns = `repeat(${cfg.PLACES_PER_CELL}, 1fr)`;

        for (let place = 0; place < cfg.PLACES_PER_CELL; place++) {
          const placeEl = document.createElement('div');
          placeEl.className = 'slot-place';
          placeEl.dataset.cellIndex = String(idx);
          placeEl.dataset.placeIndex = String(place);
          itemsWrap.appendChild(placeEl);
        }

        cell.appendChild(itemsWrap);
        shelf.appendChild(cell);
      }
      board.appendChild(shelf);
    }

    container.appendChild(board);
    builtShelfCount = shelfCount;
    builtTotalSlots = shelfCount * CELLS_PER_SHELF;
  }

  function fitItemFontSize(itemEl) {
    const place = itemEl.closest('.slot-place');
    if (!place) return;
    const rect = place.getBoundingClientRect();
    const inner = itemEl.firstElementChild;
    if (inner && (inner.tagName === 'IMG' || inner.tagName === 'CANVAS')) return;
    const size = Math.floor(Math.min(rect.width, rect.height) * 0.94);
    if (size > 0) itemEl.style.fontSize = size + 'px';
  }

  function fitAllItems() {
    container.querySelectorAll('.item').forEach(fitItemFontSize);
  }

  function attachHandlers(itemEl, handlers) {
    itemEl.draggable = true;

    itemEl.addEventListener('dragstart', (e) => {
      const ci = parseInt(itemEl.dataset.cellIndex, 10);
      const pi = parseInt(itemEl.dataset.placeIndex, 10);
      handlers.onDragStart(ci, pi, e);
    });
    itemEl.addEventListener('dragend', () => {
      handlers.onDragEnd();
    });

    itemEl.addEventListener('touchstart', (e) => {
      const ci = parseInt(itemEl.dataset.cellIndex, 10);
      const pi = parseInt(itemEl.dataset.placeIndex, 10);
      handlers.onTouchStart(ci, pi, e, itemEl);
    }, { passive: false });
    itemEl.addEventListener('touchmove', (e) => {
      const ci = parseInt(itemEl.dataset.cellIndex, 10);
      const pi = parseInt(itemEl.dataset.placeIndex, 10);
      handlers.onTouchMove(ci, pi, e);
    }, { passive: false });
    itemEl.addEventListener('touchend', (e) => {
      const ci = parseInt(itemEl.dataset.cellIndex, 10);
      const pi = parseInt(itemEl.dataset.placeIndex, 10);
      handlers.onTouchEnd(ci, pi, e);
    }, { passive: false });
    itemEl.addEventListener('touchcancel', () => {
      handlers.onTouchCancel();
    });
  }

  function createItemEl(obj, ci, pi) {
    const item = document.createElement('div');
    item.className = 'item appear';
    item.dataset.foodType = obj.type;
    item.dataset.cellIndex = String(ci);
    item.dataset.placeIndex = String(pi);

    const rendered = renderItem(obj.type, cfg);

    if (typeof rendered === 'string') {
      item.textContent = rendered;
    } else if (rendered && rendered.nodeType === 1) {
      item.appendChild(rendered);
    }

    item.draggable = true;
    return item;
  }

  function render(state, handlers) {
    const shelfCount = state.SHELF_COUNT;
    if (shelfCount !== builtShelfCount) {
      buildSkeleton(shelfCount);
    }

    const totalSlots = state.TOTAL_SLOTS;

    for (let ci = 0; ci < totalSlots; ci++) {
      const cellEl = container.querySelector(`.cell[data-index="${ci}"]`);
      if (!cellEl) continue;
      const slotsPlaces = cellEl.querySelectorAll('.slot-place');
      const arr = state.slots[ci] || [];

      for (let pi = 0; pi < slotsPlaces.length; pi++) {
        const placeEl = slotsPlaces[pi];
        const obj = arr[pi];

        const existing = placeEl.querySelector('.item');

        if (!obj) {
          if (existing) existing.remove();
          continue;
        }

        if (existing && existing.dataset.foodType === obj.type) {
          existing.dataset.cellIndex = String(ci);
          existing.dataset.placeIndex = String(pi);
          continue;
        }

        if (existing) existing.remove();

        const item = createItemEl(obj, ci, pi);
        placeEl.appendChild(item);
        fitItemFontSize(item);
        if (handlers) attachHandlers(item, handlers);
      }
    }
  }

  function applyEvents(events) {
    for (const ev of events) {
      if (ev.type === 'comboSuper') {
        playComboSuper();
        continue;
      }
      if (ev.type === 'comboLost') {
        continue;
      }
      if (ev.type === 'grow') continue;

      const cellEl = container.querySelector(`.cell[data-index="${ev.cellIndex}"]`);
      if (!cellEl) continue;

      if (ev.type === 'merge') {
        cellEl.querySelectorAll('.item').forEach(i => i.classList.add('match-pop'));
        playMergeBurst(cellEl);
      } else if (ev.type === 'spawn') {
        const badge = document.createElement('div');
        badge.className = 'spawn-badge';
        badge.textContent = cfg.TEXTS?.spawnFlash || '✨';
        cellEl.appendChild(badge);
        setTimeout(() => badge.remove(), 700);
      }
    }
  }

  function playComboSuper() {
    const banner = document.createElement('div');
    banner.className = 'combo-super-banner';
    banner.textContent = cfg.TEXTS?.comboSuper || 'СУПЕР-КОМБО!';
    container.appendChild(banner);
    setTimeout(() => banner.remove(), 1400);
  }

  function playMergeBurst(cellEl) {
    const burst = document.createElement('div');
    burst.className = 'merge-burst';

    const flash = document.createElement('div');
    flash.className = 'merge-flash';
    burst.appendChild(flash);

    const ring = document.createElement('div');
    ring.className = 'merge-ring';
    burst.appendChild(ring);

    const sparkCount = 12;
    for (let i = 0; i < sparkCount; i++) {
      const sp = document.createElement('div');
      sp.className = 'spark';
      const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.4;
      const dist = 45 + Math.random() * 45;
      sp.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      sp.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      sp.style.animationDelay = (0.08 + Math.random() * 0.06) + 's';
      burst.appendChild(sp);
    }

    cellEl.appendChild(burst);
    setTimeout(() => burst.remove(), 620);
  }

  function refreshColors() {}

  return { render, applyEvents, fitAllItems, refreshColors };
}