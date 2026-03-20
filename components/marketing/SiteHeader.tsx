"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import "./site-header.css";

const leftLinks = [
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
];

const rightLinks = [
  { href: "/become-a-dealer", label: "Dealers" },
];

export function SiteHeader({ brandName, logo }: { brandName: string; logo: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="site-header-stripe" />
      <header className="site-header">
        <div className="site-header-inner">
          <div className="site-header-left">
            <Link href="/" className="site-header-brand">
              <Image src={logo} alt={brandName} width={64} height={64} className="site-header-logo" />
            </Link>
            <nav className="site-header-nav-desktop">
              {leftLinks.map((link) => (
                <Link key={link.href} href={link.href} className="site-header-link">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <button
            className="site-header-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            <span className="site-header-hamburger" />
          </button>

          <div className={`site-header-right ${menuOpen ? "open" : ""}`}>
            {/* Show all links in mobile */}
            <div className="site-header-mobile-links">
              {leftLinks.map((link) => (
                <Link key={link.href} href={link.href} className="site-header-link" onClick={() => setMenuOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
            {rightLinks.map((link) => (
              <Link key={link.href} href={link.href} className="site-header-link" onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href="/contact" className="site-header-cta" onClick={() => setMenuOpen(false)}>
              Contact
            </Link>
            <Link href="/auth/login" className="site-header-link site-header-login" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
