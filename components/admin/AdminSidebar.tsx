"use client";

import { useState } from "react";
import Link from "next/link";
import "./admin-sidebar.css";

const navSections = [
  {
    label: "Main",
    links: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/orders", label: "Orders" },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
    ],
  },
  {
    label: "Customers",
    links: [
      { href: "/admin/companies", label: "Customers" },
      { href: "/admin/settings", label: "Users" },
    ],
  },
  {
    label: "Content",
    links: [
      { href: "/admin/pages", label: "Pages" },
      { href: "/admin/collections/blog", label: "Blog" },
      { href: "/admin/media", label: "Media" },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/price-levels", label: "Price Levels" },
      { href: "/admin/tax-rates", label: "Tax Rates" },
    ],
  },
];

export function AdminSidebar({
  brandName,
  userName,
}: {
  brandName: string;
  userName: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <button
        className="admin-sidebar-mobile-toggle"
        onClick={() => setCollapsed((v) => !v)}
        aria-label="Toggle sidebar"
      >
        <span className="admin-sidebar-hamburger" />
      </button>

      <div className={`admin-sidebar-overlay ${collapsed ? "open" : ""}`} onClick={() => setCollapsed(false)} />

      <aside className={`admin-sidebar ${collapsed ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <Link href="/admin" className="admin-sidebar-brand">
            {brandName}
          </Link>
          <span className="admin-sidebar-badge">Admin</span>
        </div>

        <nav className="admin-sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label} className="admin-sidebar-section">
              <span className="admin-sidebar-section-label">{section.label}</span>
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="admin-sidebar-link"
                  onClick={() => setCollapsed(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <span className="admin-sidebar-user-name">{userName}</span>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="admin-sidebar-logout">
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
