const { items, appendSkills, expCurves, grail, servants } = await (await fetch('data/servants.json')).json();
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en');
let mode = 'svt', ces, curId; // ces se descarga al abrir la pestaña; curId = elemento abierto
const fresh = () => ({ lv: [1, 1], asc: [0, 0], s0: [1, 1], s1: [1, 1], s2: [1, 1], ap: [1, 1, 1] });
const plan = {}; // por servant.id: { lv:[a,b], asc:[a,b], s0:[a,b], s1, s2, ap:[a,b,n] }

// Todas las variantes de Beast (beastEresh, unBeastOlgaMarie…) entran en una sola categoría.
const group = (c) => (/^(beast|unBeast)/.test(c) ? 'beast' : c);

$('cls').append(...[...new Set(servants.map((s) => group(s.cls)))].sort().map((c) => new Option(c, c)));

// Marco por rareza (1 bronce, 2 plata, 3 oro) e icono de clase de Atlas; Beast Eresh (38) no tiene icono propio.
const tier = (s) => (s.rarity <= 2 ? 1 : s.rarity === 3 ? 2 : 3);
const clsIcon = (s) => `https://static.atlasacademy.io/JP/ClassIcons/class${tier(s)}_${s.cid === 38 ? 33 : s.cid}.png`;

const rows = () => (mode === 'svt' ? servants : ces);
const mark = (id) => {
  curId = id;
  $('list').querySelector('.on')?.classList.remove('on');
  $('list').querySelector(`[data-id="${id}"]`)?.classList.add('on');
};

// Búsqueda por efecto: cada palabra debe aparecer en el nombre o el objetivo de un mismo efecto
// (skills, pasivas y NP; las append skills son iguales para todos y solo meterían ruido).
const effectText = new WeakMap();
const effects = (s) => effectText.get(s) ?? (effectText.set(s, (s.sk
  ? s.sk.flatMap((k) => [...k.base, ...(k.max ?? [])])
  : [...s.skills, ...s.passives].flatMap((k) => k.fx).concat(s.np?.fx ?? [])).map((e) => `${e.n} ${e.tg}`.toLowerCase())), effectText.get(s));
const fxNames = new Set(servants.flatMap((s) => [...s.skills, ...s.passives].flatMap((k) => k.fx).concat(s.np?.fx ?? []).map((e) => e.n)));
const fillFx = () => { $('fxlist').replaceChildren(...[...fxNames].sort().map((n) => new Option(n))); };
fillFx();

const renderList = () => {
  const q = $('q').value.toLowerCase(), c = $('cls').value, r = $('rar').value, cd = $('card').value;
  const dir = $('sort').value === 'new' ? -1 : 1;
  const words = $('fx').value.toLowerCase().split(/\s+/).filter(Boolean);
  const svt = mode === 'svt';
  $('list').replaceChildren(...(svt ? servants : ces).toSorted((a, b) => dir * (a.no - b.no))
    .filter((s) => (!svt || !c || group(s.cls) === c) && (r === '' || s.rarity === +r) && (!svt || !cd || s.np?.card === cd)
      && s.name.toLowerCase().includes(q) && (!words.length || effects(s).some((t) => words.every((w) => t.includes(w)))))
    .map((s) => {
      const li = document.createElement('li');
      li.dataset.id = s.id;
      li.tabIndex = 0;
      li.classList.toggle('on', s.id === curId);
      li.innerHTML = `<span class="ic t${tier(s)}"><img loading="lazy" src="${s.face}" alt="">${svt ? `<img class="cls" loading="lazy" src="${clsIcon(s)}" alt="">` : ''}</span><div>${s.name}<small>No. ${s.no} · ${'★'.repeat(s.rarity)}</small></div>`;
      return li;
    }));
};

// Un solo manejador para toda la lista (hasta 2.706 filas); Enter/Espacio abren la fila enfocada.
const pick = (e) => {
  const li = e.target.closest('li');
  const s = li && rows().find((x) => x.id === +li.dataset.id);
  if (s) (mode === 'svt' ? select(s) : selectCe(s));
};
$('list').onclick = pick;
$('list').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } };

const setMode = async (m) => {
  mode = m;
  curId = undefined;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  $('cls').hidden = $('card').hidden = m !== 'svt';
  $('detail').innerHTML = '<p class="hint">Loading…</p>';
  if (m === 'ce' && !ces) {
    ces = await (await fetch('data/ces.json')).json();
    ces.forEach((e) => e.sk.forEach((k) => [...k.base, ...(k.max ?? [])].forEach((x) => fxNames.add(x.n))));
    fillFx();
  }
  $('detail').innerHTML = `<p class="hint">Pick a ${m === 'svt' ? 'servant' : 'craft essence'}.</p>`;
  renderList();
};
document.querySelectorAll('nav button').forEach((btn) => { btn.onclick = () => { history.replaceState(null, '', location.pathname); setMode(btn.dataset.m); }; });

