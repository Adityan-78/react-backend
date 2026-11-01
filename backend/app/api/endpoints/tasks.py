from fastapi import APIRouter, Depends, status

from app.api.deps import CurrentEmployee, CurrentUser, DbSession, Paging, require_roles
from app.core.constants import Perm
from app.schemas.common import Page
from app.schemas.task import TaskCreate, TaskOut, TaskStatusUpdate, TaskUpdate
from app.services import task_service

router = APIRouter()

list_view = Depends(require_roles(*Perm.TASK_LIST))
overdue_view = Depends(require_roles(*Perm.TASK_OVERDUE))
manage = Depends(require_roles(*Perm.TASK_MANAGE))
any_staff = Depends(require_roles(*Perm.ANY_ROLE))


@router.get("", response_model=Page[TaskOut], dependencies=[list_view])
def list_tasks(
    db: DbSession, params: Paging, assigned_to: int | None = None,
    status: str | None = None, priority: str | None = None,
):
    return task_service.list_tasks(db, params, assigned_to, status, priority)


# Static paths ("/my", "/overdue") come before "/{task_id}".
@router.get("/my", response_model=Page[TaskOut], dependencies=[any_staff])
def my_tasks(employee: CurrentEmployee, db: DbSession, params: Paging, status: str | None = None):
    """Tasks assigned to me."""
    return task_service.list_tasks(db, params, assigned_to=employee.employee_id, status=status)


@router.get("/overdue", response_model=Page[TaskOut], dependencies=[overdue_view])
def overdue_tasks(db: DbSession, params: Paging, assigned_to: int | None = None):
    """Tasks past their due date that are not completed."""
    return task_service.list_tasks(db, params, assigned_to=assigned_to, overdue_only=True)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, user: CurrentUser, db: DbSession):
    # Visible to admins, managers and the assigned employee (checked in the service).
    return task_service.get_task_for_user(db, task_id, user)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED, dependencies=[manage])
def create_task(data: TaskCreate, manager: CurrentEmployee, db: DbSession):
    """Create and assign a task. The manager needs an employee profile
    because the task records who assigned it."""
    return task_service.create_task(db, data, manager)


@router.put("/{task_id}", response_model=TaskOut, dependencies=[manage])
def update_task(task_id: int, data: TaskUpdate, db: DbSession):
    return task_service.update_task(db, task_id, data)


@router.put("/{task_id}/status", response_model=TaskOut)
def update_task_status(task_id: int, data: TaskStatusUpdate, user: CurrentUser, db: DbSession):
    """Assigned employee or manager updates progress."""
    return task_service.update_status(db, task_id, data.status, user)


