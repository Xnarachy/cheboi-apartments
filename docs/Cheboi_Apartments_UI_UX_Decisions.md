# Cheboi Apartments: UI/UX Vision and Decisions (Updated)

**Document purpose:** Preserve the product vision, UI/UX decisions, and
business rules made so far, before implementation begins.\
**Status:** Working design record. Product definition is now complete
enough to begin building. Items marked **Assumption** were set as
sensible defaults and are open to change. Items under **Still open** are
not decided.\
**Branding:** Cheboi Apartments\
**Dashboard owner shown in mockups:** Eve Cheboi

> This project is being shaped from scratch from an initial vision.
> There is no existing dashboard that this document assumes must be
> preserved. The goal is to define the product and its behaviour before
> coding.

## 1. Product and design direction

-   Build the dashboard from the ground up, starting with the product
    vision and structure before implementation.
-   The design direction is **minimal and premium**.
-   Primary colours: **jungle green and white**. Use red sparingly for
    outstanding rent and important alerts.
-   Use one consistent, clean, appropriate font throughout.
-   Prefer generous white space, clear financial figures, subtle cards,
    and restrained green accents.
-   Design for mobile and desktop rather than shrinking one layout to
    fit every screen.
-   Routine design decisions should follow established design practice
    without repeatedly asking the owner to approve them.
-   Bring the owner into decisions that materially affect the business
    model, the product's defining features, or meaningful user
    experience trade-offs.
-   Use sensible defaults for minor unresolved details and clearly label
    assumptions.
-   The dashboard has a **single user, the owner**. There is no
    caretaker login, role, or permissions system for now, because it
    adds complexity. A second role can be added later.

## 2. Navigation

### Main menu

1.  Overview
2.  Properties: expandable/collapsible parent
    -   Units
    -   Tenants
3.  Rents & Collections
4.  M-Pesa Messages
5.  Notifications
6.  Settings
7.  Logout: visually separated near the bottom

The **property switcher** sits at the top of the sidebar, under the
Cheboi Apartments branding (see section 14).

### Navigation behaviour

-   On desktop, the sidebar can remain visible.
-   On mobile, use a collapsible navigation drawer opened by a menu
    icon. The property switcher appears at the top of the drawer.
-   Properties is a parent menu item; clicking it expands or collapses
    Units and Tenants.
-   Clicking Units or Tenants opens the relevant page.
-   The active page should be visually clear.
-   Keep navigation labels and icons consistent.

## 3. Header and global search

The dashboard header includes:

-   Cheboi Apartments branding/title.
-   Eve Cheboi's name and a profile thumbnail area (a placeholder can be
    used until an image exists).
-   A global search entry point.
-   A **calendar icon** (see section 15).
-   A notification bell with an unread-count badge when applicable.
-   A mobile menu button where needed.

The property switcher is **not** in the header.

### Search

Both global and page-specific search are wanted.

-   **Global search:** A small search icon in the header that expands
    when tapped rather than taking up permanent header space. Because it
    is global, it searches virtually everything in the current
    property:
    -   Tenants: name, phone, and unit
    -   Units: name or number, and type
    -   Collections: tenant, amount, and date
    -   M-Pesa messages: sender name, phone, amount, and transaction
        reference
    -   Notifications: their text

    Results appear as you type, grouped by category with the best
    matches first, and each result opens the relevant item. Numbers work
    naturally (an amount finds payments of that value; a phone number
    finds both the tenant and any M-Pesa messages from it). **Occupation
    is not searchable.** If nothing matches: "No results for that
    search." A failed search shows a friendly Retry.
-   **Page-specific search:** Search fields inside Units, Tenants,
    Rents & Collections, and M-Pesa Messages for focused searches and
    filtering.

## 4. Core business rules

### 4.1 Two meanings of "month"

-   **Owner / dashboard month:** the calendar month (January to
    December). All dashboard figures reflect the calendar month.
-   **Tenant month (cycle):** a tenant's rent cycle runs from their
    move-in date and repeats on the **same date each month**. Move in on
    the 26th and the cycle always hits the 26th, whatever the calendar
    month.
-   If a date does not exist in a month (for example the 31st in
    February), the due date falls on the last day of that month, then
    returns to the original day when possible. **Assumption.**
-   There is no proration. A mid-month move-in simply starts their cycle
    on that date.
-   **Rent is due from the move-in date until the same date the
    following month**, so the tenant has the whole cycle to pay. If the
    cycle is not fully paid by then, it becomes **overdue** on that
    date, which is also when the next cycle begins.

### 4.2 Cycles do not move

