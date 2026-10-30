// ===== Dates =====
// Today as "YYYY-MM-DD" (the date format the API uses).
export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Turns "2026-10-29" or "2026-10-29T10:00:00" into "29 Oct 2026".
export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// How many whole days ago a date was.
export function daysSince(value) {
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor((new Date(today()) - new Date(String(value).slice(0, 10))) / oneDay);
}

export function daysLabel(count) {
  return count === 1 ? "1 day" : count + " days";
}

// ===== Money =====
// The API sends money as text such as "125.50". Number() turns it into a number first.
export function formatMoney(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Short form for chart labels: 125000 -> "₹1.3L"
export function shortMoney(value) {
  const n = Number(value || 0);
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(1) + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1) + "K";
  return "₹" + n;
}

// ===== Product categories inside the description =====
// "[Stationery] Blue ink" -> { category: "Stationery", text: "Blue ink" }
export function splitCategory(description) {
  const match = /^\[(.+?)\]\s*(.*)$/.exec(description || "");
  if (match) return { category: match[1], text: match[2] };
  return { category: "Other", text: description || "" };
}

// ("Stationery", "Blue ink") -> "[Stationery] Blue ink"
export function joinCategory(category, text) {
  return "[" + category + "] " + text.trim();
}

// ===== New-product requests inside purchase request notes =====
// A request for a brand-new product carries its reference link and image in the item notes:
// "NEW PRODUCT REQUEST | ref: https://... | img: https://... | why it is needed"
const NEW_PRODUCT_TAG = "NEW PRODUCT REQUEST";

export function buildProductRequestNote(referenceLink, imageUrl, reason) {
  return NEW_PRODUCT_TAG + " | ref: " + referenceLink.trim() + " | img: " + imageUrl.trim() + " | " + reason.trim();
}

export function readProductRequestNote(notes) {
  if (!notes || !notes.startsWith(NEW_PRODUCT_TAG)) return null;
  const parts = notes.split(" | ");
  const find = (label) => (parts.find((p) => p.startsWith(label + ": ")) || "").slice(label.length + 2);
  return {
    referenceLink: find("ref"),
    imageUrl: find("img"),
    reason: parts.slice(3).join(" | "),
  };
}

// Simple check that a text looks like a web address.
export function isUrl(text) {
  return /^https?:\/\/\S+\.\S+/.test((text || "").trim());
}
