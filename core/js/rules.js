// ============================================================
// [FILE: core/js/rules.js]
// Динамическая полка по стрику: появляется при comboCount >= combo,
// исчезает при breakCombo. Событие 'comboSuper' для анимации.
// ============================================================

import { gameConfig as cfg } from '../../game/js/config.js';

const ROWS_PER_SHELF   = cfg.ROWS_PER_SHELF;
const COLS_PER_SHELF   = cfg.COLS_PER_SHELF;
const CELLS_PER_SHELF  = ROWS_PER_SHELF * COLS_PER_SHELF;
const PLACES_PER_CELL  = cfg.PLACES_PER_CELL;
const SHELF_MAX        = cfg.SHELF_MAX || cfg.SHELF_COUNT;
const SHELF_GROWTH     = Array.isArray(cfg.SHELF_GROWTH) ? cfg.SHELF_GROWTH : [];

const FOOD_IDS = (cfg.FOOD_TYPES || []).map(t => t.id);

function pickWeightedType() {
  const pool = [];
  for (const t of cfg.FOOD_TYPES || []) {
    const w = t.weight || 0;
    for (let i = 0; i < w; i++) pool.push(t.id);
  }
  if (pool.length === 0) return FOOD_IDS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createRules() {

  let shelfCount = cfg.SHELF_COUNT;
  let totalSlots = shelfCount * CELLS_PER_SHELF;
  let currentSpawnPerStep = cfg.SPAWN_PER_STEP;

  let slots = [];
  let score = 0;
  let maxCombo = 0;

  let comboActive = false;
  let comboCount = 0;
  let comboEndsAt = 0;
  let currentComboDuration = cfg.COMBO_BASE_DURATION_MS;

  let spawnLocked = false;
  let pendingSpawnAt = 0;
  let pendingSpawnCount = 0;

  let nowMs = 0;
  let events = [];

  // индекс активной "супер-полки" (из SHELF_GROWTH), -1 если нет
  let activeGrowthIdx = -1;

  function countItemsOnField() {
    let n = 0;
    for (let i = 0; i < totalSlots; i++) n += slots[i].length;
    return n;
  }

  function listFreePlaces() {
    const result = [];
    for (let i = 0; i < totalSlots; i++) {
      for (let p = slots[i].length; p < PLACES_PER_CELL; p++) {
        result.push({ cell: i, place: p });
      }
    }
    return result;
  }

  function spawnOneItem() {
    if (cfg.MAX_ITEMS_ON_FIELD >= 0 &&
        countItemsOnField() >= cfg.MAX_ITEMS_ON_FIELD) return null;
    const free = listFreePlaces();
    if (free.length === 0) return null;
    const spot = free[Math.floor(Math.random() * free.length)];
    const type = pickWeightedType();
    slots[spot.cell].push({ type });
    return { cellIndex: spot.cell, placeIndex: slots[spot.cell].length - 1, type };
  }

  function spawnItems(n) {
    const created = [];
    for (let k = 0; k < n; k++) {
      const obj = spawnOneItem();
      if (obj) created.push(obj);
    }
    return created;
  }

  function isMatch(arr) {
    return arr.length === PLACES_PER_CELL &&
           arr[0].type === arr[1].type &&
           arr[1].type === arr[2].type;
  }

  function findMatchCells() {
    const result = [];
    for (let i = 0; i < totalSlots; i++) {
      if (isMatch(slots[i])) result.push(i);
    }
    return result;
  }

  function computeComboDuration(comboLevel, currentScore) {
    const base = cfg.COMBO_BASE_DURATION_MS;
    const comboFactor = Math.max(0, comboLevel - 1) * cfg.COMBO_SPEEDUP_PER_LEVEL;
    const scoreFactor =
      Math.floor(currentScore / cfg.COMBO_SCORE_STEP) * cfg.COMBO_SPEEDUP_PER_SCORE_BONUS;
    const totalFactor = Math.min(0.9, comboFactor + scoreFactor);
    const duration = base * (1 - totalFactor);
    return Math.max(cfg.COMBO_MIN_DURATION_MS, duration);
  }

  function startOrExtendCombo() {
    if (!comboActive || nowMs >= comboEndsAt) comboCount = 0;
    comboActive = true;
    comboCount++;
    currentComboDuration = computeComboDuration(comboCount, score);
    comboEndsAt = nowMs + currentComboDuration;
    if (comboCount > maxCombo) maxCombo = comboCount;
    return comboCount;
  }

  function breakCombo() {
    comboActive = false;
    comboCount = 0;
    comboEndsAt = 0;
    currentComboDuration = cfg.COMBO_BASE_DURATION_MS;
    removeSuperShelf();
  }

  // ----------------------------------------------------------
  // Супер-полка по стрику
  // ----------------------------------------------------------
  function findGrowthRule() {
    for (let i = 0; i < SHELF_GROWTH.length; i++) {
      const rule = SHELF_GROWTH[i];
      const needCombo = rule.combo || 0;
      if (needCombo > 0) return { rule, index: i };
    }
    return null;
  }

  function addSuperShelf() {
    if (activeGrowthIdx !== -1) return false;
    const found = findGrowthRule();
    if (!found) return false;
    if (shelfCount >= SHELF_MAX) return false;

    const { rule, index } = found;
    const needCombo = rule.combo || 0;
    if (comboCount < needCombo) return false;

    const add = Math.max(1, rule.add || 1);
    const newShelves = Math.min(SHELF_MAX, shelfCount + add);
    const added = newShelves - shelfCount;
    for (let s = 0; s < added; s++) {
      for (let c = 0; c < CELLS_PER_SHELF; c++) slots.push([]);
    }
    shelfCount = newShelves;
    totalSlots = shelfCount * CELLS_PER_SHELF;

    if (typeof rule.spawnPerStep === 'number' && rule.spawnPerStep > 0) {
      currentSpawnPerStep = rule.spawnPerStep;
    }

    activeGrowthIdx = index;
    events.push({ type: 'comboSuper', shelfCount });
    return true;
  }

  function removeSuperShelf() {
    if (activeGrowthIdx === -1) return false;
    const rule = SHELF_GROWTH[activeGrowthIdx];
    if (!rule) { activeGrowthIdx = -1; return false; }

    const add = Math.max(1, rule.add || 1);
    const newShelves = Math.max(cfg.SHELF_COUNT, shelfCount - add);
    const removed = shelfCount - newShelves;

    // убираем полки с конца, сдвигая оставшиеся слоты
    if (removed > 0) {
      slots.splice(totalSlots - removed * CELLS_PER_SHELF, removed * CELLS_PER_SHELF);
      shelfCount = newShelves;
      totalSlots = shelfCount * CELLS_PER_SHELF;
    }

    currentSpawnPerStep = cfg.SPAWN_PER_STEP;
    activeGrowthIdx = -1;
    events.push({ type: 'comboLost', shelfCount });
    return true;
  }

  function scheduleSpawn() {
    spawnLocked = true;
    pendingSpawnCount = currentSpawnPerStep;
    pendingSpawnAt = nowMs + cfg.SPAWN_DELAY_MS;
  }

  function processPendingSpawn() {
    if (!spawnLocked) return;
    if (nowMs < pendingSpawnAt) return;

    const created = spawnItems(pendingSpawnCount);
    const need = cfg.MIN_ITEMS_ON_FIELD - countItemsOnField();
    if (need > 0) created.push(...spawnItems(need));

    for (const c of created) {
      events.push({ type: 'spawn', cellIndex: c.cellIndex, placeIndex: c.placeIndex, foodType: c.type });
    }

    spawnLocked = false;
    pendingSpawnAt = 0;
    pendingSpawnCount = 0;
  }

  function clearMatches() {
    const cells = findMatchCells();
    if (cells.length === 0) return false;

    const mult = startOrExtendCombo();
    const pointsPerCell = cfg.COMBO_BASE_POINTS * mult;
    score += pointsPerCell * cells.length;

    for (const ci of cells) {
      const firstItem = slots[ci][0];
      events.push({ type: 'merge', cellIndex: ci, foodType: firstItem ? firstItem.type : null });
      slots[ci] = [];
    }

    // проверка на появление супер-полки после каждого мержа
    addSuperShelf();

    scheduleSpawn();
    return true;
  }

  function moveItem(fromCell, fromPlace, toCell) {
    if (fromCell === toCell) return false;
    const arr = slots[fromCell];
    if (!arr) return false;
    if (fromPlace < 0 || fromPlace >= arr.length) return false;
    if (slots[toCell].length >= PLACES_PER_CELL) return false;

    const [obj] = arr.splice(fromPlace, 1);
    slots[toCell].push(obj);
    return true;
  }

  function initSlots() {
    shelfCount = cfg.SHELF_COUNT;
    totalSlots = shelfCount * CELLS_PER_SHELF;
    currentSpawnPerStep = cfg.SPAWN_PER_STEP;
    activeGrowthIdx = -1;
    slots = new Array(totalSlots).fill(null).map(() => []);
    const capacity = totalSlots * PLACES_PER_CELL;
    const fillCount = Math.floor(capacity * 0.6);

    let placed = 0;
    let guard = 0;
    while (placed < fillCount && guard < 500) {
      guard++;
      const idx = Math.floor(Math.random() * totalSlots);
      if (slots[idx].length < PLACES_PER_CELL) {
        slots[idx].push({ type: pickWeightedType() });
        placed++;
      }
    }

    let safety = 0;
    while (findMatchCells().length > 0 && safety < 100) {
      const cells = findMatchCells();
      const ci = cells[Math.floor(Math.random() * cells.length)];
      slots[ci][Math.floor(Math.random() * 3)].type = pickWeightedType();
      safety++;
    }
  }

  function reset() {
    initSlots();
    score = 0;
    maxCombo = 0;
    comboActive = false;
    comboCount = 0;
    comboEndsAt = 0;
    currentComboDuration = cfg.COMBO_BASE_DURATION_MS;
    spawnLocked = false;
    pendingSpawnAt = 0;
    pendingSpawnCount = 0;
    nowMs = 0;
    events = [];
  }

  function showPreview() { reset(); }

  function restoreProgress(savedScore, savedMaxCombo) {
    if (typeof savedScore === 'number' && savedScore > 0) score = savedScore;
    if (typeof savedMaxCombo === 'number' && savedMaxCombo > 0) maxCombo = savedMaxCombo;
  }

  function tick(dt) {
    nowMs += dt;

    if (comboActive && nowMs >= comboEndsAt) {
      breakCombo();
    }

    if (spawnLocked && nowMs >= pendingSpawnAt) {
      processPendingSpawn();
    }

    clearMatches();

    if (spawnLocked && nowMs >= pendingSpawnAt) {
      processPendingSpawn();
      clearMatches();
    }

    return { event: null };
  }

  function action(payload) {
    if (!payload) return { event: null };
    if (payload.kind === 'move') {
      const moved = moveItem(payload.fromCell, payload.fromPlace, payload.toCell);
      if (!moved) return { event: null };
    }
    const had = clearMatches();
    return { event: had ? 'score' : 'move' };
  }

  function getScore() { return score; }

  function getState() {
    return {
      slots,
      score,
      maxCombo,
      comboActive,
      comboCount,
      comboEndsAt,
      currentComboDuration,
      nowMs,
      spawnLocked,
      events,
      TOTAL_SLOTS: totalSlots,
      PLACES_PER_CELL,
      SHELF_COUNT: shelfCount,
      ROWS_PER_SHELF,
      COLS_PER_SHELF,
      CELLS_PER_SHELF,
      spawnPerStep: currentSpawnPerStep,
      activeGrowthIdx,
    };
  }

  function consumeEvents() {
    const out = events;
    events = [];
    return out;
  }

  return {
    reset, showPreview, tick, action,
    getScore, getState, consumeEvents, restoreProgress,
  };
}