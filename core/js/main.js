// ============================================================
// [FILE: core/js/main.js]
// ============================================================

import { gameConfig, DEBUG_DISABLE_LIMIT } from '../../game/js/config.js';
import { createRules } from './rules.js';
import { createRenderer } from './render.js';

import { createDOM } from './dom-factory.js';
import { createUI } from './ui-generic.js';
import { createResize } from './resize.js';
import { createLifecycle } from './lifecycle.js';
import { createIntro } from './intro-factory.js';
import { createDragDrop } from './controls/drag-drop.js';
import { createPlayerLimits } from './player-limits-factory.js';
import { trackGoal, getClient, setCounterId, setClient } from './analytics.js';
import { state, updateState, resetGameState } from './state.js';

const $ = createDOM({
  boardContainer:    'boardContainer',
  startHint:         'limitHint',
  introModal:        'introModal',
  introAccept:       'introAccept',
  limitBestScore:    'limitBestScore',
  limitBestStreak:   'limitBestStreak',
  introLimitMinutes: 'introLimitMinutes',
  hudTimer:          'hudTimer',
  resetBtn:          'resetBtn',
  scoreLabel:        'scoreLabel',
  scoreValue:        'scoreValue',
  maxComboBox:       'maxComboBox',
  maxComboLabel:     'maxComboLabel',
  maxComboValue:     'maxComboValue',
  comboWrap:         'comboWrap',
  comboFill:         'comboFill',
  comboLabel:        'comboLabel',
}, { required: ['boardContainer', 'startHint', 'introModal', 'introAccept'] });


async function loadAnalyticsConfig() {
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('config.json not found');
    const json = await res.json();
    return {
      yandexMetrikaId: Number(json.yandexMetrikaId) || null,
      goatcounterUrl: json.goatcounterUrl ? String(json.goatcounterUrl) : null,
    };
  } catch (e) {
    console.warn('[analytics-config] config.json not loaded:', e.message);
    return { yandexMetrikaId: null, goatcounterUrl: null };
  }
}

function loadGoatCounter(url) {
  if (!url) return;
  window.goatcounter = { allow_local: true };
  const script = document.createElement('script');
  script.async = true;
  script.src = gameConfig.ASSETS.goatcounter;
  script.setAttribute('data-goatcounter', url);
  script.setAttribute('data-goatcounter-settings', '{"allow_local": true}');
  document.head.appendChild(script);
}

function loadMetrika(id) {
  if (!id) return;
  let loaded = false;
  function init() {
    if (loaded) return;
    loaded = true;
    (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) { return; }
      }
      k=e.createElement(t), a=e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r;
      a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + id, 'ym');

    window.ym(id, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });
  }

  const onInteraction = () => {
    document.removeEventListener('pointerdown', onInteraction);
    document.removeEventListener('keydown', onInteraction);
    setTimeout(init, 500);
  };
  document.addEventListener('pointerdown', onInteraction, { once: true });
  document.addEventListener('keydown', onInteraction, { once: true });

  window.addEventListener('load', () => setTimeout(init, 5000), { once: true });
}


function preloadFoodImages() {
  const list = gameConfig.FOOD_TYPES || [];
  const promises = [];
  for (const t of list) {
    if (!t.src) continue;
    promises.push(new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = t.src;
    }));
  }
  return Promise.all(promises);
}


