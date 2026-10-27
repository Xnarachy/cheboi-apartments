import { api } from '../api.js';
import { esc, ksh, fmtDate, pill, icons, skeleton, empty, errorBlock, openModal, field, toast, toolbar, bindToolbar } from '../ui.js';

export const render = (root, { id } = {}) => (id ? detail(root, id) : list(root));

function unitForm(unit, done) {
  const types = api.settings().unitTypes;
  openModal({
    title: unit ? `Edit unit ${unit.name}` : 'Add unit', submit: unit ? 'Save changes' : 'Add unit',
    body: field('Unit name or number', `<input type="text" name="name" value="${esc(unit?.name)}" autocomplete="off" required>`) +
      `<div class="two">${field('Type', `<select name="type">${types.map(t => `<option ${unit?.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`)}
      ${field('Monthly rent (KSh)', `<input type="number" name="rent" min="1" step="1" inputmode="numeric" value="${unit?.rent ?? ''}" required>`)}</div>` +
      (unit ? '<p class="hint">A new rent applies from each tenant’s next cycle.</p>' : ''),
    onSubmit: async v => { await api.saveUnit({ ...v, id: unit?.id }); toast('Unit saved.'); done(); },
  });
}

const tenantsCell = u => {
  if (!u.active.length) return '<span class="muted">No tenant</span>';
  const f = u.active[0];
  return `<span class="${f.balance > 0 ? 'neg' : ''}">${esc(f.name)}</span>${u.active.length > 1 ? ` <span class="muted">+${u.active.length - 1} more</span>` : ''}`;
};
const rentCell = u => `${ksh(u.rent)}${u.active.length > 1 ? '<span class="sub">split equally</span>' : ''}`;

async function list(root) {
  root.innerHTML = `<div class="page">${toolbar('Search units', [['all', 'All'], ['occupied', 'Occupied'], ['vacant', 'Vacant']], 'Add unit')}<section class="panel" id="body"></section></div>`;
  const body = root.querySelector('#body'); let rows = [], q = '', st = 'all';
  const draw = () => {
    if (!rows.length) { body.innerHTML = empty('No units added yet.', '<button class="btn" data-add>Add unit</button>'); return; }
    const f = rows.filter(u => (st === 'all' || u.status === st) && (!q || [u.name, u.type, ...u.active.map(t => t.name)].join(' ').toLowerCase().includes(q)));
    if (!f.length) { body.innerHTML = empty('No units match your search.'); return; }
    body.innerHTML = `<table class="table only-wide"><thead><tr><th>Unit</th><th>Type</th><th>Status</th><th>Tenant</th><th class="num">Rent</th><th></th></tr></thead><tbody>
      ${f.map(u => `<tr data-href="#/units/${u.id}"><td><a href="#/units/${u.id}">${esc(u.name)}</a></td><td>${esc(u.type)}</td><td>${pill(u.status)}</td><td>${tenantsCell(u)}</td><td class="num">${rentCell(u)}</td><td class="num"><button class="btn btn-ghost btn-sm" data-edit="${u.id}">Edit</button></td></tr>`).join('')}</tbody></table>
      <ul class="cards only-narrow">${f.map(u => `<li class="card-row" data-href="#/units/${u.id}"><div><strong>${esc(u.name)}</strong><span class="muted">${esc(u.type)}</span>${tenantsCell(u)}<button class="btn btn-ghost btn-sm" data-edit="${u.id}">Edit</button></div><div class="right"><strong>${ksh(u.rent)}</strong>${u.active.length > 1 ? '<span class="muted">split equally</span>' : ''}${pill(u.status)}</div></li>`).join('')}</ul>`;
  };
  const load = async () => {
    body.innerHTML = skeleton(5);
    try { rows = await api.listUnits(); draw(); }
    catch { body.innerHTML = errorBlock('We couldn’t load your units. Check your connection and try again.', 'units'); body.querySelector('[data-retry]').onclick = load; }
  };
  bindToolbar(root, (nq, nv) => { q = nq; st = nv; if (rows.length || !body.querySelector('.error,.sk-wrap')) draw(); });
  root.onclick = e => {
    if (e.target.closest('[data-add]')) return unitForm(null, load);
    const ed = e.target.closest('[data-edit]');
    if (ed) return unitForm(rows.find(u => u.id === ed.dataset.edit), load);
    const row = e.target.closest('[data-href]'); if (row && !e.target.closest('a')) location.hash = row.dataset.href;
  };
  load();
}

async function detail(root, id) {
  root.innerHTML = `<div class="page"><a class="back" href="#/units">${icons.chevron.replace('<svg', '<svg style="transform:rotate(90deg)"')} Units</a><div id="body">${skeleton(5)}</div></div>`;
  const body = root.querySelector('#body');
  const load = async () => {
    body.innerHTML = skeleton(5);
    let u;
    try { u = await api.getUnit(id); }
    catch (e) {
      body.innerHTML = e.message === 'Unit not found' ? `<section class="panel">${empty('We couldn’t find that unit.', '<a class="link" href="#/units">Back to Units</a>')}</section>`
        : errorBlock('We couldn’t load this unit. Check your connection and try again.', 'unit');
      body.querySelector('[data-retry]')?.addEventListener('click', load); return;
    }
    const past = u.tenants.filter(t => !t.active), co = u.active.length > 1;
    const row = t => `<li class="card-row" data-href="#/tenants/${t.id}"><div><strong class="${t.balance > 0 ? 'neg' : ''}">${esc(t.name)}</strong><span class="muted">${esc(t.phone)}</span>${t.adjustedRent != null ? '<span class="tag">Rent differs from default</span>' : ''}${t.balance > 0 ? `<span class="muted neg">${ksh(t.balance)} outstanding</span>` : ''}</div><div class="right"><strong>${ksh(t.share)}</strong><span class="muted">${t.nextShare !== t.share && t.active ? `From next cycle ${ksh(t.nextShare)}` : 'Rent share'}</span></div></li>`;
    body.innerHTML = `
      <div class="head-row"><h2>Unit ${esc(u.name)}</h2>${pill(u.status)}<div class="head-actions"><button class="btn btn-ghost" data-edit>Edit unit</button></div></div>
      <section class="panel"><dl class="dl"><div><dt>Type</dt><dd>${esc(u.type)}</dd></div><div><dt>Default monthly rent</dt><dd>${ksh(u.rent)}${co ? ' <span class="muted">split equally</span>' : ''}</dd></div><div><dt>Tenants</dt><dd>${u.active.length}</dd></div></dl></section>
      <section class="panel"><div class="panel-head"><h3>Tenants</h3></div>${u.active.length ? `<ul class="cards">${u.active.map(row).join('')}</ul>` : empty('No tenant in this unit yet.', '<a class="btn" href="#/tenants">Go to Tenants</a>')}</section>
      ${past.length ? `<section class="panel"><div class="panel-head"><h3>Past tenants</h3></div><ul class="cards">${past.map(row).join('')}</ul></section>` : ''}`;
    body.querySelector('[data-edit]').onclick = () => unitForm(u, load);
    body.onclick = e => { const r = e.target.closest('[data-href]'); if (r) location.hash = r.dataset.href; };
  };
  load();
}
