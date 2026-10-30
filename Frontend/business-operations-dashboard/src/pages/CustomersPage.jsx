// ===== Imports =====
import { useState } from "react";
import { Plus, Pencil, Search, Receipt } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { customersApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pager from "../components/Pager";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { formatDate, formatMoney } from "../utils/format";

const PAGE_SIZE = 10;

// ===== The CustomersPage component (Administrator, Sales Executive) =====
export default function CustomersPage({ can, notify }) {
  // ===== State =====
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null, {} (new) or a customer
  const [ordersFor, setOrdersFor] = useState(null); // customer whose orders are open

  // GET /customers?search=..
  const customers = useFetch(
    () => customersApi.list({ page, page_size: PAGE_SIZE, search }),
    [page, search]
  );

  // ===== What the page looks like =====
  return (
    <div className="card">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input id="customer-search" placeholder="Search name, email or city" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {can.createCustomer && (
          <button className="btn btn-primary push-right" onClick={() => setEditing({})}><Plus size={16} /> New customer</button>
        )}
      </div>

      {customers.loading && <Loading />}
      {customers.error && <ErrorBox message={customers.error} onRetry={customers.reload} />}
      {customers.data && customers.data.items.length === 0 && <Empty text="No customers found." />}
      {customers.data && customers.data.items.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Customer</th><th>Phone</th><th>Address</th><th>Since</th><th></th></tr>
            </thead>
            <tbody>
              {customers.data.items.map((c) => (
                <tr key={c.customer_id}>
                  <td><div className="strong">{c.name}</div><div className="muted small">{c.email || "—"}</div></td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.address || "—"}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      {can.viewCustomerOrders && <button className="icon-btn" title="View orders" onClick={() => setOrdersFor(c)}><Receipt size={16} /></button>}
                      {can.editCustomer && <button className="icon-btn" title="Edit" onClick={() => setEditing(c)}><Pencil size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {customers.data && <Pager page={page} pageSize={PAGE_SIZE} total={customers.data.total} onChange={setPage} />}

      {editing && <CustomerForm customer={editing} notify={notify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); customers.reload(); }} />}
      {ordersFor && <CustomerOrders customer={ordersFor} onClose={() => setOrdersFor(null)} />}
    </div>
  );
}

// ===== New / edit customer: POST /customers or PUT /customers/{id} =====
function CustomerForm({ customer, notify, onClose, onSaved }) {
  const isNew = !customer.customer_id;
  const [form, setForm] = useState({ name: customer.name || "", email: customer.email || "", phone: customer.phone || "", address: customer.address || "" });
  const [error, setError] = useState("");
  const set = (field, value) => setForm({ ...form, [field]: value });

  async function save(event) {
    event.preventDefault();
    setError("");
    // Send null instead of "" for empty optional fields.
    const body = { name: form.name, email: form.email || null, phone: form.phone || null, address: form.address || null };
    try {
      if (isNew) await customersApi.create(body);
      else await customersApi.update(customer.customer_id, body);
      notify(isNew ? form.name + " was added" : "Saved " + form.name);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={isNew ? "New customer" : "Edit " + customer.name} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="field wide"><span>Company or person name *</span><input id="cf-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={150} required /></label>
        <label className="field"><span>Email</span><input id="cf-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="field"><span>Phone</span><input id="cf-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} /></label>
        <label className="field wide"><span>Address</span><input id="cf-address" value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={255} /></label>
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{isNew ? "Add customer" : "Save changes"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ===== A customer's orders: GET /customers/{id}/orders =====
function CustomerOrders({ customer, onClose }) {
  const orders = useFetch(() => customersApi.orders(customer.customer_id, { page: 1, page_size: 50 }), []);
  return (
    <Modal title={"Orders from " + customer.name} onClose={onClose} wide>
      {orders.loading && <Loading />}
      {orders.error && <ErrorBox message={orders.error} />}
      {orders.data && orders.data.items.length === 0 && <Empty text="This customer has no orders yet." />}
      {orders.data && orders.data.items.length > 0 && (
        <table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Notes</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {orders.data.items.map((o) => (
              <tr key={o.order_id}>
                <td className="strong">#{o.order_id}</td>
                <td>{formatDate(o.order_date)}</td>
                <td>{o.notes || "—"}</td>
                <td>{formatMoney(o.total_amount)}</td>
                <td><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
