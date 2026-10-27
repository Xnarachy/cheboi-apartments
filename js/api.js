// The ONLY file that touches localStorage. In the real build, replace the bodies of these functions
// with network requests to the backend; pages and business rules stay unchanged.
import { allocate, rentCollected, amountOutstanding, upcoming, toISO, parseISO, daysBetween, isActive, unitShares, nextCycleStart, withShareFrom, shareFor, normalizePhone, matchPayment, cycleStartsInMonth } from './rules.js';
import { makeSeed } from './seed.js';

const KEY = 'cheboi_demo_v1', LATENCY = 250;
const realToday = () => toISO(new Date());
let db = load();

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d.version === 3) return d; } } catch (e) { /* ignore */ }
  const d = makeSeed(realToday()); persist(d); return d;
}
function persist(d = db) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable */ } }
const reply = fn => new Promise((res, rej) => setTimeout(() => {
  if (db.meta.outage) return rej(new Error('Server unavailable'));
  try { res(structuredClone(fn())); } catch (e) { rej(e); }
}, LATENCY));

const today = () => db.meta.demoDate || realToday();
const pid = () => db.meta.lastPropertyId;
function propertyData() {
  const p = pid(), d = today();
  const tenants = db.tenants.filter(t => t.propertyId === p), payments = db.payments.filter(x => x.propertyId === p);
  const units = db.units.filter(u => u.propertyId === p), results = {};
  tenants.forEach(t => { results[t.id] = allocate(t, payments, d); });
  return { tenants, payments, units, results, today: d, property: db.properties.find(x => x.id === p) };
}

export const api = {
  today, realToday,
  getSession: () => db.session,
  login: (email, password) => new Promise((res, rej) => setTimeout(() => {
    const o = db.owner;
    if (email.trim().toLowerCase() === o.email && password === o.password) { db.session = { name: o.name, email: o.email }; persist(); res(db.session); }
    else rej(new Error('That email or password is not correct. Check them and try again.'));
  }, LATENCY)),
  logout() { db.session = null; persist(); },
  listProperties: () => db.properties.map(({ id, name }) => ({ id, name })),
  currentProperty: () => db.properties.find(p => p.id === pid()),
  switchProperty(id) { db.meta.lastPropertyId = id; persist(); },
  unreadCount: () => db.notifications.filter(n => n.propertyId === pid() && !n.read).length,

  getFigures: () => reply(() => {
    const { tenants, payments, units, results, today: d, property } = propertyData();
    const month = d.slice(0, 7);
    const occupied = units.filter(u => tenants.some(t => t.unitId === u.id && isActive(t, d))).length;
    const overdueTenants = tenants.filter(t => isActive(t, d) && results[t.id].cycles.some(c => c.status === 'overdue')).length;
    return {
      owner: db.owner.name, propertyName: property.name, monthLabel: new Date(month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      rentCollected: rentCollected(payments, month), outstanding: amountOutstanding(Object.values(results), month),
      totalUnits: units.length, occupied, vacant: units.length - occupied, overdueTenants,
    };
  }),
  getRecentCollections: () => reply(() => {
    const { tenants, payments, units, results, today: d } = propertyData();
    return payments.filter(p => p.date <= d).sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n).slice(0, 5).map(p => {
      const t = tenants.find(x => x.id === p.tenantId), u = units.find(x => x.id === t.unitId);
      const al = results[t.id].allocations.find(a => a.paymentId === p.id);
      const cycle = al ? results[t.id].cycles[al.cycleIndex] : null;
      return { id: p.id, date: p.date, tenant: t.name, unit: u.name, amount: p.amount, source: p.source, cycleStatus: cycle ? cycle.status : 'credit' };
    });
  }),
  getUpcoming: () => reply(() => {
    const { tenants, units, results, today: d, property } = propertyData();
    return upcoming(tenants, results, d, property.settings.dueSoonDays).map(x => {
      const t = tenants.find(y => y.id === x.tenantId);
      return { ...x, tenant: t.name, unit: units.find(u => u.id === t.unitId).name };
    });
  }),

  // Demo controls (not part of the real product)
  getDemoDate: () => db.meta.demoDate, setDemoDate(d) { db.meta.demoDate = d || null; persist(); },
  getOutage: () => db.meta.outage, setOutage(b) { db.meta.outage = !!b; persist(); },
  resetDemo() { const s = db.session; db = makeSeed(realToday()); db.session = s; persist(); },
};

