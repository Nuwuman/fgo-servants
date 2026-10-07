const { items, appendSkills, servants } = await (await fetch('data/servants.json')).json();
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en');
const plan = {}; // por servant.id: { asc:[a,b], s0:[a,b], s1, s2, ap:[a,b,n] }

$('cls').append(...[...new Set(servants.map((s) => s.cls))].sort().map((c) => new Option(c, c)));

const renderList = () => {
  const q = $('q').value.toLowerCase(), c = $('cls').value;
  const dir = $('sort').value === 'new' ? -1 : 1;
  $('list').replaceChildren(...servants.toSorted((a, b) => dir * (a.no - b.no))
    .filter((s) => (!c || s.cls === c) && s.name.toLowerCase().includes(q))
    .map((s) => {
      const li = document.createElement('li');
      li.dataset.id = s.id;
      li.innerHTML = `<img loading="lazy" src="${s.face}" alt=""><div>${s.name}<small>${'★'.repeat(s.rarity)} ${s.cls}</small></div>`;
      li.onclick = () => select(s);
      return li;
    }));
};

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
  const p = plan[s.id] ??= { asc: [0, 0], s0: [1, 1], s1: [1, 1], s2: [1, 1], ap: [1, 1, 1] };
  const lv = Array.from({ length: 10 }, (_, n) => `<th>${n + 1}</th>`).join('');
  const card = (n) => (/Buster/.test(n) ? 'b' : /Arts/.test(n) ? 'a' : /Quick/.test(n) ? 'q' : '');
  const fx = (e) => `<tr><td class="${card(e.n)}">${e.n}<small> · ${e.tg}${e.t ? ' · ' + e.t : ''}</small></td>${e.v.length > 1
    ? e.v.map((v) => `<td>${v}</td>`).join('') : `<td colspan="10" class="c">${e.v[0]}</td>`}</tr>`;
  const skill = (k) => `<div class="skill"><img src="${k.icon}" alt=""><div><b>${k.name}</b>
    ${k.cd ? `<small> · CD ${k.cd[0]}${k.cd[9] !== k.cd[0] ? '→' + k.cd[9] : ''}</small>` : ''}
    <div class="scroll"><table><thead><tr><th>Level</th>${lv}</tr></thead><tbody>${k.fx.map(fx).join('')}</tbody></table></div></div></div>`;
  const sk = s.skills.map(skill).join('');
  const pas = s.passives.map(skill).join('');
  const app = s.ap.map((i) => skill(appendSkills[i])).join('');
  const rows = [
    ['Ascension', 'asc', 4, 0],
    ...s.skills.map((k, n) => [`Skill ${n + 1}`, `s${n}`, 10, 1]),
  ].map(([label, key, max, min]) => `<div class="row"><label>${label}</label>${range(key, max, min, p[key])}</div>`).join('');
  $('detail').innerHTML = `
    <h2>${s.name}</h2><small>No. ${s.no} · ${'★'.repeat(s.rarity)} ${s.cls}</small>
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
  const cells = Object.entries(acc.i).sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `<div><img src="${items[id].icon}" alt=""><span>${items[id].name} ×${fmt(n)}</span></div>`);
  if (acc.qp) cells.unshift(`<div><b>QP</b> ${fmt(acc.qp)}</div>`);
  $('total').innerHTML = cells.join('') || '<span class="hint">Nothing selected.</span>';
}

$('q').oninput = $('cls').onchange = $('sort').onchange = renderList;
renderList();
