// ===== Imports =====
import { useState } from "react";
import { Check, X, Eye, ClipboardList, Sparkles, ExternalLink, Trash2, Plus, PackageCheck, Lock } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { purchaseApi, productsApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pager from "../components/Pager";
import PurchaseRequestForm from "../components/PurchaseRequestForm";
import ProductImage from "../components/ProductImage";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { APPROVAL_STATUSES } from "../config/roles";
import { formatDate, formatMoney, daysSince, daysLabel, readProductRequestNote } from "../utils/format";

const PAGE_SIZE = 10;

// ===== The PurchasesPage component =====
export default function PurchasesPage({ user, can, notify, filter }) {
  // ===== Which tabs this role gets =====
  const tabs = [];
  if (can.approvePurchases) tabs.push({ key: "waiting", label: "Waiting for my approval" });
  if (can.createPurchase) tabs.push({ key: "mine", label: "My requests" });
  tabs.push({ key: "all", label: "All requests" });

  // ===== State =====
  const startTab = can.approvePurchases && filter.approval === "Pending" ? "waiting" : filter.approval ? "all" : tabs[0].key;
  const [tab, setTab] = useState(startTab);
  const [approval, setApproval] = useState(filter.approval && startTab === "all" ? filter.approval : "");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null); // request shown in the detail window
  const [creating, setCreating] = useState(false);

  // Each tab calls a different endpoint.
  const requests = useFetch(() => {
    const params = { page, page_size: PAGE_SIZE };
    if (tab === "waiting") return purchaseApi.pendingApproval(params); // GET /purchase-requests/pending-approval
    if (tab === "mine") return purchaseApi.mine(params); // GET /purchase-requests/my
    return purchaseApi.list({ ...params, approval_status: approval }); // GET /purchase-requests
  }, [tab, approval, page]);

  const switchTab = (key) => { setTab(key); setPage(1); };

  // ===== What the page looks like =====
  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div className="tabs">
            {tabs.map((t) => <button key={t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => switchTab(t.key)}>{t.label}</button>)}
          </div>
          {tab === "all" && (
            <select id="pr-approval-filter" value={approval} onChange={(e) => { setApproval(e.target.value); setPage(1); }}>
              <option value="">Any approval status</option>
              {APPROVAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          {can.createPurchase && <button className="btn btn-primary push-right" onClick={() => setCreating(true)}><ClipboardList size={16} /> New purchase request</button>}
        </div>
        {can.approvePurchases && <p className="muted small">Requests waiting 3 days or more are highlighted so they can be decided first.</p>}

        {requests.loading && <Loading />}
        {requests.error && <ErrorBox message={requests.error} onRetry={requests.reload} />}
        {requests.data && requests.data.items.length === 0 && <Empty text="No purchase requests here." />}
        {requests.data && requests.data.items.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Request</th><th>Raised by</th><th>Items</th><th>Estimated</th><th>Requested</th><th>Approval</th><th>Progress</th><th></th></tr></thead>
              <tbody>
                {requests.data.items.map((pr) => {
                  const waiting = daysSince(pr.request_date);
                  const delayed = pr.approval_status === "Pending" && waiting >= 3;
                  const isNewProduct = pr.items.some((it) => readProductRequestNote(it.notes));
                  return (
                    <tr key={pr.pr_id} className={delayed ? "row-warning clickable-row" : "clickable-row"} onClick={() => setOpenId(pr.pr_id)}>
                      <td><span className="strong">PR-{pr.pr_id}</span>{isNewProduct && <span className="new-tag"><Sparkles size={12} /> New product</span>}</td>
                      <td>{pr.raised_by_name}</td>
                      <td>{pr.items.map((it) => it.product_name + " × " + it.quantity).join(", ") || <span className="muted">No items</span>}</td>
                      <td className="strong">{formatMoney(pr.total_estimated)}</td>
                      <td>
                        {formatDate(pr.request_date)}
                        {pr.approval_status === "Pending" && <div className={delayed ? "small text-red" : "muted small"}>{daysLabel(waiting)} waiting</div>}
                      </td>
                      <td><StatusBadge status={pr.approval_status} /></td>
                      <td><StatusBadge status={pr.status} /></td>
                      <td><button className="icon-btn" title="Open"><Eye size={16} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {requests.data && <Pager page={page} pageSize={PAGE_SIZE} total={requests.data.total} onChange={setPage} />}
      </div>

      {openId && <RequestDetail prId={openId} user={user} can={can} notify={notify} onClose={() => setOpenId(null)} onChanged={requests.reload} />}
      {creating && <PurchaseRequestForm notify={notify} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); switchTab(can.createPurchase ? "mine" : "all"); requests.reload(); }} />}
    </>
  );
}

// ===== Request detail window: GET /purchase-requests/{id} and every action on it =====
function RequestDetail({ prId, can, notify, onClose, onChanged }) {
  const request = useFetch(() => purchaseApi.get(prId), [prId]);
  const [receiveStock, setReceiveStock] = useState(true);
  const [error, setError] = useState("");

  // Runs an action, then refreshes this window and the list behind it.
  async function run(action, message) {
    setError("");
    try {
      await action();
      notify(message);
      request.reload();
      onChanged();
    } catch (err) {
      setError(err.message); // e.g. 409 if someone else decided first
    }
  }

  if (request.loading && !request.data) return <Modal title={"PR-" + prId} onClose={onClose}><Loading /></Modal>;
  if (request.error) return <Modal title={"PR-" + prId} onClose={onClose}><ErrorBox message={request.error} /></Modal>;
  const pr = request.data;
  const pending = pr.approval_status === "Pending";
  const newProducts = pr.items.map((it) => ({ item: it, info: readProductRequestNote(it.notes) })).filter((x) => x.info);

  return (
    <Modal title={"Purchase request PR-" + pr.pr_id} onClose={onClose} wide>
      <div className="detail-grid">
        <div><span className="muted small">Raised by</span><div className="strong">{pr.raised_by_name}</div></div>
        <div><span className="muted small">Requested</span><div>{formatDate(pr.request_date)}</div></div>
        <div><span className="muted small">Approval</span><div><StatusBadge status={pr.approval_status} /></div></div>
        <div><span className="muted small">Progress</span><div><StatusBadge status={pr.status} /></div></div>
      </div>

      {/* New-product reference: image, link and reason for the approver */}
      {newProducts.map(({ item, info }) => (
        <div className="reference-view" key={item.pr_item_id}>
          <ProductImage url={info.imageUrl} />
          <div>
            <span className="new-tag"><Sparkles size={12} /> New product</span>
            <h4>{item.product_name}</h4>
            <p className="small">{info.reason}</p>
            <a className="ref-link" href={info.referenceLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {info.referenceLink}</a>
          </div>
        </div>
      ))}

      <ItemsTable pr={pr} editable={pending && can.createPurchase} onRun={run} />

      {error && <div className="form-error">{error}</div>}

      {/* Manager decision */}
      {pending && can.approvePurchases && (
        <div className="form-actions">
          <button className="btn btn-success" onClick={() => run(() => purchaseApi.approve(pr.pr_id), "PR-" + pr.pr_id + " approved")}><Check size={16} /> Approve</button>
          <button className="btn btn-danger" onClick={() => run(() => purchaseApi.reject(pr.pr_id), "PR-" + pr.pr_id + " rejected")}><X size={16} /> Reject</button>
        </div>
      )}


      {/* Fulfilment after approval: In Progress -> Completed -> Closed */}
      {can.fulfilPurchase && pr.approval_status === "Approved" && pr.status === "In Progress" && (
        <div className="form-actions">
          <label className="check"><input id="receive-stock" type="checkbox" checked={receiveStock} onChange={(e) => setReceiveStock(e.target.checked)} /> Add these quantities to inventory</label>
          <button className="btn btn-success" onClick={() => run(() => purchaseApi.setStatus(pr.pr_id, "Completed", receiveStock), "PR-" + pr.pr_id + " completed")}><PackageCheck size={16} /> Mark completed</button>
        </div>
      )}
      {can.fulfilPurchase && pr.approval_status === "Approved" && pr.status === "Completed" && (
        <div className="form-actions">
          <button className="btn btn-light" onClick={() => run(() => purchaseApi.setStatus(pr.pr_id, "Closed", false), "PR-" + pr.pr_id + " closed")}><Lock size={16} /> Close request</button>
        </div>
      )}
    </Modal>
  );
}

// ===== Items table; while a request is Pending the inventory executive can change it =====
// POST /purchase-requests/{id}/items, PUT /purchase-request-items/{id}, DELETE /purchase-request-items/{id}
function ItemsTable({ pr, editable, onRun }) {
  const products = useFetch(() => (editable ? productsApi.active({ page: 1, page_size: 100 }) : Promise.resolve(null)), [editable]);
  const [newItem, setNewItem] = useState({ product_id: "", quantity: "", estimated_price: "", notes: "" });

  function addItem(event) {
    event.preventDefault();
    onRun(() => purchaseApi.addItem(pr.pr_id, {
      product_id: Number(newItem.product_id), quantity: Number(newItem.quantity),
      estimated_price: Number(newItem.estimated_price), notes: newItem.notes.trim(),
    }), "Item added to PR-" + pr.pr_id);
    setNewItem({ product_id: "", quantity: "", estimated_price: "", notes: "" });
  }

  function changeQuantity(item, quantity) {
    if (Number(quantity) > 0 && Number(quantity) !== item.quantity) {
      onRun(() => purchaseApi.updateItem(item.pr_item_id, { quantity: Number(quantity) }), "Quantity updated");
    }
  }

  return (
    <>
      <table className="table">
        <thead><tr><th>Product</th><th>Quantity</th><th>Est. price</th><th>Line total</th><th>Notes</th>{editable && <th></th>}</tr></thead>
        <tbody>
          {pr.items.map((it) => (
            <tr key={it.pr_item_id}>
              <td className="strong">{it.product_name}</td>
              <td>
                {editable
                  ? <input className="qty-input" type="number" min="1" defaultValue={it.quantity} onBlur={(e) => changeQuantity(it, e.target.value)} aria-label={"Quantity of " + it.product_name} />
                  : it.quantity}
              </td>
              <td>{it.estimated_price == null ? "—" : formatMoney(it.estimated_price)}</td>
              <td>{formatMoney(it.quantity * Number(it.estimated_price || 0))}</td>
              <td className="muted small">{readProductRequestNote(it.notes) ? "New product – see reference above" : it.notes || "—"}</td>
              {editable && (
                <td><button className="icon-btn" title="Remove item" onClick={() => onRun(() => purchaseApi.removeItem(it.pr_item_id), "Item removed")}><Trash2 size={16} /></button></td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan="3" className="strong">Estimated total</td><td className="strong">{formatMoney(pr.total_estimated)}</td><td colSpan={editable ? 2 : 1}></td></tr></tfoot>
      </table>

      {editable && (
        <form className="line pr add-line" onSubmit={addItem}>
          <select id="add-item-product" value={newItem.product_id} onChange={(e) => setNewItem({ ...newItem, product_id: e.target.value })} required>
            <option value="">Add a product…</option>
            {(products.data?.items || []).filter((p) => !pr.items.some((it) => it.product_id === p.product_id)).map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
          </select>
          <input id="add-item-qty" type="number" min="1" placeholder="Qty" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} required />
          <input id="add-item-price" type="number" min="0" step="0.01" placeholder="Price ₹" value={newItem.estimated_price} onChange={(e) => setNewItem({ ...newItem, estimated_price: e.target.value })} required />
          <input id="add-item-notes" placeholder="Reason" maxLength={500} value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} required />
          <button className="btn btn-light" type="submit"><Plus size={16} /> Add</button>
        </form>
      )}
    </>
  );
}