// ---- Units and tenants (slice 2) ----
const byMoveIn = (a, b) => a.moveInDate.localeCompare(b.moveInDate);
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parseISO(s));
const num = s => (s === '' || s == null ? null : Math.round(Number(s)));
function reshareUnit(unitId) {
  const d = today(), u = db.units.find(x => x.id === unitId);
  const act = db.tenants.filter(t => t.unitId === unitId && isActive(t, d)).sort(byMoveIn), sh = unitShares(u.rent, act);
  act.forEach(t => { t.shareHistory = withShareFrom(t, nextCycleStart(t, d), sh[t.id]); });
}
function tenantView(t, ctx) {
  const r = ctx.results[t.id], d = ctx.today, active = isActive(t, d), c = r.cycles[r.cycles.length - 1];
  const next = active ? nextCycleStart(t, d) : null, u = ctx.units.find(x => x.id === t.unitId);
  return { id: t.id, name: t.name, phone: t.phone, occupation: t.occupation, unitId: t.unitId, unit: u ? u.name : '', active,
    moveInDate: t.moveInDate, moveOutDate: t.moveOutDate, dueAnchor: t.dueAnchor,
    share: c ? c.share : shareFor(t, t.dueAnchor), nextShare: next ? shareFor(t, next) : null, nextDue: next,
    balance: r.cycles.reduce((s, x) => s + x.balance, 0), credit: r.credit, adjustedRent: t.adjustedRent ?? null,
    currentStatus: c ? c.status : null, hasPayments: ctx.payments.some(p => p.tenantId === t.id) };
}
function unitView(u, ctx) {
  const tenants = ctx.tenants.filter(t => t.unitId === u.id).sort(byMoveIn).map(t => tenantView(t, ctx));
  const active = tenants.filter(t => t.active);
  return { id: u.id, name: u.name, type: u.type, rent: u.rent, status: active.length ? 'occupied' : 'vacant', tenants, active };
}
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

