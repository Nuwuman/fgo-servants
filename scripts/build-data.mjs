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

const TARGET = { self: 'Self', ptOne: '1 ally', ptAll: 'Party', ptFull: 'Party (all)', ptOther: 'Other allies',
  ptOtherFull: 'Other allies (all)', ptOneOther: '1 other ally', ptRandom: 'Random ally', enemy: '1 enemy',
  enemyAll: 'All enemies', commandTypeSelfTreasureDevice: 'Self', fieldOther: 'Field' };
const LABEL = { gainNp: 'NP Charge', gainStar: 'Gain Critical Stars', gainHp: 'Restore HP', hastenNpturn: 'Charge Increase',
  delayNpturn: 'Charge Decrease', lossNp: 'NP Reduction', lossHpSafe: 'HP Reduction', lossStar: 'Critical Stars Reduction',
  subState: 'Remove Effects', shortenSkill: 'Skill Cooldown Reduction', cardReset: 'Reset Command Cards',
  gainNpFromTargets: 'NP Drain', gainNpIndividualSum: 'NP Charge', gainNpBuffIndividualSum: 'NP Charge',
  gainNpTargetSum: 'NP Charge', gainMultiplyNp: 'NP Multiply', absorbNpturn: 'Charge Drain', moveState: 'Effect Transfer' };
const SKIP = /^(eventDropUp|eventPointUp|servantFriendshipUp|none|displayBuffstring|transformServant)/;
const FLAT = new Set(['guts', 'regainStar', 'regainHp', 'upChagetd', 'addMaxhp', 'subSelfdamage', 'reduceHp', 'upFuncHpReduce', 'addIndividuality', 'fieldIndividuality', 'shortenSkillAfterUseSkill']);
const NO_VALUE = new Set(['hastenNpturn', 'delayNpturn', 'shortenSkill', 'gainStar', 'gainHp', 'lossHpSafe', 'lossStar', 'cardReset']);
const JP = /[぀-ヿ一-鿿]/;
const num = (x) => String(Math.round(x * 10) / 10);

// Un efecto de skill -> { tg, n, t, v: [valor por nivel] } (v colapsa a 1 si es constante).
const effect = (f) => {
  const b = f.buffs?.[0];
  let n = b?.name || LABEL[f.funcType] || (JP.test(f.funcPopupText) ? '' : f.funcPopupText);
  if (!n || JP.test(n)) n = b?.type?.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) ?? f.funcType;
  const hundred = ['gainNp', 'lossNp', 'gainMultiplyNp'].includes(f.funcType) || b?.type === 'regainNp';
  const val = (sv) => {
    if (sv.Value == null || /Function|CardType/.test(b?.type ?? '')) return '';
    if (b ? FLAT.has(b.type) : NO_VALUE.has(f.funcType)) return num(sv.Value);
    return num(hundred ? sv.Value / 100 : sv.Value / 10) + '%';
  };
  const tag = (sv) => [sv.Turn > 0 && `${sv.Turn}T`, sv.Count > 0 && `${sv.Count}×`, sv.Rate < 1000 && `${num(sv.Rate / 10)}% chance`].filter(Boolean).join(', ');
  const tags = f.svals.map(tag), same = tags.every((t) => t === tags[0]);
  const v = f.svals.map((sv, i) => (val(sv) + (same || !tags[i] ? '' : ` (${tags[i]})`)).trim() || '—');
  return { tg: TARGET[f.funcTargetType] ?? f.funcTargetType, n, t: same ? tags[0] : '', v: v.every((x) => x === v[0]) ? [v[0]] : v };
};

// De cada slot de skill, la versión más reciente (mayor priority).
const latest = (list = [], pick) => Object.values(
  list.reduce((acc, s) => ((!acc[s.num] || acc[s.num].priority <= s.priority) && (acc[s.num] = s), acc), {})
).map(pick);

const skillOf = (k) => ({ name: k.name, icon: k.icon, cd: k.coolDown?.[0] ? k.coolDown : undefined,
  fx: k.functions.filter((f) => !SKIP.test(f.funcType) && f.svals?.length).map(effect) });

// Las append skills son casi idénticas entre servants: se guardan una vez y cada servant lleva índices.
const appendSkills = [];
const appendRef = (k) => {
  const json = JSON.stringify(skillOf(k)), i = appendSkills.findIndex((x) => JSON.stringify(x) === json);
  return i >= 0 ? i : appendSkills.push(JSON.parse(json)) - 1;
};

const servants = raw
  .filter((s) => s.collectionNo > 0 && PLAYABLE.has(s.type))
  .map((s) => ({
    id: s.id,
    no: s.collectionNo,
    name: s.name,
    cls: s.className,
    cid: s.classId,
    rarity: s.rarity,
    face: s.extraAssets?.faces?.ascension?.['1'] ?? s.extraAssets?.faces?.ascension?.['0'],
    art: s.extraAssets?.charaGraph?.ascension?.['1'],
    skills: latest(s.skills, skillOf),
    passives: s.classPassive.map(skillOf),
    ap: s.appendPassive.map((p) => appendRef(p.skill)),
    asc: steps(s.ascensionMaterials),
    skill: steps(s.skillMaterials),
    append: steps(s.appendSkillMaterials),
  }))
  .sort((a, b) => a.no - b.no);

writeFileSync('data/servants.json', JSON.stringify({ items, appendSkills, servants }));
console.log(`${servants.length} servants, ${Object.keys(items).length} items, ${appendSkills.length} append variants`);
