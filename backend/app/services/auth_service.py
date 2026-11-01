"""Login logic."""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import unauthorized
from app.core.rate_limit import login_throttle
from app.core.security import DUMMY_HASH, create_access_token, verify_password
from app.models import User


def login(db: Session, email: str, password: str, client_ip: str) -> dict:
    email = email.strip().lower()
    throttle_key = f"{email}|{client_ip}"

    login_throttle.check(throttle_key)

    user = db.scalar(
        select(User)
        .options(joinedload(User.role))
        .where(User.email == email)
    )

    # Always run one password check, even for unknown emails.
    password_ok = verify_password(
        password,
        user.password if user else DUMMY_HASH
    )

    # Generic error for all authentication failures.
    if user is None or not password_ok or not user.is_active:
        login_throttle.register_failure(throttle_key)
        raise unauthorized("Invalid email or password")

    login_throttle.reset(throttle_key)

    return {
    "access_token": create_access_token(user.user_id),
    "token_type": "bearer",
    "user": {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role_name": user.role.role_name,
    },
}