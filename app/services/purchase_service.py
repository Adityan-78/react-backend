"""Purchase requests, their items and the manager approval workflow.

Life of a request:
    Submitted / Pending  --approve-->  In Progress / Approved  --> Completed --> Closed
                         --reject-->   Closed / Rejected (reason recorded)

Approval is decided for the WHOLE request (as the design notes recommend). The
decision is copied onto every item so request and items never disagree.
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import PageParams
from app.core.constants import PR_TRANSITIONS, ApprovalStatus, PRStatus, Roles
from app.core.errors import bad_request, conflict, forbidden, not_found
from app.models import Employee, Product, PurchaseRequest, PurchaseRequestItem, User
from app.models._helpers import today
from app.schemas.purchase import PRCreate, PRItemIn, PRItemUpdate, PRUpdate
from app.services import inventory_service
from app.services.common import paginate

_LOAD = (
    joinedload(PurchaseRequest.requester).joinedload(Employee.user),
    selectinload(PurchaseRequest.items).joinedload(PurchaseRequestItem.product),
)


# --- loading and access checks -------------------------------------------------
def get_request(db: Session, pr_id: int) -> PurchaseRequest:
    pr = db.scalar(
        select(PurchaseRequest)
        .options(*_LOAD)
        .where(PurchaseRequest.pr_id == pr_id)
        .execution_options(populate_existing=True)
    )
    if pr is None:
        raise not_found("Purchase request")
    return pr


def _is_requester(user: User, pr: PurchaseRequest) -> bool:
    return user.employee is not None and user.employee.employee_id == pr.raised_by


def get_request_for_user(db: Session, pr_id: int, user: User, allow_inventory: bool = False) -> PurchaseRequest:
    """Requester, manager and admin may view a request (inventory too, when
    `allow_inventory` is set - used by the items list)."""
    pr = get_request(db, pr_id)
    allowed_roles = {Roles.MANAGER, Roles.ADMIN}
    if allow_inventory:
        allowed_roles.add(Roles.INVENTORY)
    if not (_is_requester(user, pr) or user.role.role_name in allowed_roles):
        raise forbidden()
    return pr


def _require_open_for_edit(pr: PurchaseRequest) -> None:
    """Once a manager has decided, the request is locked."""
    if pr.approval_status != ApprovalStatus.PENDING:
        raise conflict("This request has already been decided and can no longer be edited")


# --- lists -----------------------------------------------------------------------
def list_requests(
    db: Session, params: PageParams, status: str | None = None,
    approval_status: str | None = None, raised_by: int | None = None,
) -> dict[str, Any]:
    stmt = select(PurchaseRequest).options(*_LOAD).order_by(
        PurchaseRequest.request_date.desc(), PurchaseRequest.pr_id.desc()
    )
    if status:
        stmt = stmt.where(PurchaseRequest.status == status)
    if approval_status:
        stmt = stmt.where(PurchaseRequest.approval_status == approval_status)
    if raised_by is not None:
        stmt = stmt.where(PurchaseRequest.raised_by == raised_by)
    return paginate(db, stmt, params)


def list_pending_approval(db: Session, params: PageParams) -> dict[str, Any]:
    return list_requests(db, params, approval_status=ApprovalStatus.PENDING)


# --- items -------------------------------------------------------------------------
def _build_items(db: Session, items: list[PRItemIn]) -> list[PurchaseRequestItem]:
    ids = [i.product_id for i in items]
    products = {
        p.product_id: p
        for p in db.scalars(select(Product).where(Product.product_id.in_(ids)))
    }
    built = []
    for item in items:
        product = products.get(item.product_id)
        if product is None:
            raise bad_request(f"Product {item.product_id} does not exist")
        if not product.is_active:
            raise bad_request(f"Product '{product.name}' is not active")
        built.append(
            PurchaseRequestItem(
                product_id=item.product_id,
                quantity=item.quantity,
                estimated_price=item.estimated_price,
                notes=item.notes,
                status=ApprovalStatus.PENDING,
            )
        )
    return built


def _get_item(db: Session, pr_item_id: int) -> PurchaseRequestItem:
    item = db.get(PurchaseRequestItem, pr_item_id)
    if item is None:
        raise not_found("Purchase request item")
    return item


def add_item(db: Session, pr_id: int, data: PRItemIn) -> PurchaseRequest:
    pr = get_request(db, pr_id)
    _require_open_for_edit(pr)
    if any(i.product_id == data.product_id for i in pr.items):
        raise conflict("This product is already on the request - update its quantity instead")
    pr.items.extend(_build_items(db, [data]))
    db.commit()
    return get_request(db, pr_id)


def update_item(db: Session, pr_item_id: int, data: PRItemUpdate) -> PurchaseRequest:
    item = _get_item(db, pr_item_id)
    pr = get_request(db, item.pr_id)
    _require_open_for_edit(pr)
    # Reload the item through the request so we edit the loaded instance.
    item = next(i for i in pr.items if i.pr_item_id == pr_item_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field == "quantity":
            continue  # quantity is required
        setattr(item, field, value)
    db.commit()
    return get_request(db, pr.pr_id)


def delete_item(db: Session, pr_item_id: int) -> PurchaseRequest:
    item = _get_item(db, pr_item_id)
    pr = get_request(db, item.pr_id)
    _require_open_for_edit(pr)
    pr.items = [i for i in pr.items if i.pr_item_id != pr_item_id]  # delete-orphan removes it
    db.commit()
    return get_request(db, pr.pr_id)


# --- create / update -----------------------------------------------------------------
def create_request(db: Session, data: PRCreate, requester: Employee) -> PurchaseRequest:
    pr = PurchaseRequest(
        raised_by=requester.employee_id,
        request_date=data.request_date,  # None -> today
        status=PRStatus.SUBMITTED,
        approval_status=ApprovalStatus.PENDING,
        items=_build_items(db, data.items),
    )
    db.add(pr)
    db.commit()
    return get_request(db, pr.pr_id)


def update_request(db: Session, pr_id: int, data: PRUpdate, user: User) -> PurchaseRequest:
    pr = get_request(db, pr_id)
    # Spec: "Requester, Inventory" may edit, but only before the decision.
    if not (_is_requester(user, pr) or user.role.role_name == Roles.INVENTORY):
        raise forbidden()
    _require_open_for_edit(pr)

    if data.request_date is not None:
        pr.request_date = data.request_date
    if data.items is not None:
        pr.items = _build_items(db, data.items)  # replaces every item
    db.commit()
    return get_request(db, pr_id)


# --- approval workflow ----------------------------------------------------------------
def approve(db: Session, pr_id: int, manager: Employee) -> PurchaseRequest:
    pr = get_request(db, pr_id)
    _require_open_for_edit(pr)
    if not pr.items:
        raise conflict("A request with no items cannot be approved")

    pr.approval_status = ApprovalStatus.APPROVED
    pr.status = PRStatus.IN_PROGRESS
    pr.rejection_reason = None
    _stamp_items(pr, ApprovalStatus.APPROVED, manager)
    db.commit()
    return get_request(db, pr_id)


def reject(db: Session, pr_id: int, reason: str, manager: Employee) -> PurchaseRequest:
    pr = get_request(db, pr_id)
    _require_open_for_edit(pr)

    pr.approval_status = ApprovalStatus.REJECTED
    pr.status = PRStatus.CLOSED
    pr.rejection_reason = reason.strip()
    _stamp_items(pr, ApprovalStatus.REJECTED, manager)
    db.commit()
    return get_request(db, pr_id)


def _stamp_items(pr: PurchaseRequest, decision: str, manager: Employee) -> None:
    """Copy the manager's decision onto each item (who + when + outcome)."""
    for item in pr.items:
        item.status = decision
        item.approval_id = manager.employee_id
        item.approved_date = today()


def update_status(db: Session, pr_id: int, new_status: str, receive_stock: bool) -> PurchaseRequest:
    pr = get_request(db, pr_id)
    if pr.approval_status != ApprovalStatus.APPROVED:
        raise conflict("Only approved requests can be moved through fulfilment")
    if new_status not in PR_TRANSITIONS.get(pr.status, set()):
        raise conflict(f"A request cannot move from {pr.status} to {new_status}")

    if receive_stock:
        if new_status != PRStatus.COMPLETED:
            raise bad_request("receive_stock can only be used when completing a request")
        # Goods arrived: add every ordered quantity to stock in the same transaction.
        for item in pr.items:
            inventory_service.add_stock(db, item.product_id, item.quantity)

    pr.status = new_status
    db.commit()
    return get_request(db, pr_id)
