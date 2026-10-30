# Business Operations Management System — FastAPI backend

This backend is mapped to the existing SQL Server schema supplied with the project. It must not create, alter, or migrate the SQL Server tables.

## Stack

- FastAPI + Uvicorn
- SQLAlchemy ORM
- SQL Server via Microsoft ODBC Driver 18 and PyODBC
- Pydantic validation
- JWT authentication
- bcrypt verification for existing seeded hashes; Argon2 for newly created/reset passwords

## Project layout

```text
app/
  main.py
  api/          routers, dependencies and endpoints
  core/         configuration, JWT/password security, constants
  db/           SQLAlchemy base, engine and request sessions
  models/       mappings to the existing SQL Server tables
  schemas/      request/response validation
  services/     business logic and database queries
scripts/        optional local development seed helper
```

## Setup (Windows PowerShell)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` with the actual SQL Server connection string and a unique `SECRET_KEY`. Never commit `.env`.

Start from the `backend` project root:

```powershell
uvicorn app.main:app --reload
```

Interactive API docs: `http://127.0.0.1:8000/docs`  
OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## Database connection

`app/core/config.py` loads `DATABASE_URL` from `.env`. `app/db/session.py` creates the SQLAlchemy engine and per-request sessions. Endpoints receive a session through `DbSession`; services use that session to query SQL Server.

Example URL (replace every placeholder):

```env
DATABASE_URL=mssql+pyodbc://USERNAME:PASSWORD@SERVER:1433/B3A-S7-T2?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
```

URL-encode special characters in the password. Use the actual server/instance and authentication method configured by your SQL Server administrator.

## Schema compatibility rules

The backend maps the supplied schema; it does not redesign it:

- `Users.IsActive` is `VARCHAR(3)` (`Yes` / `No`). The Python model exposes `User.is_active` as a Boolean-style property.
- Employee active status is derived from its linked Users row; Employee has no active column.
- Customer has no active column; customer soft-delete/deactivation is not exposed.
- Product has `is_active BIT` and this remains supported.
- Inventory has no `reorder_level`. The low-stock threshold is an application setting (`LOW_STOCK_THRESHOLD`, default `10`), not a database field.
- Sales_Order is a header-only table. It has no product lines. Sales order endpoints store customer/date/status/total/notes only and do not deduct inventory.
- Purchase_Request has no `rejection_reason`. Rejecting a request updates the existing status fields and item approval metadata; no reason is persisted.
- Role checks use the exact role names in the supplied Role data: `Administrator`, `Manager`, `Sales Executive`, `Inventory Executive`, `Employee`.

**Do not execute `schema_additions.sql`, run Alembic migrations, or use `Base.metadata.create_all()` against the SQL Server database.** The `02_Users.sql` seed script includes `DROP TABLE`; do not rerun it against a database with existing user data. The already-approved `Users.IsActive` addition should be managed separately by the database owner and is not performed by this application.

## Authentication flow

1. React posts email/password to `/api/v1/auth/login`.
2. `auth_service.py` fetches the user from SQL Server and verifies the stored password hash.
3. A login is rejected unless `Users.IsActive = 'Yes'`.
4. The API returns a JWT.
5. Protected requests send `Authorization: Bearer <token>`.
6. `app/api/deps.py` validates the token, reloads the user and role from SQL Server, and enforces role permissions.

## Roles

The role strings are the exact values stored in `dbo.Role.role_name`: Administrator, Manager, Sales Executive, Inventory Executive and Employee. Permission groups are centralized in `app/core/constants.py`.

## Security / Git

Commit `.env.example`, not `.env`. Do not commit database backups, real data exports, SQL Server credentials, private keys/certificates, or seed dumps containing real personal data or password hashes. `.gitignore` excludes common local secrets and generated files.

## Tests

The original scaffold tests were written for the previous proposed schema (including Sales_Order_Item and Inventory.reorder_level). They must be updated to the header-only Sales_Order and actual schema contract before being treated as a valid regression suite. Compile check: `python -m compileall app`.
