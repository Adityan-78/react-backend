# Existing SQL Server schema compatibility notes

This backend is mapped to the supplied existing tables. It must not execute schema migrations or create/alter database objects.

## Important assumptions

- `dbo.Users.IsActive` exists as `VARCHAR(3)` with `Yes` / `No` values. The SQLAlchemy model exposes a Boolean-like `User.is_active` property and maps it to that existing string column.
- `dbo.Employee` has no active column. Employee active status is derived from its linked `Users` row.
- `dbo.Customer` has no active column. Customer deletion/deactivation is not offered by the API.
- `dbo.Product.is_active` exists as `BIT` and remains supported.
- `dbo.Inventory` has no `reorder_level`. The API's `reorder_level` response field is an application-configured threshold (`LOW_STOCK_THRESHOLD`, default 10), not a stored DB field.
- `dbo.Sales_Order` is a header-only table. It has no order-line table or product/quantity fields. Sales order create/update accepts the customer, date, total and notes. It does not reserve or deduct inventory.
- `dbo.Purchase_Request` has no `rejection_reason`. Reject requests without storing a reason. Item-level approval metadata remains stored in `Purchase_Request_Item` (`approval_id`, `approved_date`, `status`).
- Role comparisons use the exact seeded role names: `Administrator`, `Manager`, `Sales Executive`, `Inventory Executive`, `Employee`.
- Existing user passwords are bcrypt hashes. Login verifies bcrypt hashes; newly created/reset passwords are stored using Argon2.

## Configuration

Copy `.env.example` to `.env`, then provide the real SQL Server connection string and a unique secret. Never commit `.env`.

## No database mutation

Do not run any migration or schema-additions SQL as part of backend startup. SQLAlchemy is used for queries and transactions; it is not configured to create or alter tables.
