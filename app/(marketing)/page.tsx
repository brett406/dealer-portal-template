import Link from "next/link";
import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import "./marketing.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const complete = await isSetupComplete();
  if (!complete) redirect("/setup");

  return (
    <>
      {/* ── Hero ── */}
      <section className="bcp-hero">
        <h1 className="bcp-hero-title">
          Built for Canadian<br /><span className="bcp-accent">farmers.</span>
        </h1>
        <div className="bcp-hero-cta">
          <Link href="/become-a-dealer" className="bcp-pill-btn">
            Become a dealer
            <span className="bcp-pill-arrow">
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </Link>
        </div>
        <div className="bcp-hero-sub">
          <p>Wholesale farm, stable &amp;<br />landscape tools you can count on.</p>
          <Link href="#brands" className="bcp-explore-link">
            Explore
            <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M6 2L6 10M6 10L3 7M6 10L9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>
      </section>

      {/* ── Hero Image ── */}
      <section className="bcp-section">
        <div className="bcp-hero-image">
          <img src="https://placehold.co/1400x600/1B2A4A/fff?text=Farm+Tools+in+Action" alt="Farm tools being used on a Canadian farm" />
        </div>
      </section>

      {/* ── Dependable Tools ── */}
      <section className="bcp-section">
        <div className="bcp-two-col">
          <div>
            <h2 className="bcp-heading-lg">Dependable tools<br />for every season.</h2>
            <div className="bcp-inline-cta">
              <span>Ready to partner with us?</span>
              <Link href="/become-a-dealer" className="bcp-text-link">Open an account</Link>
            </div>
          </div>
          <div className="bcp-rounded-img">
            <img src="https://placehold.co/600x700/4A7C44/fff?text=Stable+Tools" alt="Premium stable and farm tools" />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bcp-section bcp-section-sm">
        <p className="bcp-label">How it works</p>
        <p className="bcp-body-text">
          When you become a Bauman dealer, we start by understanding your market.
          We present competitive wholesale pricing, maintain reliable inventory, and support
          you with clean, professional branding that moves product off the shelf.
        </p>
      </section>

      <div className="bcp-divider" />

      {/* ── Two Image Grid ── */}
      <section className="bcp-section">
        <div className="bcp-image-grid">
          <div className="bcp-rounded-img">
            <img src="https://placehold.co/600x600/1B2A4A/fff?text=Wheelbarrow" alt="Scenic Road wheelbarrow" />
          </div>
          <div className="bcp-rounded-img bcp-overlay-img">
            <img src="https://placehold.co/600x600/4A7C44/ddd?text=Farm+Scene" alt="Canadian farm landscape" />
            <div className="bcp-overlay" />
            <h3 className="bcp-overlay-text">Tools built for<br />Canadian conditions</h3>
          </div>
        </div>
      </section>

      {/* ── Our Brands ── */}
      <section id="brands" className="bcp-section bcp-section-sm">
        <p className="bcp-label">Our brands</p>
        <p className="bcp-body-text">
          Bauman Custom Products brings you three trusted product lines — Scenic Road
          wheelbarrows, ScrapeRake barn scrapers, and StableScraper stable tools.
          Each brand is designed for durability and built for the demands of Canadian farming.
        </p>
      </section>

      {/* ── Product Selection ── */}
      <section className="bcp-section">
        <div className="bcp-two-col bcp-two-col-bottom">
          <p className="bcp-body-text">We offer a full range of farm, stable, and landscape tools.</p>
          <h2 className="bcp-heading-lg">Choose the right tools for your operation.</h2>
        </div>
      </section>

      {/* ── Product Grid ── */}
      <section className="bcp-section">
        <div className="bcp-product-grid">
          <div className="bcp-product-card">
            <div className="bcp-product-thumb">
              <img src="https://placehold.co/180x260/F0F2F5/1B2A4A?text=Barn+Fork" alt="Barn Fork" />
            </div>
            <p className="bcp-product-name">Barn Fork</p>
            <p className="bcp-product-desc">Stable essential</p>
          </div>
          <div className="bcp-product-card">
            <div className="bcp-product-thumb">
              <img src="https://placehold.co/180x260/F0F2F5/4A7C44?text=Wheelbarrow" alt="Scenic Road Wheelbarrow" />
            </div>
            <p className="bcp-product-name">Scenic Road Wheelbarrow</p>
            <p className="bcp-product-desc">Heavy-duty hauling</p>
          </div>
          <div className="bcp-product-card">
            <div className="bcp-product-thumb">
              <img src="https://placehold.co/180x260/F0F2F5/C0272D?text=Scraper" alt="StableScraper" />
            </div>
            <p className="bcp-product-name">StableScraper</p>
            <p className="bcp-product-desc">Barn floor tool</p>
          </div>
          <div className="bcp-product-card">
            <div className="bcp-product-thumb">
              <img src="https://placehold.co/180x260/F0F2F5/1B2A4A?text=Broom" alt="Push Broom" />
            </div>
            <p className="bcp-product-name">Push Broom</p>
            <p className="bcp-product-desc">Landscape cleanup</p>
          </div>
        </div>
      </section>

      {/* ── Landscape Image ── */}
      <section className="bcp-section">
        <div className="bcp-rounded-img">
          <img src="https://placehold.co/1400x480/4A7C44/fff?text=Canadian+Farmland" alt="Canadian farmland landscape" />
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section className="bcp-section">
        <div className="bcp-two-col">
          <h2 className="bcp-heading-lg">Not sure if becoming a Bauman dealer is right for you?</h2>
          <div className="bcp-rounded-img">
            <img src="https://placehold.co/500x340/1B2A4A/fff?text=Dealer+Partnership" alt="Dealer partnership" />
          </div>
        </div>
      </section>

      <section className="bcp-section">
        <p className="bcp-label">Frequently asked questions</p>
        <div className="bcp-faq">
          <div className="bcp-faq-item">
            <div className="bcp-faq-left"><span className="bcp-faq-num">01</span><span>What is the minimum order to become a dealer?</span></div>
            <div className="bcp-faq-icon"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M6 3V9M3 6H9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
          </div>
          <div className="bcp-faq-item">
            <div className="bcp-faq-left"><span className="bcp-faq-num">02</span><span>Do you ship across Canada?</span></div>
            <div className="bcp-faq-icon"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M6 3V9M3 6H9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
          </div>
          <div className="bcp-faq-item">
            <div className="bcp-faq-left"><span className="bcp-faq-num">03</span><span>Can you recommend which products sell best?</span></div>
            <div className="bcp-faq-icon"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M6 3V9M3 6H9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
          </div>
          <div className="bcp-faq-item">
            <div className="bcp-faq-left"><span className="bcp-faq-num">04</span><span>How do I open a wholesale account?</span></div>
            <div className="bcp-faq-icon"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M6 3V9M3 6H9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="bcp-section">
        <div className="bcp-cta-block">
          <h2 className="bcp-heading-xl">Ready to partner<br />with <span className="bcp-accent">Bauman?</span></h2>
          <div className="bcp-hero-cta">
            <Link href="/contact" className="bcp-pill-btn bcp-pill-btn-red">
              Contact us
              <span className="bcp-pill-arrow bcp-pill-arrow-navy">
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </Link>
          </div>
          <p className="bcp-cta-tagline">Wholesale farm, stable &amp; landscape tools for Canadian dealers.</p>
          <p className="bcp-cta-desc">
            We&apos;ll listen to your needs, identify the right product mix, and set you up with
            competitive wholesale pricing and reliable inventory support.
          </p>
        </div>
      </section>
    </>
  );
}
