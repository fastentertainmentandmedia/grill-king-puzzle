// ============================================================
// [FILE: core/js/engine-config.js]
// Константы движка. Игровые — в game/js/config.js.
// COLORS: имена CSS-переменных + fallback. Значения — в theme.css.
// ============================================================

export const engineConfig = {
  MAX_DPR: 2,

  TIMER_WARN_RATIO:     0.25,
  TIMER_DANGER_RATIO:   0.1,
  TIMER_CRITICAL_RATIO: 0.05,

  COLORS: {
    cellBg:        { var: '--color-cell-bg',        fallback: '#1a1410' },
    grillBar:      { var: '--color-grill-bar',      fallback: '#a89480' },
    comboFill:     { var: '--color-combo-fill',     fallback: '#ff7a00' },
    comboFillFast: { var: '--color-combo-fast',     fallback: '#ff1f00' },
    comboTrack:    { var: '--color-combo-track',    fallback: '#2a1b14' },
    comboLabel:    { var: '--color-combo-label',    fallback: '#ffffff' },
    spawnBadge:    { var: '--color-spawn-badge',    fallback: '#ffefc2' },
    accent:        { var: '--color-accent',         fallback: '#ff7a00' },
  },
};