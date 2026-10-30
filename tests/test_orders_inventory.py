"""Products, inventory and the sales-order stock rules."""
API = "/api/v1"


def _stock(client, auth, pid):
    return client.get(f"{API}/inventory/{pid}", headers=auth("inventory")).json()["quantity_in_stock"]


def _order(client, auth, customer_id, lines):
    return client.post(
        f"{API}/orders", headers=auth("sales"),
        json={"customer_id": customer_id,
              "items": [{"product_id": p, "quantity": q, "unit_price": "12.50"} for p, q in lines]},
    )


def test_product_creation_creates_inventory_row_and_soft_delete(client, auth, make_product):
    pid = make_product(stock=7, reorder=3)
    inv = client.get(f"{API}/inventory/{pid}", headers=auth("sales")).json()
    assert inv["quantity_in_stock"] == 7 and inv["reorder_level"] == 3 and inv["is_low_stock"] is False

    assert client.delete(f"{API}/products/{pid}", headers=auth("inventory")).status_code == 204
    ids = [p["product_id"] for p in client.get(f"{API}/products/active", headers=auth("sales")).json()["items"]]
    assert pid not in ids
    # an inactive product can't be sold
    avail = client.get(f"{API}/products/{pid}/availability", headers=auth("sales")).json()
    assert avail["is_available"] is False


def test_stock_add_reduce_and_never_negative(client, auth, make_product):
    pid = make_product(stock=5)
    assert client.post(f"{API}/inventory/{pid}/add", headers=auth("inventory"), json={"quantity": 10}).json()["quantity_in_stock"] == 15
    assert client.post(f"{API}/inventory/{pid}/reduce", headers=auth("inventory"), json={"quantity": 15}).json()["quantity_in_stock"] == 0
    too_much = client.post(f"{API}/inventory/{pid}/reduce", headers=auth("inventory"), json={"quantity": 1})
    assert too_much.status_code == 409
    assert _stock(client, auth, pid) == 0
    # only inventory executives may move stock
    assert client.post(f"{API}/inventory/{pid}/add", headers=auth("sales"), json={"quantity": 1}).status_code == 403
    assert client.post(f"{API}/inventory/{pid}/add", headers=auth("inventory"), json={"quantity": 0}).status_code == 422


def test_low_stock_list(client, auth, make_product):
    low = make_product("Low item", stock=2, reorder=5)
    make_product("Fine item", stock=50, reorder=5)
    items = client.get(f"{API}/inventory/low-stock", headers=auth("inventory")).json()["items"]
    assert [i["product_id"] for i in items] == [low]


def test_availability_check(client, auth, make_product):
    pid = make_product(stock=4)
    ok = client.get(f"{API}/products/{pid}/availability", headers=auth("sales"), params={"quantity": 4}).json()
    no = client.get(f"{API}/products/{pid}/availability", headers=auth("sales"), params={"quantity": 5}).json()
    assert ok["is_available"] is True and no["is_available"] is False and no["available"] == 4


def test_order_total_is_computed_by_the_server(client, auth, make_product, make_customer):
    p1, p2, cust = make_product("A", 10), make_product("B", 10), make_customer()
    r = _order(client, auth, cust, [(p1, 2), (p2, 4)])
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "Pending" and float(body["total_amount"]) == 75.0  # 6 * 12.50
    assert len(body["items"]) == 2 and body["customer_name"] == "Acme Ltd"
    # creating the order does NOT touch stock yet
    assert _stock(client, auth, p1) == 10


def test_order_validation(client, auth, make_product, make_customer):
    pid, cust = make_product(stock=3), make_customer()
    assert _order(client, auth, cust, [(pid, 4)]).status_code == 409          # not enough stock
    assert _order(client, auth, 999, [(pid, 1)]).status_code == 400           # unknown customer
    assert _order(client, auth, cust, [(999, 1)]).status_code == 400          # unknown product
    dup = client.post(f"{API}/orders", headers=auth("sales"), json={
        "customer_id": cust,
        "items": [{"product_id": pid, "quantity": 1, "unit_price": "1"},
                  {"product_id": pid, "quantity": 1, "unit_price": "1"}]})
    assert dup.status_code == 422
    assert client.post(f"{API}/orders", headers=auth("manager"), json={}).status_code == 403


