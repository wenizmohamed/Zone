(() => {
  'use strict';
  const link = document.getElementById('zone-published-theme');
  if (!link) return;
  const previous = window.ZonePublishedTheme115;
  if (previous?.link === link && !previous.disposed) return;
  previous?.dispose?.();
  let timer = null, disposed = false, ready = false;
  const clearDeadline = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const publish = (status, reason) => {
    document.documentElement.dataset.zonePublishedTheme = status;
    if (reason) document.documentElement.dataset.zonePublishedThemeReason = reason;
    else delete document.documentElement.dataset.zonePublishedThemeReason;
  };
  const detach = () => {
    clearDeadline();
    link.removeEventListener('load', onLoad);
    link.removeEventListener('error', onError);
  };
  const dispose = () => { if (disposed) return; disposed = true; detach(); };
  const onLoad = () => {
    if (disposed || ready) return;
    ready = true;
    detach();
    link.media = 'all';
    publish('ready');
  };
  const onError = () => {
    if (disposed || ready) return;
    clearDeadline();
    publish('unavailable', 'load-error');
  };
  window.ZonePublishedTheme115 = { link, dispose, get disposed() { return disposed; } };
  publish('pending');
  link.addEventListener('load', onLoad);
  link.addEventListener('error', onError);
  // A missing optional theme cannot hold the built-in game palette hostage.
  // Keep listening after this diagnostic: a later valid load still applies.
  timer = setTimeout(() => {
    timer = null;
    if (!disposed && !ready) publish('unavailable', 'timeout');
  }, 8000);
  // Attach first, then check CSSOM: a cached load can precede this async file.
  if (link.sheet) onLoad();
})();
