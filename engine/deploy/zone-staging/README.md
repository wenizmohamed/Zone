# ZONE native hosting candidate

**Status: preparation only. Linux FPM/Nginx staging runtime is unexecuted.**

These files describe an isolated candidate, not a deployment or a permission to
change production. No packages were installed, no files were uploaded, no Linux
services were started, and no database was restored or migrated by this change.
The existing team-auraa Vercel frontend, current public URL, owner credentials,
accounts and testing policy stay unchanged. Local PC PHP stays 8.5.10.

## Scope and source of facts

The coordinating agent supplied a read-only VPS snapshot: Ubuntu 24.04.4 x86_64,
2 vCPU, 7.94 GB RAM with about 5.9 GB available, and 65 GB disk free. Nginx already
owns 80/443, social-listening uses 3001, and shared PostgreSQL 16 uses loopback
5432 for other applications. The current reverse SSH endpoint is 55436. PHP,
Redis and Docker are absent. Recheck these facts before any approved setup.

The authoritative ZONE database is **PC 127.0.0.1:55433 / zone_local_beta**.
VPS PostgreSQL is a different instance. This plan does not repoint the game to
the VPS or replace any existing database, port, site block or shared credential.
WSL is unavailable locally, so the static tests below cannot validate Linux
permissions, package dependencies, FastCGI semantics or actual load capacity.

Compatibility was checked against the real `api/index.php`,
`engine/bin/relay.mjs`, `engine/router.php`, `engine/bootstrap.php`, database
connection/migration code and cache factory. The relay speaks HTTP, not FastCGI.

## Candidate topology

```text
separately approved Vercel candidate, unchanged frontend and API code
  HTTPS /zone-staging-gateway/api/v1/... on an approved existing TLS host
  Nginx candidate prefix strips only /zone-staging-gateway/
    HTTP 127.0.0.1:55437, unchanged Node relay and signed owner proof
      HTTP 127.0.0.1:54301, new Nginx fixed-router FastCGI adapter
        Unix /run/zone-staging/php-fpm.sock, independent PHP 8.5 FPM pool
          dedicated restored staging DB/role in the existing PG16 cluster
```

Only the approved TLS prefix is reachable remotely. No public Node or FPM
listener is added. Proposed 54301/55437 ports must pass a fresh occupancy check.
The prefix preserves the canonical API path, query, body and signed client
headers; owner HMAC verification must see the same route that Vercel signed.

The external proxy uses `Host: zone-staging-gateway.invalid`, deliberately not
`127.0.0.1:55437`. The relay's authenticated local shutdown requires the exact
loopback transport Host as well as the loopback socket peer. Using that Host
in the external proxy would turn a remote request into a local control request.
This literal transport Host does not change the signed public client Host.

The HTTP adapter executes only the fixed `engine/router.php`, never a script
chosen by a URL. It disables automatic FastCGI request-header forwarding and
supplies a narrow allowlist. `REMOTE_ADDR` is the actual trusted adapter peer,
literal loopback. The router validates peer, shared key, allowlisted public host,
HTTPS and client IP before adopting the signed public client context. Neither
Nginx config fabricates a gateway key, owner grant or client IP.

## Files and installation destinations

The paths below are proposals to review and install only after separate setup
approval. Do not copy the entire working tree, private env, research archives,
local SQLite files, test fixtures, logs or sessions into the server release.
Export Linux configuration and env templates from the committed Git blobs or
archive with LF line endings, not an auto-CRLF Windows checkout. Verify the
rendered private env too; an accidental trailing CR can change a credential.

| Source | Proposed destination and owner |
| --- | --- |
| `php-fpm.conf`, `php-pool.conf` | `/etc/zone-staging/`, root:root 0644 |
| `zone-staging-engine.env.example` rendered without placeholders | `/etc/zone-staging/engine.env`, root:root 0600 |
| `zone-staging-relay.env.example` rendered without placeholders | `/etc/zone-staging/relay.env`, root:root 0600 |
| `zone-staging-fpm.service`, `zone-staging-relay.service` | `/etc/systemd/system/`, root:root 0644 |
| `nginx-zone-logging.conf` | approved Nginx http-context include, before the other snippets |
| `nginx-engine.conf` | approved new http-context include, no existing block replacement |
| `nginx-candidate-prefix.conf` | include inside one approved existing TLS server, no conflicting prefix |
| `zone-staging-logrotate.conf` | reviewed `/etc/logrotate.d/zone-staging`, root:root 0644 |
| `vercel-candidate.env.example` | private reviewed values for a separately approved candidate only |

