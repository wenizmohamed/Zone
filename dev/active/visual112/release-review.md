# ZONE visual and ordinary-player increment 112

Date: 2026-10-18, Asia/Dubai.

This record covers a bounded candidate. It does not accept the whole beta or
authorize production publication. The approved layout remains unchanged.

## Player-facing changes

- Four sniper catalog selections now use two separate detailed derivatives:
  Dragunov for `sniperrifle_2`/`sniperrifle_5`, and Mosin 91/30 for
  `sniperrifle_3`/`sniperrifle_6`. Source geometry and measured grips are retained,
  with added receiver, fastener, bolt and optic detail where appropriate.
- The first walnut pass was rejected during direct image review because it
  looked flatter and more orange. The final exports retain the darker worn
  wood color/normal lineage, with independent nonmetallic roughness. The Mosin
  retains its iron sights, and the Dragunov lens is an opaque approximation.
- These two derivatives accompany the three earlier v111 derivatives. Together
  they change eleven selections, not fifty-one independently authored meshes.
  All twenty original GLBs and fifty-one historical thumbnails remain intact.
- Catalog thumbnails, ordinary inspectors, character, combat and safehouse
  imports use the same current registry. Updated cache keys reach the changed
  entry documents and their actual dependent modules.
- Job results explain the wage and real daily cash bonus separately, and show
  their actual total. Repeat shifts do not invent another daily bonus. This is
  feedback only; no cash, energy, progression or cooldown rule is changed.

## City preparation and recovery

The map continues using real provider footprints, its existing neighborhood
extent, original ownership geometry and existing building associations. It
retains the v111 full-height wall, window, floor-band and roof-detail work.

Readiness now checks actual compiled-program `isReady()` and `LINK_STATUS`.
First-use shader errors and draw exceptions report a recoverable facade failure
without removing the native city or its controls. Shared WebGL state is reset
after drawing. Preparation has a twelve-second deadline.

Independent review caught a P2 in the first timeout implementation: the vendored
`compileAsync()` kept an internal material-property poller alive after disposal.
The new regression executed the actual vendored helper and property store,
reproducing its uncaught `currentProgram.isReady` TypeError. The replacement
calls `renderer.compile()` and owns both readiness timers, cancelling them
synchronously before releasing resources. No vendor source was changed.

The independent source re-review passed 74 targeted checks with zero failures
and established no remaining concrete P1/P2 within that inspected lifecycle.
It did not perform GPU or browser-pixel acceptance.

## Ordinary-player proof

`npm run verify:ordinary-journey` uses the actual client methods and an owned,
hidden PHP helper backed by a new disposable SQLite database. It does not call
production or grant staff privileges, cash, inventory or battle-stat fixtures.

Both English and Arabic journeys cover fresh entry, Owned versus Catalog,
category filtering, inspect without purchase, a real bat purchase and equip,
Home/character equipment payloads, real Jobs costs and feedback, the published
cooldown, a second shift without a repeated bonus, Gym training and four actual
resource bars. An empty-cache client returns after an owned server restart with
the same account, balances, equipment, inventory, counters and training result.

The run after integration passed five tests, zero failures, exit 0. This is
client-state/HTTP/SQLite proof, not rendered desktop/mobile or PostgreSQL proof.

## Source and asset gates

The integrated `npm run vercel-build` passed 996 checks, zero failures, exit 0.
The committed-source weapon suite does not require private review captures.
Its compact camera receipts are retained under excluded source-tools. The
separate `npm run verify:weapon-evidence` requires and validates the actual
private before/after PNGs and camera files; absent evidence fails explicitly.

The historical v99 receipt remains pinned to the exact committed ad00253 blob.
No blanket normalization or alternate accepted receipt hash was introduced.
The approved layout/design styles, `.gitattributes`, three pinned map inputs,
original meshes and historical thumbnails remain preserved.

Final committed-source and fresh-checkout results must be bound to the exact
candidate revision in the release evidence before publication. Private test
databases, sessions, raw render captures and helpers are not public assets.

## Studio and hosting scope

The five new thumbnails resolve through static model-key presentation. Ordinary
rendering does not depend on the PC image registry, and existing published
definitions do not need to change. Studio's explicit `image` path validator is
different: the PC currently lacks those five PNGs. A registry-only refresh is
not sufficient when validation checks the local filesystem.

If the approved publication includes authoring these new PNG paths in Studio,
the minimal additive PC mirror is exactly the five new thumbnails and their
generated registry. No PHP-code change, worker/service reload, database
migration, content publication or hosting change is required for that mirror.
Any such live mirror remains a separate explicit publication approval scope.

The existing Vercel project is `zone-final` under `team-auraa`, project
`prj_jUGesNVozLbtieucfHCU9dKcy29U`. During the read-only check the canonical
production deployment was READY on GitHub main revision ad00253. This candidate
has not been promoted by this record. Login remains off and the VPS hold stands.

## Open player-experience gate

The in-app browser still reports local browser use disabled. No Chrome,
extension, DevTools, raw CDP or alternate browser was used to bypass that.
Latest city shader pixels, complete equipped-character presentation, phone GPU
performance and current English/Arabic desktop/mobile visual acceptance remain
open. Offline asset images and CPU geometry checks do not close those gates.

The October 21, 2026 Asia/Dubai deadline and unfinished whole-beta status remain
unchanged. Production publication requires its exact owner approval and must
not be represented as whole-beta completion.
