# ZONE beta116 local integration evidence

Date: October 19, 2026. Deadline unchanged: October 21, 2026, Asia/Dubai.

## Outcome

This is an implemented local increment, not whole-beta acceptance or a production release. The accepted compact charcoal/brass shell, baseline media, pinned map inputs, player data and existing login-off arrangement are preserved. The VPS remains on hold.

## Implemented player and Studio changes

- Gym: four coherent equipment close-ups replace flat station placeholders. Selection updates the actual console without a command or resource spend. The selected exercise has a short EN/AR explanation of its real combat benefit, current stat, actual energy cost, estimate and saved feedback.
- Phone Gym: station controls precede Train in both DOM/keyboard order and visual grid placement. The existing desktop composition remains explicit.
- Studio integration: published Gym image and localized description now reach the actual player view rather than staying unused in the catalog. Registered local raster paths are accepted; remote URLs, traversal and CSS injection are rejected. The original room remains the fallback. Published energy/XP/cost/name behavior is retained.
- Return sessions: a cold expired cookie exposes Account recovery instead of repeatedly reconnecting. A valid restored account is checked using the actual server payload and then auth/session, without trusting browser presentation to grant access.
- Equipment: an additive M4 derivative updates Assault Rifle I, III and V only, including matching inventory thumbnail and cache keys through inventory, inspect, character, combat, safehouse and library entry points. It does not alter weapon identity, stats, ownership or economy.

## Proving commands and results

Project Node: 22.23.3.

```text
npm.cmd run vercel-build
1127 tests passed
0 failed
exit 0

node --test scripts/test-session-return116-http.mjs scripts/test-studio-gym116.mjs scripts/test-ordinary-journey112.mjs
14 tests passed
0 failed
0 skipped
exit 0

git diff --check
exit 0
```

The main build includes the VM-only session suite. The real PHP HTTP programs are an explicit separate gate, not a silently skipped Node-only cloud test. Logs: `.tools/beta116-build.log` and `.tools/beta116-http.log`.

The actual isolated Studio test uses the real editor serialization and preview protocol in EN/AR, preserves unsaved fields, rejects stale or invalid writes, keeps draft changes out of ordinary bootstrap, publishes, charges exactly nine energy through the real Train endpoint, and reopens the same saved state after an owned test-only PHP restart. It grants no staff privilege or fixture money.

## Art and model evidence

Gym images: `art/gym116/{strength,defense,speed,dexterity}.webp`, 384 by 384 each, total 121982 bytes. The generated originals and delivery WebP files were inspected. These are generated game illustrations, not photographs of actual premises. Prompt/art direction: `artifacts/gym116-art-direction.md`. Provenance and exact hashes: `art/gym116/provenance.json`. The original room and placeholder files remain intact as fallbacks.

M4 model: `assets/weapons/upgrades116/m4-detail116.glb`, 2464364 bytes, SHA256 `6a5de7f46c667a9b54d4f6935a5338a02e014db46399e741e92c39d6679cd425`. Thumbnail: `assets/weapons/upgrades116/m4-thumbnail.png`, 48267 bytes, SHA256 `5d0e67f888797d50e72321306f81f96b73e4f2e38a7eaaf8f759d4f1f1985e3b`.

The derivative retains all 9236 normalized source triangles and UV corners, adding 22344 detail triangles. Six material primitives, twelve embedded PNG maps, 7 MiB mipmapped texture memory. Loader tests cover aliases, fallback, retry, independent clones, disposal, aspect framing, retained handle/socket geometry and historical bytes. Authoring recipe: `assets/weapons/source-tools/upgrades116/build_m4.py`, excluded from public runtime output.

Comparable offline renders, identical recorded cameras: `.tools/beta116-media/m4-before.png` and `.tools/beta116-media/m4-after.png`. These are offline asset previews, not screenshots from the game. Full media handoff: `.tools/beta116-media/handoff.json`.

## Independent review

One P2 was found: phone visual station-before-Train placement originally disagreed with DOM focus order. The station group was moved before the console, a source-order regression was added, and the reviewer confirmed resolution. No remaining actionable defect was found in the bounded reviewed source. This is not a visual-quality endorsement.

The original Gym section is preserved as an exact fixture and known hash. The specifically changed Gym section is separately pinned, then every other approved body byte is compared to the previous full-template fixture. Existing shared CSS geometry guards and map/asset baseline checks remain. No broad preservation exemption was introduced.

## Open gates and truthful limits

- Fresh in-game desktop, phone, English and Arabic pixels are not captured for this increment. Cua repeatedly reported no browsers even after the owner's reconnection and a kernel reset. No prohibited browser workaround was used.
- Actual equipped M4/animated finger contact and phone GPU frame timing are unverified. No premium score is assigned.
- The measured public first-byte delay remains unresolved: about 2.7 to 3.0 seconds along the public request path versus about 28.5 ms at direct PC PHP in the bounded sample. No hosting change or unsupported root-cause claim was made.
- The Studio currently edits existing Gym energy, XP threshold, fee, localized name/description and registered image. Additional Gym creation, base training coefficient/happiness formula and uploaded Gym scene bindings are not exposed. This increment does not pretend those controls exist.
- New image entries are generated into the cloud package inventory. No new assets or registry were copied to the authoritative PC checkout. A later publication must distinguish frontend delivery from any explicitly approved Studio asset mirror.
- GitHub main was checked at 98e0829. The tested beta115 loading repair and this beta116 increment are not published. The existing canonical URL remains `https://zone-torn-style-game-mockup-6cf978c.vercel.app/` under team-auraa. Production accounts, database, service configuration and access remain unchanged.

Required remaining product acceptance is the actual ordinary-player rendered opening/return journey, current-map building association and routing, new equipment in motion, bilingual/mobile screen review and any defects that review exposes. Unit counts, source checks and offline art previews do not replace that gate.
