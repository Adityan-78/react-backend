// ===== Imports =====
import { useState } from "react";
import { Link2, ImageOff } from "lucide-react";
import { productsApi, purchaseApi } from "../api/endpoints";
import Modal from "./Modal";
import { CATEGORIES, UNITS } from "../config/roles";
import { joinCategory, buildProductRequestNote, isUrl, today, formatMoney } from "../utils/format";

// ===== The NewProductRequestForm component (Inventory Executive) =====
// Asks the manager to approve a brand-new product before it can be used.
// What happens when you press "Send for approval":
//   1. POST /products              – creates the product (0 stock)
//   2. POST /purchase-requests     – one item for it; the notes carry the reference link + image
//   3. PUT  /products/{id}         – sets is_active=false so nobody can sell it yet
// After the manager approves, the product is switched on from the Inventory page.
export default function NewProductRequestForm({ notify, onClose, onSaved }) {
  // ===== State: every field is mandatory =====
  const [form, setForm] = useState({
    name: "", category: "", unit_measure: "", description: "",
    quantity: "", estimated_price: "", reference_link: "", image_url: "", reason: "",
  });
  const [imageFailed, setImageFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setForm({ ...form, [field]: value });

  // The text saved in the purchase request item (backend limit: 500 characters).
  const note = buildProductRequestNote(form.reference_link, form.image_url, form.reason);

  // ===== Check the form before sending =====
  function problem() {
    if (!isUrl(form.reference_link)) return "Reference link must be a full web address starting with http:// or https://";
    if (!isUrl(form.image_url)) return "Image link must be a full web address starting with http:// or https://";
    if (note.length > 500) return "Reference link, image link and reason together are too long (" + note.length + "/500 characters).";
    if (joinCategory(form.category, form.description).length > 255) return "Description is too long.";
    return "";
  }

  // ===== Send for approval (three API calls, in order) =====
  async function save(event) {
    event.preventDefault();
    const issue = problem();
    if (issue) { setError(issue); return; }
    setError("");
    setBusy(true);
    let product = null;
    try {
      product = await productsApi.create({
        name: form.name.trim(),
        description: joinCategory(form.category, form.description),
        unit_measure: form.unit_measure,
        initial_stock: 0,
      });
      const request = await purchaseApi.create({
        request_date: today(),
        items: [{ product_id: product.product_id, quantity: Number(form.quantity), estimated_price: Number(form.estimated_price), notes: note }],
      });
      await productsApi.update(product.product_id, { is_active: false }); // hidden until approved
      notify(form.name + " sent for approval as PR-" + request.pr_id);
      onSaved();
    } catch (err) {
      // If the request could not be raised, switch the half-created product off again.
      if (product) await productsApi.update(product.product_id, { is_active: false }).catch(() => {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ===== The form =====
  return (
    <Modal title="Request a new product" onClose={onClose} wide>
      <p className="muted small">All fields are required. The product stays hidden until a manager approves this request.</p>
      <form onSubmit={save} className="new-product">
        <div className="form-grid">
          <label className="field"><span>Product name *</span><input id="np-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={150} required /></label>
          <label className="field"><span>Category *</span>
            <select id="np-category" value={form.category} onChange={(e) => set("category", e.target.value)} required>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field"><span>Unit of measure *</span>
            <select id="np-unit" value={form.unit_measure} onChange={(e) => set("unit_measure", e.target.value)} required>
              <option value="">Choose…</option>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label className="field wide"><span>Description *</span><input id="np-description" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={200} placeholder="Size, colour, specification…" required /></label>
          <label className="field"><span>Quantity to buy *</span><input id="np-qty" type="number" min="1" max="1000000" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} required /></label>
          <label className="field"><span>Estimated price / unit ₹ *</span><input id="np-price" type="number" min="0" step="0.01" value={form.estimated_price} onChange={(e) => set("estimated_price", e.target.value)} required /></label>
        </div>

        <fieldset className="reference-box">
          <legend><Link2 size={15} /> Reference for the approver</legend>
          <div className="reference-grid">
            <div className="stack">
              <label className="field"><span>Reference link * (supplier or product page)</span>
                <input id="np-ref" type="url" value={form.reference_link} onChange={(e) => set("reference_link", e.target.value)} placeholder="https://supplier.com/product" required />
              </label>
              <label className="field"><span>Image link * (direct link to a photo)</span>
                <input id="np-img" type="url" value={form.image_url} onChange={(e) => { set("image_url", e.target.value); setImageFailed(false); }} placeholder="https://…/photo.jpg" required />
              </label>
              <label className="field"><span>Why is it needed? *</span>
                <textarea id="np-reason" rows="3" value={form.reason} onChange={(e) => set("reason", e.target.value)} required />
              </label>
              <span className={"small " + (note.length > 500 ? "text-red" : "muted")}>{note.length}/500 characters used for the reference note</span>
            </div>
            <div className="image-preview">
              {isUrl(form.image_url) && !imageFailed ? (
                <img src={form.image_url} alt="Product preview" onError={() => setImageFailed(true)} />
              ) : (
                <div className="image-empty"><ImageOff size={26} /><span>{imageFailed ? "Preview not available – check that the link opens a picture" : "Image preview"}</span></div>
              )}
            </div>
          </div>
        </fieldset>

        <div className="estimate">Estimated cost: <strong>{formatMoney(Number(form.quantity || 0) * Number(form.estimated_price || 0))}</strong></div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send for approval"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
