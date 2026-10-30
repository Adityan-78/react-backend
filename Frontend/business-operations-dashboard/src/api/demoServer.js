// DEMO BACKEND — used only when VITE_DEMO_MODE=true.
// It pretends to be the FastAPI server: same URLs, same JSON shapes, same rules,
// but the data lives in memory in the browser. Handy for trying the app without
// a database. In real use (VITE_DEMO_MODE=false) this file is never called.

// ===== Small helpers =====
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const now = () => new Date().toISOString();
const money = (n) => Number(n).toFixed(2); // the API sends money as text, e.g. "125.50"
const nextId = (rows, key) => (rows.length ? Math.max(...rows.map((r) => r[key])) + 1 : 1);
const ok = (body, status = 200) => ({ status, body });
const fail = (status, detail) => ({ status, body: { detail } });

// ===== Sample data (same tables as the real database) =====
const db = {
  roles: [
    { role_id: 1, role_name: "admin", description: "Manages users, roles and access" },
    { role_id: 2, role_name: "manager", description: "Assigns tasks and approves purchases" },
    { role_id: 3, role_name: "sales", description: "Creates and tracks customer orders" },
    { role_id: 4, role_name: "inventory", description: "Manages stock and purchase requests" },
    { role_id: 5, role_name: "employee", description: "Works on tasks and reports issues" },
  ],
  users: [
    { user_id: 1, role_id: 1, name: "Ananya Rao", email: "admin@demo.com", password: "Admin123", is_active: true, created_at: day(-400) + "T09:00:00" },
    { user_id: 2, role_id: 2, name: "Vikram Mehta", email: "manager@demo.com", password: "Manager123", is_active: true, created_at: day(-380) + "T09:00:00" },
    { user_id: 3, role_id: 3, name: "Priya Sharma", email: "sales@demo.com", password: "Sales123", is_active: true, created_at: day(-300) + "T09:00:00" },
    { user_id: 4, role_id: 4, name: "Rahul Verma", email: "inventory@demo.com", password: "Inventory123", is_active: true, created_at: day(-290) + "T09:00:00" },
    { user_id: 5, role_id: 5, name: "Sneha Iyer", email: "employee@demo.com", password: "Employee123", is_active: true, created_at: day(-200) + "T09:00:00" },
    { user_id: 6, role_id: 5, name: "Arjun Nair", email: "arjun@demo.com", password: "Arjun123", is_active: true, created_at: day(-150) + "T09:00:00" },
    { user_id: 7, role_id: 5, name: "Meera Joshi", email: "meera@demo.com", password: "Meera123", is_active: true, created_at: day(-90) + "T09:00:00" },
  ],
  employees: [
    { employee_id: 1, user_id: 1, designation: "System Administrator", department: "IT", phone: "98450 11001", hire_date: day(-400), is_active: true },
    { employee_id: 2, user_id: 2, designation: "Operations Manager", department: "Operations", phone: "98450 11002", hire_date: day(-380), is_active: true },
    { employee_id: 3, user_id: 3, designation: "Sales Executive", department: "Sales", phone: "98450 11003", hire_date: day(-300), is_active: true },
    { employee_id: 4, user_id: 4, designation: "Inventory Executive", department: "Warehouse", phone: "98450 11004", hire_date: day(-290), is_active: true },
    { employee_id: 5, user_id: 5, designation: "Operations Associate", department: "Operations", phone: "98450 11005", hire_date: day(-200), is_active: true },
    { employee_id: 6, user_id: 6, designation: "Logistics Associate", department: "Operations", phone: "98450 11006", hire_date: day(-150), is_active: true },
    { employee_id: 7, user_id: 7, designation: "Support Associate", department: "Operations", phone: "98450 11007", hire_date: day(-90), is_active: true },
  ],
  customers: [
    { customer_id: 1, name: "Sunrise Retail Pvt Ltd", email: "orders@sunrise.in", phone: "080 4011 2233", address: "Bengaluru", created_at: day(-250) + "T10:00:00", is_active: true },
    { customer_id: 2, name: "GreenLeaf Stores", email: "buy@greenleaf.in", phone: "044 2233 4455", address: "Chennai", created_at: day(-210) + "T10:00:00", is_active: true },
    { customer_id: 3, name: "Metro Office Supplies", email: "po@metrooffice.in", phone: "022 6677 8899", address: "Mumbai", created_at: day(-120) + "T10:00:00", is_active: true },
    { customer_id: 4, name: "Coastal Traders", email: "hello@coastal.in", phone: "0484 233 4411", address: "Kochi", created_at: day(-60) + "T10:00:00", is_active: true },
  ],
  products: [
    { product_id: 1, name: "A4 Copier Paper", description: "[Stationery] 75 GSM, 500 sheets", unit_measure: "Ream", is_active: true },
    { product_id: 2, name: "Ballpoint Pens", description: "[Stationery] Blue ink, box of 50", unit_measure: "Box", is_active: true },
    { product_id: 3, name: "Printer Toner", description: "[Printing Supplies] Black, 2,000 pages", unit_measure: "Cartridge", is_active: true },
    { product_id: 4, name: "Office Chair", description: "[Office Furniture] Ergonomic mesh chair", unit_measure: "Piece", is_active: true },
    { product_id: 5, name: "Stapler", description: "[Stationery] Heavy duty, 50 sheets", unit_measure: "Piece", is_active: true },
    { product_id: 6, name: "Wireless Mouse", description: "[IT Accessories] 2.4 GHz, USB receiver", unit_measure: "Piece", is_active: true },
    { product_id: 7, name: "Hand Sanitiser 500ml", description: "[Cleaning & Hygiene] 70% alcohol", unit_measure: "Bottle", is_active: true },
    { product_id: 8, name: "Packing Tape", description: "[Packaging] 48 mm x 65 m, brown", unit_measure: "Roll", is_active: true },
    { product_id: 9, name: "Standing Desk", description: "[Office Furniture] Electric height adjustable", unit_measure: "Piece", is_active: false },
  ],
  inventory: [
    { inventory_id: 1, product_id: 1, quantity_in_stock: 340, reorder_level: 100, last_updated: day(-2) },
    { inventory_id: 2, product_id: 2, quantity_in_stock: 12, reorder_level: 30, last_updated: day(-5) },
    { inventory_id: 3, product_id: 3, quantity_in_stock: 6, reorder_level: 15, last_updated: day(-1) },
    { inventory_id: 4, product_id: 4, quantity_in_stock: 45, reorder_level: 10, last_updated: day(-9) },
    { inventory_id: 5, product_id: 5, quantity_in_stock: 0, reorder_level: 20, last_updated: day(-3) },
    { inventory_id: 6, product_id: 6, quantity_in_stock: 64, reorder_level: 25, last_updated: day(-4) },
    { inventory_id: 7, product_id: 7, quantity_in_stock: 18, reorder_level: 40, last_updated: day(-6) },
    { inventory_id: 8, product_id: 8, quantity_in_stock: 150, reorder_level: 50, last_updated: day(-8) },
    { inventory_id: 9, product_id: 9, quantity_in_stock: 0, reorder_level: 2, last_updated: day(-2) },
  ],
  orders: [],
  tasks: [
    { task_id: 1, assigned_to: 5, assigned_by: 2, title: "Prepare monthly stock report", description: "Summarise stock movement for the month.", status: "In Progress", priority: "High", due_date: day(2), created_at: day(-5) + "T09:00:00", updated_at: day(-1) + "T12:00:00" },
    { task_id: 2, assigned_to: 5, assigned_by: 2, title: "Call Sunrise Retail about delivery", description: "Confirm delivery slot for order #1001.", status: "Completed", priority: "Medium", due_date: day(-6), created_at: day(-10) + "T09:00:00", updated_at: day(-7) + "T15:00:00" },
    { task_id: 3, assigned_to: 6, assigned_by: 2, title: "Arrange transport for order #1003", description: "Book a truck to Mumbai.", status: "Pending", priority: "Critical", due_date: day(-1), created_at: day(-4) + "T09:00:00", updated_at: day(-4) + "T09:00:00" },
    { task_id: 4, assigned_to: 7, assigned_by: 2, title: "Update customer contact list", description: "Verify phone numbers of all customers.", status: "In Progress", priority: "Low", due_date: day(6), created_at: day(-3) + "T09:00:00", updated_at: day(-2) + "T09:00:00" },
    { task_id: 5, assigned_to: 5, assigned_by: 2, title: "Audit damaged goods shelf", description: "List damaged items and photograph them.", status: "Pending", priority: "Medium", due_date: day(-3), created_at: day(-9) + "T09:00:00", updated_at: day(-9) + "T09:00:00" },
    { task_id: 6, assigned_to: 6, assigned_by: 2, title: "Label new warehouse racks", description: "Print and stick rack labels A1–A20.", status: "Completed", priority: "Low", due_date: day(-2), created_at: day(-8) + "T09:00:00", updated_at: day(-3) + "T09:00:00" },
    { task_id: 7, assigned_to: 7, assigned_by: 2, title: "Reply to pending support emails", description: "Clear the shared inbox.", status: "Pending", priority: "High", due_date: day(1), created_at: day(-1) + "T09:00:00", updated_at: day(-1) + "T09:00:00" },
  ],
  issues: [
    { issue_id: 1, raised_by: 5, title: "Barcode scanner not working", description: "Scanner at packing desk 2 does not read labels.", status: "Open", created_at: day(-3) + "T10:00:00", updated_at: day(-3) + "T10:00:00" },
    { issue_id: 2, raised_by: 6, title: "Forklift battery weak", description: "Needs charging every 2 hours.", status: "In Progress", created_at: day(-6) + "T10:00:00", updated_at: day(-2) + "T10:00:00" },
    { issue_id: 3, raised_by: 5, title: "Leaking roof near Rack B", description: "Water dripping during rain.", status: "Resolved", created_at: day(-15) + "T10:00:00", updated_at: day(-8) + "T10:00:00" },
    { issue_id: 4, raised_by: 4, title: "Loading bay light broken", description: "Bay 3 is dark after 6 pm.", status: "Open", created_at: day(-1) + "T10:00:00", updated_at: day(-1) + "T10:00:00" },
  ],
  prs: [],
};

