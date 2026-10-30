// ===== Imports =====
import { demoRequest } from "./demoServer";

// ===== Settings read from the .env file =====
// import.meta.env is how Vite gives us values from the .env file.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

// ===== Saving the login token =====
// The backend gives us a token when we log in. We keep it in the browser's
// localStorage and send it with every request so the server knows who we are.
const TOKEN_KEY = "access_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ===== A special error that remembers the HTTP status code =====
// Pages can check error.status (401, 403, 409 ...) to decide what to show.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ===== Turn the server's "detail" into a readable sentence =====
// FastAPI sends a text for most errors, but a list of problems for 422 validation errors.
function readableMessage(detail, status) {
  if (!detail) return "Request failed (" + status + ")";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((problem) => {
        const field = (problem.loc || []).filter((part) => part !== "body").join(" › ");
        return field ? field + ": " + problem.msg : problem.msg;
      })
      .join(" · ");
  }
  return JSON.stringify(detail);
}

// What to do when the token expires (App fills this in with "log out").
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// ===== apiFetch: the ONE function every page uses to talk to the backend =====
// path   – e.g. "/orders?page=1"
// method – "GET", "POST", "PUT" or "DELETE"
// body   – a JavaScript object that will be sent as JSON (optional)
export async function apiFetch(path, { method = "GET", body } = {}) {
  const token = getToken();

  // Demo mode: answer from the built-in sample backend instead of the network.
  if (DEMO_MODE) {
    const result = await demoRequest(method, path, body, token);
    if (result.status === 401 && token) onUnauthorized();
    if (result.status >= 400) throw new ApiError(readableMessage(result.body?.detail, result.status), result.status);
    return result.body;
  }

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server at " + API_BASE + ". Is the backend running?", 0);
  }

  // 204 = "No Content": success, but there is no JSON to read.
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // 401 on a protected call means the token is missing or expired -> log out.
    if (response.status === 401 && token) onUnauthorized();
    throw new ApiError(readableMessage(data?.detail, response.status), response.status);
  }
  return data;
}

// ===== Build a query string from an object =====
// query({ page: 1, status: "Pending", search: "" }) -> "?page=1&status=Pending"
// Empty values are skipped so we never send "status=".
export function query(params) {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => encodeURIComponent(key) + "=" + encodeURIComponent(value));
  return parts.length ? "?" + parts.join("&") : "";
}
