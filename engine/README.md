# ZONE Engine Foundation

This directory is the executable engine proof requested before expanding the game itself.

It demonstrates five architectural promises with running code:

1. PHP 8.5 owns game outcomes and resource mutations.
2. Modules are discovered from manifests and can be installed, uninstalled, enabled, or disabled without editing the core.
3. Modules react to one another through domain events and hooks.
4. Themes are independent packages that can be changed without touching gameplay.
5. Currency movements and domain events are recorded in append-only audit tables.

## Included proof packages

- `modules/Crime`: server-authoritative crime catalog and attempts.
- `modules/Achievements`: listens for `CrimeSucceeded` and unlocks an achievement without importing or modifying the Crime module.
- `themes/zone`: primary tactical ZONE interface.
- `themes/terminal`: alternate theme proving view independence.

## Runtime architecture

```text
Web or Mobile Client
        |
     REST API v1
        |
 Application Use Cases
        |
 Domain Core + Events
        |
  Ports and Contracts
        |
PostgreSQL / Redis / Workers / Storage
```

The local presentation uses SQLite as an adapter so it runs without external services. The production schema is PostgreSQL and lives at `database/schema.postgresql.sql`. No game rule imports SQLite or PostgreSQL code.

## Run the proof

```powershell
powershell -ExecutionPolicy Bypass -File engine/bin/test.ps1
powershell -ExecutionPolicy Bypass -File engine/bin/serve.ps1
```

Then open `http://127.0.0.1:4285/engine`.

The existing ZONE game remains at `http://127.0.0.1:4285/` and is treated as a frontend consumer to migrate screen by screen.

## Production adapters

- Database: PostgreSQL through `ZONE_DATABASE_URL=postgresql://...`
- Cache: an in-memory presentation adapter and a production Redis adapter selected through `ZONE_REDIS_URL`
- Media: `assets` table supports ordinary images, thumbnails, animation, video, GLB, GLTF, and arbitrary metadata
- Timers and work: `jobs` table models durable scheduled work
- Notifications: `notifications` table models player delivery state

The presentation console runs with `ZONE_DEMO_MODE=1`. Production admin mutations require `ZONE_ADMIN_TOKEN` and the `X-Zone-Admin-Token` header.
