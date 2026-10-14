# ZONE asset credits

## Assets added in the 4 October 2026 visual overhaul

### City models
KayKit City Builder Bits 1.0 by **Kay Lousberg**. CC0 1.0 Universal.
Source: https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0
License included at `city/kaykit/LICENSE.txt`.
Selected models: building A, C, E, G without base; sedan; streetlight; water tower; bush.
The original glTF models, binary buffers, and shared texture are unmodified. Placement, scale, rotation and runtime material treatment are specific to ZONE. These cosmetic models do not define property ownership or gameplay geometry.

### Faction emblems
**Lorc**, available on **Game-icons.net**, licensed under **CC BY 3.0**.
Source repository: https://github.com/game-icons/icons
License: https://creativecommons.org/licenses/by/3.0/
- Sand Vipers: https://game-icons.net/1x1/lorc/snake.html
- Harbor Kings: https://game-icons.net/1x1/lorc/crown.html
- Night Market: https://game-icons.net/1x1/lorc/moon.html
- Old Guard: https://game-icons.net/1x1/lorc/checked-shield.html

Original SVG files are unmodified. ZONE applies sizing, clipping and CSS color treatment in the interface. These are mockup faction identities, not third-party organization logos.

### Renderer
Three.js 0.184.0, MIT, Three.js authors. License included at `../lib/three184/LICENSE`.
Official package: https://www.npmjs.com/package/three/v/0.184.0
Loader import specifiers were adjusted to use local vendored modules. Rendering library version matches the existing ZONE viewers.

## Game presentation correction, 4 October 2026

### Authored character wardrobe
**Quaternius**, Ultimate Modular Men Pack, CC0 1.0 Universal.
Official source: https://quaternius.com/packs/ultimatemodularcharacters.html
Original download: https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX
Included license: `character/quaternius/License.txt`.
Selected files: Casual_Hoodie, Suit, Swat. Each includes 24 original skeletal animations.
ZONE converts the original self-contained glTF files to binary GLB without changing geometry or animation. Runtime material colors, camera, lighting and weapon attachments are adapted for ZONE.

### Navigation and action icons
Icons made by **Lorc** and **Delapouite**, available on https://game-icons.net under **CC BY 3.0**.
All 19 exact author/source mappings are in `ui/icons/sources.json`.
Original SVG files are retained unchanged. ZONE uses their silhouettes as colored luminance masks and inline paths inside metallic navigation tiles.

### Gangster Legends V2 presentation assets and modules
**Christopher Day**, copyright 2014, MIT license.
Source: https://github.com/ChristopherDay/Gangster-Legends-V2
The original blackjack card sprite is retained unchanged at `modules/gl2/cards.png`, with its license alongside it. The Higher / Lower screen uses the sprite with ZONE's authoritative rank values. Original profile/daily structures inform the dossier, while current values come from the ZONE APIs. Imported source modules retain their MIT notice at `../engine/modules/LICENSE.GL2.txt`.

### Existing original ZONE illustrations
Scene strips and the alley masthead reuse the existing project artwork in `../art/`. No Torn artwork was copied into this release. Existing artwork is illustrative and does not describe engine state.

## Existing assets
The existing Quaternius weapon catalog remains in use. The earlier mannequin remains available in source assets for compatibility, but the character viewer now loads the three licensed wardrobe models above. Its unused embedded mannequin payload was removed.

The Mapbox basemap retains its own on-map attribution.

## Compact family district, 10 October 2026

The current family map (`../dist/city-map-torn.html`, renderer `city/compact-district.js`) streams genuine **Mapbox Streets v8** vector tiles using the existing Mapbox account token. Roads, parks, waterfront and building footprints come from that service. Available building heights come from its building features and are capped at 18 meters for readable game presentation; a missing height remains flat. The source is `mapbox://mapbox.mapbox-streets-v8`.

Source documentation: https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/
Mapbox attribution requirements: https://docs.mapbox.com/help/getting-started/attribution/
The native Mapbox attribution control remains visible and carries the provider's attribution, including OpenStreetMap where supplied. Mapbox tiles are accessed under the account's Mapbox service terms. They are not bundled or described as CC0 assets.

