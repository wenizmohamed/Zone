# Browser vector-tile decoder provenance

Retrieved from the official npm registry on 2026-10-13. These are the runtime
ES-module sources, not a new framework or package installation. No package-lock
or package dependency changes are required. The only runtime import change is
the vector-tile package's point-geometry specifier resolving to the neighboring
vendored module. Source files have a normalized final newline.

| File | Canonical package | License | Raw bytes | Delivered SHA-256 |
| --- | --- | --- | ---: | --- |
| vector-tile.mjs | @mapbox/vector-tile 3.0.0 | BSD-3-Clause | 10330 | cae3433ee2683df2f549bb187600f754c3b88c4a25ff62331d51cb7f64dfdc16 |
| pbf.mjs | pbf 5.1.2 | BSD-3-Clause | 24640 | 504bed430a7393931efac7530ce0b84040bc1357dee432eee5c4f80954b8a3fc |
| point-geometry.mjs | @mapbox/point-geometry 1.1.0 | ISC | 8556 | 7d0b1f23e8590118932b3bc0275d0bbc2ca08de464cea5d9a20367bb038bcffb |

Total runtime decoder source: 43,526 bytes before transport compression.
All three complete license notices are retained in LICENSES.txt.

Canonical archives:

- [@mapbox/vector-tile 3.0.0](https://registry.npmjs.org/@mapbox/vector-tile/-/vector-tile-3.0.0.tgz)
- [pbf 5.1.2](https://registry.npmjs.org/pbf/-/pbf-5.1.2.tgz)
- [@mapbox/point-geometry 1.1.0](https://registry.npmjs.org/@mapbox/point-geometry/-/point-geometry-1.1.0.tgz)

The library licenses do not license provider map data. Mapbox geometry is fetched
through the existing provider token for display in the active map only. Nothing
in this vendor directory is a persistent Mapbox tile extract or offline dataset.
