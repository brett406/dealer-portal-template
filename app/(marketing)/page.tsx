import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { prisma } from "@/lib/prisma";
import { getPageContent, getPageGroup, getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import { HeroEntrance } from "@/components/marketing/HeroEntrance";
import "./marketing.css";

/* Below-fold components: lazy-loaded to reduce initial JS bundle */
const FaqAccordion = nextDynamic(() => import("@/components/marketing/FaqAccordion").then(m => m.FaqAccordion));
const ParallaxImage = nextDynamic(() => import("@/components/marketing/ParallaxImage").then(m => m.ParallaxImage));

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = settings?.siteTitle ?? getTheme().brand.name;
  return {
    title: settings?.defaultSeoTitle ?? brand,
    description: settings?.defaultSeoDescription ?? settings?.siteDescription ?? undefined,
    alternates: { canonical: "/" },
  };
}

const defaultFaqs = [
  { number: "01", question: "What is the minimum order to become a dealer?", answer: "There is no set minimum. We work with dealers of all sizes and tailor a program that makes sense for your operation. Reach out to discuss what works best." },
  { number: "02", question: "Do you ship across the country?", answer: "Yes. Freight is arranged based on your location and order size — we'll work with you to find the most cost-effective shipping solution." },
  { number: "03", question: "Can you recommend which products sell best?", answer: "Absolutely. Our team can help you select the right product mix based on your market and customer base." },
  { number: "04", question: "How do I open a wholesale account?", answer: "Fill out our dealer application form or contact us directly. We'll review your information and get you set up with wholesale pricing." },
];

