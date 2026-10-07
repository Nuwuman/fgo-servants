# FGO Servant Materials

Static site: every playable servant (JP server, English names), their skills, and the total materials/QP for any ascension, skill and append-skill range.

Data comes from the [Atlas Academy API](https://api.atlasacademy.io/docs).

- `npm`-free: `node scripts/build-data.mjs` regenerates `data/servants.json` (Node 18+).
- Serve the folder with any static server (e.g. `python -m http.server`) and open `index.html`.
