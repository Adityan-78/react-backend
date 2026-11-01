"""Reusable FastAPI dependencies: DB session, current user, role checks, paging.

Flow for a protected endpoint:
    JWT in header -> user loaded from DB -> role checked -> endpoint runs.
The role is always read from the database, so removing someone's access
takes effect immediately instead of when their token expires.
"""
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app.core.errors import forbidden, unauthorized
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Employee, User

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> User:
    if credentials is None:
        raise unauthorized()

    user_id = decode_access_token(credentials.credentials)
    user = db.get(
        User,
        user_id,
        options=[joinedload(User.role), joinedload(User.employee)],
    )
    # Same message for "missing" and "deactivated" so we don't leak which it is.
    if user is None or not user.is_active:
        raise unauthorized("User unavailable")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*allowed_roles: str):
    """Build a dependency that only lets the listed roles through (403 otherwise)."""

    def checker(user: CurrentUser) -> User:
        if user.role.role_name not in allowed_roles:
            raise forbidden()
        return user

    return checker


def get_current_employee(user: CurrentUser) -> Employee:
    """For endpoints that act 'as an employee' (own tasks, raising issues...).
    The logged-in user must have an active employee profile."""
    employee = user.employee
    if employee is None or not employee.is_active:
        raise forbidden("No active employee profile is linked to this account")
    return employee


CurrentEmployee = Annotated[Employee, Depends(get_current_employee)]


@dataclass
class PageParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageParams:
    # The cap of 100 stops a client from asking for the whole table at once.
    return PageParams(page=page, page_size=page_size)


Paging = Annotated[PageParams, Depends(page_params)]
