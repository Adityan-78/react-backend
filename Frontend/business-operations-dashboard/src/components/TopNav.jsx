// ===== Imports =====
import {
  LayoutDashboard, Users, Contact, ShoppingCart, Boxes, ClipboardList,
  ListChecks, AlertTriangle, LogOut, Building2,
} from "lucide-react";
import { MODULES, ROLE_LABELS } from "../config/roles";
import { DEMO_MODE } from "../api/client";

// ===== One icon per module =====
const ICONS = {
  overview: LayoutDashboard,
  users: Users,
  customers: Contact,
  orders: ShoppingCart,
  inventory: Boxes,
  purchases: ClipboardList,
  tasks: ListChecks,
  issues: AlertTriangle,
};

// ===== The TopNav component: one horizontal menu bar =====
// Logo on the left, the role's menu in the middle, the user and Log out on the right.
export default function TopNav({ menu, activePage, onNavigate, user, onLogout }) {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <div className="brand-logo"><Building2 size={18} /></div>
          <span className="brand-name">BizOps</span>
          {DEMO_MODE && <span className="demo-pill">Demo data</span>}
        </div>

        <nav className="menu" aria-label="Main menu">
          {menu.map((key) => {
            const Icon = ICONS[key];
            return (
              <button
                key={key}
                className={key === activePage ? "menu-item active" : "menu-item"}
                onClick={() => onNavigate(key)}
                aria-current={key === activePage ? "page" : undefined}
              >
                <Icon size={16} />
                <span>{MODULES[key]}</span>
              </button>
            );
          })}
        </nav>

        <div className="user-box">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="user-text">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{ROLE_LABELS[user.role]}</div>
          </div>
          <button className="icon-btn on-dark" title="Log out" onClick={onLogout} aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
