import { api } from './api.js';
import { esc, icons, fmtDate } from './ui.js';

// Header calendar popup: today highlighted, days when rent cycles start are marked for the current property.
export function initCalendar(root) {
  const btn = root.querySelector('#cal-btn'), pop = root.querySelector('#cal-pop');
  let key, data = null, sel = null, failed = false;
  const label = k => new Date(k + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shift = n => { const d = new Date(key + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  const draw = () => {
    const [y, m] = key.split('-').map(Number), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, count = new Date(Date.UTC(y, m, 0)).getUTCDate(), today = api.today();
    const cells = Array.from({ length: lead }, () => '<span></span>');
    for (let d = 1; d <= count; d++) {
      const iso = `${key}-${String(d).padStart(2, '0')}`, marked = data && data.days[iso], cls = `${iso === today ? 'today' : ''} ${marked ? 'mark' : ''} ${sel === iso ? 'sel' : ''}`;
      cells.push(marked ? `<button type="button" class="${cls}" data-day="${iso}" aria-label="${fmtDate(iso)}, ${marked.length} rent ${marked.length === 1 ? 'cycle starts' : 'cycles start'}">${d}</button>` : `<span class="${cls}" ${iso === today ? 'aria-current="date"' : ''}>${d}</span>`);
    }
    const list = sel && data && data.days[sel] ? `<div class="cal-list"><strong>Rent cycles start on ${fmtDate(sel)}</strong>${data.days[sel].map(t => `<a href="#/tenants/${t.id}">${esc(t.name)}, ${esc(t.unit)}</a>`).join('')}</div>`
      : `<p class="muted cal-hint">${failed ? 'We couldn’t load the calendar. <button type="button" class="btn btn-ghost btn-sm" data-retry>Retry</button>' : 'Days with a dot are when a rent cycle starts. Tap one to see whose.'}</p>`;
    pop.innerHTML = `<div class="cal-head"><button type="button" class="icon-btn rot-l" data-step="-1" aria-label="Previous month">${icons.chevron}</button><strong>${label(key)}</strong><button type="button" class="icon-btn rot-r" data-step="1" aria-label="Next month">${icons.chevron}</button></div>
      <div class="cal-grid" role="grid"><b>Mo</b><b>Tu</b><b>We</b><b>Th</b><b>Fr</b><b>Sa</b><b>Su</b>${cells.join('')}</div>${list}`;
  };
  const load = async () => { failed = false; data = null; draw(); try { data = await api.getCalendar(key); } catch { failed = true; } draw(); };
  const close = (refocus = true) => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); };
  btn.onclick = () => { if (!pop.hidden) return close(); key = api.today().slice(0, 7); sel = null; pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); load(); };
  pop.onclick = e => {
    const s = e.target.closest('[data-step]'); if (s) { key = shift(Number(s.dataset.step)); sel = null; return load(); }
    const dd = e.target.closest('[data-day]'); if (dd) { sel = dd.dataset.day; return draw(); }
    if (e.target.closest('[data-retry]')) return load();
    if (e.target.closest('a')) close(false);
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) close(); });
  document.addEventListener('mousedown', e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) close(false); });
}
