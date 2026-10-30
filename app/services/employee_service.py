"""Employee profiles (linked 1-to-1 with a user account)."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import PageParams
from app.core.errors import conflict, not_found
from app.models import Employee, User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.services.common import like, paginate

# Load the user (and its role) in the same query - names/roles are in responses.
_LOAD = (joinedload(Employee.user).joinedload(User.role),)


def get_employee(db: Session, employee_id: int) -> Employee:
    emp = db.scalar(
        select(Employee)
        .options(*_LOAD)
        .where(Employee.employee_id == employee_id)
        .execution_options(populate_existing=True)
    )
    if emp is None:
        raise not_found("Employee")
    return emp


def list_employees(
    db: Session, params: PageParams, department: str | None,
    is_active: bool | None, search: str | None,
) -> dict[str, Any]:
    stmt = (
        select(Employee).options(*_LOAD).join(User, Employee.user_id == User.user_id)
        .order_by(Employee.employee_id)
    )
    if department:
        stmt = stmt.where(like(Employee.department, department))
    if is_active is not None:
        stmt = stmt.where(Employee.is_active == is_active)
    if search:
        stmt = stmt.where(
            like(User.name, search) | like(User.email, search)
            | like(Employee.designation, search)
        )
    return paginate(db, stmt, params)


def create_employee(db: Session, data: EmployeeCreate) -> Employee:
    user = db.get(User, data.user_id)
    if user is None:
        raise not_found("User")
    if db.scalar(select(Employee.employee_id).where(Employee.user_id == data.user_id)):
        raise conflict("This user already has an employee profile")

    emp = Employee(
        user_id=data.user_id,
        designation=data.designation,
        department=data.department,
        phone=data.phone,
        hire_date=data.hire_date,  # None -> model default (today)
    )
    db.add(emp)
    db.commit()
    return get_employee(db, emp.employee_id)


def update_employee(db: Session, employee_id: int, data: EmployeeUpdate) -> Employee:
    emp = get_employee(db, employee_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(emp, field, value)
    db.commit()
    return get_employee(db, emp.employee_id)


def deactivate_employee(db: Session, employee_id: int) -> None:
    """Soft delete - tasks, issues and approvals still reference this person."""
    emp = get_employee(db, employee_id)
    emp.is_active = False
    db.commit()
