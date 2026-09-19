# ZONE Platform Architecture

Status: implementation contract and verified production-foundation record

## Goal

ZONE is one integrated browser-game platform, not a game mockup beside an engine dashboard. The player game and the admin control plane are two clients of the same server-authoritative engine. Content, modules, themes, layouts, assets, balance values, and release state are managed from the admin control plane and become visible in the game only through a validated, versioned publish operation.

## Product surfaces

| Surface | Route | Responsibility |
| --- | --- | --- |
| Player game | `/` and `/game` | Renders the active release and sends player commands to the engine API |
| Admin control plane | `/admin` | Builds, previews, validates, publishes, and rolls back game releases |
| Engine API | `/api/v1` | Owns game rules, state mutations, module lifecycle, publishing, audit, and delivery contracts |
| Engine proof | `/engine` | Shows runtime status, server-authoritative actions, events, and adapter health |

## Non-negotiable behavior

1. The browser never decides crime, combat, reward, cooldown, or economy results.
2. Admin changes are drafts until publish. A draft cannot leak into the live game.
3. Publish creates an immutable release version and an audit event.
4. The player game renders the active release manifest from the engine.
5. Modules extend the system through declared contracts. They do not patch the core.
6. Themes and page layouts are presentation packages. They do not contain game rules.
7. Arabic, English, RTL, LTR, and mobile layouts are first-class requirements.
8. Every currency and item transfer receives a correlation identifier and ledger entry.
9. Every admin mutation records actor, timestamp, previous value, new value, and release association.
10. The source remains fully owned, readable, versioned, and unencrypted.

## Admin control plane

The admin is the operating system for the game, not a user editor.

### Dashboard

- Active engine and content release versions
- Module and theme health
- Queue, scheduler, cache, database, and realtime status
- Economy inflow and outflow summaries
- Recent admin and player security events
- Failed jobs, suspicious duplication patterns, and rollback readiness

### Visual page builder

- Build game screens from registered blocks
- Reorder sections with drag and drop
- Configure responsive visibility and layout
- Edit English and Arabic copy together
- Preview desktop, tablet, mobile, RTL, and LTR
- Bind blocks to engine queries and commands through declared data sources
- Save drafts without affecting the game
- Publish the validated layout as part of a release

The builder stores schemas, not executable arbitrary code. Modules register approved block types, settings schemas, API requirements, and render components.

### Module manager

- Install, update, enable, disable, and uninstall packages
- Show module version, engine compatibility, dependencies, permissions, migrations, hooks, API routes, game screens, admin panels, jobs, and assets
- Run installation and upgrade validation before activation
- Block unsafe removal when data or dependents would be orphaned
- Execute migrations transactionally where supported
- Roll back to a compatible previous module release

Each module package declares a manifest similar to:

```json
{
  "id": "zone.crimes",
  "version": "1.0.0",
  "engine": "^1.0",
  "provides": ["game.screen.crimes", "admin.content.crimes"],
  "subscribes": ["PlayerCreated", "ItemUsed"],
  "publishes": ["CrimeAttempted", "CrimeSucceeded", "CrimeFailed"],
  "permissions": ["crimes.view", "crimes.manage", "crimes.balance"],
  "migrations": true,
  "blocks": ["crime-list", "crime-history"],
  "jobs": ["RegenerateNerve"]
}
```

### Content studio

- Items, crimes, cities, travel routes, jobs, education, properties, factions, missions, NPCs, opponents, casino content, and notifications
- Typed validation for probabilities, prices, resource costs, rewards, requirements, cooldowns, availability windows, and translations
- Import, export, duplication, staging, preview, and bulk editing
- References and dependency checks before delete or publish

### Theme studio

- Design tokens for color, typography, spacing, surface, radius, and motion
- Component variants and module-provided theme slots
- Arabic and English preview
- Accessibility contrast checks
- Versioned theme packages independent of gameplay code

### Asset library

- Images, thumbnails, SVG, WebP, AVIF, animated WebP, GIF, MP4, GLB, and GLTF
- Metadata, ownership, variants, localization, dimensions, duration, hashes, and usage references
- Signed uploads to object storage
- Image and 3D preview
- Orphan and replacement checks before deletion

### Balance and economy

- Central resource definitions for Energy, Nerve, Life, Happiness, cooldowns, buffs, and bonuses
- Versioned balance tables with safe numeric ranges
- Economy ledger and item-transfer ledger
- Correlation tracing across commands, events, jobs, and transfers
- Simulation and impact report before publishing balance changes

### Operations

- Scheduler, queues, jobs, retries, dead-letter inspection, notifications, and realtime channels
- Structured logs and event explorer
- Role-based access control and approval policies
- Release history, diff, publish, rollback, and environment promotion

## Publish flow

