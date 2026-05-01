import Link from "next/link";
import Image from "next/image";
import "./site-footer.css";

type Props = {
  brandName: string;
  logo?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactAddress?: string | null;
};

export function SiteFooter({
  brandName,
  logo,
  contactPhone,
  contactEmail,
  contactAddress,
}: Props) {
  const year = new Date().getFullYear();
  const hasContact = contactPhone || contactEmail || contactAddress;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            {logo && (
              <Image src={logo} alt={brandName} width={160} height={48} className="site-footer-logo" />
            )}
          </div>
          {hasContact && (
            <div className="site-footer-contact">
              {contactPhone && <p className="site-footer-phone">{contactPhone}</p>}
              {contactEmail && <p className="site-footer-email">{contactEmail}</p>}
              {contactAddress && <p className="site-footer-address">{contactAddress}</p>}
            </div>
          )}
        </div>

        <div className="site-footer-divider" />

        <div className="site-footer-bottom">
          <p>&copy; {year} {brandName}. All rights reserved.</p>
          <nav className="site-footer-links">
            <Link href="/products">Products</Link>
            <Link href="/about">About</Link>
            <Link href="/become-a-dealer">Become a Dealer</Link>
            <Link href="/find-a-dealer">Find a Dealer</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/auth/login">Login</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
