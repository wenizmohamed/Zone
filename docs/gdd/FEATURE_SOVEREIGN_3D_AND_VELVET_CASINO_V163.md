# Sovereign 3D & House of Obsidian Casino Feature Document (v163)

> **Framework**: `/game-planner` Two-Tier Living GDD (`Master Pillars` + `Feature Specification`)
> **Version**: `v163.0` (`2026-11-26`)
> **Skills Integrated**: `/zero`, `/game-planner`, `/game-upgrade`, `/game-artist`, `/game-mechanic`, `/game-balance`, `/gamedev-ecs`, `/game-perf`, `/game-patterns`, `/game-feel`, `/game-hud`, `/game-ui-ux`, `/game-tuning`, `/gamekit`, `/game-qa-lead`

---

## 1. Executive Summary & Design Pillars

ZONE `v163` replaces flat UI placeholders and early low-poly blockouts with **multi-part, physically shaded Three.js r184 3D models** across all gameplay surfaces while introducing **Luna's House of Obsidian & Champagne Gold (Monte-Carlo Noir)** Casino experience.

### Core Design Pillars (Do / Do Not)

1. **Every Interactive Object Has a Bespoke 3D Silhouette**
   - **Do**: Construct recognizable multi-part geometry (`LatheGeometry` bowls, curved `TorusGeometry` AK magazines, 37-pocket European roulette rotors, 4 distinct Syndicate fleet vehicles, quad-NVG helmets, 4-ring brass knuckles, 4 evolving 3D companions).
   - **Do Not**: Reuse a single `BoxGeometry` rifle, 3-box car, or `44px` flat CSS circle to represent distinct gameplay objects.
2. **Simulation-Driven Visual Truth (`game-feel` + `gamedev-ecs`)**
   - **Do**: Drive 3D roulette ball drop angles, slot reel stops, craps rigid-body bounces, and trauma camera shake from authoritative spin/roll outcomes without stalling input or thrashing ECS archetypes.
   - **Do Not**: Play disconnected decorative loops that contradict the settled pocket or card result.
3. **Single-Context Zero-GC Performance (`game-perf` + `game-patterns` + `game-tuning`)**
   - **Do**: Share strictly **1** `THREE.WebGLRenderer` context across all item slots, action stages, and the 360° Orbit Inspector; reuse scratch buffers (`_slotsScratch`) and `Float32Array` telemetry ring buffers (`1% Low FPS`, `frameTimeVarianceMs`, optional `refresh - 3` cap).
   - **Do Not**: Allocate per-frame arrays (`slotsArr = []`) or open multiple WebGL contexts that starve mobile browsers.
4. **Mathematically Fair Economy & Accessible HUD (`game-balance` + `game-hud` + `game-ui-ux`)**
   - **Do**: Anchor European Single-Zero Roulette at a uniform `1/37 = 2.7027%` house edge across Straight-Up (`35:1`), Call Bets (`Voisins`, `Tiers`, `Orphelins`, `Jeu Zero`), 5-Neighbor Sector bets, Dozens (`2:1`), and Even-Money (`1:1`), paired with non-color-only pocket icons (`★ 0`, `◆ Red`, `♠ Black`) and bilingual EN/AR `0px`-overflow layouts down to `320px`.
   - **Do Not**: Introduce overtuned dominant-strategy bets or color-only win/loss indicators.

---

## 2. Core Mechanics & Numerical Balance (`game-mechanic` + `game-balance`)

### 2.1 37-Pocket European Roulette Cost Curve (`Uniform 2.7027% House Edge`)

Wheel sequence (`EUROPEAN_ROULETTE_ORDER`):
`[0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]`

