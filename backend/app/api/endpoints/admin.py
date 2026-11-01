from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.security import require_role
from app.mock_data.users import USERS_BY_EMAIL

router = APIRouter()


@router.get("/users")
def list_users(
    admin: Annotated[dict, Depends(require_role("admin"))],
):
    return [
        {
            "user_id": user["user_id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "is_active": user["is_active"],
        }
        for user in USERS_BY_EMAIL.values()
    ]
