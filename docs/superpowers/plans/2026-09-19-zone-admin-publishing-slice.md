# ZONE Admin Publishing Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publicly deploy an integrated ZONE presentation where the admin control plane creates a versioned release and the player game consumes that release through the PHP 8.5 engine API.

**Architecture:** Extend the existing modular PHP engine with a validated release manager and content-publishing API. Add a standalone bilingual admin studio and a small player runtime adapter without rewriting the existing 18-screen game. Package static assets and the PHP engine together in the existing team-auraa Vercel project using `vercel-php@0.9.0`, while identifying Vercel demo persistence separately from the PostgreSQL production target.

**Tech Stack:** PHP 8.5, vanilla TypeScript-compatible JavaScript, HTML, CSS, SQLite presentation adapter, PostgreSQL 18 schema, Vercel PHP runtime 0.9.0, Node.js 22 build scripts

**Spec:** `docs/ZONE_PLATFORM_ARCHITECTURE.md`

## Global Constraints

- PHP owns game outcomes and publish validation.
- Admin changes remain drafts until publish.
- Publish creates an immutable release and audit entry.
- Player UI consumes the active release manifest.
- Builder blocks are typed schemas and cannot contain arbitrary executable HTML.
- English, Arabic, LTR, RTL, and mobile layouts are required.
- Existing ZONE game assets and all 18 screens remain intact.
- The Vercel project and team remain `team-auraa/zone-torn-style-game-mockup-6cf978c1-8c87-4a81-bf94-e9158260af42`.
- Presentation persistence limitations are visible and are never described as production persistence.

---

## File map

| File | Responsibility |
| --- | --- |
| `engine/src/Core/Publishing/ReleaseManager.php` | Validate drafts, create immutable releases, activate and roll back releases |
| `engine/database/schema.sqlite.sql` | Presentation release, draft, and audit tables |
| `engine/database/schema.postgresql.sql` | Production release, draft, and audit tables |
| `engine/src/Application/GameEngine.php` | Application methods exposed to the HTTP API |
| `engine/router.php` | Public release queries and admin publishing commands |
| `engine/tests/run.php` | Release lifecycle and validation regression tests |
| `api/index.php` | Vercel PHP 8.5 function entrypoint and demo adapter selection |
| `admin.html` | Admin control plane structure |
| `admin.css` | Responsive bilingual studio design |
| `admin.js` | Draft editor, preview, publish, rollback, and API trace behavior |
| `platform-runtime.js` | Active release loader and safe application to the existing game |
| `index.html` | Runtime hook, stable screen identifiers, admin entry, and generic release-driven page surface |
| `scripts/build.mjs` | Copy admin and platform files into the Vercel static output |
| `scripts/verify.mjs` | Assert admin, runtime, release hooks, and legacy game assets exist |
| `vercel.json` | PHP runtime and engine/API rewrites beside static assets |

### Task 1: Release persistence contract

**Files:**
- Modify: `engine/database/schema.sqlite.sql`
- Modify: `engine/database/schema.postgresql.sql`
- Create: `engine/src/Core/Publishing/ReleaseManager.php`
- Test: `engine/tests/run.php`

**Interfaces:**
- Produces: `ReleaseManager::draft(): array`
- Produces: `ReleaseManager::saveDraft(array $manifest, string $actor): array`
- Produces: `ReleaseManager::publish(string $actor): array`
- Produces: `ReleaseManager::active(): array`
- Produces: `ReleaseManager::releases(): array`
- Produces: `ReleaseManager::activate(string $releaseId, string $actor): array`

- [ ] **Step 1: Add failing lifecycle tests**

Add assertions that a default draft exists, invalid block types are rejected, saving a draft does not change the active manifest, publish creates version `1`, publish activates that immutable snapshot, a second publish creates version `2`, and activating version `1` restores its manifest without deleting version `2`.

- [ ] **Step 2: Run the engine tests and confirm the new assertions fail**

Run: `powershell -ExecutionPolicy Bypass -File engine/bin/test.ps1`

Expected: non-zero exit with missing release manager or release tables.

- [ ] **Step 3: Add release tables**

Add `content_drafts`, `content_releases`, and `admin_audit_log`. Use text identifiers, immutable JSON snapshots, integer release numbers, one active-release constraint in application logic, actor, action, target type, target id, previous JSON, next JSON, correlation id, and timestamp.

- [ ] **Step 4: Implement strict manifest validation**

Accept schema version `1`; require bilingual brand and announcement fields; validate the accent as a six-digit hex color; allow only known game screen identifiers; require unique page ids and slugs; and allow only `hero`, `text`, `callout`, `stat-grid`, and `action-grid` block types. Reject scripts, event-handler keys, unknown block types, duplicate ids, and malformed module states.

- [ ] **Step 5: Implement draft, publish, active, history, and activation operations**

Publishing reads the validated draft inside one database transaction, allocates the next release number, inserts one immutable snapshot, clears the previous active flag, activates the new release, and writes `ReleasePublished` plus an audit row with a correlation id. Activation changes only the active pointer and writes `ReleaseActivated` plus an audit row.

