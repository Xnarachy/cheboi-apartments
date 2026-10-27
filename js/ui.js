// Small shared helpers: formatting, icons, status pills, skeletons, empty and error states.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ksh = n => 'KSh ' + Math.round(n).toLocaleString('en-KE');
export const fmtDate = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const I = p => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const icons = {
  overview: I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  properties: I('<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>'),
  units: I('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>'),
  tenants: I('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6M18 14c1.8.7 3 2.5 3 5"/>'),
  collections: I('<path d="M3 7h18v12H3z"/><path d="M3 11h18"/><path d="M7 15h3"/>'),
  mpesa: I('<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>'),
  bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  logout: I('<path d="M9 4H5v16h4"/><path d="M16 8l4 4-4 4M20 12H9"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  chevron: I('<path d="M6 9l6 6 6-6"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  swap: I('<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
};

const LABELS = { pending: 'Pending review', unmatched: 'Unmatched', recorded: 'Recorded', rejected: 'Rejected', occupied: 'Occupied', vacant: 'Vacant', moved: 'Moved out', paid: 'Paid', partial: 'Partially paid', unpaid: 'Unpaid', overdue: 'Overdue', credit: 'Credit' };
export const pill = s => `<span class="pill pill-${s}">${LABELS[s] || esc(s)}</span>`;
export const sourceLabel = s => s === 'manual' ? '<span class="tag">Manually recorded</span>' : '<span class="tag tag-plain">M-Pesa</span>';

export const skeleton = (rows = 3) => `<div class="sk-wrap" aria-hidden="true">${'<div class="sk sk-row"></div>'.repeat(rows)}</div>`;
export const empty = (msg, action = '') => `<div class="empty"><p>${esc(msg)}</p>${action}</div>`;
export const errorBlock = (msg, id) => `<div class="error"><p>${esc(msg)}</p><button class="btn btn-ghost" data-retry="${id}">Retry</button></div>`;

let toastTimer;
export function toast(msg, ms = 2600) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export const field = (label, control, hint = '') => `<label>${esc(label)}${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</label>`;
export const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th');

// Shared toolbar: search box, segmented filter and an optional add button.
export const toolbar = (placeholder, seg, addLabel) => `<div class="toolbar"><label class="search">${icons.search}<input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"></label>
  <div class="seg" role="group" aria-label="Filter">${seg.map(([v, l], i) => `<button type="button" data-v="${v}" class="${i ? '' : 'on'}" aria-pressed="${!i}">${l}</button>`).join('')}</div>
  ${addLabel ? `<button class="btn" data-add>${addLabel}</button>` : ''}</div>`;
export function bindToolbar(root, onChange) {
  let q = '', v = root.querySelector('.seg button').dataset.v;
  const input = root.querySelector('.search input'), btns = [...root.querySelectorAll('.seg button')];
  input.oninput = () => { q = input.value.trim().toLowerCase(); onChange(q, v); };
  btns.forEach(b => { b.onclick = () => { btns.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); v = b.dataset.v; onChange(q, v); }; });
}

// Modal form. onSubmit(values) may throw; the message shows in the form and typed values are kept.
export function openModal({ title, body, submit = 'Save', onSubmit, onOpen }) {
  const dlg = document.createElement('dialog'); dlg.className = 'modal';
  dlg.innerHTML = `<form novalidate><header><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Close">${icons.close}</button></header>
    <div class="modal-body">${body}</div><p class="form-error" role="alert" hidden></p>
    <footer><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn" type="submit">${esc(submit)}</button></footer></form>`;
  document.body.append(dlg); dlg.showModal();
  const form = dlg.querySelector('form'), err = dlg.querySelector('.form-error'), btn = form.querySelector('[type=submit]');
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
  dlg.addEventListener('close', () => dlg.remove());
  form.onsubmit = async e => {
    e.preventDefault(); err.hidden = true; btn.disabled = true; const label = btn.textContent; btn.textContent = 'Saving…';
    try { await onSubmit(Object.fromEntries(new FormData(form))); close(); }
    catch (ex) {
      err.textContent = ex.message === 'Server unavailable' ? 'We couldn’t save your changes. Check your connection and try again.' : ex.message;
      err.hidden = false; btn.disabled = false; btn.textContent = label;
    }
  };
  onOpen?.(form);
  return { form, close };
}

export const fmtDateTime = iso => `${fmtDate(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
export const fmtPhone = p => { const d = String(p).replace(/\D/g, ''); return d.startsWith('254') && d.length === 12 ? `+254 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : p; };
