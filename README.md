# ZONE Game Platform

ZONE is a bilingual browser crime MMO and a modular, API-first game-engine platform. PHP 8.5 owns authoritative rules and publishing. The player game and secured administrator control plane are separate clients of the same versioned engine.

## Live release candidate

- [Player game](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-5yig2be7z.vercel.app/)
- [Admin control plane](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-5yig2be7z.vercel.app/admin)
- [Engine control room](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-5yig2be7z.vercel.app/engine)
- [Health API](https://zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-5yig2be7z.vercel.app/api/v1/health)

| Component | Current version or adapter |
| --- | --- |
| ZONE Engine | 1.0.0 |
| PHP runtime | 8.5 |
| Production database | Neon PostgreSQL over TLS |
| API | `/api/v1` |
| Admin security | Signed HttpOnly session, CSRF protection, same-origin mutations |
| Release model | Validated draft, preview, immutable publish, history, rollback |
| Languages | English and Arabic, LTR and RTL |

The live release candidate has persisted release `v1`, published by the secured Omar administrator account. A fresh process and a rendered browser both confirmed that the game reads the same release from PostgreSQL.

## Product surfaces

### Player game

The `/` client contains 18 responsive game areas, English and Arabic layouts, dark and light themes, 3D character and weapon viewers, the city map, progression systems, and release-driven custom pages. It reads the active release manifest from the engine at startup.

### Admin control plane

The `/admin` client provides:

- Secured administrator login and logout
- Platform and adapter health
- Bilingual responsive page builder
- Registered visual block types
- Draft isolation and desktop/mobile preview
- Immutable release publishing and rollback
- Module lifecycle controls
- Theme activation and release branding
- Crime catalog, asset-format registry, economy ledger, and event explorer
- Direct links to the game and protected engine console

Admin edits do not leak into the live game. Only a validated publish creates a new immutable release and changes the active release pointer.

### Engine and API

The `engine/` application owns:

- PHP-calculated crime results, costs, rewards, and resource mutations
- Shared Energy, Nerve, Life, and Happiness regeneration
- Manifest-driven module discovery and lifecycle
- Domain events and hooks
- Independent `Crime` and `Achievements` modules
- Interchangeable theme packages
- PostgreSQL migrations and local SQLite adapter
- Immutable economy ledger entries with correlation identifiers
- Durable event, job, notification, asset, content-release, and admin-audit tables
- Versioned release validation, publish, history, and rollback

The browser is never allowed to submit a crime outcome, roll, reward, or resulting balance.

## Architecture

```text
Player Web Client             Admin Control Plane
         |                            |
         +--------- REST API v1 ------+
                         |
                  Application Layer
                         |
             Core Contracts + Event Bus
                         |
        PostgreSQL / Cache Port / Jobs / Assets
```

The core does not contain crime, gym, travel, faction, market, or casino rules. Those systems belong in installable modules that publish and subscribe to declared events. Themes consume stable view contracts and contain no game rules.

Read the full engineering contract in [docs/ZONE_PLATFORM_ARCHITECTURE.md](docs/ZONE_PLATFORM_ARCHITECTURE.md) and the operator handoff in [docs/OMAR_PRODUCT_HANDOFF.md](docs/OMAR_PRODUCT_HANDOFF.md).

## Repository structure

```text
Zone/
|-- index.html                 Player game client and current 18-screen migration source
|-- platform-runtime.js        Active-release loader and validated local cache
|-- admin.html                 Secured control-plane shell
|-- admin.css                  Responsive admin design system
|-- admin.js                   Builder, publishing, modules, themes, and operations UI
|-- api/index.php              Vercel PHP 8.5 entry point
|-- api/php.ini                Hardened production PHP settings
|-- engine/
|   |-- src/Application/       API-facing engine use cases
|   |-- src/Core/              Events, persistence, publishing, security, modules, themes
|   |-- modules/               Installable gameplay modules
|   |-- themes/                Installable interface themes
|   `-- database/              PostgreSQL and local SQLite schemas
|-- assets/                    Images and 3D game assets
|-- dist/                      Character, weapon, and map experiences
|-- scripts/                   Build, local, and production verification gates
|-- docs/                      Architecture, operations, and delivery records
|-- vercel.json                Static and PHP serverless routing
`-- .env.example               Required adapter and admin variables without secrets
```

## Local development

Requirements:

- PHP 8.5 with PDO SQLite for local development
- Node.js 22 or newer
- PowerShell 7 on Windows for the supplied verification scripts

Run the full local verification gates:

```powershell
npm run verify
npm run engine:test
npm run verify:platform
npm run vercel-build
```

Start the integrated application:

```powershell
npm run engine:serve
```

Open:

- `http://127.0.0.1:4285/`
- `http://127.0.0.1:4285/admin`
- `http://127.0.0.1:4285/engine`
- `http://127.0.0.1:4285/api/v1/health`

The local server script creates a local administrator session configuration. It does not contain or reuse production credentials.

## Configuration

Copy `.env.example` to the secret manager used by the target environment. Never commit the resulting values.

Required for a production deployment:

- `ZONE_DATABASE_URL`, `DATABASE_URL`, or `POSTGRES_URL`
- `ZONE_ADMIN_USERNAME`
- `ZONE_ADMIN_PASSWORD_HASH`
- `ZONE_ADMIN_SESSION_SECRET`

Optional adapters:

- `ZONE_REDIS_URL`
- `ZONE_ASSET_STORAGE_URL`

On Vercel, PostgreSQL and the administrator variables are encrypted environment variables. The application fails closed instead of falling back to temporary SQLite when a production database is unavailable.

## Production verification

The production verifier does not publish or modify content. It checks runtime health, PostgreSQL, server authority, anonymous isolation, signed login, CSRF, the production draft, persisted release consistency, game and admin rendering, logout, and post-logout access control.

```powershell
$env:ZONE_ADMIN_USERNAME = 'omar'
$env:ZONE_ADMIN_PASSWORD = '<secret>'
./scripts/verify-production.ps1 -BaseUrl 'https://your-zone-deployment.vercel.app'
```

Current verified gates on 2026-09-19:

- PHP engine suite: 52 passed, 0 failed
- Integrated local platform: 20 checks passed
- Live PostgreSQL release candidate: 17 production checks passed
- Vercel production bundle: 18 screens, 43 art targets, 144 output files
- Browser verification: secured login, PHP 8.5.2, PGSQL, PRODUCTION, release v1, published page visible in the player navigation
- Content workflow: authenticated crime create/update, public catalogue exposure, admin audit attribution

## Data authority and migration status

The engine, administrator authentication, release publishing, module state, themes, crime proof, ledgers, events, and release history are server-backed. The original 18-screen client still contains browser-local player progression for the systems that have not yet been migrated into individual engine modules. That boundary is explicit so client-side state is never mistaken for authoritative multiplayer state.

The next production modules are Inventory and Items, Travel and Cities, Gym, Jobs, Education, Combat, Factions, Market, Missions, and Casino. Each module must move its mutations behind the API and reuse the same event, audit, release, and adapter contracts already proven here.

## Deployment

The repository is connected to the exact `team-auraa` Vercel project:

- Project: `zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-e9158260af42`
- Production branch: `main`
- Runtime: Vercel static delivery plus `vercel-php@0.9.0`
- Database: Neon PostgreSQL integration
- Root directory: repository root

Every promotion must pass the local engine tests, local platform checks, bundle verification, and `scripts/verify-production.ps1` against the candidate deployment.

## Ownership and originality

The source is fully readable, unencrypted, and owned in this repository. Third-party packages and hosted services remain subject to their own licenses and terms.

ZONE is an original game and engine. It is inspired by the browser crime MMO genre and is not affiliated with Torn or its creators.
