import { api } from '../api.js';
import { normalizePhone, addDays } from '../rules.js';
import { paymentForm } from './collections.js';
import { esc, ksh, fmtDate, pill, sourceLabel, icons, skeleton, empty, errorBlock, openModal, field, toast, toolbar, bindToolbar, ord } from '../ui.js';

export const render = (root, { id } = {}) => (id ? detail(root, id) : list(root));

async function tenantForm(tenant, done) {
  let units;
  try { units = await api.listUnits(); } catch { return toast('We couldn’t open the form. Try again.'); }
  const allowAdj = api.settings().allowRentAdjust, locked = tenant?.hasPayments, today = api.today();
  const unitOpts = units.map(u => `<option value="${u.id}" ${tenant?.unitId === u.id ? 'selected' : ''}>${esc(u.name)}, ${esc(u.type)}${u.active.length ? ` (${u.active.length} ${u.active.length > 1 ? 'tenants' : 'tenant'})` : ''}</option>`).join('');
  openModal({
    title: tenant ? `Edit ${tenant.name}` : 'Add tenant', submit: tenant ? 'Save changes' : 'Add tenant',
    body: field('Full name', `<input type="text" name="name" value="${esc(tenant?.name)}" autocomplete="off" required>`) +
      `<div class="two">${field('Phone number', `<input type="tel" name="phone" value="${esc(tenant?.phone)}" placeholder="0712 345 678" inputmode="tel" required>`)}
      ${field('Occupation', `<input type="text" name="occupation" value="${esc(tenant?.occupation)}">`)}</div>` +
      field('Unit', `<select name="unitId" ${tenant ? 'disabled' : ''}>${tenant ? '' : '<option value="">Choose a unit</option>'}${unitOpts}</select>`, tenant ? 'To change unit, move the tenant out and add them again.' : '') +
      `<p class="hint" id="co-note" hidden></p>` +
      `<div class="two">${field('Move-in date', `<input type="date" name="moveInDate" value="${tenant?.moveInDate || today}" ${locked ? 'disabled' : ''}>`)}
      ${field('Rent due date', `<input type="date" name="dueAnchor" value="${tenant?.dueAnchor || today}" ${locked ? 'disabled' : ''}>`, 'Rent is due on this day each month.')}</div>` +
      (locked ? '<p class="hint">Dates can’t change after payments are recorded.</p>' : '') +
      (allowAdj ? field('Adjusted rent (KSh)', `<input type="number" name="adjustedRent" min="1" step="1" inputmode="numeric" value="${tenant?.adjustedRent ?? ''}">`, 'Leave empty to use the standard share.') : ''),
    onSubmit: async v => {
      await api.saveTenant({ ...v, id: tenant?.id, unitId: tenant ? tenant.unitId : v.unitId });
      toast(tenant ? 'Tenant saved.' : 'Tenant added.'); done();
    },
    onOpen: f => {
      const note = f.querySelector('#co-note'), unit = f.unitId, mi = f.moveInDate, due = f.dueAnchor; let dueEdited = !!tenant;
      due.addEventListener('input', () => { dueEdited = true; });
      mi.addEventListener('input', () => { if (!dueEdited) due.value = mi.value; });
      const hint = () => { const u = units.find(x => x.id === unit.value); const n = u ? u.active.length : 0; note.hidden = tenant || !n;
        note.textContent = `This unit already has ${n} ${n > 1 ? 'tenants' : 'tenant'}. Rent will be split equally from each tenant’s next cycle.`; };
      unit.addEventListener('change', hint);
    },
  });
}

