"""Shared schema pieces: pagination envelope, password rule, base config."""
import re
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for response models - lets Pydantic read straight from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    """Every list endpoint returns this same envelope."""

    items: list[T]
    total: int
    page: int
    page_size: int


class Message(BaseModel):
    detail: str


def validate_password_strength(value: str) -> str:
    """Basic password policy: 8-128 chars with at least one letter and digit."""
    if len(value) < 8 or len(value) > 128:
        raise ValueError("Password must be 8 to 128 characters long")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one digit")
    return value
