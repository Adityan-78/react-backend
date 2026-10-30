from fastapi import APIRouter

from app.api.endpoints import auth, dashboard, admin, employees, customers
from app.api.endpoints import products, inventory, orders, purchases, tasks, issues

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employees"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(orders.router, prefix="/orders", tags=["Sales Orders"])
api_router.include_router(purchases.router, prefix="/purchase-requests", tags=["Purchase Requests"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(issues.router, prefix="/issues", tags=["Operational Issues"])
