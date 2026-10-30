"""Customer records."""
from typing import Any

from sqlalchemy import select, true
from sqlalchemy.orm import Session

from app.api.deps import PageParams
from app.core.errors import not_found
from app.models import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.common import like, paginate


def get_customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise not_found("Customer")
    return customer


def list_customers(
    db: Session, params: PageParams, search: str | None, include_inactive: bool,
) -> dict[str, Any]:
    stmt = select(Customer).order_by(Customer.customer_id)
    if not include_inactive:
        stmt = stmt.where(Customer.is_active == true())
    if search:
        stmt = stmt.where(
            like(Customer.name, search) | like(Customer.email, search)
            | like(Customer.phone, search)
        )
    return paginate(db, stmt, params)


def create_customer(db: Session, data: CustomerCreate) -> Customer:
    customer = Customer(
        name=data.name.strip(),
        email=str(data.email).lower() if data.email else None,
        phone=data.phone,
        address=data.address,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)  # pick up created_at
    return customer


def update_customer(db: Session, customer_id: int, data: CustomerUpdate) -> Customer:
    customer = get_customer(db, customer_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "email" and value is not None:
            value = str(value).lower()
        setattr(customer, field, value)
    db.commit()
    return customer


def deactivate_customer(db: Session, customer_id: int) -> None:
    """Soft delete - old orders keep pointing at the customer."""
    customer = get_customer(db, customer_id)
    customer.is_active = False
    db.commit()