Object.assign(api, {
  settings: () => structuredClone(api.currentProperty().settings),
  listUnits: () => reply(() => { const c = propertyData(); return c.units.map(u => unitView(u, c)).sort(byName); }),
  getUnit: id => reply(() => { const c = propertyData(), u = c.units.find(x => x.id === id); if (!u) throw new Error('Unit not found'); return unitView(u, c); }),
  listTenants: () => reply(() => { const c = propertyData(); return c.tenants.map(t => tenantView(t, c)).sort((a, b) => b.active - a.active || a.name.localeCompare(b.name)); }),
  getTenant: id => reply(() => {
    const c = propertyData(), t = c.tenants.find(x => x.id === id); if (!t) throw new Error('Tenant not found');
    const r = c.results[id], byId = Object.fromEntries(c.payments.map(p => [p.id, p]));
    return { ...tenantView(t, c),
      cycles: [...r.cycles].reverse().map(x => ({ start: x.start, end: x.end, share: x.share, paid: x.paid, balance: x.balance, status: x.status,
        installments: x.installments.map(i => ({ date: i.date, amount: i.amount, credit: !!i.credit, source: i.paymentId ? byId[i.paymentId].source : null })) })),
      history: c.payments.filter(p => p.tenantId === id).sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n).map(p => {
        const al = r.allocations.filter(a => a.paymentId === p.id);
        return { id: p.id, date: p.date, amount: p.amount, source: p.source, ref: p.ref, cycleStart: al.length ? r.cycles[al[0].cycleIndex].start : null, more: Math.max(0, al.length - 1) };
      }) };
  }),

  saveUnit: input => reply(() => {
    const p = pid(), name = String(input.name || '').trim(), rent = num(input.rent);
    if (!name) throw new Error('Enter a unit name or number.');
    if (!api.currentProperty().settings.unitTypes.includes(input.type)) throw new Error('Choose a unit type.');
    if (!(rent > 0)) throw new Error('Enter the monthly rent as a number above zero.');
    if (db.units.some(u => u.propertyId === p && u.id !== input.id && u.name.toLowerCase() === name.toLowerCase())) throw new Error('A unit with that name already exists.');
    let u = input.id && db.units.find(x => x.id === input.id);
    if (u) { Object.assign(u, { name, type: input.type, rent }); reshareUnit(u.id); }
    else { u = { id: 'u' + Date.now().toString(36), propertyId: p, name, type: input.type, rent }; db.units.push(u); }
    persist(); return { id: u.id };
  }),

  saveTenant: input => reply(() => {
    const p = pid(), name = String(input.name || '').trim(), phone = String(input.phone || '').trim(), occupation = String(input.occupation || '').trim();
    if (!name) throw new Error('Enter the tenant’s full name.');
    if (!/^254[17]\d{8}$/.test(normalizePhone(phone))) throw new Error('Enter a valid Kenyan phone number, for example 0712 345 678.');
    const unit = db.units.find(u => u.id === input.unitId && u.propertyId === p); if (!unit) throw new Error('Choose a unit.');
    const allowed = api.currentProperty().settings.allowRentAdjust, adj = allowed ? num(input.adjustedRent) : undefined;
    if (adj != null && !(adj > 0)) throw new Error('Enter the adjusted rent as a number above zero, or leave it empty.');
    const t = input.id ? db.tenants.find(x => x.id === input.id) : null;
    const locked = t && db.payments.some(x => x.tenantId === t.id);
    const moveIn = locked ? t.moveInDate : input.moveInDate, due = locked ? t.dueAnchor : (input.dueAnchor || input.moveInDate);
    if (!validDate(moveIn)) throw new Error('Enter the move-in date.');
    if (!validDate(due) || due < moveIn || daysBetween(moveIn, due) > 31) throw new Error('The rent due date must be on or within a month after the move-in date.');
    if (t) {
      Object.assign(t, { name, phone, occupation });
      if (adj !== undefined) t.adjustedRent = adj;
      if (!locked) { t.moveInDate = moveIn; t.dueAnchor = due; t.shareHistory[0].from = moveIn; }
      reshareUnit(t.unitId); persist(); return { id: t.id };
    }
    const nt = { id: 't' + Date.now().toString(36), propertyId: p, unitId: unit.id, name, phone, occupation, moveInDate: moveIn, dueAnchor: due,
      shareHistory: [{ from: moveIn, amount: 0 }], moveOutDate: null, adjustedRent: adj ?? null };
    db.tenants.push(nt);
    const act = db.tenants.filter(x => x.unitId === unit.id && isActive(x, today())).sort(byMoveIn);
    nt.shareHistory = [{ from: moveIn, amount: unitShares(unit.rent, act)[nt.id] }];
    reshareUnit(unit.id); persist(); return { id: nt.id };
  }),

  moveOutTenant: (id, date) => reply(() => {
    const t = db.tenants.find(x => x.id === id); if (!t) throw new Error('Tenant not found');
    if (!validDate(date) || date < t.moveInDate || date > today()) throw new Error('Choose a move-out date between the move-in date and today.');
    t.moveOutDate = date; reshareUnit(t.unitId); persist(); return { id };
  }),
  setAllowAdjust(b) { api.currentProperty().settings.allowRentAdjust = !!b; persist(); },
});

