"""Password hashing and JWT helpers.

This module knows nothing about the database or FastAPI dependencies; the
"who is the current user" logic lives in app/api/deps.py.
"""
from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import settings
from app.core.errors import unauthorized

_ALGORITHM = "HS256"

# Argon2 by default - slow on purpose so stolen hashes are hard to crack.
password_hasher = PasswordHash.recommended()

# A throw-away hash used when the email doesn't exist. Verifying against it
# makes "unknown email" take as long as "wrong password", so response timing
# can't be used to discover which emails are registered.
DUMMY_HASH = password_hasher.hash("not-a-real-password")


def hash_password(plain: str) -> str:
    return password_hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return password_hasher.verify(plain, hashed)
    except Exception:  # malformed hash in the DB should mean "no", not a 500
        return False


def create_access_token(user_id: int) -> str:
    """Create a signed JWT. Only the user id is stored - JWTs are signed, not
    encrypted, so nothing sensitive (and no role) goes in the payload. The role
    is always read fresh from the database on each request."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> int:
    """Return the user id from a valid token, or raise a 401."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        return int(payload["sub"])
    except (InvalidTokenError, ValueError, KeyError):
        raise unauthorized("Invalid or expired token")
