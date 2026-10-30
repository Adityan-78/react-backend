"""Aggregated numbers for the role-specific dashboards.

Everything here uses COUNT/SUM ... GROUP BY so the database does the work and
we only ship small result sets back - no loading whole tables into Python.
"""
from decimal import Decimal

from sqlalchemy import func, select, true
from sqlalchemy.orm import Session, joinedload

from app.core.constants import ApprovalStatus, IssueStatus, OrderStatus, Roles, TaskStatus
from app.models import (
    Customer, CustomerTask, Inventory, OperationalIssue, Product,
    PurchaseRequest, Role, SalesOrder, User,
)
from app.models._helpers import today


# --- small building blocks -------------------------------------------------------
def _count_by(db: Session, column, *where) -> dict[str, int]:
    """SELECT column, COUNT(*) ... GROUP BY column  ->  {value: count}"""
    stmt = select(column, func.count()).group_by(column)
    for condition in where:
        stmt = stmt.where(condition)
    return {key: count for key, count in db.execute(stmt).all()}


def _order_summary(db: Session) -> dict:
    by_status = _count_by(db, SalesOrder.status)
    revenue = db.scalar(
        select(func.coalesce(func.sum(SalesOrder.total_amount), 0))
        .where(SalesOrder.status != OrderStatus.CANCELLED)
    )
    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "revenue": Decimal(revenue or 0),
    }


def _overdue_count(db: Session, assigned_to: int | None = None) -> int:
    stmt = select(func.count()).select_from(CustomerTask).where(
        CustomerTask.due_date < today(), CustomerTask.status != TaskStatus.COMPLETED
    )
    if assigned_to is not None:
        stmt = stmt.where(CustomerTask.assigned_to == assigned_to)
    return db.scalar(stmt) or 0


def _task_summary(db: Session) -> dict:
    by_status = _count_by(db, CustomerTask.status)
    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "overdue": _overdue_count(db),
    }


def _issue_summary(db: Session) -> dict:
    by_status = _count_by(db, OperationalIssue.status)
    still_open = sum(
        n for s, n in by_status.items() if s not in (IssueStatus.RESOLVED, IssueStatus.CLOSED)
    )
    return {"total": sum(by_status.values()), "by_status": by_status, "open": still_open}


def _purchase_summary(db: Session) -> dict:
    by_approval = _count_by(db, PurchaseRequest.approval_status)
    return {
        "total": sum(by_approval.values()),
        "by_approval_status": by_approval,
        "pending_approval": by_approval.get(ApprovalStatus.PENDING, 0),
    }


def _low_stock_filter():
    return (Product.is_active == true()) & (Inventory.quantity_in_stock <= Inventory.reorder_level)


def _low_stock_count(db: Session) -> int:
    return db.scalar(
        select(func.count()).select_from(Inventory).join(Product).where(_low_stock_filter())
    ) or 0


def _stock_summary(db: Session) -> dict:
    total_products = db.scalar(
        select(func.count()).select_from(Product).where(Product.is_active == true())
    ) or 0
    urgent = db.execute(
        select(
            Product.product_id, Product.name,
            Inventory.quantity_in_stock, Inventory.reorder_level,
        )
        .join(Product, Product.product_id == Inventory.product_id)
        .where(_low_stock_filter())
        .order_by(Inventory.quantity_in_stock, Product.name)
        .limit(5)
    ).all()
    return {
        "total_products": total_products,
        "low_stock_count": _low_stock_count(db),
        "low_stock_items": [
            {
                "product_id": r.product_id, "product_name": r.name,
                "quantity_in_stock": r.quantity_in_stock, "reorder_level": r.reorder_level,
            }
            for r in urgent
        ],
    }


# --- the four dashboards -----------------------------------------------------------
def admin_dashboard(db: Session) -> dict:
    by_role = _count_by(db, Role.role_name, User.role_id == Role.role_id)
    active = db.scalar(select(func.count()).select_from(User).where(User.is_active == true())) or 0
    return {
        "users": {"total": sum(by_role.values()), "active": active, "by_role": by_role},
        "orders": _order_summary(db),
        "stock": _stock_summary(db),
        "tasks": _task_summary(db),
        "issues": _issue_summary(db),
        "purchase_requests": _purchase_summary(db),
    }


def manager_dashboard(db: Session) -> dict:
    return {
        "tasks": _task_summary(db),
        "issues": _issue_summary(db),
        "purchase_requests": _purchase_summary(db),
        "orders": _order_summary(db),
    }


def sales_dashboard(db: Session) -> dict:
    recent = db.scalars(
        select(SalesOrder)
        .options(joinedload(SalesOrder.customer))
        .order_by(SalesOrder.order_date.desc(), SalesOrder.order_id.desc())
        .limit(5)
    ).all()
    active_customers = db.scalar(
        select(func.count()).select_from(Customer).where(Customer.is_active == true())
    ) or 0
    total_customers = db.scalar(select(func.count()).select_from(Customer)) or 0
    return {
        "orders": _order_summary(db),
        "customers": {"total": total_customers, "active": active_customers},
        "recent_orders": [
            {
                "order_id": o.order_id, "customer_name": o.customer.name,
                "order_date": o.order_date, "status": o.status,
                "total_amount": o.total_amount,
            }
            for o in recent
        ],
    }


def inventory_dashboard(db: Session) -> dict:
    return {"stock": _stock_summary(db), "purchase_requests": _purchase_summary(db)}


# --- legacy summary (the first React screen calls GET /dashboard/summary) ------------
def legacy_summary(db: Session, user: User) -> dict:
    """Four headline numbers, tailored to the caller's role. Keeps the response
    shape the frontend already uses: {"user": {...}, "metrics": {...}}."""
    role = user.role.role_name
    emp_id = user.employee.employee_id if user.employee else None

    metrics = {"total_orders": 0, "pending_approvals": 0, "low_stock_products": 0, "overdue_tasks": 0}

    if role in (Roles.ADMIN, Roles.MANAGER, Roles.SALES):
        metrics["total_orders"] = db.scalar(select(func.count()).select_from(SalesOrder)) or 0
    if role in (Roles.ADMIN, Roles.MANAGER, Roles.INVENTORY):
        metrics["pending_approvals"] = db.scalar(
            select(func.count()).select_from(PurchaseRequest)
            .where(PurchaseRequest.approval_status == ApprovalStatus.PENDING)
        ) or 0
    if role in (Roles.ADMIN, Roles.MANAGER, Roles.INVENTORY):
        metrics["low_stock_products"] = _low_stock_count(db)

    if role in (Roles.ADMIN, Roles.MANAGER):
        metrics["overdue_tasks"] = _overdue_count(db)
    elif emp_id is not None:
        metrics["overdue_tasks"] = _overdue_count(db, assigned_to=emp_id)

    return {"user": {"name": user.name, "role": role}, "metrics": metrics}
