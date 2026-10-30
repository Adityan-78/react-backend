// ===== Imports =====
import {
  Users, ShoppingCart, PackageX, Hourglass, Clock, AlertTriangle, IndianRupee,
  CheckCircle2, Boxes, ListChecks, TrendingUp, Contact,
} from "lucide-react";
import useFetch from "../hooks/useFetch";
import { dashboardApi, ordersApi, tasksApi, purchaseApi, inventoryApi, productsApi, issuesApi } from "../api/endpoints";
import StatCard from "../components/StatCard";
import StatusBadge, { colourOf, TONE_HEX } from "../components/StatusBadge";
import { DonutChart, BarChartCard, TrendChart } from "../components/Charts";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { ORDER_STATUSES, TASK_STATUSES, ISSUE_STATUSES, APPROVAL_STATUSES, ROLE_LABELS } from "../config/roles";
import { formatMoney, shortMoney, formatDate, daysSince, daysLabel, splitCategory } from "../utils/format";

// ===== Chart helpers =====
// Turn the API's { "Pending": 2, "Shipped": 1 } into chart rows in a fixed order.
function toSlices(byStatus, order) {
  return order.map((name) => ({ name, value: (byStatus && byStatus[name]) || 0, color: colourOf(name) }));
}

// Add up order values per week for the trend chart (cancelled orders are left out).
function weeklyValue(orders) {
  const weeks = {};
  orders.filter((o) => o.status !== "Cancelled").forEach((o) => {
    const d = new Date(o.order_date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // move back to Monday
    const key = d.toISOString().slice(0, 10);
    weeks[key] = (weeks[key] || 0) + Number(o.total_amount);
  });
  return Object.keys(weeks).sort().map((key) => ({
    label: new Date(key).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    value: Math.round(weeks[key]),
  }));
}

// ===== Overview: picks the dashboard for the logged-in role =====
export default function Overview(props) {
  const role = props.user.role;
  if (role === "Administrator") return <AdminOverview {...props} />;
  if (role === "Manager") return <ManagerOverview {...props} />;
  if (role === "Sales Executive") return <SalesOverview {...props} />;
  if (role === "Inventory Executive") return <InventoryOverview {...props} />;
  return <EmployeeOverview {...props} />;
}

// ===== Administrator: GET /dashboard/admin + GET /orders =====
function AdminOverview({ goTo }) {
  const dash = useFetch(() => dashboardApi.admin(), []);
  const orders = useFetch(() => ordersApi.list({ page: 1, page_size: 100 }), []);

  if (dash.loading) return <Loading rows={6} />;
  if (dash.error) return <ErrorBox message={dash.error} onRetry={dash.reload} />;
  const d = dash.data;

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Active users" value={d.users.active} hint={"of " + d.users.total + " accounts"} icon={Users} tone="violet" onClick={() => goTo("users")} />
        <StatCard label="Order value" value={shortMoney(d.orders.revenue)} hint={d.orders.total + " orders"} icon={IndianRupee} tone="green" onClick={() => goTo("orders")} />
        <StatCard label="Low-stock items" value={d.stock.low_stock_count} hint={"of " + d.stock.total_products + " products"} icon={PackageX} tone="amber" onClick={() => goTo("inventory", { lowOnly: true })} />
        <StatCard label="Pending approvals" value={d.purchase_requests.pending_approval} icon={Hourglass} tone="amber" onClick={() => goTo("purchases", { approval: "Pending" })} />
        <StatCard label="Overdue tasks" value={d.tasks.overdue} hint={"of " + d.tasks.total + " tasks"} icon={Clock} tone="red" onClick={() => goTo("tasks", { view: "overdue" })} />
        <StatCard label="Open issues" value={d.issues.open} icon={AlertTriangle} tone="red" onClick={() => goTo("issues")} />
      </div>

      <div className="grid-2">
        <DonutChart title="Sales orders by status" hint="Click a status to open those orders" data={toSlices(d.orders.by_status, ORDER_STATUSES)} onSelect={(status) => goTo("orders", { status })} centerLabel="Orders" />
        {orders.data ? (
          <TrendChart title="Order value by week" hint="Excludes cancelled orders" data={weeklyValue(orders.data.items)} valueFormat={shortMoney} />
        ) : <div className="card"><Loading /></div>}
      </div>

      <div className="grid-3">
        <BarChartCard title="Tasks by status" hint="Click a bar to open those tasks" data={toSlices(d.tasks.by_status, TASK_STATUSES)} series={[{ key: "value", name: "Tasks", color: TONE_HEX.blue }]} onSelect={(row) => goTo("tasks", { status: row.name })} height={220} />
        <DonutChart title="Purchase approvals" data={toSlices(d.purchase_requests.by_approval_status, APPROVAL_STATUSES)} onSelect={(approval) => goTo("purchases", { approval })} centerLabel="Requests" />
        <DonutChart title="Issues by status" data={toSlices(d.issues.by_status, ISSUE_STATUSES)} onSelect={(status) => goTo("issues", { status })} centerLabel="Issues" />
      </div>

      <div className="grid-2">
        <BarChartCard title="Users by role" horizontal height={220}
          data={Object.entries(d.users.by_role).map(([role, count]) => ({ name: ROLE_LABELS[role] || role, value: count }))}
          series={[{ key: "value", name: "Users", color: TONE_HEX.violet }]} onSelect={() => goTo("users")} />
        <LowStockCard items={d.stock.low_stock_items} onOpen={() => goTo("inventory", { lowOnly: true })} />
      </div>
    </>
  );
}

