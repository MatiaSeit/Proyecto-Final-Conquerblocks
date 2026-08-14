import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AllianceInsignia, CloseIcon, MenuIcon } from "./Icons";

const NAV_SECTIONS: {
  title: string;
  links: { to: string; label: string; roles?: string[] }[];
}[] = [
  {
    title: "Overview",
    links: [{ to: "/", label: "Dashboard" }],
  },
  {
    title: "Inventory",
    links: [
      { to: "/components", label: "Components" },
      { to: "/stock", label: "Stock & Ledger" },
    ],
  },
  {
    title: "Operations",
    links: [
      { to: "/requisitions", label: "Requisitions", roles: ["QUARTERMASTER", "COMMAND"] },
      { to: "/deployment-orders", label: "Deployment Orders", roles: ["DISPATCHER", "COMMAND"] },
    ],
  },
  {
    title: "Master Data",
    links: [
      { to: "/bases", label: "Bases" },
      { to: "/suppliers", label: "Suppliers" },
      { to: "/squadrons", label: "Squadrons" },
    ],
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <button className="topbar__menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon style={{ width: 18, height: 18 }} />
          </button>
          <AllianceInsignia className="topbar__insignia" />
          <span className="brand">ALLIANCE SUPPLY COMMAND</span>
        </div>
        <div className="topbar__user">
          <span>
            {user?.username} · {user?.role}
          </span>
          <button className="btn" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="layout-body">
        {sidebarOpen && <div className="sidebar__backdrop" onClick={() => setSidebarOpen(false)} />}
        <nav className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
          <button
            className="topbar__menu-btn"
            style={{ marginBottom: "0.5rem" }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
          {NAV_SECTIONS.map((section) => {
            const visibleLinks = section.links.filter(
              (link) => !link.roles || (user && link.roles.includes(user.role))
            );
            if (visibleLinks.length === 0) return null;
            return (
              <div key={section.title}>
                <div className="nav-section-title">{section.title}</div>
                {visibleLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
