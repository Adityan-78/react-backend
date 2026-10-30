from fastapi import APIRouter

from app.api.endpoints import (
    auth, customers, dashboard, employees, inventory, issues, orders,
    products, purchases, roles, tasks, users,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employees"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(orders.router, prefix="/orders", tags=["Sales Orders"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(issues.router, prefix="/issues", tags=["Operational Issues"])
api_router.include_router(purchases.router, prefix="/purchase-requests", tags=["Purchase Requests"])
api_router.include_router(
    purchases.item_router, prefix="/purchase-request-items", tags=["Purchase Request Items"]
)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
