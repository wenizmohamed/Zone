# Retained upstream modules

All 131 files under the 25 `source/` directories byte-match the acquired `ChristopherDay_Gangster-Legends-V2.zip` archive, SHA-256 `b9162265de7e0350553db48b33fdc8549accef6c8358bd5e1fcb721d90ba7db7`. The archive contains `Gangster-Legends-V2-master/LICENSE`, retained unmodified here as `LICENSE.GL2.txt` (MIT, copyright 2014 Christopher Day).

Source: https://github.com/ChristopherDay/Gangster-Legends-V2

The manifests and ZONE wrapper classes are integration code. Registered/imported does not imply a runnable feature: wrappers do not execute retained legacy handlers. Current ZONE services separately implement 13 gated gameplay modules. Achievements has a live event subscriber. Fourteen imported packages still require ports; their `module`, `User`, `Items`, hooks and legacy MySQL table contracts are not present in the current runtime.

The original blackjack card sprite is also copied unchanged to `assets/modules/gl2/cards.png`, beside its MIT notice, for the current game card display. This does not add legacy Hit/Stand behavior to the existing rank-based Higher/Lower game.

Detailed file hashes and archive entries: `docs/analysis/module-reuse-20261004/archive-provenance.json`.
