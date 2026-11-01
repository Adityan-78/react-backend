from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_access_token_round_trip():
    token = create_access_token(42)
    assert decode_access_token(token) == 42


def test_invalid_and_expired_tokens_are_rejected():
    for token in (
        "not-a-jwt",
        jwt.encode(
            {"sub": "42", "iat": datetime.now(timezone.utc) - timedelta(hours=2),
             "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
            settings.secret_key,
            algorithm="HS256",
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            decode_access_token(token)
        assert exc.value.status_code == 401


def test_password_hash_is_not_plaintext_and_verifies():
    hashed = hash_password("UnitTest123")
    assert hashed != "UnitTest123"
    assert verify_password("UnitTest123", hashed)
    assert not verify_password("wrong", hashed)
