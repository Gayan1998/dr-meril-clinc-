# Clinic Manager

A small clinic management and cash-control Progressive Web App for a doctor-operated practice.

The system is built around one rule:

> **The doctor creates the financial obligation. The cashier only collects it. The system records and audits everything.**

The cashier has no technical path to reduce, increase, delete or manufacture clinic income.

---

## What it does

- **Doctor** (mobile-first): creates patients and visits, sets the consultation fee, cancels visits with a reason, and monitors patients seen, total charges, collected, pending, reports and the audit log.
- **Cashier** (desktop-first): sees the pending payment queue, collects the exact doctor-set amount, chooses a payment method, prints a receipt, and reviews their own activity.
- Amounts are always read from the database on the server. The browser never decides how much is owed.
- Every important action is written to an append-only audit log.

---

## Tech stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Frontend  | React 19, Vite, React Router, Tailwind CSS v4, PWA            |
| Backend   | Plain PHP 8 (no framework), PDO, REST + JSON                  |
| Database  | MySQL / MariaDB (InnoDB)                                      |
| Auth      | Opaque bearer tokens, `password_hash()` / `password_verify()` |
| Hosting   | Works on shared hosting / cPanel (Apache or Nginx)            |

No Laravel, no Symfony, no build tooling required on the server.

---

## Repository layout

```
dr_meril/
├── backend/
│   ├── api/            # endpoint handlers (auth, patients, visits, payments, reports, ...)
│   ├── config/         # config.php (env loader) + database.php (PDO)
│   ├── core/           # Router, Request, Response helpers
│   ├── helpers/        # auth, audit, validation, code generation, formatting
│   ├── public/         # front controller (index.php) + .htaccess  <-- web root
│   ├── tests/          # api_test.php  (integration + security suite)
│   ├── .env.example
│   └── .env            # local only, never commit
├── frontend/
│   ├── public/         # icons, favicon, SPA .htaccess
│   ├── scripts/        # icon generator, UI smoke + workflow tests, screenshots
│   └── src/
│       ├── components/ # UI kit + layout + feature components
│       ├── context/    # auth, toasts, confirm dialog
│       ├── hooks/      # useApi, useDebounced, useOnlineStatus
│       ├── lib/        # api client, formatters, cn
│       └── pages/      # doctor/, cashier/, shared
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── setup.php       # one-shot installer
└── docs/
    └── API.md
```

---

## Local setup (XAMPP / any PHP + MySQL)

### 1. Database

```bash
php database/setup.php            # creates the DB and schema (no demo data)
php database/setup.php --seed     # schema + demo data (development only)
```

Credentials are read from `backend/.env`. Copy `backend/.env.example` to `backend/.env` first if it does not exist and edit the values.

### 2. Backend

The backend is plain PHP. Point your web server at `backend/public/` (or, under XAMPP, it is reachable at
`http://localhost/dr_meril/backend/public`).

Check it:

```bash
curl http://localhost/dr_meril/backend/public/api/health
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api` to the local PHP backend (see `vite.config.js`).

### Demo accounts

| Role    | Username  | Password     |
| ------- | --------- | ------------ |
| Doctor  | `doctor`  | `Doctor@123` |
| Cashier | `cashier` | `Cashier@123` |

These are fake demo credentials. Change them before any real use.

---

## Testing

### Backend integration + security suite

Runs the full workflow and every fraud scenario against a live backend:

```bash
php backend/tests/api_test.php
```

Covers: authentication, RBAC, doctor visit creation, cashier collection, **amount manipulation**, duplicate payment, payment without a real visit, cashier mutation attempts, reports, void, audit trail and logout.

### Frontend UI tests (headless Chrome)

With the dev server and backend running:

```bash
cd frontend
node scripts/ui_smoke.mjs       # every screen renders for both roles + route guards
node scripts/ui_workflow.mjs    # doctor charge -> cashier collect -> receipt, end to end
node scripts/screenshots.mjs    # optional: capture screens for design review
```

---

## Security model

1. **Amounts come from the database.** `POST /api/payments/{visit}/collect` accepts only a visit id and a payment method. Any `amount` in the request body is ignored.
2. **Transactions + row locking.** Collection runs inside a transaction with `SELECT ... FOR UPDATE`, and a unique index on `(visit_id, active)` is the database-level guarantee that a visit can be paid at most once.
3. **Server-side authorization on every endpoint.** The router checks authentication and role; handlers re-check resource ownership. Hiding a button is never the security boundary.
4. **Immutable financial records.** Payments and visits are never hard-deleted. Cancellations and voids are status changes with a mandatory reason, an actor and a timestamp.
5. **Append-only audit log.** Login, logout, patient/visit/payment creation, cancellations, voids, user and settings changes are recorded with actor, IP and user agent. There is no API to modify or delete audit rows.
6. **Login throttling.** Repeated failures are counted (reusing the audit log) and temporarily locked out.
7. **Token auth, not cookies.** Bearer tokens are random 32-byte values stored as SHA-256 hashes with an expiry. No cookie means no CSRF surface.
8. **No secrets in the repo.** Database and app configuration live in `backend/.env`.
9. **Offline safety.** The service worker caches the app shell but serves `/api/*` network-only. The backend remains the single source of truth; the UI shows "financial transactions require an internet connection" when offline.

