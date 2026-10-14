# ZONE Game Platform

ZONE is a bilingual browser crime MMO and an API-first game-engine platform under beta hardening. PHP 8.5 owns authoritative rules and publishing. The player game and owner-protected administrator control plane are separate clients of the same versioned engine.

## Deployment links and current status

As of 2026-10-05, the existing Neon database has exhausted its monthly public-transfer allowance and the live API returns HTTP 503. The beta-hardening candidate described below is locally verified, including an isolated PostgreSQL 18.6 run, but has not been promoted. These links identify the existing target, not a claim of launch readiness.

- [Player game](https://zone-torn-style-game-mockup-6cf978c.vercel.app/)
- [Admin control plane](https://zone-torn-style-game-mockup-6cf978c.vercel.app/admin)
- [Engine control room](https://zone-torn-style-game-mockup-6cf978c.vercel.app/engine)
- [Health API](https://zone-torn-style-game-mockup-6cf978c.vercel.app/api/v1/health)

| Component | Current version or adapter |
| --- | --- |
| ZONE Engine | 1.0.0 |
| PHP runtime | 8.5 |
| Production database | Neon PostgreSQL over TLS |
| API | `/api/v1` |
| Candidate Admin access | Owner-secret unlock, signed 12-hour HttpOnly session, same-origin mutations |
| Release model | Validated draft, preview, immutable publish, history, rollback |
| Languages | English and Arabic, LTR and RTL |

An earlier production release was verified in September. That historical result does not establish current availability. Local content publication and PostgreSQL persistence were reverified for this candidate on 2026-10-05.

## Product surfaces

### Player game

The `/` client contains 19 responsive game areas, English and Arabic layouts, dark and light themes, fitted 3D character and weapon viewers, an original overhead city atlas, progression systems, and release-driven custom pages. It reads the active release manifest at startup. Visitors receive isolated server-owned browser accounts instead of sharing the founder fixture. Ordinary family recruitment and real-account battle-stat standings are server-backed.

### Admin control plane

The `/admin` client provides:

- Owner-secret unlock without exposing the secret to player clients or browser storage
- Platform and adapter health
- Bilingual responsive page builder
- Registered visual block types
- Draft isolation and desktop/mobile preview
- Immutable release publishing and rollback
- Module lifecycle controls
- Theme activation and release branding
- Crime catalog, asset-format registry, economy ledger, and event explorer
- Typed bilingual creation of weapons, consumables, jobs, courses, properties, missions, and NPC opponents
- Registered fitted weapon-model selection for authored weapons
- Direct links to the game and engine console

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

The architecture target is independently installable gameplay packages with stable events and presentation contracts. Crime and Achievements demonstrate the event boundary; family recruitment and standings now have module-owned services. Other authoritative use cases still live in application/core game services. The presence of a module manifest is not proof that its entire original OpenPBBG system has been ported. Themes remain separate from persisted gameplay state.

Read the full engineering contract in [docs/ZONE_PLATFORM_ARCHITECTURE.md](docs/ZONE_PLATFORM_ARCHITECTURE.md) and the operator handoff in [docs/OMAR_PRODUCT_HANDOFF.md](docs/OMAR_PRODUCT_HANDOFF.md).

## Repository structure

```text
Zone/
|-- index.html                 Player game client and current 19-screen migration source
|-- player-session.js          Coalesced server-owned browser-session bootstrap
|-- platform-runtime.js        Active-release loader and validated local cache
|-- admin.html                 Owner-protected control-plane shell
|-- admin.css                  Responsive admin design system
|-- admin.js                   Builder, publishing, modules, themes, and operations UI
|-- api/index.php              Vercel PHP 8.5 entry point
|-- api/php.ini                Hardened production PHP settings
|-- engine/
|   |-- src/Application/       API-facing engine use cases
|   |-- src/Core/              Events, persistence, publishing, modules, themes
|   |-- modules/               Installable gameplay modules
|   |-- themes/                Installable interface themes
|   `-- database/              PostgreSQL and local SQLite schemas
|-- assets/                    Images and 3D game assets
|-- dist/                      Character, weapon, and map experiences
|-- scripts/                   Build, local, and production verification gates
|-- docs/                      Architecture, operations, and delivery records
|-- vercel.json                Static and PHP serverless routing
`-- .env.example               Required and optional adapter variables
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

The local server uses one origin. Only loopback development without an owner secret permits the developer shortcut. For production-like access checks, set `ZONE_PLAYER_SESSIONS=1` and an isolated `ZONE_ADMIN_TOKEN` before starting the server. Never use the local testing key in production.

## Configuration

Copy `.env.example` to the secret manager used by the target environment. Never commit the resulting values.

Required for a production deployment:

- `ZONE_DATABASE_URL`, `DATABASE_URL`, or `POSTGRES_URL`
- `ZONE_ADMIN_TOKEN`: a strong private owner secret, required before enabling the production control plane

On Vercel, server-owned browser sessions are automatic. For local testing, set `ZONE_PLAYER_SESSIONS=1`. Tokens are 30-day opaque HttpOnly cookies; only their hashes are stored in the database. The optional `/account` page claims the existing character with a unique, case-insensitive username and a 15-128-character password. Claiming and sign-in never repeat the starting grant or replace saved inventory, money, training or family membership. PHP uses Argon2id when available, with a bounded bcrypt fallback on runtimes without it.

Claiming rotates the session and shows a random 256-bit backup recovery code once. Save this code privately offline. Recovery changes the password, consumes and replaces the code, and revokes prior device sessions. Password and recovery hashes stay server-side; neither is kept in local storage. Sign-in/claim/recovery share a ten-attempt, 15-minute IP bucket and same-origin protection. Unclaimed guests still lose access when their cookie is cleared; players must claim before that happens. Email recovery, MFA and an owner-assisted recovery procedure are not configured. Losing both the password and backup code leaves no self-service recovery path.

Optional adapters:

- `ZONE_REDIS_URL`
- `ZONE_ASSET_STORAGE_URL`

On Vercel, PostgreSQL is provided through encrypted environment variables. The application fails closed instead of falling back to temporary SQLite when a production database is unavailable.

## Production verification

The production verifier must check runtime health, PostgreSQL, server authority, owner-protected Admin/engine access, persisted release consistency, and rendered game surfaces. It must not publish, create player accounts, or spend game currency. Existing owner or test-player credentials, when supplied, are private environment inputs.

```powershell
./scripts/verify-production.ps1 -BaseUrl 'https://your-zone-deployment.vercel.app'
```

Candidate verification on 2026-10-05:

- PHP engine suites: 635 passed, 0 failed, including account claiming/recovery and production-mode HTTP access
- Actual isolated PostgreSQL 18.6 beta contract: 30 passed, including concurrent purchase settlement, module publication gates and permanent-account recovery
- JavaScript suites on the declared Node.js 22 runtime (22.23.3): 203 passed, 0 failed, plus city-atlas/map checks
- Integrated local developer platform: 35 checks, including Arabic UTF-8 round-trip, draft isolation, publication, and rollback
- Read-only production-mode verifier against isolated local PostgreSQL: 33 checks; this is not evidence of current Vercel health
- Vercel candidate bundle: 19 game screens plus the account page, 43 art targets, 686 files; private shipped-image inventory: 47 entries
- Browser sweep: all 19 routes in English desktop and Arabic 390px phone mode, no broken images or page-level overflow
- Content workflow: Admin weapon create, publish, purchase, equip, registered 3D binding, and persistent family recruitment directly exercised
- Existing production health: HTTP 503; not a successful deployment verification

Optional PostgreSQL test, using an existing disposable loopback database named `zone_beta_smoke_*` and PDO PostgreSQL:

```powershell
$env:ZONE_POSTGRES_TEST_URL = 'postgresql://test_user@127.0.0.1:54328/zone_beta_smoke_local?sslmode=disable'
npm run engine:test
```

The suite rejects non-loopback targets. It adds isolated fixtures; it does not drop databases or modify production data.

## Data authority and migration status

Purchases, inventory/equipment, crime outcomes, gym training, banking, jobs, education, properties, missions, NPC combat, travel, high-low casino, daily rewards, territory control, family membership, and standings use authoritative API state. Local storage caches presentation and cannot authorize a mutation. Admin reads and writes are owner-protected and retain audit attribution.

This is not yet the finished MMO: ranked-war/Elimination panels and several casino cards remain explicitly labeled samples or previews; production Redis/job-worker/realtime wiring and additional module extraction remain incomplete. The original atlas and CC0 fitted character/models are stylized assets, not photorealistic Torn replicas. A healthy production database, configured owner access, approved promotion, and live smoke verification are required before handoff as launch-ready.

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
