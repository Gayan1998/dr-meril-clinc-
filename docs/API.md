# API reference

Base URL: `<APP_URL>` (local default `http://localhost/dr_meril/backend/public`).

All responses are JSON. All request bodies are JSON (`Content-Type: application/json`).

## Authentication

Every endpoint except `POST /api/auth/login` and `GET /api/health` requires a bearer token:

```
Authorization: Bearer <token>
```

Tokens are returned by login, are stored hashed server-side and expire after `AUTH_TOKEN_TTL_MINUTES`.

## Roles

| Role      | Description                                                        |
| --------- | ------------------------------------------------------------------ |
| `doctor`  | Creates patients and charges, cancels visits, views reports/audit, manages staff and settings. |
| `cashier` | Collects payments and views the payment queue. Cannot create or alter charges. |

The router rejects requests with the wrong role with `403`, independently of the frontend.

## Response format

Success:

```json
{ "success": true, "message": "Payment collected successfully.", "data": { } }
```

Error:

```json
{ "success": false, "message": "This visit has already been paid." }
```

Validation errors add an `errors` object:

```json
{ "success": false, "message": "Consultation fee must be a number.", "errors": { "consultation_fee": "Consultation fee must be a number." } }
```

Common status codes: `200`, `201` created, `401` unauthenticated / expired, `403` forbidden,
`404` not found, `409` conflict (duplicate / race), `422` validation, `429` rate limited, `500` server error.

---

## Auth

### `POST /api/auth/login` — public

```json
{ "username": "doctor", "password": "Doctor@123" }
```

`data`: `{ token, expires_at, user: { id, name, username, role } }`

### `POST /api/auth/logout` — auth

Revokes the current token. `data: null`.

### `GET /api/auth/me` — auth

`data`: `{ user, settings }`.

### `POST /api/auth/change-password` — auth

```json
{ "current_password": "…", "new_password": "…" }
```

Revokes all other sessions for the user.

---

## Patients

### `GET /api/patients` — auth

Query: `q` (name / phone / patient code), `page`, `per_page`.
`data`: `{ items, total, page, per_page }`.

### `POST /api/patients` — doctor

```json
{ "full_name": "Kamal Perera", "phone": "0771234567", "address": "Nugegoda",
  "date_of_birth": "1985-03-12", "gender": "male", "notes": "…" }
```

`patient_code` is generated server-side (`P000001`). Returns the created patient.

### `GET /api/patients/{id}` — auth

Patient details plus the last 10 visits.

---

## Visits (charges)

### `POST /api/visits` — doctor

```json
{ "patient_id": 1, "consultation_fee": 2000 }
```

Registration is optional. For a quick walk-in, send the typed name instead of `patient_id`:

```json
{ "patient_name": "Kamal Perera", "consultation_fee": 2000 }
```

The server creates a lightweight patient record (`P000001`) from the name so the visit, cashier
queue and receipt keep a stable patient reference. The doctor can complete the patient's details
later from the register. `patient_id` and `patient_name` are mutually exclusive; when neither is
sent the request is rejected with `422`.

Creates a `pending_payment` visit with a server-generated `visit_number` (`V-YYYYMMDD-0001`).
The fee is validated server-side (`> 0`, `<= 1,000,000`).

### `GET /api/visits` — auth

Query: `date` (default today), `status` (`pending_payment|paid|cancelled`), `q`, `page`, `per_page`.

### `GET /api/visits/{id}` — auth

### `POST /api/visits/{id}/cancel` — doctor

```json
{ "reason": "Duplicate entry" }
```

Only a `pending_payment` visit can be cancelled. A paid visit returns `409`. Records `cancelled_by`,
`cancelled_at`, `cancellation_reason` and an audit entry.

---

## Payments

### `GET /api/payments/pending` — auth

Query: `q`, `date` (optional). Returns every visit with status `pending_payment`:

