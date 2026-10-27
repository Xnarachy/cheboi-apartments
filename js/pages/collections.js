import { api } from '../api.js';
import { esc, ksh, fmtDate, pill, sourceLabel, icons, skeleton, empty, errorBlock, openModal, field, toast } from '../ui.js';

export const render = (root, ctx) => list(root, ctx?.query);

// Shared with the tenant detail page ("Record payment").
export async function paymentForm(preTenantId, done) {
  let tenants;
  try { tenants = (await api.listTenants()).filter(t => t.active); } catch { return toast('We couldn’t open the form. Try again.'); }
  const today = api.today();
  openModal({
    title: 'Add payment', submit: 'Add payment',
    body: field('Tenant', `<select name="tenantId">${preTenantId ? '' : '<option value="">Choose a tenant</option>'}${tenants.map(t => `<option value="${t.id}" ${t.id === preTenantId ? 'selected' : ''}>${esc(t.name)}, ${esc(t.unit)}</option>`).join('')}</select>`) +
      `<div class="two">${field('Amount (KSh)', '<input type="number" name="amount" min="1" step="1" inputmode="numeric" required>')}
      ${field('Date received', `<input type="date" name="date" value="${today}" max="${today}">`)}</div>` +
      '<p class="hint">Use this for cash and other payments. It is saved as “Manually recorded” and clears the oldest unpaid cycle first, like an M-Pesa payment.</p>',
    onSubmit: async v => {
      const r = await api.addPayment(v), n = r.cleared.length;
      toast(`${ksh(v.amount)} recorded.${n ? ` Applied to the cycle of ${fmtDate(r.cleared[0].cycleStart)}${n > 1 ? ` and ${n - 1} more` : ''}.` : ''}${r.credit > 0 ? ` ${ksh(r.credit)} is held as credit.` : ''}`, 5500);
      done();
    },
  });
}

