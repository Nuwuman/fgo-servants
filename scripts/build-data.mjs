// Descarga el volcado JP (en inglés) de Atlas Academy y lo reduce a data/servants.json.
import { writeFileSync } from 'node:fs';

const URL = 'https://api.atlasacademy.io/export/JP/nice_servant_lang_en.json';
const PLAYABLE = new Set(['normal', 'heroine']);

const raw = await (await fetch(URL)).json();
const items = {};

// Pasos de materiales -> [{ i: [[itemId, cantidad]], qp }], indexados por nivel de origen.
const steps = (m = {}) => Object.keys(m).sort((a, b) => a - b).map((k) => {
  for (const { item } of m[k].items) items[item.id] ??= { name: item.name, icon: item.icon };
  return { i: m[k].items.map(({ item, amount }) => [item.id, amount]), qp: m[k].qp };
});

// De cada slot de skill, la versión más reciente (mayor priority).
const latest = (list = [], pick) => Object.values(
  list.reduce((acc, s) => ((!acc[s.num] || acc[s.num].priority <= s.priority) && (acc[s.num] = s), acc), {})
).map(pick);

const servants = raw
  .filter((s) => s.collectionNo > 0 && PLAYABLE.has(s.type))
  .map((s) => ({
    id: s.id,
    no: s.collectionNo,
    name: s.name,
    cls: s.className,
    rarity: s.rarity,
    face: s.extraAssets?.faces?.ascension?.['1'] ?? s.extraAssets?.faces?.ascension?.['0'],
    skills: latest(s.skills, (k) => ({ name: k.name, detail: k.detail, icon: k.icon })),
    asc: steps(s.ascensionMaterials),
    skill: steps(s.skillMaterials),
    append: steps(s.appendSkillMaterials),
  }))
  .sort((a, b) => a.no - b.no);

writeFileSync('data/servants.json', JSON.stringify({ items, servants }));
console.log(`${servants.length} servants, ${Object.keys(items).length} items`);
