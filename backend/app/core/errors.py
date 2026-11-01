"""Small helpers that build consistent HTTP errors.

Services raise these so the endpoint layer stays free of error handling.
"""
from fastapi import HTTPException, status


def not_found(what: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


def bad_request(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, message)


def conflict(message: str) -> HTTPException:
    # 409 = the request is valid but clashes with the current state of the data.
    return HTTPException(status.HTTP_409_CONFLICT, message)


def forbidden(message: str = "You do not have permission to perform this action") -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, message)


def unauthorized(message: str = "Authentication required") -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        message,
        headers={"WWW-Authenticate": "Bearer"},
    )
