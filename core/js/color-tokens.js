// ============================================================
// [FILE: core/js/color-tokens.js]
// ============================================================

function readColor(el, spec) {
  const v = el.getPropertyValue(spec.var).trim();
  return v || spec.fallback;
}

export function readColorTokens(spec) {
  const style = getComputedStyle(document.documentElement);
  const out = {};
  for (const [key, s] of Object.entries(spec)) {
    out[key] = readColor(style, s);
  }
  return out;
}

export function readFontToken(varName, fallback) {
  const style = getComputedStyle(document.documentElement);
  const v = style.getPropertyValue(varName).trim();
  return v || fallback;
}