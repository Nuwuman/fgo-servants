// Descarga los volcados JP (en inglés) de Atlas Academy y los reduce a data/servants.json y data/ces.json.
import { writeFileSync } from 'node:fs';

const URL = 'https://api.atlasacademy.io/export/JP/nice_servant_lang_en.json';
const PLAYABLE = new Set(['normal', 'heroine']);

const raw = await (await fetch(URL)).json();
const items = {};

// Coste de gríal por rareza: [[qp, nivel máx. añadido acumulado], ...]. Atlas no lo publica; viene de los datos de Chaldea.
const grailRaw = (await (await fetch('https://raw.githubusercontent.com/chaldea-center/chaldea-data/main/dist/constData.json')).json()).svtGrailCost;
const grail = Object.fromEntries(Object.entries(grailRaw).map(([r, v]) => [r, Object.values(v).map((x) => [x.qp, x.addLvMax])]));
const g = await (await fetch('https://api.atlasacademy.io/nice/JP/item/7999?lang=en')).json();
items[g.id] = { name: g.name, icon: g.icon };

// Curvas de EXP acumulada: se guardan una vez y cada servant lleva el índice.
const expCurves = [];
const curveRef = (c) => {
  const i = expCurves.findIndex((x) => x.join() === c.join());
  return i >= 0 ? i : expCurves.push(c) - 1;
};

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
  gainNpTargetSum: 'NP Charge', gainMultiplyNp: 'NP Multiply', absorbNpturn: 'Charge Drain', moveState: 'Effect Transfer',
  damageNp: 'NP Damage', damageNpPierce: 'NP Damage (Ignore DEF)', damageNpIndividual: 'NP Damage (Special)',
  damageNpIndividualSum: 'NP Damage (Special)', damageNpStateIndividualFix: 'NP Damage (Special)',
  damageNpHpratioLow: 'NP Damage (More at Low HP)', damageNpRare: 'NP Damage (Special)' };
const SKIP = /^(eventDropUp|eventPointUp|servantFriendshipUp|none|displayBuffstring|transformServant)/;
const FLAT = new Set(['guts', 'regainStar', 'regainHp', 'upChagetd', 'addMaxhp', 'subSelfdamage', 'reduceHp', 'upFuncHpReduce', 'addIndividuality', 'fieldIndividuality', 'shortenSkillAfterUseSkill']);
const NO_VALUE = new Set(['hastenNpturn', 'delayNpturn', 'shortenSkill', 'gainStar', 'gainHp', 'lossHpSafe', 'lossStar', 'cardReset']);
const JP = /[぀-ヿ一-鿿]/;
const num = (x) => String(Math.round(x * 10) / 10);

// Un efecto de skill -> { tg, n, t, v: [valor por nivel] } (v colapsa a 1 si es constante).
const effect = (f) => {
  const b = f.buffs?.[0];
  let n = b?.name || LABEL[f.funcType] || (JP.test(f.funcPopupText) ? '' : f.funcPopupText);
  if (!n || JP.test(n)) n = b?.type?.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) ?? f.funcType.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
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

const CARD = { 1: 'Arts', 2: 'Buster', 3: 'Quick' };
// NP más reciente (mayor priority): tipo de carta, objetivo del daño y efectos por nivel de NP (1-5).
const npOf = (list) => {
  const n = list.reduce((a, b) => (!a || b.priority >= a.priority ? b : a), null);
  if (!n) return undefined;
  const dmg = n.functions.find((f) => f.funcType.startsWith('damageNp'));
  return { name: n.name, rank: n.rank, card: CARD[n.card] ?? n.card, hits: n.npDistribution?.length,
    tg: !dmg ? 'Support' : dmg.funcTargetType === 'enemyAll' ? 'AoE' : 'Single target',
    fx: n.functions.filter((f) => !SKIP.test(f.funcType) && f.svals?.length).map(effect) };
};

const servants = raw
  .filter((s) => s.collectionNo > 0 && PLAYABLE.has(s.type))
  .map((s) => ({ s, lvMax: s.atkGrowth.indexOf(s.atkMax) + 1 })) // Mash: lvMax dice 80 pero su ATK máx. cae en el 70
  .map(({ s, lvMax }) => ({
    id: s.id,
    no: s.collectionNo,
    name: s.name,
    cls: s.className,
    cid: s.classId,
    rarity: s.rarity,
    lvMax,
    lvs: [...new Set([1, lvMax, 100, s.atkGrowth.length])].filter((l) => l <= s.atkGrowth.length).sort((a, b) => a - b)
      .map((l) => [l, s.atkGrowth[l - 1], s.hpGrowth[l - 1]]),
    exp: curveRef(s.expGrowth),
    face: s.extraAssets?.faces?.ascension?.['1'] ?? s.extraAssets?.faces?.ascension?.['0'],
    art: s.extraAssets?.charaGraph?.ascension?.['1'],
    deck: s.cards.map((c) => CARD[c] ?? c),
    hits: [1, 2, 3, 4].map((k) => s.hitsDistribution?.[k]?.length ?? 0),
    np: npOf(s.noblePhantasms),
    skills: latest(s.skills, skillOf),
    passives: s.classPassive.map(skillOf),
    ap: s.appendPassive.map((p) => appendRef(p.skill)),
    asc: steps(s.ascensionMaterials),
    skill: steps(s.skillMaterials),
    append: steps(s.appendSkillMaterials),
  }))
  .sort((a, b) => a.no - b.no);

writeFileSync('data/servants.json', JSON.stringify({ items, appendSkills, expCurves, grail, servants }));
console.log(`${servants.length} servants, ${Object.keys(items).length} items, ${appendSkills.length} append variants`);

// Craft Essences: cada skill con su versión base y la de límite máximo (si difieren).
const ceRaw = await (await fetch('https://api.atlasacademy.io/export/JP/nice_equip_lang_en.json')).json();
const ces = ceRaw.filter((e) => e.collectionNo > 0).map((e) => {
  const byNum = {};
  for (const k of e.skills) (byNum[k.num] ??= []).push(k);
  const sk = Object.values(byNum).map((vs) => {
    vs.sort((a, b) => a.priority - b.priority);
    const fx = (k) => k.functions.filter((f) => !SKIP.test(f.funcType) && f.svals?.length).map(effect);
    const base = fx(vs[0]), max = fx(vs.at(-1));
    return { name: vs.at(-1).name, base, max: JSON.stringify(base) === JSON.stringify(max) ? undefined : max };
  });
  return { id: e.id, no: e.collectionNo, name: e.name, rarity: e.rarity, atk: [e.atkBase, e.atkMax], hp: [e.hpBase, e.hpMax],
    face: e.extraAssets?.faces?.equip?.[e.id], art: e.extraAssets?.charaGraph?.equip?.[e.id], sk };
}).sort((a, b) => a.no - b.no);

writeFileSync('data/ces.json', JSON.stringify(ces));
console.log(`${ces.length} craft essences`);