```json
{
  "items": [
    {
      "id": 12,
      "visit_number": "V-20261005-0012",
      "consultation_fee": 2000,
      "status": "pending_payment",
      "created_at": "2026-10-05 10:42:00",
      "doctor_name": "Dr. Fernando",
      "patient": { "id": 1, "full_name": "Kamal Perera", "patient_code": "P000001", "phone": "0771234567" }
    }
  ],
  "count": 1,
  "total": 2000
}
```

### `POST /api/payments/{visit_id}/collect` — cashier

```json
{ "payment_method": "cash" }
```

`payment_method` is one of `cash`, `card`, `bank_transfer`.

> **The request must not contain an amount.** The server loads the visit, reads `consultation_fee`
> from the database and creates the payment with that value. Any `amount` in the body is ignored.
> Collection runs in a transaction with `SELECT ... FOR UPDATE`; a unique index on
> `(visit_id, active)` guarantees at most one successful payment per visit. A second attempt returns
> `409`.

`data`: the created payment (including `payment_number`, `amount`, `payment_method`, `paid_at`, `patient`, `clinic`).

### `GET /api/payments` — auth

Query: `date`, `method`, `status`, `q`, `page`, `per_page`. Cashiers see only their own collections in reports; this endpoint returns the register.

### `GET /api/payments/{id}` — auth

Full payment plus `clinic` settings, used to render the receipt.

### `POST /api/payments/{id}/void` — doctor

```json
{ "reason": "Entered in error" }
```

Voids the payment (never deletes it) and returns the visit to `pending_payment`. Audit entry `PAYMENT_VOIDED`.

---

## Reports

### `GET /api/reports/daily` — auth

Query: `date`, `status`, `method`, `q`.

`data`: `{ date, items: [...], summary }` where `summary` contains:

```
visits_created, visits_paid, visits_pending, visits_cancelled, patients_seen,
total_charges, collected, clinic_collected, pending, transactions, voided,
by_method: { cash, card, bank_transfer }
```

### `GET /api/reports/closing` — auth

Payment-date centric cash reconciliation: `{ date, visits_created, patients_seen, by_method,
total_collected, transactions, pending_count, pending_total }`.

### `GET /api/reports/activity` (alias `GET /api/reports/summary`) — auth

Anti-fraud comparison of visits created vs payments collected for a date.

---

## Dashboards

### `GET /api/dashboard/doctor` — doctor

`data`: `{ date, doctor, summary, recent_visits, recent_payments, anomalies }`.

### `GET /api/dashboard/cashier` — cashier

`data`: `{ date, cashier, summary, recent_payments }` — totals scoped to the signed-in cashier.

---

## Audit

### `GET /api/audit-logs` — doctor

Query: `date`, `action`, `user_id`, `page`, `per_page`. Read-only; there is no create/update/delete endpoint.

### `GET /api/audit-logs/actions` — doctor

`data`: `{ actions: ["LOGIN", "PAYMENT_CREATED", ...] }`.

Tracked actions include `LOGIN`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `LOGOUT`, `PATIENT_CREATED`,
`VISIT_CREATED`, `VISIT_CANCELLED`, `PAYMENT_CREATED`, `PAYMENT_VOIDED`, `USER_CREATED`,
`USER_ACTIVATED`, `USER_DEACTIVATED`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `SETTINGS_UPDATED`.

---

## Users (staff)

### `GET /api/users` — doctor

### `POST /api/users` — doctor

```json
{ "name": "Cashier Two", "username": "cashier2", "password": "secret123", "role": "cashier" }
```

### `PATCH /api/users/{id}/status` — doctor

```json
{ "status": "inactive" }
```

You cannot deactivate your own account, and at least one active doctor must remain. Deactivating revokes the user's tokens.

### `POST /api/users/{id}/password` — doctor

```json
{ "password": "newsecret123" }
```

---

## Settings

### `GET /api/settings` — auth

### `PUT /api/settings` — doctor

```json
{ "clinic_name": "Meril Medical Centre", "address": "…", "phone": "…", "email": "…",
  "logo_url": "…", "receipt_footer": "…", "currency": "LKR" }
```

---

## Health

### `GET /api/health` — public

`data`: `{ status: "ok", time }`.
