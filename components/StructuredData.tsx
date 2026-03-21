/**
 * JSON-LD Structured Data for SEO
 * Renders Organization and LocalBusiness schema markup.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "https://bcpinc.ca";

function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bauman Custom Products",
    alternateName: "BCP",
    url: SITE_URL,
    logo: `${SITE_URL}/uploads/logo.png`,
    description:
      "Canadian wholesale distributor of farm, stable, and landscape tools. Scenic Road, ScrapeRake, and StableScraper brands.",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+1-519-698-0717",
      contactType: "sales",
      email: "sales@bcpinc.ca",
      areaServed: "CA",
      availableLanguage: "English",
    },
    sameAs: [],
  };
}

function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WholesaleStore",
    name: "Bauman Custom Products",
    alternateName: "BCP",
    url: SITE_URL,
    logo: `${SITE_URL}/uploads/logo.png`,
    image: `${SITE_URL}/uploads/logo.png`,
    description:
      "Wholesale distributor of farm, stable, and landscape tools for Canadian retailers. Brands include Scenic Road, ScrapeRake, and StableScraper.",
    telephone: "+1-519-698-0717",
    email: "sales@bcpinc.ca",
    address: {
      "@type": "PostalAddress",
      addressRegion: "ON",
      addressCountry: "CA",
    },
    areaServed: {
      "@type": "Country",
      name: "Canada",
    },
    priceRange: "$$",
  };
}

function faqSchema() {
  const faqs = [
    {
      question: "What is the minimum order to become a dealer?",
      answer:
        "There is no set minimum order. We work with dealers of all sizes and will tailor a program that makes sense for your operation. Contact us to discuss what works best for you.",
    },
    {
      question: "Do you ship across Canada?",
      answer:
        "Yes, we ship to dealers across Canada. Freight is arranged based on your location and order size, and we'll work with you to find the most cost-effective shipping solution.",
    },
    {
      question: "Can you recommend which products sell best?",
      answer:
        "Absolutely. Our team can help you select the right product mix based on your market and customer base. We know which items move well in different regions and operations.",
    },
    {
      question: "How do I open a wholesale account?",
      answer:
        "Simply fill out our dealer application form or contact us directly. We'll review your information and get you set up with wholesale pricing and access to our full product line.",
    },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema()) }}
      />
    </>
  );
}
