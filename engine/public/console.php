<?php declare(strict_types=1); $language = ($_GET['lang'] ?? '') === 'ar' ? 'ar' : 'en'; ?>
<!doctype html>
<html lang="<?= $language ?>" dir="<?= $language === 'ar' ? 'rtl' : 'ltr' ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="ZONE Open Engine: create game content, customize pages, manage registered extensions and publish reviewed changes.">
  <title>ZONE Open Engine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/engine/theme.css">
  <link rel="stylesheet" href="/engine/assets/engine.css">
  <style id="engine-studio-style"><?php readfile(__DIR__ . '/assets/studio-engine.css'); ?></style>
</head>
<body class="studio-body">
  <a class="studio-skip" href="#start" data-i18n="skipContent">Skip to workspace</a>
  <div class="gridwash" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="/engine" aria-label="ZONE Open Engine home">
      <span class="brand-mark">Z</span>
      <span><strong>ZONE</strong><small data-i18n="engine">OPEN ENGINE</small></span>
    </a>
    <div class="top-actions">
      <a class="ghost" href="/" data-i18n="openGame">View game</a>
      <button class="ghost" id="languageButton" type="button">English</button>
      <a class="primary studio-workspace-link" href="/admin" data-i18n="openAdmin">Open workspace</a>
    </div>
  </header>

  <div class="studio-shell">
    <aside class="studio-rail">
      <button class="studio-menu-button" id="engineMenuButton" type="button" aria-controls="engineNav" aria-expanded="false" data-i18n="workspaceMenu">Workspace navigation</button>
      <nav class="studio-nav" id="engineNav" aria-label="Engine workspace">
        <span class="studio-nav-label" data-i18n="workspaceNav">WORKSPACE</span>
        <a href="#start" aria-current="location" data-i18n="startNav">Start here</a>
        <a href="#extensions" data-i18n="extensionsNav">Extensions</a>
        <a href="#appearance" data-i18n="appearanceNav">Appearance</a>
        <span class="studio-nav-label" data-i18n="advancedNav">ADVANCED</span>
        <a href="#testing" data-i18n="testingNav">Server action test</a>
        <a href="#activity" data-i18n="activityNav">Activity & economy</a>
        <a href="#architecture" data-i18n="architectureNav">Runtime & architecture</a>
      </nav>
      <div class="studio-rail-note">
        <span class="studio-status-dot" aria-hidden="true"></span>
        <span id="engineConnectionStatus" role="status" aria-live="polite" data-i18n="connecting">Connecting to engine</span>
        <small data-i18n="draftReminder">Saved changes reach players only after you publish a release.</small>
      </div>
    </aside>

    <main id="engineWorkspace">
      <section class="studio-start" id="start" tabindex="-1">
        <div class="studio-breadcrumb"><span>ZONE</span><span aria-hidden="true">/</span><span data-i18n="engine">Open Engine</span></div>
        <div class="studio-page-heading">
          <div><p class="studio-kicker" data-i18n="creatorSpace">YOUR GAME, YOUR WORKSPACE · SYNDICATE EDITION 3.6 LIVE</p><h1 data-i18n="headline">Open Engine</h1></div>
          <button class="secondary" id="refreshEngineButton" type="button" data-i18n="refreshEngine">Refresh engine data</button>
        </div>
        <p class="studio-intro" data-i18n="subhead">Build and customize ZONE from one workspace. Choose what you want to create, save your draft, then review it before publishing.</p>
        <div class="studio-workflow" data-open-engine-console-deck="1" data-open-engine-agi-console="1" style="margin-bottom:18px;border-top:2px solid var(--acc,#a3d900)">
          <div class="studio-workflow-heading"><h2>Open Engine 3.6 — Autonomous AGI Game Architect</h2><a href="/admin">Open Full AGI Studio ↗</a></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px;margin:12px 0">
            <div style="background:#080a0d;border:1px solid #252b33;border-radius:6px;padding:12px;display:flex;gap:12px;align-items:center">
              <div style="flex:1;min-width:0">
                <small style="color:#a3d900;font-weight:700;letter-spacing:.08em">3D CLOTHED CHARACTER WARDROBE</small>
                <strong style="display:block;margin:3px 0;font-size:14px">Suit.glb · Casual_Hoodie.glb · Swat.glb + Armor</strong>
                <p style="margin:0 0 6px;font-size:12px;opacity:.82">Fully clothed 3D character rigs with 24 combat/idle/walk animations, 19 right-hand finger grip bones, and dynamic worn Kevlar vest attachment.</p>
                <small style="color:#a3d900">Executive Suit · Street Hoodie · Tactical SWAT</small>
              </div>
            </div>
            <div style="background:#080a0d;border:1px solid #252b33;border-radius:6px;padding:12px;display:flex;gap:12px;align-items:center">
              <div style="width:144px;height:92px;background:#14181d;border:1px solid #2b3137;border-radius:4px;display:flex;align-items:center;justify-content:center;flex:none;padding:4px;overflow:hidden">
                <img src="/assets/weapons/upgrades111/l85-thumbnail.png" alt="3D PBR Bullpup Assault Rifle" style="width:100%;height:100%;object-fit:contain;display:block">
              </div>
              <div style="flex:1;min-width:0">
                <small style="color:#a3d900;font-weight:700;letter-spacing:.08em">3D PBR WEAPON STUDIO (51 WEAPONS)</small>
                <strong style="display:block;margin:3px 0;font-size:14px">Bullpup L85 · M4A1 · G3A3 · AKM · Dragunov</strong>
                <p style="margin:0 0 6px;font-size:12px;opacity:.82">High-detail 3D GLB weapon models with blued steel, matte polymer, Picatinny rails, and calibrated right-hand weapon sockets.</p>
                <small style="color:#a3d900">51 Real 3D GLB Weapons · Offline Cycles Thumbnails</small>
              </div>
            </div>
          </div>
          <div style="margin:12px 0;padding:12px;background:#0b0e12;border:1px solid #252b33;border-radius:6px">
            <label for="engineAgiPromptInput" style="display:block;font-weight:700;margin-bottom:6px">AGI Game &amp; Asset Architect Prompt (EN / AR)</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input id="engineAgiPromptInput" type="text" value="Synthesize Tier-5 Armored Heist crime and verify clothed 3D character wardrobe + 51 PBR weapons" style="flex:1;min-width:220px">
              <button class="primary" id="engineAgiRunButton" type="button">Run AGI Architect</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              <button class="secondary" type="button" data-engine-agi-preset="clothed-wardrobe">Verify Clothed 3D Wardrobe</button>
              <button class="secondary" type="button" data-engine-agi-preset="bullpup-tar21">Calibrate 3D Bullpup &amp; M4</button>
              <button class="secondary" type="button" data-engine-agi-preset="syndicate-heist">Generate Tier-5 Heist</button>
              <button class="secondary" type="button" data-engine-agi-preset="rebalance-armory">Balance 51 Armory Weapons</button>
            </div>
            <pre id="engineAgiOutput" dir="ltr" style="margin:10px 0 0;padding:10px;background:#06080b;border:1px solid #1e242c;border-radius:4px;font-size:12px;color:#a3d900;white-space:pre-wrap">[OPEN ENGINE AGI 3.6 READY]
