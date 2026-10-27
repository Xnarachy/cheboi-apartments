import { api } from '../api.js';
import { esc, fmtDate, skeleton, empty, errorBlock, toast } from '../ui.js';

export function render(root) {
  root.innerHTML = `<div class="page"><div class="toolbar"><span class="muted" id="count"></span><button class="btn btn-ghost" id="all" style="margin-left:auto">Mark all as read</button></div><section class="panel" id="body"></section></div>`;
  const body = root.querySelector('#body'), allBtn = root.querySelector('#all'); let rows = [];
  const badge = () => document.dispatchEvent(new Event('cheboi:badge'));
  const draw = () => {
    const unread = rows.filter(n => !n.read).length;
    root.querySelector('#count').textContent = unread ? `${unread} unread` : '';
    allBtn.disabled = !unread;
    if (!rows.length) { body.innerHTML = empty('You’re all caught up.'); return; }
    body.innerHTML = `<ul class="notes">${rows.map(n => `<li class="note ${n.level} ${n.read ? '' : 'unread'}" data-id="${n.id}" data-link="${esc(n.link)}" tabindex="0" role="link">
      <span class="dot" aria-hidden="true"></span><div><p>${esc(n.text)}</p><span class="muted">${fmtDate(n.createdAt)}${n.level === 'action' ? ', needs action' : ''}${n.read ? '' : ', unread'}</span></div>
      ${n.read ? '' : '<button class="btn btn-ghost btn-sm" data-read>Mark as read</button>'}</li>`).join('')}</ul>`;
  };
  const load = async () => {
    body.innerHTML = skeleton(4);
    try { rows = await api.listNotifications(); draw(); badge(); }
    catch { body.innerHTML = errorBlock('We couldn’t load your notifications. Check your connection and try again.', 'notifications'); body.querySelector('[data-retry]').onclick = load; }
  };
  const open = async li => { try { await api.markRead(li.dataset.id); } catch { /* still navigate */ } badge(); location.hash = li.dataset.link; };
  body.onclick = async e => {
    const li = e.target.closest('.note'); if (!li) return;
    if (e.target.closest('[data-read]')) { try { await api.markRead(li.dataset.id); rows.find(n => n.id === li.dataset.id).read = true; draw(); badge(); } catch { toast('We couldn’t update that. Try again.'); } return; }
    open(li);
  };
  body.onkeydown = e => { if (e.key === 'Enter') { const li = e.target.closest('.note'); if (li) open(li); } };
  allBtn.onclick = async () => { try { await api.markAllRead(); rows.forEach(n => { n.read = true; }); draw(); badge(); } catch { toast('We couldn’t update that. Try again.'); } };
  load();
}
