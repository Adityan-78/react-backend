# Business Operations Management System - Backend

FastAPI modular-monolith scaffold for the React dashboard.

## Initial scope
- Dummy login with JWT authentication
- `/api/v1/auth/me`
- Role-specific `/api/v1/dashboard/summary`
- Admin-only `/api/v1/admin/users`
- Mock repositories designed to be replaced by PostgreSQL/SQLAlchemy repositories

## Roles
`admin`, `manager`, `sales`, `inventory`, `employee`

## Run on Windows PowerShell
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs

## Demo accounts
- admin@demo.com / Admin123!
- manager@demo.com / Manager123!
- sales@demo.com / Sales123!
- inventory@demo.com / Inventory123!
- employee@demo.com / Employee123!

Demo accounts and mock data are for local development only. Do not deploy them.

## ER diagram notes
- Keep `USER` separate from `EMPLOYEE`: USER stores login identity, role, password hash and active status; EMPLOYEE stores employment details.
- `ROLE` has a one-to-many relationship with `USER`.
- `PURCHASE_REQUEST` needs decision/approval fields or a separate `APPROVAL` table if approval history is required.
- Add `ORDER_ITEM` if a sales order can contain multiple products.
- If tasks are customer-related, add `customer_id`; otherwise name the table/entity `TASK`.
- Add inventory movement records if stock changes need an audit trail.

The initial scaffold uses mock data. Database models, migrations and repository implementations can be filled in when PostgreSQL integration begins.
