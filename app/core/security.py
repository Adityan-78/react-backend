from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash

from app.core.config import settings
from app.mock_data.users import USERS_BY_EMAIL

password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": email, "exp": expires},
        settings.secret_key,
        algorithm="HS256",
    )


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=["HS256"],
        )
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = USERS_BY_EMAIL.get(email.lower())
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="User unavailable")
    return user


def require_role(*allowed_roles: str):
    def role_checker(
        user: Annotated[dict, Depends(get_current_user)]
    ) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action",
            )
        return user

    return role_checker
