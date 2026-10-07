# FGO Servant Materials

Static site with every playable servant (JP server, English names) and every Craft Essence: skills with per-level values, command cards, Noble Phantasm, ATK/HP, and the total EXP, grails, QP and materials for any level, ascension, skill and append-skill range.

Data comes from the [Atlas Academy API](https://api.atlasacademy.io/docs). Grail costs come from [chaldea-data](https://github.com/chaldea-center/chaldea-data) (Atlas does not publish them).

- `node scripts/build-data.mjs` regenerates `data/servants.json` and `data/ces.json` (Node 18+, no dependencies).
- `node scripts/check.mjs` sanity-checks the generated data.
- Serve the folder with any static server (e.g. `python -m http.server`) and open `index.html`.