| Wager Type | Pockets Covered ($k$) | Win Probability ($k/37$) | Net Payout Multiple | Expected Value per \$1 | House Edge | Cost-Curve Delta |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Straight-Up (`0..36`) | `1` | `2.7027%` | `35:1` | `-0.027027` | `2.70%` | `0.00%` |
| 5-Neighbor Wheel Sector (`N ± 2`) | `5` | `13.5135%` | `35:1` per 1/5 chip (`6.2:1` net) | `-0.027027` | `2.70%` | `0.00%` |
| `Jeu Zero` (Zero Game) | `7` | `18.9189%` | Uniform pocket coverage | `-0.027027` | `2.70%` | `0.00%` |
| `Orphelins` | `8` | `21.6216%` | Uniform pocket coverage | `-0.027027` | `2.70%` | `0.00%` |
| `Tiers du Cylindre` | `12` | `32.4324%` | `2:1` equivalent | `-0.027027` | `2.70%` | `0.00%` |
| `Voisins du Zero` | `17` | `45.9459%` | Uniform pocket coverage | `-0.027027` | `2.70%` | `0.00%` |
| Dozens (`1st 12`, `2nd 12`, `3rd 12`) | `12` | `32.4324%` | `2:1` | `-0.027027` | `2.70%` | `0.00%` |
| Red / Black / Even / Odd / High / Low | `18` | `48.6486%` | `1:1` | `-0.027027` | `2.70%` | `0.00%` |

- **Dominant Strategy Audit**: Every roulette wager sits at `Delta = 0.00%` on the expected-value curve (`EV = -1/37`), choosing purely along the **variance / volatility** frontier rather than creating an exploitable edge.
- **Cross-Table Casino Sink Equilibrium**:
  - Blackjack 6-Deck S17 Optimal Strategy: `~0.49%` house edge.
  - Street Craps `Don't Pass` / `Pass Line`: `1.36% - 1.41%` house edge.
  - European Single-Zero Roulette: `2.70%` house edge.

### 2.2 GameKit Achievement & Leaderboard Progression (`gamekit`)

- **Total Point Cap**: `20` achievements × `50 pts` = **`1,000 pts`** (matches Apple GameKit `1000` maximum points specification).
- **Leaderboards**: `zone_high_rollers_net`, `zone_roulette_royale`, `zone_syndicate_respect`, `zone_arcade_overdrive` with integer score + Unix timestamp `context` tiebreaker.

---

## 3. Level of Quality (LoQ) Matrix

| Tier | Deliverable | Status |
| :--- | :--- | :---: |
| **Core** | 37-pocket 3D European Roulette wheel + exact pocket ball physics + 1-context WebGL | Shipped (`v163`) |
| **Expected** | Luna Obsidian & Champagne Gold Casino restyle + French Call Bets + 100x weapon/armor/vehicle/companion 3D meshes | Shipped (`v163`) |
| **Desired** | Zero-GC `_slotsScratch` + `1% Low FPS` / `refresh-3` pacing telemetry + GameKit 1,000-pt bridge | Shipped (`v163`) |
| **Aspirational** | Live 360° Orbit Studio inspection for Roulette Wheel, Slot Cabinet, Fleet & Companions across EN/AR mobile & desktop | Shipped (`v163`) |

---

## 4. Cross-System Dependencies

- **Upstream**: `lib/three184/*` (vendored Three.js r184), `/api/v1/casino/{roulette,slots,blackjack}`, `/api/v1/{achievements,leaderboards}`.
- **Core Modules**: `assets/ui/zone-ecs-3d-engine.mjs`, `assets/ui/zone-3d-environments.mjs`, `assets/ui/zone-ecs-3d-bridge.js`, `assets/ui/zone-casino-tables.{js,css}`, `assets/ui/zone-vehicle-garage.js`, `assets/ui/zone-companion-3d.js`, `assets/ui/zone-gamekit-bridge.js`.
- **Verification Gate**: `tests/test-sovereign-3d-casino163.mjs` + `scripts/test-ecs-3d-engine152.mjs` + `tests/test-casino-tables157.mjs` + `scripts/test-ux-ia150.mjs`.
