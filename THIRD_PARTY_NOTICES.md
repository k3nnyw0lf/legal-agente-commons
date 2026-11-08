# Third-party libraries

These libraries are copied into the repo at a fixed version. Each keeps its own license.

| Library | Version | Where | License | Notes |
|---|---|---|---|---|
| postal-mime | 4.1.4 | `src/vendor/postal-mime-4.1.4/` | MIT No Attribution (MIT-0) | License text included (`LICENSE.txt`). |
| @simplewebauthn/server | 14.0.3 | `src/vendor/simplewebauthn-server-14.0.3/` | MIT | Bundled into one file; bundled dependencies and their licenses are listed in `README.txt`. License text included. |
| @simplewebauthn/browser | 14.0.0 | `public/vendor/simplewebauthn-browser-14.0.0/` | MIT | License text included. |
| PDF.js (pdfjs-dist) | 6.5.438 | `public/vendor/pdfjs-6.5.438*` | Apache-2.0 | Header kept in the files. Font and WebAssembly decoder licenses are in `standard_fonts/` and `wasm/`. |
| pdf-lib | 1.17.1 | `public/vendor/pdf-lib-1.17.1.min.js` | MIT | Also used by `scripts/build-sample.mjs`. |
| Apache ECharts | 5.5.1 | `public/vendor/echarts-5.5.1.min.js` | Apache-2.0 | Header kept in the file. |
| vis-timeline | 7.7.3 | `public/vendor/vis-timeline-7.7.3.min.*` | Apache-2.0 or MIT (dual) | Header kept in the file. |
| force-graph | 1.52.0 | `public/vendor/force-graph-1.52.0.min.js` | MIT | |
| MiniSearch | 7.2.0 | `public/vendor/minisearch-7.2.0.umd.js` | MIT | |
| wavesurfer.js | 8.0.5 | `public/vendor/wavesurfer-8.0.5.min.js` | BSD-3-Clause | |
| qrcode-generator | 1.4.4 | `public/vendor/qrcode-generator-1.4.4.js` | MIT | Header kept in the file. |
| Tesseract.js | 5.1.1 | loaded from cdn.jsdelivr.net at runtime, only when a scan is read | Apache-2.0 | Not copied here yet. Should be vendored like the others. |

**To do before publishing:** add the full license text files for force-graph, MiniSearch, wavesurfer.js and pdf-lib next to their files (the minified files do not all carry their license header), and the Apache ECharts `NOTICE`. Copy them from each project's official release, at the same version.
