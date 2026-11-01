"""User accounts and role assignment (admin only)."""
from typing import Any

from sqlalchemy import func, select, true
from sqlalchemy.orm import Session, joinedload

from app.api.deps import PageParams
from app.core.constants import Roles
from app.core.errors import bad_request, conflict, not_found
from app.core.security import hash_password
from app.models import Role, User
from app.schemas.user import RoleChange, UserCreate, UserUpdate
from app.services.common import like, paginate


def list_roles(db: Session) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.role_id)))


def _get_role(db: Session, role_id: int) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise bad_request("Unknown role_id")
    return role


def get_user(db: Session, user_id: int) -> User:
    user = db.scalar(
        select(User)
        .options(joinedload(User.role))
        .where(User.user_id == user_id)
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise not_found("User")
    return user


def list_users(
    db: Session, params: PageParams, role: str | None, is_active: bool | None,
    search: str | None,
) -> dict[str, Any]:
    stmt = select(User).options(joinedload(User.role)).join(Role).order_by(User.user_id)
    if role:
        stmt = stmt.where(Role.role_name == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if search:
        stmt = stmt.where(like(User.name, search) | like(User.email, search))
    return paginate(db, stmt, params)


def _email_taken(db: Session, email: str, exclude_user_id: int | None = None) -> bool:
    stmt = select(User.user_id).where(User.email == email)
    if exclude_user_id is not None:
        stmt = stmt.where(User.user_id != exclude_user_id)
    return db.scalar(stmt) is not None


def _ensure_another_active_admin(db: Session, user: User) -> None:
    """Never let the system end up with no active administrator."""
    if user.role.role_name != Roles.ADMIN:
        return
    others = db.scalar(
        select(func.count())
        .select_from(User)
        .join(Role)
        .where(
            Role.role_name == Roles.ADMIN,
            User.is_active == true(),
            User.user_id != user.user_id,
        )
    )
    if not others:
        raise bad_request("There must be at least one active administrator")


def create_user(db: Session, data: UserCreate) -> User:
    _get_role(db, data.role_id)
    email = data.email.lower()
    if _email_taken(db, email):
        raise conflict("A user with this email already exists")

    user = User(
        role_id=data.role_id,
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    return get_user(db, user.user_id)


def update_user(db: Session, user_id: int, data: UserUpdate, actor: User) -> User:
    user = get_user(db, user_id)
    changes = data.model_dump(exclude_unset=True)

    if "email" in changes and changes["email"] is not None:
        email = changes["email"].lower()
        if _email_taken(db, email, exclude_user_id=user.user_id):
            raise conflict("A user with this email already exists")
        user.email = email
    if changes.get("name"):
        user.name = changes["name"].strip()
    if changes.get("password"):
        user.password_hash = hash_password(changes["password"])
    if changes.get("is_active") is not None:
        if changes["is_active"] is False:
            _guard_deactivation(db, user, actor)
        user.is_active = changes["is_active"]

    db.commit()
    return get_user(db, user.user_id)


def _guard_deactivation(db: Session, user: User, actor: User) -> None:
    if user.user_id == actor.user_id:
        raise bad_request("You cannot deactivate your own account")
    _ensure_another_active_admin(db, user)


def deactivate_user(db: Session, user_id: int, actor: User) -> None:
    """DELETE /users/{id} is a soft delete: the row stays for audit/FK reasons."""
    user = get_user(db, user_id)
    _guard_deactivation(db, user, actor)
    user.is_active = False
    db.commit()


def change_role(db: Session, user_id: int, data: RoleChange, actor: User) -> User:
    user = get_user(db, user_id)
    new_role = _get_role(db, data.role_id)

    if user.user_id == actor.user_id:
        raise bad_request("You cannot change your own role")
    if new_role.role_name != Roles.ADMIN:
        _ensure_another_active_admin(db, user)

    user.role_id = new_role.role_id
    db.commit()
    return get_user(db, user.user_id)
