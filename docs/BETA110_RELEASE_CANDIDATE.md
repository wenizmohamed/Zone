# ZONE beta110 release candidate

17 October 2026. This is an integrated candidate, not a whole-beta completion
claim or a production-deployment receipt. The launch deadline remains
21 October 2026, Asia/Dubai.

## Player-visible scope

The existing ZONE shell, approved artwork, map size and weapon assets remain.
Three protected map inputs, all 51 weapon assets and the explicit Git newline
rules are unchanged from `5882cc70ff48744378af2b0eab270584d3052ea1`.

- Map hit selection considers competing rendered coins instead of trusting
  feature-array order. Pitched selection uses actual rendered feature geometry
  and the active roof-height contract, not the ground point below an icon.
- A confirmed warm-refresh defect is corrected: cached provider associations
  are applied to replacement pin objects before their first GeoJSON publication.
  Refreshing labels or showing the map again no longer republishes authored
  anchors before the next idle callback restores the assigned rooftops.
- The director policy panel is in **World & territories**, not Media Library.
  Unsaved numeric values and material selections survive language/section
  changes. Local status text follows English/Arabic. A successful draft save no
  longer emits a false administrative-busy warning from a render helper.
- Immediate crime-save responses and admin reads retain the same category,
  crime-XP gate and legacy consequence metadata used by publication. Studio
  preview no longer misclassifies an edited Bootlegging job as Search.
- Preview clearly identifies illustrative player resources and read-only
  actions. It does not ask the owner to wait for a real player session.
- Crime receipts explain a material award suppressed by policy separately from
  cash/XP settlement. A failed current request does not inherit an old success
  narrative. Changing language dismisses old transient copy, not player data.

## Separately reviewed content candidate

`engine/data/content-packs/street-foundations110.json` is versioned source data,
not an automatic seed, installer or publication. Its scope is:

| Content | Effect |
| --- | --- |
| Collect at the Docks | Owned bat, three Nerve, mastery and earned cash chain; a critical failed attempt can cause 60 seconds of jail. The bat is not consumed. |
| Free the Canal Crate | Owned knife, level two, four Nerve; a critical failed attempt can cause 120 seconds of hospital time. The knife is not consumed. |
| Switch the Cargo | Level three, six Nerve and one consumed Sand. Payout is constrained against current discounted purchase price; there is no chain bonus. |
| Search for Cash and Bootlegging | Only the specified earned chain-bonus fields change. Existing access, base costs, payouts and risks remain. |
| Clinic Wrap / Street Trauma Pack | New inexpensive owned supplies reduce up to 60/180 seconds of hospital time and restore no Life. Two real NPC stock rows are added. |
| Scrap Copper Wire | Separate new low-value material, price 40 and current NPC resale 36. It is not a new weapon, recipe or stat advantage. |

All 31 previous crime routes and the three existing full-clear medicines remain.
Owned items, accounts, balances and completed progress are not reset. New supply
and tool requirements must be inspected before commitment; hospital purchases
remain unavailable, so recovery supplies should be bought beforehand.

The new jobs use the current fallback activity group because crime-category
authoring is not added in this candidate. No unsupported category or narrative
fields are smuggled into the JSON.

## Published material controls

These optional fields live under `manifest.worldPolicy`:

| Field | Meaning |
| --- | --- |
| `findValueBudgetPerHour` | Global World-issued material resale value per fixed UTC server hour. |
| `searchValueBudgetPerHour` | Independent Search-issued material resale value per player per fixed UTC server hour. |
| `materialItemIds` | Null/absent means all published materials; otherwise 1 to 32 distinct published material IDs. |

Null/absent budgets are unlimited; explicit zero stops new issuance from that
source. A positive budget is an integer through 2,000,000,000. The candidate
proposal is 360 per World hour and 360 per player Search hour, with only Copper
eligible. Those are proposed published values, not silently installed defaults.

Frozen issue-time resale value, quantity, source, scope, outcome, release and
correlation are recorded before their effect in one transaction. Expiry, claim,
restart, republishing and later price changes do not refund that hour's issued
value. Same-correlation retries return the same terminal outcome, including
denials, without producing a later debt or duplicate award.

World uses its existing dedicated advisory lock; Search uses the existing player
lock. Unrelated players are not serialized behind a global publication lock.
Crime, catalog and policy come from one immutable release read. Supported legacy
releases with missing/null captured content use the immutable foundation, just
as bootstrap and rollback already do.

Search retains its single 12% roll after success and one-unit award. A currently
Sand-only published pool preserves its old selection and RNG sequence. A legacy
installation that already has multiple materials changes from hardcoded Sand
Search loot to the full published pool on upgrade. Do not call that case
unchanged. The actual production GET on 17 October confirmed only Sand, price
22,500, in active release `b687ea177453086a8b7a70cd91a8c1e0`, version four.
Publishing Copper and its selected pool is a separate, deliberate content change.

Limits remain explicit: UTC-hour budgets are not rolling-hour budgets; World has
no pacing or per-player claim quota; old unclaimed Sand and owned stock are not
retroactively capped. At the proposed values, World can issue ten Copper units
per hour globally and Search ten units per player per hour. Street finds remain
an optional competitive discovery bonus, not a promised progression route.

## Actual isolated browser proof

