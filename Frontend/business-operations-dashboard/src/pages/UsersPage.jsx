// ===== Imports =====
import { useState } from "react";
import { UserPlus, Pencil, Search, Ban, RotateCcw, IdCard } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { authApi, usersApi, employeesApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pager from "../components/Pager";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { ROLE_LABELS } from "../config/roles";
import { formatDate, today } from "../utils/format";

const PAGE_SIZE = 10;

// ===== The UsersPage component (Administrator only) =====
// Two tabs: login accounts (USER table) and staff profiles (EMPLOYEE table).
export default function UsersPage({ notify }) {
  const [tab, setTab] = useState("users");
  const roles = useFetch(() => authApi.roles(), []); // GET /roles

  return (
    <>
      <div className="tabs big">
        <button className={tab === "users" ? "tab active" : "tab"} onClick={() => setTab("users")}>User accounts</button>
        <button className={tab === "employees" ? "tab active" : "tab"} onClick={() => setTab("employees")}>Employee profiles</button>
      </div>
      {tab === "users"
        ? <UsersTab roles={roles.data || []} notify={notify} />
        : <EmployeesTab notify={notify} />}
    </>
  );
}

// ===== Users tab: list, filter, add, edit, change role, deactivate =====
function UsersTab({ roles, notify }) {
  // ===== State =====
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new user, a user = edit

  // GET /users?page=..&page_size=..&role=..&search=..
  const users = useFetch(() => usersApi.list({ page, page_size: PAGE_SIZE, role: roleFilter, search }), [page, roleFilter, search]);

  // ===== Change a user's role: PUT /users/{id}/role =====
  async function changeRole(user, roleId) {
    try {
      await usersApi.changeRole(user.user_id, Number(roleId));
      notify(user.name + " is now " + ROLE_LABELS[roles.find((r) => r.role_id === Number(roleId)).role_name]);
      users.reload();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  // ===== Deactivate (DELETE /users/{id}) or re-activate (PUT is_active: true) =====
  async function toggleActive(user) {
    try {
      if (user.is_active) await usersApi.deactivate(user.user_id);
      else await usersApi.update(user.user_id, { is_active: true });
      notify(user.name + (user.is_active ? " was deactivated" : " was re-activated"));
      users.reload();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  // ===== What the tab looks like =====
  return (
    <div className="card">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input id="user-search" placeholder="Search name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select id="user-role-filter" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.role_id} value={r.role_name}>{ROLE_LABELS[r.role_name] || r.role_name}</option>)}
        </select>
        <button className="btn btn-primary push-right" onClick={() => setEditing({})}>
          <UserPlus size={16} /> Add user
        </button>
      </div>

      {users.loading && <Loading />}
      {users.error && <ErrorBox message={users.error} onRetry={users.reload} />}
      {users.data && users.data.items.length === 0 && <Empty text="No users match these filters." />}
      {users.data && users.data.items.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => (
                <tr key={u.user_id} className={u.is_active ? "" : "row-muted"}>
                  <td className="strong">{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select className="inline-select" value={u.role_id} onChange={(e) => changeRole(u, e.target.value)} aria-label={"Role for " + u.name}>
                      {roles.map((r) => <option key={r.role_id} value={r.role_id}>{ROLE_LABELS[r.role_name] || r.role_name}</option>)}
                    </select>
                  </td>
                  <td><StatusBadge status={u.is_active ? "Active" : "Inactive"} /></td>
                  <td>{formatDate(u.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(u)}><Pencil size={16} /></button>
                      <button className="icon-btn" title={u.is_active ? "Deactivate" : "Re-activate"} onClick={() => toggleActive(u)}>
                        {u.is_active ? <Ban size={16} /> : <RotateCcw size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users.data && <Pager page={page} pageSize={PAGE_SIZE} total={users.data.total} onChange={setPage} />}

      {editing && (
        <UserForm user={editing} roles={roles} notify={notify}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); users.reload(); }} />
      )}
    </div>
  );
}

// ===== Add / edit user form =====
// New user: POST /users, then (optional) POST /employees so the person can get tasks.
// Edit user: PUT /users/{id} with only the fields that changed.
function UserForm({ user, roles, notify, onClose, onSaved }) {
  const isNew = !user.user_id;
  const [form, setForm] = useState({
    name: user.name || "", email: user.email || "", password: "", role_id: user.role_id || 5,
    withProfile: true, designation: "", department: "", phone: "", hire_date: today(),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setForm({ ...form, [field]: value });

  async function save(event) {
    event.preventDefault();
    setError("");
    // Same password rule as the backend: 8–128 characters, a letter and a digit.
    if ((isNew || form.password) && !(form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password))) {
      setError("Password must be at least 8 characters and contain a letter and a digit.");
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const created = await usersApi.create({ name: form.name, email: form.email, password: form.password, role_id: Number(form.role_id) });
        if (form.withProfile) {
          await employeesApi.create({ user_id: created.user_id, designation: form.designation, department: form.department, phone: form.phone, hire_date: form.hire_date });
        }
        notify(created.name + " was added");
      } else {
        const changes = { name: form.name, email: form.email };
        if (form.password) changes.password = form.password;
        await usersApi.update(user.user_id, changes);
        notify("Saved changes for " + form.name);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isNew ? "Add a user" : "Edit " + user.name} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="field"><span>Full name *</span>
          <input id="uf-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={100} required />
        </label>
        <label className="field"><span>Email *</span>
          <input id="uf-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </label>
        <label className="field"><span>{isNew ? "Password *" : "New password (optional)"}</span>
          <input id="uf-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required={isNew} minLength={8} maxLength={128} placeholder="8+ characters, a letter and a digit" />
        </label>
        {isNew && (
          <label className="field"><span>Role *</span>
            <select id="uf-role" value={form.role_id} onChange={(e) => set("role_id", e.target.value)}>
              {roles.map((r) => <option key={r.role_id} value={r.role_id}>{ROLE_LABELS[r.role_name] || r.role_name}</option>)}
            </select>
          </label>
        )}
        {isNew && (
          <label className="check wide">
            <input id="uf-profile" type="checkbox" checked={form.withProfile} onChange={(e) => set("withProfile", e.target.checked)} />
            Also create an employee profile (needed for tasks, issues and purchase requests)
          </label>
        )}
        {isNew && form.withProfile && (
          <>
            <label className="field"><span>Designation *</span><input id="uf-designation" value={form.designation} onChange={(e) => set("designation", e.target.value)} required /></label>
            <label className="field"><span>Department *</span><input id="uf-department" value={form.department} onChange={(e) => set("department", e.target.value)} required /></label>
            <label className="field"><span>Phone</span><input id="uf-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            <label className="field"><span>Hire date</span><input id="uf-hire" type="date" value={form.hire_date} onChange={(e) => set("hire_date", e.target.value)} /></label>
          </>
        )}
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isNew ? "Create user" : "Save changes"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ===== Employees tab: GET /employees, POST, PUT =====
function EmployeesTab({ notify }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const employees = useFetch(() => employeesApi.list({ page, page_size: PAGE_SIZE, search }), [page, search]);

  async function deactivate(emp) {
    try {
      await usersApi.deactivate(emp.user_id);
      notify(emp.name + "'s user account was deactivated");
      employees.reload();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input id="emp-search" placeholder="Search name or designation" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary push-right" onClick={() => setEditing({})}>
          <IdCard size={16} /> Add profile
        </button>
      </div>
      {employees.loading && <Loading />}
      {employees.error && <ErrorBox message={employees.error} onRetry={employees.reload} />}
      {employees.data && employees.data.items.length === 0 && <Empty text="No employee profiles found." />}
      {employees.data && employees.data.items.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Designation</th><th>Department</th><th>Phone</th><th>Hired</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {employees.data.items.map((e) => (
                <tr key={e.employee_id} className={e.is_active ? "" : "row-muted"}>
                  <td><div className="strong">{e.name}</div><div className="muted small">{e.email}</div></td>
                  <td>{ROLE_LABELS[e.role] || e.role}</td>
                  <td>{e.designation || "—"}</td>
                  <td>{e.department || "—"}</td>
                  <td>{e.phone || "—"}</td>
                  <td>{formatDate(e.hire_date)}</td>
                  <td><StatusBadge status={e.is_active ? "Active" : "Inactive"} /></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(e)}><Pencil size={16} /></button>
                      {e.is_active && <button className="icon-btn" title="Deactivate" onClick={() => deactivate(e)}><Ban size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {employees.data && <Pager page={page} pageSize={PAGE_SIZE} total={employees.data.total} onChange={setPage} />}
      {editing && <EmployeeForm employee={editing} notify={notify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); employees.reload(); }} />}
    </div>
  );
}

// ===== Add / edit an employee profile =====
function EmployeeForm({ employee, notify, onClose, onSaved }) {
  const isNew = !employee.employee_id;
  // For a new profile we need the list of users to pick from.
  const users = useFetch(() => (isNew ? usersApi.list({ page: 1, page_size: 100, is_active: true }) : Promise.resolve(null)), []);
  const [form, setForm] = useState({
    user_id: "", designation: employee.designation || "", department: employee.department || "",
    phone: employee.phone || "", hire_date: employee.hire_date || today(),
  });
  const [error, setError] = useState("");
  const set = (field, value) => setForm({ ...form, [field]: value });

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      if (isNew) {
        await employeesApi.create({ user_id: Number(form.user_id), designation: form.designation, department: form.department, phone: form.phone, hire_date: form.hire_date });
      } else {
        await employeesApi.update(employee.employee_id, { designation: form.designation, department: form.department, phone: form.phone, hire_date: form.hire_date });
      }
      notify("Employee profile saved");
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={isNew ? "Add an employee profile" : "Edit " + employee.name} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        {isNew && (
          <label className="field wide"><span>User account *</span>
            <select id="ef-user" value={form.user_id} onChange={(e) => set("user_id", e.target.value)} required>
              <option value="">Choose a user…</option>
              {(users.data?.items || []).map((u) => <option key={u.user_id} value={u.user_id}>{u.name} ({u.email})</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>Designation *</span><input id="ef-designation" value={form.designation} onChange={(e) => set("designation", e.target.value)} required /></label>
        <label className="field"><span>Department *</span><input id="ef-department" value={form.department} onChange={(e) => set("department", e.target.value)} required /></label>
        <label className="field"><span>Phone</span><input id="ef-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="field"><span>Hire date</span><input id="ef-hire" type="date" value={form.hire_date} onChange={(e) => set("hire_date", e.target.value)} /></label>
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save profile</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
