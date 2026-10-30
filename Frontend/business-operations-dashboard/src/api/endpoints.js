// Every backend endpoint the app uses lives in this one file.
// All paths are relative to API_BASE (http://127.0.0.1:8000/api/v1).
// If the backend changes a URL, this is the only file to edit.
import { apiFetch, query } from "./client";

// ===== Authentication and roles =====
export const authApi = {
  login: (email, password) => apiFetch("/auth/login", { method: "POST", body: { email, password } }),
  me: () => apiFetch("/auth/me"),
  roles: () => apiFetch("/roles"), // admin only
};

// ===== Users (admin only) =====
export const usersApi = {
  list: (params) => apiFetch("/users" + query(params)), // role, is_active, search, page, page_size
  get: (userId) => apiFetch("/users/" + userId),
  create: (data) => apiFetch("/users", { method: "POST", body: data }), // name, email, password, role_id
  update: (userId, data) => apiFetch("/users/" + userId, { method: "PUT", body: data }),
  changeRole: (userId, roleId) => apiFetch("/users/" + userId + "/role", { method: "PUT", body: { role_id: roleId } }),
  deactivate: (userId) => apiFetch("/users/" + userId, { method: "DELETE" }),
};

// ===== Employees (admin, manager) =====
export const employeesApi = {
  list: (params) => apiFetch("/employees" + query(params)), // department, is_active, search, page, page_size
  get: (employeeId) => apiFetch("/employees/" + employeeId),
  tasks: (employeeId, params) => apiFetch("/employees/" + employeeId + "/tasks" + query(params)),
  create: (data) => apiFetch("/employees", { method: "POST", body: data }), // admin
  update: (employeeId, data) => apiFetch("/employees/" + employeeId, { method: "PUT", body: data }),
};

// ===== Customers (admin, sales) =====
export const customersApi = {
  list: (params) => apiFetch("/customers" + query(params)), // search, page, page_size
  get: (customerId) => apiFetch("/customers/" + customerId),
  orders: (customerId, params) => apiFetch("/customers/" + customerId + "/orders" + query(params)),
  create: (data) => apiFetch("/customers", { method: "POST", body: data }), // sales
  update: (customerId, data) => apiFetch("/customers/" + customerId, { method: "PUT", body: data }),
};

// ===== Products =====
export const productsApi = {
  list: (params) => apiFetch("/products" + query(params)), // search, is_active, page, page_size
  active: (params) => apiFetch("/products/active" + query(params)), // sales, inventory
  get: (productId) => apiFetch("/products/" + productId),
  availability: (productId, quantity) =>
    apiFetch("/products/" + productId + "/availability" + query({ quantity })), // sales
  create: (data) => apiFetch("/products", { method: "POST", body: data }), // admin, inventory
  update: (productId, data) => apiFetch("/products/" + productId, { method: "PUT", body: data }),
  deactivate: (productId) => apiFetch("/products/" + productId, { method: "DELETE" }),
};

// ===== Inventory =====
export const inventoryApi = {
  list: (params) => apiFetch("/inventory" + query(params)), // search, low_only, page, page_size
  lowStock: (params) => apiFetch("/inventory/low-stock" + query(params)),
  get: (productId) => apiFetch("/inventory/" + productId),
  update: (productId, data) => apiFetch("/inventory/" + productId, { method: "PUT", body: data }), // quantity_in_stock
  add: (productId, quantity) => apiFetch("/inventory/" + productId + "/add", { method: "POST", body: { quantity } }),
  reduce: (productId, quantity) => apiFetch("/inventory/" + productId + "/reduce", { method: "POST", body: { quantity } }),
};

// ===== Sales orders =====
export const ordersApi = {
  list: (params) => apiFetch("/orders" + query(params)), // status, customer_id, date_from, date_to, page, page_size
  get: (orderId) => apiFetch("/orders/" + orderId),
  create: (data) => apiFetch("/orders", { method: "POST", body: data }), // sales
  update: (orderId, data) => apiFetch("/orders/" + orderId, { method: "PUT", body: data }), // only while Pending
  setStatus: (orderId, status) => apiFetch("/orders/" + orderId + "/status", { method: "PUT", body: { status } }),
  cancel: (orderId) => apiFetch("/orders/" + orderId + "/cancel", { method: "PUT" }),
};

// ===== Tasks =====
export const tasksApi = {
  list: (params) => apiFetch("/tasks" + query(params)), // assigned_to, status, priority, page, page_size
  mine: (params) => apiFetch("/tasks/my" + query(params)),
  overdue: (params) => apiFetch("/tasks/overdue" + query(params)),
  get: (taskId) => apiFetch("/tasks/" + taskId),
  create: (data) => apiFetch("/tasks", { method: "POST", body: data }), // manager
  update: (taskId, data) => apiFetch("/tasks/" + taskId, { method: "PUT", body: data }),
  setStatus: (taskId, status) => apiFetch("/tasks/" + taskId + "/status", { method: "PUT", body: { status } }),
};

// ===== Operational issues =====
export const issuesApi = {
  list: (params) => apiFetch("/issues" + query(params)), // admin, manager
  mine: (params) => apiFetch("/issues/my" + query(params)),
  get: (issueId) => apiFetch("/issues/" + issueId),
  create: (data) => apiFetch("/issues", { method: "POST", body: data }), // title, description
  update: (issueId, data) => apiFetch("/issues/" + issueId, { method: "PUT", body: data }),
  setStatus: (issueId, status) => apiFetch("/issues/" + issueId + "/status", { method: "PUT", body: { status } }),
};

// ===== Purchase requests =====
export const purchaseApi = {
  list: (params) => apiFetch("/purchase-requests" + query(params)), // status, approval_status, page, page_size
  mine: (params) => apiFetch("/purchase-requests/my" + query(params)),
  pendingApproval: (params) => apiFetch("/purchase-requests/pending-approval" + query(params)), // manager
  get: (prId) => apiFetch("/purchase-requests/" + prId),
  create: (data) => apiFetch("/purchase-requests", { method: "POST", body: data }), // request_date, items
  update: (prId, data) => apiFetch("/purchase-requests/" + prId, { method: "PUT", body: data }),
  approve: (prId) => apiFetch("/purchase-requests/" + prId + "/approve", { method: "PUT" }),
  reject: (prId) => apiFetch("/purchase-requests/" + prId + "/reject", { method: "PUT" }),
  setStatus: (prId, status, receiveStock) =>
    apiFetch("/purchase-requests/" + prId + "/status", { method: "PUT", body: { status, receive_stock: receiveStock } }),
  items: (prId) => apiFetch("/purchase-requests/" + prId + "/items"),
  addItem: (prId, item) => apiFetch("/purchase-requests/" + prId + "/items", { method: "POST", body: item }),
  updateItem: (prItemId, data) => apiFetch("/purchase-request-items/" + prItemId, { method: "PUT", body: data }),
  removeItem: (prItemId) => apiFetch("/purchase-request-items/" + prItemId, { method: "DELETE" }),
};

// ===== Dashboards =====
export const dashboardApi = {
  summary: () => apiFetch("/dashboard/summary"),
  admin: () => apiFetch("/dashboard/admin"),
  manager: () => apiFetch("/dashboard/manager"),
  sales: () => apiFetch("/dashboard/sales"),
  inventory: () => apiFetch("/dashboard/inventory"),
};
