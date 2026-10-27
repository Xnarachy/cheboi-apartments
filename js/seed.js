// Sample data for the demo. Dates are generated relative to "today" so the demo always looks current.
import { allocate, monthDate, addDays, toISO } from './rules.js';

export function makeSeed(today) {
  let n = 0;
  const base = new Date(today + 'T00:00:00Z');
  const at = (monthsAgo, day) => toISO(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - monthsAgo, day)));
  const settings = () => ({ unitTypes: ['Bedsitter', '1BR', '2BR', '3BR'], allowRentAdjust: false, mpesaMode: 'review', graceDays: 3, dueSoonDays: 3 });

  const properties = [
    { id: 'prop-flats', name: 'Cheboi Flats', paybill: '522533', settings: settings() },
    { id: 'prop-villa', name: 'Cheboi Villa', paybill: '522533', settings: settings() },
  ];
  const U = (id, propertyId, name, type, rent) => ({ id, propertyId, name, type, rent });
  const units = [
    U('u1', 'prop-flats', 'A1', 'Bedsitter', 7000), U('u2', 'prop-flats', 'A2', 'Bedsitter', 7000),
    U('u3', 'prop-flats', 'A3', '1BR', 12000), U('u4', 'prop-flats', 'A4', '1BR', 12000),
    U('u5', 'prop-flats', 'B1', '1BR', 12500), U('u6', 'prop-flats', 'B2', '2BR', 18000),
    U('u7', 'prop-flats', 'B3', '2BR', 18000), U('u8', 'prop-flats', 'B4', 'Bedsitter', 7000),
    U('u9', 'prop-villa', 'V1', '2BR', 15000), U('u10', 'prop-villa', 'V2', '2BR', 15000), U('u11', 'prop-villa', 'V3', '3BR', 22000),
  ];

  const T = (id, propertyId, unitId, name, phone, occupation, moveIn, share, extra = {}) => ({
    id, propertyId, unitId, name, phone, occupation, moveInDate: moveIn, dueAnchor: moveIn,
    shareHistory: [{ from: moveIn, amount: share }], moveOutDate: null, adjustedRent: null, ...extra,
  });
  // Peter lived alone in B2; Lucy joined, so Peter's share halves from his next cycle after she moved in.
  const lucyIn = at(2, 21);
  let k = 0; while (monthDate(at(6, 15), k) <= lucyIn) k++;
  const peter = T('t6', 'prop-flats', 'u6', 'Peter Kiplagat', '0722 410 886', 'Engineer', at(6, 15), 18000);
  peter.shareHistory.push({ from: monthDate(at(6, 15), k), amount: 9000 });

  const tenants = [
    T('t1', 'prop-flats', 'u1', 'Grace Wanjiku', '0712 345 678', 'Teacher', at(14, 3), 7000),
    T('t2', 'prop-flats', 'u2', 'Brian Otieno', '0733 902 114', 'Mechanic', at(9, 8), 7000),
    T('t3', 'prop-flats', 'u3', 'Faith Njeri', '0701 558 230', 'Nurse', at(7, 12), 12000),
    T('t4', 'prop-flats', 'u4', 'Mercy Chebet', '0745 221 907', 'Shopkeeper', at(11, 19), 12000),
    T('t5', 'prop-flats', 'u5', 'James Mwangi', '0718 664 052', 'Accountant', at(5, 24), 12500),
    peter,
    T('t7', 'prop-flats', 'u6', 'Lucy Achieng', '0790 337 415', 'Graphic designer', lucyIn, 9000),
    T('t8', 'prop-flats', 'u7', 'Samuel Kariuki', '0724 876 530', 'Driver', at(10, 28), 16500, { adjustedRent: 16500 }),
    T('t9', 'prop-flats', 'u8', 'Dennis Maina', '0711 203 468', 'Student', at(10, 5), 7000, { moveOutDate: at(3, 4) }),
    T('t10', 'prop-villa', 'u9', 'Hassan Abdi', '0729 114 603', 'Trader', at(8, 5), 15000),
    T('t11', 'prop-villa', 'u10', 'Wendy Cherono', '0757 482 291', 'Pharmacist', at(4, 17), 15000),
  ];

  const patterns = { t1: 'paid', t2: 'partial', t3: 'paid', t4: 'overdue', t5: 'unpaid', t6: 'paid', t7: 'partial', t8: 'credit', t9: 'paid', t10: 'paid', t11: 'partial' };
  const payments = [];
  const ref = i => 'S' + (7000000 + i * 7919).toString(36).toUpperCase().padStart(7, 'K').slice(0, 7);
  for (const t of tenants) {
    const pat = patterns[t.id], { cycles } = allocate(t, [], today);
    const add = (date, amount) => {
      n++;
      const manual = t.id === 't4';
      payments.push({ id: 'p' + n, n, propertyId: t.propertyId, tenantId: t.id, amount, date: date > today ? today : date,
        source: manual ? 'manual' : 'mpesa', ref: manual ? null : ref(n), reassigned: false });
    };
    cycles.forEach((c, i) => {
      const last = i === cycles.length - 1, prev = i === cycles.length - 2, when = addDays(c.start, 1 + (i % 3));
      const half = Math.round(c.share / 2 / 500) * 500;
      if (pat === 'paid') add(when, c.share);
      else if (pat === 'credit') add(when, c.share + (last ? 3000 : 0));
      else if (pat === 'partial') add(when, last ? half : c.share);
      else if (pat === 'unpaid') { if (!last) add(when, c.share); }
      else if (pat === 'overdue') { if (i < cycles.length - 2) add(when, c.share); else if (prev) add(when, half); }
    });
  }

  // Recent M-Pesa payments have matching messages. Plus one waiting for review and one nobody could match.
  const recent = payments.filter(p => p.source === 'mpesa' && p.propertyId === 'prop-flats').sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n).slice(0, 6);
  const mpesa = recent.map((p, i) => {
    const t = tenants.find(x => x.id === p.tenantId);
    return { id: 'm' + (i + 1), propertyId: p.propertyId, name: t.name.toUpperCase(), phone: '254' + t.phone.replace(/\D/g, '').slice(1), amount: p.amount, ref: p.ref,
      receivedAt: `${p.date}T${String(8 + i * 2).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}:00`, status: 'recorded', tenantId: t.id, paymentId: p.id, reassigned: false, auto: false };
  });
  mpesa.push({ id: 'm7', propertyId: 'prop-flats', name: 'JAMES MWANGI', phone: '254718664052', amount: 12500, ref: 'SLC9Q2X41A', receivedAt: `${today}T08:42:00`, status: 'pending', tenantId: 't5', paymentId: null, reassigned: false, auto: false });
  mpesa.push({ id: 'm8', propertyId: 'prop-flats', name: 'ALICE NYAMBURA', phone: '254733008821', amount: 7000, ref: 'SLC9Q7M30B', receivedAt: `${today}T11:05:00`, status: 'unmatched', tenantId: null, paymentId: null, reassigned: false, auto: false });


  return {
    version: 3, session: null, paymentSeq: n,
    meta: { demoDate: null, lastPropertyId: 'prop-flats', outage: false, mpesaDown: false, simSeq: 0 },
    owner: { name: 'Eve Cheboi', email: 'eve@cheboiapartments.co.ke', password: 'demo1234' },
    properties, units, tenants, payments, mpesa, notifications: [],
  };
}
