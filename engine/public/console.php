<?php declare(strict_types=1); ?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="ZONE modular PHP 8.5 game engine presentation console">
  <title>ZONE Engine Control Room</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/engine/theme.css">
  <link rel="stylesheet" href="/engine/assets/engine.css">
</head>
<body>
  <div class="gridwash" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="/engine" aria-label="ZONE Engine home">
      <span class="brand-mark">Z</span>
      <span><strong>ZONE</strong><small data-i18n="engine">GAME ENGINE</small></span>
    </a>
    <div class="top-actions">
      <span class="live-pill"><i></i><span data-i18n="runtime">PHP 8.5 RUNTIME</span></span>
      <button class="ghost" id="languageButton" type="button">English</button>
      <a class="ghost" href="/" data-i18n="openGame">OPEN GAME</a>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="eyebrow"><span>FOUNDATION 0.1</span><span data-i18n="proof">EXECUTABLE PROOF</span></div>
      <h1 data-i18n="headline">A modular engine beneath the game.</h1>
      <p data-i18n="subhead">PHP owns every result. Modules react through events. Themes change without touching gameplay. Every currency movement leaves a trail.</p>
      <div class="hero-actions">
        <button class="primary" id="runCrimeButton" type="button" data-i18n="runProof">RUN SERVER PROOF</button>
        <a class="secondary" href="#architecture" data-i18n="inspect">INSPECT ARCHITECTURE</a>
      </div>
    </section>

    <section class="metrics" id="metrics" aria-label="Engine status">
      <article><span data-i18n="php">PHP</span><strong id="metricPhp">...</strong><small data-i18n="authoritative">AUTHORITATIVE LOGIC</small></article>
      <article><span data-i18n="database">DATABASE</span><strong id="metricDb">...</strong><small data-i18n="adapter">SWAPPABLE ADAPTER</small></article>
      <article><span data-i18n="modules">MODULES</span><strong id="metricModules">...</strong><small data-i18n="discovered">DISCOVERED PACKAGES</small></article>
      <article><span data-i18n="events">EVENTS</span><strong id="metricEvents">...</strong><small data-i18n="audit">AUDITABLE HOOKS</small></article>
    </section>

    <section class="section" id="architecture">
      <div class="section-head">
        <div><span class="section-number">01</span><h2 data-i18n="architecture">Engine architecture</h2></div>
        <p data-i18n="architectureCopy">Each dependency points inward. The game, database, Redis, workers, and future mobile apps connect through explicit ports.</p>
      </div>
      <div class="flow" id="architectureFlow"></div>
      <div class="infra" id="infrastructure"></div>
    </section>

    <section class="section split">
      <div>
        <div class="section-head compact">
          <div><span class="section-number">02</span><h2 data-i18n="moduleControl">Module control</h2></div>
        </div>
        <p class="section-copy" data-i18n="moduleCopy">Install, remove, enable, or disable a package without editing the core.</p>
        <div class="stack" id="moduleList"></div>
      </div>
      <div>
        <div class="section-head compact">
          <div><span class="section-number">03</span><h2 data-i18n="themeControl">Theme control</h2></div>
        </div>
        <p class="section-copy" data-i18n="themeCopy">Swap the view layer while modules and game state remain untouched.</p>
        <div class="stack" id="themeList"></div>
      </div>
    </section>

    <section class="section proof-grid">
      <div class="proof-panel">
        <div class="section-head compact">
          <div><span class="section-number">04</span><h2 data-i18n="liveProof">Live server proof</h2></div>
        </div>
        <div class="player" id="playerCard"></div>
        <label for="crimeSelect" data-i18n="crime">Crime module action</label>
        <div class="action-row">
          <select id="crimeSelect"></select>
          <button class="primary" id="attemptButton" type="button" data-i18n="attempt">ATTEMPT</button>
        </div>
        <div class="result empty" id="crimeResult" data-i18n="resultWaiting">No client-selected reward. The server will calculate the result.</div>
      </div>
      <div class="api-panel">
        <div class="console-head"><span>API TRACE</span><button id="clearTraceButton" type="button">CLEAR</button></div>
        <pre id="apiTrace">GET /api/v1/health</pre>
      </div>
    </section>

    <section class="section split audit-section">
      <div>
        <div class="section-head compact"><div><span class="section-number">05</span><h2 data-i18n="ledger">Economy ledger</h2></div></div>
        <div class="audit-list" id="ledgerList"></div>
      </div>
      <div>
        <div class="section-head compact"><div><span class="section-number">06</span><h2 data-i18n="eventLog">Event and hook log</h2></div></div>
        <div class="audit-list" id="eventList"></div>
      </div>
    </section>
  </main>

  <footer>
    <span>ZONE ENGINE FOUNDATION</span>
    <span data-i18n="footer">CORE + MODULES + THEMES + API + LEDGER + EVENTS</span>
  </footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script src="/engine/assets/engine.js" defer></script>
</body>
</html>
