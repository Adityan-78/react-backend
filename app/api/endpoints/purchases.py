"""Purchase requests, their items, and the approve / reject workflow.

Two routers live here because the item routes sit under two different URL
prefixes (/purchase-requests/... and /purchase-request-items/...).
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentEmployee, CurrentUser, DbSession, Paging, require_roles
from app.core.config import settings
from app.core.constants import Perm, Roles
from app.schemas.common import Page
from app.schemas.purchase import (
    PRCreate, PRItemIn, PRItemOut, PRItemUpdate, PROut,
    PRStatusUpdate, PRUpdate,
)
from app.services import purchase_service

router = APIRouter()        # mounted at /purchase-requests
item_router = APIRouter()   # mounted at /purchase-request-items

list_view = Depends(require_roles(*Perm.PR_LIST))
decide = Depends(require_roles(*Perm.PR_DECIDE))
fulfil = Depends(require_roles(*Perm.PR_STATUS))
item_manage = Depends(require_roles(*Perm.PR_ITEM_MANAGE))
any_staff = Depends(require_roles(*Perm.ANY_ROLE))


def _may_create(user: CurrentUser) -> None:
    """Inventory executives can always raise requests; plain employees only
    when EMPLOYEE_PURCHASE_REQUESTS_ENABLED=true."""
    allowed = user.role.role_name == Roles.INVENTORY or (
        settings.employee_purchase_requests_enabled and user.role.role_name == Roles.EMPLOYEE
    )
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot raise purchase requests")


# ----------------------------------------------------------------------------
# Requests
# ----------------------------------------------------------------------------
@router.get("", response_model=Page[PROut], dependencies=[list_view])
def list_requests(
    db: DbSession, params: Paging, status: str | None = None,
    approval_status: str | None = None,
):
    return purchase_service.list_requests(db, params, status, approval_status)


# Static paths ("/my", "/pending-approval") before "/{pr_id}".
@router.get("/my", response_model=Page[PROut], dependencies=[any_staff])
def my_requests(employee: CurrentEmployee, user: CurrentUser, db: DbSession, params: Paging):
    """Requests I submitted (inventory executives; employees when enabled)."""
    if user.role.role_name not in (Roles.INVENTORY, Roles.EMPLOYEE):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to perform this action")
    return purchase_service.list_requests(db, params, raised_by=employee.employee_id)


@router.get("/pending-approval", response_model=Page[PROut], dependencies=[decide])
def pending_approval(db: DbSession, params: Paging):
    """Requests waiting for a manager's decision."""
    return purchase_service.list_pending_approval(db, params)


@router.get("/{pr_id}", response_model=PROut)
def get_request(pr_id: int, user: CurrentUser, db: DbSession):
    # Requester, manager or admin (checked in the service).
    return purchase_service.get_request_for_user(db, pr_id, user)


@router.post("", response_model=PROut, status_code=status.HTTP_201_CREATED)
def create_request(data: PRCreate, user: CurrentUser, employee: CurrentEmployee, db: DbSession):
    _may_create(user)
    return purchase_service.create_request(db, data, employee)


@router.put("/{pr_id}", response_model=PROut)
def update_request(pr_id: int, data: PRUpdate, user: CurrentUser, db: DbSession):
    """Requester or inventory executive, while the request is still undecided."""
    return purchase_service.update_request(db, pr_id, data, user)


@router.put("/{pr_id}/approve", response_model=PROut, dependencies=[decide])
def approve_request(pr_id: int, manager: CurrentEmployee, db: DbSession):
    return purchase_service.approve(db, pr_id, manager)


@router.put("/{pr_id}/reject", response_model=PROut, dependencies=[decide])
def reject_request(pr_id: int, manager: CurrentEmployee, db: DbSession):
    """Reject a request. The existing schema has no rejection-reason column."""
    return purchase_service.reject(db, pr_id, manager)


@router.put("/{pr_id}/status", response_model=PROut, dependencies=[fulfil])
def update_request_status(pr_id: int, data: PRStatusUpdate, db: DbSession):
    """Move an approved request to Completed / Closed after the decision."""
    return purchase_service.update_status(db, pr_id, data.status, data.receive_stock)


# ----------------------------------------------------------------------------
# Items
# ----------------------------------------------------------------------------
@router.get("/{pr_id}/items", response_model=list[PRItemOut])
def list_items(pr_id: int, user: CurrentUser, db: DbSession):
    """Requester, manager, admin or inventory can see the lines."""
    return purchase_service.get_request_for_user(db, pr_id, user, allow_inventory=True).items


@router.post(
    "/{pr_id}/items", response_model=PROut, status_code=status.HTTP_201_CREATED,
    dependencies=[item_manage],
)
def add_item(pr_id: int, data: PRItemIn, db: DbSession):
    return purchase_service.add_item(db, pr_id, data)


@item_router.put("/{pr_item_id}", response_model=PROut, dependencies=[item_manage])
def update_item(pr_item_id: int, data: PRItemUpdate, db: DbSession):
    return purchase_service.update_item(db, pr_item_id, data)


@item_router.delete("/{pr_item_id}", response_model=PROut, dependencies=[item_manage])
def delete_item(pr_item_id: int, db: DbSession):
    """Remove a line (only before the request is decided). Returns the updated request."""
    return purchase_service.delete_item(db, pr_item_id)