def test_confirm_deducts_stock_and_cancel_restores_it(client, auth, make_product, make_customer):
    pid, cust = make_product(stock=10), make_customer()
    oid = _order(client, auth, cust, [(pid, 4)]).json()["order_id"]

    r = client.put(f"{API}/orders/{oid}/status", headers=auth("sales"), json={"status": "Confirmed"})
    assert r.status_code == 200 and r.json()["status"] == "Confirmed"
    assert _stock(client, auth, pid) == 6

    r = client.put(f"{API}/orders/{oid}/cancel", headers=auth("manager"))
    assert r.status_code == 200 and r.json()["status"] == "Cancelled"
    assert _stock(client, auth, pid) == 10  # stock came back


def test_pending_order_cancel_does_not_change_stock(client, auth, make_product, make_customer):
    pid, cust = make_product(stock=10), make_customer()
    oid = _order(client, auth, cust, [(pid, 4)]).json()["order_id"]
    assert client.put(f"{API}/orders/{oid}/cancel", headers=auth("sales")).status_code == 200
    assert _stock(client, auth, pid) == 10


def test_confirm_fails_if_stock_vanished_and_rolls_back_cleanly(client, auth, make_product, make_customer):
    p1, p2, cust = make_product("A", 5), make_product("B", 5), make_customer()
    oid = _order(client, auth, cust, [(p1, 3), (p2, 3)]).json()["order_id"]
    # Someone removes stock of product B after the order was placed.
    client.post(f"{API}/inventory/{p2}/reduce", headers=auth("inventory"), json={"quantity": 4})

    r = client.put(f"{API}/orders/{oid}/status", headers=auth("sales"), json={"status": "Confirmed"})
    assert r.status_code == 409
    # all-or-nothing: product A must not have been deducted either
    assert _stock(client, auth, p1) == 5
    assert client.get(f"{API}/orders/{oid}", headers=auth("sales")).json()["status"] == "Pending"


def test_order_status_workflow_rules(client, auth, make_product, make_customer):
    pid, cust = make_product(stock=10), make_customer()
    oid = _order(client, auth, cust, [(pid, 1)]).json()["order_id"]
    put = lambda s: client.put(f"{API}/orders/{oid}/status", headers=auth("sales"), json={"status": s})

    assert put("Shipped").status_code == 409      # can't skip Confirmed
    assert put("Confirmed").status_code == 200
    assert put("Shipped").status_code == 200
    assert client.put(f"{API}/orders/{oid}/cancel", headers=auth("sales")).status_code == 409  # shipped
    assert put("Delivered").status_code == 200
    assert put("Pending").status_code == 409      # no going back
    assert client.put(f"{API}/orders/{oid}/status", headers=auth("sales"), json={"status": "Bogus"}).status_code == 422


def test_edit_pending_order_only(client, auth, make_product, make_customer):
    p1, p2, cust = make_product("A", 10), make_product("B", 10), make_customer()
    oid = _order(client, auth, cust, [(p1, 1)]).json()["order_id"]
    r = client.put(f"{API}/orders/{oid}", headers=auth("sales"), json={
        "notes": "rush", "items": [{"product_id": p2, "quantity": 2, "unit_price": "10.00"}]})
    assert r.status_code == 200
    assert r.json()["notes"] == "rush" and float(r.json()["total_amount"]) == 20.0
    assert [i["product_id"] for i in r.json()["items"]] == [p2]

    client.put(f"{API}/orders/{oid}/status", headers=auth("sales"), json={"status": "Confirmed"})
    assert client.put(f"{API}/orders/{oid}", headers=auth("sales"), json={"notes": "late"}).status_code == 409


def test_customer_orders_and_filters(client, auth, make_product, make_customer):
    pid, c1, c2 = make_product(stock=50), make_customer("One"), make_customer("Two")
    _order(client, auth, c1, [(pid, 1)])
    _order(client, auth, c1, [(pid, 1)])
    _order(client, auth, c2, [(pid, 1)])
    assert client.get(f"{API}/customers/{c1}/orders", headers=auth("manager")).json()["total"] == 2
    assert client.get(f"{API}/customers/999/orders", headers=auth("manager")).status_code == 404
    assert client.get(f"{API}/orders", headers=auth("manager"), params={"status": "Pending"}).json()["total"] == 3
    assert client.get(f"{API}/orders", headers=auth("manager"), params={"customer_id": c2}).json()["total"] == 1


def test_inactive_customer_cannot_order(client, auth, make_product, make_customer):
    pid, cust = make_product(stock=5), make_customer()
    assert client.delete(f"{API}/customers/{cust}", headers=auth("admin")).status_code == 204
    assert _order(client, auth, cust, [(pid, 1)]).status_code == 400
    # sales can't delete customers, only admin
    c2 = make_customer("Other")
    assert client.delete(f"{API}/customers/{c2}", headers=auth("sales")).status_code == 403
