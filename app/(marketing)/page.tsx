import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { prisma } from "@/lib/prisma";
import { getPageContent } from "@/lib/cms";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import { HeroEntrance } from "@/components/marketing/HeroEntrance";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { ParallaxImage } from "@/components/marketing/ParallaxImage";
import "./marketing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wholesale Farm, Stable & Landscape Tools for Canadian Retailers | Bauman Custom Products",
  alternates: { canonical: "/" },
};

const faqItems = [
  { number: "01", question: "What is the minimum order to become a dealer?", answer: "There is no set minimum order. We work with dealers of all sizes and will tailor a program that makes sense for your operation. Contact us to discuss what works best for you." },
  { number: "02", question: "Do you ship across Canada?", answer: "Yes, we ship to dealers across Canada. Freight is arranged based on your location and order size, and we'll work with you to find the most cost-effective shipping solution." },
  { number: "03", question: "Can you recommend which products sell best?", answer: "Absolutely. Our team can help you select the right product mix based on your market and customer base. We know which items move well in different regions and operations." },
  { number: "04", question: "How do I open a wholesale account?", answer: "Simply fill out our dealer application form or contact us directly. We'll review your information and get you set up with wholesale pricing and access to our full product line." },
];

export default async function HomePage() {
  const complete = await isSetupComplete();
  if (!complete) redirect("/setup");

  const page = await getPageContent("home");
  const p = (page?.payload ?? {}) as Record<string, string>;

  const featuredProducts = await prisma.product.findMany({
    where: { active: true, featured: true },
    orderBy: { sortOrder: "asc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      category: { select: { name: true, slug: true } },
    },
    take: 8,
  });

  const featuredCategories = await prisma.productCategory.findMany({
    where: { active: true, featured: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { active: true },
        include: { images: { where: { isPrimary: true }, take: 1 } },
        take: 1,
      },
      _count: { select: { products: { where: { active: true } } } },
    },
  });

  return (
    <>
      {/* ── Hero ── */}
      <section className="bcp-hero">
        <HeroEntrance>
          <h1 className="bcp-hero-title">
            {p.headline || <>Built for Canadian<br /><span className="bcp-accent">farmers.</span></>}
          </h1>
          <div className="bcp-hero-cta">
            <Link href={p.ctaHref || "/become-a-dealer"} className="bcp-pill-btn">
              {p.ctaText || "Become a dealer"}
              <span className="bcp-pill-arrow">
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </Link>
          </div>
          <div className="bcp-hero-sub">
            <p>{p.subheadline || <>Wholesale farm, stable &amp;<br />landscape tools you can count on.</>}</p>
            <Link href="#brands" className="bcp-explore-link">
              Explore
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M6 2L6 10M6 10L3 7M6 10L9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </HeroEntrance>
      </section>

      {/* ── Featured Products ── */}
      {featuredProducts.length > 0 && (
        <ScrollReveal>
          <section className="bcp-section">
            <div className="bcp-product-grid">
              {featuredProducts.map((prod) => {
                const img = prod.images[0];
                return (
                  <Link key={prod.id} href={`/products/${prod.category.slug}/${prod.slug}`} className="bcp-product-card">
                    <div className="bcp-product-thumb">
                      {img ? (
                        <img src={img.url} alt={img.altText || prod.name} />
                      ) : (
                        <img src={`https://placehold.co/180x260/F0F2F5/1B2A4A?text=${encodeURIComponent(prod.name)}`} alt={prod.name} />
                      )}
                    </div>
                    <p className="bcp-product-name">{prod.name}</p>
                    <p className="bcp-product-desc">{prod.category.name}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── Dependable Tools ── */}
      <ScrollReveal>
        <section className="bcp-section">
          <div className="bcp-two-col">
            <div>
              <h2 className="bcp-heading">Dependable tools<br />for every season.</h2>
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
      </ScrollReveal>

      {/* ── How It Works ── */}
      <ScrollReveal>
        <section className="bcp-section">
          <p className="bcp-label">How it works</p>
          <p className="bcp-body-text">
            When you become a Bauman dealer, we start by understanding your market.
            We present competitive wholesale pricing, maintain reliable inventory, and support
            you with clean, professional branding that moves product off the shelf.
          </p>
        </section>
      </ScrollReveal>

      {/* ── Two Image Grid ── */}
      <ScrollReveal>
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
      </ScrollReveal>

      {/* ── Our Brands ── */}
      <ScrollReveal>
        <section id="brands" className="bcp-section">
          <p className="bcp-label" style={{ textAlign: "center" }}>Our brands</p>
          <p className="bcp-body-text" style={{ textAlign: "center", margin: "0 auto 1rem" }}>
            Eight product lines covering every corner of the farm — from stable tools
            and wheelbarrows to livestock watering, plumbing, and industrial hardware.
          </p>

          <div className="bcp-brand-grid">
            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/scenic-road.svg" alt="Scenic Road" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">Scenic Road</p>
              <p className="bcp-brand-cat">Wheelbarrows, Carts &amp; Wagons</p>
            </div>

            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/scraperake.svg" alt="ScrapeRake" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">ScrapeRake</p>
              <p className="bcp-brand-cat">Barn Scrapers &amp; Rakes</p>
            </div>

            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/stablescraper.svg" alt="StableScraper" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">StableScraper</p>
              <p className="bcp-brand-cat">Stable Cleaning Tools</p>
            </div>

            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/hogflo.svg" alt="HogFlo" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">HogFlo</p>
              <p className="bcp-brand-cat">Hog Watering Products</p>
            </div>

            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/hydra2oh.svg" alt="Hydra2Oh" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">Hydra2Oh</p>
              <p className="bcp-brand-cat">Livestock Watering Products</p>
            </div>

            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/baumstock.svg" alt="BaumStock" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">BaumStock</p>
              <p className="bcp-brand-cat">General Farm Supplies</p>
            </div>

            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/baumfast.svg" alt="BaumFast" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">BaumFast</p>
              <p className="bcp-brand-cat">Industrial &amp; Ag Hardware</p>
            </div>

            <div className="bcp-brand-card">
              <div className="bcp-brand-logo-wrap">
                <img src="/uploads/brands/baumflo.svg" alt="BaumFlo" className="bcp-brand-logo" />
              </div>
              <p className="bcp-brand-name">BaumFlo</p>
              <p className="bcp-brand-cat">Plumbing Fittings, Hose &amp; Valves</p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Featured Categories ── */}
      {featuredCategories.length > 0 && (
        <>
          <ScrollReveal>
            <section className="bcp-section">
              <div className="bcp-product-intro">
                <h2 className="bcp-heading">Featured categories</h2>
                <p className="bcp-body-text">We offer a full range of farm, stable, and landscape tools — built to last and priced to move.</p>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="bcp-section">
              <div className="bcp-product-grid">
                {featuredCategories.map((cat) => {
                  const productImage = cat.products[0]?.images[0];
                  const imgSrc = cat.imageUrl || productImage?.url;
                  const imgAlt = cat.imageUrl ? cat.name : (productImage?.altText || cat.name);
                  return (
                    <Link key={cat.id} href={`/products/${cat.slug}`} className="bcp-product-card">
                      <div className="bcp-product-thumb">
                        {imgSrc ? (
                          <img src={imgSrc} alt={imgAlt} />
                        ) : (
                          <img src={`https://placehold.co/180x260/F0F2F5/1B2A4A?text=${encodeURIComponent(cat.name)}`} alt={cat.name} />
                        )}
                      </div>
                      <p className="bcp-product-name">{cat.name}</p>
                      <p className="bcp-product-desc">{cat._count.products} product{cat._count.products !== 1 ? "s" : ""}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          </ScrollReveal>
        </>
      )}

      {/* ── Landscape Image ── */}
      <ScrollReveal>
        <section className="bcp-section">
          <ParallaxImage className="bcp-rounded-img">
            <img src="https://placehold.co/1400x480/4A7C44/fff?text=Canadian+Farmland" alt="Canadian farmland landscape" />
          </ParallaxImage>
        </section>
      </ScrollReveal>

      {/* ── FAQ Section ── */}
      <ScrollReveal>
        <section className="bcp-section">
          <p className="bcp-label">Frequently asked questions</p>
          <p className="bcp-body-text" style={{ marginBottom: "1rem" }}>
            Not sure if becoming a Bauman dealer is right for you? Here are the questions we hear most.
          </p>
          <FaqAccordion items={faqItems} />
        </section>
      </ScrollReveal>

      {/* ── CTA Section ── */}
      <ScrollReveal>
        <section className="bcp-section">
          <div className="bcp-cta-block">
            <h2 className="bcp-heading bcp-heading-white">{p.ctaSectionTitle || <>Ready to partner<br />with <span className="bcp-accent">Bauman?</span></>}</h2>
            <div className="bcp-hero-cta">
              <Link href="/contact" className="bcp-pill-btn bcp-pill-btn-light">
                Contact us
                <span className="bcp-pill-arrow">
                  <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </Link>
            </div>
            <p className="bcp-cta-tagline">Wholesale farm, stable &amp; landscape tools for Canadian dealers.</p>
            <p className="bcp-cta-desc">
              {p.ctaSectionBody || "We'll listen to your needs, identify the right product mix, and set you up with competitive wholesale pricing and reliable inventory support."}
            </p>
          </div>
        </section>
      </ScrollReveal>
    </>
  );
}
