# ZONE Engine 1.0

This directory contains the PHP 8.5 application that powers the ZONE API, secured control plane, modules, themes, publishing pipeline, server-authoritative gameplay proof, and durable audit data.

## Proven contracts

1. PHP owns outcomes, resource mutations, and economy changes.
2. Modules are discovered from manifests and can be installed, uninstalled, enabled, or disabled without editing the core.
3. Modules react to one another through domain events and hooks.
4. Themes are independent packages and contain no gameplay rules.
5. Currency movements and domain events are append-only and correlation-traceable.
6. Admin changes remain drafts until a validated immutable release is published.
7. Administrator sessions are signed, HttpOnly, same-origin, and CSRF-protected.

## Packages

- `modules/Crime`: server-authoritative crime catalog and crime attempts.
- `modules/Achievements`: consumes `CrimeSucceeded` and unlocks an achievement without importing or modifying the Crime module.
- `themes/zone`: primary ZONE interface package.
- `themes/terminal`: alternate package proving view independence.

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

PostgreSQL is the production adapter and its idempotent schema is in `database/schema.postgresql.sql`. SQLite is a local-development adapter. Domain and module code do not import PDO drivers directly.

## Run locally

```powershell
powershell -ExecutionPolicy Bypass -File engine/bin/test.ps1
powershell -ExecutionPolicy Bypass -File engine/bin/serve.ps1
```

Routes:

- `http://127.0.0.1:4285/`
- `http://127.0.0.1:4285/admin`
- `http://127.0.0.1:4285/engine`
- `http://127.0.0.1:4285/api/v1/health`

The local server script sets development-only credentials and a signed-session secret. Production requires encrypted `ZONE_ADMIN_USERNAME`, `ZONE_ADMIN_PASSWORD_HASH`, and `ZONE_ADMIN_SESSION_SECRET` values.

## Production adapters

- Database: PostgreSQL through `ZONE_DATABASE_URL`, `DATABASE_URL`, or `POSTGRES_URL`
- Cache: in-memory fallback behind a cache port, with Redis selected through `ZONE_REDIS_URL`
- Media: typed `assets` records for images, thumbnails, animation, video, GLB, GLTF, and metadata
- Timers and work: durable `jobs` records with run time, status, and attempts
- Notifications: persistent player delivery state
- Publishing: production draft, immutable release snapshots, active pointer, history, rollback, and administrator audit rows

Vercel fails closed if PostgreSQL or administrator secrets are missing. It never uses temporary function-disk SQLite as production persistence.
