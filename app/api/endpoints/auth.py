from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse
from app.core.security import create_access_token, get_current_user, password_hasher
from app.mock_data.users import USERS_BY_EMAIL

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest):
    user = USERS_BY_EMAIL.get(str(data.email).lower())
    if (
        not user
        or not password_hasher.verify(data.password, user["hashed_password"])
        or not user["is_active"]
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "access_token": create_access_token(user["email"]),
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
    }


@router.get("/me", response_model=UserResponse)
def me(user: Annotated[dict, Depends(get_current_user)]):
    return {
        "user_id": user["user_id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
    }