// Enlace compartible: #m=svt&id=100100&lv=1-90&s0=1-10 (solo lo que difiere del valor por defecto).
const BOUNDS = { lv: [1, 120], asc: [0, 4], s0: [1, 10], s1: [1, 10], s2: [1, 10], ap: [1, 10] };
const save = (s, p) => {
  const h = new URLSearchParams({ m: mode, id: s.id });
  if (p) for (const [k, v] of Object.entries(p)) if (v.join() !== fresh()[k].join()) h.set(k, v.join('-'));
  history.replaceState(null, '', '#' + h);
};
const restore = async () => {
  const h = new URLSearchParams(location.hash.slice(1)), m = h.get('m') === 'ce' ? 'ce' : 'svt';
  if (!h.get('id')) return;
  await setMode(m);
  const s = rows().find((x) => x.id === +h.get('id'));
  if (!s) return;
  if (m === 'svt') {
    const p = plan[s.id] = fresh(), clamp = (n, [lo, hi]) => Math.min(hi, Math.max(lo, n || lo));
    for (const [k, b] of Object.entries(BOUNDS)) {
      const v = (h.get(k) ?? '').split('-').map(Number);
      if (v.length >= 2) p[k] = [clamp(v[0], b), clamp(v[1], b), ...(k === 'ap' ? [clamp(v[2] ?? 1, [0, 5])] : [])].slice(0, k === 'ap' ? 3 : 2);
      if (p[k][0] > p[k][1]) p[k][1] = p[k][0];
    }
    select(s);
  } else selectCe(s);
  $('list').querySelector('.on')?.scrollIntoView({ block: 'center' });
};
window.onhashchange = restore;

const fxLine = (e) => `<li>${e.n}: <b>${e.v.length > 1 ? e.v.join(' / ') : e.v[0]}</b><small> · ${e.tg}${e.t ? ' · ' + e.t : ''}</small></li>`;
function selectCe(e) {
  mark(e.id);
  save(e);
  const sk = e.sk.map((k) => `<div class="ce-skill"><b>${k.name}</b>
    <div><small>${k.max ? 'Base' : 'Effect'}</small><ul>${k.base.map(fxLine).join('')}</ul></div>
    ${k.max ? `<div><small>Max limit break</small><ul>${k.max.map(fxLine).join('')}</ul></div>` : ''}</div>`).join('');
  $('detail').onchange = null;
  $('detail').innerHTML = `
    <div class="banner"><img src="${e.art}" alt=""><div><h2>${e.name}</h2><small>No. ${e.no} · ${'★'.repeat(e.rarity)}</small></div><button class="copy" type="button">Copy link</button></div>
    <h3>Stats</h3><table><thead><tr><th></th><th>Base</th><th>Max</th></tr></thead><tbody>
      <tr><td>ATK</td><td>${fmt(e.atk[0])}</td><td>${fmt(e.atk[1])}</td></tr>
      <tr><td>HP</td><td>${fmt(e.hp[0])}</td><td>${fmt(e.hp[1])}</td></tr></tbody></table>
    <h3>Effects</h3>${sk}`;
}

// Suma los pasos steps[from-base .. to-base-1] (from/to = niveles/etapas objetivo).
const sum = (steps, from, to, base, mult = 1, acc = { qp: 0, i: {} }) => {
  for (const st of steps.slice(from - base, to - base)) {
    acc.qp += st.qp * mult;
    for (const [id, n] of st.i) acc.i[id] = (acc.i[id] ?? 0) + n * mult;
  }
  return acc;
};

const range = (name, max, min, [a, b]) => {
  const opt = (v) => Array.from({ length: max - min + 1 }, (_, k) => min + k)
    .map((n) => `<option ${n === v ? 'selected' : ''}>${n}</option>`).join('');
  return `<select data-k="${name}" data-p="0">${opt(a)}</select> → <select data-k="${name}" data-p="1">${opt(b)}</select>`;
};

