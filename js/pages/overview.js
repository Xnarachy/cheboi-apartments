import { api } from '../api.js';
import { esc, ksh, fmtDate, pill, sourceLabel, skeleton, empty, errorBlock } from '../ui.js';

// Each section loads on its own, so one failure never blanks the whole page.
async function section(el, id, fetcher, draw, failMsg) {
  el.innerHTML = skeleton(id === 'figures' ? 2 : 4);
  try { el.innerHTML = draw(await fetcher()); }
  catch (e) { el.innerHTML = errorBlock(failMsg, id); el.querySelector('[data-retry]').onclick = () => section(el, id, fetcher, draw, failMsg); }
}

const greeting = f => {
  const h = new Date().getHours(), part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const line = f.overdueTenants ? `${f.overdueTenants} ${f.overdueTenants === 1 ? 'tenant has' : 'tenants have'} overdue rent.` : 'All rent is up to date.';
  return `<h2>${part}, ${esc(f.owner.split(' ')[0])}</h2><p class="muted">${esc(f.propertyName)}. ${line}</p>`;
};

const summary = f => `
  <div class="stat"><span class="stat-label">Rent collected</span><strong class="stat-value">${ksh(f.rentCollected)}</strong><span class="muted">${esc(f.monthLabel)}</span></div>
  <div class="stat"><span class="stat-label">Amount outstanding</span><strong class="stat-value ${f.outstanding > 0 ? 'neg' : ''}">${ksh(f.outstanding)}</strong><span class="muted">Unpaid rent for cycles starting in ${esc(f.monthLabel)}</span></div>`;

const property = f => `<a class="prop-row" href="#/units" aria-label="Open units">
  ${[['Total units', f.totalUnits], ['Occupied', f.occupied], ['Vacant', f.vacant]].map(([l, v]) => `<div><strong>${v}</strong><span class="muted">${l}</span></div>`).join('')}</a>`;

const collections = rows => !rows.length ? empty('No collections recorded yet.') : `
  <table class="table only-wide"><thead><tr><th>Date</th><th>Tenant</th><th>Unit</th><th class="num">Amount</th><th>Source</th><th>Status</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.tenant)}</td><td>${esc(r.unit)}</td><td class="num">${ksh(r.amount)}</td><td>${sourceLabel(r.source)}</td><td>${pill(r.cycleStatus)}</td></tr>`).join('')}</tbody></table>
  <ul class="cards only-narrow">${rows.map(r => `<li class="card-row"><div><strong>${esc(r.tenant)}</strong><span class="muted">${esc(r.unit)}, ${fmtDate(r.date)}</span>${sourceLabel(r.source)}</div><div class="right"><strong>${ksh(r.amount)}</strong>${pill(r.cycleStatus)}</div></li>`).join('')}</ul>`;

const upcomingList = rows => !rows.length ? empty('No upcoming payments to show.') : `<ul class="cards">${rows.map(r =>
  `<li class="card-row"><div><strong>${esc(r.tenant)}</strong><span class="muted">${esc(r.unit)}, due ${fmtDate(r.dueDate)}</span></div><div class="right"><strong>${ksh(r.amount)}</strong>${r.dueSoon ? '<span class="pill pill-soon">Due soon</span>' : ''}</div></li>`).join('')}</ul>`;

export function render(root) {
  root.innerHTML = `
    <div class="page">
      <div id="ov-greet" class="greet"></div>
      <div id="ov-figures" class="stats"></div>
      <section class="panel"><div class="panel-head"><h3>Property overview</h3></div><div id="ov-prop"></div></section>
      <section class="panel"><div class="panel-head"><h3>Recent collections</h3><a class="link" href="#/collections">View all</a></div><div id="ov-recent"></div></section>
      <section class="panel"><div class="panel-head"><h3>Upcoming payments</h3><a class="link" href="#/tenants">View all</a></div><div id="ov-upcoming"></div></section>
    </div>`;
  const $ = id => root.querySelector(id);
  // Figures feed three areas (greeting, summary, property row) from one call.
  const figs = $('#ov-figures'), greet = $('#ov-greet'), prop = $('#ov-prop');
  greet.innerHTML = '<div class="sk sk-line"></div>'; prop.innerHTML = skeleton(1);
  section(figs, 'figures', api.getFigures, f => { greet.innerHTML = greeting(f); prop.innerHTML = property(f); return summary(f); }, 'We couldn’t load your figures. Check your connection and try again.');
  section($('#ov-recent'), 'recent', api.getRecentCollections, collections, 'We couldn’t load your rent collections. Check your connection and try again.');
  section($('#ov-upcoming'), 'upcoming', api.getUpcoming, upcomingList, 'We couldn’t load upcoming payments. Check your connection and try again.');
}
