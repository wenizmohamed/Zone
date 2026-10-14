# Weapon presentation repair, visual98

The game has 51 registered weapon IDs in nine presentation categories, now resolved to 51 distinct displayed models. These are not 51 newly downloaded PBR weapons. Ten detailed GLBs retain their original surface maps, three source-textured models explicitly disclose AI-assisted generation, and 38 entries remain honestly labeled stylized Quaternius meshes. All 40 numbered variants remain distinct. Two representative numbered entries have authorized detailed source upgrades; the other 38 retain their exact original OBJ mapping. Original catalog price, damage, item IDs, authored scale/grip fields and engine rules remain unchanged. The shared presentation loader alone maps the eight selected canonical IDs to their measured replacement assets.

## Causes addressed

1. Family-wide premium substitution had reduced every revolver variant to one Detective Special and every AK variant to one AKM. Numbered variants now keep their own authored meshes.
2. The material converter forced almost every non-wood part to at least 0.72 metalness. Black/polymer parts now retain their registered material properties separately from steel, wood and glass.
3. Metal reflects its environment. The studio's nearly black reflection background made dark barrels disappear even under a bright key light. A neutral-gray softbox surround and bounded hemispheric fill improve readable silhouette contrast without changing source materials or geometry.
4. The 424-model source archive chose a low-detail orange Kenney prop first. It now opens a 29-model modern textured subset on the existing M4A1; the complete archive remains selectable.
5. Shared fallback aliases such as rifle and smg_c checked only procedural models and silently displayed a revolver. They now resolve against the registered catalog too. Unregistered model keys display an explicit unavailable state instead of a different weapon.
6. Game rows can use 51 small real-mesh-derived SVGs rather than a repeated knife icon. These preserve measured silhouettes. They are technical mesh renders, not photographs or baked PBR images.
7. Canonical Makarov, pump shotgun, Grease Gun, scoped rifle and M4A1 now use matching retained 3DModelsCC0 source GLBs. The assembled Makarov display excludes only the source's separately detached Magazine node; its original GLB bytes remain unchanged.
8. Combat attached normalized detailed models using raw source grip coordinates a second time. It now uses the loaded object's normalized gripPoint, axis and forward metadata, matching the character viewer. A regression executes the actual combat loadActor function with the real nonzero-grip pump shotgun.

## Selected canonical source upgrades

All viewer query suffixes below attach to `/dist/weapon3d.html` on the existing candidate server at `http://127.0.0.1:4315`. Add `&lang=ar` for Arabic. `poster=1` stops automatic orbit for stable inspection.

| Game ID and query | Actual retained source | Displayed triangles | Source maps | Physical length |
| --- | --- | ---: | --- | ---: |
| `?item=pistol_t&poster=1` | 3DModelsCC0 Makarov | 3,821, excluding loose magazine | Color, normal, packed metallic/roughness | 16.8 cm |
| `?item=shotgun&poster=1` | 3DModelsCC0 pump shotgun | 1,740 | Color, normal, packed metallic/roughness | 106.1 cm |
| `?item=smg&poster=1` | 3DModelsCC0 Grease Gun | 7,721 | Color, normal, packed metallic/roughness | 62.7 cm |
| `?item=sniper&poster=1` | 3DModelsCC0 scoped rifle | 4,808 | Color, normal, packed metallic/roughness | 108.3 cm |
| `?item=assaultrifle_1&poster=1` | 3DModelsCC0 M4A1 | 9,236 | Color, normal, packed metallic/roughness | 85.9 cm |
| `?item=magnum&poster=1` | Polyy.AI Six-Shot Revolver | 6,956 | Color and packed metallic/roughness, no normal map | 32.1 cm |
| `?item=sawedoff&poster=1` | Polyy.AI Sawed-Off Double-Barrel | 3,299 | Color and packed metallic/roughness, no normal map | 45.7 cm |
| `?item=bullpup_1&poster=1` | Polyy.AI Bullpup Rifle | 8,067 | Color and packed metallic/roughness, no normal map | 65.3 cm |

The existing five hero models, bat, revolver, AKM, derringer and M9, remain unchanged. All eight replacements use original retained geometry and images, with display-only uniform scale, rotation and measured grip normalization.

3DModelsCC0 primary source: https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack. Its five retained runtime GLBs and full author/download/byte provenance are already in `library/manifest.json`, with source evidence in `library/sources.json` and full CC0 legal text in `library/LICENSE-CC0-1.0.txt`.

Polyy.AI primary source: https://polyyai.itch.io/3d-low-poly-guns-pack. The author discloses generated graphics. The original LICENSE.txt identifies CC0 and clarifies that the unmodified-pack resale request is not a legal condition. The complete author license and README are retained alongside selected source GLBs in `premium/polyy-low/3D_low_poly_guns_pack_low/`; `premium/polyy-low/source.json` records original model bytes, SHA256, source upload, archive hash, disclosure and absence of a normal map. The fictional game's magnum category does not assert a real-world caliber.

## Grip and rig evidence, with its limits

