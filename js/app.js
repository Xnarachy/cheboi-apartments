import { api } from './api.js';
import { icons, esc, toast } from './ui.js';
import { initSearch } from './search.js';
import { initCalendar } from './calendar.js';

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'properties', label: 'Properties', icon: 'properties', children: [{ id: 'units', label: 'Units', icon: 'units' }, { id: 'tenants', label: 'Tenants', icon: 'tenants' }] },
  { id: 'collections', label: 'Rents & Collections', icon: 'collections' },
  { id: 'mpesa', label: 'M-Pesa Messages', icon: 'mpesa' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
const TITLES = { overview: 'Overview', units: 'Units', tenants: 'Tenants', collections: 'Rents & Collections', mpesa: 'M-Pesa Messages', notifications: 'Notifications', settings: 'Settings' };
const PAGES = { settings: () => import('./pages/settings.js'), overview: () => import('./pages/overview.js'), units: () => import('./pages/units.js'), tenants: () => import('./pages/tenants.js'), collections: () => import('./pages/collections.js'), mpesa: () => import('./pages/mpesa.js'), notifications: () => import('./pages/notifications.js') };

const app = document.getElementById('app');
const parts = () => (location.hash.replace('#/', '') || 'overview').split('?')[0].split('/');
const route = () => parts()[0];
const query = () => new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
let propsOpen = false;

/* ---------- Login ---------- */
function renderLogin() {
  app.innerHTML = `
    <main class="login"><form class="login-card" id="login" novalidate>
      <div class="brand brand-dark"><span class="logo">${icons.properties}</span><span>Cheboi Apartments</span></div>
      <h1>Sign in</h1><p class="muted">Manage your properties, tenants and rent.</p>
      <label>Email<input name="email" type="email" autocomplete="username" value="${esc(api.getSession()?.email || 'eve@cheboiapartments.co.ke')}" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="form-error" id="login-error" role="alert" hidden></p>
      <button class="btn" type="submit">Sign in</button>
      <p class="hint">Demo login: eve@cheboiapartments.co.ke with password demo1234</p>
    </form></main>`;
  const form = document.getElementById('login'), err = document.getElementById('login-error');
  form.onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in…';
    try { await api.login(form.email.value, form.password.value); location.hash = '#/overview'; start(); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Sign in'; }
  };
}

/* ---------- Shell ---------- */
function navHTML(active) {
  const item = (n, child) => `<a class="nav-link ${child ? 'child' : ''} ${active === n.id ? 'active' : ''}" href="#/${n.id}" ${active === n.id ? 'aria-current="page"' : ''}>${icons[n.icon]}<span>${n.label}</span>${n.id === 'notifications' && api.unreadCount() ? `<b class="count">${api.unreadCount()}</b>` : ''}</a>`;
  return NAV.map(n => n.children
    ? `<div class="nav-group ${propsOpen ? 'open' : ''}"><button class="nav-link parent" aria-expanded="${propsOpen}" data-toggle="props">${icons[n.icon]}<span>${n.label}</span><i class="chev">${icons.chevron}</i></button><div class="nav-children">${n.children.map(c => item(c, true)).join('')}</div></div>`
    : item(n)).join('');
}

function switcherHTML() {
  const list = api.listProperties();
  if (list.length < 2) return '';
  return `<div class="switcher"><button id="sw-btn" aria-haspopup="listbox" aria-expanded="false">${icons.swap}<span>${esc(api.currentProperty().name)}</span><i class="chev">${icons.chevron}</i></button>
    <ul id="sw-list" role="listbox" hidden>${list.map(p => `<li role="option" data-id="${p.id}" tabindex="0" aria-selected="${p.id === api.currentProperty().id}">${esc(p.name)}</li>`).join('')}</ul></div>`;
}

function renderShell() {
  const s = api.getSession(), initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  app.innerHTML = `
    <div class="shell">
      <div class="scrim" id="scrim"></div>
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <div class="brand"><span class="logo">${icons.properties}</span><span>Cheboi Apartments</span></div>
        <div id="switcher-slot">${switcherHTML()}</div>
        <nav id="nav"></nav>
        <div class="sidebar-foot"><a class="nav-link" href="#/login" id="logout">${icons.logout}<span>Logout</span></a></div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn only-narrow" id="menu-btn" aria-label="Open menu">${icons.menu}</button>
          <h1 class="topbar-title" id="title"></h1>
          <div class="topbar-actions">
            <button class="icon-btn" id="search-btn" aria-label="Search" aria-expanded="false">${icons.search}</button>
            <div class="cal" id="cal"><button class="icon-btn" id="cal-btn" aria-label="Calendar" aria-expanded="false" aria-haspopup="dialog">${icons.calendar}</button><div class="cal-pop" id="cal-pop" role="dialog" aria-label="Calendar" hidden></div></div>
            <a class="icon-btn" href="#/notifications" aria-label="Notifications" id="bell">${icons.bell}<b class="count" id="bell-count" hidden></b></a>
            <div class="me"><span class="avatar" id="avatar" aria-hidden="true"></span><span class="me-name" id="me-name"></span></div>
          </div>
          <div class="gsearch-box" id="search-box" hidden><span class="gs-icon">${icons.search}</span><input id="search-input" type="search" role="combobox" aria-label="Search this property" aria-expanded="false" aria-controls="search-results" aria-autocomplete="list" placeholder="Search tenants, units, payments and messages" autocomplete="off"><button type="button" class="icon-btn" id="search-close" aria-label="Close search">${icons.close}</button><div id="search-results" class="gs-results" role="listbox" hidden></div></div>
        </header>
        <main id="view" tabindex="-1"></main>
      </div>
    </div>`;
  const root = document.documentElement;
  const closeDrawer = () => { if (root.classList.contains('drawer-open')) { root.classList.remove('drawer-open'); document.getElementById('menu-btn').focus({ preventScroll: true }); } };
  document.getElementById('menu-btn').onclick = () => { root.classList.add('drawer-open'); setTimeout(() => document.querySelector('#sidebar a.nav-link')?.focus(), 50); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  document.getElementById('scrim').onclick = closeDrawer;
  document.getElementById('sidebar').addEventListener('click', e => {
    if (e.target.closest('[data-toggle="props"]')) { propsOpen = !propsOpen; paintNav(); }
    else if (e.target.closest('a.nav-link')) closeDrawer();
  });
  document.getElementById('logout').onclick = e => { e.preventDefault(); api.logout(); location.hash = '#/login'; renderLogin(); };
  initSearch(app.querySelector('.topbar')); initCalendar(app.querySelector('.topbar'));
  paintProfile();
  // Clickable cards get keyboard access (table rows already contain a link).
  const view = document.getElementById('view'), enhance = () => view.querySelectorAll('li[data-href]:not([tabindex])').forEach(el => { el.tabIndex = 0; el.setAttribute('role', 'link'); });
  new MutationObserver(enhance).observe(view, { childList: true, subtree: true });
  view.addEventListener('keydown', e => { const el = e.target.closest('li[data-href]'); if (e.key === 'Enter' && el && e.target === el) location.hash = el.dataset.href; });
  bindSwitcher();
}

function bindSwitcher() {
  const btn = document.getElementById('sw-btn'); if (!btn) return;
  const list = document.getElementById('sw-list');
  const set = open => { list.hidden = !open; btn.setAttribute('aria-expanded', open); };
  btn.onclick = e => { e.stopPropagation(); set(list.hidden); };
  document.addEventListener('click', () => set(false));
  const pick = li => { api.switchProperty(li.dataset.id); document.getElementById('switcher-slot').innerHTML = switcherHTML(); bindSwitcher(); paintNav(); renderView(); document.documentElement.classList.remove('drawer-open'); };
  list.onclick = e => { const li = e.target.closest('li'); if (li) pick(li); };
  list.onkeydown = e => { if (e.key === 'Enter') { const li = e.target.closest('li'); if (li) pick(li); } };
}

function paintProfile() {
  const o = api.ownerProfile(), av = document.getElementById('avatar'), nm = document.getElementById('me-name');
  if (!av) return;
  nm.textContent = o.name; av.innerHTML = o.image ? `<img src="${o.image}" alt="">` : esc(o.name.split(' ').map(w => w[0]).join('').slice(0, 2));
}

function paintNav() {
  const r = route();
  if (r === 'units' || r === 'tenants') propsOpen = true;
  document.getElementById('nav').innerHTML = navHTML(r);
  const n = api.unreadCount(), c = document.getElementById('bell-count');
  c.hidden = !n; c.textContent = n;
}

async function renderView() {
  const r = route(), view = document.getElementById('view');
  document.getElementById('title').textContent = TITLES[r] || 'Overview';
  document.title = `${TITLES[r] || 'Overview'} · Cheboi Apartments`;
  paintNav();
  view.onclick = null; // pages attach their own handler; never inherit the previous page's
  if (PAGES[r]) { const m = await PAGES[r](); m.render(view, { id: parts()[1], query: query() }); }
  else { document.getElementById('title').textContent = 'Page not found'; view.innerHTML = `<div class="page"><section class="panel"><div class="empty"><p>We couldn’t find that page.</p><a class="link" href="#/overview">Back to Overview</a></div></section></div>`; }
  view.scrollTo?.(0, 0); window.scrollTo(0, 0);
}

/* ---------- Demo tools (not part of the real product) ---------- */
function mountDemoTools() {
  if (document.getElementById('demo')) return;
  const d = document.createElement('div'); d.id = 'demo';
  d.innerHTML = `<button id="demo-btn" class="demo-btn" aria-expanded="false">Demo tools</button>
    <div class="demo-panel" id="demo-panel" hidden>
      <label>Pretend today is<input type="date" id="demo-date"></label>
      <button class="btn btn-ghost" id="demo-today">Use the real date</button>
      <label class="check"><input type="checkbox" id="demo-outage"> Simulate a server error</label>
      <h4>Simulate incoming M-Pesa payment</h4>
      <div class="demo-grid"><button class="btn btn-ghost btn-sm" data-sim="exact">Exact match</button><button class="btn btn-ghost btn-sm" data-sim="partial">Partial name</button><button class="btn btn-ghost btn-sm" data-sim="unknown">Unknown sender</button><button class="btn btn-ghost btn-sm" data-sim="duplicate">Duplicate</button></div>
      <label class="check"><input type="checkbox" id="demo-down"> Simulate M-Pesa connection failing</label>
      <button class="btn btn-ghost" id="demo-reset">Reset demo data</button>
    </div>`;
  document.body.append(d);
  const panel = d.querySelector('#demo-panel'), date = d.querySelector('#demo-date');
  const sync = () => { date.value = api.today(); d.querySelector('#demo-outage').checked = api.getOutage(); d.querySelector('#demo-down').checked = api.isMpesaDown(); };
  d.querySelector('#demo-btn').onclick = () => { panel.hidden = !panel.hidden; sync(); };
  date.onchange = () => { api.setDemoDate(date.value === api.realToday() ? null : date.value); renderView(); };
  d.querySelector('#demo-today').onclick = () => { api.setDemoDate(null); sync(); renderView(); };
  d.querySelector('#demo-outage').onchange = e => { api.setOutage(e.target.checked); renderView(); };
  d.querySelector('#demo-down').onchange = e => { api.setMpesaDown(e.target.checked); renderView(); };
  const SIM = { pending: 'is waiting for your review', unmatched: 'could not be matched', recorded: 'was recorded automatically' };
  d.querySelectorAll('[data-sim]').forEach(b => b.onclick = () => {
    const r = api.simulatePayment(b.dataset.sim);
    toast(r.duplicate ? 'Duplicate payment ignored. It was not counted twice.' : `Payment from ${r.name} ${SIM[r.status]}.`, 4000); renderView();
  });
  d.querySelector('#demo-reset').onclick = () => { api.resetDemo(); api.setOutage(false); sync(); renderView(); toast('Demo data reset.'); };
}

function start() {
  if (!api.getSession()) { document.getElementById('demo')?.remove(); return renderLogin(); }
  if (route() === 'login') location.hash = '#/overview';
  renderShell(); mountDemoTools(); renderView();
}
document.addEventListener('cheboi:profile', paintProfile);
document.addEventListener('cheboi:badge', () => { if (document.getElementById('nav')) paintNav(); });
window.addEventListener('hashchange', () => { document.documentElement.classList.remove('drawer-open'); if (api.getSession() && document.getElementById('view')) renderView(); else if (api.getSession()) start(); });
start();
