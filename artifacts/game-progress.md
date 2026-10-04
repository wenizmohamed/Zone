# ZONE game presentation correction

Date: 4 October 2026

## User correction
The earlier graphite/lime card layout was rejected. The requested direction is a rich browser crime RPG with compact Torn-inspired navigation, clear character and equipment presence, licensed 3D assets and meaningful reuse of the acquired OpenPBBG modules.

## Art direction
Charcoal and worn metal, restrained brass, separate resource colors, sharp compact panels, authored game symbols, illustrated scene headers. Character models use real clothed meshes with original animations. Territory ownership remains authoritative; visual city composition never changes interaction geometry.

## Work lanes
- Shared shell and all routes: index.html, assets/zone-design.css, admin.css.
- District composition: dist/city-map-torn.html, city-landmarks.js, city-layout.js.
- Existing module integration: real daily objectives, achievements, notifications and dossier APIs, with original GL2 card sprite and MIT notice.
- Character and provenance: three CC0 Quaternius wardrobe rigs, viewer lighting and materials, asset manifest and credits.

## Rendered checkpoints
- New character rig loaded in the Home view. Suit selection confirmed 24 animations, 8,562 rendered triangles.
- Initial blank navigation icons diagnosed as relative custom-property URLs resolved against external CSS. Corrected to origin-root URLs; fresh browser screenshot confirmed colored symbols and scene strips.
- First city density checkpoint exposed only three test cells and left other holdings blank. Full visible-cell coverage requested before release.

## Release gate
Capture fresh desktop and Arabic phone output, verify wardrobe changes, weapon controls, faction selection, territory detail and module actions. Run applicable tests and full build. Deploy through the existing project pipeline, verify exact live version and rendered changes. Final findings are recorded in the delivery report.
