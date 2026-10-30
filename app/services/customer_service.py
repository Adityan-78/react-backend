"""Customer records (the supplied Customer table has no active flag)."""
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import PageParams
from app.core.errors import not_found
from app.models import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.common import like, paginate

def get_customer(db: Session, customer_id: int) -> Customer:
    obj = db.get(Customer, customer_id)
    if obj is None: raise not_found("Customer")
    return obj

def list_customers(db: Session, params: PageParams, search: str | None) -> dict[str, Any]:
    stmt = select(Customer).order_by(Customer.customer_id)
    if search:
        stmt = stmt.where(like(Customer.name, search) | like(Customer.email, search) | like(Customer.phone, search))
    return paginate(db, stmt, params)

def create_customer(db: Session, data: CustomerCreate) -> Customer:
    obj = Customer(name=data.name.strip(), email=str(data.email).lower() if data.email else None, phone=data.phone, address=data.address)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_customer(db: Session, customer_id: int, data: CustomerUpdate) -> Customer:
    obj = get_customer(db, customer_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "email" and value is not None: value = str(value).lower()
        setattr(obj, field, value)
    db.commit(); return obj
