"""User account management - administrators only."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DbSession, Paging, require_roles
from app.core.constants import Perm
from app.models import User
from app.schemas.common import Page
from app.schemas.user import RoleChange, UserCreate, UserOut, UserUpdate
from app.services import user_service

router = APIRouter()
Admin = Annotated[User, Depends(require_roles(*Perm.ADMIN_ONLY))]


@router.get("", response_model=Page[UserOut])
def list_users(
    _: Admin, db: DbSession, params: Paging,
    role: str | None = None, is_active: bool | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
):
    return user_service.list_users(db, params, role, is_active, search)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, _: Admin, db: DbSession):
    return user_service.get_user(db, user_id)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, _: Admin, db: DbSession):
    return user_service.create_user(db, data)


@router.put("/{user_id}/role", response_model=UserOut)
def change_role(user_id: int, data: RoleChange, admin: Admin, db: DbSession):
    return user_service.change_role(db, user_id, data, admin)


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, admin: Admin, db: DbSession):
    return user_service.update_user(db, user_id, data, admin)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(user_id: int, admin: Admin, db: DbSession):
    """Soft delete: the account is deactivated, not removed."""
    user_service.deactivate_user(db, user_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
