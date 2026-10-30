// ===== Imports =====
import { useState } from "react";
import {
  Search, PlusCircle, MinusCircle, ClipboardList, Plus, Pencil, Ban,
  RotateCcw, Sparkles, ExternalLink, Rocket, AlertTriangle,
} from "lucide-react";
import useFetch from "../hooks/useFetch";
import { inventoryApi, productsApi, purchaseApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pager from "../components/Pager";
import PurchaseRequestForm from "../components/PurchaseRequestForm";
import NewProductRequestForm from "../components/NewProductRequestForm";
import ProductImage from "../components/ProductImage";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { CATEGORIES, UNITS } from "../config/roles";
import { formatDate, formatMoney, splitCategory, joinCategory, readProductRequestNote } from "../utils/format";

// ===== The InventoryPage component (Administrator, Inventory Executive) =====
// Three tabs: stock levels, the product catalogue, and new-product requests.
export default function InventoryPage({ can, notify, filter, goTo }) {
  const [tab, setTab] = useState("stock");
  return (
    <>
      <div className="tabs big">
        <button className={tab === "stock" ? "tab active" : "tab"} onClick={() => setTab("stock")}>Stock levels</button>
        <button className={tab === "products" ? "tab active" : "tab"} onClick={() => setTab("products")}>Product catalogue</button>
        <button className={tab === "requests" ? "tab active" : "tab"} onClick={() => setTab("requests")}>New product requests</button>
      </div>
      {tab === "stock" && <StockTab can={can} notify={notify} filter={filter} goTo={goTo} />}
      {tab === "products" && <ProductsTab can={can} notify={notify} onRequested={() => setTab("requests")} />}
      {tab === "requests" && <RequestsTab can={can} notify={notify} />}
    </>
  );
}

// ===== Stock tab: GET /inventory (+ GET /products for categories) =====
function StockTab({ can, notify, filter, goTo }) {
  // ===== State =====
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(!!filter.lowOnly);
  const [category, setCategory] = useState(filter.category || "All");
  const [moving, setMoving] = useState(null); // { item, direction: "add" | "reduce" }
  const [levels, setLevels] = useState(null); // item whose stock quantity is being edited
  const [reorderFor, setReorderFor] = useState(null); // product id for a purchase request

  const stock = useFetch(() => inventoryApi.list({ page: 1, page_size: 100, search, low_only: lowOnly }), [search, lowOnly]);
  const products = useFetch(() => productsApi.list({ page: 1, page_size: 100 }), []);

  // ===== Work out each row's category and filter by the chosen chip =====
  const productById = {};
  (products.data?.items || []).forEach((p) => { productById[p.product_id] = p; });
  const rows = (stock.data?.items || [])
    .map((s) => ({ ...s, category: splitCategory(productById[s.product_id]?.description).category, active: productById[s.product_id]?.is_active !== false }))
    .filter((s) => category === "All" || s.category === category);
  const usedCategories = ["All", ...CATEGORIES.filter((c) => (stock.data?.items || []).some((s) => splitCategory(productById[s.product_id]?.description).category === c))];
  const lowCount = (stock.data?.items || []).filter((s) => s.is_low_stock).length;

  function stockLabel(item) {
    if (item.quantity_in_stock === 0) return "Out of stock";
    if (item.is_low_stock) return "Low stock";
    return "In stock";
  }

  // ===== What the tab looks like =====
  return (
    <>
      {lowCount > 0 && !lowOnly && (
        <button className="banner banner-amber" onClick={() => setLowOnly(true)}>
          <AlertTriangle size={18} />
          <span><strong>{lowCount} products are at or below their reorder level.</strong> Click to show only those.</span>
        </button>
      )}
      <div className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input id="stock-search" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="check"><input id="stock-low" type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only</label>
          {can.changeStock && (
            <button className="btn btn-primary push-right" onClick={() => setReorderFor("")}><ClipboardList size={16} /> New purchase request</button>
          )}
        </div>
        <div className="chips">
          {usedCategories.map((c) => (
            <button key={c} className={category === c ? "chip active" : "chip"} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>

        {stock.loading && <Loading />}
        {stock.error && <ErrorBox message={stock.error} onRetry={stock.reload} />}
        {stock.data && rows.length === 0 && <Empty text="No products match these filters." />}
        {rows.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Category</th><th style={{ width: "24%" }}>Stock vs reorder level</th><th>Status</th><th>Updated</th>{can.changeStock && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const label = stockLabel(s);
                  const scale = Math.max(s.quantity_in_stock, s.reorder_level * 2, 1);
                  return (
                    <tr key={s.inventory_id} className={label !== "In stock" ? "row-warning" : ""}>
                      <td><div className="strong">{s.product_name}</div><div className="muted small">{s.unit_measure}{!s.active && " · inactive product"}</div></td>
                      <td><span className="cat-tag">{s.category}</span></td>
                      <td>
                        <div className="stock-cell">
                          <span className="strong">{s.quantity_in_stock}</span>
                          <div className="progress with-marker" title={"Reorder level: " + s.reorder_level}>
                            <div className={"progress-fill fill-" + (label === "In stock" ? "green" : label === "Low stock" ? "amber" : "red")} style={{ width: (s.quantity_in_stock / scale) * 100 + "%" }} />
                            <div className="marker" style={{ left: (s.reorder_level / scale) * 100 + "%" }} />
                          </div>
                        </div>
                        <div className="muted small">Reorder at {s.reorder_level}</div>
                      </td>
                      <td><StatusBadge status={label} /></td>
                      <td>{formatDate(s.last_updated)}</td>
                      {can.changeStock && (
                        <td>
                          <div className="row-actions">
                            <button className="icon-btn" title="Receive stock" onClick={() => setMoving({ item: s, direction: "add" })}><PlusCircle size={17} /></button>
                            <button className="icon-btn" title="Issue / remove stock" onClick={() => setMoving({ item: s, direction: "reduce" })}><MinusCircle size={17} /></button>
                            <button className="icon-btn" title="Set stock quantity" onClick={() => setLevels(s)}><Pencil size={17} /></button>
                            {s.is_low_stock && s.active && <button className="btn btn-warning btn-sm" onClick={() => setReorderFor(s.product_id)}>Reorder</button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {moving && <StockMovementForm {...moving} notify={notify} onClose={() => setMoving(null)} onSaved={() => { setMoving(null); stock.reload(); }} />}
      {levels && <LevelsForm item={levels} notify={notify} onClose={() => setLevels(null)} onSaved={() => { setLevels(null); stock.reload(); }} />}
      {reorderFor !== null && (
        <PurchaseRequestForm startProductId={reorderFor} notify={notify} onClose={() => setReorderFor(null)}
          onSaved={() => { setReorderFor(null); goTo("purchases"); }} />
      )}
    </>
  );
}

// ===== Receive or remove stock: POST /inventory/{id}/add or /reduce =====
function StockMovementForm({ item, direction, notify, onClose, onSaved }) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const adding = direction === "add";

  async function save(event) {
    event.preventDefault();
    try {
      const updated = adding ? await inventoryApi.add(item.product_id, Number(quantity)) : await inventoryApi.reduce(item.product_id, Number(quantity));
      notify(item.product_name + ": " + updated.quantity_in_stock + " now in stock");
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={(adding ? "Receive stock – " : "Remove stock – ") + item.product_name} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <p className="muted wide">Currently in stock: <strong>{item.quantity_in_stock}</strong></p>
        <label className="field wide"><span>Quantity to {adding ? "add" : "remove"} *</span>
          <input id="move-qty" type="number" min="1" max={adding ? undefined : item.quantity_in_stock} value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
        </label>
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{adding ? "Add to stock" : "Remove from stock"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ===== Set exact stock quantity: PUT /inventory/{id} =====
function LevelsForm({ item, notify, onClose, onSaved }) {
  const [quantity, setQuantity] = useState(item.quantity_in_stock);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    try {
      await inventoryApi.update(item.product_id, { quantity_in_stock: Number(quantity) });
      notify("Levels saved for " + item.product_name);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={"Stock settings – " + item.product_name} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="field"><span>Quantity in stock *</span><input id="lv-qty" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label>
        <p className="muted small wide">The reorder threshold is configured by the application and cannot be changed per product.</p>
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ===== Products tab: GET /products, POST, PUT, DELETE =====
function ProductsTab({ can, notify, onRequested }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // {} = new (admin), product = edit
  const [requesting, setRequesting] = useState(false);
  const products = useFetch(() => productsApi.list({ page, page_size: 10, search }), [page, search]);

  // ===== Switch a product off (DELETE = soft deactivate) or back on (PUT is_active: true) =====
  async function toggle(product) {
    try {
      if (product.is_active) await productsApi.deactivate(product.product_id);
      else await productsApi.update(product.product_id, { is_active: true });
      notify(product.name + (product.is_active ? " deactivated" : " is active again"));
      products.reload();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input id="product-search" placeholder="Search products" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {can.createProductDirectly && <button className="btn btn-primary push-right" onClick={() => setEditing({})}><Plus size={16} /> Add product</button>}
        {can.requestNewProduct && <button className="btn btn-primary push-right" onClick={() => setRequesting(true)}><Sparkles size={16} /> Request new product</button>}
      </div>
      {products.loading && <Loading />}
      {products.error && <ErrorBox message={products.error} onRetry={products.reload} />}
      {products.data && products.data.items.length === 0 && <Empty text="No products found." />}
      {products.data && products.data.items.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th>Unit</th><th>Status</th>{can.editProduct && <th></th>}</tr></thead>
            <tbody>
              {products.data.items.map((p) => {
                const { category, text } = splitCategory(p.description);
                return (
                  <tr key={p.product_id} className={p.is_active ? "" : "row-muted"}>
                    <td><div className="strong">{p.name}</div><div className="muted small">{text}</div></td>
                    <td><span className="cat-tag">{category}</span></td>
                    <td>{p.unit_measure || "—"}</td>
                    <td><StatusBadge status={p.is_active ? "Active" : "Inactive"} /></td>
                    {can.editProduct && (
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn" title="Edit" onClick={() => setEditing(p)}><Pencil size={16} /></button>
                          <button className="icon-btn" title={p.is_active ? "Deactivate" : "Activate"} onClick={() => toggle(p)}>{p.is_active ? <Ban size={16} /> : <RotateCcw size={16} />}</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {products.data && <Pager page={page} pageSize={10} total={products.data.total} onChange={setPage} />}
      {editing && <ProductForm product={editing} notify={notify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); products.reload(); }} />}
      {requesting && <NewProductRequestForm notify={notify} onClose={() => setRequesting(false)} onSaved={() => { setRequesting(false); onRequested(); }} />}
    </div>
  );
}

// ===== Add (admin) or edit a product: POST /products or PUT /products/{id} =====
function ProductForm({ product, notify, onClose, onSaved }) {
  const isNew = !product.product_id;
  const current = splitCategory(product.description);
  const [form, setForm] = useState({
    name: product.name || "", category: isNew ? "" : current.category, description: isNew ? "" : current.text,
    unit_measure: product.unit_measure || "", initial_stock: "",
  });
  const [error, setError] = useState("");
  const set = (field, value) => setForm({ ...form, [field]: value });

  async function save(event) {
    event.preventDefault();
    const body = { name: form.name.trim(), description: joinCategory(form.category, form.description), unit_measure: form.unit_measure };
    try {
      if (isNew) await productsApi.create({ ...body, initial_stock: Number(form.initial_stock) });
      else await productsApi.update(product.product_id, body);
      notify((isNew ? "Added " : "Saved ") + body.name);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={isNew ? "Add a product" : "Edit " + product.name} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="field wide"><span>Product name *</span><input id="pf-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={150} required /></label>
        <label className="field"><span>Category *</span>
          <select id="pf-category" value={form.category} onChange={(e) => set("category", e.target.value)} required>
            <option value="">Choose…</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>Unit of measure *</span>
          <select id="pf-unit" value={form.unit_measure} onChange={(e) => set("unit_measure", e.target.value)} required>
            <option value="">Choose…</option>
            {[...new Set([...UNITS, form.unit_measure].filter(Boolean))].map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="field wide"><span>Description *</span><input id="pf-description" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={200} required /></label>
        {isNew && (
          <>
            <label className="field"><span>Opening stock *</span><input id="pf-stock" type="number" min="0" value={form.initial_stock} onChange={(e) => set("initial_stock", e.target.value)} required /></label>
          </>
        )}
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{isNew ? "Add product" : "Save changes"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ===== New product requests tab =====
// Finds purchase requests whose item notes start with "NEW PRODUCT REQUEST"
// and shows each one as a card with its image, reference link and approval status.
function RequestsTab({ can, notify }) {
  const [requesting, setRequesting] = useState(false);
  const requests = useFetch(() => purchaseApi.list({ page: 1, page_size: 100 }), []);
  const products = useFetch(() => productsApi.list({ page: 1, page_size: 100 }), []);

  const isActive = (productId) => (products.data?.items || []).find((p) => p.product_id === productId)?.is_active;
  const cards = [];
  (requests.data?.items || []).forEach((pr) => {
    pr.items.forEach((item) => {
      const info = readProductRequestNote(item.notes);
      if (info) cards.push({ pr, item, info });
    });
  });

  // ===== After approval: switch the product on with PUT /products/{id} =====
  async function goLive(card) {
    try {
      await productsApi.update(card.item.product_id, { is_active: true });
      notify(card.item.product_name + " is now live in the catalogue");
      products.reload();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <p className="muted">New products go to a manager for approval with a reference link and image. Approved products can then be made live.</p>
          {can.requestNewProduct && <button className="btn btn-primary push-right" onClick={() => setRequesting(true)}><Sparkles size={16} /> Request new product</button>}
        </div>
      </div>
      {(requests.loading || products.loading) && <Loading />}
      {requests.error && <ErrorBox message={requests.error} onRetry={requests.reload} />}
      {requests.data && cards.length === 0 && <Empty text="No new-product requests yet." />}
      <div className="request-grid">
        {cards.map((card) => {
          const live = isActive(card.item.product_id);
          const stage = card.pr.approval_status === "Approved" ? (live ? "Active" : "Ready to go live") : card.pr.approval_status === "Rejected" ? "Rejected" : "Awaiting approval";
          return (
            <article key={card.item.pr_item_id} className="request-card">
              <ProductImage url={card.info.imageUrl} />
              <div className="request-body">
                <div className="request-top"><span className="muted small">PR-{card.pr.pr_id} · {formatDate(card.pr.request_date)}</span><StatusBadge status={stage} /></div>
                <h4>{card.item.product_name}</h4>
                <p className="muted small">{card.info.reason}</p>
                <div className="request-meta">
                  <span>{card.item.quantity} units</span>
                  <span>{formatMoney(card.item.estimated_price)} each</span>
                </div>
                <a className="ref-link" href={card.info.referenceLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open reference</a>
                {stage === "Ready to go live" && can.editProduct && (
                  <button className="btn btn-success" onClick={() => goLive(card)}><Rocket size={15} /> Make product live</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {requesting && <NewProductRequestForm notify={notify} onClose={() => setRequesting(false)} onSaved={() => { setRequesting(false); requests.reload(); products.reload(); }} />}
    </>
  );
}
