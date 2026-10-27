import { api } from '../api.js';
import { esc, skeleton, errorBlock, toast } from '../ui.js';

const card = (id, title, hint, body) => `<form class="panel card" data-card="${id}" novalidate><h3>${title}</h3><p class="muted">${hint}</p>${body}
  <div class="form-error" role="alert" hidden></div><div class="card-foot"><button class="btn" type="submit">Save</button></div></form>`;

function shrink(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader(); fr.onerror = rej;
    fr.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => {
      const s = 160, c = document.createElement('canvas'), m = Math.min(im.width, im.height); c.width = c.height = s;
      c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, s, s); res(c.toDataURL('image/jpeg', 0.85));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });
}

export function render(root) {
  root.innerHTML = `<div class="page narrow"><div><h2 id="s-title">Settings</h2><p class="muted" id="s-sub"></p></div><div id="cards">${skeleton(4)}</div></div>`;
  const wrap = root.querySelector('#cards');
  const load = async () => {
    wrap.innerHTML = skeleton(4);
    let d;
    try { d = await api.getSettings(); } catch { wrap.innerHTML = errorBlock('We couldn’t load your settings. Check your connection and try again.', 'settings'); wrap.querySelector('[data-retry]').onclick = load; return; }
    root.querySelector('#s-sub').textContent = `These settings apply to ${d.propertyName} only.`;
    const st = d.settings; let types = st.unitTypes.map(t => ({ from: t, to: t, uses: d.uses[t] || 0 })), img;
    wrap.innerHTML = `<div class="cards-col">
      ${card('units', 'Rent and units', 'Unit types and how rent can be set.', `
        <div class="block"><span class="lbl">Unit types</span><ul class="types" id="types"></ul>
        <div class="add-row"><input type="text" id="new-type" placeholder="New unit type" aria-label="New unit type"><button type="button" class="btn btn-ghost btn-sm" id="add-type">Add</button></div>
        <span class="hint">A type used by a unit can’t be removed. Renaming a type updates its units.</span></div>
        <label class="switch-row"><span><strong>Allow tenant rent adjustments</strong><span class="hint">Lets you set a different rent for an individual tenant. Off by default.</span></span><input type="checkbox" role="switch" name="allowRentAdjust" ${st.allowRentAdjust ? 'checked' : ''}></label>`)}
      ${card('payments', 'Payments', 'How M-Pesa payments reach your records.', `
        <fieldset class="radios"><legend class="lbl">M-Pesa handling</legend>
          <label class="radio"><input type="radio" name="mpesaMode" value="review" ${st.mpesaMode === 'review' ? 'checked' : ''}><span><strong>Review first</strong><span class="hint">Matched payments wait for you to confirm. Recommended while the system is new.</span></span></label>
          <label class="radio"><input type="radio" name="mpesaMode" value="auto" ${st.mpesaMode === 'auto' ? 'checked' : ''}><span><strong>Automatic</strong><span class="hint">Matched payments are recorded straight away. Payments already waiting stay as they are.</span></span></label></fieldset>
        <label>Paybill or Till number<input type="text" name="paybill" inputmode="numeric" value="${esc(d.paybill)}" autocomplete="off"><span class="hint">The number this property receives M-Pesa payments on.</span></label>`)}
      ${card('reminders', 'Reminders and alerts', 'When you are told about rent. Changes affect new notifications only.', `
        <div class="two"><label>Grace period (days)<input type="number" name="graceDays" min="0" max="30" step="1" value="${st.graceDays}"><span class="hint">Days after a cycle becomes overdue before you are notified.</span></label>
        <label>Due soon lead time (days)<input type="number" name="dueSoonDays" min="0" max="30" step="1" value="${st.dueSoonDays}"><span class="hint">How early to remind you before rent is due.</span></label></div>`)}
      ${card('profile', 'Profile', 'How you appear in the dashboard.', `
        <label>Display name<input type="text" name="name" value="${esc(d.owner.name)}" maxlength="60" autocomplete="name"></label>
        <div class="block"><span class="lbl">Profile picture</span><div class="pic-row"><span class="avatar big" id="pic"></span><label class="btn btn-ghost btn-sm file">Choose picture<input type="file" accept="image/*" id="pic-file" hidden></label><button type="button" class="btn btn-ghost btn-sm" id="pic-rm">Remove</button></div></div>`)}</div>`;

    const drawTypes = () => { wrap.querySelector('#types').innerHTML = types.map((t, i) => `<li><input type="text" value="${esc(t.to)}" data-i="${i}" aria-label="Unit type name"><span class="muted">${t.uses ? `Used by ${t.uses}` : ''}</span><button type="button" class="btn btn-ghost btn-sm" data-rm="${i}" ${t.from && t.uses ? 'disabled title="In use, so it can’t be removed"' : ''}>Remove</button></li>`).join(''); };
    const drawPic = () => { const src = img === undefined ? d.owner.image : img, el = wrap.querySelector('#pic'); el.innerHTML = src ? `<img src="${src}" alt="">` : esc(d.owner.name.split(' ').map(w => w[0]).join('').slice(0, 2)); };
    drawTypes(); drawPic();
    const typesEl = wrap.querySelector('#types');
    typesEl.oninput = e => { const i = e.target.dataset.i; if (i != null) types[i].to = e.target.value; };
    typesEl.onclick = e => { const b = e.target.closest('[data-rm]'); if (b && !b.disabled) { types.splice(Number(b.dataset.rm), 1); drawTypes(); } };
    wrap.querySelector('#add-type').onclick = () => { const inp = wrap.querySelector('#new-type'); if (inp.value.trim()) { types.push({ from: null, to: inp.value.trim(), uses: 0 }); inp.value = ''; drawTypes(); } };
    wrap.querySelector('#new-type').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); wrap.querySelector('#add-type').click(); } };
    wrap.querySelector('#pic-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { img = await shrink(f); drawPic(); } catch { toast('We couldn’t read that picture. Try another.'); } };
    wrap.querySelector('#pic-rm').onclick = () => { img = null; drawPic(); };

    const collect = (id, f) => ({
      units: () => ({ types: types.map(t => ({ from: t.from, to: t.to })), allowRentAdjust: f.allowRentAdjust.checked }),
      payments: () => ({ mpesaMode: f.mpesaMode.value, paybill: f.paybill.value }),
      reminders: () => ({ graceDays: f.graceDays.value, dueSoonDays: f.dueSoonDays.value }),
      profile: () => ({ name: f.name.value, ...(img !== undefined ? { image: img } : {}) }),
    }[id]());
    wrap.querySelectorAll('form').forEach(f => {
      const err = f.querySelector('.form-error'), btn = f.querySelector('[type=submit]');
      const save = async () => {
        err.hidden = true; btn.disabled = true; btn.textContent = 'Saving…';
        try {
          await api.saveSettings(f.dataset.card, collect(f.dataset.card, f));
          toast('Saved.'); if (f.dataset.card === 'profile') document.dispatchEvent(new Event('cheboi:profile'));
          if (f.dataset.card === 'units') { d.uses = (await api.getSettings()).uses; types = types.map(t => ({ from: t.to, to: t.to, uses: d.uses[t.to] || 0 })); drawTypes(); }
          if (f.dataset.card === 'profile') { d.owner = { name: f.name.value.trim(), image: img === undefined ? d.owner.image : img }; img = undefined; drawPic(); }
        } catch (ex) {
          const down = ex.message === 'Server unavailable';
          err.innerHTML = `${esc(down ? 'We couldn’t save your changes. Check your connection and try again.' : ex.message)}${down ? ' <button type="button" class="btn btn-ghost btn-sm" data-retry-save>Try again</button>' : ''}`; err.hidden = false;
          err.querySelector('[data-retry-save]')?.addEventListener('click', save);
        } finally { btn.disabled = false; btn.textContent = 'Save'; }
      };
      f.onsubmit = e => { e.preventDefault(); save(); };
    });
  };
  load();
}
