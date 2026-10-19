# ZONE beta finish contract

## Intent and retained decisions

The player is a new criminal building money, equipment, skills and street standing through connected decisions. ZONE remains the existing compact bilingual crime RPG. Preserve the approved charcoal/brass shell, its recognizable navigation, specific accepted assets, existing content, real player data and Omar's modular Engine/Studio architecture.

The deadline remains October 21, 2026, Asia/Dubai. There is no invented launch hour. The audience decision is deferred. Login stays off under the existing testing arrangement. The VPS remains on strict hold.

Base: 3b024bc4ba304bba1bed57d7ac7a3d8088774284 in the existing integration checkout. That loading-repair commit is locally tested but not published. Its specific production approval remains separate from this next work.

## Design brief

- Promise: make a small criminal operation grow through useful choices, visible consequences and equipment that matters.
- Primary verbs: choose a crime, work, buy/equip, train, bank earnings, inspect a destination and fight when prepared.
- Five-to-thirty-second loop: inspect an objective and resource cost, choose a real action, see the server result, understand what changed and choose the next action.
- One-to-five-minute change: earn money or progress, acquire useful equipment, improve a stat, protect earnings or recover from a consequence.
- Risk: nerve/energy costs, visible cooldowns, jail/hospital outcomes and exposed pocket cash. The server alone decides all outcomes.
- Learning/recovery: explain the actual result and available recovery without granting resources, hiding failure or pretending an offline request succeeded.
- Reward: persisted progress, useful owned equipment, stat gains and claimable objectives. A better player weighs preparation, happiness, protection and risk.
- Non-goals: no unrelated redesign, replacement engine, arbitrary economy rebalance, fake multiplayer, fabricated assets, client-authoritative results or hosting migration.

## Core loop contract

An ordinary player chooses a visible activity to advance a stated objective while resource costs, cooldowns and consequences create risk. A successful command changes authoritative saved state; failure explains its cause and offers a valid next action. A reload or later session recovers the same character and progress.

Acceptance uses ordinary player accounts, not fully provisioned Owner Playtest. Presentation may preview content but never invent ownership or money. Scripted verification uses normal requests and real UI input. It must not expose seed/outcome controls to players.

## Opening and return-session plan

1. Home: identify the character, four resources, current objective and a useful next move. Optional media cannot block the interface.
2. City: select a real destination from its associated building or accessible directory. Preserve authoritative geometry and current map extent.
3. Crimes/work: show actual eligibility, cost, expected range and consequences, then readable result/progression feedback.
4. Inventory/shop: distinguish owned inventory from catalog; purchase and equip a useful item with real costs and identity preserved.
5. Gym: show the training environment, current energy/happiness, actual actions/costs/expected effects, and saved result feedback as one coherent screen.
6. Bank/recovery/combat: make protection, preparation, action results and available recovery understandable. No dead or decorative controls.
7. Return: reload/restart the isolated service and recover the same account, balances, owned equipment and progression.
8. Studio: an authorized editor changes supported content, previews it, publishes it, and an ordinary player sees the published result. Drafts do not leak and fields do not reset.

## Art and interaction contract

- Existing implementation is not automatically approved artwork. Improve weak forms, material readability, equipment contact and scene composition while keeping accepted identity/compositions.
- Home and Gym lead the visible pass unless a newly reproduced blocker takes precedence.
- Do not cover broken anatomy with a camera crop or replace a functional 3D scene with a picture.
- A new environment must be integrated with real actions, costs and feedback, not an unrelated image above an unchanged table.
- Generate or source only useful surfaces. Keep original licensed assets and provenance. New variants remain additive until inspected.
- Tripo credential probe is missing. Gemini and ElevenLabs credentials are present, not yet proved successful generation. No new purchases or accounts.
- Use real Three r184 scene budgets. Initial mobile targets: <=150 draw calls, <=300k triangles, <=40 textures, <=128 MB estimated texture memory and a bounded DPR. Record deliberate tradeoffs.
- Audio, if added, is event driven, gesture unlocked and controllable; no autoplay soundtrack is required to make this a crime RPG.

## Ownership and interfaces

- Lead: shared contracts, index/player presentation, scoped UI, Studio browser workflow, generated environment-art integration, current-run captures and release integration.
- Engine/performance worker: bounded bootstrap/session/API correctness and measured latency, with isolated regression tests. No UI/assets or production mutations.
- Media worker: additive licensed weapon/model improvement and the relevant asset loader/tests. No shell layout, backend, actor-iframe recovery or deployment changes.
- All workers preserve others' edits and report exact files, tests, artifacts and limitations. A completed patch is not a completed beta.

## Two release gates

Engineering: correct state, permissions, durable transactions, error recovery, sensible performance and reproducible deployment.

Player experience: convincing assets, coherent art direction, clear actions, useful feedback, enjoyable opening/return sessions, desktop/mobile and English/Arabic presentation.

Both are required. The visual scorecard is interpreted as a crime RPG: character/equipment, opponents/consequences, services/rewards, city/rooms, materials, lighting, interaction feedback, compact HUD and measured performance. No premium score is assigned without inspected current captures and evidence.

## Browser and evidence contract

Use the user-approved Cua Chrome remote connector for ZONE only. No Chrome DevTools, raw CDP or Playwright browser launches. The packaged inspector/bot launcher is not authorized for live browser control. Use the existing Node/PHP isolated journey suites plus real Cua inputs, rendered captures and in-application diagnostics. Do not invent inspector outputs, state acknowledgments or GPU metrics.

Record viewport/state/locale, revision or working-tree fingerprints, actions and real outcomes. Capture before and after the improved screens under comparable conditions. Animated changes require an unpaused sequence/contact review, not only a still.

Keep private databases, fault harnesses, sessions, credentials and raw research out of the release. Production publication uses the existing team-auraa project and canonical URL with its required explicit gate. No VPS work is part of this pass.