export default async function HomePage() {
  const complete = await isSetupComplete();
  if (!complete) redirect("/setup");

  const page = await getPageContent("home");
  const p = (page?.payload ?? {}) as Record<string, string>;

  const [brandCards, faqGroup] = await Promise.all([
    getPageGroup("home", "brands"),
    getPageGroup("home", "faqs"),
  ]);

  const faqItems = faqGroup.length > 0
    ? faqGroup.map((item) => ({
        number: String(item.payload.number ?? ""),
        question: String(item.payload.question ?? ""),
        answer: String(item.payload.answer ?? ""),
      }))
    : defaultFaqs;

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

  const headlineLines = (p.headline || "").split("\n");
  const dependableHeading = (p.dependableHeading || "").split("\n");

  return (
    <>
      {/* ── Hero ── */}
      <section className="dp-hero">
        <HeroEntrance>
          <h1 className="dp-hero-title">
            {headlineLines.length > 0
              ? headlineLines.map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < headlineLines.length - 1 && <br />}
                  </span>
                ))
              : "Welcome to your dealer portal."}
            {p.headlineAccent && (
              <>
                {" "}
                <span className="dp-accent">{p.headlineAccent}</span>
              </>
            )}
          </h1>
          <div className="dp-hero-cta">
            <Link href={p.ctaHref || "/become-a-dealer"} className="dp-pill-btn">
              {p.ctaText || "Become a dealer"}
              <span className="dp-pill-arrow">
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </Link>
          </div>
          <div className="dp-hero-sub">
            <p>{p.subheadline || "Wholesale ordering, dealer programs, and product information in one place."}</p>
            <Link href="#brands" className="dp-explore-link">
              Explore
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M6 2L6 10M6 10L3 7M6 10L9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </HeroEntrance>
      </section>

      {/* ── Featured Products ── */}
      {featuredProducts.length > 0 && (
        <ScrollReveal>
          <section className="dp-section">
            <div className="dp-product-grid">
              {featuredProducts.map((prod, i) => {
                const img = prod.images[0];
                return (
                  <Link key={prod.id} href={`/products/${prod.category.slug}/${prod.slug}`} className="dp-product-card">
                    <div className="dp-product-thumb">
                      {img ? (
                        <Image
                          src={img.url}
                          alt={img.altText || prod.name}
                          fill
                          sizes="(max-width: 640px) 140px, 180px"
                          style={{ objectFit: "contain", padding: "1rem" }}
                          priority={i < 4}
                          loading={i < 4 ? "eager" : "lazy"}
                        />
                      ) : (
                        <div className="dp-product-placeholder" aria-label={prod.name}>
                          <span>{prod.name}</span>
                        </div>
                      )}
                    </div>
                    <p className="dp-product-name">{prod.name}</p>
                    <p className="dp-product-desc">{prod.category.name}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── Dependable Tools ── */}
      {p.dependableImage && (
        <ScrollReveal>
          <section className="dp-section">
            <div className="dp-two-col">
              <div>
                <h2 className="dp-heading">
                  {dependableHeading.map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < dependableHeading.length - 1 && <br />}
                    </span>
                  ))}
                </h2>
                <div className="dp-inline-cta">
                  <span>{p.dependableCta || "Ready to partner with us?"}</span>
                  <Link href="/become-a-dealer" className="dp-text-link">
                    {p.dependableCtaLinkText || "Open an account"}
                  </Link>
                </div>
              </div>
              <div className="dp-rounded-img">
                <Image
                  src={p.dependableImage}
                  alt={p.dependableHeading || "Dependable tools"}
                  width={600}
                  height={700}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  loading="lazy"
                />
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── How It Works ── */}
      {p.howItWorksBody && (
        <ScrollReveal>
          <section className="dp-section">
            <p className="dp-label">{p.howItWorksLabel || "How it works"}</p>
            <p className="dp-body-text">{p.howItWorksBody}</p>
          </section>
        </ScrollReveal>
      )}

      {/* ── Two Image Grid ── */}
      {(p.gridImage1 || p.gridImage2) && (
        <ScrollReveal>
          <section className="dp-section">
            <div className="dp-image-grid">
              {p.gridImage1 && (
                <div className="dp-rounded-img">
                  <Image
                    src={p.gridImage1}
                    alt=""
                    width={600}
                    height={600}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    loading="lazy"
                  />
                </div>
              )}
              {p.gridImage2 && (
                <div className="dp-rounded-img dp-overlay-img">
                  <Image
                    src={p.gridImage2}
                    alt=""
                    width={600}
                    height={600}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    loading="lazy"
                  />
                  <div className="dp-overlay" />
                  {p.gridOverlayText && (
                    <h3 className="dp-overlay-text">{p.gridOverlayText}</h3>
                  )}
                </div>
              )}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── Brands ── */}
      {brandCards.length > 0 && (
        <ScrollReveal>
          <section id="brands" className="dp-section">
            <p className="dp-label" style={{ textAlign: "center" }}>{p.brandsLabel || "Our brands"}</p>
            {p.brandsIntro && (
              <p className="dp-body-text" style={{ textAlign: "center", margin: "0 auto 1rem" }}>
                {p.brandsIntro}
              </p>
            )}

            <div className="dp-brand-grid">
              {brandCards.map((card) => {
                const name = String(card.payload.name ?? "");
                const category = String(card.payload.category ?? "");
                const logo = String(card.payload.logo ?? "");
                return (
                  <div key={card.id} className="dp-brand-card">
                    {logo && (
                      <div className="dp-brand-logo-wrap">
                        <img src={logo} alt={name} className="dp-brand-logo" width={120} height={60} loading="lazy" />
                      </div>
                    )}
                    {name && <p className="dp-brand-name">{name}</p>}
                    {category && <p className="dp-brand-cat">{category}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── Featured Categories ── */}
      {featuredCategories.length > 0 && (
        <>
          <ScrollReveal>
            <section className="dp-section">
              <div className="dp-product-intro">
                <h2 className="dp-heading">{p.featuredCategoriesHeading || "Featured categories"}</h2>
                {p.featuredCategoriesIntro && (
                  <p className="dp-body-text">{p.featuredCategoriesIntro}</p>
                )}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="dp-section">
              <div className="dp-product-grid">
                {featuredCategories.map((cat) => {
                  const productImage = cat.products[0]?.images[0];
                  const imgSrc = cat.imageUrl || productImage?.url;
                  const imgAlt = cat.imageUrl ? cat.name : (productImage?.altText || cat.name);
                  return (
                    <Link key={cat.id} href={`/products/${cat.slug}`} className="dp-product-card">
                      <div className="dp-product-thumb">
                        {imgSrc ? (
                          <Image
                            src={imgSrc}
                            alt={imgAlt}
                            fill
                            sizes="(max-width: 640px) 140px, 180px"
                            style={{ objectFit: "contain", padding: "1rem" }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="dp-product-placeholder" aria-label={cat.name}>
                            <span>{cat.name}</span>
                          </div>
                        )}
                      </div>
                      <p className="dp-product-name">{cat.name}</p>
                      <p className="dp-product-desc">{cat._count.products} product{cat._count.products !== 1 ? "s" : ""}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          </ScrollReveal>
        </>
      )}

      {/* ── Landscape Image ── */}
      {p.landscapeImage && (
        <ScrollReveal>
          <section className="dp-section">
            <ParallaxImage className="dp-rounded-img">
              <Image
                src={p.landscapeImage}
                alt=""
                width={1400}
                height={480}
                sizes="100vw"
                loading="lazy"
              />
            </ParallaxImage>
          </section>
        </ScrollReveal>
      )}

      {/* ── FAQ Section ── */}
      <ScrollReveal>
        <section className="dp-section">
          <p className="dp-label">{p.faqLabel || "Frequently asked questions"}</p>
          {p.faqIntro && (
            <p className="dp-body-text" style={{ marginBottom: "1rem" }}>{p.faqIntro}</p>
          )}
          <FaqAccordion items={faqItems} />
        </section>
      </ScrollReveal>

      {/* ── CTA Section ── */}
      <ScrollReveal>
        <section className="dp-section">
          <div className="dp-cta-block">
            <h2 className="dp-heading dp-heading-white">
              {p.ctaSectionTitle || "Ready to get started?"}
              {p.ctaSectionAccent && (
                <>
                  {" "}
                  <span className="dp-accent">{p.ctaSectionAccent}</span>
                </>
              )}
            </h2>
            <div className="dp-hero-cta">
              <Link href={p.ctaSectionButtonHref || "/contact"} className="dp-pill-btn dp-pill-btn-light">
                {p.ctaSectionButtonText || "Contact us"}
                <span className="dp-pill-arrow">
                  <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </Link>
            </div>
            {p.ctaSectionTagline && (
              <p className="dp-cta-tagline">{p.ctaSectionTagline}</p>
            )}
            {p.ctaSectionBody && (
              <p className="dp-cta-desc">{p.ctaSectionBody}</p>
            )}
          </div>
        </section>
      </ScrollReveal>
    </>
  );
}
