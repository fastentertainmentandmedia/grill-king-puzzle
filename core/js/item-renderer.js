// ============================================================
// [FILE: core/js/item-renderer.js]
// ============================================================

function findType(typeId, cfg) {
  return (cfg.FOOD_TYPES || []).find(t => t.id === typeId) || null;
}

function makeNonDraggable(el) {
  el.draggable = false;
  el.style.pointerEvents = 'auto';
  return el;
}

function renderFallback(fb) {
  const el = document.createElement('span');
  el.style.display = 'inline-block';
  el.style.width = '60%';
  el.style.height = '60%';
  el.style.borderRadius = '20%';
  el.style.background = fb?.color || '#ccc';
  el.style.border = '1px solid ' + (fb?.border || '#666');
  el.style.pointerEvents = 'none';
  return el;
}

export function renderItem(typeId, cfg) {
  const def = findType(typeId, cfg);

  if (!def) return renderFallback(null);

  // 1) draw — canvas
  if (typeof def.draw === 'function') {
    try {
      const canvasEl = def.draw(64, 64);
      if (canvasEl && canvasEl.nodeType === 1) {
        canvasEl.style.maxWidth = '100%';
        canvasEl.style.maxHeight = '100%';
        const scale = def.scale ?? 1;
        if (scale !== 1) canvasEl.style.transform = `scale(${scale})`;
        return makeNonDraggable(canvasEl);
      }
    } catch (e) {}
  }

  // 2) src — <img> (svg/png)
  if (def.src) {
    const img = document.createElement('img');
    img.src = def.src;
    img.alt = def.name || '';
    const fit = def.fit || cfg.ITEM_FIT || 'contain';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = fit;
    img.style.padding = ((def.padding ?? cfg.ITEM_FIT_PADDING ?? 0) * 100) + '%';
    img.style.userSelect = 'none';
    img.style.webkitUserDrag = 'none';
    const scale = def.scale ?? 1;
    if (scale !== 1) img.style.transform = `scale(${scale})`;
    img.onerror = () => {
      const parent = img.parentNode;
      if (parent) {
        const fb = renderFallback(def.fallback);
        parent.replaceChild(fb, img);
      }
    };
    return makeNonDraggable(img);
  }

  // 3) emoji — строка, .item получит textContent
  return def.emoji || '🍽️';
}