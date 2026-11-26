# Upgrade-001: Sovereign 3D Models & House of Obsidian Casino Overhaul (`v163`)

- **Date**: `2026-11-26`
- **Baseline Build**: `v162` (`cd50b30`)
- **Target Build**: `v163`
- **Methodology**: `/game-upgrade` Dual-Perspective Audit (Player Pass + Senior Engineer Pass) + `/game-qa-lead` 5-Tier Release Gate

---

## 1. Player-Pass Findings (Visual, Tactile & Fun Audit)

1. **Flat `44px` Roulette Placeholder on Casino (`Must-Do / P0 Experience Gap`)**:
   - **Observation**: Opening `?screen=casino` presented `div[data-roulette-pocket="1"]` as a flat `44x44` CSS circle (`border-radius: 50%`) with text-only buttons, while the buried `casino-royale` stage at the bottom of the route used an 18-brick brown cylinder (`CylinderGeometry`) and a bare triangle cone (`ConeGeometry`).
   - **Impact**: High-stakes roulette felt like a spreadsheet widget instead of a Monte-Carlo syndicate salon.
2. **Shared Primitive Silhouettes on Weapons, Armor & Fleet Vehicles (`Must-Do`)**:
   - **Observation**: `sports_car` used 3 `BoxGeometry` primitives shared across `Nightshade GT`, `Pier 4 Armored Van`, and `Apex Interceptor`; `ak`, `sniper`, `shotgun`, and `smg` shared one 9-box function; `boots`, `gloves`, and `pants` shared identical 6-box geometry; `knuckles` fell back to a hammer shaft.
   - **Impact**: Inspecting items in 360° Orbit Studio rewarded curiosity on crime enhancers (`v153`) but felt repetitive across firearms, armor, and vehicles.
3. **Missing Roulette Call Bets & Achievement Feedback (`Recommended`)**:
   - **Observation**: High-roller Torn/Monte-Carlo players expect `Voisins du Zero`, `Tiers du Cylindre`, `Orphelins`, and 5-Neighbor sector bets plus visible achievement unlock banners (`GameKit`) when hitting Straight-Up `35:1` or hot streaks.

---

## 2. Senior-Engineer-Pass Findings (Architecture, ECS & Performance Audit)

1. **Per-Frame Array Allocation in `ZoneEcs3DRuntime._renderFrame` (`Must-Do / game-perf`)**:
   - **Observation**: `const slotsArr = []` allocated a new array every `requestAnimationFrame` tick (`60Hz`).
   - **Fix**: Replace with pre-allocated reusable `_slotsScratch` buffer (`this._slotsScratch.length = 0`).
2. **Missing `1% Low FPS` & Frame-Time Variance Telemetry (`Must-Do / game-tuning` + `game-qa-lead`)**:
   - **Observation**: `DynamicResScaler` tracked exponential moving average (`frameMsEma`) only, masking micro-stutters (`1% low FPS`) and lacking a `refresh - 3` frame-pacing cap option.
   - **Fix**: Add a zero-GC `Float32Array(60)` frame-time ring buffer computing `onePercentLowFps` and `frameTimeVarianceMs`, plus `fpsCap` (`refresh - 3`) support.
3. **Color-Only Casino Pocket Signals (`Must-Do / game-ui-ux` XAG 102)**:
   - **Observation**: Roulette history pills relied solely on red/black/green background fills.
   - **Fix**: Pair every pocket display with distinct geometric/suit glyphs (`★` Zero, `◆` Red, `♠` Black) and `:focus-visible` keyboard/gamepad focus rings.

---

## 3. Prioritized Revision Plan & Execution Status

| Bucket | Item | Skills Applied | Status |
| :--- | :--- | :--- | :---: |
| **Must-Do** | Sculpted 37-pocket 3D Monte-Carlo Roulette Wheel (`LatheGeometry` bowl, 8 brass canoes, 37 pockets & frets, `CanvasTexture` 0-36 ring, exact target-pocket ball kinematics) | `game-artist`, `gamedev-ecs`, `game-feel` | Implemented |
| **Must-Do** | Luna "House of Obsidian & Champagne Gold" Casino restyle + in-place 3D Roulette/Slots/Shoe viewports + French Call Bets & Neighbor Bets | `game-artist`, `game-mechanic`, `game-balance`, `game-hud`, `game-ui-ux` | Implemented |
| **Must-Do** | 100x multi-part 3D overhaul for firearms (`ak`, `sniper`, `shotgun`, `smg`, `revolver`, `pistol`), melee (`katana`, 4-ring `knuckles`), armor (`boots`, `gloves`, `pants`, quad-NVG `helmet`, `kevlar`), boosters (`alcohol`, `candy`), 4 distinct fleet vehicles, 4 real 3D companions, 12-wedge 3D Wheel of Awesome & 8-bolt planetary vault door | `game-artist`, `gamedev-ecs` | Implemented |
| **Must-Do** | Zero-GC `_slotsScratch` hot-path fix + `Float32Array(60)` `1% Low FPS` & `refresh - 3` pacing governor | `game-perf`, `game-patterns`, `game-tuning` | Implemented |
| **Recommended** | `window.ZoneGameKit` 20-achievement (`1,000 pts`) + recurring/all-time leaderboard & cloud save snapshot bridge | `gamekit`, `game-hud` | Implemented |
| **Must-Do** | `tests/test-sovereign-3d-casino163.mjs` 5-Tier QA Release Gate + full regression sweep + live Vercel Production deployment | `game-qa-lead` | Implemented |
