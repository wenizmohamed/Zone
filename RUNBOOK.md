# ZONE beta release and recovery

Target: existing team-auraa/zone-final, project prj_jUGesNVozLbtieucfHCU9dKcy29U, canonical https://zone-torn-style-game-mockup-6cf978c.vercel.app/.

Build only a verified committed source checkout/export, never stale GitHub main. Keep .gitattributes active for byte-pinned map inputs. Exclude .tools, baseline-engine, engine/var, credentials, private research and fixtures from upload. No database copy belongs in a frontend release.

Run npm run vercel-build, engine/bin/test.ps1 and isolated PostgreSQL gates. Keep fixture, SQLite, real PostgreSQL and browser results distinct. Stage with existing Production settings using vercel deploy --prod --skip-domain --scope team-auraa. Review immutable deployment identity/output, then promote that same artifact and assign the canonical alias. If rebuilt, reverify the new artifact. Frontend-only v105 requires no schema migration or PHP/relay restart.

After promotion, verify real JSON readiness, source/build hashes, ordinary access arrangement, game/admin, EN/AR phone, direct map destinations and fresh error logs. Restore viewport/network/interception diagnostics. Current Vercel protection is unchanged; owner-authenticated readiness does not prove invited/public entry.

Code rollback baseline: dpl_EqBQUFg4aKThMW4jBpPSLrUW8K32, immutable https://zone-final-flmz4cynx-team-auraa.vercel.app. Roll back only after confirming backend/schema compatibility and the owner-authorized release target. Content rollback changes the active immutable content pointer in Studio and must retain player transaction history. Database restore is separate, destructive and never rehearsed over live data.

Current live dependency: PC PHP 4301, local PostgreSQL, relay 55436 and registered reverse SSH transport to auralistening. Durable backend target and launch audience choices are pending. No restart or access change is implied by this runbook. RTO/RPO, isolated restore and alert delivery are not yet measured.
