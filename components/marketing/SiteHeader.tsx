"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import "./site-header.css";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/become-a-dealer", label: "Become a Dealer" },
  { href: "/contact", label: "Contact" },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader({ brandName, logo }: { brandName: string; logo: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="site-header-brand">
          <Image src={logo} alt={brandName} width={32} height={32} className="site-header-logo" />
          <span className="site-header-name">{brandName}</span>
        </Link>

        <button
          className="site-header-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          <span className="site-header-hamburger" />
        </button>

        <nav className={`site-header-nav ${menuOpen ? "open" : ""}`}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="site-header-link"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth/login"
            className="site-header-link site-header-login"
            onClick={() => setMenuOpen(false)}
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
