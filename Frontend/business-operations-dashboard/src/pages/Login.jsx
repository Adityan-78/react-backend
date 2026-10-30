// ===== Imports =====
import { useState } from "react";
import { Building2, Mail, Lock, ShieldCheck, Loader2 } from "lucide-react";
import { authApi } from "../api/endpoints";
import { DEMO_MODE, API_BASE } from "../api/client";

// Demo accounts exist only in demo mode (the real backend has its own users).
const DEMO_ACCOUNTS = [
  { label: "Administrator", email: "admin@demo.com", password: "Admin123" },
  { label: "Manager", email: "manager@demo.com", password: "Manager123" },
  { label: "Sales Executive", email: "sales@demo.com", password: "Sales123" },
  { label: "Inventory Executive", email: "inventory@demo.com", password: "Inventory123" },
  { label: "Employee", email: "employee@demo.com", password: "Employee123" },
];

// ===== The Login component =====
export default function Login({ onLogin }) {
  // ===== State for the form =====
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false); // true while waiting for the server

  // ===== Sign in: POST /auth/login =====
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await authApi.login(email.trim(), password);
      onLogin(result); // { access_token, token_type, user }
    } catch (err) {
      // 401 = wrong details, 429 = too many attempts (locked for 15 minutes)
      if (err.status === 429) setError("Too many failed attempts. Please wait 15 minutes and try again.");
      else if (err.status === 401) setError("Email or password is incorrect.");
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ===== What the login screen looks like =====
  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="brand-logo big"><Building2 size={28} /></div>
        <h1>BizOps</h1>
        <p>Sales orders, inventory, tasks, purchase requests and approvals – in one place.</p>
        <ul className="login-points">
          <li><ShieldCheck size={16} /> Role-based access for 5 user types</li>
          <li><ShieldCheck size={16} /> Low-stock alerts and new-product approvals</li>
          <li><ShieldCheck size={16} /> Overdue task and delayed approval tracking</li>
        </ul>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          <p className="muted">Use your company email and password.</p>

          <label className="field">
            <span>Email</span>
            <div className="input-icon">
              <Mail size={16} />
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required autoComplete="username" />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="input-icon">
              <Lock size={16} />
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <><Loader2 size={16} className="spin" /> Signing in…</> : "Sign in"}
          </button>

          {DEMO_MODE ? (
            <div className="demo-box">
              <div className="demo-title">Demo accounts — click one to fill the form</div>
              <div className="demo-grid">
                {DEMO_ACCOUNTS.map((account) => (
                  <button type="button" key={account.email} className="demo-chip"
                    onClick={() => { setEmail(account.email); setPassword(account.password); setError(""); }}>
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted small">Connected to {API_BASE}</p>
          )}
        </form>
      </div>
    </div>
  );
}
