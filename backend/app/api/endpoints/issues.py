from fastapi import APIRouter, Depends, status

from app.api.deps import CurrentEmployee, CurrentUser, DbSession, Paging, require_roles
from app.core.constants import Perm
from app.schemas.common import Page
from app.schemas.issue import IssueCreate, IssueOut, IssueStatusUpdate, IssueUpdate
from app.services import issue_service

router = APIRouter()

list_view = Depends(require_roles(*Perm.ISSUE_LIST))
any_staff = Depends(require_roles(*Perm.ANY_ROLE))


@router.get("", response_model=Page[IssueOut], dependencies=[list_view])
def list_issues(db: DbSession, params: Paging, status: str | None = None):
    return issue_service.list_issues(db, params, status=status)


# Static path before "/{issue_id}".
@router.get("/my", response_model=Page[IssueOut], dependencies=[any_staff])
def my_issues(employee: CurrentEmployee, db: DbSession, params: Paging):
    """Issues I have raised."""
    return issue_service.list_issues(db, params, raised_by=employee.employee_id)


@router.get("/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: int, user: CurrentUser, db: DbSession):
    # Admin, manager or the person who raised it (checked in the service).
    return issue_service.get_issue_for_user(db, issue_id, user)


@router.post("", response_model=IssueOut, status_code=status.HTTP_201_CREATED, dependencies=[any_staff])
def create_issue(data: IssueCreate, employee: CurrentEmployee, db: DbSession):
    """Raise a new operational issue."""
    return issue_service.create_issue(db, data, employee)


@router.put("/{issue_id}", response_model=IssueOut, dependencies=[list_view])
def update_issue(issue_id: int, data: IssueUpdate, db: DbSession):
    return issue_service.update_issue(db, issue_id, data)


@router.put("/{issue_id}/status", response_model=IssueOut, dependencies=[list_view])
def update_issue_status(issue_id: int, data: IssueStatusUpdate, db: DbSession):
    return issue_service.update_status(db, issue_id, data.status)