• Clothed 3D Character Rigs: Suit.glb, Casual_Hoodie.glb, Swat.glb + Worn Kevlar Vest
• 3D PBR Armory: 51 real GLB weapons (Bullpup l85-detail111, M4A1 m4-detail116, G3A3, AKM, Dragunov)</pre>
          </div>
          <ol>
            <li><span class="studio-step-number" aria-hidden="true">28</span><div><strong>Registered Engine Modules</strong><p>Crime, Combat, Gym, Gangs, Territories, Bank, Blackjack, Market, Media &amp; Release Engine.</p></div></li>
            <li><span class="studio-step-number" aria-hidden="true">51</span><div><strong>3D PBR Weapons &amp; Safe Bundles</strong><p>Full GLB/OBJ inspection, grip transform fitting, and SHA-256 verified media publishing.</p></div></li>
            <li><span class="studio-step-number" aria-hidden="true">120</span><div><strong>City Blocks &amp; 17 Native Roofs</strong><p>Deterministic roof-anchored city services and live server-authoritative faction territory wars.</p></div></li>
            <li><span class="studio-step-number" aria-hidden="true">v3.6</span><div><strong>Serverless &amp; Local Hybrid Ready</strong><p>Instant sub-200ms API response across all 18 admin, studio, and player endpoints.</p></div></li>
          </ol>
        </div>

        <div class="studio-task-list" aria-label="Create and customize">
          <a class="studio-task" href="/admin?section=content" data-engine-task="content">
            <span class="studio-task-index" aria-hidden="true">01</span><span><strong data-i18n="createContent">Create game content</strong><small data-i18n="createContentCopy">Add items, crimes and rewards. Adjust prices and balance.</small></span><span class="studio-task-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="studio-task" href="/admin?section=builder" data-engine-task="builder">
            <span class="studio-task-index" aria-hidden="true">02</span><span><strong data-i18n="createPage">Create a page</strong><small data-i18n="createPageCopy">Build a game screen and arrange its content blocks.</small></span><span class="studio-task-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="studio-task" href="/admin?section=themes" data-engine-task="themes">
            <span class="studio-task-index" aria-hidden="true">03</span><span><strong data-i18n="customizeAppearance">Customize appearance</strong><small data-i18n="customizeAppearanceCopy">Choose a theme and review how your game looks.</small></span><span class="studio-task-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="studio-task" href="/admin?section=modules" data-engine-task="modules">
            <span class="studio-task-index" aria-hidden="true">04</span><span><strong data-i18n="manageExtensions">Manage extensions</strong><small data-i18n="manageExtensionsCopy">Configure the registered systems that power your game.</small></span><span class="studio-task-arrow" aria-hidden="true">↗</span>
          </a>
        </div>

        <div class="studio-workflow">
          <div class="studio-workflow-heading"><h2 data-i18n="workflowTitle">How changes reach your game</h2><a href="/admin?section=releases" data-i18n="reviewReleases">Review & publish</a></div>
          <ol>
            <li><span class="studio-step-number" aria-hidden="true">1</span><div><strong data-i18n="draftStep">Draft</strong><p data-i18n="draftStepCopy">Make changes without affecting players.</p></div></li>
            <li><span class="studio-step-number" aria-hidden="true">2</span><div><strong data-i18n="saveStep">Save</strong><p data-i18n="saveStepCopy">Keep your working changes in the engine.</p></div></li>
            <li><span class="studio-step-number" aria-hidden="true">3</span><div><strong data-i18n="previewStep">Preview</strong><p data-i18n="previewStepCopy">Check your draft as a player before release.</p></div></li>
            <li><span class="studio-step-number" aria-hidden="true">4</span><div><strong data-i18n="publishStep">Publish</strong><p data-i18n="publishStepCopy">Apply the reviewed release to the live game.</p></div></li>
          </ol>
        </div>
      </section>

      <section class="section studio-section" id="extensions">
        <div class="section-head compact"><div><span class="section-number">01</span><h2 data-i18n="moduleControl">Registered extensions</h2></div></div>
        <p class="section-copy" data-i18n="moduleCopy">Install a registered package, then enable its game system. Changes are saved to the draft; publish from the workspace when ready.</p>
        <div class="studio-extension-tools">
          <div><label for="engineModuleSearch" data-i18n="searchExtensions">Find an extension</label><input id="engineModuleSearch" type="search" autocomplete="off" placeholder="Search name or package ID" data-i18n-placeholder="searchPlaceholder"></div>
          <div><label for="engineModuleFilter" data-i18n="filterExtensions">Show</label><select id="engineModuleFilter"><option value="all" data-i18n="allExtensions">All extensions</option><option value="enabled" data-i18n="enabledExtensions">Installed & enabled</option><option value="disabled" data-i18n="disabledExtensions">Installed & disabled</option><option value="available" data-i18n="availableExtensions">Available to install</option></select></div>
        </div>
        <p class="studio-list-count" id="engineModuleCount" role="status" aria-live="polite"></p>
        <div class="stack" id="moduleList"></div>
        <p class="studio-boundary-note" data-i18n="extensionBoundary">This list contains packages already registered with the engine. Adding a new source package is a developer installation step, not a file upload here.</p>
      </section>

      <section class="section studio-section" id="appearance">
        <div class="section-head compact"><div><span class="section-number">02</span><h2 data-i18n="themeControl">Choose a theme</h2></div></div>
        <p class="section-copy" data-i18n="themeCopy">Activate a registered theme for your draft. Preview and publish it from the workspace without changing player progress.</p>
        <div class="stack" id="themeList"></div>
        <a class="secondary studio-section-action" href="/admin?section=themes" data-i18n="openAppearance">Open appearance workspace</a>
      </section>

      <section class="section studio-section" id="testing">
        <details class="studio-disclosure">
          <summary><span><span class="studio-kicker" data-i18n="advancedNav">ADVANCED</span><strong data-i18n="liveProof">Test a server action</strong><small data-i18n="testingSummary">Uses the current player account and changes its game state.</small></span></summary>
          <div class="studio-disclosure-content proof-grid">
            <div class="proof-panel">
              <p class="section-copy" data-i18n="testingCopy">This is a real crime action, not a preview. The server calculates its outcome and records the result. Use a testing account.</p>
              <div class="player" id="playerCard"></div>
              <label for="crimeSelect" data-i18n="crime">Choose a crime</label>
              <div class="action-row"><select id="crimeSelect"></select><button class="primary" id="attemptButton" type="button" data-i18n="attempt">Execute action</button></div>
              <div class="result empty" id="crimeResult" data-i18n="resultWaiting">The server will calculate the result when you execute the action.</div>
              <button class="secondary studio-proof-action" id="runCrimeButton" type="button" data-i18n="runProof">Run selected server test</button>
            </div>
            <div class="api-panel">
              <div class="console-head"><span data-i18n="apiTrace">API request trace</span><button id="clearTraceButton" type="button" data-i18n="clearTrace">Clear</button></div>
              <pre id="apiTrace" dir="ltr">GET /api/v1/health</pre>
            </div>
          </div>
        </details>
      </section>

      <section class="section studio-section" id="activity">
        <details class="studio-disclosure">
          <summary><span><span class="studio-kicker" data-i18n="advancedNav">ADVANCED</span><strong data-i18n="activityNav">Activity & economy</strong><small data-i18n="activitySummary">Inspect recorded money movements and engine events.</small></span></summary>
          <div class="studio-disclosure-content split audit-section">
            <div><div class="section-head compact"><div><h2 data-i18n="ledger">Economy ledger</h2></div></div><div class="audit-list" id="ledgerList"></div></div>
            <div><div class="section-head compact"><div><h2 data-i18n="eventLog">Event & hook log</h2></div></div><div class="audit-list" id="eventList"></div></div>
          </div>
        </details>
      </section>

      <section class="section studio-section" id="architecture">
        <details class="studio-disclosure">
          <summary><span><span class="studio-kicker" data-i18n="advancedNav">ADVANCED</span><strong data-i18n="architecture">Runtime & architecture</strong><small data-i18n="architectureSummary">Technical details for developers and engine operators.</small></span></summary>
          <div class="studio-disclosure-content">
            <section class="metrics" id="metrics" aria-label="Engine status">
              <article><span data-i18n="php">PHP</span><strong id="metricPhp">...</strong><small data-i18n="authoritative">SERVER LOGIC</small></article>
              <article><span data-i18n="database">DATABASE</span><strong id="metricDb">...</strong><small data-i18n="adapter">CURRENT ADAPTER</small></article>
              <article><span data-i18n="modules">EXTENSIONS</span><strong id="metricModules">...</strong><small data-i18n="discovered">REGISTERED PACKAGES</small></article>
              <article><span data-i18n="events">EVENTS</span><strong id="metricEvents">...</strong><small data-i18n="audit">RECORDED HOOKS</small></article>
            </section>
            <p class="section-copy studio-architecture-copy" data-i18n="architectureCopy">The web interface uses an API. Game rules run on the server, while modules and themes connect through defined contracts.</p>
            <div class="flow" id="architectureFlow"></div>
            <div class="infra" id="infrastructure"></div>
          </div>
        </details>
      </section>
    </main>
  </div>

  <footer><span>ZONE OPEN ENGINE</span><span data-i18n="footer">Create. Customize. Review. Publish.</span></footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script src="/engine/assets/engine.js?v=97" defer></script>
</body>
</html>
