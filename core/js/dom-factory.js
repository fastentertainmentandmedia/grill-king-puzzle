// ============================================================
// [FILE: core/js/dom-factory.js]
// ============================================================

export function createDOM(ids, { required = [] } = {}) {
  const $ = {};
  for (const name of Object.keys(ids)) {
    $[name] = document.getElementById(ids[name]);
  }
  if (typeof console !== 'undefined') {
    for (const name of required) {
      if (!$[name]) {
        console.warn(`[dom] Обязательный элемент "${name}" не найден`);
      }
    }
  }
  return $;
}