ZONE places its fictional game destinations over a 600 m district centered at longitude **-73.9865**, latitude **40.698**, near Brooklyn's waterfront. These destination labels represent game services, rather than claims about real businesses at those coordinates. One uniform, invertible WebMercator scale and translation projects the original 120 engine parcels, their centroids, game POIs and player location into this display. The server coordinates, polygon topology, parcel IDs, adjacency, ownership, action versions and player progress remain unchanged.

The overview prioritizes eight core game locations. Secondary icons appear at street detail and their labels at close zoom, with every published location retained in the game's location directory. Family emblems retain the author and CC BY 3.0 credits above. The former city raster and procedural atlas remain legacy source assets.

### Authored service landmarks

The optional tilted street view loads a bounded KayKit City Builder Bits 1.0 kit by **Kay Lousberg**, **CC0**. Original files and license are retained at `city/kaykit/`. Selected building A, C, E and G models, water tower, sedan and streetlight form five service scenes at the published bank, hospital, gym, market and faction HQ coordinates. Models are cosmetic fictional service representations, with adjusted scale, palette, lighting and original roof signs. They do not alter ownership, hit targets, engine coordinates or claims about real businesses. The map retains genuine source footprints. No procedural skyline, continuous landmark animation or shadow-map pass is added.

Primary source: https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0. Local license: `city/kaykit/LICENSE.txt`. Loaded files and hashes: `city/landmarks-provenance.json`.

### Original property artwork and combat cues

The seven property illustrations are original generated fictional ZONE environments, created with the built-in image generation tool on 10 October 2026. The unchanged atlas, exact prompt and tile provenance are retained at `../art/zone-property-atlas-v1.png`, `../art/zone-property-atlas-v1.prompt.txt` and `../art/zone-property-atlas-v1.provenance.json`. These illustrations carry no engine state or claim to depict actual properties.

The combat scene uses the licensed wardrobe and Poly Haven materials credited below. Its three original PCM cues are opt-in; the current engine emits hit and miss events, and no block is invented without an explicit server field. Scene and audio provenance are recorded at `ui/combat-assets.json`. Opponent appearance is explicitly representative because the engine does not publish opponent appearance or equipment.

## Detailed weapon models (2026-10-04)

Five CC0 models by LonesomeDucky and khairul169. See [weapon provenance and original sources](weapons/premium/CREDITS.md). Static GLB conversion, browser texture optimization and character grip fitting by ZONE. Original geometry and authored PBR surface maps retained.

## Crime wardrobe presentation (2026-10-05)

### Industrial portrait setting (2026-10-10)

Original ZONE floor, wall, structural supports and light fixture use photographed **Poly Haven** materials: **Brick Wall 04** by Dario Barresi, Dimitrios Savva and Rico Cilliers, and **Concrete Floor 02** by Rob Tuytel. Both are **CC0-1.0**. Six original 1k JPEG diffuse, OpenGL normal and roughness maps are bundled at `character/stage/`. Texture author records, source URLs, download URLs and SHA256 hashes are retained in `character/stage/PROVENANCE.json`. Materials use correct sRGB color textures and linear normal/roughness data. The setting preserves the existing wardrobe skeleton, animations, body vertices and weapon grip.

Primary sources: https://polyhaven.com/a/brick_wall_04, https://polyhaven.com/a/concrete_floor_02, https://polyhaven.com/license. Retrieved 10 October 2026. These are bundled assets; gameplay does not call the Poly Haven API.

The character viewer defaults to Quaternius' licensed **Suit** wardrobe. **Swat** and **Casual_Hoodie** remain selectable. Official pack and CC0 status verified against https://quaternius.com/packs/ultimatemodularcharacters.html on 5 October 2026. The original license remains at `character/quaternius/License.txt`.

ZONE's `../dist/character-presentation.js` adjusts only head-weighted vertices (local width/depth 90 percent, local height 82 percent), adds differentiated physical cloth, leather, skin, hair and visor materials, and stages the figure on a concrete portrait floor. Original body and hand vertices, skeleton, skin weights and all 24 clips remain intact. This is a stylized rigged character adaptation, not a scanned or photorealistic character. The original self-contained GLBs remain retained unchanged.

