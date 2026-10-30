"""Purchase request workflow and dashboards."""
from app.core.config import settings

API = "/api/v1"


def _pr(client, auth, items=(), role="inventory"):
    return client.post(
        f"{API}/purchase-requests", headers=auth(role),
        json={"items": [{"product_id": p, "quantity": q, "estimated_price": "5.00"} for p, q in items]},
    )


def test_full_approval_and_stock_receipt_flow(client, auth, make_product):
    pid = make_product(stock=2, reorder=10)
    pr = _pr(client, auth, [(pid, 20)])
    assert pr.status_code == 201
    pr = pr.json()
    assert pr["status"] == "Submitted" and pr["approval_status"] == "Pending"
    assert float(pr["total_estimated"]) == 100.0
    base = f"{API}/purchase-requests/{pr['pr_id']}"

    pending = client.get(f"{API}/purchase-requests/pending-approval", headers=auth("manager")).json()
    assert pending["total"] == 1

    # fulfilment can't start before approval
    assert client.put(f"{base}/status", headers=auth("manager"), json={"status": "Completed"}).status_code == 409

    approved = client.put(f"{base}/approve", headers=auth("manager"))
    assert approved.status_code == 200
    body = approved.json()
    assert body["approval_status"] == "Approved" and body["status"] == "In Progress"
    assert body["items"][0]["status"] == "Approved" and body["items"][0]["approval_id"] is not None
    assert body["items"][0]["approved_date"] is not None

    # decided requests are locked
    assert client.put(f"{base}/approve", headers=auth("manager")).status_code == 409
    assert client.post(f"{base}/items", headers=auth("inventory"),
                       json={"product_id": pid, "quantity": 1}).status_code == 409

    done = client.put(f"{base}/status", headers=auth("inventory"),
                      json={"status": "Completed", "receive_stock": True})
    assert done.status_code == 200 and done.json()["status"] == "Completed"
    assert client.get(f"{API}/inventory/{pid}", headers=auth("inventory")).json()["quantity_in_stock"] == 22
    assert client.put(f"{base}/status", headers=auth("manager"), json={"status": "Closed"}).status_code == 200


def test_reject_records_reason(client, auth, make_product):
    pid = make_product()
    pr = _pr(client, auth, [(pid, 5)]).json()
    base = f"{API}/purchase-requests/{pr['pr_id']}"
    assert client.put(f"{base}/reject", headers=auth("manager"), json={}).status_code == 422  # reason required
    r = client.put(f"{base}/reject", headers=auth("manager"), json={"reason": "Over budget"})
    assert r.status_code == 200
    assert r.json()["approval_status"] == "Rejected" and r.json()["rejection_reason"] == "Over budget"
    assert r.json()["status"] == "Closed"


def test_only_managers_decide(client, auth, make_product):
    pr = _pr(client, auth, [(make_product(), 1)]).json()
    base = f"{API}/purchase-requests/{pr['pr_id']}"
    for role in ("inventory", "employee", "sales", "admin"):
        assert client.put(f"{base}/approve", headers=auth(role)).status_code == 403


def test_empty_request_cannot_be_approved(client, auth):
    pr = _pr(client, auth).json()
    assert client.put(f"{API}/purchase-requests/{pr['pr_id']}/approve", headers=auth("manager")).status_code == 409


def test_item_management_before_approval(client, auth, make_product):
    p1, p2 = make_product("A"), make_product("B")
    pr = _pr(client, auth, [(p1, 5)]).json()
    base = f"{API}/purchase-requests/{pr['pr_id']}"

    added = client.post(f"{base}/items", headers=auth("inventory"), json={"product_id": p2, "quantity": 3})
    assert added.status_code == 201 and len(added.json()["items"]) == 2
    # same product twice -> conflict
    assert client.post(f"{base}/items", headers=auth("inventory"),
                       json={"product_id": p2, "quantity": 1}).status_code == 409

    items = client.get(f"{base}/items", headers=auth("inventory")).json()
    item_id = next(i["pr_item_id"] for i in items if i["product_id"] == p2)
    upd = client.put(f"{API}/purchase-request-items/{item_id}", headers=auth("inventory"), json={"quantity": 9})
    assert upd.status_code == 200
    assert next(i for i in upd.json()["items"] if i["pr_item_id"] == item_id)["quantity"] == 9

    gone = client.delete(f"{API}/purchase-request-items/{item_id}", headers=auth("inventory"))
    assert gone.status_code == 200 and len(gone.json()["items"]) == 1
    assert client.put(f"{API}/purchase-request-items/{item_id}", headers=auth("inventory"),
                      json={"quantity": 2}).status_code == 404
    assert client.post(f"{base}/items", headers=auth("sales"),
                       json={"product_id": p2, "quantity": 1}).status_code == 403


