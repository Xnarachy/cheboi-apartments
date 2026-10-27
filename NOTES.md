# Project notes

Working notes for whoever picks this project up next (including you in a month). The design decisions document in `docs/` is the source of truth for what the product should do. These notes cover how the mockup is built, what was decided along the way, and what is next.

## Status
The mockup is **complete**: login, Overview, Units, Tenants, Rents & Collections, M-Pesa Messages, Notifications, Settings, global search and calendar. It was built in five slices and tested in a browser at desktop and phone width (down to 320px) with no console errors.

## How it is built
- **Three layers.** UI in `js/pages/` and `js/ui.js`. Business rules in `js/rules.js` (pure functions, no UI, no storage). Storage only in `js/api.js`. Pages never touch localStorage.
- **Derived, never stored.** Rent cycles, statuses, balances and credit are always calculated from tenants and payments by `allocate()` in `rules.js`. The only things stored are tenants, units, payments, M-Pesa messages, notifications and settings.
- **Every api function returns a Promise** with a short delay, so loading skeletons and error states are real. Turning on "Simulate a server error" in Demo tools makes them all fail.
- **Pages** export `render(container, {id, query})`. Routes look like `#/tenants`, `#/tenants/<id>` and `#/collections?q=text`. To add a page, create `js/pages/name.js`, add it to `PAGES` and `TITLES` in `js/app.js`, and add a sidebar entry in `NAV`.
- **Responsive.** Wide screens show tables and a fixed sidebar. Narrow screens (under 900px) show cards and a sliding menu. Classes `only-wide` and `only-narrow` switch between them.
- **Dates** are `YYYY-MM-DD` strings and all date maths is in UTC, so time zones cannot shift a rent day.

## Core rules (from the design document)
- A tenant's rent cycle runs from their move-in date and never shifts. Rent is due on the same day each month (a 31st becomes the last day of shorter months).
- A payment clears the **oldest** unpaid cycle first. An overpayment becomes credit and is applied when the next cycle starts.
- **Amount outstanding** is unpaid rent from cycles that start in the current month. It is never "expected minus collected".
- Co-living rent splits equally. When a tenant joins or leaves, the others' shares change **from their own next cycle**, never the current one.
- M-Pesa payments match on exact phone number plus a tolerant name match (two shared name parts). Anything doubtful, unknown or ambiguous goes to Unmatched and is never recorded automatically. A transaction reference is never counted twice.
- Red is used only for outstanding rent and alerts.

## Decisions made while building (change them if the owner disagrees)
**Units and tenants**
- The "rent due date" is the day a tenant's first cycle starts. It must be on or within 31 days after move-in, and it locks once the tenant has any payment.
- A tenant's unit cannot be changed by editing. Move them out and add them again.
- The move-out date cannot be in the future. Units and tenants cannot be deleted.
- A tenant with an adjusted rent pays that amount and the others split the remainder. This means a second tenant added beside an adjusted tenant may get only a small remainder.
- Search and filters run in the page on the loaded list. A real backend would filter on the server.

**Collections**
- The Status column shows the status of the cycle the payment cleared, as of the demo date.
- Only active tenants can be paid. A payment date cannot be in the future.

**M-Pesa and notifications**
- Sender names show as M-Pesa sends them (capitals). A recorded M-Pesa payment takes the message's date.
- Only active tenants can be assigned or reassigned to. Rejecting asks for confirmation and cannot be undone.
- Overdue notifications are one per tenant, listing the total outstanding. Action alerts disappear when their cause is resolved. Quiet ones (due soon, recorded automatically) stay as history.

**Settings, search, calendar**
- Settings belong to the current property. A grace period or lead time change affects new notifications only, and an alert already sent is never taken back.
- Paybill or Till numbers must be 5 to 7 digits. The profile picture is shrunk to 160px and stored in the browser.
- Search covers the current property only and never searches occupation. The calendar starts weeks on Monday.

## Open questions for the owner
- Grace period and due-soon lead time (placeholder 3 days each).
- Do tenants use their unit name as the Paybill account number?
- How should a co-living tenant with an adjusted rent be handled exactly?
- Should move-in and due dates stay editable after payments exist?
- Is a caretaker role wanted later?

## Developer gotchas
- **Resetting saved demo data.** Data is saved under the key `cheboi_demo_v1`. If you change the shape of the sample data, raise `version` in `js/seed.js` **and** the matching check in `load()` in `js/api.js`. Saved data with an older version is replaced automatically.
- **The `hidden` attribute.** `styles.css` ends with a rule that forces `[hidden]` to hide. Without it, any element with its own `display` style ignores `hidden`.
- **Page click handlers.** `renderView()` clears the page container's `onclick` before each render. Attach page handlers to the container inside `render`, never to `document`, or they will fire on other pages.
- **Testing the rules without a browser.** `js/rules.js` has no dependencies. In Node: `import * as r from './js/rules.js'` and call functions such as `r.allocate(tenant, payments, '2026-10-27')`.
- **Fonts.** Manrope loads from Google Fonts. If blocked, the page falls back to a system font.

## Test checklist before showing the client
1. Log in, switch between the two properties, and check the figures change.
2. Add a tenant to a unit that already has one. Check the first tenant's share changes only from their next cycle.
3. Add a cash payment for an overdue tenant. Check the oldest cycle clears and the Overview updates.
4. In Demo tools, simulate each payment type. Confirm one, assign the unmatched one, reassign a recorded one.
5. Move the demo date forward a few weeks. Check overdue alerts appear once per tenant.
6. Use the header search (try a phone number and an amount) and the calendar.
7. Open it on a real phone. Refresh on a deep page like a tenant's detail.
8. Press "Reset demo data" at the end.

## Building the real website
1. Keep the UI, the design, and `js/rules.js`. Replace `js/api.js` with real requests (see `docs/API_CONTRACT.md` for every function and its return shape).
2. Build the backend and database. Scope every query by property, hash the owner's password, use sessions or tokens, and use HTTPS.
3. Add the Safaricom Daraja integration: start in the sandbox, register the C2B URLs, send callbacks to the same logic as `receive()` in `api.js`, and verify each callback.
4. Run the business rules on the server (or share them) and add automated tests for allocation, co-living, matching and notifications.
5. Add what a mockup skips: password reset, rate limiting, audit trail, backups and error monitoring.
