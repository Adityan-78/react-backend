// ===== Imports =====
import { useState } from "react";
import { Plus, Eye, Pencil, CheckCircle2, XCircle, PackageCheck } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { ordersApi, customersApi, productsApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pager from "../components/Pager";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { ORDER_STATUSES, ORDER_NEXT_STEPS } from "../config/roles";
import { formatDate, formatMoney, today } from "../utils/format";

const PAGE_SIZE = 10;
const STEP_LABEL = { Confirmed: "Confirm", Shipped: "Mark shipped", Delivered: "Mark delivered" };

// ===== The OrdersPage component =====
export default function OrdersPage({ can, notify, filter }) {
  // ===== State =====
  const [status, setStatus] = useState(filter.status || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null); // order shown in the detail window
  const [editing, setEditing] = useState(null); // {} = new order, an order = edit

  // GET /orders?status=..&date_from=..&date_to=..&page=..
  const orders = useFetch(
    () => ordersApi.list({ page, page_size: PAGE_SIZE, status, date_from: dateFrom, date_to: dateTo }),
    [page, status, dateFrom, dateTo]
  );

  // ===== Move an order forward: PUT /orders/{id}/status, or cancel: PUT /orders/{id}/cancel =====
  async function moveTo(order, nextStatus) {
    try {
      if (nextStatus === "Cancelled") await ordersApi.cancel(order.order_id);
      else await ordersApi.setStatus(order.order_id, nextStatus);
      notify("Order #" + order.order_id + " is now " + nextStatus);
      orders.reload();
    } catch (err) {
      // 409 = the order status changed or the requested transition is not allowed.
      notify(err.message, "error");
      orders.reload();
    }
  }

  // ===== What the page looks like =====
  return (
    <>
      {can.checkAvailability && <AvailabilityChecker />}

      <div className="card">
        <div className="toolbar">
          <div className="tabs">
            {["", ...ORDER_STATUSES].map((s) => (
              <button key={s || "all"} className={status === s ? "tab active" : "tab"} onClick={() => { setStatus(s); setPage(1); }}>
                {s || "All"}
              </button>
            ))}
          </div>
          <div className="date-range">
            <input id="order-from" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} aria-label="From date" />
            <span className="muted">to</span>
            <input id="order-to" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} aria-label="To date" />
          </div>
          {can.createOrder && (
            <button className="btn btn-primary push-right" onClick={() => setEditing({})}><Plus size={16} /> New order</button>
          )}
        </div>

        {orders.loading && <Loading />}
        {orders.error && <ErrorBox message={orders.error} onRetry={orders.reload} />}
        {orders.data && orders.data.items.length === 0 && <Empty text="No orders match these filters." />}
        {orders.data && orders.data.items.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Date</th><th>Notes</th><th>Total</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {orders.data.items.map((o) => (
                  <tr key={o.order_id}>
                    <td className="strong">#{o.order_id}</td>
                    <td>{o.customer_name}</td>
                    <td>{formatDate(o.order_date)}</td>
                    <td className="muted">{o.notes || "—"}</td>
                    <td className="strong">{formatMoney(o.total_amount)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="View" onClick={() => setViewing(o)}><Eye size={16} /></button>
                        {can.createOrder && o.status === "Pending" && (
                          <button className="icon-btn" title="Edit" onClick={() => setEditing(o)}><Pencil size={16} /></button>
                        )}
                        {/* Only show the moves the backend allows from the current status */}
                        {can.changeOrderStatus && (ORDER_NEXT_STEPS[o.status] || []).map((next) =>
                          next === "Cancelled" ? (
                            <button key={next} className="btn btn-danger btn-sm" onClick={() => moveTo(o, next)}><XCircle size={14} /> Cancel</button>
                          ) : (
                            <button key={next} className="btn btn-success btn-sm" onClick={() => moveTo(o, next)}><CheckCircle2 size={14} /> {STEP_LABEL[next]}</button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {orders.data && <Pager page={page} pageSize={PAGE_SIZE} total={orders.data.total} onChange={setPage} />}
      </div>

      {viewing && <OrderDetail order={viewing} onClose={() => setViewing(null)} />}
      {editing && <OrderForm order={editing} notify={notify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); orders.reload(); }} />}
    </>
  );
}

// ===== Product availability checker: GET /products/{id}/availability?quantity=.. =====
function AvailabilityChecker() {
  const products = useFetch(() => productsApi.active({ page: 1, page_size: 100 }), []);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState(null);

  async function check(event) {
    event.preventDefault();
    try {
      setResult(await productsApi.availability(productId, quantity));
    } catch (err) {
      setResult({ error: err.message });
    }
  }

  return (
    <div className="card">
      <h3 className="card-title"><PackageCheck size={16} /> Check product availability</h3>
      <form className="check-row" onSubmit={check}>
        <select id="avail-product" value={productId} onChange={(e) => { setProductId(e.target.value); setResult(null); }} required>
          <option value="">Choose a product…</option>
          {(products.data?.items || []).map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
        </select>
        <input id="avail-qty" type="number" min="1" value={quantity} onChange={(e) => { setQuantity(e.target.value); setResult(null); }} required />
        <button className="btn btn-primary" type="submit">Check</button>
        {result && (
          <div className={"check-result " + (result.error ? "check-red" : result.is_available ? "check-green" : "check-red")}>
            {result.error
              ? result.error
              : result.is_available
                ? "Available – " + result.available + " in stock for " + result.requested + " requested."
                : "Not enough – only " + result.available + " in stock for " + result.requested + " requested."}
          </div>
        )}
      </form>
    </div>
  );
}

// ===== Order detail window =====
function OrderDetail({ order, onClose }) {
  return (
    <Modal title={"Order #" + order.order_id} onClose={onClose}>
      <div className="detail-grid">
        <div><span className="muted small">Customer</span><div className="strong">{order.customer_name}</div></div>
        <div><span className="muted small">Order date</span><div>{formatDate(order.order_date)}</div></div>
        <div><span className="muted small">Status</span><div><StatusBadge status={order.status} /></div></div>
        <div><span className="muted small">Total amount</span><div className="strong">{formatMoney(order.total_amount)}</div></div>
        <div className="wide"><span className="muted small">Notes</span><div>{order.notes || "—"}</div></div>
      </div>
    </Modal>
  );
}

// ===== New / edit order form: header-only Sales_Order record =====
function OrderForm({ order, notify, onClose, onSaved }) {
  const isNew = !order.order_id;
  const customers = useFetch(() => customersApi.list({ page: 1, page_size: 100 }), []);
  const [customerId, setCustomerId] = useState(order.customer_id || "");
  const [orderDate, setOrderDate] = useState(order.order_date || today());
  const [totalAmount, setTotalAmount] = useState(order.total_amount ?? "");
  const [notes, setNotes] = useState(order.notes || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const payload = { order_date: orderDate, total_amount: Number(totalAmount), notes: notes || null };
    try {
      if (isNew) {
        const created = await ordersApi.create({ ...payload, customer_id: Number(customerId) });
        notify("Order #" + created.order_id + " created – " + formatMoney(created.total_amount));
      } else {
        await ordersApi.update(order.order_id, payload);
        notify("Order #" + order.order_id + " updated");
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isNew ? "New sales order" : "Edit order #" + order.order_id} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <div className="form-grid">
          <label className="field"><span>Customer *</span>
            <select id="of-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required disabled={!isNew}>
              <option value="">Choose a customer…</option>
              {(customers.data?.items || []).map((c) => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Order date</span><input id="of-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></label>
          <label className="field"><span>Total amount (₹) *</span><input id="of-total" type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required /></label>
          <label className="field wide"><span>Notes</span><input id="of-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, PO number…" /></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isNew ? "Create order" : "Save changes"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

