// Comprobación rápida de los datos generados: node scripts/check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { items, expCurves, grail, servants } = JSON.parse(readFileSync('data/servants.json'));
const ces = JSON.parse(readFileSync('data/ces.json'));

assert(servants.length > 400 && ces.length > 2000, 'faltan servants o CEs');
assert.equal(new Set(servants.map((s) => s.id)).size, servants.length, 'ids repetidos');
for (const s of servants) {
  assert(s.skills.length === 3 && s.face && s.art && s.np, `${s.name}: datos incompletos`);
  assert(expCurves[s.exp].length >= s.lvs.at(-1)[0], `${s.name}: curva de EXP corta`);
  assert(grail[s.rarity], `${s.name}: sin tabla de gríal`);
}
assert(items[1] && items[7999], 'faltan QP o Holy Grail');
const altria = servants.find((s) => s.no === 2); // valores conocidos del juego
assert.equal(expCurves[altria.exp][89], 12148500, 'EXP 1→90 de un 5★');
console.log(`ok: ${servants.length} servants, ${ces.length} CEs`);