function select(s) {
  mark(s.id);
  const p = plan[s.id] ??= fresh();
  const tbl = (fxs, labels) => `<div class="scroll"><table><thead><tr><th>Level</th>${labels.map((l) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${fxs.map((e) => `<tr><td>${e.n}<small> · ${e.tg}${e.t ? ' · ' + e.t : ''}</small></td>${e.v.length > 1
    ? e.v.map((v) => `<td>${v}</td>`).join('') : `<td colspan="${labels.length}" class="c">${e.v[0]}</td>`}</tr>`).join('')}</tbody></table></div>`;
  const levels = Array.from({ length: 10 }, (_, n) => n + 1);
  const skill = (k) => `<div class="skill"><img src="${k.icon}" alt=""><div><b>${k.name}</b>
    ${k.cd ? `<small> · CD ${k.cd[0]}${k.cd[9] !== k.cd[0] ? '→' + k.cd[9] : ''}</small>` : ''}
    ${tbl(k.fx, levels)}</div></div>`;
  const np = s.np && `<div class="skill"><div><b>${s.np.name}</b><small> · ${s.np.rank} · ${s.np.card} · ${s.np.tg} · ${s.np.hits} hit${s.np.hits === 1 ? '' : 's'}</small>
    ${tbl(s.np.fx, ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'])}</div></div>`;
  const hits = ['Arts', 'Buster', 'Quick', 'Extra'].map((n, i) => `${n} ${s.hits[i]}`).join(' · ');
  const sk = s.skills.map(skill).join('');
  const pas = s.passives.map(skill).join('');
  const app = s.ap.map((i) => skill(appendSkills[i])).join('');
  const rows = [
    ['Level', 'lv', s.lvs.at(-1)[0], 1],
    ...(s.asc.length ? [['Ascension', 'asc', 4, 0]] : []),
    ...s.skills.map((k, n) => [`Skill ${n + 1}`, `s${n}`, 10, 1]),
  ].map(([label, key, max, min]) => `<div class="row"><label>${label}</label>${range(key, max, min, p[key])}</div>`).join('');
  $('detail').innerHTML = `
    <div class="banner"><img src="${s.art}" alt=""><div><h2>${s.name}</h2><small>No. ${s.no} · ${'★'.repeat(s.rarity)} ${s.cls}</small></div><button class="copy" type="button">Copy link</button></div>
    <h3>Stats</h3><table><thead><tr><th>Level</th><th>ATK</th><th>HP</th></tr></thead><tbody>${s.lvs.map(([l, a, h]) => `<tr><td>${l}</td><td>${fmt(a)}</td><td>${fmt(h)}</td></tr>`).join('')}</tbody></table>
    <h3>Command cards</h3><div class="deck">${s.deck.map((c) => `<span>${c}</span>`).join('')}</div><small>Hits per card: ${hits}</small>
    <h3>Noble Phantasm</h3>${np ?? ''}
    <h3>Skills</h3>${sk}
    <h3>Class passives</h3>${pas}
    <h3>Append skills</h3>${app}
    <h3>Upgrade range</h3>${rows}
    <div class="row"><label>Append skills</label>${range('ap', 10, 1, p.ap)} × <input data-k="ap" data-p="2" type="number" min="0" max="5" value="${p.ap[2]}" style="width:3.5rem"></div>
    <h3>Total materials</h3><div id="total" class="total"></div>`;
  $('detail').onchange = (e) => {
    const { k, p: i } = e.target.dataset;
    if (k) { p[k][i] = +e.target.value; if (i < 2 && p[k][0] > p[k][1]) p[k][1 - i] = +e.target.value; update(s, p); if (i < 2) select(s); }
  };
  update(s, p);
}

function update(s, p) {
  save(s, p);
  const acc = { qp: 0, i: {} };
  sum(s.asc, p.asc[0], p.asc[1], 0, 1, acc);
  s.skills.forEach((_, n) => sum(s.skill, p[`s${n}`][0], p[`s${n}`][1], 1, 1, acc));
  sum(s.append, p.ap[0], p.ap[1], 1, p.ap[2], acc);
  const curve = expCurves[s.exp], exp = curve[p.lv[1] - 1] - curve[p.lv[0] - 1];
  // Gríales: los niveles por encima del máximo base necesitan k gríales (nivel máx. añadido acumulado).
  const table = grail[s.rarity] ?? [], need = (lv) => (lv <= s.lvMax ? 0 : (table.findIndex(([, add]) => add >= lv - s.lvMax) + 1 || table.length));
  const [gFrom, gTo] = [need(p.lv[0]), need(p.lv[1])], gQp = (n) => table.slice(0, n).reduce((a, [q]) => a + q, 0);
  if (gTo > gFrom) { acc.qp += gQp(gTo) - gQp(gFrom); acc.i[7999] = gTo - gFrom; }
  const cells = Object.entries(acc.i).sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `<div><img src="${items[id].icon}" alt=""><span>${items[id].name} ×${fmt(n)}</span></div>`);
  if (exp) cells.unshift(`<div><span>EXP ×${fmt(exp)}</span></div>`);
  if (acc.qp) cells.unshift(`<div><img src="${items[1].icon}" alt=""><span>QP ×${fmt(acc.qp)}</span></div>`);
  $('total').innerHTML = cells.join('') || '<span class="hint">Nothing selected.</span>';
}

$('detail').onclick = async (e) => {
  if (!e.target.classList.contains('copy')) return;
  await navigator.clipboard.writeText(location.href).catch(() => {});
  e.target.textContent = 'Copied!';
  setTimeout(() => { e.target.textContent = 'Copy link'; }, 1500);
};

let t;
$('q').oninput = $('fx').oninput = () => { clearTimeout(t); t = setTimeout(renderList, 120); };
$('cls').onchange = $('rar').onchange = $('card').onchange = $('sort').onchange = renderList;
renderList();
restore();