Every new canonical grip was tested against the actual source triangles from both side directions, then normalized to the attachment origin. All three real Quaternius rigs retain a centered socket, canonical muzzle direction and controlled roll. Camera fitting is tested at desktop and two phone aspect ratios. The complete 51-model pose matrix exercises 8,415 samples while preserving original arm lengths, lower-body animation and the existing bat profile.

Measured real grip widths: Makarov 23.29 mm, pump 27.12 mm, Grease Gun 22.64 mm, scoped rifle 27.19 mm, M4A1 17.53 mm, magnum 46.91 mm, sawed-off 63.08 mm, bullpup 43.80 mm. **Full finger-skin clearance for the larger gun handles is unproven.** A centered socket is not a collision-clearance proof. A diagnostic blend toward the authored Idle finger quaternions did not enlarge the real skin cavity, so no blind finger pose change was shipped. Original finger/rig/rest-pose files were not modified.

## Game integration API

The existing classic-script catalog exports `zoneWeaponThumbnail(itemKey, optionalModelKey)`. It returns a local retained SVG URL or null. The optional model key supports owner-created items which refer to an existing registered weapon model. Unknown, prototype and path-like keys return null. `ZONE_WEAPON_THUMBNAILS` is a frozen map of all 51 known URLs.

`resolveWeaponAsset(key, catalog)` continues to own mesh/grip/scale resolution and now supplies category and thumbnail metadata. A failed detailed request which falls back to a real catalog mesh exposes the fallback's actual model ID, author, license, quality and thumbnail rather than retaining hero credits.

## Inspection URLs and controls

Use the existing local candidate at port 4315. No production URL was changed by this worker.

| Category | Item viewer query | Game IDs covered |
| --- | --- | ---: |
| Revolver | `?item=revolver_3&lang=en` | 7 |
| Pistol | `?item=pistol_4&lang=en` | 8 |
| Shotgun | `?item=shotgun_2&lang=en` | 8 |
| SMG | `?item=submachinegun_3&lang=en` | 6 |
| AK rifle | `?item=assaultrifle2_3&lang=en` | 5 |
| Assault rifle | `?item=assaultrifle_4&lang=en` | 5 |
| Bullpup | `?item=bullpup_2&lang=en` | 3 |
| Sniper | `?item=sniperrifle_6&lang=en` | 7 |
| Melee | `?item=bat&lang=en` and `?item=knife&lang=en` | 2 |

The query suffixes above attach to `/dist/weapon3d.html`. Add `poster=1` for a stable non-rotating technical inspection. The existing OBJ/material ZIP and GLB export buttons remain available. Arrow, zoom and Home controls are preserved.

`/dist/weapon-library.html` opens the modern textured source selection. Its Collection control switches between the modern subset and Complete source archive. A deep link such as `?collection=all&model=30-unique-lowpoly-swords-cc0-swordtember2022--1-crystal&lang=ar` still opens a retained advanced source asset. Filtering, retry and rapid-selection disposal remain covered.

## Machine-readable evidence

`runtime-coverage.json` measures every game weapon's mesh, triangle count, material properties, source image count, bounds, units, scale and grip, with source-file and derived-thumbnail SHA256 values. It records the eight authorized canonical mappings, Makarov display-node exclusion, and explicit AI-assisted/two-map metadata. Source model bytes and geometry are unchanged. All 51 thumbnails are generated from actual decoded meshes, not filename counts.

The loaded item viewer exposes `three-d-stage.dataset.zoneAsset` with requested key, resolved key, category, actual shown descriptor and mesh/material/map inspection. `zoneAssetState` reports loading, ready or error. `zoneAssetError` identifies unsupported model input. `zoneFrame` measures the camera aspect and projected bounding-box extents; `zoneLighting` exposes the neutral-softbox profile.

The source library exposes body datasets `zoneLibraryState`, `zoneLibraryCollection`, `zoneLibraryCount`, `zoneLibraryShown`, `zoneLibraryModel`, `zoneLibraryInspection` and `zoneRendererStats`. Measurements come from the actual loaded object.

## Proving command

`node --test scripts/test-viewer-runtime.mjs scripts/test-weapon-assets.mjs scripts/test-weapon-quality.mjs scripts/test-weapon-library.mjs scripts/test-character-poses.mjs scripts/test-character-art.mjs scripts/test-combat-presentation.mjs`

Latest complete worker run: **117 tests, 117 passed, 0 failed, 0 skipped, exit 0**. The tests decode all 424 source geometries, load and frame every registered OBJ game weapon, validate all 51 source-derived thumbnails, preserve asynchronous cancellation and resource ownership, inspect all 13 detailed/source-textured hero models, execute actual normalized combat attachment and retain export behavior. The added badge-layout regression preserves visible credits and exports, places narrow-screen credits above actual wrapped EN/AR toolbar bounds and retains the desktop placement. Root's fresh Arabic 375 px browser check measured 7.9985 px of clearance with no overlap and an unclipped frame, captured at `../../artifacts/visual98-20261013/armory-ar-phone-release.png`. Existing MODULE_TYPELESS_PACKAGE_JSON warnings remain visible; no package setting was changed to hide them.

Browser rendering and final screenshot acceptance belong to the root integration review. A passing geometry/framing test is not a claim that every asset is photorealistic or every final viewport has been visually approved.
