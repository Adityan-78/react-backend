"""Task assignment, progress updates and overdue tracking.

"Overdue" is never written into the status column. A task counts as overdue
when its due date has passed and it isn't Completed - worked out live, so the
answer is always right without a nightly job.
"""
from typing import Any

from sqlalchemy import case, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import PageParams
from app.core.constants import (
    TASK_REOPEN_ONLY_MANAGER, TASK_TRANSITIONS, Roles, TaskStatus,
)
from app.core.errors import bad_request, conflict, forbidden, not_found
from app.models import CustomerTask, Employee, User
from app.models._helpers import today
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.common import paginate

_LOAD = (
    joinedload(CustomerTask.assignee).joinedload(Employee.user),
    joinedload(CustomerTask.assigner).joinedload(Employee.user),
)


def _overdue_condition():
    return (CustomerTask.due_date < today()) & (CustomerTask.status != TaskStatus.COMPLETED)


def get_task(db: Session, task_id: int) -> CustomerTask:
    task = db.scalar(
        select(CustomerTask)
        .options(*_LOAD)
        .where(CustomerTask.task_id == task_id)
        .execution_options(populate_existing=True)
    )
    if task is None:
        raise not_found("Task")
    return task


def get_task_for_user(db: Session, task_id: int, user: User) -> CustomerTask:
    """A single task may be viewed by admins, managers and the assigned employee."""
    task = get_task(db, task_id)
    is_staff = user.role.role_name in (Roles.ADMIN, Roles.MANAGER)
    is_assignee = user.employee is not None and user.employee.employee_id == task.assigned_to
    if not (is_staff or is_assignee):
        raise forbidden()
    return task


def list_tasks(
    db: Session, params: PageParams, assigned_to: int | None = None,
    status: str | None = None, priority: str | None = None,
    overdue_only: bool = False,
) -> dict[str, Any]:
    stmt = select(CustomerTask).options(*_LOAD).order_by(
        case((CustomerTask.due_date.is_(None), 1), else_=0),  # undated tasks last (T-SQL-safe)
        CustomerTask.due_date, CustomerTask.task_id
    )
    if assigned_to is not None:
        stmt = stmt.where(CustomerTask.assigned_to == assigned_to)
    if priority:
        stmt = stmt.where(CustomerTask.priority == priority)
    if overdue_only or status == TaskStatus.OVERDUE:
        stmt = stmt.where(_overdue_condition())
    elif status:
        stmt = stmt.where(CustomerTask.status == status)
    return paginate(db, stmt, params)


def _active_employee(db: Session, employee_id: int) -> Employee:
    emp = db.get(Employee, employee_id)
    if emp is None or not emp.is_active:
        raise bad_request("Assignee must be an existing, active employee")
    return emp


def create_task(db: Session, data: TaskCreate, manager: Employee) -> CustomerTask:
    _active_employee(db, data.assigned_to)
    if data.due_date and data.due_date < today():
        raise bad_request("Due date cannot be in the past")

    task = CustomerTask(
        assigned_to=data.assigned_to,
        assigned_by=manager.employee_id,
        title=data.title.strip(),
        description=data.description,
        priority=data.priority,
        due_date=data.due_date,
        status=TaskStatus.PENDING,
    )
    db.add(task)
    db.commit()
    return get_task(db, task.task_id)


def update_task(db: Session, task_id: int, data: TaskUpdate) -> CustomerTask:
    task = get_task(db, task_id)
    changes = data.model_dump(exclude_unset=True)

    if changes.get("assigned_to") is not None:
        _active_employee(db, changes["assigned_to"])
    if changes.get("due_date") and changes["due_date"] < today():
        raise bad_request("Due date cannot be in the past")

    for field, value in changes.items():
        # title/priority/assigned_to are NOT NULL - ignore an explicit null.
        if value is None and field in ("title", "priority", "assigned_to"):
            continue
        setattr(task, field, value)
    db.commit()
    return get_task(db, task_id)


def update_status(db: Session, task_id: int, new_status: str, user: User) -> CustomerTask:
    task = get_task(db, task_id)
    is_manager = user.role.role_name == Roles.MANAGER
    is_assignee = user.employee is not None and user.employee.employee_id == task.assigned_to
    if not (is_manager or is_assignee):
        raise forbidden()

    # A row stored as "Overdue" (e.g. imported data) behaves like In Progress.
    current = TaskStatus.IN_PROGRESS if task.status == TaskStatus.OVERDUE else task.status
    if current == new_status:
        return task
    if new_status not in TASK_TRANSITIONS.get(current, set()):
        raise conflict(f"A task cannot move from {task.status} to {new_status}")
    if (current, new_status) in TASK_REOPEN_ONLY_MANAGER and not is_manager:
        raise forbidden("Only a manager can re-open a completed task")

    task.status = new_status
    db.commit()
    return get_task(db, task_id)
