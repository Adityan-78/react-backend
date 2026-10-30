"""Response shapes for the role-specific dashboards."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class UserSummary(BaseModel):
    total: int
    active: int
    by_role: dict[str, int]


class OrderSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    revenue: Decimal  # cancelled orders are not counted


class OrderBrief(BaseModel):
    order_id: int
    customer_name: str
    order_date: date
    status: str
    total_amount: Decimal


class LowStockItem(BaseModel):
    product_id: int
    product_name: str
    quantity_in_stock: int
    reorder_level: int


class StockSummary(BaseModel):
    total_products: int
    low_stock_count: int
    low_stock_items: list[LowStockItem]  # the 5 most urgent


class TaskSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    overdue: int


class IssueSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    open: int  # anything not Resolved/Closed


class PurchaseSummary(BaseModel):
    total: int
    by_approval_status: dict[str, int]
    pending_approval: int


class CustomerSummary(BaseModel):
    total: int
    active: int


class AdminDashboard(BaseModel):
    users: UserSummary
    orders: OrderSummary
    stock: StockSummary
    tasks: TaskSummary
    issues: IssueSummary
    purchase_requests: PurchaseSummary


class ManagerDashboard(BaseModel):
    tasks: TaskSummary
    issues: IssueSummary
    purchase_requests: PurchaseSummary
    orders: OrderSummary


class SalesDashboard(BaseModel):
    orders: OrderSummary
    customers: CustomerSummary
    recent_orders: list[OrderBrief]


class InventoryDashboard(BaseModel):
    stock: StockSummary
    purchase_requests: PurchaseSummary


# --- Legacy shape used by the first React dashboard (GET /dashboard/summary) ---
class DashboardSummary(BaseModel):
    user: dict
    metrics: dict
