from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DbSession, Paging, require_roles
from app.core.constants import Perm
from app.schemas.common import Page
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.schemas.task import TaskOut
from app.services import employee_service, task_service

router = APIRouter()

view = Depends(require_roles(*Perm.EMPLOYEE_VIEW))
admin = Depends(require_roles(*Perm.ADMIN_ONLY))


@router.get("", response_model=Page[EmployeeOut], dependencies=[view])
def list_employees(
    db: DbSession, params: Paging, department: str | None = None,
    is_active: bool | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
):
    return employee_service.list_employees(db, params, department, is_active, search)


@router.get("/{employee_id}/tasks", response_model=Page[TaskOut], dependencies=[view])
def employee_tasks(employee_id: int, db: DbSession, params: Paging, status: str | None = None):
    """Tasks assigned to one employee."""
    employee_service.get_employee(db, employee_id)  # 404 if the employee doesn't exist
    return task_service.list_tasks(db, params, assigned_to=employee_id, status=status)


@router.get("/{employee_id}", response_model=EmployeeOut, dependencies=[view])
def get_employee(employee_id: int, db: DbSession):
    return employee_service.get_employee(db, employee_id)


@router.post("", response_model=EmployeeOut, status_code=201, dependencies=[admin])
def create_employee(data: EmployeeCreate, db: DbSession):
    return employee_service.create_employee(db, data)


@router.put("/{employee_id}", response_model=EmployeeOut, dependencies=[admin])
def update_employee(employee_id: int, data: EmployeeUpdate, db: DbSession):
    return employee_service.update_employee(db, employee_id, data)