// ---- Rents & Collections (slice 3) ----
Object.assign(api, {
  listCollections: () => reply(() => {
    const c = propertyData();
    return c.payments.filter(p => p.date <= c.today).sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n).map(p => {
      const t = c.tenants.find(x => x.id === p.tenantId), u = c.units.find(x => x.id === t.unitId), r = c.results[t.id];
      const al = r.allocations.filter(a => a.paymentId === p.id), first = al.length ? r.cycles[al[0].cycleIndex] : null;
      return { id: p.id, date: p.date, amount: p.amount, tenantId: t.id, tenant: t.name, unitId: u.id, unit: u.name, source: p.source, ref: p.ref, reassigned: !!p.reassigned,
        cycleStart: first ? first.start : null, more: Math.max(0, al.length - 1), status: first ? first.status : 'credit' };
    });
  }),
  // Manual payments follow exactly the same allocation rules as M-Pesa ones.
  addPayment: input => reply(() => {
    const p = pid(), d = today(), t = db.tenants.find(x => x.id === input.tenantId && x.propertyId === p), amount = num(input.amount);
    if (!t || !isActive(t, d)) throw new Error('Choose a tenant.');
    if (!(amount > 0)) throw new Error('Enter the amount as a number above zero.');
    if (!validDate(input.date) || input.date > d) throw new Error('Enter the date the payment was received. It can’t be in the future.');
    const n = ++db.paymentSeq, id = 'p' + n;
    db.payments.push({ id, n, propertyId: p, tenantId: t.id, amount, date: input.date, source: 'manual', ref: null, reassigned: false });
    const r = allocate(t, db.payments.filter(x => x.propertyId === p), d);
    const cleared = r.allocations.filter(a => a.paymentId === id).map(a => ({ cycleStart: r.cycles[a.cycleIndex].start, amount: a.amount }));
    persist();
    return { id, cleared, credit: amount - cleared.reduce((sum, a) => sum + a.amount, 0) };
  }),
});

// ---- M-Pesa messages and notifications (slice 4) ----
const msgView = (m, ctx) => {
  const t = m.tenantId && ctx.tenants.find(x => x.id === m.tenantId), u = t && ctx.units.find(x => x.id === t.unitId);
  return { id: m.id, name: m.name, phone: m.phone, amount: m.amount, ref: m.ref, receivedAt: m.receivedAt, status: m.status, tenantId: m.tenantId,
    tenant: t ? t.name : null, unit: u ? u.name : null, reassigned: !!m.reassigned };
};
function recordMessage(m, tenantId, auto = false) {
  const n = ++db.paymentSeq;
  db.payments.push({ id: 'p' + n, n, propertyId: m.propertyId, tenantId, amount: m.amount, date: m.receivedAt.slice(0, 10), source: 'mpesa', ref: m.ref, reassigned: false });
  Object.assign(m, { paymentId: 'p' + n, status: 'recorded', tenantId, auto });
}
function findMsg(id, allowed) {
  const m = db.mpesa.find(x => x.id === id && x.propertyId === pid());
  if (!m) throw new Error('We couldn’t find that message.');
  if (!allowed.includes(m.status)) throw new Error('That message has already been handled.');
  return m;
}
function activeTenant(id) {
  const t = db.tenants.find(x => x.id === id && x.propertyId === pid());
  if (!t || !isActive(t, today())) throw new Error('Choose a tenant.');
  return t;
}
// Single entry point for incoming payments: the demo simulator now, the Daraja callback in the real build.
function receive(input) {
  if (db.mpesa.some(m => m.ref === input.ref) || db.payments.some(x => x.ref === input.ref)) return { duplicate: true };
  const p = pid(), d = today(), tenants = db.tenants.filter(t => t.propertyId === p && isActive(t, d));
  const t = matchPayment(input, tenants);
  const m = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), propertyId: p, name: input.name, phone: normalizePhone(input.phone),
    amount: Math.round(input.amount), ref: input.ref, receivedAt: input.receivedAt, status: 'unmatched', tenantId: null, paymentId: null, reassigned: false, auto: false };
  if (t) { m.tenantId = t.id; if (api.currentProperty().settings.mpesaMode === 'auto') recordMessage(m, t.id, true); else m.status = 'pending'; }
  db.mpesa.push(m); persist();
  return { duplicate: false, status: m.status, name: m.name };
}

