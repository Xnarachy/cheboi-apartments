// Cheboi Apartments: business rules. Pure functions, no UI and no storage.
// These port to the real backend almost line for line. Dates are 'YYYY-MM-DD' strings (UTC math).

export const toISO = d => d.toISOString().slice(0, 10);
export const parseISO = s => new Date(s + 'T00:00:00Z');
export const addDays = (s, n) => toISO(new Date(parseISO(s).getTime() + n * 864e5));
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);

// k months after the anchor, same day each month; clamps to month end, returns to the anchor day when possible.
export function monthDate(anchor, k) {
  const a = parseISO(anchor), m = a.getUTCMonth() + k, y = a.getUTCFullYear();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return toISO(new Date(Date.UTC(y, m, Math.min(a.getUTCDate(), last))));
}

// Rent share that applies to the cycle starting on `start` (changes apply from a tenant's next cycle).
export function shareFor(t, start) {
  const h = [...t.shareHistory].sort((a, b) => a.from.localeCompare(b.from));
  let amt = h[0].amount;
  for (const e of h) if (e.from <= start) amt = e.amount;
  return amt;
}

export function cycleStarts(t, today) {
  const stop = t.moveOutDate && t.moveOutDate < today ? t.moveOutDate : today;
  const out = [];
  for (let k = 0; ; k++) { const s = monthDate(t.dueAnchor, k); if (s > stop) break; out.push(s); }
  return out;
}

export function buildCycles(t, today) {
  return cycleStarts(t, today).map((start, i) => ({
    tenantId: t.id, index: i, start, end: monthDate(t.dueAnchor, i + 1), share: shareFor(t, start), paid: 0, installments: [],
  }));
}

// Oldest-unpaid-cycle-first allocation. Overpayment is held as credit and applied to the next cycle when it starts.
export function allocate(t, payments, today) {
  const cycles = buildCycles(t, today);
  const pays = payments.filter(p => p.tenantId === t.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const allocations = [];
  let pool = 0;
  for (const p of pays) {
    let left = p.amount;
    for (const c of cycles) {
      if (left <= 0) break;
      const owe = c.share - c.paid;
      if (c.start > p.date || owe <= 0) continue;
      const a = Math.min(owe, left);
      c.paid += a; left -= a;
      allocations.push({ paymentId: p.id, cycleIndex: c.index, amount: a });
      c.installments.push({ paymentId: p.id, date: p.date, amount: a });
    }
    pool += left;
  }
  for (const c of cycles) {
    const owe = c.share - c.paid;
    if (pool <= 0) break;
    if (owe <= 0) continue;
    const a = Math.min(owe, pool);
    c.paid += a; pool -= a;
    c.installments.push({ paymentId: null, date: c.start, amount: a, credit: true });
  }
  for (const c of cycles) {
    c.balance = Math.max(0, c.share - c.paid);
    c.status = c.balance === 0 ? 'paid' : c.end <= today ? 'overdue' : c.paid > 0 ? 'partial' : 'unpaid';
  }
  return { cycles, allocations, credit: pool };
}

export const rentCollected = (payments, monthKey) =>
  payments.filter(p => p.date.startsWith(monthKey)).reduce((s, p) => s + p.amount, 0);

// Unpaid rent from cycles that START in the given calendar month (never expected minus collected).
export const amountOutstanding = (results, monthKey) =>
  results.flatMap(r => r.cycles).filter(c => c.start.startsWith(monthKey)).reduce((s, c) => s + c.balance, 0);

// Next cycle start for each active tenant, nearest first.
export function upcoming(tenants, results, today, leadDays, limit = 5) {
  return tenants.filter(t => !t.moveOutDate || t.moveOutDate > today).map(t => {
    const due = monthDate(t.dueAnchor, results[t.id].cycles.length);
    return { tenantId: t.id, dueDate: due, amount: shareFor(t, due), dueSoon: daysBetween(today, due) <= leadDays };
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, limit);
}

// ---- M-Pesa matching (used from slice 4) ----
export function normalizePhone(p) {
  const d = String(p).replace(/\D/g, '');
  if (d.startsWith('254')) return d;
  if (d.startsWith('0')) return '254' + d.slice(1);
  return d.length === 9 ? '254' + d : d;
}
const tokens = s => String(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
// Tolerant: missing middle name or different order is fine; needs two shared name parts.
export function namesMatch(a, b) {
  const B = new Set(tokens(b));
  return [...new Set(tokens(a))].filter(x => B.has(x)).length >= 2;
}
// Returns the tenant, or null (doubtful, no tenant, or ambiguous: goes to Unmatched, never auto-recorded).
export function matchPayment(msg, tenants) {
  const hits = tenants.filter(t => !t.moveOutDate && normalizePhone(t.phone) === normalizePhone(msg.phone) && namesMatch(t.name, msg.name));
  return hits.length === 1 ? hits[0] : null;
}

// ---- Units and co-living (slice 2) ----
export const isActive = (t, d) => !t.moveOutDate || t.moveOutDate > d;

// Equal split of a unit's rent between its active tenants. A tenant with an adjusted rent pays that amount,
// and the others split what remains (assumption in the spec). The first tenant takes any odd shilling.
export function unitShares(unitRent, tenants) {
  const out = {}, adj = tenants.filter(t => t.adjustedRent != null);
  adj.forEach(t => { out[t.id] = Number(t.adjustedRent); });
  const rest = tenants.filter(t => !(t.id in out));
  if (rest.length) {
    const remainder = Math.max(0, unitRent - adj.reduce((s, t) => s + out[t.id], 0)), each = Math.floor(remainder / rest.length);
    rest.forEach((t, i) => { out[t.id] = each + (i === 0 ? remainder - each * rest.length : 0); });
  }
  return out;
}

// The first cycle start after today: share changes apply from here, so current-cycle shares stay put.
export const nextCycleStart = (t, today) => monthDate(t.dueAnchor, cycleStarts(t, today).length);

// New shareHistory with `amount` applying from `from` (replaces any later entries, skips no-op entries).
export function withShareFrom(t, from, amount) {
  const h = t.shareHistory.filter(e => e.from < from).sort((a, b) => a.from.localeCompare(b.from));
  if (!h.length || h[h.length - 1].amount !== amount) h.push({ from, amount });
  return h;
}

// ---- Calendar (slice 5) ----
// Days in `monthKey` ('YYYY-MM') on which a rent cycle starts, as { 'YYYY-MM-DD': [tenantId, ...] }.
// Uses monthDate so a 31st clamps to the month end. Ignores dates before move-in and after move-out.
export function cycleStartsInMonth(tenants, monthKey) {
  const [y, m] = monthKey.split('-').map(Number), out = {};
  tenants.forEach(t => {
    const a = parseISO(t.dueAnchor), k = (y - a.getUTCFullYear()) * 12 + (m - 1 - a.getUTCMonth());
    if (k < 0) return;
    const s = monthDate(t.dueAnchor, k);
    if (s.slice(0, 7) !== monthKey || (t.moveOutDate && s > t.moveOutDate)) return;
    (out[s] ||= []).push(t.id);
  });
  return out;
}
