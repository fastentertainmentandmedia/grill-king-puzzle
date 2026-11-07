// ============================================================
// [FILE: core/js/controls/drag-drop.js]
// ============================================================

export function createDragDrop({ getBoardRoot, getSlots, onMove, canDrop }) {

  let draggedFromCell = null;
  let draggedPlaceIndex = null;
  let ghost = null;
  let activePointerId = null;

  function findCellFromPoint(clientX, clientY) {
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      if (!el || !el.closest) continue;
      const cell = el.closest('.cell');
      if (cell) return cell;
    }
    const root = getBoardRoot();
    if (!root) return null;
    const cells = root.querySelectorAll('.cell');
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right &&
          clientY >= r.top  && clientY <= r.bottom) {
        return cell;
      }
    }
    return null;
  }

  function clearDragOver() {
    const root = getBoardRoot();
    if (!root) return;
    root.querySelectorAll('.cell.drag-over').forEach(c => c.classList.remove('drag-over'));
  }

  function resetItemsOpacity() {
    const root = getBoardRoot();
    if (!root) return;
    root.querySelectorAll('.item').forEach(i => i.style.opacity = '1');
  }

  function handleDragStart(cellIndex, placeIndex, e) {
    draggedFromCell = cellIndex;
    draggedPlaceIndex = placeIndex;
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    const itemEl = e.target.closest && e.target.closest('.item');
    if (itemEl) itemEl.style.opacity = '0.35';
  }

  function handleDragEnd() {
    resetItemsOpacity();
    clearDragOver();
    draggedFromCell = null;
    draggedPlaceIndex = null;
  }

  function handleTouchStart(cellIndex, placeIndex, e, itemEl) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();

    draggedFromCell = cellIndex;
    draggedPlaceIndex = placeIndex;
    activePointerId = e.touches[0].identifier;

    const touch = e.touches[0];
    const computed = getComputedStyle(itemEl);
    const fontSize = parseFloat(computed.fontSize) || 32;
    const ghostSize = Math.round(fontSize * 1.6);

    ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.left = (touch.clientX - ghostSize / 2) + 'px';
    ghost.style.top = (touch.clientY - ghostSize / 2) + 'px';
    ghost.style.width = ghostSize + 'px';
    ghost.style.height = ghostSize + 'px';
    ghost.style.zIndex = '10000';
    ghost.style.pointerEvents = 'none';
    ghost.style.fontSize = fontSize + 'px';
    ghost.style.lineHeight = '1';
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.justifyContent = 'center';
    ghost.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 10px #ffb86b)';
    ghost.style.transform = 'scale(1.15)';
    ghost.innerHTML = itemEl.innerHTML;
    document.body.appendChild(ghost);

    itemEl.style.opacity = '0.35';
  }

  function handleTouchMove(cellIndex, placeIndex, e) {
    if (draggedFromCell === null || !ghost) return;
    e.preventDefault();
    e.stopPropagation();

    let touch = null;
    for (const t of e.touches) {
      if (t.identifier === activePointerId) { touch = t; break; }
    }
    if (!touch) touch = e.touches[0];

    const gs = parseFloat(ghost.style.width) || 40;
    ghost.style.left = (touch.clientX - gs / 2) + 'px';
    ghost.style.top = (touch.clientY - gs / 2) + 'px';

    const target = findCellFromPoint(touch.clientX, touch.clientY);
    clearDragOver();
    if (target) {
      const ti = parseInt(target.dataset.index, 10);
      if (ti !== draggedFromCell && canDrop(ti)) {
        target.classList.add('drag-over');
      }
    }
  }

  function handleTouchEnd(cellIndex, placeIndex, e) {
    if (draggedFromCell === null) return;
    e.preventDefault();
    e.stopPropagation();

    let touch = null;
    for (const t of e.changedTouches) {
      if (t.identifier === activePointerId) { touch = t; break; }
    }
    if (!touch) touch = e.changedTouches[0];

    if (touch) {
      const target = findCellFromPoint(touch.clientX, touch.clientY);
      if (target) {
        const ti = parseInt(target.dataset.index, 10);
        if (ti !== draggedFromCell) {
          onMove(draggedFromCell, draggedPlaceIndex, ti);
        }
      }
    }

    if (ghost) { ghost.remove(); ghost = null; }
    resetItemsOpacity();
    clearDragOver();
    draggedFromCell = null;
    draggedPlaceIndex = null;
    activePointerId = null;
  }

  function handleTouchCancel() {
    if (ghost) { ghost.remove(); ghost = null; }
    resetItemsOpacity();
    clearDragOver();
    draggedFromCell = null;
    draggedPlaceIndex = null;
    activePointerId = null;
  }

  let rootHandlersAttached = false;

  function attachRootHandlers() {
    const rootEl = getBoardRoot();
    if (!rootEl || rootHandlersAttached) return;
    rootHandlersAttached = true;

    rootEl.addEventListener('dragover', (e) => {
      if (draggedFromCell === null) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}

      const target = findCellFromPoint(e.clientX, e.clientY);
      clearDragOver();
      if (target) {
        const ti = parseInt(target.dataset.index, 10);
        if (ti !== draggedFromCell && canDrop(ti)) {
          target.classList.add('drag-over');
        }
      }
    });

    rootEl.addEventListener('dragenter', (e) => {
      if (draggedFromCell === null) return;
      e.preventDefault();
    });

    rootEl.addEventListener('dragleave', (e) => {
      if (!rootEl.contains(e.relatedTarget)) clearDragOver();
    });

    rootEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = findCellFromPoint(e.clientX, e.clientY);
      if (target && draggedFromCell !== null) {
        const ti = parseInt(target.dataset.index, 10);
        if (ti !== draggedFromCell) {
          onMove(draggedFromCell, draggedPlaceIndex, ti);
        }
      }
      handleDragEnd();
    });

    document.addEventListener('dragend', () => {
      if (draggedFromCell !== null) handleDragEnd();
    });
  }

  function attach() {
    attachRootHandlers();
  }

  return {
    attach,
    handlers: {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}