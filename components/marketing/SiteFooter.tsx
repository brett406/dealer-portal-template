import Link from "next/link";
import "./site-footer.css";

export function SiteFooter({ brandName }: { brandName: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-brand">
          <strong>{brandName}</strong>
          <p>Your trusted dealer partner.</p>
        </div>

        <nav className="site-footer-links">
          <div className="site-footer-col">
            <h4>Company</h4>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/blog">Blog</Link>
          </div>
          <div className="site-footer-col">
            <h4>Products</h4>
            <Link href="/products">Catalog</Link>
            <Link href="/auth/login">Dealer Login</Link>
          </div>
        </nav>

        <div className="site-footer-bottom">
          <p>&copy; {year} {brandName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
