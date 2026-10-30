"""Test setup: an in-memory SQLite database, five roles and one user per role.

No SQL Server is needed to run the tests. SQLite is used purely as a stand-in,
and the app's get_db dependency is swapped to point at it.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.constants import Roles
from app.core.rate_limit import login_throttle
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Employee, Role, User

PASSWORD = "Passw0rd!"
# argon2 is deliberately slow, so hash once and reuse for every test user.
PASSWORD_HASH = hash_password(PASSWORD)


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with factory() as db:
        for name in Roles.ALL:
            db.add(Role(role_name=name, description=name))
        db.flush()
        roles = {r.role_name: r.role_id for r in db.query(Role)}
        for name in Roles.ALL:
            user = User(
                role_id=roles[name], name=f"Test {name}", email=f"{name}@test.com",
                password_hash=PASSWORD_HASH,
            )
            db.add(user)
            db.flush()
            db.add(Employee(user_id=user.user_id, designation=name, department="Ops"))
        db.commit()
    yield factory
    engine.dispose()


@pytest.fixture()
def client(session_factory):
    def override_get_db():
        db = session_factory()
        try:
            yield db
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    login_throttle.reset_all()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth(client):
    """auth('sales') -> headers for that role's test user (tokens are cached)."""
    cache: dict[str, dict] = {}

    def _auth(role: str) -> dict:
        if role not in cache:
            r = client.post(
                "/api/v1/auth/login", json={"email": f"{role}@test.com", "password": PASSWORD}
            )
            assert r.status_code == 200, r.text
            cache[role] = {"Authorization": f"Bearer {r.json()['access_token']}"}
        return cache[role]

    return _auth


# ---- small helpers the tests share -------------------------------------------
@pytest.fixture()
def make_product(client, auth):
    def _make(name="Widget", stock=10, reorder=5):
        r = client.post(
            "/api/v1/products", headers=auth("inventory"),
            json={"name": name, "unit_measure": "pcs", "initial_stock": stock, "reorder_level": reorder},
        )
        assert r.status_code == 201, r.text
        return r.json()["product_id"]

    return _make


@pytest.fixture()
def make_customer(client, auth):
    def _make(name="Acme Ltd"):
        r = client.post("/api/v1/customers", headers=auth("sales"), json={"name": name})
        assert r.status_code == 201, r.text
        return r.json()["customer_id"]

    return _make


@pytest.fixture()
def employee_id(client, auth):
    """employee_id of a given test role."""

    def _get(role: str) -> int:
        r = client.get("/api/v1/employees", headers=auth("admin"), params={"search": f"Test {role}"})
        return r.json()["items"][0]["employee_id"]

    return _get
