// Small components that show "loading", "error" and "nothing here" states,
// so every page handles these moments the same way.
import { AlertTriangle, Inbox } from "lucide-react";

// ===== Loading: grey shimmering placeholder rows =====
export function Loading({ rows = 3 }) {
  return (
    <div className="skeleton-group" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton" />
      ))}
    </div>
  );
}

// ===== ErrorBox: a red message with a "Try again" button =====
export function ErrorBox({ message, onRetry }) {
  return (
    <div className="error-box">
      <AlertTriangle size={18} />
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-light" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

// ===== Empty: shown when a list has no rows =====
export function Empty({ text }) {
  return (
    <div className="empty">
      <Inbox size={22} />
      <span>{text}</span>
    </div>
  );
}
