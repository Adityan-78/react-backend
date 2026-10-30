// ===== The StatCard component =====
// A box with one important number. If onClick is given, the card becomes a
// button that opens the page behind the number (e.g. "Overdue tasks" -> Tasks).
export default function StatCard({ label, value, icon: Icon, tone = "blue", hint, onClick }) {
  const content = (
    <>
      <div className={"stat-icon tone-" + tone}>
        <Icon size={20} />
      </div>
      <div className="stat-text">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="stat-card clickable" onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className="stat-card">{content}</div>;
}
