# ZONE Engine + Zone V2

A modular PHP 8.5 browser-game engine foundation with a bilingual crime RPG frontend, server-authoritative gameplay proof, installable modules, interchangeable themes, event hooks, and economy auditing.

[Open the integrated platform preview](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-8qlsvs4af.vercel.app)

- [Player game](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-8qlsvs4af.vercel.app/)
- [Admin control plane](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-8qlsvs4af.vercel.app/admin)
- [Engine control room](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-8qlsvs4af.vercel.app/engine)
- [Engine health API](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-8qlsvs4af.vercel.app/api/v1/health)

- **Engine version:** 0.1.0 foundation
- **Frontend version:** Zone V2
- **Status:** Integrated engine, admin publishing slice, and live frontend presentation
- **Last updated:** 2026-09-19

> Zone is an independent prototype inspired by classic browser-based crime games. It is not affiliated with Torn or its creators.

## Overview

ZONE now has three deliberately separated clients and layers on one versioned platform:

1. `engine/` is the PHP 8.5, API-first game-engine foundation. It owns server-side results, module discovery and lifecycle, domain events, themes, resource regeneration, economy ledgers, and production database contracts.
2. `/admin` is the control plane. It manages bilingual page drafts, registered visual blocks, modules, content, themes, assets, economy records, events, immutable releases, and rollback.
3. `/` is the player client. It consumes the active release manifest and renders the original dense browser MMO interface plus pages published from the admin builder.

The current public preview proves the complete control loop: edit a draft, validate it, preview it, publish an immutable release, load it in the game, and reactivate a previous release without deleting history. The browser never supplies crime outcomes or rewards.

## Engine foundation

Open [engine/README.md](engine/README.md) for the executable proof and [docs/OMAR_ENGINE_PRESENTATION.md](docs/OMAR_ENGINE_PRESENTATION.md) for the presentation sequence.

The foundation currently proves:

- PHP 8.5 server-authoritative crime outcomes
- Manifest-driven module discovery and version tracking
- Module install, uninstall, enable, and disable lifecycle
- Independent `Crime` and `Achievements` packages
- `CrimeSucceeded` hook consumption without modifying the Crime module
- Installable `ZONE Tactical` and `Terminal Ops` themes
- Shared Energy, Nerve, Life, and Happiness resource state
- Immutable currency ledger entries with correlation identifiers
- Persistent domain-event audit trail
- Bilingual visual page builder with engine-registered block types
- Draft isolation, live preview, immutable publishing, release history, and rollback
- Active release manifests consumed by the player game
- PostgreSQL production schema and SQLite presentation adapter
- Jobs, notifications, and extensible image, thumbnail, animation, video, GLB, and GLTF asset records
- Arabic and English presentation with RTL and LTR switching

Run it with:

```powershell
npm run engine:test
npm run engine:serve
```

Then open `http://127.0.0.1:4285/engine`.

## Highlights

- 18 navigable game areas in one responsive interface
- Persistent energy, nerve, happiness, life, cash, experience, inventory, and progression state
- Crime categories with unlock requirements, success odds, rewards, jail outcomes, and hospital outcomes
- Gym training across strength, defense, speed, and dexterity
- Jobs, education, properties, missions, faction upgrades, rankings, combat, and casino systems
- Interactive character and weapon viewers rendered in 3D
- Illustrated city map and live city view
- Visual scene cards for Gym, Jobs, Properties, Education, Crimes, and Casino
- English and Arabic interfaces with right-to-left layout support
- Dark and light themes
- Browser-local save state using `localStorage`

## Game Areas

| Category | Areas |
| --- | --- |
| Player | Home, Items, Properties, Education |
| City | City, Newspaper, Jail, Hospital, Item Market |
| Progression | Job, Gym, Crimes, Missions |
| Competition | Attack, Hall of Fame, My Faction, Elimination |
| Entertainment | Casino |

## Technology

- PHP 8.5 modular backend foundation
- Versioned REST API
- PostgreSQL production schema
- SQLite local presentation adapter
- Domain event and hook bus
- Manifest-driven modules and themes
- Static HTML, CSS, and JavaScript
- Generated design runtime in `support.js`
- Browser image-loading utilities in `image-slot.js`
- Three.js-powered character and weapon experiences
- GLB, OBJ, and MTL assets for characters and weapons
- Google Fonts for Rubik and Oswald typography
- Vercel static hosting plus a PHP 8.5 community runtime for the presentation API

The frontend has no third-party package install step. The integrated platform requires PHP 8.5 for the API and Node.js 22 for build and verification scripts.

## Repository Structure

