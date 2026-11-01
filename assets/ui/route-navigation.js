(() => {
  'use strict';
  const host = typeof window === 'object' ? window : globalThis;
  function create(win, doc) {
    let generation = 0, observer = null, frame = null, activeEntry = null, entrySerial = 0;
    const onScroll = () => {
      // popstate changes history.state before the replacement screen mounts.
      // Never write the outgoing viewport into that destination entry.
      if (activeEntry && win.history?.state?.zoneRouteKey === activeEntry.key) remember(activeEntry.screen);
    };
    function cancel() {
      generation++;
      observer?.disconnect(); observer = null;
      if (frame !== null) win.cancelAnimationFrame?.(frame);
      frame = null;
      activeEntry = null;
      win.removeEventListener?.('scroll', onScroll);
    }
    function entryKey() {
      return win.history?.state?.zoneRouteKey || `zone-${Date.now()}-${++entrySerial}`;
    }
    function remember(screen) {
      if (!win.history?.replaceState) return;
      const view = { screen, x: win.scrollX || 0, y: win.scrollY || 0 };
      try { win.history.replaceState({ ...win.history.state, zoneRouteKey: entryKey(), zoneView: view }, '', win.location.href); }
      catch (_) { /* A denied history cache cannot block gameplay navigation. */ }
    }
    function enter(screen, restore) {
      cancel(); const token = generation;
      const ready = () => {
        const main = doc.getElementById('zone-main');
        if (!main || main.dataset.zoneScreen !== screen) return;
        const heading = main.querySelector('h1');
        if (!heading) return;
        observer?.disconnect(); observer = null;
        frame = win.requestAnimationFrame(() => {
          frame = null;
          if (token !== generation || main.dataset.zoneScreen !== screen || !heading.isConnected) return;
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
          const saved = restore?.screen === screen && Number.isFinite(restore.x) && Number.isFinite(restore.y);
          const top = saved ? Math.max(0, restore.y) : Math.max(0, (win.scrollY || 0) + main.getBoundingClientRect().top - 12);
          win.scrollTo({ left: saved ? Math.max(0, restore.x) : 0, top, behavior: 'instant' });
          remember(screen);
          activeEntry = { key: win.history?.state?.zoneRouteKey, screen };
          win.addEventListener?.('scroll', onScroll, { passive: true });
        });
      };
      observer = new win.MutationObserver(ready);
      observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-zone-screen'] });
      ready();
    }
    function activeScreen() {
      return activeEntry?.screen || null;
    }
    function isActiveScreen(screen) {
      return typeof screen === 'string' && activeEntry?.screen === screen;
    }
    function activeKey() {
      return activeEntry?.key || null;
    }
    function isPending() {
      return observer !== null || frame !== null;
    }
    function hasActiveEntry() {
      return activeEntry !== null;
    }
    function currentScroll() {
      return { x: win.scrollX || 0, y: win.scrollY || 0 };
    }
    function hasObserver() {
      return observer !== null;
    }
    function hasFrame() {
      return frame !== null;
    }
    function currentGeneration() {
      return generation;
    }
    function currentEntrySerial() {
      return entrySerial;
    }
    function diagnostics() {
      return {
        generation,
        entrySerial,
        activeScreen: activeEntry?.screen || null,
        hasObserver: observer !== null,
        hasFrame: frame !== null,
      };
    }
    return { remember, enter, cancel, activeScreen, isActiveScreen, activeKey, isPending, hasActiveEntry, currentScroll, hasObserver, hasFrame, currentGeneration, currentEntrySerial, diagnostics };
  }
  host.ZoneRouteNavigation = { create };
  if (host.document && host.MutationObserver && host.requestAnimationFrame) {
    Object.assign(host.ZoneRouteNavigation, create(host, host.document));
  }
})();
