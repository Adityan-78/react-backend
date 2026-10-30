# Business Operations Management System - Backend

FastAPI + SQLAlchemy backend for the React dashboard. Every endpoint from the API
specification is implemented, with JWT authentication and role checks enforced on the server.

## Project layout

```
app/
  main.py            app setup: CORS, security headers, error handling
  api/
    router.py        mounts every module under /api/v1
    deps.py          DB session, current user, role checks, pagination
    endpoints/       thin route handlers (one file per module)
  services/          ALL business rules live here (stock, approvals, workflows)
  schemas/           Pydantic request/response models + validation
  models/            SQLAlchemy models (one per table)
  core/              config, security (JWT + hashing), constants, errors, login throttle
  db/                engine/session (lazy) and declarative base
sql/schema_additions.sql   run once on SQL Server (see below)
scripts/seed.py            creates the 5 roles + a first admin
tests/                     69 tests (run on in-memory SQLite, no SQL Server needed)
```

Request flow: `endpoint (role check) -> service (business rules, transaction) -> SQLAlchemy -> DB`.

## Run it (Windows PowerShell)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env        # then set SECRET_KEY
uvicorn app.main:app --reload
```

Docs: http://127.0.0.1:8000/docs (disabled when `ENVIRONMENT=production`).

SQL Server needs the Microsoft **ODBC Driver 18** installed on the machine.

## Connecting the real database

1. Put the real connection string in `.env` as `DATABASE_URL` (the default is a dummy value).
2. Run `sql/schema_additions.sql` once. The API needs a few things that are not in the
   11-table reference yet:

   | Addition | Why |
   |---|---|
   | `Sales_Order_Item` table | orders can hold several products |
   | `Inventory.reorder_level` | low-stock alerts |
   | `is_active` on `Users`, `Employee`, `Customer` | soft delete instead of removing rows |
   | `Purchase_Request.rejection_reason` | "reject and record the reason" |
   | the 5 role rows | role names must be exactly `admin, manager, sales, inventory, employee` |

3. Create the first administrator: `python -m scripts.seed --email you@company.com`
   (asks for the password; nothing is hard-coded).

Quick local try-out without SQL Server: set `DATABASE_URL=sqlite:///./dev.db` and run
`python -m scripts.seed --create-tables --email admin@example.com`.

## Roles and access

`admin`, `manager`, `sales`, `inventory`, `employee`. Permissions are defined once in
`app/core/constants.py` (class `Perm`) and mirror the "Access" column of the spec.

## Business rules built in

- **Stock never goes negative.** Stock is changed with one conditional `UPDATE ... WHERE qty >= n`,
  so two people acting at once cannot overdraw it.
- **Orders:** the server calculates the total. Stock is checked when an order is created, deducted
  when it is **Confirmed** (all lines or nothing), and returned if a Confirmed order is cancelled.
  Workflow: Pending -> Confirmed -> Shipped -> Delivered; Shipped/Delivered orders can't be cancelled.
- **Tasks:** "Overdue" is calculated from the due date (never stored, so it is always correct).
  Employees update their own tasks; only managers can re-open a completed one.
- **Purchase requests:** approval is for the whole request. Approve/reject locks it; a rejection needs
  a reason. After approval it moves In Progress -> Completed -> Closed, and completing can
  optionally add the ordered quantities to stock (`receive_stock: true`).
- **Users:** soft delete only; an admin can't deactivate or demote themselves, and the last active
  admin can't be removed.

## Security notes

- Passwords: Argon2 hashes; never returned by any endpoint; strength rule on create/reset.
- JWT holds only the user id. The role is read from the database on every request, so access changes
  and deactivations take effect immediately.
- Login: same error for wrong password/unknown email, equal timing, and lockout after
  5 failed attempts (in-memory - move to Redis if you run several workers).
- `SECRET_KEY` must be 32+ random characters when `ENVIRONMENT=production` or the app refuses to start.
- All inputs validated by Pydantic; list endpoints are paginated (max 100); database constraint errors
  return a clean 409 without leaking SQL.

## Tests

```powershell
pytest
```

## Notes

- URL prefix is `/api/v1` (as in the original scaffold). `GET /api/v1/dashboard/summary` keeps its old
  response shape; `GET /api/v1/admin/users` was replaced by `GET /api/v1/users`.
- The old demo accounts and mock data were removed - login now uses the database.
