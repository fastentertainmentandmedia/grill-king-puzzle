// ============================================================
// [FILE: game/js/config.js]
// ЕДИНСТВЕННОЕ место специфики клиента (Grill King Puzzle).
// Размеры поля — целые числа (полки/ряды/колонки).
// Тюнинг — в мс и долях. Визуал — через COLORS {var,fallback}
// и game/css/theme.css.
// ============================================================

export const gameConfig = {
  STORAGE_KEY: 'grill_king_puzzle',
  PLAY_LIMIT_MINUTES: 1,
  LIMIT_RESET_HOURS: 4,

  ASSETS: {
    goatcounter: 'game/assets/goatcounter/count.js',
    logo:        'game/assets/logo.svg',
    preloader:   'game/assets/preloader.svg', // опционально, fallback — logo
  },

  // ----------------------------------------------------------
  // Поле
  // ----------------------------------------------------------
  SHELF_COUNT:     2,
  ROWS_PER_SHELF:  2,
  COLS_PER_SHELF:  3,
  PLACES_PER_CELL: 3,


    // ----------------------------------------------------------
  // Динамическое поле: при достижении порога добавляется полка.
  // Пустой массив [] = динамики нет, SHELF_COUNT фиксирован.
  // Пример: [{ score: 500, combo: 0, add: 1 }] — при 500 очках +1 полка.
  // combo: 0 — не учитывать комбо. score: 0 — не учитывать очки.
  // add — сколько полок добавить при выполнении условия.
  // ----------------------------------------------------------
  SHELF_GROWTH: [
    { score: 0, combo: 1, add: 1, spawnPerStep: 4 },
  ],
  SHELF_MAX: 4,

  // ----------------------------------------------------------
  // Спавн
  // ----------------------------------------------------------
  SPAWN_PER_STEP:     3,
  MIN_ITEMS_ON_FIELD: 6,
  SPAWN_DELAY_MS:     200,
  MAX_ITEMS_ON_FIELD: 43, // -1 = без лимита

  // ----------------------------------------------------------
  // Комбо
  // ----------------------------------------------------------
  COMBO_BASE_DURATION_MS:        8000,
  COMBO_MIN_DURATION_MS:         1000,
  COMBO_SPEEDUP_PER_LEVEL:       0.05,
  COMBO_SPEEDUP_PER_SCORE_BONUS: 0.03,
  COMBO_SCORE_STEP:              100,
  COMBO_BASE_POINTS:             10,

  // ----------------------------------------------------------
  // Тексты HUD
  // ----------------------------------------------------------
  TEXTS: {
    scoreLabel:    'Очки',
    maxComboLabel: 'Комбо',
    resetLabel:    '↺ Заново',
    comboPrefix:   'КОМБО',
    spawnFlash:    '✨',
    comboSuper: 'СУПЕР-КОМБО!',

  },

  // ----------------------------------------------------------
  // Типы еды.
  // Контракт item-renderer:
  //   emoji    — текст (основной вариант Grill King)
  //   src      — <img> (если положите спрайты)
  //   draw     — функция (canvas-узел), вызывается как draw(w, h) → HTMLCanvasElement
  //   fallback — { color, border } для бейджа, если ничего не сработало
  // weight — для взвешенного рандома (0 = не спавнится)
  // ----------------------------------------------------------
  FOOD_TYPES: [
    { id: 'burger',   src: 'game/assets/food/burger.svg',  weight: 3 },
    { id: 'hotdog',   src: 'game/assets/food/hotdog.svg', weight: 3 },
    { id: 'shwarma', src: 'game/assets/food/shwarma.svg',  weight: 2 },
    { id: 'gyros',    emoji: '🥙', name: 'гирос',   weight: 2 },
    { id: 'kebab', src: 'game/assets/food/kebab.svg',  weight: 2 },
    { id: 'lula',     emoji: '🍗', name: 'люля',    weight: 2 },
    { id: 'meat',     emoji: '🍖', name: 'мясо',    weight: 1 },
    { id: 'steak',    emoji: '🥩', name: 'стейк',   weight: 1 },
  ],

  // Fit для <img>-режима (аналог INGREDIENT_FIT_*)
  ITEM_FIT:         'contain',
  ITEM_FIT_SCALE:   1.0,
  ITEM_FIT_PADDING: 0,

  // ----------------------------------------------------------
  // Цвета: Core читает эти CSS-переменные (fallback — на случай
  // отсутствия theme.css). Значения задаются в game/css/theme.css.
  // ----------------------------------------------------------
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

export const DEBUG_DISABLE_LIMIT = true;