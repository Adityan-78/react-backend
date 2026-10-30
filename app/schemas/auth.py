from pydantic import EmailStr, Field

from app.schemas.common import ORMModel
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: EmailStr
    # No strength rule here - login must accept whatever was set earlier.
    password: str = Field(min_length=1, max_length=128)


class UserResponse(ORMModel):
    user_id: int
    name: str
    email: EmailStr
    # Read from User.role_name but still returned to the frontend as "role".
    role: str = Field(validation_alias="role_name")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
