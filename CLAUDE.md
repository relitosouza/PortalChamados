# CLAUDE.md — Portal de Chamados Smarapd

This file provides context for AI assistants (such as Claude) working on this codebase. Read it before making any changes.

---

## Project Overview

**Portal de Chamados Smarapd** is a static, browser-only ticket management portal. It reads support ticket data from a published Google Sheets spreadsheet (via CSV export) and renders it as an interactive dashboard. There is no build step, no package manager, and no server-side code in this repository.

A separate admin panel (`admin.html`) allows authorised users to update ticket statuses via a Google Apps Script backend.

---

## File Structure

```
/
├── index.html        # Main portal — lists all tickets grouped by status
├── script.js         # Portal logic (fetch, parse, render, filter, rotation)
├── styles.css        # Portal stylesheet (875 lines, CSS custom properties)
├── detalhes.html     # Ticket detail view
├── detalhes.js       # Detail page logic (fetch by ID, render, share)
├── detalhes.css      # Detail page stylesheet (561 lines)
└── admin.html        # Admin panel — search tickets and update statuses (all-in-one HTML file)
```

All files are in the repository root. There are no subdirectories, no node_modules, and no build artefacts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Frameworks | None |
| Build tools | None |
| Package manager | None |
| CSS preprocessor | None (uses native CSS custom properties) |
| External JS library | [Swiper.js v11](https://swiperjs.com/) — loaded via CDN in `index.html` |
| Font | Google Fonts — Inter |
| Data source | Google Sheets (CSV export via `gviz` API) |
| Admin backend | Google Apps Script (deployed as a Web App) |

---

## Data Source

Ticket data is fetched at runtime from a Google Sheets CSV export:

```
https://docs.google.com/spreadsheets/d/1VMM-9zck6eBwCpd-WZ_PUbzSLI9sFGz2L309H7CJFlc/gviz/tq?tqx=out:csv&gid=330906161
```

The same `SHEET_URL` constant appears in both `script.js:13` and `detalhes.js:2`. If the spreadsheet changes, update both files.

### Expected CSV columns

| Column name | Description |
|---|---|
| `Numero do Chamado` | Ticket ID (used as primary key) |
| `Titulo` | Ticket title |
| `Assunto` | Full description / subject |
| `Status` | `Aberto`, `Em Andamento`, or `Resolvido` (case-insensitive substring match) |
| `Carimbo de data/hora` | Submission timestamp |
| `Sistema` | System identifier: `CP`, `AM`, or `Transparência` |
| Requester column | Searched by name variations — see `script.js:173–208` |

Additional columns beyond the standard set are displayed dynamically in the detail view (`detalhes.js:169–196`).

---

## Key Behaviour

### Portal (`index.html` + `script.js`)

- Tickets are fetched on page load and parsed with a custom CSV parser (`parseCSV`, `script.js:98`).
- Cards are distributed into three `<section>` elements: `#abertos`, `#andamento`, `#resolvidos`.
- **Auto-rotation**: tabs cycle every 20 seconds (`rotationIntervalTime = 20000`, `script.js:17`). Users can pause/resume.
- **Auto-refresh**: page re-fetches data every 2 minutes while visible (`script.js:49`), and also on `visibilitychange` if ≥10 s have passed since the last fetch (`script.js:35`).
- **Desktop**: cards are converted to a Swiper carousel (`convertToSwiper`, `script.js:322`). Swiper is disabled on mobile (≤768 px) or touch devices.
- **Filtering**: by system (`CP`, `AM`, `Transparência`) and by free-text search across ticket ID, title, and description.
- Description cards are truncated to 12 words (`script.js:246`).

### Detail Page (`detalhes.html` + `detalhes.js`)

- Reads `?id=<ticket_number>` from the URL.
- Fetches the full CSV, finds the matching row by `Numero do Chamado`, and renders all fields.
- Shows a basic timeline based on the current status (`createTimeline`, `detalhes.js:205`).
- Share button uses `navigator.share` with fallback to `navigator.clipboard` then `execCommand` (`detalhes.js:261`).

### Admin Panel (`admin.html`)

- Self-contained single HTML file with embedded CSS and JS.
- Two constants must be configured at the top of the `<script>` block (`admin.html:432` and `admin.html:457`):
  - `API_URL` — Google Apps Script web app URL.
  - `USER_EMAIL` — the admin's email address (validated against the Apps Script backend).
- Communicates with the backend using `fetch` + JSON. Actions: `validarUsuario`, `atualizarStatus`, `obterHistorico`.
- No authentication token — access control is entirely on the Apps Script side.

---

## Status Values

Status matching is done via case-insensitive `includes()` checks on the raw string from the spreadsheet.

| Status string (sheet) | Display label | CSS class | Section |
|---|---|---|---|
| Contains `aberto` | Aberto | `status-aberto` | `#abertos` |
| Contains `andamento` | Em Andamento | `status-andamento` | `#andamento` |
| Contains `resolvido` | Resolvido | `status-resolvido` | `#resolvidos` |

Tickets with unrecognised statuses are silently skipped (`script.js:235`).

## System Values

| System string (sheet) | Display | CSS class |
|---|---|---|
| `CP` (or contains `cp`) | CP | `system-cp` (blue) |
| `AM` (or contains `am`) | AM | `system-am` (purple) |
| Contains `transparencia`/`transparência` | Transparência | `system-transparencia` (cyan) |

---

## CSS Architecture

Both `styles.css` and `detalhes.css` use CSS custom properties defined in `:root`. Key variables:

```css
--primary-color      /* dark navy header */
--accent-blue        /* interactive elements */
--success-green      /* "Resolvido" indicators */
--warning-yellow     /* "Em Andamento" indicators */
--danger-red         /* "Aberto" indicators */
--text-color
--border-color
--bg-color
```

Breakpoints: `768px` (tablet) and `480px` (mobile). At ≤768 px, Swiper is disabled and a plain CSS Grid is used instead.

`admin.html` has its own embedded styles using the same variable names but defined inline.

---

## Development Workflow

There is no build step. Development is:

1. Edit HTML/CSS/JS files directly.
2. Open `index.html` in a browser (or serve via a local HTTP server if CORS is an issue).
3. Use the browser DevTools console — the code logs extensively during fetch and render cycles.

### Local serving (recommended for CORS)

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

### Debugging tips

- The CSV parser logs raw ticket count, first ticket object, and available column names on every load.
- Filter/system mismatches: check `console.log('Available systems in data:', ...)` in `script.js:538`.
- Requester field: the first ticket on each render logs all available columns and which one was selected (`script.js:211–217`).
- If the sheet returns HTML instead of CSV (e.g. redirected to a login page), an error is thrown at `script.js:72`.

---

## Configuration Reference

### Changing the Google Sheet

Update `SHEET_URL` in **both** files:
- `script.js:13`
- `detalhes.js:2`

The URL must be the `gviz` CSV export of a **publicly published** sheet.

### Configuring the Admin Panel

Edit `admin.html` directly:
- **Line 432**: set `API_URL` to the deployed Google Apps Script URL.
- **Line 457**: set `USER_EMAIL` to the admin's email.

### Adding a new system filter

1. Add a `<button class="filter-btn" data-filter="newsystem">` in `index.html`.
2. Add a matching `else if` branch in `filterTickets()` (`script.js:423`).
3. Add a CSS badge class in `styles.css` following the pattern of `.system-cp`, `.system-am`, etc.
4. Mirror the badge class logic in `detalhes.js:147–155` for the detail view.

### Changing the auto-rotation or refresh interval

- Tab rotation interval: `rotationIntervalTime` (`script.js:17`, default `20000` ms).
- Periodic refresh: the `setInterval` at `script.js:49` (default `120000` ms / 2 minutes).
- Minimum time between focus-triggered refreshes: `AUTO_REFRESH_INTERVAL` (`script.js:33`, default `10000` ms).

---

## Conventions

- **Language**: All user-facing text is in Brazilian Portuguese. Code comments are in a mix of Portuguese and English — prefer Portuguese for new comments to stay consistent.
- **No frameworks**: keep changes in vanilla JS/HTML/CSS. Do not introduce npm, React, TypeScript, or bundlers without explicit discussion.
- **Inline styles**: avoid adding `style=""` attributes. Use CSS classes instead.
- **No global state**: all portal state (`allTickets`, `currentFilter`, `currentSearchTerm`, rotation state, Swiper instances) lives inside the `DOMContentLoaded` closure in `script.js`. Keep it that way.
- **Error handling**: show user-visible errors via `showError()` in `script.js` and the `#error` element in `detalhes.html`. Do not use `alert()` except as a last-resort clipboard fallback.
- **Console logging**: the codebase is verbose in the console intentionally (debugging aid). Do not remove existing logs when making changes; add new ones following the same `console.log('Label:', value)` pattern.
- **`parseCSV` duplication**: the same CSV parser function exists in both `script.js` and `detalhes.js`. If fixing a bug in one, fix it in the other too.

---

## Known Limitations

- **No offline support** — the app requires network access to Google Sheets on every page load.
- **CORS on admin**: `admin.html` originally used `mode: 'no-cors'` for some requests due to Apps Script CORS behaviour. The current version uses standard `fetch` + JSON; if CORS issues arise, check the Apps Script deployment settings (access must be set to "Anyone").
- **No authentication on portal**: `index.html` and `detalhes.html` are fully public read-only.
- **Static timeline**: the detail page timeline is synthesised from the current status only; it does not fetch actual history dates from a log. Real history is only available in the admin panel.
- **Single-sheet data model**: all ticket data comes from one Google Sheets tab. Adding pagination or multiple sheets would require significant refactoring.

---

## Git Conventions

Commit messages in this repository have historically been short imperative phrases (e.g., `Update admin.html`, `Enhance fetch request with no-cors mode and error handling`). Follow the same style. There are no PR or branch naming conventions beyond what is imposed by the CI environment.