// Notifications are derived from current data (idempotent, keyed) so the same event never notifies twice.
function syncNotifications() {
  const c = propertyData(), d = c.today, st = c.property.settings, p = c.property.id, want = new Map();
  const unitOf = t => (c.units.find(u => u.id === t.unitId) || {}).name, stillOverdue = new Set();
  c.tenants.forEach(t => {
    if (!isActive(t, d)) return;
    if (c.results[t.id].cycles.some(cy => cy.balance > 0 && cy.end <= d)) stillOverdue.add('overdue:' + t.id);
    const late = c.results[t.id].cycles.filter(cy => cy.balance > 0 && daysBetween(cy.end, d) >= st.graceDays);
    if (late.length) want.set('overdue:' + t.id, { type: 'overdue', level: 'action', link: '#/tenants/' + t.id, text: `${t.name} (${unitOf(t)}) is overdue past the grace period. ${ksh(late.reduce((s, x) => s + x.balance, 0))} is outstanding.` });
    const next = nextCycleStart(t, d), away = daysBetween(d, next);
    if (away >= 0 && away <= st.dueSoonDays) want.set(`due:${t.id}:${next}`, { type: 'due-soon', level: 'quiet', keep: true, link: '#/tenants/' + t.id, text: `Rent is due soon for ${t.name} (${unitOf(t)}) on ${niceDate(next)}.` });
  });
  db.mpesa.filter(m => m.propertyId === p).forEach(m => {
    if (m.status === 'unmatched') want.set('unmatched:' + m.id, { type: 'unmatched', level: 'action', link: '#/mpesa', text: `New unmatched payment: ${ksh(m.amount)} from ${m.name}.` });
    if (m.status === 'pending') want.set('pending:' + m.id, { type: 'pending', level: 'action', link: '#/mpesa', text: `Payment pending review: ${ksh(m.amount)} from ${m.name}.` });
    if (m.auto) want.set('auto:' + m.id, { type: 'recorded', level: 'quiet', keep: true, link: '#/collections', text: `${ksh(m.amount)} from ${m.name} was recorded automatically.` });
  });
  if (db.meta.mpesaDown) want.set('integration', { type: 'integration', level: 'action', link: '#/mpesa', text: 'The M-Pesa connection is failing. New payments may be missing.' });
  let changed = false;
  db.notifications = db.notifications.filter(n => {
    if (n.propertyId !== p) return true;
    const w = want.get(n.key);
    if (w) { if (n.text !== w.text) { n.text = w.text; changed = true; } return true; }
    if (n.level === 'quiet' || stillOverdue.has(n.key)) return true; // quiet items stay as history; a changed grace period never retracts a sent alert
    changed = true; return false;               // an action item whose cause has gone is removed
  });
  want.forEach((w, key) => {
    if (db.notifications.some(n => n.key === key && n.propertyId === p)) return;
    db.notifications.push({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), key, propertyId: p, type: w.type, level: w.level, text: w.text, link: w.link, createdAt: d, read: false });
    changed = true;
  });
  if (changed) persist();
}
const niceDate = iso => parseISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const ksh = n => 'KSh ' + Math.round(n).toLocaleString('en-KE');

Object.assign(api, {
  listMessages: () => reply(() => {
    const c = propertyData(), rank = s => (s === 'pending' || s === 'unmatched' ? 0 : 1);
    return db.mpesa.filter(m => m.propertyId === pid()).map(m => msgView(m, c))
      .sort((a, b) => rank(a.status) - rank(b.status) || b.receivedAt.localeCompare(a.receivedAt));
  }),
  confirmMessage: id => reply(() => { const m = findMsg(id, ['pending']); recordMessage(m, m.tenantId); persist(); return { id }; }),
  rejectMessage: id => reply(() => { findMsg(id, ['pending', 'unmatched']).status = 'rejected'; persist(); return { id }; }),
  assignMessage: (id, tenantId) => reply(() => { const m = findMsg(id, ['unmatched']), t = activeTenant(tenantId); recordMessage(m, t.id); persist(); return { id }; }),
  reassignMessage: (id, tenantId) => reply(() => {
    const m = findMsg(id, ['recorded']), t = activeTenant(tenantId);
    if (t.id === m.tenantId) throw new Error('Choose a different tenant.');
    const pay = db.payments.find(x => x.id === m.paymentId); pay.tenantId = t.id; pay.reassigned = true;
    m.tenantId = t.id; m.reassigned = true; persist(); return { id };
  }),
  isMpesaDown: () => !!db.meta.mpesaDown, setMpesaDown(b) { db.meta.mpesaDown = !!b; persist(); },
  setMpesaMode(mode) { api.currentProperty().settings.mpesaMode = mode; persist(); },

  // Demo only: build a believable incoming payment of one kind and push it through the real entry point.
  simulatePayment(kind) {
    const c = propertyData(), act = c.tenants.filter(t => isActive(t, c.today)), t = act[(db.meta.simSeq = (db.meta.simSeq || 0) + 1) % act.length];
    const now = new Date(), hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
    const ref = 'T' + (Date.now() + db.meta.simSeq).toString(36).toUpperCase().slice(-9), receivedAt = `${c.today}T${hh}:${mm}:00`;
    const words = t.name.toUpperCase().split(' '), share = tenantView(t, c).share, base = { amount: share, ref, receivedAt, phone: t.phone };
    const mine = db.mpesa.filter(m => m.propertyId === pid()).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
    const msg = kind === 'partial' ? { ...base, name: [...words].reverse().join(' ') }
      : kind === 'unknown' ? { ...base, name: 'JOSEPH ODHIAMBO', phone: '254700123456', amount: 5000 }
      : kind === 'duplicate' ? { ...base, name: mine.name, phone: mine.phone, amount: mine.amount, ref: mine.ref }
      : { ...base, name: words.join(' ') };
    const r = receive(msg); persist(); return r;
  },

  listNotifications: () => reply(() => {
    syncNotifications();
    return db.notifications.filter(n => n.propertyId === pid())
      .sort((a, b) => a.read - b.read || (a.level === 'action' ? 0 : 1) - (b.level === 'action' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));
  }),
  markRead: id => reply(() => { const n = db.notifications.find(x => x.id === id); if (n) n.read = true; persist(); return { id }; }),
  markAllRead: () => reply(() => { db.notifications.filter(n => n.propertyId === pid()).forEach(n => { n.read = true; }); persist(); return {}; }),
  unreadCount() { syncNotifications(); return db.notifications.filter(n => n.propertyId === pid() && !n.read).length; },
});