async function list(root) {
  root.innerHTML = `<div class="page">${toolbar('Search name, phone or unit', [['all', 'All'], ['paid', 'Paid up'], ['owing', 'Outstanding']], 'Add tenant')}<section class="panel" id="body"></section></div>`;
  const body = root.querySelector('#body'); let rows = [], q = '', fl = 'all';
  const bal = t => t.balance > 0 ? `<strong class="neg">${ksh(t.balance)}</strong>` : '<span class="muted">Paid up</span>';
  const name = t => esc(t.name) + (t.active ? '' : ' <span class="tag tag-plain">Moved out</span>');
  const draw = () => {
    if (!rows.length) { body.innerHTML = empty('No tenants added yet.', '<button class="btn" data-add>Add tenant</button>'); return; }
    const digits = q.replace(/\D/g, '');
    const f = rows.filter(t => (fl === 'all' || (fl === 'paid' ? t.balance === 0 : t.balance > 0)) &&
      (!q || t.name.toLowerCase().includes(q) || t.unit.toLowerCase().includes(q) || (digits.length >= 3 && normalizePhone(t.phone).includes(digits.replace(/^0/, '')))));
    if (!f.length) { body.innerHTML = empty('No tenants match your search.'); return; }
    body.innerHTML = `<table class="table only-wide"><thead><tr><th>Name</th><th>Unit</th><th>Phone</th><th class="num">Rent share</th><th>Next due</th><th class="num">Balance</th></tr></thead><tbody>
      ${f.map(t => `<tr data-href="#/tenants/${t.id}"><td><a href="#/tenants/${t.id}">${name(t)}</a></td><td>${esc(t.unit)}</td><td>${esc(t.phone)}</td><td class="num">${t.active ? ksh(t.share) : '<span class="muted">-</span>'}</td><td>${t.nextDue ? fmtDate(t.nextDue) : '<span class="muted">-</span>'}</td><td class="num">${bal(t)}</td></tr>`).join('')}</tbody></table>
      <ul class="cards only-narrow">${f.map(t => `<li class="card-row" data-href="#/tenants/${t.id}"><div><strong>${name(t)}</strong><span class="muted">${esc(t.unit)}, ${esc(t.phone)}</span><span class="muted">${t.nextDue ? 'Next due ' + fmtDate(t.nextDue) : 'Moved out ' + fmtDate(t.moveOutDate)}</span></div><div class="right">${t.active ? `<strong>${ksh(t.share)}</strong>` : ''}${bal(t)}</div></li>`).join('')}</ul>`;
  };
  const load = async () => {
    body.innerHTML = skeleton(5);
    try { rows = await api.listTenants(); draw(); }
    catch { body.innerHTML = errorBlock('We couldn’t load your tenants. Check your connection and try again.', 'tenants'); body.querySelector('[data-retry]').onclick = load; }
  };
  bindToolbar(root, (nq, nv) => { q = nq; fl = nv; if (rows.length || !body.querySelector('.error,.sk-wrap')) draw(); });
  root.onclick = e => {
    if (e.target.closest('[data-add]')) return tenantForm(null, load);
    const row = e.target.closest('[data-href]'); if (row && !e.target.closest('a')) location.hash = row.dataset.href;
  };
  load();
}

function moveOutForm(t, done) {
  openModal({
    title: `Move out ${t.name}`, submit: 'Move out',
    body: `<p>Moving out stops new rent cycles. Their payment history is kept, and any unpaid rent stays on their record.</p>` +
      field('Move-out date', `<input type="date" name="date" min="${t.moveInDate}" max="${api.today()}" value="${api.today()}">`),
    onSubmit: async v => { await api.moveOutTenant(t.id, v.date); toast('Tenant moved out.'); done(); },
  });
}

