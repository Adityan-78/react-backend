// ===== Imports =====
import { useState } from "react";
import { Send, Pencil } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { issuesApi } from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pager from "../components/Pager";
import { Loading, ErrorBox, Empty } from "../components/Feedback";
import { ISSUE_STATUSES } from "../config/roles";
import { formatDate } from "../utils/format";

const PAGE_SIZE = 10;

// ===== The IssuesPage component =====
export default function IssuesPage({ can, notify, filter }) {
  // ===== State =====
  const [view, setView] = useState(can.viewAllIssues ? "all" : "mine");
  const [status, setStatus] = useState(filter.status || "");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ title: "", description: "" });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  // GET /issues (admin, manager) or GET /issues/my (everyone with an employee profile)
  const issues = useFetch(
    () => (view === "all" ? issuesApi.list({ page, page_size: PAGE_SIZE, status }) : issuesApi.mine({ page, page_size: PAGE_SIZE })),
    [view, status, page]
  );

  // ===== Raise an issue: POST /issues =====
  async function raise(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await issuesApi.create({ title: form.title.trim(), description: form.description.trim() });
      notify("Issue reported – the operations team has been notified");
      setForm({ title: "", description: "" });
      issues.reload();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  // ===== Move an issue along: PUT /issues/{id}/status (admin, manager) =====
  async function changeStatus(issue, newStatus) {
    try {
      await issuesApi.setStatus(issue.issue_id, newStatus);
      notify('"' + issue.title + '" is now ' + newStatus);
      issues.reload();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  // ===== What the page looks like =====
  return (
    <>
      <div className="card">
        <h3 className="card-title">Report an operational issue</h3>
        <form className="form-grid" onSubmit={raise}>
          <label className="field"><span>Title *</span>
            <input id="issue-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} placeholder="e.g. Printer jammed at desk 4" required />
          </label>
          <label className="field wide"><span>What happened and where? *</span>
            <input id="issue-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} required />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}><Send size={15} /> {busy ? "Sending…" : "Submit issue"}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          {can.viewAllIssues && (
            <div className="tabs">
              <button className={view === "all" ? "tab active" : "tab"} onClick={() => { setView("all"); setPage(1); }}>All issues</button>
              <button className={view === "mine" ? "tab active" : "tab"} onClick={() => { setView("mine"); setPage(1); }}>Raised by me</button>
            </div>
          )}
          {!can.viewAllIssues && <h3 className="card-title">My submitted issues</h3>}
          {view === "all" && (
            <div className="tabs">
              {["", ...ISSUE_STATUSES].map((s) => (
                <button key={s || "any"} className={status === s ? "tab active" : "tab"} onClick={() => { setStatus(s); setPage(1); }}>{s || "Any status"}</button>
              ))}
            </div>
          )}
        </div>

        {issues.loading && <Loading />}
        {issues.error && <ErrorBox message={issues.error} onRetry={issues.reload} />}
        {issues.data && issues.data.items.length === 0 && <Empty text="No issues here." />}
        {issues.data && issues.data.items.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Issue</th><th>Raised by</th><th>Raised on</th><th>Last update</th><th>Status</th>{can.changeIssueStatus && <th></th>}</tr></thead>
              <tbody>
                {issues.data.items.map((i) => (
                  <tr key={i.issue_id}>
                    <td><div className="strong">{i.title}</div><div className="muted small">{i.description}</div></td>
                    <td>{i.raised_by_name}</td>
                    <td>{formatDate(i.created_at)}</td>
                    <td>{formatDate(i.updated_at)}</td>
                    <td>
                      {can.changeIssueStatus ? (
                        <select className={"inline-select status-select tone-" + i.status.replace(" ", "")} value={i.status} onChange={(e) => changeStatus(i, e.target.value)} aria-label={"Status of " + i.title}>
                          {ISSUE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ) : <StatusBadge status={i.status} />}
                    </td>
                    {can.changeIssueStatus && <td><button className="icon-btn" title="Edit" onClick={() => setEditing(i)}><Pencil size={16} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {issues.data && <Pager page={page} pageSize={PAGE_SIZE} total={issues.data.total} onChange={setPage} />}
      </div>

      {editing && <IssueForm issue={editing} notify={notify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); issues.reload(); }} />}
    </>
  );
}

// ===== Edit an issue's wording: PUT /issues/{id} (admin, manager) =====
function IssueForm({ issue, notify, onClose, onSaved }) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description || "");
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    try {
      await issuesApi.update(issue.issue_id, { title, description });
      notify("Issue updated");
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Edit issue" onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="field wide"><span>Title *</span><input id="if-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required /></label>
        <label className="field wide"><span>Description</span><textarea id="if-description" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></label>
        {error && <div className="form-error wide">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save</button>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