// Orders and purchase requests are built with helpers so totals are always right.
function seedOrder(id, customerId, offset, status, lines, notes) {
  db.orders.push({
    order_id: id, customer_id: customerId, order_date: day(offset), status, notes,
    items: lines.map(([productId, qty, price], i) => ({ order_item_id: id * 10 + i, product_id: productId, quantity: qty, unit_price: price })),
  });
}
seedOrder(1001, 1, -26, "Delivered", [[1, 100, 240], [2, 20, 180]], "Quarterly paper supply");
seedOrder(1002, 2, -21, "Delivered", [[6, 15, 650]], "Mice for new hires");
seedOrder(1003, 3, -15, "Shipped", [[4, 20, 6300]], "20 office chairs");
seedOrder(1004, 1, -11, "Confirmed", [[3, 4, 3850]], "Toner cartridges");
seedOrder(1005, 4, -7, "Pending", [[5, 10, 350], [8, 30, 95]], "Staplers and tape – urgent");
seedOrder(1006, 2, -5, "Cancelled", [[7, 20, 260]], "Customer changed vendor");
seedOrder(1007, 3, -3, "Pending", [[1, 50, 240]], "Paper top-up");
seedOrder(1008, 1, -1, "Confirmed", [[6, 8, 650], [2, 10, 180]], "Branch office kit");