-   A tenant's cycle never shifts, whether they pay early or late.
-   Unpaid amounts stay attached to their own cycle until cleared. A
    shortfall is not carried into the next cycle.
-   A tenant can have an overdue cycle and a current cycle open at the
    same time.

### 4.3 Rent, units, and co-living

-   Each unit has a fixed default monthly rent. Rent can also vary by
    tenant. Adjustments are edited on the tenant record, and a switch in
    Settings (off by default) allows them.
-   Each unit has a **Type** (for example Bedsitter, 1BR, 2BR). The list
    of types is editable in Settings. **Assumption.**
-   A unit may hold more than one tenant when co-living. Their rent is
    **split equally** between them, and shares update when a tenant is
    added or leaves. A change applies from each tenant's next cycle, so
    existing tenants keep their current-cycle share.
-   If a co-living tenant has an adjusted rent, the equal split applies
    to the remainder after the adjusted amount. **Assumption.**
-   A unit is Occupied if it has at least one tenant, and Vacant if it
    has none.
-   Outstanding rent is tracked per tenant, so red appears on the tenant
    who owes, not on every occupant of the unit.

### 4.4 Tenants

-   Tenant record: **full name, phone number, move-in date,
    occupation.**
-   Occupation is informational only. It helps the owner form their own
    judgement and is not used for search or filtering.
-   The rent due date is set per tenant, defaulting from their move-in
    date and editable by the owner.
-   A tenant who leaves is marked **Moved out** and keeps their payment
    history, so past collections stay accurate. **Assumption.**

### 4.5 Cycle statuses

-   **Unpaid:** nothing received and the cycle is still running.
-   **Partially paid:** some money received with a balance remaining.
-   **Paid:** the full share is received, even if the last installment
    came after the cycle ended. History still shows when each
    installment arrived.
-   **Overdue:** the next same date has arrived with a balance still
    remaining on the cycle.

### 4.6 Payments and installments

-   Tenants may pay in installments. Each installment is recorded
    separately with its date and amount.
-   **Allocation:** a payment clears the **oldest unpaid cycle first**.
-   **Overpayment:** if nothing is owed, the extra is held as a
    **credit** toward the next cycle and shown on the tenant record.
-   In co-living units, each tenant's payments clear only their own
    share.
-   Manually recorded payments (such as cash) follow exactly the same
    rules as M-Pesa payments and carry a visible **Manually recorded**
    label.

### 4.7 Dashboard figures

-   **Rent Collected:** every payment received during the current
    calendar month, counted in the month it arrived.
-   **Amount Outstanding:** unpaid rent from cycles that **start in the
    current calendar month**, since rent is due from the cycle's start
    date, even if the tenant is still within their cycle and not yet
    overdue. A partially paid cycle contributes only its remaining
    balance.
-   Outstanding is calculated from rent actually due, never simply
    expected rent minus collected rent.
-   Older overdue balances stay visible on the tenant's own record.

### 4.8 Alerts and colour

-   A cycle turns **red as soon as it is overdue.**
-   A notification fires only after a **grace period**. Placeholder: 3
    days after the cycle becomes overdue, adjustable in Settings.
    **Assumption.**

## 5. Overview page: agreed structure

The top-to-bottom content order is:

1.  Welcome header and brief contextual greeting.
2.  Monthly financial summary.
3.  Property Overview.
4.  Recent Collections.
5.  Upcoming Payments.

The Overview should remain focused and uncluttered. Do not add a
separate notification feed/panel to it.

### 5.1 Monthly financial summary

Show two key figures:

-   **Rent Collected:** total rent payments received during the current
    calendar month.
-   **Amount Outstanding:** calculated as set out in section 4.7.

Both figures use the calendar month by default. Historical performance
belongs in Rents & Collections, where date filters are available.

The example values used in mockups, **KSh 78,000 collected** and
**KSh 22,000 outstanding**, are illustrative design examples, not
confirmed live property data.

### 5.2 Date filtering

-   Keep date filters off the main Overview to protect the minimal
    design.
-   The Overview displays current-month figures by default.
-   Put date filtering inside **Rents & Collections**, where Eve can
    review other months or a custom period.

### 5.3 Property Overview

Show only three compact figures:

-   Total Units
-   Occupied
-   Vacant

Do **not** add an occupancy-rate percentage; the owner felt that would
make the Overview unnecessarily busy.

Tapping the Property Overview section leads to **Properties → Units**.

### 5.4 Recent Collections

-   Show the **five most recent rent collections** on the Overview.
-   Include a **View All** link to Rents & Collections.
-   On desktop, use a clear table.
-   On mobile, present collections as compact cards rather than forcing
    a wide table to scroll horizontally.
