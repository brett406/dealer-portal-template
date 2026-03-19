import Link from "next/link";
import { getTheme } from "@/lib/theme";
import { getPageContent, getPageGroup } from "@/lib/cms";
import { Button } from "@/components/ui/Button";
import "./marketing.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const theme = getTheme();
  const [page, features] = await Promise.all([
    getPageContent("home"),
    getPageGroup("home", "features"),
  ]);

  const p = page?.payload ?? {};
  const headline = (p.headline as string) || `Welcome to ${theme.brand.name}`;
  const subheadline = (p.subheadline as string) || "Your trusted wholesale partner for quality products.";
  const ctaText = (p.ctaText as string) || "Get Started";
  const ctaHref = (p.ctaHref as string) || "/auth/login";

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <h1>{headline}</h1>
          <p>{subheadline}</p>
          <Link href={ctaHref} className="hero-cta">
            {ctaText}
          </Link>
        </div>
      </section>

      {/* Features */}
      {features.length > 0 && (
        <section className="features-section">
          <div className="container">
            <h2>Why Choose Us</h2>
            <div className="features-grid">
              {features.map((f) => (
                <div key={f.id} className="feature-card">
                  {f.payload.icon ? <div className="feature-icon">{String(f.payload.icon)}</div> : null}
                  <h3>{String(f.payload.title ?? "")}</h3>
                  <p>{String(f.payload.description ?? "")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <h2>{(p.ctaSectionTitle as string) || "Ready to get started?"}</h2>
          <p>{(p.ctaSectionBody as string) || "Create an account or log in to browse our full catalog and place orders."}</p>
          <div className="cta-buttons">
            <Button href="/auth/login">Login</Button>
            <Button href="/contact" variant="secondary">Contact Us</Button>
          </div>
        </div>
      </section>
    </>
  );
}