async function bootstrap() {
  window.__state = state;

  // 1. Аналитика
  const analyticsConfig = await loadAnalyticsConfig();
  setCounterId(analyticsConfig.yandexMetrikaId);
  const client = getClient();
  setClient(client);
  loadGoatCounter(analyticsConfig.goatcounterUrl);
  loadMetrika(analyticsConfig.yandexMetrikaId);

  // 2. Лимиты
  const limits = createPlayerLimits(gameConfig, DEBUG_DISABLE_LIMIT);
  window.__limits = limits;
  limits.initPlayer();
  state.bestScore = limits.getBestScore();

  trackGoal('game_loaded', {
    type: limits.isReturning() ? 'returning' : 'new',
    client,
  });

  // 3. Механика + рендер
  const rules = createRules();
  window.__rules = rules;
  const renderer = createRenderer($.boardContainer);

  // 4. UI
  const ui = createUI({
    $,
    limits,
    fields: [
      { id: 'scoreValue', key: 'score' },
    ],
    timer: { limitMinutes: gameConfig.PLAY_LIMIT_MINUTES },
    combo: {
      get: () => {
        const snap = rules.getState();
        return {
          active: snap.comboActive,
          count: snap.comboCount,
          endsAt: snap.comboEndsAt,
          nowMs: snap.nowMs,
          duration: snap.currentComboDuration,
        };
      },
      prefix: gameConfig.TEXTS.comboPrefix,
      baseDurationMs: gameConfig.COMBO_BASE_DURATION_MS,
    },
    hints: true,
  });

  if ($.scoreLabel)     $.scoreLabel.textContent = gameConfig.TEXTS.scoreLabel;
  if ($.maxComboLabel)  $.maxComboLabel.textContent = gameConfig.TEXTS.maxComboLabel;
  if ($.resetBtn)       $.resetBtn.textContent = gameConfig.TEXTS.resetLabel;

  // 5. Drag&drop
  const drag = createDragDrop({
    getBoardRoot: () => $.boardContainer,
    getSlots: () => rules.getState().slots,
    canDrop: (toCell) => {
      const slots = rules.getState().slots;
      const arr = slots[toCell];
      return !!arr && arr.length < gameConfig.PLACES_PER_CELL;
    },
    onMove: (fromCell, fromPlace, toCell) => {
      if (!state.gameUnlocked) return;
      if (state.limitReached) return;
      if (!state.gameActive) beginSession();

      const before = rules.getState();
      const res = rules.action({ kind: 'move', fromCell, fromPlace, toCell });
      const after = rules.getState();

      if (res.event === 'move' || res.event === 'score') {
        renderer.render(after, drag.handlers);
        if (before.score !== after.score) {
          updateState({ score: after.score }, ui);
        }
        limits.saveCurrentProgress(after.score, after.maxCombo);
      }
    },
  });

  drag.attach();

  // 6. RAF-цикл
  let rafId = null;
  let lastTs = 0;
  let prevScore = 0;
  let prevMaxCombo = 0;

  function frame(ts) {
    if (!state.gameActive) {
      rafId = null;
      lastTs = 0;
      return;
    }
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt < 0) dt = 0;
    if (dt > 100) dt = 100;

    rules.tick(dt);

    const events = rules.consumeEvents();
    if (events.length) {
      renderer.render(rules.getState(), drag.handlers);
      renderer.applyEvents(events);
    }

    const snap = rules.getState();

    if (snap.score !== prevScore) {
      prevScore = snap.score;
      updateState({ score: snap.score }, ui);
      limits.saveCurrentProgress(snap.score, snap.maxCombo);
    }

    if (snap.maxCombo !== prevMaxCombo) {
      prevMaxCombo = snap.maxCombo;
      limits.updateBestStreak(snap.maxCombo);
      limits.saveCurrentProgress(snap.score, snap.maxCombo);
      if (state.comboActive) ui.showComboPopup('x' + snap.comboCount);
    }

    rafId = requestAnimationFrame(frame);
  }

  function startRaf() {
    if (rafId) return;
    lastTs = 0;
    prevScore = state.score;
    prevMaxCombo = state.maxCombo;
    rafId = requestAnimationFrame(frame);
  }

  function stopRaf() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    lastTs = 0;
  }

  function beginSession() {
    if (state.gameActive) return;
    limits.startSession();
    updateState({
      gameStarted: true,
      gameActive: true,
      limitReached: false,
      hintVisible: false,
    }, ui);
    startRaf();
  }

  function startNewGame() {
    if (state.gameActive) limits.flushSession();
    resetGameState();
    rules.reset();
    limits.clearCurrentProgress();
    ui.render();
    renderer.render(rules.getState(), drag.handlers);
    limits.startSession();
    stopRaf();
    startRaf();
    updateState({
      gameStarted: true,
      gameActive: true,
      limitReached: false,
      hintVisible: false,
      score: 0,
      maxCombo: 0,
    }, ui);
  }

  if ($.resetBtn) {
    $.resetBtn.addEventListener('click', () => {
      if (!state.gameUnlocked) return;
      startNewGame();
    });
  }

  createResize({
    target: $.boardContainer,
    onResize: (w, h) => {
      ui.setHudFontSize(w);
      renderer.render(rules.getState(), drag.handlers);
      requestAnimationFrame(() => renderer.fitAllItems());
    },
  });

  function unlockGame() {
    if (state.gameUnlocked) return;

    state.score = 0;
    state.maxCombo = 0;

    updateState({ gameUnlocked: true, cookiesAccepted: true }, ui);

    rules.showPreview();
    renderer.render(rules.getState(), drag.handlers);

    if (limits.isLimitReached()) {
      updateState({ limitReached: true, hintVisible: true, hintKind: 'limit' }, ui);
    } else {
      const savedScore = limits.getCurrentScore();
      const savedMaxCombo = limits.getCurrentMaxCombo();
      if (savedScore > 0 || savedMaxCombo > 0) {
        rules.restoreProgress(savedScore, savedMaxCombo);
        renderer.render(rules.getState(), drag.handlers);
        updateState({ score: savedScore, maxCombo: savedMaxCombo }, ui);
      } else {
        updateState({ score: 0, maxCombo: 0 }, ui);
      }
      beginSession();
    }
    ui.render();
    ui.updateTimer();
    ui.setupCombo();
  }

  const intro = createIntro({ $, gameConfig, onAccept: unlockGame });
  intro.init();

  setInterval(() => {
    if (!state.gameUnlocked) return;
    if (!state.gameActive && !state.gameStarted && limits.isLimitReached()) {
      updateState({ limitReached: true, hintVisible: true, hintKind: 'limit' }, ui);
    }
    if (state.gameActive) limits.tickSession();
    ui.updateTimer();

    if (state.gameActive && limits.isLimitReached()) {
      stopRaf();
      limits.flushSession();
      const isNewRecord = limits.updateBestScore(state.score);
      limits.clearCurrentProgress();
      trackGoal('daily_limit_reached', {
        score: state.score,
        combo: state.maxCombo,
        client,
      });
      updateState({
        gameActive: false,
        limitReached: true,
        hintVisible: true,
        hintKind: 'limit',
        ...(isNewRecord ? { bestScore: state.score } : {}),
      }, ui);
    }
  }, 1000);

  createLifecycle({
    isActive: () => state.gameActive,
    onFlush: () => {
      limits.flushSession();
    },
    onHide: () => {},
  });

  $.startHint.addEventListener('click', () => {
    if (!state.gameUnlocked) return;
    if (state.limitReached) return;
    if (state.gameActive) return;
    beginSession();
  });

    let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  
  await preloadFoodImages();
}

bootstrap().then(() => {
  function hidePreloader() {
    document.documentElement.classList.add('ready');
  }
  if (document.readyState === 'complete') {
    hidePreloader();
  } else {
    window.addEventListener('load', hidePreloader, { once: true });
    setTimeout(hidePreloader, 10000);
  }
});