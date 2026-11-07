// ============================================================
// [FILE: core/js/ui-generic.js]
// ============================================================

import { state } from './state.js';
import { engineConfig } from './engine-config.js';

export function createUI({ $, limits, fields = [], timer = null, combo = null, hints = true }) {

  let rafId = null;
  let lastFastState = false;
  let prevComboActive = false;


  function formatTimer(ms) {
    const totalSec = Math.ceil(Math.max(0, ms) / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function render() {
    if (hints) {
      document.body.dataset.hint = state.hintVisible ? state.hintKind : 'none';
    }

    for (const f of fields) {
      const el = $[f.id];
      if (!el) continue;
      const val = typeof f.get === 'function' ? f.get(state) : state[f.key];
      el.textContent = f.format ? f.format(val) : String(val ?? '');
    }

    if ($.limitBestScore && limits) {
      $.limitBestScore.textContent = limits.getBestScore();
    }
    if ($.limitBestStreak && limits) {
      $.limitBestStreak.textContent = 'x' + limits.getBestStreak();
    }
  }

  function updateTimer() {
    if (!timer || !$.hudTimer || !limits) return;

    const ms = limits.getRemainingMs();
    $.hudTimer.textContent = formatTimer(ms);

    const limitMs = Math.max(1, timer.limitMinutes * 60 * 1000);
    const ratio = ms / limitMs;

    const timerBox = $.hudTimer.closest('.hud-stat.timer') || $.hudTimer;
    timerBox.classList.remove('is-warning', 'is-danger', 'is-critical');

    if (ratio <= engineConfig.TIMER_CRITICAL_RATIO)      timerBox.classList.add('is-critical');
    else if (ratio <= engineConfig.TIMER_DANGER_RATIO)   timerBox.classList.add('is-danger');
    else if (ratio <= engineConfig.TIMER_WARN_RATIO)     timerBox.classList.add('is-warning');
  }

  function setupCombo() {
    if (!combo || !$.comboWrap) return;
    if (!rafId) {
      rafId = requestAnimationFrame(comboTick);
    }
  }

  function comboDataProvider() {
    if (!combo || typeof combo.get !== 'function') return null;
    return combo.get();
  }

  function comboTick() {
    const data = comboDataProvider();
    if (data) {
      if ($.maxComboValue) {
        $.maxComboValue.textContent = 'x' + (data.count || 0);
      }

      if (data.active) {
        $.comboWrap.classList.add('visible');
        $.comboWrap.classList.add('active-glow');

        if (!prevComboActive) {
          // первый кадр активного комбо — вспышка
          $.comboWrap.classList.add('combo-flash');
          setTimeout(() => $.comboWrap.classList.remove('combo-flash'), 400);
        }

        const remaining = data.endsAt - data.nowMs;
        const ratio = Math.max(0, Math.min(1, remaining / data.duration));
        $.comboFill.style.transform = 'scaleX(' + ratio + ')';

        if ($.comboLabel) {
          $.comboLabel.textContent = (combo.prefix || 'КОМБО');
        }

        const isFast = data.duration <= (combo.baseDurationMs || 8000) * 0.6;
        if (isFast !== lastFastState) {
          $.comboWrap.classList.toggle('fast', isFast);
          lastFastState = isFast;
        }
      } else {
        // комбо неактивно — полоса остаётся видимой, но пустой
        if ($.comboWrap.classList.contains('active-glow') ||
            $.comboWrap.classList.contains('fast')) {
          $.comboWrap.classList.remove('active-glow');
          $.comboWrap.classList.remove('fast');
          $.comboFill.style.transform = 'scaleX(0)';
          lastFastState = false;
        }
      }

      prevComboActive = data.active;
    }
    rafId = requestAnimationFrame(comboTick);
  }

  function stopCombo() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function showComboPopup(text) {
    if (!$.comboWrap) return;
    const pop = document.createElement('div');
    pop.className = 'combo-pop';
    pop.textContent = text;
    $.comboWrap.appendChild(pop);
    setTimeout(() => pop.remove(), 950);
  }

  function setHudFontSize(w) {
    if (!$.hudLayer) return;
    const raw = w * 0.038;
    const px = Math.round(Math.min(20, Math.max(14, raw)));
    $.hudLayer.style.setProperty('--hud-font-size', px + 'px');
  }

  function markNewRecord() {
    if (!$.maxComboBox) return;
    $.maxComboBox.classList.remove('new-record');
    void $.maxComboBox.offsetWidth;
    $.maxComboBox.classList.add('new-record');
    setTimeout(() => $.maxComboBox.classList.remove('new-record'), 750);
  }

  return {
    render, updateTimer, setHudFontSize,
    setupCombo, stopCombo, showComboPopup, markNewRecord,
  };
}