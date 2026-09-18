# ZONE Engine + Zone V2

A modular PHP 8.5 browser-game engine foundation with a bilingual crime RPG frontend, server-authoritative gameplay proof, installable modules, interchangeable themes, event hooks, and economy auditing.

[Play Zone V2](https://zone-torn-style-game-mockup-6cf978c.vercel.app)

- **Engine version:** 0.1.0 foundation
- **Frontend version:** Zone V2
- **Status:** Executable engine foundation plus live frontend prototype
- **Last updated:** 2026-09-19

> Zone is an independent prototype inspired by classic browser-based crime games. It is not affiliated with Torn or its creators.

## Overview

ZONE now has two deliberately separated layers:

1. `engine/` is the PHP 8.5, API-first game-engine foundation. It owns server-side results, module discovery and lifecycle, domain events, themes, resource regeneration, economy ledgers, and production database contracts.
2. The root frontend is the existing dense browser MMO interface. It demonstrates crimes, training, jobs, education, properties, inventory, combat, factions, casino, maps, and 3D assets.

The public Vercel build remains a static frontend prototype. The executable engine presentation runs through PHP and is documented below. The 18 frontend screens are the migration target for the versioned engine API.

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
- Vercel static hosting

No package installation or build step is required for local use.

## Repository Structure

```text
Zone/
|-- index.html              Main game interface, state, and screen logic
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
`-- lib/                    Historical local library references
```

The static Vercel frontend uses `index.html`, `support.js`, `image-slot.js`, `art/`, `assets/`, and `dist/`. The executable backend and engine presentation live independently under `engine/`.

## Quick Start

Clone the repository:

```bash
git clone https://github.com/wenizmohamed/Zone.git
cd Zone
```

Serve the project with Python:

```bash
python -m http.server 49123
```

Open [http://127.0.0.1:49123](http://127.0.0.1:49123) in a browser.

Running through a local HTTP server is recommended because the game includes embedded pages and 3D assets that browsers may restrict when opened directly from `file://`.

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
- Hosting: Vercel
- Build type: static site
- Root directory: repository root
- Production URL: [zone-torn-style-game-mockup-6cf978c.vercel.app](https://zone-torn-style-game-mockup-6cf978c.vercel.app)

Pushing a verified commit to `main` triggers the connected production deployment. The local `.vercel` directory is intentionally excluded from Git.

## Verification Status

The production package was last verified on 2026-09-14:

- 136 of 136 required files returned HTTP 200
- All 18 navigation sections rendered content
- Character, weapon, and map embeds loaded successfully
- No broken images were detected
- No browser runtime errors were detected
- GitHub-triggered Vercel deployment reached `READY`

## Project Scope

Zone V2 remains a frontend gameplay prototype while its screens are migrated to the new engine API. The engine foundation now demonstrates trusted server-side calculations, persistence contracts, modularity, hooks, resource handling, and auditing. A production multiplayer release still requires authenticated accounts, deployed PostgreSQL and Redis services, workers, realtime delivery, moderation, monitoring, and migration of every frontend mutation to the API.

## Disclaimer

This project is an original technical and visual prototype created for experimentation and game-development exploration. References to the visual language of Torn-style browser games describe inspiration only. No affiliation or endorsement is implied.