Create dedicated non-login system identities `zone-engine-staging` and
`zone-relay-staging`. The FPM master retains only the listed setuid/setgid/chown/
kill capabilities needed to manage its dedicated workers; no application request
runs as root. The Node relay has no capabilities, no DB credential and no write
access to the release. Verify the real Node binary/version first: `/usr/bin/node`
is a template path, not an observed VPS runtime. Use a supported runtime that
passes the shipped relay tests, without changing another application's Node.

The release directory `/srv/zone-staging/releases/<reviewed-revision>` and
`current` link must be root-owned and read-only to both service identities.
Verify traversal/read access to all release files. Precreate:

- `/etc/zone-staging`, root:root 0700; systemd reads the private env files.
- `/var/log/zone-staging`, root:root 0750; FPM master opens its bounded logs.
- `/var/lib/zone-staging`, root:root 0755, with `sessions` and `tmp` subdirectories
  owned by zone-engine-staging:zone-engine-staging 0700.
- The four explicit Nginx log paths, with the reviewed installed Nginx master/
  worker access requirements. FPM systemd creates `/run/zone-staging` 0755;
  the socket is zone-engine-staging:www-data 0660.

Private env is outside the source tree. Generate a fresh printable 32-512 byte
relay key for this isolated candidate and match it in all three layers. Replace
host placeholders with exact approved hostnames, not wildcards. The examples
intentionally fail closed: their relay key is too short and host placeholders
are invalid. Existing owner secrets remain only in their existing approved
Vercel scope; do not add them to Linux env. The FPM pool clears inherited env and
imports only its DB URL, relay key and public-host allowlist, plus explicit
`VERCEL=1` and `ZONE_PLAYER_SESSIONS=1`. This avoids the local-admin shortcut.

The installed Nginx logrotate policy may already match `/var/log/nginx/*.log`.
**Resolve duplicate logrotate ownership before installation.** Each candidate
log must have exactly one owner policy; do not blindly install overlapping
policies or rewrite the shared application's rotation. Proposed rotation retains
seven files and rotates at 10 MB on a daily invocation. This is not a hard disk
cap; frequency and worst-case output still require measurement. Log reopening
signals are not service restarts. Nginx access logs deliberately omit query
strings, client IP, cookies, headers and bodies. Review journal retention and
existing Nginx error-log behavior too; errors can contain request URIs. Never
put credentials in URLs, and use synthetic candidate data for fault probes.

## Approval-separated setup and verification