-   Keep the information consistent between layouts.

### 5.5 Upcoming Payments

-   Show the **five nearest upcoming rent payments**, ordered by due
    date.
-   Include a **View All** link to the full relevant list.
-   Each entry shows tenant name, unit, amount due, and due date. A
    subtle status such as "Due soon" can be used when supported by the
    recorded dates.
-   Only display payments with recorded due dates. Do not invent
    schedules or assume every tenant pays on the same day.
-   Keep this section compact, below Recent Collections.

### 5.6 Notifications on Overview

-   Do not add a separate notification panel to the Overview.
-   The header bell shows an unread-count badge when relevant.
-   The sidebar also contains Notifications.
-   Both entry points open the **same notification centre** and share
    the same read/unread state.

## 6. Units page

-   Table on desktop, cards on mobile. Search plus a status filter (All,
    Occupied, Vacant).
-   Each unit shows name or number, type, status, tenant(s), and rent.
    Co-living units show the first tenant plus "+1 more" and the total
    rent with "split equally" beneath.
-   Actions: add unit, edit unit, open unit detail. The detail view
    lists every tenant and their rent share, and flags any tenant whose
    rent differs from the default.
-   Red appears only where rent is outstanding.

## 7. Tenants page

-   Table on desktop, cards on mobile. Each row shows name, unit, phone,
    rent share, next due date, and balance.
-   Search by name, phone, or unit. Filter: All, Paid up, Outstanding.
-   Actions: add tenant (choose unit, set move-in and due dates), edit
    tenant (including rent adjustment when allowed in Settings), open
    tenant detail.
-   Tenant detail shows the profile, the current cycle and its status,
    payment history with the source label, credit balance, and any
    outstanding balance.

## 8. Rents & Collections

-   **Collection record:** tenant, unit, amount, date received, the
    cycle it applies to, source (M-Pesa or Manually recorded), and
    status.
-   **Filters:** calendar month by default, a custom date range, tenant,
    unit, and status, plus search. Historical review lives here, not on
    the Overview.
-   Table on desktop, cards on mobile.
-   **Add Payment** button for cash or other manual payments.

## 9. M-Pesa Messages

This page shows payment information from the M-Pesa integration. It is
not a tenant-to-owner messaging inbox. A payment event may appear here
and also trigger a notification, but the two sections serve different
purposes.

### Payment handling modes (chosen in Settings)

-   **Automatic:** a matched payment is recorded straight away against
    the matching tenant.
-   **Review first:** a matched payment waits as Pending review until
    Eve confirms it. This is the suggested default while the system is
    new. **Assumption.**

### Matching

-   A payment is matched by the sender's **phone number and name**. The
    phone number must match exactly. The name comparison is
    **tolerant**, so a partial overlap counts (for example a missing
    middle name or a different order).
-   Doubtful matches, different numbers, or no tenant found go to
    **Unmatched**. They are never recorded automatically.
-   If a tenant pays from a different number, they tell the owner or
    caretaker in person, and Eve assigns the payment by hand.

### Message states

-   **Recorded:** turned into a collection.
-   **Pending review:** matched, awaiting confirmation (Review first
    mode only).
-   **Unmatched:** needs assignment by Eve.
-   **Rejected:** dismissed as not a rent payment.

### Layout and actions

-   Each message shows sender name, phone number, amount, date and time,
    the M-Pesa transaction reference, status, and, when matched, the
    tenant and unit.
-   Tabs or filters for Pending review, Unmatched, Recorded, and All,
    plus search by name, phone, or reference.
-   Actions: Confirm, Reject, Assign to tenant, Reassign.
-   Items needing action appear first with a subtle badge.

### Reassignment and failures

-   A Recorded payment can be **reassigned** to another tenant if it was
    matched wrongly. Both tenants' balances recalculate, the payment
    shows a visible "Reassigned" note, and the month's Rent Collected
    does not change.
-   A message with an already-recorded transaction reference is
    ignored, so a payment is never counted twice. **Assumption.**
-   If the integration is down, a friendly notice with Retry appears.
    Existing recorded data stays visible and nothing is fabricated.

## 10. Notifications

Both the header bell and the sidebar entry open the **same**
notification centre and share one read/unread state.

**Needs action (highlighted):**

-   Payment overdue past the grace period
-   New unmatched payment
-   Payment pending review
-   M-Pesa integration failing

**Quiet:**

