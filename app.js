const { items, appendSkills, expCurves, grail, servants } = await (await fetch('data/servants.json')).json();
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en');
let mode = 'svt', ces; // ces se descarga al abrir la pestaña
const plan = {}; // por servant.id: { asc:[a,b], s0:[a,b], s1, s2, ap:[a,b,n] }

// Todas las variantes de Beast (beastEresh, unBeastOlgaMarie…) entran en una sola categoría.
const group = (c) => (/^(beast|unBeast)/.test(c) ? 'beast' : c);

$('cls').append(...[...new Set(servants.map((s) => group(s.cls)))].sort().map((c) => new Option(c, c)));

// Marco por rareza (1 bronce, 2 plata, 3 oro) e icono de clase de Atlas; Beast Eresh (38) no tiene icono propio.
const tier = (s) => (s.rarity <= 2 ? 1 : s.rarity === 3 ? 2 : 3);
const clsIcon = (s) => `https://static.atlasacademy.io/JP/ClassIcons/class${tier(s)}_${s.cid === 38 ? 33 : s.cid}.png`;

const renderList = () => {
  const q = $('q').value.toLowerCase(), c = $('cls').value, r = $('rar').value, cd = $('card').value;
  const dir = $('sort').value === 'new' ? -1 : 1;
  const svt = mode === 'svt';
  $('list').replaceChildren(...(svt ? servants : ces).toSorted((a, b) => dir * (a.no - b.no))
    .filter((s) => (!svt || !c || group(s.cls) === c) && (r === '' || s.rarity === +r) && (!svt || !cd || s.np?.card === cd)
      && s.name.toLowerCase().includes(q))
    .map((s) => {
      const li = document.createElement('li');
      li.dataset.id = s.id;
      li.innerHTML = `<span class="ic t${tier(s)}"><img loading="lazy" src="${s.face}" alt="">${svt ? `<img class="cls" loading="lazy" src="${clsIcon(s)}" alt="">` : ''}</span><div>${s.name}<small>No. ${s.no} · ${'★'.repeat(s.rarity)}</small></div>`;
      li.onclick = () => (svt ? select(s) : selectCe(s));
      return li;
    }));
};

document.querySelectorAll('nav button').forEach((btn) => {
  btn.onclick = async () => {
    mode = btn.dataset.m;
    document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b === btn));
    $('cls').hidden = $('card').hidden = mode !== 'svt';
    $('detail').innerHTML = '<p class="hint">Loading…</p>';
    if (mode === 'ce') ces ??= await (await fetch('data/ces.json')).json();
    $('detail').innerHTML = `<p class="hint">Pick a ${mode === 'svt' ? 'servant' : 'craft essence'}.</p>`;
    renderList();
  };
});

const fxLine = (e) => `<li>${e.n}: <b>${e.v.length > 1 ? e.v.join(' / ') : e.v[0]}</b><small> · ${e.tg}${e.t ? ' · ' + e.t : ''}</small></li>`;
function selectCe(e) {
  document.querySelectorAll('#list li').forEach((li) => li.classList.toggle('on', +li.dataset.id === e.id));
  const sk = e.sk.map((k) => `<div class="ce-skill"><b>${k.name}</b>
    <div><small>${k.max ? 'Base' : 'Effect'}</small><ul>${k.base.map(fxLine).join('')}</ul></div>
    ${k.max ? `<div><small>Max limit break</small><ul>${k.max.map(fxLine).join('')}</ul></div>` : ''}</div>`).join('');
  $('detail').onchange = null;
  $('detail').innerHTML = `
    <div class="banner"><img src="${e.art}" alt=""><div><h2>${e.name}</h2><small>No. ${e.no} · ${'★'.repeat(e.rarity)}</small></div></div>
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
  document.querySelectorAll('#list li').forEach((li) => li.classList.toggle('on', +li.dataset.id === s.id));
  const p = plan[s.id] ??= { lv: [1, 1], asc: [0, 0], s0: [1, 1], s1: [1, 1], s2: [1, 1], ap: [1, 1, 1] };
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
    ['Ascension', 'asc', 4, 0],
    ...s.skills.map((k, n) => [`Skill ${n + 1}`, `s${n}`, 10, 1]),
  ].map(([label, key, max, min]) => `<div class="row"><label>${label}</label>${range(key, max, min, p[key])}</div>`).join('');
  $('detail').innerHTML = `
    <div class="banner"><img src="${s.art}" alt=""><div><h2>${s.name}</h2><small>No. ${s.no} · ${'★'.repeat(s.rarity)} ${s.cls}</small></div></div>
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
  if (acc.qp) cells.unshift(`<div><img src="https://static.atlasacademy.io/JP/Items/5.png" alt=""><span>QP ×${fmt(acc.qp)}</span></div>`);
  $('total').innerHTML = cells.join('') || '<span class="hint">Nothing selected.</span>';
}

$('q').oninput = $('cls').onchange = $('rar').onchange = $('card').onchange = $('sort').onchange = renderList;
renderList();
