import { api } from '../api.js';
import { esc, ksh, fmtDateTime, fmtPhone, pill, icons, skeleton, empty, errorBlock, openModal, field, toast } from '../ui.js';

export const render = (root, ctx) => page(root, ctx?.query);

const TABS = [['pending', 'Pending review'], ['unmatched', 'Unmatched'], ['recorded', 'Recorded'], ['all', 'All']];
const EMPTY = { pending: 'Nothing is waiting for review.', unmatched: 'No unmatched payments.', recorded: 'No recorded payments yet.', all: 'No M-Pesa messages yet.' };

async function pickTenant({ title, submit, hint, exclude, onPick }) {
  let tenants;
  try { tenants = (await api.listTenants()).filter(t => t.active && t.id !== exclude); } catch { return toast('We couldn’t open the form. Try again.'); }
  openModal({
    title, submit, body: field('Tenant', `<select name="tenantId"><option value="">Choose a tenant</option>${tenants.map(t => `<option value="${t.id}">${esc(t.name)}, ${esc(t.unit)}</option>`).join('')}</select>`) + `<p class="hint">${esc(hint)}</p>`,
    onSubmit: async v => { if (!v.tenantId) throw new Error('Choose a tenant.'); await onPick(v.tenantId); },
  });
}

async function page(root, query = '') {
  root.innerHTML = `<div class="page"><div id="notice"></div>
    <div class="toolbar"><label class="search">${icons.search}<input type="search" placeholder="Search name, phone or reference" aria-label="Search M-Pesa messages"></label></div>
    <div class="tabs" id="tabs" role="tablist"></div><section class="panel" id="body"></section></div>`;
  const $ = s => root.querySelector(s), body = $('#body'); let rows = [], tab = null, q = '';
  const count = s => rows.filter(r => r.status === s).length;

  const who = r => r.tenant ? `${esc(r.tenant)}, ${esc(r.unit)}` : '<span class="muted">Not matched</span>';
  const actions = r => ({
    pending: `<button class="btn btn-sm" data-act="confirm" data-id="${r.id}">Confirm</button><button class="btn btn-ghost btn-sm" data-act="reject" data-id="${r.id}">Reject</button>`,
    unmatched: `<button class="btn btn-sm" data-act="assign" data-id="${r.id}">Assign to tenant</button><button class="btn btn-ghost btn-sm" data-act="reject" data-id="${r.id}">Reject</button>`,
    recorded: `<button class="btn btn-ghost btn-sm" data-act="reassign" data-id="${r.id}">Reassign</button>`, rejected: '',
  }[r.status]);
  const tags = r => r.reassigned ? ' <span class="tag">Reassigned</span>' : '';

  const drawTabs = () => {
    $('#tabs').innerHTML = TABS.map(([v, l]) => `<button role="tab" data-tab="${v}" class="${tab === v ? 'on' : ''}" aria-selected="${tab === v}">${l}${(v === 'pending' || v === 'unmatched') && count(v) ? `<b class="tab-badge">${count(v)}</b>` : ''}</button>`).join('');
  };
  const draw = () => {
    drawTabs();
    const digits = q.replace(/\D/g, '');
    const m = rows.filter(r => (tab === 'all' || r.status === tab) && (!q || r.name.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q) || (digits.length >= 3 && (r.phone.includes(digits.replace(/^0/, '')) || String(r.amount).includes(digits)))));
    if (!rows.length) { body.innerHTML = empty(EMPTY.all); return; }
    if (!m.length) { body.innerHTML = empty(q ? 'No messages match your search.' : EMPTY[tab]); return; }
    const needs = r => (r.status === 'pending' || r.status === 'unmatched') ? 'needs' : '';
    body.innerHTML = `<table class="table t-mpesa only-wide"><thead><tr><th>Received</th><th>Sender</th><th class="num">Amount</th><th>Reference</th><th>Status</th><th>Tenant</th><th></th></tr></thead><tbody>
      ${m.map(r => `<tr class="${needs(r)}"><td>${fmtDateTime(r.receivedAt)}</td><td><strong>${esc(r.name)}</strong><span class="sub">${esc(fmtPhone(r.phone))}</span></td><td class="num">${ksh(r.amount)}</td><td>${esc(r.ref)}</td><td>${pill(r.status)}${tags(r)}</td><td>${who(r)}</td><td><div class="row-actions">${actions(r)}</div></td></tr>`).join('')}</tbody></table>
      <ul class="cards only-narrow">${m.map(r => `<li class="card-row ${needs(r)}"><div><strong>${esc(r.name)}</strong><span class="muted">${esc(fmtPhone(r.phone))}</span><span class="muted">${fmtDateTime(r.receivedAt)}</span><span class="muted">${esc(r.ref)}</span><span>${who(r)}</span><div class="row-actions">${actions(r)}</div></div><div class="right"><strong>${ksh(r.amount)}</strong>${pill(r.status)}${tags(r)}</div></li>`).join('')}</ul>`;
  };
  const notice = () => {
    $('#notice').innerHTML = api.isMpesaDown() ? `<div class="notice"><span>We can’t reach M-Pesa right now. Payments received in the meantime may be missing. Your recorded payments below are unaffected.</span><button class="btn btn-ghost btn-sm" data-retry-conn>Retry</button></div>` : '';
  };
  const load = async () => {
    notice(); body.innerHTML = skeleton(5);
    try {
      rows = await api.listMessages();
      if (!tab) tab = count('pending') ? 'pending' : count('unmatched') ? 'unmatched' : 'all';
      draw();
    } catch { body.innerHTML = errorBlock('We couldn’t load your M-Pesa messages. Check your connection and try again.', 'mpesa'); body.querySelector('[data-retry]').onclick = load; }
  };
  const done = msg => { toast(msg); load(); };
  const find = id => rows.find(r => r.id === id);

  $('.search input').oninput = e => { q = e.target.value.trim().toLowerCase(); if (rows.length) draw(); };
  root.onclick = async e => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return draw(); }
    if (e.target.closest('[data-retry-conn]')) return load();
    const b = e.target.closest('[data-act]'); if (!b) return;
    const r = find(b.dataset.id), act = b.dataset.act;
    if (act === 'confirm') { b.disabled = true; try { await api.confirmMessage(r.id); done(`Payment recorded for ${r.tenant}.`); } catch (ex) { toast('We couldn’t confirm that payment. Try again.'); b.disabled = false; } }
    else if (act === 'reject') openModal({ title: 'Reject payment', submit: 'Reject', body: `<p>Dismiss ${ksh(r.amount)} from ${esc(r.name)} as not a rent payment? It will not be recorded.</p>`, onSubmit: async () => { await api.rejectMessage(r.id); done('Payment rejected.'); } });
    else if (act === 'assign') pickTenant({ title: 'Assign to tenant', submit: 'Assign and record', hint: `${ksh(r.amount)} from ${r.name} will be recorded for this tenant.`, onPick: async id => { await api.assignMessage(r.id, id); done('Payment assigned and recorded.'); } });
    else if (act === 'reassign') pickTenant({ title: 'Reassign payment', submit: 'Reassign', exclude: r.tenantId, hint: 'Both tenants’ balances will update. This month’s collected total stays the same.', onPick: async id => { await api.reassignMessage(r.id, id); done('Payment reassigned.'); } });
  };
  if (query) { tab = 'all'; q = query.trim().toLowerCase(); $('.search input').value = query; }
  load();
}
