# BizOps – Business Operations Management System (React frontend)

Role-based dashboard for sales orders, inventory, employee tasks, purchase requests and approvals,
connected to the FastAPI backend (`/api/v1`).

## Run with the real backend
1. Start the backend: `uvicorn app.main:app --reload` (check http://127.0.0.1:8000/health).
2. In the backend `.env`, set `FRONTEND_ORIGIN=http://localhost:5173`.
3. Here, `.env` already contains:
   ```
   VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
   VITE_DEMO_MODE=false
   ```
4. `npm install` (once), then `npm run dev`, and open http://localhost:5173.
5. Sign in with a user from the backend database.

## Run without a backend (demo mode)
Set `VITE_DEMO_MODE=true` in `.env`, then `npm run dev`. Demo logins:

| Role | Email | Password |
|---|---|---|
| Administrator | admin@demo.com | Admin123 |
| Manager | manager@demo.com | Manager123 |
| Sales Executive | sales@demo.com | Sales123 |
| Inventory Executive | inventory@demo.com | Inventory123 |
| Employee | employee@demo.com | Employee123 |

## Where things are
- `src/api/endpoints.js` – every backend URL
- `src/api/client.js` – `apiFetch` (token, errors, 204)
- `src/config/roles.js` – menus, permissions, categories
- `src/pages/` – one file per screen
