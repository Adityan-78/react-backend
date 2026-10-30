// ===== One meaning, one colour, everywhere =====
// green = done/good, amber = waiting, red = problem, blue/violet = moving along, grey = neutral.
const TONE_BY_STATUS = {
  Pending: "amber", Confirmed: "blue", Shipped: "violet", Delivered: "green", Cancelled: "grey",
  "In Progress": "blue", Completed: "green", Overdue: "red",
  Low: "grey", Medium: "amber", High: "red", Critical: "red",
  Open: "amber", Resolved: "green", Closed: "grey",
  Approved: "green", Rejected: "red",
  Active: "green", Inactive: "grey", "Awaiting approval": "amber", "Ready to go live": "blue",
  "Low stock": "amber", "Out of stock": "red", "In stock": "green",
};

// The same colours as hex codes, for the charts.
export const TONE_HEX = {
  amber: "#f59e0b", blue: "#3b6ff5", violet: "#8b5cf6", green: "#22a05a", grey: "#94a3b8", red: "#e5484d",
};

export function toneOf(status) {
  return TONE_BY_STATUS[status] || "grey";
}

export function colourOf(status) {
  return TONE_HEX[toneOf(status)];
}

// ===== The StatusBadge component =====
// Shows a word like "Pending" in a small coloured pill. The word is always shown,
// so the meaning never depends on colour alone.
export default function StatusBadge({ status }) {
  return <span className={"badge badge-" + toneOf(status)}>{status}</span>;
}
