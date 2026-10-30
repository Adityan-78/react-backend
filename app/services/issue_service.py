"""Operational issues raised by staff and tracked by managers."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import PageParams
from app.core.constants import ISSUE_TRANSITIONS, IssueStatus, Roles
from app.core.errors import conflict, forbidden, not_found
from app.models import Employee, OperationalIssue, User
from app.schemas.issue import IssueCreate, IssueUpdate
from app.services.common import paginate

_LOAD = (joinedload(OperationalIssue.reporter).joinedload(Employee.user),)


def get_issue(db: Session, issue_id: int) -> OperationalIssue:
    issue = db.scalar(
        select(OperationalIssue)
        .options(*_LOAD)
        .where(OperationalIssue.issue_id == issue_id)
        .execution_options(populate_existing=True)
    )
    if issue is None:
        raise not_found("Issue")
    return issue


def get_issue_for_user(db: Session, issue_id: int, user: User) -> OperationalIssue:
    """Admins/managers see everything; everyone else only issues they raised."""
    issue = get_issue(db, issue_id)
    is_staff = user.role.role_name in (Roles.ADMIN, Roles.MANAGER)
    is_reporter = user.employee is not None and user.employee.employee_id == issue.raised_by
    if not (is_staff or is_reporter):
        raise forbidden()
    return issue


def list_issues(
    db: Session, params: PageParams, status: str | None = None,
    raised_by: int | None = None,
) -> dict[str, Any]:
    stmt = select(OperationalIssue).options(*_LOAD).order_by(
        OperationalIssue.created_at.desc(), OperationalIssue.issue_id.desc()
    )
    if status:
        stmt = stmt.where(OperationalIssue.status == status)
    if raised_by is not None:
        stmt = stmt.where(OperationalIssue.raised_by == raised_by)
    return paginate(db, stmt, params)


def create_issue(db: Session, data: IssueCreate, reporter: Employee) -> OperationalIssue:
    issue = OperationalIssue(
        raised_by=reporter.employee_id,
        title=data.title.strip(),
        description=data.description,
        status=IssueStatus.OPEN,
    )
    db.add(issue)
    db.commit()
    return get_issue(db, issue.issue_id)


def update_issue(db: Session, issue_id: int, data: IssueUpdate) -> OperationalIssue:
    issue = get_issue(db, issue_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field == "title":
            continue  # title is required
        setattr(issue, field, value)
    db.commit()
    return get_issue(db, issue_id)


def update_status(db: Session, issue_id: int, new_status: str) -> OperationalIssue:
    issue = get_issue(db, issue_id)
    if issue.status == new_status:
        return issue
    if new_status not in ISSUE_TRANSITIONS.get(issue.status, set()):
        raise conflict(f"An issue cannot move from {issue.status} to {new_status}")
    issue.status = new_status
    db.commit()
    return get_issue(db, issue_id)
