"""Login, tokens and role-based access."""
import jwt
import pytest

from app.core.config import settings
from tests.conftest import PASSWORD

API = "/api/v1"


def test_login_success_and_me(client):
    r = client.post(f"{API}/auth/login", json={"email": "Admin@Test.com", "password": PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "admin"
    assert "password" not in body["user"]

    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["email"] == "admin@test.com"


def test_login_wrong_password_and_unknown_email_look_identical(client):
    bad_pw = client.post(f"{API}/auth/login", json={"email": "admin@test.com", "password": "nope"})
    unknown = client.post(f"{API}/auth/login", json={"email": "ghost@test.com", "password": "nope"})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()


def test_login_is_locked_after_repeated_failures(client):
    for _ in range(settings.login_max_attempts):
        client.post(f"{API}/auth/login", json={"email": "admin@test.com", "password": "bad"})
    r = client.post(f"{API}/auth/login", json={"email": "admin@test.com", "password": PASSWORD})
    assert r.status_code == 429


def test_protected_routes_need_a_valid_token(client):
    assert client.get(f"{API}/users").status_code == 401
    assert client.get(f"{API}/users", headers={"Authorization": "Bearer garbage"}).status_code == 401
    # A token signed with the wrong key must be rejected.
    forged = jwt.encode({"sub": "1", "exp": 9999999999}, "wrong-key", algorithm="HS256")
    assert client.get(f"{API}/users", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_deactivated_user_token_stops_working(client, auth):
    me = client.get(f"{API}/auth/me", headers=auth("employee")).json()
    r = client.delete(f"{API}/users/{me['user_id']}", headers=auth("admin"))
    assert r.status_code == 204
    assert client.get(f"{API}/auth/me", headers=auth("employee")).status_code == 401


@pytest.mark.parametrize(
    "method,path,role,expected",
    [
        ("get", "/users", "manager", 403),
        ("get", "/users", "admin", 200),
        ("get", "/roles", "sales", 403),
        ("get", "/roles", "admin", 200),
        ("get", "/employees", "sales", 403),
        ("get", "/employees", "manager", 200),
        ("get", "/customers", "inventory", 403),
        ("get", "/customers", "sales", 200),
        ("get", "/inventory", "manager", 403),
        ("get", "/inventory", "sales", 200),
        ("get", "/inventory/low-stock", "sales", 403),
        ("get", "/inventory/low-stock", "inventory", 200),
        ("get", "/orders", "employee", 403),
        ("get", "/orders", "manager", 200),
        ("get", "/tasks", "employee", 403),
        ("get", "/tasks/overdue", "manager", 200),
        ("get", "/issues", "sales", 403),
        ("get", "/purchase-requests", "employee", 403),
        ("get", "/purchase-requests/pending-approval", "inventory", 403),
        ("get", "/purchase-requests/pending-approval", "manager", 200),
        ("get", "/dashboard/admin", "manager", 403),
        ("get", "/dashboard/admin", "admin", 200),
        ("get", "/dashboard/manager", "manager", 200),
        ("get", "/dashboard/sales", "sales", 200),
        ("get", "/dashboard/inventory", "inventory", 200),
        ("get", "/dashboard/inventory", "sales", 403),
    ],
)
def test_role_matrix(client, auth, method, path, role, expected):
    r = getattr(client, method)(f"{API}{path}", headers=auth(role))
    assert r.status_code == expected, r.text


def test_static_routes_are_not_swallowed_by_id_routes(client, auth):
    # If "/active" were registered after "/{product_id}" this would be a 422.
    assert client.get(f"{API}/products/active", headers=auth("sales")).status_code == 200
    assert client.get(f"{API}/tasks/my", headers=auth("employee")).status_code == 200
    assert client.get(f"{API}/issues/my", headers=auth("employee")).status_code == 200
    assert client.get(f"{API}/purchase-requests/my", headers=auth("inventory")).status_code == 200


def test_legacy_dashboard_summary_keeps_its_shape(client, auth):
    r = client.get(f"{API}/dashboard/summary", headers=auth("admin"))
    assert r.status_code == 200
    assert set(r.json()["metrics"]) == {
        "total_orders", "pending_approvals", "low_stock_products", "overdue_tasks",
    }