async function detail(root, id) {
  root.innerHTML = `<div class="page"><a class="back" href="#/tenants">${icons.chevron.replace('<svg', '<svg style="transform:rotate(90deg)"')} Tenants</a><div id="body"></div></div>`;
  const body = root.querySelector('#body');
  const load = async () => {
    body.innerHTML = skeleton(5);
    let t;
    try { t = await api.getTenant(id); }
    catch (e) {
      body.innerHTML = e.message === 'Tenant not found' ? `<section class="panel">${empty('We couldn’t find that tenant.', '<a class="link" href="#/tenants">Back to Tenants</a>')}</section>`
        : errorBlock('We couldn’t load this tenant. Check your connection and try again.', 'tenant');
      body.querySelector('[data-retry]')?.addEventListener('click', load); return;
    }
    const cur = t.cycles[0];
    body.innerHTML = `
      <div class="head-row"><h2>${esc(t.name)}</h2>${t.active ? '' : '<span class="tag tag-plain">Moved out</span>'}
        <div class="head-actions">${t.active ? '<button class="btn" data-pay>Record payment</button>' : ''}<button class="btn btn-ghost" data-edit>Edit</button>${t.active ? '<button class="btn btn-ghost" data-out>Move out</button>' : ''}</div></div>
      <div class="stats three">
        <div class="stat"><span class="stat-label">Current cycle</span>${cur ? `<span>${pill(cur.status)}</span><span class="muted">${fmtDate(cur.start)} to ${fmtDate(cur.end)}</span>` : `<span class="muted">Starts ${fmtDate(t.dueAnchor)}</span>`}</div>
        <div class="stat"><span class="stat-label">Outstanding</span><strong class="stat-value ${t.balance > 0 ? 'neg' : ''}">${ksh(t.balance)}</strong><span class="muted">Across all cycles</span></div>
        <div class="stat"><span class="stat-label">Credit</span><strong class="stat-value">${ksh(t.credit)}</strong><span class="muted">Held toward the next cycle</span></div>
      </div>
      <section class="panel"><div class="panel-head"><h3>Profile</h3></div><dl class="dl">
        <div><dt>Phone</dt><dd>${esc(t.phone)}</dd></div><div><dt>Occupation</dt><dd>${esc(t.occupation) || '-'}</dd></div>
        <div><dt>Unit</dt><dd><a href="#/units/${t.unitId}">${esc(t.unit)}</a></dd></div><div><dt>Moved in</dt><dd>${fmtDate(t.moveInDate)}</dd></div>
        <div><dt>Rent due</dt><dd>${ord(Number(t.dueAnchor.slice(8)))} of each month</dd></div>
        <div><dt>Rent share</dt><dd>${ksh(t.share)}${t.adjustedRent != null ? ' <span class="tag">Rent differs from default</span>' : ''}${t.active && t.nextShare !== t.share ? `<span class="sub">${ksh(t.nextShare)} from next cycle</span>` : ''}</dd></div>
        ${t.moveOutDate ? `<div><dt>Moved out</dt><dd>${fmtDate(t.moveOutDate)}</dd></div>` : ''}</dl></section>
      <section class="panel"><div class="panel-head"><h3>Rent cycles</h3></div>${t.cycles.length ? t.cycles.map(c => `
        <div class="cycle"><div class="cycle-top"><strong>${fmtDate(c.start)} to ${fmtDate(c.end)}</strong>${pill(c.status)}</div>
          <span class="muted">Rent ${ksh(c.share)}, paid ${ksh(c.paid)}${c.balance > 0 ? `, <span class="neg">${ksh(c.balance)} outstanding</span>` : ''}</span>
          ${c.installments.length ? `<div class="sub">${c.installments.map(i => `<span>${fmtDate(i.date)}: ${ksh(i.amount)} ${i.credit ? '(from credit)' : i.source === 'manual' ? '(manually recorded)' : '(M-Pesa)'}</span>`).join('')}</div>` : ''}</div>`).join('') : empty('No rent cycles yet.')}</section>
      <section class="panel"><div class="panel-head"><h3>Payment history</h3></div>${!t.history.length ? empty('No collections recorded yet.') : `
        <table class="table only-wide"><thead><tr><th>Date</th><th class="num">Amount</th><th>Source</th><th>Reference</th><th>Applied to</th></tr></thead><tbody>
        ${t.history.map(p => `<tr><td>${fmtDate(p.date)}</td><td class="num">${ksh(p.amount)}</td><td>${sourceLabel(p.source)}</td><td>${esc(p.ref) || '-'}</td><td>${p.cycleStart ? 'Cycle of ' + fmtDate(p.cycleStart) + (p.more ? ` +${p.more} more` : '') : 'Credit'}</td></tr>`).join('')}</tbody></table>
        <ul class="cards only-narrow">${t.history.map(p => `<li class="card-row"><div><strong>${fmtDate(p.date)}</strong>${sourceLabel(p.source)}<span class="muted">${p.cycleStart ? 'Cycle of ' + fmtDate(p.cycleStart) : 'Credit'}</span></div><div class="right"><strong>${ksh(p.amount)}</strong><span class="muted">${esc(p.ref)}</span></div></li>`).join('')}</ul>`}</section>`;
    body.querySelector('[data-pay]')?.addEventListener('click', () => paymentForm(t.id, load));
    body.querySelector('[data-edit]').onclick = () => tenantForm(t, load);
    body.querySelector('[data-out]')?.addEventListener('click', () => moveOutForm(t, load));
  };
  load();
}
