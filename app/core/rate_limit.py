"""A tiny in-memory login throttle.

After too many failed attempts for the same email + IP the account is locked
for a while. It lives in process memory, which is fine for a single server;
if you later run several workers, move this into Redis or the database.
"""
import threading
import time

from fastapi import HTTPException, status

from app.core.config import settings


class LoginThrottle:
    def __init__(self) -> None:
        self._failures: dict[str, tuple[int, float]] = {}  # key -> (count, locked_until)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        """Raise 429 if this key is currently locked out."""
        with self._lock:
            count, locked_until = self._failures.get(key, (0, 0.0))
            if locked_until and time.monotonic() < locked_until:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many failed login attempts. Please try again later.",
                )
            if locked_until and time.monotonic() >= locked_until:
                # Lockout expired - start counting from zero again.
                self._failures.pop(key, None)

    def register_failure(self, key: str) -> None:
        with self._lock:
            count, _ = self._failures.get(key, (0, 0.0))
            count += 1
            locked_until = 0.0
            if count >= settings.login_max_attempts:
                locked_until = time.monotonic() + settings.login_lockout_minutes * 60
            self._failures[key] = (count, locked_until)

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def reset_all(self) -> None:  # used by the test-suite
        with self._lock:
            self._failures.clear()


login_throttle = LoginThrottle()