Only the separate in-app browser was used. No Chrome DevTools, local Chrome
extension or raw CDP control was used. Configured viewports were 1440 by 900 and
390 by 844, with no horizontal overflow in the checked Arabic phone screens.
The later English phone crime-plan check also had zero horizontal overflow;
the Arabic desktop equipment check used 1440 by 1000.

A fresh ordinary player, not Owner Playtest, completed this actual sequence:

1. Started with 2,500 cash and no bat, then bought bat 800, wrap 180 and pack 420.
2. Ran the published bat job without equipping its owned tool. A real success
   paid 510, spent three Nerve and advanced mastery to two. A second real roll
   failed without cash and reset the chain, retaining the bat.
3. Claimed the worker-created Copper find, saw actual ownership, sold it for 36,
   then deposited 100 in Bank.
4. Returned through an Arabic phone reload: wallet 2,546, bank 100, total 2,646.
   The complete cash ledger reconciled, including the preexisting first-day
   streak reward of 1,000. No staff cash/XP/inventory grant was used.
5. Entered Gym through the actual map coin and trained Strength from 10 to 17
   with the normal five-Energy cost. Subsequent regeneration remained active.
6. Equipped the purchased bat through the actual Arabic inventory control and
   returned to Home. The weapon label, 1.3 damage multiplier and rendered bat in
   the character's hand agreed. The stored equipment was `bat`, while wallet
   2,546 and bank 100 remained unchanged. No staff provisioning was used.

Actual Studio save, Arabic dirty-field preservation, draft preview and isolated
publication were exercised. The isolated release is
`984a9cc3c05a44bdfcadb467eedc1f12`, version one. None of its database or player
records is a production-install input.

The map check compared rendered symbol geometry, not only intended building
associations: all eight visible overview symbols stayed within vector
quantization of their 17 assigned provider associations before and after a real
language-refresh packet. A calibrated native Gym click selected the direct Gym
coin over a neighboring Missions candidate at 35-degree tilt and opened Gym.
In-app screenshot pixels and CSS input coordinates differ in scale; that scale
was measured before treating the neighboring-coin result as acceptance evidence.

Cold startup still waits asynchronously for provider/controller data; the warm
refresh fix does not claim to eliminate all cold-start loading or prove every
pixel in every screen. Synthetic branch tests, including medical recovery and
critical outcomes, are not represented as real probabilistic browser outcomes.

## Verification and promotion gate

Current local candidate evidence:

- Full frontend/build/package checks: **928 passed, zero failed**, exit zero.
- Material rules: **78 SQLite / 81 disposable PostgreSQL**, zero failed.
- Actual owner crime-preview GET/PUT: **27 passed**, zero failed.
- Candidate-content rule tests: **71 passed**, zero failed. These use controlled
  rolls and zero test cooldowns, explicitly not a player-experience timing claim.
- Map-focused and existing preservation checks: **66 passed**, zero failed.
- Migration-source guard: **30 SQLite / 30 disposable PostgreSQL**, zero failed,
  independently rerun. A portable tracked-source checkout without the private
  helper or local config also passed all 30 checks.
- Controlled installer rehearsal: **34 passed**, zero failed, including failed
  SQL restoration retaining the new source guard until old source is proven.
- Complete engine runner: exit zero, including all existing suites and the four
  new material, schema-guard, crime-preview HTTP and content suites.
- Finite isolated stability: **63.451 seconds, 52/52 GET 200, zero new error
  signals**. This is not a capacity benchmark or production acceptance.

Independent review reproduced and closed immediate-save metadata loss and
snapshotless-release action failure. It separately reproduced an unsafe
installation race: an old PHP request could resume with cached old migration
bytes after new schema bookkeeping committed, call the old seeder and revert
the fingerprint. The narrow repair now rereads both SQL and crime bytes after
the existing migration lock, rather than using a request's captured old bytes.
Independent isolated tests reproduce both the original stale-capture window and
a second source change at lock acquisition without seeding or downgrading the
new fingerprint.

The prepared PC sequence installs that guard first while SQL and metadata stay
old, then completes a direct health response on the attested single-worker
Windows PHP process before any SQL replacement. Tests on the actual PHP binary
show an old request finishing before that same-process barrier and later requests
loading the new method with CLI opcode caching off. Guard-aware controlled
rollback restores and proves all other original files, including both SQL
sources, before restoring the old Database source. An independent edit is
preserved and reported, never overwritten to force a rollback.

This is bounded installation preparation, not a live-install receipt. Multiple
interpreters, changed runtime/configuration or missing barrier attestation are
not accepted. Filesystem replacement and PostgreSQL are not one crash-atomic
resource; abrupt process/pipe loss or an unresolved independent file edit can
still require explicit private-backup recovery. Controlled rollback tests do not
prove arbitrary-crash recovery. The exact committed revision and reviewed
manifest still require specific owner approval before production writes.

The database change is exactly one append-only table, `material_issuance`, and
one index. It must use a reviewed additive/no-seed installation, preserve the
current active content release, and never copy a local SQLite database or QA
account live. Source/data rollout and content publication are separate gates.

VPS work remains on hold. Login stays off under the owner's existing testing
instruction. Production promotion still needs the exact committed/fresh-checkout
gate, installation-safety resolution, specific approval and fresh canonical
browser verification. Whole-game visual polish, broader ordinary-player return
journeys, performance/capacity and launch access/hosting decisions are not
declared complete by this candidate.