```text
Admin edits draft
      |
      v
Schema and dependency validation
      |
      v
Preview using draft release
      |
      v
Publish transaction
      |
      +--> Immutable release snapshot
      +--> Module and content version map
      +--> Audit and domain events
      +--> Cache invalidation
      +--> Realtime ReleasePublished notification
      |
      v
Player clients fetch the active release manifest
      |
      v
Game navigation, pages, blocks, themes, and module capabilities update
```

Rollback switches the active release pointer to a previously validated snapshot. It does not rewrite audit history.

## Runtime boundaries

### Core

- Identity and authorization contracts
- Module registry and dependency resolution
- Event and hook bus
- Command and query bus
- Release manager
- Economy and item ledgers
- Resource, cooldown, buff, and bonus primitives
- Jobs, notifications, and audit contracts

The core has no crime, gym, travel, market, faction, or casino rules.

### Modules

Crime, Gym, Travel, Factions, Market, Inventory, Items, Combat, Education, Properties, Jobs, Casino, Missions, and future systems are independent packages. A module can contribute domain rules, migrations, API routes, event handlers, jobs, admin resources, game screens, builder blocks, translations, and assets through explicit interfaces.

### Themes

Themes consume the active release and module UI contributions through stable view contracts. A theme can be changed without editing domain logic, modules, database adapters, or APIs.

## Current stable technology target

The target uses current stable releases verified on 2026-09-19:

- PHP 8.5 for authoritative backend execution
- Laravel 13 for the production application shell, API, authorization, queues, events, scheduling, broadcasting, and migrations
- Next.js 16.3 with React 19.2 for the player and admin web clients
- PostgreSQL 18 for transactional game, content, release, and ledger data
- Redis 8.10 for cache, locks, sessions, queues, rate limiting, leaderboards, and event fan-out
- Laravel Reverb and Echo for realtime delivery
- Object storage plus CDN for media and 3D assets
- OpenAPI-generated TypeScript API client shared by the player and admin applications

The existing ZONE frontend remains the visual reference and migration source. It must not remain the authority for gameplay state.

## Deployment model

### Current Vercel production deployment

The existing team-auraa Vercel project serves one secured public origin with:

- Player game assets
- Admin control plane
- Engine proof
- PHP 8.5 Vercel function through `vercel-php@0.9.0`
- Versioned API routes
- Signed administrator sessions and CSRF-protected mutations
- Neon PostgreSQL persistence over TLS
- Immutable content releases, event history, and administrator audit records

The current deployment is PostgreSQL-backed and fails closed if its production database or administrator secrets are missing. Redis, dedicated workers, realtime delivery, object storage uploads, and multi-account RBAC remain adapter and module work. The in-memory cache adapter is reported honestly by the health endpoint until Redis is connected.

### Production deployment

- Vercel: Next.js player and admin clients, edge caching, public assets, and origin routing
- PHP application runtime: container service with PHP 8.5, queue workers, scheduler, and Reverb
- PostgreSQL 18: primary transactional store with backups and point-in-time recovery
- Redis 8.10: cache, queues, locks, rate limiting, and realtime fan-out
- Object storage and CDN: images, video, animation, GLB, and GLTF

Both deployments keep the same API contract. Moving the PHP application from the Vercel function to a dedicated long-running runtime does not require rewriting the web clients.

## Omar production acceptance tests

1. Add a crime in the admin content studio, save it as a draft, and prove the live game has not changed.
2. Preview the draft and prove the new crime appears only in preview.
3. Publish the release and prove the new crime appears in the player game.
4. Disable the Crime module and prove its route, navigation item, API capability, and builder blocks disappear without core edits.
5. Re-enable it and prove they return.
6. Add a page and reorder its blocks in the builder, publish it, and prove the game navigation and page update.
7. Change the theme and prove the same game data and module state survive.
8. Switch between English and Arabic and prove RTL and LTR layouts use the same release.
9. Run a server-authoritative action and trace command, event, reward, ledger, notification, and correlation identifiers.
10. Roll back the release and prove the prior game configuration returns while audit history remains intact.

## Current delivery state

The repository contains the integrated player client, secured administrator control plane, PHP 8.5 engine, module and theme registries, release manager, publishing API, runtime manifest loader, PostgreSQL schemas, economy and event audit trails, and rollback path on one origin. The live production deployment proves that Omar can sign in, save a bilingual production draft, publish an immutable release to Neon PostgreSQL, load the published page in the player game, and lose access after logout.

The original 18-screen game remains the visual migration source. Browser-local state in screens not yet migrated to engine modules is not treated as authoritative multiplayer state. Inventory, Travel, Gym, Jobs, Education, Combat, Factions, Market, Missions, and Casino are the next independent module migrations. Redis, dedicated workers, realtime delivery, object storage uploads, multi-account RBAC, backups, and observability remain production infrastructure work behind the contracts already established here.
