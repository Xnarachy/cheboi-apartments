import { api } from './api.js';
import { esc } from './ui.js';

// Header search: expands in place, results grouped as you type, best matches first.
export function initSearch(root) {
  const btn = root.querySelector('#search-btn'), box = root.querySelector('#search-box'), input = root.querySelector('#search-input'), res = root.querySelector('#search-results');
  let timer, token = 0, links = [], active = -1;
  const open = () => { box.hidden = false; btn.setAttribute('aria-expanded', 'true'); input.focus(); };
  const close = (refocus = true) => { box.hidden = true; res.hidden = true; input.value = ''; links = []; active = -1; btn.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); };
  const setActive = i => { links.forEach((a, n) => a.classList.toggle('active', n === i)); active = i; input.setAttribute('aria-activedescendant', i >= 0 ? links[i].id : ''); links[i]?.scrollIntoView({ block: 'nearest' }); };
  const show = html => { res.innerHTML = html; res.hidden = false; input.setAttribute('aria-expanded', 'true'); };
  const run = async () => {
    const q = input.value.trim(), mine = ++token;
    if (q.length < 2) { res.hidden = true; links = []; return; }
    try {
      const groups = await api.searchAll(q); if (mine !== token) return;
      if (!groups.length) { links = []; return show('<p class="gs-empty">No results for that search.</p>'); }
      let n = 0;
      show(groups.map(g => `<div class="gs-group" role="group" aria-label="${esc(g.label)}"><h4>${esc(g.label)}</h4>${g.items.map(i => `<a class="gs-item" role="option" id="gs-${n++}" href="${esc(i.link)}"><strong>${esc(i.title)}</strong>${i.sub ? `<span class="muted">${esc(i.sub)}</span>` : ''}</a>`).join('')}</div>`).join(''));
      links = [...res.querySelectorAll('.gs-item')]; active = -1;
    } catch {
      if (mine !== token) return; links = [];
      show('<div class="gs-empty">We couldn’t run that search. <button type="button" class="btn btn-ghost btn-sm" data-retry>Retry</button></div>');
      res.querySelector('[data-retry]').onclick = run;
    }
  };
  btn.onclick = open;
  root.querySelector('#search-close').onclick = () => close();
  input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 150); };
  input.onkeydown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); setActive((active + 1) % links.length); }
    else if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); setActive((active - 1 + links.length) % links.length); }
    else if (e.key === 'Enter' && links.length) { e.preventDefault(); const a = links[active >= 0 ? active : 0]; location.hash = a.getAttribute('href'); close(false); }
  };
  res.onclick = e => { if (e.target.closest('.gs-item')) close(false); };
  document.addEventListener('mousedown', e => { if (!box.hidden && !box.contains(e.target) && !btn.contains(e.target)) close(false); });
}
