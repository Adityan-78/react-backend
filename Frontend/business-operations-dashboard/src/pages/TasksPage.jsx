// ===== Imports =====
import { useState } from "react";
import { Plus, CalendarDays, User, Pencil, UserCheck } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { tasksApi, employeesApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pager from "../components/Pager";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { TASK_STATUSES, TASK_PRIORITIES } from "../config/roles";
import { formatDate, today } from "../utils/format";

const PAGE_SIZE = 12;

// ===== The TasksPage component =====
// Managers and admins see the whole team; everyone else sees "My tasks".
export default function TasksPage({ can, notify, filter }) {
  // ===== Which views this role gets =====
  const views = can.viewAllTasks
    ? [{ key: "team", label: "Team tasks" }, { key: "overdue", label: "Overdue" }, { key: "mine", label: "My tasks" }]
    : [{ key: "mine", label: "My tasks" }, { key: "overdue", label: "Overdue" }];

  // ===== State =====
  const [view, setView] = useState(filter.view || views[0].key);
  const [status, setStatus] = useState(filter.status || "");
  const [priority, setPriority] = useState("");
  const [assignedTo, setAssignedTo] = useState(filter.assignedTo || "");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // {} = new, a task = edit

  // Staff list for the "Assign to" filter and form (GET /employees).
  const staff = useFetch(() => (can.viewAllTasks ? employeesApi.list({ page: 1, page_size: 100, is_active: true }) : Promise.resolve(null)), []);

  // ===== Pick the endpoint for the current view =====
  const tasks = useFetch(() => {
    if (view === "team") return tasksApi.list({ page, page_size: PAGE_SIZE, status, priority, assigned_to: assignedTo }); // GET /tasks
    if (view === "overdue" && can.viewAllTasks) return tasksApi.overdue({ page, page_size: PAGE_SIZE, assigned_to: assignedTo }); // GET /tasks/overdue
    return tasksApi.mine({ page: 1, page_size: 100, status }); // GET /tasks/my
  }, [view, status, priority, assignedTo, page]);

  // For staff, "Overdue" is worked out from their own list using the server's is_overdue flag.
  let shown = tasks.data?.items || [];
  if (view === "overdue" && !can.viewAllTasks) shown = shown.filter((t) => t.is_overdue);
  const paged = view === "team" || (view === "overdue" && can.viewAllTasks);

  // ===== Change progress: PUT /tasks/{id}/status =====
  async function changeStatus(task, newStatus) {
    try {
      await tasksApi.setStatus(task.task_id, newStatus);
      notify('"' + task.title + '" is now ' + newStatus);
      tasks.reload();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  const reset = (setter) => (e) => { setter(e.target.value); setPage(1); };

  // ===== What the page looks like =====
  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div className="tabs">
            {views.map((v) => <button key={v.key} className={view === v.key ? "tab active" : "tab"} onClick={() => { setView(v.key); setPage(1); }}>{v.label}</button>)}
          </div>
          {view !== "overdue" && (
            <select id="task-status-filter" value={status} onChange={reset(setStatus)}>
              <option value="">Any status</option>
              {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          {view === "team" && (
            <select id="task-priority-filter" value={priority} onChange={reset(setPriority)}>
              <option value="">Any priority</option>
              {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          {view !== "mine" && can.viewAllTasks && (
            <select id="task-person-filter" value={assignedTo} onChange={reset(setAssignedTo)}>
              <option value="">Everyone</option>
              {(staff.data?.items || []).map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
            </select>
          )}
          {can.createTask && <button className="btn btn-primary push-right" onClick={() => setEditing({})}><Plus size={16} /> Assign task</button>}
        </div>
      </div>

      {tasks.loading && <Loading rows={4} />}
      {tasks.error && <ErrorBox message={tasks.error} onRetry={tasks.reload} />}
      {tasks.data && shown.length === 0 && <Empty text={view === "overdue" ? "Nothing is overdue. 🎉" : "No tasks here."} />}

      <div className="task-grid">
        {shown.map((t) => {
          // Only managers can reopen a completed task (backend rule).
          const canChange = view === "mine" || can.createTask;
          return (
            <div key={t.task_id} className={"task-card" + (t.is_overdue ? " overdue" : "") + (t.status === "Completed" ? " done" : "")}>
              <div className="task-top">
                <StatusBadge status={t.priority} />
                {t.is_overdue && <StatusBadge status="Overdue" />}
                {can.createTask && <button className="icon-btn push-right" title="Edit task" onClick={() => setEditing(t)}><Pencil size={15} /></button>}
              </div>
              <h4 className="task-title">{t.title}</h4>
              {t.description && <p className="muted small">{t.description}</p>}
              <div className="task-meta">
                <span><User size={14} /> {t.assigned_to_name}</span>
                <span className={t.is_overdue ? "text-red" : ""}><CalendarDays size={14} /> {formatDate(t.due_date)}</span>
              </div>
              <div className="task-meta"><span className="muted small"><UserCheck size={13} /> by {t.assigned_by_name}</span></div>
              <div className="task-bottom">
                {canChange ? (
                  <div className="segmented" role="group" aria-label="Task status">
                    {TASK_STATUSES.map((s) => (
                      <button key={s} className={t.status === s ? "seg active" : "seg"}
                        disabled={t.status === s || (t.status === "Completed" && !can.createTask)}
                        onClick={() => changeStatus(t, s)}>{s}</button>
                    ))}
                  </div>
                ) : <StatusBadge status={t.status} />}
              </div>
            </div>
          );
        })}
      </div>
      {tasks.data && paged && <div className="card"><Pager page={page} pageSize={PAGE_SIZE} total={tasks.data.total} onChange={setPage} /></div>}

      {editing && <TaskForm task={editing} staff={staff.data?.items || []} notify={notify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); tasks.reload(); }} />}
    </>
  );
}

// ===== Assign / edit a task: POST /tasks or PUT /tasks/{id} (manager) =====
function TaskForm({ task, staff, notify, onClose, onSaved }) {
  const isNew = !task.task_id;
  const [form, setForm] = useState({
    assigned_to: task.assigned_to || "", title: task.title || "", description: task.description || "",
    priority: task.priority || "Medium", due_date: task.due_date || today(),
  });
  const [error, setError] = useState("");
  const set = (field, value) => setForm({ ...form, [field]: value });

  async function save(event) {
    event.preventDefault();
    const body = { ...form, assigned_to: Number(form.assigned_to), description: form.description || null };
    try {
      if (isNew) await tasksApi.create(body);
      else await tasksApi.update(task.task_id, body);
      notify(isNew ? "Task assigned" : "Task updated");
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={isNew ? "Assign a task" : "Edit task"} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="field wide"><span>Assign to *</span>
          <select id="tf-assignee" value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)} required>
            <option value="">Choose a team member…</option>
            {staff.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name} – {e.designation || e.role}</option>)}
          </select>
        </label>
        <label className="field wide"><span>Title *</span><input id="tf-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={150} required /></label>
        <label className="field wide"><span>Description</span><textarea id="tf-description" rows="3" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={500} /></label>
        <label className="field"><span>Priority *</span>
          <select id="tf-priority" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="field"><span>Due date *</span><input id="tf-due" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} required /></label>
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{isNew ? "Assign task" : "Save changes"}</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