1. **Native setup approval.** Recheck host/ports, installed Node, existing TLS
   server and include order, systemd v255 compatibility, Nginx UID/log policy,
   RAM/disk baseline and package trust. PHP 8.5.11 amd64 Ubuntu 24.04 FPM packages
   exist in the [maintainer package index](https://ppa.launchpadcontent.net/ondrej/php/ubuntu/pool/main/p/php8.5/).
   This is a third-party maintainer source, not the Ubuntu archive. Review the
   signed repository/key and resolver plan before installing; do not download a
   loose package and bypass dependencies. Verify PHP minor version and needed
   extensions, including PDO PostgreSQL, JSON, OpenSSL and OPcache. Do not start
   a distro default FPM pool, bind shared ports or replace existing packages as
   an accidental install side effect. An actual install plan is a separate gate.
2. **Isolated database restore approval.** Use a fresh consistent, checksummed
   dump of the authoritative PC source and a new approved staging DB name and
   dedicated role. Restore only into that empty named database, never with
   `--clean` against a shared or source database. Restore without source owner/
   ACL grants, give the candidate role rights only to its staging database and
   schema, and prove connection from that role plus denial to unrelated DBs.
   Do not alter existing roles/passwords, cluster bind addresses or global
   `pg_hba.conf` policy. Set role-scoped connection/statement/lock limits after
   measuring normal operations. Verify TLS before using the template's
   `sslmode=require`; do not silently downgrade it. Compare account/player,
   browser-session, catalog-release, wallet, inventory, ledger and event counts,
   foreign keys and selected checksums with the dump manifest before requests.
3. **DB before any runtime request.** `zone_engine()` calls `migrateAndSeed()`
   even for `/api/v1/health`; a fingerprint change can execute schema/seeding.
   Health is DB-backed readiness, not a harmless process-only liveness probe.
   The reviewed release must point only to the isolated restored staging DB
   before service startup, schema checks, health, browser or load traffic. Do not
   run the PC-specific `migrate-local.php` on this server or copy fixtures live.
4. **Approved Linux configuration gate.** Against the rendered candidate files,
   run `systemd-analyze verify` for both units, FPM `--test --fpm-config`,
   `node --check` for the relay, `nginx -t` and `logrotate --debug` before any
   approved start or Nginx configuration reload. Confirm actual pool UID,
   socket access, private directories, env availability and module load. Verify
   there are no enabled extra PHP pools, unexpected binds or config collisions.
   The static Windows test below cannot replace these commands.
5. **Isolated candidate acceptance.** Test DB connectivity and readiness through
   the entire signed chain, then ordinary-player login/session persistence,
   one Train and one acquisition with exact resource/ledger deltas, fresh GET
   and reload, and unchanged results after an approved candidate restart. Prove
   owner Studio draft/save/preview/publish/rollback on disposable content only,
   normal-player effects and preservation of transaction history. Validate EN/
   AR, cookies, allowlist, origin and owner HMAC. Wrong key/host/IP, external
   `/__zone_relay_stop`, fabricated owner headers and unauthenticated admin
   writes must fail. A HEAD health response or open port is not playable proof.
6. **Capacity and recovery gate.** Use only isolated restored/synthetic data.
   Measure latency, 5xx/error lines, FPM queue/children, relay connections,
   CPU/RSS, PG connections/locks, disk and effects on existing services against
   the recorded baseline. Current quotas are conservative starting bounds,
   not a concurrent-player promise. Reject on unrelated-app regression or
   capacity exhaustion; review bounds rather than removing them. Restore a
   backup into another isolated named DB and record actual RPO/RTO. Prove
   behavior under restart and interrupted responses, with no automatic action
   replay. No acceptance evidence for these Linux checks exists yet.

The FPM request kill at 16 seconds is inside the relay's 18-second upstream
deadline; the TLS proxy/Vercel timeout is 22 seconds. Timeouts do not prove an
action failed before commit. On an interrupted receipt, reload saved state and
inspect the transaction before retrying. Both Nginx upstream retries are off.
The relay unit calls the existing authenticated local drain endpoint, waits for
its service PID, then has a bounded signal fallback. A long body/in-flight
request can exceed the drain bound; this is not a guarantee of zero interruption.

No Redis is configured here. The source falls back to process-local ArrayCache;
distributed cache/queues, scheduled workers, real-time transport and PC-independent
durability are not delivered or proven by these service files.

## Cutover and rollback are separate gates

The PC remains authoritative until an explicit cutover approval. A stale dump
is not eligible for final cutover. Approve a short write freeze, drain requests,
take a fresh consistent final snapshot, restore to a dedicated target, compare
balances/ownership/session/release/ledger checks and run the accepted probes.
Then change only the separately reviewed Vercel backend origin/key scope, keeping
frontend URL, accounts, credentials and the approved access policy unchanged.
No source account reset, owner grant or fixture promotion is part of cutover.

Keep the previous origin and credentials privately recoverable, source service
and final source backup intact, and new backend writes fenced until acceptance.
If no target writes were accepted, an explicitly approved origin rollback can
restore the still-current source. If new target writes exist, do **not** blindly
repoint at the stale PC. Stop/fence writes, preserve both databases, reconcile
the accepted target transactions or perform an approved consistent failback,
verify, then reopen. Never erase the new ledger to make rollback look clean.

Code rollback, catalog-release activation and database restore are different
operations. Catalog rollback preserves history, code rollback requires schema
compatibility, and database restore requires an approved recovery window. FPM
OPcache timestamp checks are off: replacing `current` without a reviewed drain
and service refresh can keep old PHP bytecode. A code release needs immutable
source files, hashes and a compatible schema; do not hot-edit files in place.
Neither an FPM reload nor rollback to an old source commit undoes migrations.

To withdraw an unpromoted candidate, first confirm the canonical Vercel origin
never changed. Stop only the two approved candidate units after drain, remove
only the reviewed prefix/adapter includes with a passing `nginx -t` and an
approved Nginx config reload, and retain DB/backups/evidence. Do not stop the
shared Nginx/PostgreSQL services, change 3001/5432/55436 or delete any DB.

## Local executable contract

From the repository root:

```text
node --test scripts/test-hosting-plan.mjs
git diff --check
```

The test reads the real gateway/relay/router and config templates, checks fixed
paths, port isolation, source-compatible header flow, non-control proxy Host,
private worker env, shutdown-command JavaScript syntax, limits and truthful
gates. It opens no listener, installs no dependency, executes no systemd command,
connects to no database and does not test Linux runtime behavior.

Runtime directive references: [PHP FPM configuration](https://www.php.net/manual/en/install.fpm.configuration.php),
[Nginx FastCGI parameters](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html)
and [systemd v255 service execution](https://github.com/systemd/systemd/blob/v255/man/systemd.exec.xml).
These describe the configuration interfaces; only an accepted Linux candidate
can prove this particular rendering works on the named host.
