# ZONE visual111 candidate review

Last updated: 2026-10-18, Asia/Dubai.

## Executive summary

This is a local source candidate, not a production release or whole-beta acceptance.
The first working-copy build passed 975 checks, but the fresh-checkout gate
then correctly failed on an exact historical receipt hash. The v111 generator
had recorded an existing CRLF working copy instead of the unchanged LF Git
blob. The candidate now pins the exact ad00253 blob and SHA-256. The strict
byte-equality assertion remains intact; no historical file, checkout rule or
model was rewritten. The repaired fresh-checkout `npm run vercel-build` passed
975 checks, zero failures, exit 0. Its public output contains 885 files and
161,444,884 bytes. The receipt generator was also executed and matched the new
manifest exactly without rewriting the old receipt. Evidence is retained in
`.tools/beta111-fresh-repaired-build.log` in this verifier checkout.

The parent performed the closing source and regression review. The independent
reviewer completed a partial check but reached its usage limit before returning
a final verdict. No final independent PASS is claimed.

The approved layout stylesheet, three byte-pinned map inputs, twenty original
weapon GLBs and all fifty-one historical weapon thumbnails remain unchanged.
No PHP logic, database schema, economy values, accounts, access settings,
VPS configuration or production service was changed by this candidate.

## Critical issues

Rendered acceptance remains open. The initial in-app review showed the new G3
viewer working and exposed blank/dark city walls. Subsequent material and
geometry corrections must receive new screenshots, shader-error checks and
ordinary-player interaction checks. Older screenshots do not establish the
appearance of the latest material shader or final weapon texture exports.

Current browser calls continue to return `Local browser use is disabled in
Work settings`, including after owner confirmation and a fresh browser runtime.
Chrome, its extension, DevTools and alternate automation were not used as a
workaround. Production promotion is not authorized by this review.

## Important improvements

- Seven weapon selections use three separately credited GLB derivatives.
  The G3 has 19,444 triangles, L85 27,118, and Glock 46,690. Each has four or
  five draw primitives and embedded 512-pixel physical surface maps.
- The original v99 receipt remains immutable. Historical checks explicitly
  select revision 99; current bindings and their three new thumbnails receive
  separate geometry, material, provenance and packaging checks.
  Its committed baseline is 243,675 bytes, SHA-256
  `5d45a303e52ed7a018d07225cde49bbd60e8274eab6a5264c97fcb75c6271644`.
  The retained integration copy is 252,392 bytes, SHA-256
  `1df77e3aa00677337dbb50ae34909711f1b360347ddc20b3aee2d12f3130820d`.
  The latter is an older CRLF checkout representation, not a second accepted
  release hash. It stays untouched. Release builds must use the fresh checkout
  and satisfy the original strict receipt assertion against the Git baseline.
- The city uses actual provider footprints and native heights. Full-height
  masonry, windows, cornices and rooftop details share four draw batches.
  A meter-scaled wall material continues window coverage after the raised-pane
  geometry budget is reached, without additional tile requests or textures.
- Wall, window and trim depth are separated. Actual raised panes and the
  wall material use the same measured spacing, base and floor heights.
- Style generations prevent stale imports from attaching to a replacement
  map style. Exact surface ownership prevents late failures from removing a
  newer layer. Explicit retry changes a rejected module URL while ordinary
  idle checks do not retry or refetch provider data.
- A bilingual facade failure notice and explicit retry remain distinct from
  provider tile readiness. A complete tile load is not a pixel-quality claim.
- World/find reads and claims now wait for the same browser session bootstrap
  as other player actions. Claims retain their exact body and are sent once.

## Minor suggestions

The three detailed derivatives address the known G3, L85 and M1911 bindings.
They are not fifty-one new meshes and do not complete the entire weapon art
backlog. The retained rifle silhouettes remain stylized derivatives.

The complete build is source/geometry/transaction-boundary evidence. It does
not prove phone GPU performance, visible finger clearance, final English/Arabic
screen quality or sustained public connection availability.

## Next steps

1. Inspect the latest candidate in the separate in-app browser at its recorded
   desktop viewport and a 390 by 844 Arabic viewport.
2. Capture current City overview and close detail, the three representative
   weapon viewers, inventory thumbnails and equipped-character presentation.
3. Exercise map destinations and a normal player return without staff grants.
4. Complete the rendered review and any remaining independent release checks.
5. Request the specific frontend-only promotion approval, then publish to the
   existing team-auraa project and canonical URL. Do not alter the VPS or login.