def test_request_visibility_and_replace_items(client, auth, make_product):
    p1, p2 = make_product("A"), make_product("B")
    pr = _pr(client, auth, [(p1, 5)]).json()
    url = f"{API}/purchase-requests/{pr['pr_id']}"
    assert client.get(url, headers=auth("inventory")).status_code == 200   # requester
    assert client.get(url, headers=auth("manager")).status_code == 200
    assert client.get(url, headers=auth("employee")).status_code == 403     # unrelated
    assert client.get(f"{url}/items", headers=auth("employee")).status_code == 403

    r = client.put(url, headers=auth("inventory"),
                   json={"items": [{"product_id": p2, "quantity": 7}]})
    assert r.status_code == 200 and [i["product_id"] for i in r.json()["items"]] == [p2]
    assert client.get(f"{API}/purchase-requests/my", headers=auth("inventory")).json()["total"] == 1


def test_employees_can_raise_requests_only_when_enabled(client, auth, make_product, monkeypatch):
    pid = make_product()
    assert _pr(client, auth, [(pid, 1)], role="employee").status_code == 403
    monkeypatch.setattr(settings, "employee_purchase_requests_enabled", True)
    assert _pr(client, auth, [(pid, 1)], role="employee").status_code == 201
    assert client.get(f"{API}/purchase-requests/my", headers=auth("employee")).json()["total"] == 1


def test_inactive_product_cannot_be_requested(client, auth, make_product):
    pid = make_product()
    client.delete(f"{API}/products/{pid}", headers=auth("inventory"))
    assert _pr(client, auth, [(pid, 1)]).status_code == 400


# ------------------------------------------------------------------------ dashboards
def test_dashboards_reflect_data(client, auth, make_product, make_customer):
    low = make_product("Low", stock=1, reorder=5)
    cust = make_customer()
    client.post(f"{API}/orders", headers=auth("sales"), json={
        "customer_id": cust, "items": [{"product_id": low, "quantity": 1, "unit_price": "20.00"}]})
    _pr(client, auth, [(low, 10)])

    admin = client.get(f"{API}/dashboard/admin", headers=auth("admin")).json()
    assert admin["users"]["total"] == 5 and admin["orders"]["total"] == 1
    assert float(admin["orders"]["revenue"]) == 20.0
    assert admin["stock"]["low_stock_count"] == 1 and admin["stock"]["low_stock_items"][0]["product_name"] == "Low"
    assert admin["purchase_requests"]["pending_approval"] == 1

    sales = client.get(f"{API}/dashboard/sales", headers=auth("sales")).json()
    assert sales["customers"]["total"] == 1 and sales["recent_orders"][0]["customer_name"] == "Acme Ltd"

    mgr = client.get(f"{API}/dashboard/manager", headers=auth("manager")).json()
    assert mgr["purchase_requests"]["pending_approval"] == 1 and mgr["tasks"]["total"] == 0

    inv = client.get(f"{API}/dashboard/inventory", headers=auth("inventory")).json()
    assert inv["stock"]["total_products"] == 1

    summary = client.get(f"{API}/dashboard/summary", headers=auth("manager")).json()
    assert summary["metrics"]["total_orders"] == 1 and summary["metrics"]["pending_approvals"] == 1
    assert summary["metrics"]["low_stock_products"] == 1
