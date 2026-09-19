# ZONE Product Handoff for Omar

Date: 2026-09-19

## Direct access

- Player game: `https://zone-torn-style-game-mockup-6cf978c.vercel.app/`
- Admin control plane: `https://zone-torn-style-game-mockup-6cf978c.vercel.app/admin`
- Protected engine console: `https://zone-torn-style-game-mockup-6cf978c.vercel.app/engine`
- Machine health: `https://zone-torn-style-game-mockup-6cf978c.vercel.app/api/v1/health`

Credentials are delivered separately and are never stored in Git.

## What Omar controls today

After signing in, Omar can:

1. See the executing PHP version, PostgreSQL adapter, active release, module state, and event health.
2. Create bilingual English and Arabic pages from registered blocks.
3. Preview a draft at desktop or mobile width without changing the live game.
4. Save and validate the production draft.
5. Publish an immutable numbered release.
6. Open the player game and see the published page in navigation.
7. Roll back by reactivating an older immutable release without deleting history.
8. Enable, disable, install, or uninstall engine modules.
9. Activate an independent theme package and edit release branding.
10. Create, edit, balance, enable, or disable server-authoritative crimes and inspect their audit history.
11. Inspect economy ledger entries, server events, typed asset support, and release history.

## Verified production path

The deployed path has been executed end to end:

```text
Omar login
  -> signed HttpOnly session and CSRF token
  -> bilingual page saved to production draft
  -> immutable release v1 published by omar
  -> release and audit data committed to Neon PostgreSQL
  -> fresh process reads the same active release
  -> player game renders Omar Production Control
  -> logout invalidates protected admin access
```

The rendered control plane reported:

- PHP 8.5.2
- PGSQL
- PRODUCTION
- Release 1
- `ContentDraftSaved` and `ReleasePublished` events

## Security boundary

- No public administrator bypass exists.
- `/engine` redirects anonymous visitors to `/admin`.
- Mutations require a valid signed session, same-origin request, and session-bound CSRF token.
- The client cannot choose crime outcomes, rolls, rewards, balances, or XP.
- Server initialization errors are returned as sanitized JSON and PHP error display is disabled.
- Production database absence is a hard failure. There is no temporary SQLite fallback on Vercel.

## Architecture Omar requested

The shipped foundation separates:

- PHP game logic and API
- Player web interface
- Admin control plane
- Core engine contracts
- Independent modules
- Independent themes
- PostgreSQL persistence
- Cache, queue, notification, realtime, and storage ports
- Images, thumbnails, animation, video, GLB, and GLTF asset records
- Domain events and hooks
- Economy and administrator audit trails
- Versioned content releases

The Crime and Achievements packages are the reference module pair. Crime emits domain events. Achievements reacts without editing or importing Crime logic. The Zone and Terminal theme packages prove that presentation can change without touching gameplay state.

## Verification record

- Engine tests: 52 passed, 0 failed
- Integrated local checks: 20 passed
- Live deployment checks: 17 passed
- Vercel build: 18 screens, 43 art targets, 144 files
- Database: Neon PostgreSQL over TLS
- Admin: login, CSRF, draft, publish, history, logout, and post-logout rejection verified
- Game: active release and published page verified in the rendered browser

## Current authority boundary

The backend, authentication, publishing, modules, themes, events, release history, and crime proof are server-backed. The existing 18-screen game is the frontend migration source and still keeps some single-player progression in browser storage until each system is extracted into its own engine module.

That migration is incremental by design. New Inventory, Travel, Gym, Jobs, Education, Combat, Factions, Market, Missions, and Casino modules plug into the proven contracts instead of rewriting the core.

## Operating rule

All production changes follow the same path:

1. Change the draft or module configuration.
2. Validate dependencies and schemas.
3. Preview English, Arabic, desktop, and mobile.
4. Publish an immutable release.
5. Verify health, history, audit, and player rendering.
6. Roll back the active pointer if verification fails.

No source is encrypted. External services and packages are documented and remain replaceable behind explicit adapters.