---

## Deployment

### A. Backend on cPanel / shared hosting

1. Create a MySQL database and user in cPanel, and note the credentials.
2. Upload the `backend/` folder (for example to `/home/USER/clinic-backend`) **outside** the web root if possible.
3. Copy `backend/.env.example` to `backend/.env` and set:
   ```
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://api.yourclinic.lk
   CORS_ALLOWED_ORIGINS=https://app.yourclinic.lk
   DB_HOST=localhost
   DB_NAME=cpaneluser_clinic
   DB_USER=cpaneluser_clinic
   DB_PASS=********
   ```
4. Point a subdomain's document root at `backend/public`.
   - In cPanel, create a subdomain `api.yourclinic.lk` and set its document root to `.../backend/public`.
   - If you cannot change the document root, upload `backend/` inside `public_html` and browse to `.../backend/public`. The included `.htaccess` blocks direct access to `config/`, `core/`, `helpers/`, `api/`, `database/` and dotfiles.
5. Import the schema: use phpMyAdmin to import `database/schema.sql`, or run `php database/setup.php` (schema only). **Do not import `seed.sql` in production** — it contains the demo accounts `doctor` / `cashier` with public passwords.
6. Ensure `mod_rewrite` is enabled (cPanel does this by default) and that `Authorization` headers reach PHP (the shipped `.htaccess` forwards them).
7. Enable HTTPS (AutoSSL). The API is HTTPS-ready.

### B. Frontend

1. Set the API base URL for the build (if the API is on another origin):
   ```bash
   # frontend/.env.production
   VITE_API_BASE=https://api.yourclinic.lk/api
   ```
   If the frontend and backend share an origin and the API is under `/api`, leave `VITE_API_BASE` unset.
2. Build:
   ```bash
   cd frontend
   npm ci
   npm run build
   ```
3. Upload the contents of `frontend/dist/` to `public_html` (or the frontend subdomain's document root).
4. The included `.htaccess` (in `frontend/public/.htaccess`, copied into `dist/`) handles SPA routing, asset caching and service-worker cache busting. If you deploy in a subdirectory, adjust `RewriteBase`.
5. Visit the site, install it as a PWA when prompted, and sign in.

### Environment variables

`backend/.env`

| Key                        | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `APP_ENV`                  | `development` or `production`               |
| `APP_DEBUG`                | `true` shows exception messages (dev only)  |
| `APP_TIMEZONE`             | Clinic timezone, e.g. `Asia/Colombo`        |
| `APP_URL`                  | Public API URL                              |
| `CORS_ALLOWED_ORIGINS`     | Comma-separated allowed frontend origins    |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASS` | Database connection          |
| `AUTH_TOKEN_TTL_MINUTES`   | Bearer token lifetime                       |
| `LOGIN_MAX_ATTEMPTS`       | Failed logins before temporary lockout      |
| `LOGIN_LOCKOUT_MINUTES`    | Lockout window                              |

`frontend/.env` (optional)

| Key              | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `VITE_API_BASE`  | API base URL. Defaults to `/api`.                |

---

## Go-live checklist

Work through this before the clinic touches the system:

1. **Create `backend/.env` on the server** from `backend/.env.production.example` and fill in real values.
   - `APP_ENV=production`, `APP_DEBUG=false`
   - `APP_URL` = the public HTTPS API URL
   - `CORS_ALLOWED_ORIGINS` = the frontend origin (or empty when same-origin)
   - A dedicated MySQL user for `DB_USER`/`DB_PASS` — **never `root`, never a blank password**
2. **Set the document root to `backend/public`.** If that is not possible, the shipped `.htaccess` files block web access to `backend/` internals, `database/` and `.sql`/`.md` files as a fallback.
3. **Load the schema only:** `php database/setup.php` (no `--seed`). If you already ran the seed, delete the demo users or change their passwords immediately.
4. **Sign in and change every password** (Staff → reset password). Remove any account you did not create.
5. **Enable HTTPS** (AutoSSL / Let's Encrypt) and confirm the API redirects HTTP to HTTPS. The app sends HSTS over HTTPS.
6. **Build the frontend** with the correct API URL and upload `frontend/dist/` to the frontend document root:
   ```bash
   cd frontend && npm ci && npm run build
   ```
7. **Smoke-test the live API** with the security suite:
   ```bash
   php backend/tests/api_test.php https://api.yourclinic.lk
   ```
   Expect all checks to pass (the suite creates test records — run it on a staging DB, or accept the test rows).
8. **Back up the database** on a schedule and verify a restore once.

---

## API

See [`docs/API.md`](docs/API.md) for the full endpoint reference, request/response shapes and the error format.

---

## Accessibility & UX notes

- Semantic HTML, labelled inputs, keyboard-navigable dialogs with focus trapping, visible focus rings.
- Full state coverage: skeletons while loading, empty states, inline errors and toasts. No `alert()` or `confirm()`.
- Mobile-first for the doctor, wide-table desktop for the cashier, and both work on the other form factor.
- Print stylesheet: receipts print cleanly at 80mm thermal or A4; dashboards and reports print without navigation.