Weapon presentation labels distinguish the five authored PBR models from the stylized Quaternius catalog and simplified procedural previews. If a detailed file fails and a catalog fallback loads, the visible object's metadata credits the fallback's actual author and source. No prototype model is labelled as an authored PBR hero asset.

## Archived v98 weapon presentation (superseded by v99 below)

All 51 registered gameplay weapon IDs have explicit source descriptors, loaded geometry measurements and mesh-derived thumbnails. Forty numbered variants remain distinct, with only the representative M4A1 and bullpup mappings replaced by authorized matching detailed/source-textured models. The other 38 numbered variants retain their exact OBJ source mapping rather than being replaced wholesale with one repeated gun. The five detailed CC0 assets above remain available through their exact hero IDs. Eight additional selected canonical mappings remove the repeated legacy silhouettes; all 51 displayed models are now distinct. Prices, damage, item IDs, original authored catalog fields and engine rules are unchanged.

The static thumbnails at `weapons/thumbnails/` are original ZONE technical renders of the retained licensed meshes. Their materials use the registered surface colors, with mean embedded texture color for the detailed GLBs. They are not photographs, stock illustrations or baked PBR texture renders. Each SVG embeds source model identity, author, license and source-file SHA256. `weapons/runtime-coverage.json` records actual meshes, triangles, material properties, source image counts, physical units, measured runtime grip descriptors, canonical source replacements and source-generation disclosure. `weapons/render-thumbnails.mjs` reproduces these derived views without modifying source geometry or texture bytes.

The source-model browser opens the existing 29-model modern textured subset first, with a detailed M4A1 by 3DModelsCC0. The complete 424-model mixed-style CC0 archive remains selectable. Attribution and retained legal text for those original models remain at `weapons/library/CREDITS.md` and `weapons/library/LICENSE-CC0-1.0.txt`. Source models are not automatically balanced, equipped or aligned to the game character.

Inventory studio changes add a neutral reflection surround and bounded softbox/hemisphere lighting. Steel, polymer, wood and glass keep distinct registered physical properties. Ten game entries use original detailed PBR source maps, three explicitly disclose AI-assisted source textures, and 38 remain honestly labeled stylized. No collection-count claim is used as a rendered-quality claim.

### Additional retained detailed gun mappings

**3DModelsCC0**, Free CC0 Guns & Explosives Pack, **CC0-1.0**. Primary source: https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack. Retained GLB mirror: https://github.com/BoQsc/cc0-guns-explosives-pack-glb/releases/tag/0. Selected Makarov, Shotgun, Grease_Gun, Sniper and M4A1 models already reside at `weapons/library/models/`. Their exact author/source/download URLs, original and runtime SHA256, bytes, image dimensions and conversion provenance are retained in `weapons/library/manifest.json`; full license remains at `weapons/library/LICENSE-CC0-1.0.txt`. Original geometry and surface maps are unchanged. The runtime Makarov display excludes its separately detached Magazine node only, retaining the original complete GLB.

**Polyy.AI**, 3D Low-Poly Guns Pack, low-poly LOD edition, **CC0-1.0**, author-disclosed **AI-assisted/generated graphics**. Primary source: https://polyyai.itch.io/3d-low-poly-guns-pack. Selected Six-Shot Revolver, Sawed-Off Double-Barrel and Bullpup Rifle original GLBs are retained at `weapons/premium/polyy-low/3D_low_poly_guns_pack_low/models/`, with complete original `LICENSE.txt` and `README.txt` alongside. The license explicitly clarifies that the unmodified-pack resale request is not a legal condition. These three assets carry a base-color map and packed metallic/roughness map, **not a normal map**. `weapons/premium/polyy-low/source.json` records exact source bytes, SHA256, archive hash and disclosure. The fictional game magnum ID is a game-category mapping, not a source-supported real-world caliber assertion.

