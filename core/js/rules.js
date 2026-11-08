// ============================================================
// [FILE: core/js/rules.js]
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

function comboMultiplier(comboCount) {
  const raw = 1 + Math.sqrt(Math.max(0, comboCount - 1)) * 0.6;
  return Math.min(raw, 6);
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

  let activeGrowthIdx = -1;
  let forceStreak = 0;

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

  function countEmptyPlaces() {
    let n = 0;
    for (let i = 0; i < totalSlots; i++) {
      n += PLACES_PER_CELL - slots[i].length;
    }
    return n;
  }

  function countDistinctTypes() {
    const set = new Set();
    for (let i = 0; i < totalSlots; i++) {
      for (const it of slots[i]) set.add(it.type);
    }
    return set.size;
  }

  function buildTypeCounts() {
    const counts = {};
    for (let i = 0; i < totalSlots; i++) {
      for (const it of slots[i]) {
        counts[it.type] = (counts[it.type] || 0) + 1;
      }
    }
    return counts;
  }

  function hasAnyPair(counts) {
    for (const t in counts) {
      if (counts[t] >= 2) return true;
    }
    return false;
  }

  function pickTypeAntiStuck() {
    const total = totalSlots * PLACES_PER_CELL;
    const empty = countEmptyPlaces();
    const distinct = countDistinctTypes();
    const totalTypes = FOOD_IDS.length;
    const typeCounts = buildTypeCounts();

    const nearFull  = empty < total * 0.25;
    const fewTypes  = distinct < Math.max(3, totalTypes / 3);
    const noPairs   = !hasAnyPair(typeCounts); // ни одного типа 2+ раз — точно тупик

    const needForce = (nearFull || fewTypes || noPairs) && forceStreak < 2;

    if (!needForce) {
      forceStreak = 0;
      return pickWeightedType();
    }

    // 1) ячейка с 2 одинаковыми → добавить третий
    const pairs = [];
    for (let i = 0; i < totalSlots; i++) {
      const arr = slots[i];
      if (arr.length === PLACES_PER_CELL - 1 &&
          arr[0].type === arr[1].type) {
        pairs.push(arr[0].type);
      }
    }
    if (pairs.length > 0) {
      forceStreak++;
      return pairs[Math.floor(Math.random() * pairs.length)];
    }

    // 2) ячейка с 1 item и тип встречается ещё где-то → создать пару
    const singles = [];
    for (let i = 0; i < totalSlots; i++) {
      const arr = slots[i];
      if (arr.length >= 1 && arr.length < PLACES_PER_CELL) {
        const t = arr[0].type;
        if ((typeCounts[t] || 0) >= 2) singles.push(t);
      }
    }
    if (singles.length > 0) {
      forceStreak++;
      return singles[Math.floor(Math.random() * singles.length)];
    }

    // 3) на поле нет пар вообще — взять тип из любой неполной ячейки
    //    и создать вторую копию (формируем пару с нуля)
    const anyIncomplete = [];
    for (let i = 0; i < totalSlots; i++) {
      const arr = slots[i];
      if (arr.length >= 1 && arr.length < PLACES_PER_CELL) {
        anyIncomplete.push(arr[0].type);
      }
    }
    if (anyIncomplete.length > 0) {
      forceStreak++;
      return anyIncomplete[Math.floor(Math.random() * anyIncomplete.length)];
    }

    forceStreak = 0;
    return pickWeightedType();
  }

  function spawnOneItem() {
    if (cfg.MAX_ITEMS_ON_FIELD >= 0 &&
        countItemsOnField() >= cfg.MAX_ITEMS_ON_FIELD) return null;
    const free = listFreePlaces();
    if (free.length === 0) return null;
    const spot = free[Math.floor(Math.random() * free.length)];
    const type = pickTypeAntiStuck();
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

    if (removed > 0) {
      const cutFrom = totalSlots - removed * CELLS_PER_SHELF;
      const itemsToMove = [];
      for (let i = cutFrom; i < totalSlots; i++) {
        for (const it of slots[i]) itemsToMove.push(it);
      }

      slots.splice(cutFrom, removed * CELLS_PER_SHELF);
      shelfCount = newShelves;
      totalSlots = shelfCount * CELLS_PER_SHELF;

      // переносим item с удалённой полки в свободные места
      for (const it of itemsToMove) {
        const free = listFreePlaces();
        if (free.length === 0) break;
        const spot = free[Math.floor(Math.random() * free.length)];
        slots[spot.cell].push(it);
      }

      // если после сжатия поле переполнено — убрать лишнее
      const overflow = countItemsOnField() - cfg.MAX_ITEMS_ON_FIELD;
      if (cfg.MAX_ITEMS_ON_FIELD >= 0 && overflow > 0) {
        let removedCount = 0;
        for (let i = totalSlots - 1; i >= 0 && removedCount < overflow; i--) {
          while (slots[i].length > 0 && removedCount < overflow) {
            slots[i].pop();
            removedCount++;
          }
        }
      }
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

    const mult = comboMultiplier(startOrExtendCombo());
    const pointsPerCell = Math.round(cfg.COMBO_BASE_POINTS * mult);

    for (let i = 0; i < cells.length; i++) {
      score += i === 0 ? pointsPerCell : Math.round(pointsPerCell * 0.5);
    }

    for (const ci of cells) {
      const firstItem = slots[ci][0];
      events.push({ type: 'merge', cellIndex: ci, foodType: firstItem ? firstItem.type : null });
      slots[ci] = [];
    }

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
    forceStreak = 0;
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