// ============================================================
// [FILE: core/js/intro-factory.js]
// ============================================================

import { trackGoal } from './analytics.js';

const ACCEPT_KEY_SUFFIX = '_intro_accepted';
const HIDE_ANIMATION_MS = 350;

export function createIntro({ $, gameConfig, onAccept }) {
  const modal = $.introModal;
  const acceptBtn = $.introAccept;

  if ($.introLimitMinutes) {
    $.introLimitMinutes.textContent = gameConfig.PLAY_LIMIT_MINUTES;
  }

  const acceptKey = gameConfig.STORAGE_KEY + ACCEPT_KEY_SUFFIX;

  let alreadyAccepted = false;
  try { alreadyAccepted = localStorage.getItem(acceptKey) === '1'; } catch (e) {}

  function hideModal() {
    modal.classList.add('hidden');
    setTimeout(() => { modal.style.display = 'none'; }, HIDE_ANIMATION_MS);
  }

  function accept() {
    try { localStorage.setItem(acceptKey, '1'); } catch (e) {}
    trackGoal('cookie_accepted');
    hideModal();
    onAccept();
  }

  function init() {
    let forceReopen = false;
    try {
      forceReopen = sessionStorage.getItem('reopenIntro') === '1';
      if (forceReopen) {
        sessionStorage.removeItem('reopenIntro');
      }
    } catch (e) {
      forceReopen = false;
    }

    if (alreadyAccepted && !forceReopen) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      onAccept();
      return;
    }

    modal.classList.remove('hidden');
    modal.style.display = '';
    acceptBtn.addEventListener('click', accept);
  }

  return { init, accept, isAccepted: () => alreadyAccepted };
}