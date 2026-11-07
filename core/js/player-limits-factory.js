// ============================================================
// [FILE: core/js/player-limits-factory.js]
// bestScore = максимум очков, bestStreak = максимум комбо.
// currentScore / currentMaxCombo — текущая партия (для восстановления).
// ============================================================

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createPlayerLimits(gameConfig, DEBUG_DISABLE_LIMIT = false) {

  const LIMIT_MS        = gameConfig.PLAY_LIMIT_MINUTES * 60 * 1000;
  const RESET_WINDOW_MS = gameConfig.LIMIT_RESET_HOURS * 60 * 60 * 1000;

  let player = null;
  let sessionStart = null;
  let lastTick = null;

  function save() {
    if (!player) return;
    try { localStorage.setItem(gameConfig.STORAGE_KEY, JSON.stringify(player)); } catch (e) {}
  }

  function refreshWindow() {
    if (!player) return false;
    const now = Date.now();
    if (!player.windowStart) { player.windowStart = now; save(); return false; }
    if (now - player.windowStart >= RESET_WINDOW_MS) {
      player.usedMs = 0;
      player.windowStart = now;
      save();
      return true;
    }
    return false;
  }

  function initPlayer() {
    let p = null;
    try {
      const raw = localStorage.getItem(gameConfig.STORAGE_KEY);
      if (raw) p = JSON.parse(raw);
    } catch (e) {}
    if (!p || typeof p !== 'object' || !p.id) {
      p = {
        id: uuidv4(),
        createdAt: Date.now(),
        usedMs: 0,
        windowStart: Date.now(),
        totalGames: 0,
        totalPlayMs: 0,
        bestScore: 0,
        bestStreak: 0,
        currentScore: 0,
        currentMaxCombo: 0,
      };
    }
    if (!p.windowStart) p.windowStart = Date.now();
    if (typeof p.bestScore !== 'number') p.bestScore = 0;
    if (typeof p.bestStreak !== 'number') p.bestStreak = 0;
    if (typeof p.currentScore !== 'number') p.currentScore = 0;
    if (typeof p.currentMaxCombo !== 'number') p.currentMaxCombo = 0;
    player = p;
    refreshWindow();
    save();
    return p;
  }

  function getRemainingMs() {
    if (DEBUG_DISABLE_LIMIT) return LIMIT_MS;
    if (!player) return LIMIT_MS;
    refreshWindow();
    return Math.max(0, LIMIT_MS - player.usedMs);
  }

  function isLimitReached() {
    if (DEBUG_DISABLE_LIMIT) return false;
    return getRemainingMs() <= 0;
  }

  function getBestScore() { return player ? (player.bestScore || 0) : 0; }

  function updateBestScore(score) {
    if (!player) return false;
    if (typeof score !== 'number' || score <= 0) return false;
    if (score <= (player.bestScore || 0)) return false;
    player.bestScore = score;
    save();
    return true;
  }

  function getBestStreak() { return player ? (player.bestStreak || 0) : 0; }

  function updateBestStreak(streak) {
    if (!player) return false;
    if (typeof streak !== 'number' || streak <= 0) return false;
    if (streak <= (player.bestStreak || 0)) return false;
    player.bestStreak = streak;
    save();
    return true;
  }

  function getCurrentScore() { return player ? (player.currentScore || 0) : 0; }
  function getCurrentMaxCombo() { return player ? (player.currentMaxCombo || 0) : 0; }

  function saveCurrentProgress(score, maxCombo) {
    if (!player) return;
    player.currentScore = typeof score === 'number' ? score : 0;
    player.currentMaxCombo = typeof maxCombo === 'number' ? maxCombo : 0;
    save();
  }

  function clearCurrentProgress() {
    if (!player) return;
    player.currentScore = 0;
    player.currentMaxCombo = 0;
    save();
  }

  function startSession() {
    if (!player) return;
    sessionStart = Date.now();
    lastTick = null;
    player.totalGames++;
    save();
  }

  function endSession() { sessionStart = null; lastTick = null; save(); }

  function tickSession() {
    if (!player || !sessionStart) { lastTick = null; return; }
    const now = Date.now();
    if (lastTick !== null) {
      const delta = now - lastTick;
      if (delta > 0 && delta < 10000) {
        player.usedMs += delta;
        player.totalPlayMs += delta;
        save();
      }
    }
    lastTick = now;
  }

  function flushSession() {
    if (sessionStart && player && lastTick) {
      const delta = Date.now() - lastTick;
      if (delta > 0 && delta < 2000) {
        player.usedMs += delta;
        player.totalPlayMs += delta;
      }
    }
    sessionStart = null;
    lastTick = null;
    save();
  }

  function isReturning() {
    try {
      const key = gameConfig.STORAGE_KEY + '_intro_accepted';
      return localStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  }

  return {
    initPlayer, getRemainingMs, isLimitReached,
    getBestScore, updateBestScore,
    getBestStreak, updateBestStreak,
    getCurrentScore, getCurrentMaxCombo,
    saveCurrentProgress, clearCurrentProgress,
    startSession, endSession, tickSession, flushSession,
    isReturning,
  };
}