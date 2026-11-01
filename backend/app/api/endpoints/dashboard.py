from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, DbSession, require_roles
from app.core.constants import Roles
from app.schemas.dashboard import (
    AdminDashboard, DashboardSummary, InventoryDashboard, ManagerDashboard,
    SalesDashboard,
)
from app.services import dashboard_service

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def summary(user: CurrentUser, db: DbSession):
    """Four headline numbers for whoever is logged in (original dashboard shape)."""
    return dashboard_service.legacy_summary(db, user)


@router.get("/admin", response_model=AdminDashboard, dependencies=[Depends(require_roles(Roles.ADMIN))])
def admin_dashboard(db: DbSession):
    return dashboard_service.admin_dashboard(db)


@router.get("/manager", response_model=ManagerDashboard, dependencies=[Depends(require_roles(Roles.MANAGER))])
def manager_dashboard(db: DbSession):
    return dashboard_service.manager_dashboard(db)


@router.get("/sales", response_model=SalesDashboard, dependencies=[Depends(require_roles(Roles.SALES))])
def sales_dashboard(db: DbSession):
    return dashboard_service.sales_dashboard(db)


@router.get("/inventory", response_model=InventoryDashboard, dependencies=[Depends(require_roles(Roles.INVENTORY))])
def inventory_dashboard(db: DbSession):
    return dashboard_service.inventory_dashboard(db)
