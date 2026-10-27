# API contract for the real build

`js/api.js` is the only file that touches storage. Each function below becomes one backend endpoint (or one call to your database layer). Keep the **return shapes** and the pages will work unchanged. Everything listed under "Demo only" disappears in the real build.

Business rules (cycles, statuses, allocation, credit, co-living shares, matching, calendar days) live in `js/rules.js` as pure functions. Run them on the server and keep this file as the single source of truth, or port it with its tests. Never store cycles, statuses, balances or credit: always derive them from tenants and payments with `allocate()`.

## Session and property
| Function | Purpose |
|---|---|
| `login(email, password)` / `logout()` / `getSession()` | One account covers all properties. Signed-out owners sign in and land on the last property used. |
| `listProperties()`, `currentProperty()`, `switchProperty(id)` | Each property is fully separate (units, tenants, payments, messages, notifications, settings). Never combine totals. |
| `ownerProfile()` | Display name and picture for the header. |

## Overview
| Function | Returns |
|---|---|
| `getFigures()` | Owner, property name, month label, `rentCollected` (payments dated this calendar month), `outstanding` (unpaid rent of cycles that START this month), unit counts, count of tenants overdue. |
| `getRecentCollections()` | Five latest payments with tenant, unit, amount, date, source, status of the cycle cleared. |
| `getUpcoming()` | Five nearest next-cycle starts with tenant, unit, amount, due date and a due-soon flag. |

## Units and tenants
| Function | Notes |
|---|---|
| `listUnits()`, `getUnit(id)`, `saveUnit(unit)` | Occupied/vacant is derived. Saving a rent or tenant change re-splits shares from each tenant's next cycle only. |
| `listTenants()`, `getTenant(id)`, `saveTenant(tenant)`, `moveOutTenant(id, date)` | `getTenant` returns cycles with installments and payment history. Dates lock once a payment exists. |
| `settings()` | Current property's settings (unit types, adjustments switch, M-Pesa mode, grace days, due-soon days). |

## Collections
| Function | Notes |
|---|---|
| `listCollections()` | Every payment up to today with the cycle it cleared and that cycle's status. Filtering by month, range, tenant, unit, status and search is done in the page today. Move it to query parameters server-side. |
| `addPayment({tenantId, amount, date})` | Manual payment, `source:'manual'`, no reference. Returns `{id, cleared:[{cycleStart, amount}], credit}`. |

## M-Pesa
| Function | Notes |
|---|---|
| `listMessages()` | Pending and unmatched first, then newest. |
| `confirmMessage(id)`, `rejectMessage(id)`, `assignMessage(id, tenantId)`, `reassignMessage(id, tenantId)` | Reassign changes the payment's tenant, flags it, and leaves date and amount untouched. |
| *(internal)* `receive(message)` | The entry point the Daraja callback calls. Ignore duplicates by transaction reference. Match with `matchPayment()`. Unmatched/doubtful never auto-record. Mode `auto` records, `review` leaves it pending. |

## Notifications
| Function | Notes |
|---|---|
| `listNotifications()`, `markRead(id)`, `markAllRead()`, `unreadCount()` | Generated from data by `syncNotifications()` with stable keys so an event never repeats. In the real build run the same logic when data changes, not on read. |

## Settings, search, calendar
| Function | Notes |
|---|---|
| `getSettings()`, `saveSettings(section, values)` | Sections: `units`, `payments`, `reminders`, `profile`. Validation messages in `api.js` are the user-facing wording. |
| `searchAll(q)` | Grouped results for tenants, units, collections, M-Pesa messages, notifications. Occupation is never searched. |
| `getCalendar('YYYY-MM')` | Days on which a cycle starts, with the tenants for each day (`cycleStartsInMonth` in `rules.js`). |

## Demo only (drop in the real build)
`today`, `realToday`, `getDemoDate`, `setDemoDate`, `getOutage`, `setOutage`, `resetDemo`, `isMpesaDown`, `setMpesaDown`, `simulatePayment`, `setAllowAdjust`, `setMpesaMode`, and the whole Demo tools panel in `js/app.js`. The real server supplies the date, and Daraja supplies payments.

## Real-build checklist
1. Pick the stack and database. Model: properties, units, tenants (with `shareHistory`), payments, mpesa_messages, notifications, settings (spec section 16 of the decisions document).
2. Implement the endpoints above. Hash the owner's password, use sessions or tokens, and scope every query by property.
3. Replace `js/api.js` bodies with `fetch` calls. Keep the same function names and return shapes.
4. Register the Daraja C2B URLs with Safaricom (sandbox first), point the callback at `receive()`, and validate the callback.
5. Move the rules to the server (or share them), re-run the rule tests, and add tests for allocation, co-living, matching and notifications.
6. Add what a mockup skips: HTTPS, password reset, rate limiting, audit trail, backups, error monitoring, and a caretaker role if wanted later.
