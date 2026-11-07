// ============================================================
// [FILE: core/js/lifecycle.js]
// ============================================================

export function createLifecycle({ isActive, onFlush, onHide }) {

  function handleBeforeUnload() { if (isActive()) onFlush(); }
  function handlePageHide()     { if (isActive()) onFlush(); }
  function handleVisibilityChange() {
    if (document.hidden && isActive()) onHide();
  }

  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return {
    destroy() {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}