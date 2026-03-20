"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import "./portal-header.css";

const navLinks = [
  { href: "/portal/dashboard", label: "Dashboard" },
  { href: "/portal/catalog", label: "Catalog" },
  { href: "/portal/cart", label: "Cart" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/account", label: "Account" },
];

export function PortalHeader({
  brandName,
  logo,
  userName,
  cartItemCount = 0,
}: {
  brandName: string;
  logo: string;
  userName: string;
  cartItemCount?: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="portal-header">
      <div className="container portal-header-inner">
        <Link href="/portal/dashboard" className="portal-header-brand">
          <Image src={logo} alt={brandName} width={32} height={32} className="portal-header-logo" />
          <span className="portal-header-name">{brandName}</span>
        </Link>

        <button
          className="portal-header-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          <span className="portal-header-hamburger" />
        </button>

        <nav className={`portal-header-nav ${menuOpen ? "open" : ""}`}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`portal-header-link${link.label === "Cart" ? " portal-header-cart-link" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
              {link.label === "Cart" && cartItemCount > 0 && (
                <span className="portal-cart-badge">{cartItemCount}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="portal-header-user">
          <span className="portal-header-user-name">{userName}</span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="portal-header-logout">
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