function seedPR(id, offset, status, approval, items, reason = null) {
  db.prs.push({
    pr_id: id, raised_by: 4, request_date: day(offset), status, approval_status: approval, rejection_reason: reason,
    items: items.map(([productId, qty, price, notes], i) => ({
      pr_item_id: id * 10 + i, pr_id: id, product_id: productId, quantity: qty, estimated_price: price, notes,
      approval_id: approval === "Pending" ? null : 2, approved_date: approval === "Pending" ? null : day(offset + 2), status: approval,
    })),
  });
}
seedPR(1, -5, "Pending", "Pending", [[3, 40, 2200, "Toner running out"]]);
seedPR(2, -1, "Pending", "Pending", [[5, 30, 350, "Out of stock"], [2, 50, 180, "Below reorder level"]]);
seedPR(3, -14, "Completed", "Approved", [[1, 200, 240, "Bulk discount offer"]]);
seedPR(4, -18, "Closed", "Rejected", [[4, 50, 6300, "New floor seating"]], "Budget not approved this quarter");
seedPR(5, -2, "Pending", "Pending", [[9, 5, 32000,
  "NEW PRODUCT REQUEST | ref: https://www.ikea.com/in/en/cat/standing-desks-55008/ | img: https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400 | Staff asked for 5 sit-stand desks for the design team"]]);

// ===== Turning stored rows into the API's response shapes =====
const userOf = (id) => db.users.find((u) => u.user_id === id);
const roleOf = (id) => db.roles.find((r) => r.role_id === id);
const employeeOf = (id) => db.employees.find((e) => e.employee_id === id);
const productOf = (id) => db.products.find((p) => p.product_id === id);
const stockOf = (productId) => db.inventory.find((i) => i.product_id === productId);
const nameOfEmployee = (id) => userOf(employeeOf(id).user_id).name;

const userOut = (u) => ({ user_id: u.user_id, name: u.name, email: u.email, role_id: u.role_id, role: roleOf(u.role_id).role_name, is_active: u.is_active, created_at: u.created_at });
const employeeOut = (e) => {
  const u = userOf(e.user_id);
  return { ...e, name: u.name, email: u.email, role: roleOf(u.role_id).role_name };
};
const inventoryOut = (i) => {
  const p = productOf(i.product_id);
  return { ...i, product_name: p.name, unit_measure: p.unit_measure, is_low_stock: i.quantity_in_stock <= i.reorder_level };
};
const orderOut = (o) => {
  const items = o.items.map((it) => ({ ...it, product_name: productOf(it.product_id).name, unit_price: money(it.unit_price), line_total: money(it.quantity * it.unit_price) }));
  const total = o.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const c = db.customers.find((x) => x.customer_id === o.customer_id);
  return { order_id: o.order_id, customer_id: o.customer_id, customer_name: c.name, order_date: o.order_date, status: o.status, total_amount: money(total), notes: o.notes, items };
};
const taskOut = (t) => ({
  ...t, assigned_to_name: nameOfEmployee(t.assigned_to), assigned_by_name: nameOfEmployee(t.assigned_by),
  is_overdue: t.status !== "Completed" && !!t.due_date && t.due_date < day(0),
});
const issueOut = (i) => ({ ...i, raised_by_name: nameOfEmployee(i.raised_by) });
const prOut = (pr) => {
  const items = pr.items.map((it) => ({ ...it, product_name: productOf(it.product_id).name, estimated_price: it.estimated_price == null ? null : money(it.estimated_price) }));
  const total = pr.items.reduce((s, it) => s + it.quantity * (it.estimated_price || 0), 0);
  return { pr_id: pr.pr_id, raised_by: pr.raised_by, raised_by_name: nameOfEmployee(pr.raised_by), request_date: pr.request_date, status: pr.status, approval_status: pr.approval_status, rejection_reason: pr.rejection_reason, total_estimated: money(total), items };
};

// The common pagination envelope: { items, total, page, page_size }
function page(rows, q, mapper) {
  const p = Math.max(1, Number(q.page || 1));
  const size = Math.min(100, Math.max(1, Number(q.page_size || 20)));
  return ok({ items: rows.slice((p - 1) * size, p * size).map(mapper), total: rows.length, page: p, page_size: size });
}
const countBy = (rows, key) => rows.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] || 0) + 1 }), {});
const search = (text, ...fields) => !text || fields.some((f) => (f || "").toLowerCase().includes(text.toLowerCase()));

// ===== Dashboard summaries =====
function orderSummary() {
  const revenue = db.orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + o.items.reduce((a, it) => a + it.quantity * it.unit_price, 0), 0);
  return { total: db.orders.length, by_status: countBy(db.orders, "status"), revenue: money(revenue) };
}
function stockSummary() {
  const low = db.inventory.filter((i) => productOf(i.product_id).is_active && i.quantity_in_stock <= i.reorder_level)
    .sort((a, b) => a.quantity_in_stock - b.quantity_in_stock);
  return {
    total_products: db.products.filter((p) => p.is_active).length, low_stock_count: low.length,
    low_stock_items: low.slice(0, 5).map((i) => ({ product_id: i.product_id, product_name: productOf(i.product_id).name, quantity_in_stock: i.quantity_in_stock, reorder_level: i.reorder_level })),
  };
}
const taskSummary = () => ({ total: db.tasks.length, by_status: countBy(db.tasks, "status"), overdue: db.tasks.map(taskOut).filter((t) => t.is_overdue).length });
const issueSummary = () => ({ total: db.issues.length, by_status: countBy(db.issues, "status"), open: db.issues.filter((i) => i.status === "Open" || i.status === "In Progress").length });
const prSummary = () => ({ total: db.prs.length, by_approval_status: countBy(db.prs, "approval_status"), pending_approval: db.prs.filter((p) => p.approval_status === "Pending").length });

// ===== Business rules (mirroring the backend) =====
const ORDER_FLOW = { Pending: ["Confirmed", "Cancelled"], Confirmed: ["Shipped", "Cancelled"], Shipped: ["Delivered"] };

