import Link from "next/link";
import Image from "next/image";
import "./site-footer.css";

export function SiteFooter({ brandName }: { brandName: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <Image src="/uploads/logo.png" alt={brandName} width={48} height={48} className="site-footer-logo" />
          </div>
          <div className="site-footer-contact">
            <p className="site-footer-phone">519.698.0717</p>
            <p className="site-footer-email">sales@bcpinc.ca</p>
          </div>
        </div>

        <div className="site-footer-divider" />

        <div className="site-footer-bottom">
          <p>&copy; {year} {brandName}. All rights reserved.</p>
          <nav className="site-footer-links">
            <Link href="/products">Products</Link>
            <Link href="/about">About</Link>
            <Link href="/become-a-dealer">Dealers</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/auth/login">Login</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
