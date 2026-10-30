"""User, role and employee management."""
from tests.conftest import PASSWORD

API = "/api/v1"


def _role_id(client, auth, name):
    roles = client.get(f"{API}/roles", headers=auth("admin")).json()
    return next(r["role_id"] for r in roles if r["role_name"] == name)


def test_create_user_hashes_password_and_can_log_in(client, auth):
    r = client.post(
        f"{API}/users", headers=auth("admin"),
        json={"name": "New Sales", "email": "NewSales@Test.com", "password": "Sup3rSecret",
              "role_id": _role_id(client, auth, "sales")},
    )
    assert r.status_code == 201
    assert r.json()["email"] == "newsales@test.com"
    assert "password" not in r.json()
    login = client.post(f"{API}/auth/login", json={"email": "newsales@test.com", "password": "Sup3rSecret"})
    assert login.status_code == 200


def test_create_user_validation(client, auth):
    rid = _role_id(client, auth, "sales")
    weak = client.post(f"{API}/users", headers=auth("admin"),
                       json={"name": "x", "email": "x@test.com", "password": "short", "role_id": rid})
    assert weak.status_code == 422
    dup = client.post(f"{API}/users", headers=auth("admin"),
                      json={"name": "x", "email": "sales@test.com", "password": PASSWORD, "role_id": rid})
    assert dup.status_code == 409
    bad_role = client.post(f"{API}/users", headers=auth("admin"),
                           json={"name": "x", "email": "y@test.com", "password": PASSWORD, "role_id": 999})
    assert bad_role.status_code == 400


def test_admin_cannot_lock_themselves_out(client, auth):
    me = client.get(f"{API}/auth/me", headers=auth("admin")).json()
    assert client.delete(f"{API}/users/{me['user_id']}", headers=auth("admin")).status_code == 400
    r = client.put(f"{API}/users/{me['user_id']}/role", headers=auth("admin"),
                   json={"role_id": _role_id(client, auth, "employee")})
    assert r.status_code == 400


def test_change_role(client, auth):
    sales = client.get(f"{API}/users", headers=auth("admin"), params={"role": "sales"}).json()["items"][0]
    r = client.put(f"{API}/users/{sales['user_id']}/role", headers=auth("admin"),
                   json={"role_id": _role_id(client, auth, "manager")})
    assert r.status_code == 200 and r.json()["role"] == "manager"


def test_list_users_is_paginated(client, auth):
    r = client.get(f"{API}/users", headers=auth("admin"), params={"page": 1, "page_size": 2})
    body = r.json()
    assert body["total"] == 5 and len(body["items"]) == 2 and body["page_size"] == 2
    assert client.get(f"{API}/users", headers=auth("admin"), params={"page_size": 500}).status_code == 422


def test_employee_profile_rules(client, auth):
    new_user = client.post(
        f"{API}/users", headers=auth("admin"),
        json={"name": "Temp", "email": "temp@test.com", "password": PASSWORD,
              "role_id": _role_id(client, auth, "employee")},
    ).json()
    created = client.post(f"{API}/employees", headers=auth("admin"),
                          json={"user_id": new_user["user_id"], "designation": "Clerk", "department": "Ops"})
    assert created.status_code == 201 and created.json()["name"] == "Temp"
    # one profile per user
    again = client.post(f"{API}/employees", headers=auth("admin"), json={"user_id": new_user["user_id"]})
    assert again.status_code == 409
    # managers can read but not write
    assert client.get(f"{API}/employees/{created.json()['employee_id']}", headers=auth("manager")).status_code == 200
    assert client.post(f"{API}/employees", headers=auth("manager"),
                       json={"user_id": new_user["user_id"]}).status_code == 403
    # soft delete
    eid = created.json()["employee_id"]
    assert client.delete(f"{API}/employees/{eid}", headers=auth("admin")).status_code == 204
    assert client.get(f"{API}/employees/{eid}", headers=auth("admin")).json()["is_active"] is False