function validateLines(items, needPrice) {
  if (!Array.isArray(items) || items.length === 0) return "items: at least one item is required";
  const ids = items.map((i) => Number(i.product_id));
  if (new Set(ids).size !== ids.length) return "items: a product may appear only once";
  for (const it of items) {
    if (!(Number(it.quantity) > 0)) return "quantity must be greater than 0";
    if (needPrice && !(Number(it.unit_price) >= 0)) return "unit_price must be 0 or more";
    if (!productOf(Number(it.product_id))) return "Product " + it.product_id + " not found";
  }
  return null;
}

// ===== The routes: [method, URL pattern, allowed roles (null = any logged-in), handler] =====
const A = "admin", M = "manager", S = "sales", I = "inventory", E = "employee";
const routes = [
  ["GET", /^\/auth\/me$/, null, ({ user }) => ok({ user_id: user.user_id, name: user.name, email: user.email, role: roleOf(user.role_id).role_name })],
  ["GET", /^\/roles$/, [A], () => ok(db.roles)],

  // Users
  ["GET", /^\/users$/, [A], ({ q }) => page(db.users.filter((u) =>
    (!q.role || roleOf(u.role_id).role_name === q.role) && (q.is_active === undefined || String(u.is_active) === q.is_active) && search(q.search, u.name, u.email)), q, userOut)],
  ["GET", /^\/users\/(\d+)$/, [A], ({ id }) => (userOf(id) ? ok(userOut(userOf(id))) : fail(404, "User not found"))],
  ["POST", /^\/users$/, [A], ({ body }) => {
    if (!body.name || !body.email || !body.password || !body.role_id) return fail(422, "name, email, password and role_id are required");
    if (!/[A-Za-z]/.test(body.password) || !/\d/.test(body.password) || body.password.length < 8) return fail(422, "password: must be 8+ characters with a letter and a digit");
    if (db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) return fail(409, "The request conflicts with existing data");
    const u = { user_id: nextId(db.users, "user_id"), role_id: Number(body.role_id), name: body.name, email: body.email.toLowerCase(), password: body.password, is_active: true, created_at: now() };
    db.users.push(u);
    return ok(userOut(u), 201);
  }],
  ["PUT", /^\/users\/(\d+)$/, [A], ({ id, body }) => {
    const u = userOf(id); if (!u) return fail(404, "User not found");
    ["name", "email", "is_active", "password"].forEach((k) => { if (body[k] !== undefined && body[k] !== null) u[k] = body[k]; });
    return ok(userOut(u));
  }],
  ["PUT", /^\/users\/(\d+)\/role$/, [A], ({ id, body }) => {
    const u = userOf(id); if (!u) return fail(404, "User not found");
    if (!roleOf(Number(body.role_id))) return fail(400, "Unknown role");
    u.role_id = Number(body.role_id);
    return ok(userOut(u));
  }],
  ["DELETE", /^\/users\/(\d+)$/, [A], ({ id, user }) => {
    if (id === user.user_id) return fail(400, "You cannot deactivate your own account");
    const u = userOf(id); if (!u) return fail(404, "User not found");
    u.is_active = false; return ok(null, 204);
  }],

  // Employees
  ["GET", /^\/employees$/, [A, M], ({ q }) => page(db.employees.filter((e) =>
    (!q.department || e.department === q.department) && (q.is_active === undefined || String(e.is_active) === q.is_active) && search(q.search, userOf(e.user_id).name, e.designation)), q, employeeOut)],
  ["GET", /^\/employees\/(\d+)\/tasks$/, [A, M], ({ id, q }) => page(db.tasks.filter((t) => t.assigned_to === id && (!q.status || t.status === q.status)), q, taskOut)],
  ["GET", /^\/employees\/(\d+)$/, [A, M], ({ id }) => (employeeOf(id) ? ok(employeeOut(employeeOf(id))) : fail(404, "Employee not found"))],
  ["POST", /^\/employees$/, [A], ({ body }) => {
    if (!userOf(Number(body.user_id))) return fail(404, "User not found");
    if (db.employees.some((e) => e.user_id === Number(body.user_id))) return fail(409, "This user already has an employee profile");
    const e = { employee_id: nextId(db.employees, "employee_id"), user_id: Number(body.user_id), designation: body.designation || null, department: body.department || null, phone: body.phone || null, hire_date: body.hire_date || null, is_active: true };
    db.employees.push(e);
    return ok(employeeOut(e), 201);
  }],
  ["PUT", /^\/employees\/(\d+)$/, [A], ({ id, body }) => {
    const e = employeeOf(id); if (!e) return fail(404, "Employee not found");
    ["designation", "department", "phone", "hire_date", "is_active"].forEach((k) => { if (body[k] !== undefined) e[k] = body[k]; });
    return ok(employeeOut(e));
  }],
  ["DELETE", /^\/employees\/(\d+)$/, [A], ({ id }) => { const e = employeeOf(id); if (!e) return fail(404, "Employee not found"); e.is_active = false; return ok(null, 204); }],

  // Customers
  ["GET", /^\/customers$/, [A, S], ({ q }) => page(db.customers.filter((c) => (q.include_inactive === "true" || c.is_active) && search(q.search, c.name, c.email, c.address)), q, (c) => c)],
  ["GET", /^\/customers\/(\d+)\/orders$/, [S, M], ({ id, q }) => page(db.orders.filter((o) => o.customer_id === id).sort((a, b) => b.order_id - a.order_id), q, orderOut)],
  ["GET", /^\/customers\/(\d+)$/, [A, S], ({ id }) => { const c = db.customers.find((x) => x.customer_id === id); return c ? ok(c) : fail(404, "Customer not found"); }],
  ["POST", /^\/customers$/, [S], ({ body }) => {
    if (!body.name) return fail(422, "name: field required");
    const c = { customer_id: nextId(db.customers, "customer_id"), name: body.name, email: body.email || null, phone: body.phone || null, address: body.address || null, created_at: now(), is_active: true };
    db.customers.push(c); return ok(c, 201);
  }],
  ["PUT", /^\/customers\/(\d+)$/, [S, A], ({ id, body }) => {
    const c = db.customers.find((x) => x.customer_id === id); if (!c) return fail(404, "Customer not found");
    ["name", "email", "phone", "address", "is_active"].forEach((k) => { if (body[k] !== undefined && body[k] !== null) c[k] = body[k]; });
    return ok(c);
  }],
  ["DELETE", /^\/customers\/(\d+)$/, [A], ({ id }) => { const c = db.customers.find((x) => x.customer_id === id); if (!c) return fail(404, "Customer not found"); c.is_active = false; return ok(null, 204); }],

  // Products
  ["GET", /^\/products$/, [A, M, S, I], ({ q }) => page(db.products.filter((p) => (q.is_active === undefined || String(p.is_active) === q.is_active) && search(q.search, p.name, p.description)), q, (p) => p)],
  ["GET", /^\/products\/active$/, [S, I], ({ q }) => page(db.products.filter((p) => p.is_active && search(q.search, p.name, p.description)), q, (p) => p)],
  ["GET", /^\/products\/(\d+)\/availability$/, [S], ({ id, q }) => {
    const p = productOf(id); if (!p) return fail(404, "Product not found");
    const requested = Number(q.quantity || 1); const available = stockOf(id)?.quantity_in_stock || 0;
    return ok({ product_id: id, product_name: p.name, is_active: p.is_active, requested, available, is_available: p.is_active && available >= requested });
  }],
  ["GET", /^\/products\/(\d+)$/, [A, M, S, I], ({ id }) => (productOf(id) ? ok(productOf(id)) : fail(404, "Product not found"))],
  ["POST", /^\/products$/, [A, I], ({ body }) => {
    if (!body.name) return fail(422, "name: field required");
    if (db.products.some((p) => p.name.toLowerCase() === body.name.toLowerCase())) return fail(409, "The request conflicts with existing data");
    const p = { product_id: nextId(db.products, "product_id"), name: body.name, description: body.description || null, unit_measure: body.unit_measure || null, is_active: true };
    db.products.push(p);
    db.inventory.push({ inventory_id: nextId(db.inventory, "inventory_id"), product_id: p.product_id, quantity_in_stock: Number(body.initial_stock || 0), reorder_level: Number(body.reorder_level || 0), last_updated: day(0) });
    return ok(p, 201);
  }],
  ["PUT", /^\/products\/(\d+)$/, [A, I], ({ id, body }) => {
    const p = productOf(id); if (!p) return fail(404, "Product not found");
    ["name", "description", "unit_measure", "is_active"].forEach((k) => { if (body[k] !== undefined && body[k] !== null) p[k] = body[k]; });
    return ok(p);
  }],
  ["DELETE", /^\/products\/(\d+)$/, [A, I], ({ id }) => { const p = productOf(id); if (!p) return fail(404, "Product not found"); p.is_active = false; return ok(null, 204); }],

  // Inventory
  ["GET", /^\/inventory$/, [A, I, S], ({ q }) => page(db.inventory.map(inventoryOut).filter((i) => (q.low_only !== "true" || i.is_low_stock) && search(q.search, i.product_name)), q, (i) => i)],
  ["GET", /^\/inventory\/low-stock$/, [A, I], ({ q }) => page(db.inventory.map(inventoryOut).filter((i) => i.is_low_stock), q, (i) => i)],
  ["GET", /^\/inventory\/(\d+)$/, [A, I, S], ({ id }) => (stockOf(id) ? ok(inventoryOut(stockOf(id))) : fail(404, "Inventory record not found"))],
  ["PUT", /^\/inventory\/(\d+)$/, [I], ({ id, body }) => {
    const s = stockOf(id); if (!s) return fail(404, "Inventory record not found");
    if (body.quantity_in_stock == null && body.reorder_level == null) return fail(422, "Provide quantity_in_stock or reorder_level");
    if (body.quantity_in_stock != null) s.quantity_in_stock = Number(body.quantity_in_stock);
    if (body.reorder_level != null) s.reorder_level = Number(body.reorder_level);
    s.last_updated = day(0); return ok(inventoryOut(s));
  }],
  ["POST", /^\/inventory\/(\d+)\/add$/, [I], ({ id, body }) => {
    const s = stockOf(id); if (!s) return fail(404, "Inventory record not found");
    if (!(Number(body.quantity) > 0)) return fail(422, "quantity must be greater than 0");
    s.quantity_in_stock += Number(body.quantity); s.last_updated = day(0); return ok(inventoryOut(s));
  }],
  ["POST", /^\/inventory\/(\d+)\/reduce$/, [I], ({ id, body }) => {
    const s = stockOf(id); if (!s) return fail(404, "Inventory record not found");
    if (!(Number(body.quantity) > 0)) return fail(422, "quantity must be greater than 0");
    if (Number(body.quantity) > s.quantity_in_stock) return fail(400, "Not enough stock: only " + s.quantity_in_stock + " available");
    s.quantity_in_stock -= Number(body.quantity); s.last_updated = day(0); return ok(inventoryOut(s));
  }],

  // Orders
  ["GET", /^\/orders$/, [A, M, S], ({ q }) => page(db.orders.filter((o) =>
    (!q.status || o.status === q.status) && (!q.customer_id || o.customer_id === Number(q.customer_id)) &&
    (!q.date_from || o.order_date >= q.date_from) && (!q.date_to || o.order_date <= q.date_to)).sort((a, b) => b.order_id - a.order_id), q, orderOut)],
  ["GET", /^\/orders\/(\d+)$/, [A, M, S], ({ id }) => { const o = db.orders.find((x) => x.order_id === id); return o ? ok(orderOut(o)) : fail(404, "Order not found"); }],
  ["POST", /^\/orders$/, [S], ({ body }) => {
    const c = db.customers.find((x) => x.customer_id === Number(body.customer_id));
    if (!c || !c.is_active) return fail(400, "Customer not found or inactive");
    const problem = validateLines(body.items, true); if (problem) return fail(422, problem);
    for (const it of body.items) {
      const p = productOf(Number(it.product_id)); const stock = stockOf(p.product_id).quantity_in_stock;
      if (!p.is_active) return fail(400, p.name + " is not active");
      if (Number(it.quantity) > stock) return fail(400, "Not enough stock for " + p.name + " (available " + stock + ")");
    }
    const id = nextId(db.orders, "order_id");
    const o = { order_id: id, customer_id: c.customer_id, order_date: body.order_date || day(0), status: "Pending", notes: body.notes || null,
      items: body.items.map((it, i) => ({ order_item_id: id * 10 + i, product_id: Number(it.product_id), quantity: Number(it.quantity), unit_price: Number(it.unit_price) })) };
    db.orders.push(o); return ok(orderOut(o), 201);
  }],
  ["PUT", /^\/orders\/(\d+)$/, [S], ({ id, body }) => {
    const o = db.orders.find((x) => x.order_id === id); if (!o) return fail(404, "Order not found");
    if (o.status !== "Pending") return fail(409, "Only Pending orders can be edited");
    if (body.items) {
      const problem = validateLines(body.items, true); if (problem) return fail(422, problem);
      o.items = body.items.map((it, i) => ({ order_item_id: id * 10 + i, product_id: Number(it.product_id), quantity: Number(it.quantity), unit_price: Number(it.unit_price) }));
    }
    if (body.notes !== undefined) o.notes = body.notes;
    if (body.order_date) o.order_date = body.order_date;
    return ok(orderOut(o));
  }],
  ["PUT", /^\/orders\/(\d+)\/status$/, [S, M], ({ id, body }) => {
    const o = db.orders.find((x) => x.order_id === id); if (!o) return fail(404, "Order not found");
    if (!(ORDER_FLOW[o.status] || []).includes(body.status)) return fail(409, "Cannot move an order from " + o.status + " to " + body.status);
    if (body.status === "Confirmed") {
      for (const it of o.items) if (stockOf(it.product_id).quantity_in_stock < it.quantity) return fail(409, "Not enough stock for " + productOf(it.product_id).name);
      o.items.forEach((it) => { stockOf(it.product_id).quantity_in_stock -= it.quantity; });
    }
    if (body.status === "Cancelled" && o.status === "Confirmed") o.items.forEach((it) => { stockOf(it.product_id).quantity_in_stock += it.quantity; });
    o.status = body.status; return ok(orderOut(o));
  }],
  ["PUT", /^\/orders\/(\d+)\/cancel$/, [S, M], ({ id }) => {
    const o = db.orders.find((x) => x.order_id === id); if (!o) return fail(404, "Order not found");
    if (!(ORDER_FLOW[o.status] || []).includes("Cancelled")) return fail(409, "This order can no longer be cancelled");
    if (o.status === "Confirmed") o.items.forEach((it) => { stockOf(it.product_id).quantity_in_stock += it.quantity; });
    o.status = "Cancelled"; return ok(orderOut(o));
  }],

  // Tasks
  ["GET", /^\/tasks$/, [A, M], ({ q }) => page(db.tasks.filter((t) => (!q.assigned_to || t.assigned_to === Number(q.assigned_to)) && (!q.status || t.status === q.status) && (!q.priority || t.priority === q.priority)).sort((a, b) => b.task_id - a.task_id), q, taskOut)],
  ["GET", /^\/tasks\/my$/, null, ({ q, emp }) => (emp ? page(db.tasks.filter((t) => t.assigned_to === emp.employee_id && (!q.status || t.status === q.status)), q, taskOut) : fail(403, "No active employee profile"))],
  ["GET", /^\/tasks\/overdue$/, [A, M], ({ q }) => page(db.tasks.map(taskOut).filter((t) => t.is_overdue && (!q.assigned_to || t.assigned_to === Number(q.assigned_to))), q, (t) => t)],
  ["GET", /^\/tasks\/(\d+)$/, null, ({ id }) => { const t = db.tasks.find((x) => x.task_id === id); return t ? ok(taskOut(t)) : fail(404, "Task not found"); }],
  ["POST", /^\/tasks$/, [M], ({ body, emp }) => {
    if (!emp) return fail(403, "Manager needs an active employee profile");
    if (!employeeOf(Number(body.assigned_to))) return fail(404, "Employee not found");
    if (!body.title) return fail(422, "title: field required");
    const t = { task_id: nextId(db.tasks, "task_id"), assigned_to: Number(body.assigned_to), assigned_by: emp.employee_id, title: body.title, description: body.description || null, status: "Pending", priority: body.priority || "Medium", due_date: body.due_date || null, created_at: now(), updated_at: now() };
    db.tasks.push(t); return ok(taskOut(t), 201);
  }],
  ["PUT", /^\/tasks\/(\d+)$/, [M], ({ id, body }) => {
    const t = db.tasks.find((x) => x.task_id === id); if (!t) return fail(404, "Task not found");
    ["assigned_to", "title", "description", "priority", "due_date"].forEach((k) => { if (body[k] !== undefined && body[k] !== null) t[k] = k === "assigned_to" ? Number(body[k]) : body[k]; });
    t.updated_at = now(); return ok(taskOut(t));
  }],
  ["PUT", /^\/tasks\/(\d+)\/status$/, null, ({ id, body, user, emp }) => {
    const t = db.tasks.find((x) => x.task_id === id); if (!t) return fail(404, "Task not found");
    const isManager = roleOf(user.role_id).role_name === "manager";
    if (!isManager && (!emp || t.assigned_to !== emp.employee_id)) return fail(403, "You can only update your own tasks");
    if (t.status === "Completed" && !isManager) return fail(409, "Only a manager can reopen a completed task");
    t.status = body.status; t.updated_at = now(); return ok(taskOut(t));
  }],

  // Issues
  ["GET", /^\/issues$/, [A, M], ({ q }) => page(db.issues.filter((i) => !q.status || i.status === q.status).sort((a, b) => b.issue_id - a.issue_id), q, issueOut)],
  ["GET", /^\/issues\/my$/, null, ({ q, emp }) => (emp ? page(db.issues.filter((i) => i.raised_by === emp.employee_id).sort((a, b) => b.issue_id - a.issue_id), q, issueOut) : fail(403, "No active employee profile"))],
  ["GET", /^\/issues\/(\d+)$/, null, ({ id }) => { const i = db.issues.find((x) => x.issue_id === id); return i ? ok(issueOut(i)) : fail(404, "Issue not found"); }],
  ["POST", /^\/issues$/, null, ({ body, emp }) => {
    if (!emp) return fail(403, "No active employee profile");
    if (!body.title) return fail(422, "title: field required");
    const i = { issue_id: nextId(db.issues, "issue_id"), raised_by: emp.employee_id, title: body.title, description: body.description || null, status: "Open", created_at: now(), updated_at: now() };
    db.issues.push(i); return ok(issueOut(i), 201);
  }],
  ["PUT", /^\/issues\/(\d+)$/, [A, M], ({ id, body }) => { const i = db.issues.find((x) => x.issue_id === id); if (!i) return fail(404, "Issue not found"); if (body.title) i.title = body.title; if (body.description !== undefined) i.description = body.description; i.updated_at = now(); return ok(issueOut(i)); }],
  ["PUT", /^\/issues\/(\d+)\/status$/, [A, M], ({ id, body }) => { const i = db.issues.find((x) => x.issue_id === id); if (!i) return fail(404, "Issue not found"); i.status = body.status; i.updated_at = now(); return ok(issueOut(i)); }],

  // Purchase requests
  ["GET", /^\/purchase-requests$/, [A, M, I], ({ q }) => page(db.prs.filter((p) => (!q.status || p.status === q.status) && (!q.approval_status || p.approval_status === q.approval_status)).sort((a, b) => b.pr_id - a.pr_id), q, prOut)],
  ["GET", /^\/purchase-requests\/my$/, [I], ({ q, emp }) => page(db.prs.filter((p) => emp && p.raised_by === emp.employee_id).sort((a, b) => b.pr_id - a.pr_id), q, prOut)],
  ["GET", /^\/purchase-requests\/pending-approval$/, [M], ({ q }) => page(db.prs.filter((p) => p.approval_status === "Pending").sort((a, b) => a.pr_id - b.pr_id), q, prOut)],
  ["GET", /^\/purchase-requests\/(\d+)\/items$/, null, ({ id }) => { const p = db.prs.find((x) => x.pr_id === id); return p ? ok(prOut(p).items) : fail(404, "Purchase request not found"); }],
  ["GET", /^\/purchase-requests\/(\d+)$/, null, ({ id }) => { const p = db.prs.find((x) => x.pr_id === id); return p ? ok(prOut(p)) : fail(404, "Purchase request not found"); }],
  ["POST", /^\/purchase-requests$/, [I], ({ body, emp }) => {
    if (!emp) return fail(403, "No active employee profile");
    const items = body.items || [];
    if (items.length) { const problem = validateLines(items, false); if (problem) return fail(422, problem); }
    const id = nextId(db.prs, "pr_id");
    const pr = { pr_id: id, raised_by: emp.employee_id, request_date: body.request_date || day(0), status: "Pending", approval_status: "Pending", rejection_reason: null,
      items: items.map((it, i) => ({ pr_item_id: id * 10 + i, pr_id: id, product_id: Number(it.product_id), quantity: Number(it.quantity), estimated_price: it.estimated_price == null ? null : Number(it.estimated_price), notes: it.notes || null, approval_id: null, approved_date: null, status: "Pending" })) };
    db.prs.push(pr); return ok(prOut(pr), 201);
  }],
  ["PUT", /^\/purchase-requests\/(\d+)\/approve$/, [M], ({ id, emp }) => {
    const p = db.prs.find((x) => x.pr_id === id); if (!p) return fail(404, "Purchase request not found");
    if (p.approval_status !== "Pending") return fail(409, "This request has already been decided");
    if (!p.items.length) return fail(400, "A request with no items cannot be approved");
    p.approval_status = "Approved"; p.status = "In Progress";
    p.items.forEach((it) => { it.status = "Approved"; it.approval_id = emp?.employee_id || null; it.approved_date = day(0); });
    return ok(prOut(p));
  }],
  ["PUT", /^\/purchase-requests\/(\d+)\/reject$/, [M], ({ id, body, emp }) => {
    const p = db.prs.find((x) => x.pr_id === id); if (!p) return fail(404, "Purchase request not found");
    if (p.approval_status !== "Pending") return fail(409, "This request has already been decided");
    if (!body.reason || body.reason.length < 3) return fail(422, "reason: at least 3 characters");
    p.approval_status = "Rejected"; p.status = "Closed"; p.rejection_reason = body.reason;
    p.items.forEach((it) => { it.status = "Rejected"; it.approval_id = emp?.employee_id || null; it.approved_date = day(0); });
    return ok(prOut(p));
  }],
  ["PUT", /^\/purchase-requests\/(\d+)\/status$/, [M, I], ({ id, body }) => {
    const p = db.prs.find((x) => x.pr_id === id); if (!p) return fail(404, "Purchase request not found");
    if (p.approval_status !== "Approved") return fail(409, "Only approved requests can be completed or closed");
    if (body.status === "Completed" && p.status !== "In Progress") return fail(409, "Only In Progress requests can be completed");
    if (body.status === "Completed" && body.receive_stock) p.items.forEach((it) => { const s = stockOf(it.product_id); s.quantity_in_stock += it.quantity; s.last_updated = day(0); });
    p.status = body.status; return ok(prOut(p));
  }],
  ["PUT", /^\/purchase-requests\/(\d+)$/, null, ({ id, body }) => {
    const p = db.prs.find((x) => x.pr_id === id); if (!p) return fail(404, "Purchase request not found");
    if (p.approval_status !== "Pending") return fail(409, "Decided requests cannot be edited");
    if (body.request_date) p.request_date = body.request_date;
    if (body.items) p.items = body.items.map((it, i) => ({ pr_item_id: id * 10 + i, pr_id: id, product_id: Number(it.product_id), quantity: Number(it.quantity), estimated_price: it.estimated_price ?? null, notes: it.notes || null, approval_id: null, approved_date: null, status: "Pending" }));
    return ok(prOut(p));
  }],
  ["POST", /^\/purchase-requests\/(\d+)\/items$/, [I], ({ id, body }) => {
    const p = db.prs.find((x) => x.pr_id === id); if (!p) return fail(404, "Purchase request not found");
    if (p.approval_status !== "Pending") return fail(409, "Decided requests cannot be edited");
    if (p.items.some((it) => it.product_id === Number(body.product_id))) return fail(409, "This product is already in the request");
    p.items.push({ pr_item_id: nextId(db.prs.flatMap((x) => x.items), "pr_item_id"), pr_id: id, product_id: Number(body.product_id), quantity: Number(body.quantity), estimated_price: body.estimated_price ?? null, notes: body.notes || null, approval_id: null, approved_date: null, status: "Pending" });
    return ok(prOut(p), 201);
  }],
  ["PUT", /^\/purchase-request-items\/(\d+)$/, [I], ({ id, body }) => {
    const p = db.prs.find((x) => x.items.some((it) => it.pr_item_id === id)); if (!p) return fail(404, "Item not found");
    if (p.approval_status !== "Pending") return fail(409, "Decided requests cannot be edited");
    const it = p.items.find((x) => x.pr_item_id === id);
    ["quantity", "estimated_price", "notes"].forEach((k) => { if (body[k] !== undefined && body[k] !== null) it[k] = body[k]; });
    return ok(prOut(p));
  }],
  ["DELETE", /^\/purchase-request-items\/(\d+)$/, [I], ({ id }) => {
    const p = db.prs.find((x) => x.items.some((it) => it.pr_item_id === id)); if (!p) return fail(404, "Item not found");
    if (p.approval_status !== "Pending") return fail(409, "Decided requests cannot be edited");
    p.items = p.items.filter((it) => it.pr_item_id !== id); return ok(prOut(p));
  }],

  // Dashboards
  ["GET", /^\/dashboard\/summary$/, null, ({ user }) => ok({ user: userOut(user), metrics: {} })],
  ["GET", /^\/dashboard\/admin$/, [A], () => ok({
    users: { total: db.users.length, active: db.users.filter((u) => u.is_active).length, by_role: db.users.reduce((acc, u) => ({ ...acc, [roleOf(u.role_id).role_name]: (acc[roleOf(u.role_id).role_name] || 0) + 1 }), {}) },
    orders: orderSummary(), stock: stockSummary(), tasks: taskSummary(), issues: issueSummary(), purchase_requests: prSummary(),
  })],
  ["GET", /^\/dashboard\/manager$/, [M], () => ok({ tasks: taskSummary(), issues: issueSummary(), purchase_requests: prSummary(), orders: orderSummary() })],
  ["GET", /^\/dashboard\/sales$/, [S], () => ok({
    orders: orderSummary(), customers: { total: db.customers.length, active: db.customers.filter((c) => c.is_active).length },
    recent_orders: [...db.orders].sort((a, b) => b.order_id - a.order_id).slice(0, 5).map((o) => { const out = orderOut(o); return { order_id: out.order_id, customer_name: out.customer_name, order_date: out.order_date, status: out.status, total_amount: out.total_amount }; }),
  })],
  ["GET", /^\/dashboard\/inventory$/, [I], () => ok({ stock: stockSummary(), purchase_requests: prSummary() })],
];

