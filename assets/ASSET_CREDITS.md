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

## Detailed weapon models (2026-10-04)

Five CC0 models by LonesomeDucky and khairul169. See [weapon provenance and original sources](weapons/premium/CREDITS.md). Static GLB conversion, browser texture optimization and character grip fitting by ZONE. Original geometry and authored PBR surface maps retained.
