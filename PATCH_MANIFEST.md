# Backend compatibility patch — apply instructions

This patch adapts the FastAPI code to the supplied SQL Server schema without adding or altering any database objects.

## Apply

1. Make a backup/commit of your current backend first.
2. Extract this archive into your existing `backend` directory, preserving folders and allowing the listed files to be overwritten.
3. Delete the old `sql/schema_additions.sql` from your working backend (do not execute it). Do **not** run any SQL scripts or Alembic migrations.
4. Create your local `.env` by copying `.env.example`, then fill in the real SQL Server connection details and a strong secret. Never commit `.env`.
5. Install updated dependencies: `pip install -r requirements.txt`.
6. Start from the backend project root: `uvicorn app.main:app --reload`.
7. Test login and the affected API routes against a development copy of the SQL Server database before merging.

## Files in this patch

- `app/models/user.py`: maps `Users.IsActive VARCHAR(3)` as Yes/No and derives Employee active status from its linked User.
- `app/models/customer.py`: removes the nonexistent Customer active field.
- `app/models/product.py`: removes the nonexistent Inventory reorder column; low-stock threshold is config-only.
- `app/models/order.py`, `app/models/__init__.py`: remove the nonexistent Sales_Order_Item ORM table and relationship.
- `app/models/purchase.py`: removes nonexistent Purchase_Request.rejection_reason.
- `app/core/constants.py`: uses exact role names from the supplied Role seed SQL.
- `app/core/security.py`, `requirements.txt`: verifies existing bcrypt hashes and keeps Argon2 for new password hashes.
- `app/core/config.py`, `.env.example`: adds configurable low-stock threshold and connection configuration template.
- Customer, employee, inventory, product, order, purchase and dashboard schemas/services/endpoints: remove unsupported DB-column assumptions and adapt API behavior.
- `scripts/seed.py`: blocks all writes when configured for SQL Server; SQLite only.
- `README.md`, `DB_SCHEMA_COMPATIBILITY.md`, `.gitignore`: document the no-migration rule and protect secrets.

## API contract changes frontend developers must know

- Employee `is_active` is derived from the linked user; deactivate the user through `/api/v1/users/{user_id}`. There is no separate employee deactivation route.
- Customer `is_active` and customer DELETE/deactivation are removed because Customer has no such column.
- Inventory low-stock threshold is application configuration (`LOW_STOCK_THRESHOLD`, default 10). It is not stored in SQL Server. Inventory update only changes `quantity_in_stock`.
- Product creation accepts `initial_stock`, but no `reorder_level`.
- Sales orders are header-only: create/update accepts `customer_id`, `order_date`, `total_amount`, and `notes`. There are no order line items and order status changes do not adjust stock.
- Purchase request rejection has no reason body because the database has no place to persist a rejection reason.
- Role values returned/used by the API are the exact DB names: `Administrator`, `Manager`, `Sales Executive`, `Inventory Executive`, `Employee`.

## Important source-data warning

The separately uploaded `02_Users.sql` includes `DROP TABLE dbo.Users`. Never rerun that script on a database containing existing users. This patch does not include or execute any SQL script.

## Validation limitation

Python source compilation was checked with `python -m compileall app scripts`. This patch has not been integration-tested against your live SQL Server instance. The original scaffold test suite contains expectations for the old, unsupported schema (such as Sales_Order_Item and Inventory.reorder_level), so it needs to be revised before its results can be considered authoritative.
