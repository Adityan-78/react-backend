// ===== Imports =====
import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { authApi } from "./api/endpoints";
import { getToken, saveToken, clearToken, setUnauthorizedHandler } from "./api/client";
import { MENU_BY_ROLE, MODULES, ROLE_LABELS, permissionsFor } from "./config/roles";
import { formatDate, today } from "./utils/format";
import TopNav from "./components/TopNav";
import { Loading } from "./components/Feedback";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import UsersPage from "./pages/UsersPage";
import CustomersPage from "./pages/CustomersPage";
import OrdersPage from "./pages/OrdersPage";
import InventoryPage from "./pages/InventoryPage";
import PurchasesPage from "./pages/PurchasesPage";
import TasksPage from "./pages/TasksPage";
import IssuesPage from "./pages/IssuesPage";

// ===== The App component =====
// App decides: login screen or dashboard? Which page? It also shows pop-up messages.
export default function App() {
  // ===== State: the app's memory =====
  const [user, setUser] = useState(null); // the logged-in user from the API
  const [checkingSession, setCheckingSession] = useState(true); // true while we check a saved token
  const [activePage, setActivePage] = useState("overview");
  const [pageFilter, setPageFilter] = useState({}); // e.g. { status: "Pending" } when a chart is clicked
  const [toast, setToast] = useState(null); // { message, type } or null

  // ===== Pop-up messages ("toasts") =====
  function notify(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500); // hide after 3.5 seconds
  }

  // ===== Log out =====
  function logout(message) {
    clearToken();
    setUser(null);
    setActivePage("overview");
    if (message) notify(message, "error");
  }

  // ===== On first load: is there a saved token? Ask the server who it belongs to =====
  useEffect(() => {
    // If any request later answers 401 (token expired), log the user out.
    setUnauthorizedHandler(() => logout("Your session has expired. Please sign in again."));

    if (!getToken()) {
      setCheckingSession(false);
      return;
    }
    authApi
      .me() // GET /auth/me
      .then((me) => setUser(me))
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Successful login (called by the Login page) =====
  function handleLogin(result) {
    saveToken(result.access_token);
    setUser(result.user);
    setActivePage("overview");
    notify("Welcome, " + result.user.name.split(" ")[0] + "!");
  }

  // ===== Move to another page, optionally with a filter already applied =====
  function goTo(page, filter = {}) {
    setPageFilter(filter);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ===== While checking the saved token, show a loading screen =====
  if (checkingSession) {
    return (
      <div className="center-screen">
        <Loading rows={3} />
      </div>
    );
  }

  // ===== Nobody logged in: show the login page =====
  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin} />
        {toast && <div className={"toast toast-" + toast.type}>{toast.message}</div>}
      </>
    );
  }

  // ===== Work out the menu and permissions for this role =====
  const menu = MENU_BY_ROLE[user.role] || ["overview"];
  const pageToShow = menu.includes(activePage) ? activePage : "overview";
  const pageProps = { user, can: permissionsFor(user.role), goTo, notify, filter: pageFilter };

  // ===== Pick the page =====
  function renderPage() {
    // "key" makes React start the page fresh when the filter changes.
    const key = pageToShow + JSON.stringify(pageFilter);
    if (pageToShow === "users") return <UsersPage key={key} {...pageProps} />;
    if (pageToShow === "customers") return <CustomersPage key={key} {...pageProps} />;
    if (pageToShow === "orders") return <OrdersPage key={key} {...pageProps} />;
    if (pageToShow === "inventory") return <InventoryPage key={key} {...pageProps} />;
    if (pageToShow === "purchases") return <PurchasesPage key={key} {...pageProps} />;
    if (pageToShow === "tasks") return <TasksPage key={key} {...pageProps} />;
    if (pageToShow === "issues") return <IssuesPage key={key} {...pageProps} />;
    return <Overview key={key} {...pageProps} />;
  }

  // ===== Layout: menu bar on top, page underneath =====
  return (
    <div className="app">
      <TopNav menu={menu} activePage={pageToShow} onNavigate={(page) => goTo(page)} user={user} onLogout={() => logout()} />
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">{MODULES[pageToShow]}</h1>
            <p className="page-sub">
              Welcome back, {user.name.split(" ")[0]} · <span className="role-pill">{ROLE_LABELS[user.role]}</span>
            </p>
          </div>
          <div className="date-chip">
            <CalendarDays size={16} /> {formatDate(today())}
          </div>
        </div>
        {renderPage()}
      </main>
      {toast && <div className={"toast toast-" + toast.type}>{toast.message}</div>}
    </div>
  );
}
