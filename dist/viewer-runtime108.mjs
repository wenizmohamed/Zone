// Optional WebGL never blocks the game. One local retry, explicit state, hidden
// frames pause, and every listener/observer is owned by the viewer lifecycle.
export const VIEWER_STARTUP_TIMEOUT_MS = 25000;
export function viewerStartupTimeoutMs() { return VIEWER_STARTUP_TIMEOUT_MS; }
export function maxRenderDeltaSeconds() { return .1; }
export function installViewerRuntime({ canvas, render, fail, ready, pauseWhenHidden = true }) {
  let frame = null, disposed = false, failed = false, intersecting = true, last = 0;
  const sync = () => {
    const active = !disposed && !failed && (!pauseWhenHidden || (!document.hidden && intersecting));
    if (active && frame === null) { last = performance.now(); frame = requestAnimationFrame(tick); }
    if (!active && frame !== null) { cancelAnimationFrame(frame); frame = null; }
    document.body.dataset.zoneRendering = active ? 'active' : 'paused';
  };
  function tick(now) { frame = null; if (disposed || failed) return;
    try { render(Math.min((now - last) / 1000, .1), now / 1000); last = now; }
    catch (error) { errorState(error.message || 'viewer-render-failed'); return; }
    frame = requestAnimationFrame(tick);
  }
  function errorState(reason) { if (disposed || failed) return; failed = true; clearTimeout(deadline); sync(); document.body.dataset.zoneMediaState = 'error'; fail(reason); }
  const onLost = event => { event.preventDefault(); errorState('webgl-context-lost'); };
  const onError = event => { if (event.message || event.reason) errorState(event.message || event.reason?.message || 'viewer-runtime-error'); };
  const onPageHide = event => { if (!event.persisted) dispose(); };
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => { intersecting = entries.at(-1).isIntersecting; sync(); }) : null;
  observer?.observe(canvas); canvas.addEventListener('webglcontextlost', onLost);
  document.addEventListener('visibilitychange', sync); addEventListener('pagehide', onPageHide);
  addEventListener('error', onError); addEventListener('unhandledrejection', onError);
  const deadline = setTimeout(() => errorState('viewer-startup-timeout'), VIEWER_STARTUP_TIMEOUT_MS);
  function dispose() { if (disposed) return; disposed = true; clearTimeout(deadline); sync(); observer?.disconnect();
    canvas.removeEventListener('webglcontextlost', onLost); document.removeEventListener('visibilitychange', sync);
    removeEventListener('pagehide', onPageHide); removeEventListener('error', onError); removeEventListener('unhandledrejection', onError); }
  function diagnostics() { return { disposed, failed, intersecting, active: frame !== null, pauseWhenHidden }; }
  return { start() { if (disposed || failed) return; clearTimeout(deadline); document.body.dataset.zoneMediaState = 'ready'; ready?.(); sync(); }, fail: errorState, diagnostics, isDisposed: () => disposed, isFailed: () => failed, isActive: () => frame !== null, dispose };
}