- [ ] **Step 6: Run the engine tests**

Run: `powershell -ExecutionPolicy Bypass -File engine/bin/test.ps1`

Expected: all existing 24 tests plus the release lifecycle assertions pass.

### Task 2: Engine application and HTTP publishing API

**Files:**
- Modify: `engine/bootstrap.php`
- Modify: `engine/src/Application/GameEngine.php`
- Modify: `engine/router.php`
- Test: `engine/tests/run.php`

**Interfaces:**
- Consumes: the `ReleaseManager` methods from Task 1
- Produces: `GET /api/v1/releases/active`
- Produces: `GET /api/v1/admin/draft`
- Produces: `GET /api/v1/admin/releases`
- Produces: `PUT /api/v1/admin/draft`
- Produces: `POST /api/v1/admin/releases/publish`
- Produces: `POST /api/v1/admin/releases/{releaseId}/activate`

- [ ] **Step 1: Add application-level tests**

Assert that `GameEngine::activeRelease()` returns the active manifest, `saveReleaseDraft()` preserves the active release, `publishRelease()` changes it, and `activateRelease()` restores a prior snapshot.

- [ ] **Step 2: Run the engine tests and confirm method failures**

Run: `powershell -ExecutionPolicy Bypass -File engine/bin/test.ps1`

Expected: non-zero exit caused by undefined publishing methods.

- [ ] **Step 3: Inject the release manager into `GameEngine`**

Instantiate it in `engine/bootstrap.php`, pass it to the application constructor, expose the six application methods, and include release version and release id in `status()`.

- [ ] **Step 4: Add versioned routes**

Keep active release public and protect all draft, publish, and activation mutations with `require_admin()`. Parse JSON for `PUT`, return `201` for publish, use `404` for unknown releases, `422` for invalid manifests, and include correlation ids in successful mutation responses.

- [ ] **Step 5: Run PHP lint and engine tests**

Run: `.tools/php-8.5.10/php.exe -l engine/router.php`

Run: `powershell -ExecutionPolicy Bypass -File engine/bin/test.ps1`

Expected: no syntax errors and all tests pass.

### Task 3: Vercel PHP 8.5 entrypoint

**Files:**
- Create: `api/index.php`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `engine/router.php`
- Produces: public `/engine`, `/engine/*`, and `/api/v1/*` routes on the existing Vercel origin

- [ ] **Step 1: Create the serverless entrypoint**

Map the rewrite query parameter to `REQUEST_URI`, default `ZONE_DATABASE_URL` to `sqlite:/tmp/zone-engine.sqlite` only when `VERCEL=1` and no real database URL is configured, enable demo mode only when no admin token is configured, and require the engine router.

- [ ] **Step 2: Configure the supported PHP runtime**

Set `api/index.php` to `vercel-php@0.9.0`, then add rewrites for `/engine`, `/engine/:path*`, and `/api/v1/:path*` while preserving static-file routing for `/`, `/admin`, and all existing assets.

- [ ] **Step 3: Validate the Vercel configuration**

Run: `vercel build --scope team-auraa`

Expected: build succeeds and emits both the static output and the PHP function.

### Task 4: Bilingual admin control plane

**Files:**
- Create: `admin.html`
- Create: `admin.css`
- Create: `admin.js`

**Interfaces:**
- Consumes: publishing endpoints from Task 2
- Produces: draft editor state with `schemaVersion`, `branding`, `announcement`, `modules`, `navigation`, and `pages`
- Produces: same-origin preview and local presentation cache key `zone.platform.activeRelease`

- [ ] **Step 1: Build the control-plane shell**

Create navigation for Overview, Page Builder, Modules, Content, Themes, Assets, Economy, Events, and Releases. Add a runtime-status bar that reports PHP, database adapter, active release, module count, and presentation-mode state.

- [ ] **Step 2: Build the visual page builder**

Support page creation, bilingual titles, slug editing, enable and disable, block creation from the five allowed block types, block reordering, block deletion, and bilingual block copy. Render desktop and mobile previews from the same manifest schema.

- [ ] **Step 3: Build module and theme controls**

Render engine-discovered packages with versions, capabilities, hooks, and state controls. Keep theme activation separate from release branding and show which changes are immediate engine operations versus release-bound draft changes.

- [ ] **Step 4: Build save, publish, and rollback behavior**

Save calls `PUT /api/v1/admin/draft`. Publish calls `POST /api/v1/admin/releases/publish`, stores the returned active release under `zone.platform.activeRelease`, refreshes history, and updates the preview. Rollback activates a prior release and updates the same cache. All failures remain visible in an API trace panel.

- [ ] **Step 5: Add bilingual and responsive behavior**

Use semantic form controls, keyboard-reachable interactions, Arabic RTL layout, English LTR layout, 375-pixel mobile support, 768-pixel tablet support, and desktop split-pane preview.

### Task 5: Player release runtime

