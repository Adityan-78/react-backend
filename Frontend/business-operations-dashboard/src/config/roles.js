// What each role is called, which menu items it sees and what it may do.
// These rules match the backend's access table (FRONTEND_API_GUIDE.md, section 4).
// They only decide what the screen SHOWS – the server still checks every request.

// ===== Friendly names for the backend's role codes =====
export const ROLE_LABELS = {
  Administrator: "Administrator",
  Manager: "Manager",
  "Sales Executive": "Sales Executive",
  "Inventory Executive": "Inventory Executive",
  Employee: "Employee",
};

// ===== The pages (modules) in the top menu =====
export const MODULES = {
  overview: "Overview",
  users: "Users & Staff",
  customers: "Customers",
  orders: "Sales Orders",
  inventory: "Inventory",
  purchases: "Purchase Requests",
  tasks: "Tasks",
  issues: "Issues",
};

// ===== Which modules appear in each role's menu =====
export const MENU_BY_ROLE = {
  Administrator: ["overview", "users", "customers", "orders", "inventory", "purchases", "tasks", "issues"],
  Manager: ["overview", "orders", "purchases", "tasks", "issues"],
  "Sales Executive": ["overview", "orders", "customers", "tasks", "issues"],
  "Inventory Executive": ["overview", "inventory", "purchases", "tasks", "issues"],
  Employee: ["overview", "tasks", "issues"],
};

// ===== What each role is allowed to do (used to show or hide buttons) =====
export function permissionsFor(role) {
  return {
    manageUsers: role === "Administrator",
    createCustomer: role === "Sales Executive",
    editCustomer: role === "Sales Executive" || role === "Administrator",
    viewCustomerOrders: role === "Sales Executive" || role === "Manager",
    createOrder: role === "Sales Executive",
    changeOrderStatus: role === "Sales Executive" || role === "Manager",
    checkAvailability: role === "Sales Executive",
    createProductDirectly: role === "Administrator",
    requestNewProduct: role === "Inventory Executive",
    editProduct: role === "Administrator" || role === "Inventory Executive",
    changeStock: role === "Inventory Executive",
    viewAllTasks: role === "Administrator" || role === "Manager",
    createTask: role === "Manager",
    viewAllIssues: role === "Administrator" || role === "Manager",
    changeIssueStatus: role === "Administrator" || role === "Manager",
    viewAllPurchases: role === "Administrator" || role === "Manager" || role === "Inventory Executive",
    approvePurchases: role === "Manager",
    createPurchase: role === "Inventory Executive",
    fulfilPurchase: role === "Manager" || role === "Inventory Executive",
  };
}

// ===== Fixed lists of values the backend accepts =====
export const ORDER_STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];
// The next steps an order may move to (backend rule). Delivered and Cancelled are final.
export const ORDER_NEXT_STEPS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
};
export const TASK_STATUSES = ["Pending", "In Progress", "Completed"];
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const ISSUE_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
export const APPROVAL_STATUSES = ["Pending", "Approved", "Rejected"];

// ===== Product categories =====
// The backend has no category column yet, so the category is saved at the
// start of the product description, like "[Stationery] Blue ink, box of 50".
export const CATEGORIES = [
  "Stationery",
  "Printing Supplies",
  "Office Furniture",
  "IT Accessories",
  "Electronics",
  "Cleaning & Hygiene",
  "Pantry & Beverages",
  "Packaging",
  "Safety & First Aid",
  "Maintenance & Tools",
  "Other",
];

export const UNITS = ["Piece", "Box", "Pack", "Ream", "Cartridge", "Bottle", "Roll", "Kg", "Litre", "Set"];