// ===== Low-stock card: stock compared with reorder level =====
function LowStockCard({ items, onOpen }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Most urgent stock</h3>
        <button className="btn btn-light" onClick={onOpen}>Open inventory</button>
      </div>
      {items.length === 0 && <Empty text="No products are below their reorder level." />}
      <ul className="meter-list">
        {items.map((item) => {
          const percent = item.reorder_level ? Math.min(100, (item.quantity_in_stock / item.reorder_level) * 100) : 100;
          return (
            <li key={item.product_id}>
              <div className="meter-top">
                <span className="strong">{item.product_name}</span>
                <span className="muted small">{item.quantity_in_stock} in stock · reorder at {item.reorder_level}</span>
              </div>
              <div className="progress"><div className={"progress-fill fill-" + (item.quantity_in_stock === 0 ? "red" : "amber")} style={{ width: percent + "%" }} /></div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ===== Manager: GET /dashboard/manager + GET /tasks + GET /purchase-requests/pending-approval =====
function ManagerOverview({ goTo }) {
  const dash = useFetch(() => dashboardApi.manager(), []);
  const tasks = useFetch(() => tasksApi.list({ page: 1, page_size: 100 }), []);
  const pending = useFetch(() => purchaseApi.pendingApproval({ page: 1, page_size: 5 }), []);

  if (dash.loading) return <Loading rows={6} />;
  if (dash.error) return <ErrorBox message={dash.error} onRetry={dash.reload} />;
  const d = dash.data;

  // One bar per team member, split by task status.
  const team = {};
  (tasks.data?.items || []).forEach((t) => {
    if (!team[t.assigned_to]) team[t.assigned_to] = { name: t.assigned_to_name.split(" ")[0], id: t.assigned_to, Pending: 0, "In Progress": 0, Completed: 0, Overdue: 0 };
    team[t.assigned_to][t.status] += 1;
    if (t.is_overdue) team[t.assigned_to].Overdue += 1;
  });
  const teamRows = Object.values(team);

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Team tasks" value={d.tasks.total} icon={ListChecks} tone="blue" onClick={() => goTo("tasks")} />
        <StatCard label="Overdue tasks" value={d.tasks.overdue} icon={Clock} tone="red" onClick={() => goTo("tasks", { view: "overdue" })} />
        <StatCard label="Waiting for your approval" value={d.purchase_requests.pending_approval} icon={Hourglass} tone="amber" onClick={() => goTo("purchases", { approval: "Pending" })} />
        <StatCard label="Open issues" value={d.issues.open} icon={AlertTriangle} tone="violet" onClick={() => goTo("issues")} />
      </div>

      <div className="grid-2">
        <BarChartCard title="Team workload" hint="Click a person to see their tasks" stacked data={teamRows}
          series={[{ key: "Pending", color: colourOf("Pending") }, { key: "In Progress", color: colourOf("In Progress") }, { key: "Completed", color: colourOf("Completed") }]}
          onSelect={(row) => goTo("tasks", { assignedTo: row.id })} />
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Waiting for your approval</h3>
            <button className="btn btn-light" onClick={() => goTo("purchases", { approval: "Pending" })}>Review all</button>
          </div>
          {pending.loading && <Loading />}
          {pending.data && pending.data.items.length === 0 && <Empty text="No requests are waiting." />}
          <ul className="simple-list">
            {(pending.data?.items || []).map((pr) => (
              <li key={pr.pr_id} className={daysSince(pr.request_date) >= 3 ? "late" : ""}>
                <span className="strong">PR-{pr.pr_id}</span>
                <span className="muted">{pr.raised_by_name} · {formatMoney(pr.total_estimated)}</span>
                <span className="push-right small">{daysLabel(daysSince(pr.request_date))} waiting</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid-3">
        <DonutChart title="Tasks by status" data={toSlices(d.tasks.by_status, TASK_STATUSES)} onSelect={(status) => goTo("tasks", { status })} centerLabel="Tasks" />
        <DonutChart title="Orders by status" data={toSlices(d.orders.by_status, ORDER_STATUSES)} onSelect={(status) => goTo("orders", { status })} centerLabel="Orders" />
        <DonutChart title="Issues by status" data={toSlices(d.issues.by_status, ISSUE_STATUSES)} onSelect={(status) => goTo("issues", { status })} centerLabel="Issues" />
      </div>
    </>
  );
}

// ===== Sales Executive: GET /dashboard/sales + GET /orders =====
function SalesOverview({ goTo }) {
  const dash = useFetch(() => dashboardApi.sales(), []);
  const orders = useFetch(() => ordersApi.list({ page: 1, page_size: 100 }), []);

  if (dash.loading) return <Loading rows={6} />;
  if (dash.error) return <ErrorBox message={dash.error} onRetry={dash.reload} />;
  const d = dash.data;

  // Top customers by order value.
  const byCustomer = {};
  (orders.data?.items || []).filter((o) => o.status !== "Cancelled").forEach((o) => {
    byCustomer[o.customer_name] = (byCustomer[o.customer_name] || 0) + Number(o.total_amount);
  });
  const topCustomers = Object.entries(byCustomer).map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Total orders" value={d.orders.total} icon={ShoppingCart} tone="blue" onClick={() => goTo("orders")} />
        <StatCard label="Waiting to confirm" value={d.orders.by_status.Pending || 0} icon={Hourglass} tone="amber" onClick={() => goTo("orders", { status: "Pending" })} />
        <StatCard label="Order value" value={shortMoney(d.orders.revenue)} hint="Excludes cancelled" icon={IndianRupee} tone="green" />
        <StatCard label="Active customers" value={d.customers.active} hint={"of " + d.customers.total} icon={Contact} tone="violet" onClick={() => goTo("customers")} />
      </div>
      <div className="grid-2">
        <DonutChart title="Orders by status" hint="Click a status to open those orders" data={toSlices(d.orders.by_status, ORDER_STATUSES)} onSelect={(status) => goTo("orders", { status })} centerLabel="Orders" />
        {orders.data ? <TrendChart title="Order value by week" data={weeklyValue(orders.data.items)} valueFormat={shortMoney} color="#22a05a" /> : <div className="card"><Loading /></div>}
      </div>
      <div className="grid-2">
        <BarChartCard title="Top customers by order value" horizontal height={240} data={topCustomers} series={[{ key: "value", name: "Value", color: TONE_HEX.violet }]} valueFormat={shortMoney} onSelect={() => goTo("customers")} />
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Recent orders</h3>
            <button className="btn btn-light" onClick={() => goTo("orders")}>All orders</button>
          </div>
          <ul className="simple-list">
            {d.recent_orders.map((o) => (
              <li key={o.order_id}>
                <span className="strong">#{o.order_id}</span>
                <span className="muted">{o.customer_name}</span>
                <span className="push-right small">{formatMoney(o.total_amount)}</span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

// ===== Inventory Executive: GET /dashboard/inventory + GET /inventory + GET /products =====
function InventoryOverview({ goTo }) {
  const dash = useFetch(() => dashboardApi.inventory(), []);
  const stock = useFetch(() => inventoryApi.list({ page: 1, page_size: 100 }), []);
  const products = useFetch(() => productsApi.list({ page: 1, page_size: 100 }), []);

  if (dash.loading) return <Loading rows={6} />;
  if (dash.error) return <ErrorBox message={dash.error} onRetry={dash.reload} />;
  const d = dash.data;
  const stockRows = stock.data?.items || [];

  // Units in stock per category (category comes from the product description).
  const categoryOf = {};
  (products.data?.items || []).forEach((p) => { categoryOf[p.product_id] = splitCategory(p.description).category; });
  const byCategory = {};
  stockRows.forEach((s) => {
    const c = categoryOf[s.product_id] || "Other";
    byCategory[c] = (byCategory[c] || 0) + s.quantity_in_stock;
  });
  const palette = ["#4f46e5", "#22a05a", "#f59e0b", "#3b6ff5", "#8b5cf6", "#e5484d", "#14b8a6", "#ec4899", "#64748b", "#a16207", "#0ea5e9"];
  const categorySlices = Object.entries(byCategory).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));

  const levels = stockRows.map((s) => ({ name: s.product_name, id: s.product_id, "In stock": s.quantity_in_stock, "Reorder level": s.reorder_level }));
  const totalUnits = stockRows.reduce((sum, s) => sum + s.quantity_in_stock, 0);

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Active products" value={d.stock.total_products} icon={Boxes} tone="blue" onClick={() => goTo("inventory")} />
        <StatCard label="Units in stock" value={totalUnits.toLocaleString("en-IN")} icon={TrendingUp} tone="green" />
        <StatCard label="Low-stock items" value={d.stock.low_stock_count} hint="At or below reorder level" icon={PackageX} tone="red" onClick={() => goTo("inventory", { lowOnly: true })} />
        <StatCard label="Requests awaiting approval" value={d.purchase_requests.pending_approval} icon={Hourglass} tone="amber" onClick={() => goTo("purchases", { approval: "Pending" })} />
      </div>
      <BarChartCard title="Stock vs reorder level" hint="Bars below the grey reorder bar need restocking · click a product to manage it"
        data={levels} series={[{ key: "In stock", color: TONE_HEX.blue }, { key: "Reorder level", color: "#cbd5e1" }]} horizontal height={70 + levels.length * 38}
        onSelect={() => goTo("inventory")} />
      <div className="grid-3">
        <DonutChart title="Units by category" hint="Click a category to filter stock" data={categorySlices} onSelect={(category) => goTo("inventory", { category })} centerLabel="Units" />
        <DonutChart title="Purchase requests by approval" data={toSlices(d.purchase_requests.by_approval_status, APPROVAL_STATUSES)} onSelect={(approval) => goTo("purchases", { approval })} centerLabel="Requests" />
        <LowStockCard items={d.stock.low_stock_items} onOpen={() => goTo("inventory", { lowOnly: true })} />
      </div>
    </>
  );
}

// ===== Employee: GET /tasks/my + GET /issues/my (there is no employee dashboard endpoint) =====
function EmployeeOverview({ goTo }) {
  const tasks = useFetch(() => tasksApi.mine({ page: 1, page_size: 100 }), []);
  const issues = useFetch(() => issuesApi.mine({ page: 1, page_size: 100 }), []);

  if (tasks.loading) return <Loading rows={6} />;
  if (tasks.error) return <ErrorBox message={tasks.error} onRetry={tasks.reload} />;
  const mine = tasks.data.items;
  const count = (status) => mine.filter((t) => t.status === status).length;
  const upcoming = mine.filter((t) => t.status !== "Completed").sort((a, b) => (a.due_date || "9") > (b.due_date || "9") ? 1 : -1);

  return (
    <>
      <div className="stat-grid">
        <StatCard label="My tasks" value={mine.length} icon={ListChecks} tone="blue" onClick={() => goTo("tasks")} />
        <StatCard label="In progress" value={count("In Progress")} icon={TrendingUp} tone="violet" onClick={() => goTo("tasks", { status: "In Progress" })} />
        <StatCard label="Overdue" value={mine.filter((t) => t.is_overdue).length} icon={Clock} tone="red" onClick={() => goTo("tasks", { view: "overdue" })} />
        <StatCard label="Completed" value={count("Completed")} icon={CheckCircle2} tone="green" onClick={() => goTo("tasks", { status: "Completed" })} />
      </div>
      <div className="grid-3">
        <DonutChart title="My tasks by status" data={TASK_STATUSES.map((s) => ({ name: s, value: count(s), color: colourOf(s) }))} onSelect={(status) => goTo("tasks", { status })} centerLabel="Tasks" />
        <div className="card span-2">
          <div className="card-head">
            <h3 className="card-title">What's next for me</h3>
            <button className="btn btn-light" onClick={() => goTo("tasks")}>All my tasks</button>
          </div>
          {upcoming.length === 0 && <Empty text="All caught up!" />}
          <ul className="simple-list">
            {upcoming.map((t) => (
              <li key={t.task_id} className={t.is_overdue ? "late" : ""}>
                <span className="strong">{t.title}</span>
                <span className="muted small">Due {formatDate(t.due_date)}</span>
                <span className="push-right"><StatusBadge status={t.is_overdue ? "Overdue" : t.status} /></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h3 className="card-title">My submitted issues</h3>
          <button className="btn btn-light" onClick={() => goTo("issues")}>Raise an issue</button>
        </div>
        {issues.data && issues.data.items.length === 0 && <Empty text="You have not raised any issues." />}
        <ul className="simple-list">
          {(issues.data?.items || []).map((i) => (
            <li key={i.issue_id}>
              <span className="strong">{i.title}</span>
              <span className="muted small">{formatDate(i.created_at)}</span>
              <span className="push-right"><StatusBadge status={i.status} /></span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
