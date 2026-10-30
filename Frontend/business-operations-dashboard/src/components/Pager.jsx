// ===== Imports =====
import { ChevronLeft, ChevronRight } from "lucide-react";

// ===== The Pager component =====
// The API returns lists one page at a time: { items, total, page, page_size }.
// Pager shows "Showing 1–10 of 34" and Previous / Next buttons.
export default function Pager({ page, pageSize, total, onChange }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pager">
      <span className="muted small">
        Showing {from}–{to} of {total}
      </span>
      <div className="pager-buttons">
        <button className="btn btn-light" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} /> Previous
        </button>
        <span className="small">Page {page} of {lastPage}</span>
        <button className="btn btn-light" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
