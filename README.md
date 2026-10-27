# Cheboi Apartments: clickable mockup

A rental management dashboard for a single owner with one or more separate properties: units, tenants, rent cycles, collections, M-Pesa payments and notifications.

This is a **mockup**. It is a static site (HTML, CSS and JavaScript modules) with no build step and no backend. `js/api.js` simulates the backend using the browser's localStorage, so the client can click through every feature as if it were live. The real website will reuse the same UI, design and business rules and replace only `js/api.js`.

## Demo login
- Email: `eve@cheboiapartments.co.ke`
- Password: `demo1234`

## Run it on your computer
Browsers block JavaScript modules when a page is opened as a plain file, so serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Put it online
- **Netlify drag and drop:** unzip, then drag the folder that contains `index.html` onto app.netlify.com/drop.
- **Netlify from GitHub:** push the folder contents to a repository, choose "Import an existing project", leave the build command empty and set Publish directory to `.`
- **Vercel:** run `npx vercel` in the folder (framework: Other, no build command, output directory `.`).
- **Google Cloud:** Firebase Hosting (public directory `.`) or a Cloud Storage bucket set up as a website.

## What you can do in it
- **Overview:** rent collected and outstanding this month, unit counts, recent collections, upcoming payments.
- **Units and Tenants:** add, edit, search and filter. Co-living units split rent equally. Detail pages show every rent cycle and payment. Move tenants out.
- **Rents & Collections:** review any month or date range, filter by tenant, unit or status, add cash and other manual payments.
- **M-Pesa Messages:** payments are matched to tenants by phone number and name. Confirm, reject, assign or reassign them.
- **Notifications:** one shared centre, with overdue alerts after a grace period and quiet "due soon" reminders.
- **Settings:** unit types, rent adjustments, M-Pesa handling, Paybill or Till number, alert timings, your profile.
- **Header tools:** global search, a calendar of rent-cycle start days, a property switcher.

## Demo tools (bottom-right button)
These exist only for the mockup:
- **Pretend today is another date:** watch cycles go overdue and alerts appear.
- **Simulate an incoming M-Pesa payment:** exact match, partial name, unknown sender, duplicate.
- **Simulate failures:** the M-Pesa connection failing, or the whole server failing.
- **Reset demo data:** returns everything to the starting sample data.

## Important to know
- Everything is saved **in the visitor's own browser**. Changes are not shared between devices or people, and clearing browser data resets the demo.
- The sample data is generated relative to today's date, so the demo always looks current.

## Folder structure
```
index.html              page shell (must stay at the top level)
css/styles.css          all styling
js/app.js               start-up, header, sidebar, routing, Demo tools
js/api.js               fake backend: the ONLY file that touches localStorage
js/rules.js             business rules as pure functions (reuse in the real build)
js/seed.js              sample data
js/ui.js                shared helpers (formatting, icons, modal, toasts)
js/search.js            header search
js/calendar.js          header calendar
js/pages/*.js           one file per page
docs/                   design decisions and the API contract for the real build
NOTES.md                project notes, decisions, assumptions and next steps
```

## More
- `NOTES.md`: how the project is built, decisions made, open questions, what comes next.
- `docs/Cheboi_Apartments_UI_UX_Decisions.md`: the agreed design and behaviour. It wins over everything else.
- `docs/API_CONTRACT.md`: what the real backend must provide.
