from fastapi import APIRouter, Request

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse
from app.services import auth_service

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, db: DbSession):
    """Check credentials and return a short-lived access token."""
    client_ip = request.client.host if request.client else "unknown"
    return auth_service.login(db, data.email, data.password, client_ip)


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser):
    """Who am I? Returns the logged-in user's profile and role."""
    return user