**Files:**
- Create: `platform-runtime.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `GET /api/v1/releases/active`
- Consumes: local presentation cache `zone.platform.activeRelease`
- Produces: `window.ZonePlatform.active(): object`
- Produces: safe runtime application for branding, accent, announcement, module visibility, navigation order, and generic custom pages

- [ ] **Step 1: Add a deterministic boot cache**

Read the active release from same-origin local storage synchronously so the game can render without a flash. Fetch the engine active release in the background, validate its schema version, refresh the cache, and dispatch `zone:release` when it changes.

- [ ] **Step 2: Connect the existing screen registry**

Filter and order the existing `SCREENS` array from the release manifest, include stable `id` values in navigation entries, and attach `data-zone-screen` attributes to navigation buttons. Preserve every legacy screen when no active release exists.

- [ ] **Step 3: Apply branding and theme tokens safely**

Use text content and CSS custom properties only. Do not inject release HTML. Render the bilingual announcement in a dedicated container and add a clear Admin Studio link for presentation navigation.

- [ ] **Step 4: Render generic release pages**

Add one generic page surface driven by typed block objects. Render only the five registered block types with escaped text and known actions. A new published page must appear in the game navigation without editing the core template again.

- [ ] **Step 5: Preserve the existing game**

Run the legacy verification and confirm all 18 original screens, 42 art targets, 3D viewers, maps, bilingual switching, responsive hooks, and local player save state remain present.

### Task 6: Build and verification gates

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `scripts/verify.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: admin and platform files from Tasks 4 and 5
- Produces: deterministic `public/` package and `npm run verify:platform`

- [ ] **Step 1: Extend the build roots**

Copy `admin.html`, `admin.css`, `admin.js`, and `platform-runtime.js` to `public/` alongside the existing runtime files. Do not copy source-only engine files into the static directory.

- [ ] **Step 2: Extend static verification**

Assert that the admin route assets exist, the player loads `platform-runtime.js`, the admin calls the versioned publishing endpoints, the game contains a generic release page surface, and no legacy required runtime entry disappears.

- [ ] **Step 3: Add API smoke verification**

Add a PowerShell smoke script that starts PHP on a free local port, checks `/`, `/engine`, `/api/v1/health`, `/api/v1/releases/active`, saves a draft, confirms the live release is unchanged, publishes, confirms the game release changed, activates the prior release, and stops only the process it started.

- [ ] **Step 4: Run all local gates**

Run: `npm run verify`

Run: `npm run build`

Run: `npm run verify -- public`

Run: `npm run engine:test`

Run: `npm run verify:platform`

Expected: every command exits `0`.

### Task 7: Vercel preview deployment and live proof

**Files:**
- Modify: `README.md`
- Modify: `docs/OMAR_ENGINE_PRESENTATION.md`

**Interfaces:**
- Consumes: verified Vercel build from Task 6
- Produces: one team-auraa preview URL containing game, admin, engine, and API

- [ ] **Step 1: Deploy a preview to the linked team project**

Run: `vercel deploy --yes --scope team-auraa`

Expected: a preview URL under the existing Vercel project, not a new project and not a production promotion.

- [ ] **Step 2: Verify live HTTP routes**

Request the preview root, `/admin`, `/engine`, `/api/v1/health`, `/api/v1/releases/active`, all admin assets, all platform assets, all 18 legacy screens through the root application, and every required 3D and image asset. Record status, content type, and non-empty size.

- [ ] **Step 3: Verify the publish loop in a browser**

Open `/admin`, add a page and callout block, save the draft, prove the game remains unchanged, preview it, publish it, open `/`, prove the new navigation page and block appear, activate the previous release, and prove they disappear. Capture desktop and mobile screenshots after the final state and inspect them for overflow, missing assets, and console errors.

- [ ] **Step 4: Update presentation documentation**

Document the exact public preview routes, the demo persistence boundary, the full ten-step acceptance sequence, and the production adapter target. Do not claim PostgreSQL, Redis, workers, or realtime are live unless their health checks prove it.

### Task 8: Production promotion gate

**Files:**
- No code changes

**Interfaces:**
- Consumes: verified preview evidence from Task 7
- Produces: production deployment only after explicit approval

- [ ] **Step 1: Present the verified preview URL and evidence**

Report the exact team, project, commit, deployment status, route matrix, test totals, screenshot paths, and remaining production-only dependencies.

- [ ] **Step 2: Promote only after explicit production approval**

Run: `vercel deploy --prod --yes --scope team-auraa`

Expected: the canonical production alias points to the verified deployment and all live checks are repeated against it.

## Self-review

- Spec coverage: the presentation slice covers admin draft, preview, publish, active release consumption, module and theme control, bilingual UI, version history, rollback, server-authoritative action proof, audit, and one public origin. Full production auth, dedicated queues, Reverb, object storage uploads, and multiplayer screen migration remain production work and are not represented as complete.
- Placeholder scan: the plan contains no deferred code placeholders. Every task defines a testable deliverable and exact commands.
- Interface consistency: all release operations use the same six `ReleaseManager` methods, the HTTP routes map one-to-one to application methods, and both admin and player clients use the active-release manifest and `zone.platform.activeRelease` cache key.