// ===== The entry point apiFetch calls in demo mode =====
export async function demoRequest(method, fullPath, body = {}, token) {
  await new Promise((resolve) => setTimeout(resolve, 150)); // feel like a real network
  const [path, search = ""] = fullPath.split("?");
  const q = Object.fromEntries(new URLSearchParams(search));
  const copy = (x) => JSON.parse(JSON.stringify(x)); // never hand out the stored objects themselves

  if (method === "POST" && path === "/auth/login") {
    const u = db.users.find((x) => x.email.toLowerCase() === String(body.email).toLowerCase() && x.password === body.password);
    if (!u || !u.is_active) return fail(401, "Incorrect email or password");
    return ok({ access_token: "demo-token-" + u.user_id, token_type: "bearer", user: { user_id: u.user_id, name: u.name, email: u.email, role: roleOf(u.role_id).role_name } });
  }

  const user = token && token.startsWith("demo-token-") ? userOf(Number(token.slice(11))) : null;
  if (!user || !user.is_active) return fail(401, "Not authenticated");
  const emp = db.employees.find((e) => e.user_id === user.user_id && e.is_active);
  const role = roleOf(user.role_id).role_name;

  for (const [m, pattern, allowed, handler] of routes) {
    const match = path.match(pattern);
    if (m !== method || !match) continue;
    if (allowed && !allowed.includes(role)) return fail(403, "You do not have permission to do this");
    return copy(handler({ user, emp, q, body: body || {}, id: match[1] ? Number(match[1]) : null }));
  }
  return fail(404, "Not Found");
}