const monthKey = iso => iso.slice(0, 7);
const shift = (key, n) => { const d = new Date(key + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const monthLabel = key => new Date(key + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const STATUSES = [['', 'All statuses'], ['paid', 'Paid'], ['partial', 'Partially paid'], ['overdue', 'Overdue'], ['credit', 'Credit']];

async function list(root, query = '') {
  const thisMonth = monthKey(api.today());
  const f = { mode: 'month', month: thisMonth, from: '', to: '', tenant: '', unit: '', status: '', q: '' };
  root.innerHTML = `<div class="page">
    <div class="toolbar"><label class="search">${icons.search}<input type="search" placeholder="Search collections" aria-label="Search collections"></label><button class="btn" data-add>Add payment</button></div>
    <div class="filters">
      <div class="seg" role="group" aria-label="Period"><button type="button" data-mode="month" class="on" aria-pressed="true">Month</button><button type="button" data-mode="range" aria-pressed="false">Custom range</button></div>
      <div class="month-nav" id="month-nav"><button class="icon-btn rot-l" data-step="-1" aria-label="Previous month">${icons.chevron}</button><strong id="month-label"></strong><button class="icon-btn rot-r" data-step="1" aria-label="Next month">${icons.chevron}</button></div>
      <div class="range" id="range" hidden><input type="date" id="from" aria-label="From"><span class="muted">to</span><input type="date" id="to" aria-label="To"></div>
      <select id="f-tenant" aria-label="Tenant"></select><select id="f-unit" aria-label="Unit"></select><select id="f-status" aria-label="Status">${STATUSES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    </div>
    <section class="panel"><p class="muted" id="summary"></p><div id="body"></div></section></div>`;
  const $ = s => root.querySelector(s), body = $('#body'); let rows = [];

  const inPeriod = r => f.mode === 'month' ? monthKey(r.date) === f.month : (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to);
  const match = r => {
    if (!inPeriod(r) || (f.tenant && r.tenantId !== f.tenant) || (f.unit && r.unitId !== f.unit) || (f.status && r.status !== f.status)) return false;
    if (!f.q) return true;
    const digits = f.q.replace(/[^\d]/g, '');
    return [r.tenant, r.unit, r.ref || '', fmtDate(r.date), r.date].join(' ').toLowerCase().includes(f.q) || (digits && String(r.amount).includes(digits));
  };
  const applied = r => r.cycleStart ? `Cycle of ${fmtDate(r.cycleStart)}${r.more ? ` +${r.more} more` : ''}` : 'Held as credit';
  const draw = () => {
    $('#month-label').textContent = monthLabel(f.month);
    $('#month-nav').hidden = f.mode !== 'month'; $('#range').hidden = f.mode !== 'range';
    root.querySelector('[data-step="1"]').disabled = f.month >= thisMonth;
    if (!rows.length) { $('#summary').textContent = ''; body.innerHTML = empty('No collections recorded yet.', '<button class="btn" data-add>Add payment</button>'); return; }
    const m = rows.filter(match), total = m.reduce((s, r) => s + r.amount, 0);
    $('#summary').innerHTML = `<strong>${ksh(total)}</strong> collected from ${m.length} ${m.length === 1 ? 'payment' : 'payments'} in ${f.mode === 'month' ? monthLabel(f.month) : 'this period'}`;
    if (!m.length) { body.innerHTML = empty('No collections match these filters.'); return; }
    body.innerHTML = `<table class="table only-wide"><thead><tr><th>Date</th><th>Tenant</th><th>Unit</th><th class="num">Amount</th><th>Applied to</th><th>Source</th><th>Status</th></tr></thead><tbody>
      ${m.map(r => `<tr><td>${fmtDate(r.date)}</td><td><a href="#/tenants/${r.tenantId}">${esc(r.tenant)}</a></td><td>${esc(r.unit)}</td><td class="num">${ksh(r.amount)}</td><td>${applied(r)}</td><td>${sourceLabel(r.source)}${r.reassigned ? ' <span class="tag">Reassigned</span>' : ''}</td><td>${pill(r.status)}</td></tr>`).join('')}</tbody></table>
      <ul class="cards only-narrow">${m.map(r => `<li class="card-row"><div><strong>${esc(r.tenant)}</strong><span class="muted">${esc(r.unit)}, ${fmtDate(r.date)}</span><span class="muted">${applied(r)}</span>${sourceLabel(r.source)}</div><div class="right"><strong>${ksh(r.amount)}</strong>${pill(r.status)}</div></li>`).join('')}</ul>`;
  };
  const fillSelects = () => {
    const uniq = (key, name) => [...new Map(rows.map(r => [r[key], r[name]])).entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
    const opts = (id, all, list) => { $(id).innerHTML = `<option value="">${all}</option>` + list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(''); };
    opts('#f-tenant', 'All tenants', uniq('tenantId', 'tenant')); opts('#f-unit', 'All units', uniq('unitId', 'unit'));
  };
  const load = async () => {
    body.innerHTML = skeleton(5);
    try { rows = await api.listCollections(); fillSelects(); draw(); }
    catch { body.innerHTML = errorBlock('We couldn’t load your rent collections. Check your connection and try again.', 'collections'); body.querySelector('[data-retry]').onclick = load; }
  };

  const on = (sel, ev, fn) => $(sel).addEventListener(ev, fn), redraw = () => { if (rows.length || !body.querySelector('.error,.sk-wrap')) draw(); };
  on('.search input', 'input', e => { f.q = e.target.value.trim().toLowerCase(); redraw(); });
  on('#f-tenant', 'change', e => { f.tenant = e.target.value; redraw(); });
  on('#f-unit', 'change', e => { f.unit = e.target.value; redraw(); });
  on('#f-status', 'change', e => { f.status = e.target.value; redraw(); });
  on('#from', 'change', e => { f.from = e.target.value; redraw(); });
  on('#to', 'change', e => { f.to = e.target.value; redraw(); });
  root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    f.mode = b.dataset.mode; root.querySelectorAll('[data-mode]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); redraw();
  });
  root.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { f.month = shift(f.month, Number(b.dataset.step)); redraw(); });
  root.onclick = e => { if (e.target.closest('[data-add]')) paymentForm(null, load); };
  if (query) { // arriving from global search: look across all dates
    f.q = query.trim().toLowerCase(); f.mode = 'range'; $('.search input').value = query;
    root.querySelectorAll('[data-mode]').forEach(x => { const on = x.dataset.mode === 'range'; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
  }
  load();
}