-   Rent due soon (lead time adjustable in Settings, placeholder 3 days
    before the cycle's due date)
-   Payment recorded automatically

All other events (tenant added or moved out, reassignments, credits,
completed cycles) stay in history only and do not notify.

**Behaviour:** each notification links to the relevant item. Unread
items are visually distinct, and Eve can mark one or all as read. The
same event does not notify repeatedly. Empty state: "You're all caught
up."

## 11. Settings

Settings is a single page of grouped cards, stacked on mobile and in a
centred column on desktop. Each setting has a short hint and a clear
save confirmation.

-   **Rent and units:** the unit types list (add, rename, remove; a type
    in use cannot be removed) and the switch that allows tenant rent
    adjustments (off by default).
-   **Payments:** M-Pesa handling, Automatic or Review first (suggested
    default: Review first), and the Paybill or Till number the property
    receives payments on.
-   **Reminders and alerts:** the grace period before an overdue
    notification (placeholder: 3 days) and the "rent due soon" lead time
    (placeholder: 3 days).
-   **Profile:** display name and profile image.

Changing the grace period or lead time affects future notifications
only. Switching to Automatic does not touch payments already pending
review. A failed save shows a friendly Retry without losing what was
typed.

## 12. Loading, empty, and error states

These are agreed product behaviours, not optional decoration.

### Loading

Use subtle **skeleton placeholders** where figures, cards, and rows will
appear. Replace them with real content when loading completes. Avoid
full-screen loading spinners for ordinary dashboard data.

### Empty states

Show helpful messages rather than blank screens or a wall of zeros.
Examples:

-   Collections: "No collections recorded yet."
-   Tenants: "No tenants added yet."
-   Units: "No units added yet."
-   Notifications: "You're all caught up."
-   Upcoming payments: "No upcoming payments to show."
-   M-Pesa Messages: "No M-Pesa messages yet."

Where appropriate, include a useful next step. Keep empty states quiet
and consistent with the premium style.

### Errors

Use a friendly explanation and a **Retry** button when data fails to
load. Keep other working dashboard sections usable rather than failing
the whole page.

Example: "We couldn't load your rent collections. Check your connection
and try again."

Do not show stale or fabricated figures as though a failed request
succeeded.

## 13. Responsive behaviour

-   Use a mobile-first, responsive approach as the current working
    direction.
-   Desktop collections use tables; phone layouts use compact cards.
-   Desktop navigation remains visible; mobile navigation opens as a
    collapsible drawer.
-   Keep figures readable, controls touch-friendly, and layouts free of
    unnecessary horizontal scrolling.
-   Use the same underlying information and business rules across screen
    sizes.

## 14. Multiple properties

-   Cheboi may have more than one property (for example Cheboi Flats and
    Cheboi Villa). Each is a **fully separate entity** with its own
    units, tenants, cycles, collections, M-Pesa messages,
    notifications, and settings. All use the same business rules.
-   **Combined totals across properties never exist.** Each dashboard
    shows only its own property.
-   The **property switcher** lives in the sidebar, under the Cheboi
    Apartments branding, and at the top of the mobile drawer. It is not
    in the header. It shows the current property's name and opens a
    short list. With only one property, it stays hidden.
-   Switching properties reloads every page for the chosen property.
-   One account covers all properties. A signed-in owner switches freely
    with no extra login. A signed-out owner must sign in, then lands on
    the property last used.
-   **Paybill or Till:** properties may share one number or each have
    their own, as the owner chooses. With separate numbers, the number
    identifies the property. With a shared number, the account number a
    tenant enters should include the property, for example "Flats-A4".
    Payments that cannot be tied to one property go to Unmatched.
    **Assumption.**

## 15. Calendar icon

-   A small calendar icon in the header opens a pop-up month view with
    today highlighted and simple month navigation.
-   It also marks the days when rent cycles start for the current
    property, and tapping a marked day lists the tenants whose cycle
    starts that day. **Assumption.**
-   It is a good-to-have convenience and adds no business rules.

## 16. Data model (draft)

-   **Property:** name, its own settings, and its Paybill or Till
    number.
-   **Unit:** property, name or number, type, default monthly rent.
-   **Tenant:** property, full name, phone, occupation, move-in date,
    unit, optional adjusted rent, status (Active or Moved out), move-out
    date.
-   **Cycle:** tenant, start date, end date (the next same date), rent
    share, amount paid, status. Cycles are generated from the move-in
    date, and the status is calculated.
-   **Payment:** property, tenant, amount, date received, source
    (M-Pesa or Manually recorded), transaction reference when from
    M-Pesa, and a reassigned flag with a note.
-   **Allocation:** links a payment to each cycle it cleared and the
    amount applied, which is how oldest-first works when one payment
    clears several cycles.
-   **Credit:** the part of a payment not applied to any cycle, held for
    the tenant's next cycle.
-   **M-Pesa message:** sender name, phone, amount, date and time,
    transaction reference (unique, to block duplicates), status
    (Recorded, Pending review, Unmatched, Rejected), and the matched
    tenant if any.
-   **Notification:** type, text, link to the related item, created
    time, read or unread.
-   **Settings (per property):** unit types, rent adjustments on or off,
    M-Pesa handling mode, grace period, "due soon" lead time.
-   **Calculated, not stored:** dashboard totals, tenant balances, and a
    unit's Occupied or Vacant status, so they cannot drift out of sync.

## 17. M-Pesa integration and build order

-   Payments will arrive through Safaricom's Daraja API (C2B), which
    notifies the system of each payment to the Paybill or Till number.
    The owner is currently acquiring the number.
-   The sender's phone number may arrive masked or hashed. If so,
    matching compares the tenant's number in the same form. The rule
    stays the same: phone and name must both match.
-   With a Paybill, tenants can enter their unit name as the account
    number as an extra matching signal. **Assumption.**
-   **Build order:** first the dashboard with manually recorded
    payments, then the M-Pesa Messages page on sample data, then Daraja
    in Safaricom's sandbox, and finally the live connection once the
    number is active.

## 18. Design decisions versus business rules

The owner has explicitly pointed out that many routine design questions
are standard industry practice. The workflow should reflect that:

### Design decisions the designer/implementer should make independently

Examples include responsive navigation, skeleton loading, clear empty
states, retry behaviour, spacing, and adapting tables for small screens.
Follow sound conventions and the agreed minimal/premium direction.

### Decisions that need business input

Examples include how rent due dates are established, what counts as
outstanding rent, what an M-Pesa event should change, which events
trigger notifications, and how tenants/units/rent records relate to each
other.

**Example distinction:** Whether the sidebar collapses on mobile is a
design decision. Whether a payment recorded through M-Pesa automatically
updates a tenant's balance is a business/system rule that must be
defined accurately.

## 19. What is settled and what remains open

### Settled

-   Product is being designed from scratch.
-   Cheboi Apartments is the dashboard concept name; Eve Cheboi is the
    owner shown in the mockups.
-   Minimal and premium visual direction; jungle green and white, with
    red reserved for outstanding rent and important alerts.
-   Main navigation, the expandable Properties hierarchy, and the
    property switcher in the sidebar.
-   Global search (searching virtually everything) plus page-specific
    search.
-   Notifications accessible from both header and sidebar, with six
    chosen events.
-   M-Pesa Messages is separate from Notifications, with the matching,
    states, and reassignment rules in section 9.
-   Overview structure, calendar-month figures, and Amount Outstanding
    counting unpaid rent from cycles that start in the month.
-   Cycle rules: same date each month, no proration, never shifting,
    overdue on the next same date.
-   Equal rent split in co-living units, with changes applying from the
    next cycle.
-   Oldest-first payment allocation, credit for overpayment, and
    installments.
-   Tenant fields, the Units page, the Tenants page, Rents &
    Collections, and the Settings page.
-   Multiple properties as fully separate entities with no combined
    totals.
-   Calendar icon in the header.
-   Single user (no caretaker role) for now.
-   Helpful empty states, skeleton loading, and friendly retry errors.

### Still open

-   Exact grace period and "due soon" lead time (placeholders are 3
    days each).
-   Whether tenants will be asked to use their unit name as the Paybill
    account number.
-   Whether a caretaker role is added in the future.
-   Any further Settings options.

Do not assume these unresolved details are already decided.

## 20. Suggested next step

Begin building, starting with the Overview and navigation shell, then
Units and Tenants, using manually recorded payments first. Make routine
design decisions without interruption; ask for input only where a real
business rule or meaningful product choice is involved.

------------------------------------------------------------------------

## 21. Generated visual references

The following images were generated during earlier design discussions
and are included as visual references. They are **inspiration/mockups**,
not authoritative specifications. If an image conflicts with the written
decisions in this document, follow the written decisions.

### 1. Initial property dashboard mockup

![Initial property dashboard
mockup](images/01-property-dashboard-mockup.png)

### 2. Dashboard layout reference

![Dashboard layout reference](images/02-dashboard-layout-reference.png)

### 3. Mobile navigation menu

![Mobile navigation menu mockup](images/03-mobile-navigation-menu.png)

### 4. Web and mobile dashboard reference

![Web and mobile dashboard
reference](images/04-web-mobile-dashboard-reference.png)

### 5. Minimal dashboard reference

![Minimal dashboard
reference](images/05-minimal-dashboard-reference.png)