Display-only scale, orientation and measured grip normalization are specific to ZONE. Original model/texture bytes are retained unchanged. The eight replacement sources have verified solid grip points and centered transforms on all three original rigs, but full finger-skin clearance for their larger handle shapes is not established. No unmeasured finger or skeleton rewrite is claimed.

## Current v99 weapon presentation (2026-10-13)

The current game preserves all 51 weapon IDs and every engine stat. It explicitly maps those IDs to **20 real source models**, not 51 different meshes. The raw Quaternius OBJ pack and the Polyy AI-assisted models remain retained source/recovery assets but are not default gameplay presentation. Repeated fictional numbered variants are disclosed as source reuse. No repeated source, material variation or differently framed thumbnail is counted as a new authored mesh.

The accepted five models by LonesomeDucky and khairul169 retain their original GLB bytes, maps, physical scale and grip descriptors. Their original studio reflection background, exposure 1.04, environment intensity 0.8, fill 0.85 and no hemisphere illumination are restored. Other sources use a separate readable studio profile. A stage wrapper propagates actual source metadata to lighting selection. The bat has a diagonal pose in **thumbnail mode only**; normal viewer and character geometry/pose are unchanged.

Eight detailed firearms from **3DModelsCC0** provide distinct Makarov, Luger, AK47, M4A1, Grease Gun, Suomi KP, pump shotgun and scoped rifle silhouettes with retained color, normal and metallic/roughness maps. Primary author source and CC0 legal text: https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack. Original-source and runtime hashes remain in `weapons/library/manifest.json`. Makarov's loose Magazine and Luger's loose Clip are excluded from display only; their source GLBs are not edited.

**loafbrr_1**, Revolver Game Asset, CC0: https://opengameart.org/content/revolver-game-asset. The static runtime conversion selects seven actual gun parts, excluding scene ammunition and ground, and retains the author's real 1k Revolver_2 PBR maps. The fictional magnum category does not assert a source-unsupported real-world caliber.

**Tabasco**, Various Small Arms, released to public domain by the author on December 15, 2023: https://opengameart.org/content/various-small-arms-assault-rifles-sniper-pistol. The actual authored L85A1 bullpup, G3A3, M1911, Mosin 9130 and Dragunov geometry is retained. The original source contains color materials, not UV texture maps. ZONE explicitly replaces those pale colors with restrained blued metal and matte dark polymer. Wood surfaces use LonesomeDucky's verified retained CC0 bat color/normal maps with new projected UVs and a walnut stain factor. Labels distinguish **adapted physical materials** from **adapted CC0 textured surfaces**. These are ZONE surface adaptations, not original Tabasco colors/PBR, and are not photorealistic scans.

**JeanPFP**, Double Barrel Shotgun geometry, CC0: https://opengameart.org/content/double-barrel-shotgun. Its source packed atlas incorporates Textures.com photographs, so none of that original atlas or photographic source is redistributed in the runtime. The clean conversion replaces all original materials, projects new wood UVs, and samples the clean wood region of **LonesomeDucky's retained CC0 old bat base-color and normal maps**, credited at https://opengameart.org/content/old-wooden-baseball-bat. Steel uses an explicit physical material. This is declared as an adapted CC0 surface, not the original Jean PBR atlas. The compact game double-barrel representation is not claimed to be an exact real-world sawed-off replica.

The seven new clean GLBs, primary URLs, author/license records, original archive hashes and adaptation details are retained in `weapons/premium/v99/SOURCES.json`; full CC0 legal text is `weapons/premium/v99/LICENSE.txt`. Newly acquired raw archives, original Blend sources and uncertain photographic maps are preserved privately outside public asset roots. No downloaded embedded scripts were executed during conversion.

Current `.png` thumbnails are actual lossless 320 x 200 WebGL captures from the same loader, geometry, materials, framing and studio profile used by the item viewer. The old mesh-derived `.svg` previews are inactive recovery files. `weapons/runtime-coverage.json` links each game key to actual source bytes and capture diagnostics. Tests and model counts do not themselves certify visual quality. Measured solid grip surfaces, real rig socket alignment and canonical barrel axes do not claim full animated finger-skin clearance for every larger handle.
