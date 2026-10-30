// ===== Imports =====
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { productsApi, purchaseApi } from "../api/endpoints";
import Modal from "./Modal";
import { formatMoney, today } from "../utils/format";

// ===== The PurchaseRequestForm component =====
// Raise a new purchase request: POST /purchase-requests with one or more items.
// Every field is mandatory, so the manager always sees quantity, price and a reason.
// startProductId pre-selects a product (used by the "Reorder" button on low-stock rows).
export default function PurchaseRequestForm({ startProductId, notify, onClose, onSaved }) {
  const products = useFetch(() => productsApi.active({ page: 1, page_size: 100 }), []);
  const [requestDate, setRequestDate] = useState(today());
  const [items, setItems] = useState([
    { product_id: startProductId || "", quantity: "", estimated_price: "", notes: startProductId ? "Stock below reorder level" : "" },
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ===== Line helpers =====
  const update = (index, field, value) => setItems(items.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  const addItem = () => setItems([...items, { product_id: "", quantity: "", estimated_price: "", notes: "" }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));
  const total = items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.estimated_price || 0), 0);

  // ===== Send it =====
  async function save(event) {
    event.preventDefault();
    setError("");
    const ids = items.map((it) => String(it.product_id));
    if (new Set(ids).size !== ids.length) {
      setError("A product can appear only once in a request.");
      return;
    }
    setBusy(true);
    try {
      const created = await purchaseApi.create({
        request_date: requestDate,
        items: items.map((it) => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          estimated_price: Number(it.estimated_price),
          notes: it.notes.trim(),
        })),
      });
      notify("PR-" + created.pr_id + " sent to the manager for approval");
      onSaved(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ===== The form =====
  return (
    <Modal title="Raise a purchase request" onClose={onClose} wide>
      <form onSubmit={save} className="stack">
        <label className="field narrow"><span>Request date *</span>
          <input id="pr-date" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
        </label>
        <div className="lines">
          <div className="lines-head pr"><span>Product *</span><span>Quantity *</span><span>Est. price / unit ₹ *</span><span>Reason *</span><span></span></div>
          {items.map((it, index) => (
            <div className="line pr" key={index}>
              <select id={"pr-product-" + index} value={it.product_id} onChange={(e) => update(index, "product_id", e.target.value)} required>
                <option value="">Choose…</option>
                {(products.data?.items || []).map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
              </select>
              <input id={"pr-qty-" + index} type="number" min="1" max="1000000" value={it.quantity} onChange={(e) => update(index, "quantity", e.target.value)} required />
              <input id={"pr-price-" + index} type="number" min="0" step="0.01" value={it.estimated_price} onChange={(e) => update(index, "estimated_price", e.target.value)} required />
              <input id={"pr-notes-" + index} value={it.notes} onChange={(e) => update(index, "notes", e.target.value)} maxLength={500} placeholder="Why is it needed?" required />
              {items.length > 1 ? <button type="button" className="icon-btn" title="Remove" onClick={() => removeItem(index)}><Trash2 size={16} /></button> : <span />}
            </div>
          ))}
          <button type="button" className="btn btn-light" onClick={addItem}><Plus size={16} /> Add another product</button>
        </div>
        <div className="estimate">Estimated cost: <strong>{formatMoney(total)}</strong></div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send for approval"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