// ---- Settings, search and calendar (slice 5) ----
const EXTRA = { image: null };
const digitsOf = v => String(v).replace(/[^\d]/g, '');
const scoreText = (hay, q) => { const h = String(hay).toLowerCase(); return h === q ? 4 : h.startsWith(q) ? 3 : h.split(/\s+/).some(w => w.startsWith(q)) ? 2 : h.includes(q) ? 1 : 0; };

Object.assign(api, {
  ownerProfile: () => ({ name: db.owner.name, image: db.owner.image || EXTRA.image }),
  getSettings: () => reply(() => {
    const p = api.currentProperty(), uses = {};
    db.units.filter(u => u.propertyId === p.id).forEach(u => { uses[u.type] = (uses[u.type] || 0) + 1; });
    return { propertyName: p.name, paybill: p.paybill, settings: p.settings, uses, owner: { name: db.owner.name, image: db.owner.image || null } };
  }),
  // section: 'units' | 'payments' | 'reminders' | 'profile'
  saveSettings: (section, v) => reply(() => {
    const p = api.currentProperty(), st = p.settings;
    if (section === 'units') {
      const rows = (v.types || []).map(t => ({ from: t.from || null, to: String(t.to || '').trim() }));
      if (!rows.length || rows.some(r => !r.to)) throw new Error('Every unit type needs a name, and there must be at least one type.');
      if (new Set(rows.map(r => r.to.toLowerCase())).size !== rows.length) throw new Error('Unit type names must be different from each other.');
      const kept = new Set(rows.map(r => r.from).filter(Boolean));
      st.unitTypes.filter(t => !kept.has(t)).forEach(t => {
        const n = db.units.filter(u => u.propertyId === p.id && u.type === t).length;
        if (n) throw new Error(`“${t}” is used by ${n} ${n === 1 ? 'unit' : 'units'}, so it can’t be removed.`);
      });
      rows.filter(r => r.from && r.from !== r.to).forEach(r => db.units.forEach(u => { if (u.propertyId === p.id && u.type === r.from) u.type = r.to; }));
      st.unitTypes = rows.map(r => r.to); st.allowRentAdjust = !!v.allowRentAdjust;
    } else if (section === 'payments') {
      const paybill = digitsOf(v.paybill);
      if (!/^\d{5,7}$/.test(paybill)) throw new Error('Enter the Paybill or Till number using 5 to 7 digits.');
      if (!['review', 'auto'].includes(v.mpesaMode)) throw new Error('Choose how M-Pesa payments are handled.');
      p.paybill = paybill; st.mpesaMode = v.mpesaMode;   // never touches messages already pending review
    } else if (section === 'reminders') {
      const g = Number(v.graceDays), l = Number(v.dueSoonDays);
      if (![g, l].every(x => Number.isInteger(x) && x >= 0 && x <= 30)) throw new Error('Enter whole days between 0 and 30.');
      st.graceDays = g; st.dueSoonDays = l;
    } else if (section === 'profile') {
      const name = String(v.name || '').trim();
      if (!name || name.length > 60) throw new Error('Enter a display name of up to 60 characters.');
      if (v.image && (!/^data:image\//.test(v.image) || v.image.length > 400000)) throw new Error('That picture is too large. Choose a smaller one.');
      db.owner.name = name; if (v.image !== undefined) db.owner.image = v.image || null;
    } else throw new Error('Unknown settings section');
    persist(); return { ok: true };
  }),

  // Global search across the current property. Occupation is deliberately never searched.
  searchAll: raw => reply(() => {
    const q = String(raw || '').trim().toLowerCase(), qd = digitsOf(q), qp = qd.replace(/^0/, '');
    if (q.length < 2) return [];
    const c = propertyData(), lim = 5, fmt = iso => parseISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const phoneScore = ph => (qd.length >= 3 && normalizePhone(ph).includes(qp) ? (normalizePhone(ph).slice(3).startsWith(qp) ? 3 : 2) : 0);
    const amountScore = a => (qd && !/[a-z]/.test(q) ? (String(a) === qd ? 4 : String(a).includes(qd) && qd.length >= 3 ? 1 : 0) : 0);
    const groups = [];
    const add = (key, label, items) => { const hit = items.filter(i => i.score > 0).sort((a, b) => b.score - a.score || (b.recent || '').localeCompare(a.recent || '')).slice(0, lim); if (hit.length) groups.push({ key, label, items: hit, best: hit[0].score }); };
    add('tenants', 'Tenants', c.tenants.map(t => { const u = c.units.find(x => x.id === t.unitId);
      return { id: t.id, title: t.name, sub: `${u ? u.name : ''}, ${t.phone}`, link: '#/tenants/' + t.id, score: Math.max(scoreText(t.name, q), scoreText(u ? u.name : '', q), phoneScore(t.phone)) }; }));
    add('units', 'Units', c.units.map(u => ({ id: u.id, title: 'Unit ' + u.name, sub: u.type, link: '#/units/' + u.id, score: Math.max(scoreText(u.name, q), scoreText(u.type, q)) })));
    add('collections', 'Collections', c.payments.filter(p => p.date <= c.today).map(p => { const t = c.tenants.find(x => x.id === p.tenantId);
      return { id: p.id, title: `${ksh(p.amount)} from ${t.name}`, sub: fmt(p.date), link: '#/collections?q=' + encodeURIComponent(raw.trim()), recent: p.date,
        score: Math.max(scoreText(t.name, q), amountScore(p.amount), scoreText(fmt(p.date), q), scoreText(p.date, q)) }; }));
    add('mpesa', 'M-Pesa messages', db.mpesa.filter(m => m.propertyId === pid()).map(m => ({ id: m.id, title: `${m.name}, ${ksh(m.amount)}`, sub: m.ref, link: '#/mpesa?q=' + encodeURIComponent(raw.trim()), recent: m.receivedAt,
      score: Math.max(scoreText(m.name, q), amountScore(m.amount), phoneScore(m.phone), scoreText(m.ref, q)) })));
    add('notifications', 'Notifications', db.notifications.filter(n => n.propertyId === pid()).map(n => ({ id: n.id, title: n.text, sub: '', link: n.link, recent: n.createdAt, score: scoreText(n.text, q) })));
    return groups.sort((a, b) => b.best - a.best);
  }),

  getCalendar: monthKey => reply(() => {
    const c = propertyData(), days = cycleStartsInMonth(c.tenants, monthKey), out = {};
    Object.entries(days).forEach(([d, ids]) => { out[d] = ids.map(id => { const t = c.tenants.find(x => x.id === id); return { id, name: t.name, unit: c.units.find(u => u.id === t.unitId).name }; }); });
    return { today: c.today, days: out };
  }),
});

export const monthName = iso => parseISO(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