```text
Zone/
|-- index.html              Main game interface, state, and screen logic
|-- platform-runtime.js     Active-release loader and cross-tab refresh
|-- admin.html              Admin control plane shell
|-- admin.css               Responsive admin design system
|-- admin.js                Builder, publishing, modules, and operations UI
|-- api/index.php           Vercel PHP 8.5 entry point
|-- engine/                 Server-authoritative modular engine
|   |-- src/Core/Publishing Draft and immutable release manager
|   |-- modules/            Installable gameplay modules
|   |-- themes/             Installable interface themes
|   `-- database/           SQLite and PostgreSQL schemas
|-- support.js              Generated component runtime
|-- image-slot.js           Image-loading support
|-- art/                    Scene artwork used by activity cards
|-- assets/
|   |-- character/          Character model and animation data
|   |-- weapons/            Weapon catalogue and 3D model files
|   `-- city-map.png        Illustrated city map
|-- dist/
|   |-- character3d.html    Interactive character viewer
|   |-- weapon3d.html       Interactive weapon viewer
|   |-- city-map.html       City map experience
|   `-- zone-maps-live.html Live city view
|-- screenshots/            Historical design and verification captures
|-- analysis/               Earlier research and reverse-engineering notes
|-- brief/                  Supporting project briefs
|-- scripts/                Build and verification gates
|-- docs/                   Architecture contract and implementation plan
`-- lib/                    Historical local library references
```

The game and admin are separate browser clients of the same release and engine APIs. Admin changes do not become live merely because a form was edited. Only a validated publish operation changes the active game release.

## Quick Start

Clone the repository:

```bash
git clone https://github.com/wenizmohamed/Zone.git
cd Zone
```

Install PHP 8.5 and Node.js 22, then run the verification gates:

```powershell
npm run verify
npm run engine:test
npm run verify:platform
```

Start the integrated local platform:

```powershell
npm run engine:serve
```

Open these routes:

- `http://127.0.0.1:4285/` for the game
- `http://127.0.0.1:4285/admin` for the admin control plane
- `http://127.0.0.1:4285/engine` for the technical engine proof
- `http://127.0.0.1:4285/api/v1/health` for machine-readable health

## Using the Prototype

Use the left navigation to move between game areas. Actions such as training, committing crimes, working shifts, buying items, enrolling in courses, and attacking opponents update the simulated player state immediately.

- Use the language control in the header to switch between English and Arabic.
- Use the theme control to switch between dark and light presentation.
- Open Items to inspect supported weapons in the embedded 3D viewer.
- Open City to switch between the interactive map views.
- Return to Home to inspect the character viewer and current progression summary.

## Save Data

The prototype stores progress in the browser's `localStorage` for the current origin.

- Refreshing the page preserves the current game state.
- Different browsers and domains have separate saves.
- Clearing site data resets the prototype.
- The current build does not synchronize progress between devices.

## Troubleshooting

### The page shows a directory listing

Start the local server from the repository root, where `index.html` is located:

```bash
cd Zone
python -m http.server 49123
```

### Artwork or embedded pages do not load

- Confirm that `art/`, `assets/`, and `dist/` remain beside `index.html`.
- Run the project through `http://127.0.0.1:49123` instead of opening `index.html` through `file://`.
- Check that the browser has internet access, because the 3D viewers load Three.js modules from a public CDN.

### The 3D viewers remain blank

- Confirm that WebGL and hardware acceleration are enabled in the browser.
- Try a current Chromium, Firefox, or Safari release.
- Check that browser privacy controls are not blocking the Three.js CDN.

### The saved state is unexpected

Clear the site's browser storage and reload the page. This resets the local prototype and does not affect repository or server data.

## Deployment

The repository is connected to the `team-aura` Vercel project.

- Production branch: `main`
- Hosting: Vercel static output plus PHP 8.5 serverless presentation API
- Root directory: repository root
- Production URL: [zone-torn-style-game-mockup-6cf978c.vercel.app](https://zone-torn-style-game-mockup-6cf978c.vercel.app)
- Verified platform preview: [zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-8qlsvs4af.vercel.app](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-8qlsvs4af.vercel.app)

Pushing a verified commit to `main` triggers the connected production deployment. The platform preview is intentionally marked `PRESENTATION`: it uses SQLite under Vercel's temporary function storage so the complete workflow can be demonstrated without pretending it is durable multiplayer infrastructure. Production must use external PostgreSQL and Redis before promotion.

## Verification Status

The integrated platform preview was verified on 2026-09-19:

- Source verification passed for all 18 game screens and 43 generated art targets
- Production bundle verification passed for all 144 output files
- PHP engine suite passed 42 of 42 tests
- Full local platform smoke suite passed 14 of 14 checks
- Public Vercel routes for game, admin, engine, health, active release, and admin assets returned HTTP 200
- A public draft was saved without changing the active release
- Publishing created release `v1`, and the player game loaded its new `Platform Proof` page
- Desktop and 390px mobile admin layouts were inspected in the rendered browser
- Vercel deployment `dpl_G3gHaQDuAQQu1pf8Fc5hG4rjVBUs` reached `READY`

## Project Scope

This branch is the vertical platform slice Omar asked to see, not a claim that the entire multiplayer game is finished. It proves the architecture with real code and a working public loop. A production release still requires authenticated accounts and RBAC, managed PostgreSQL 18, Redis 8, object storage, workers, realtime delivery, moderation, observability, backups, and migration of every remaining browser-local gameplay mutation to server-authoritative endpoints.

## Disclaimer

This project is an original technical and visual prototype created for experimentation and game-development exploration. References to the visual language of Torn-style browser games describe inspiration only. No affiliation or endorsement is implied.
