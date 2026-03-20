"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import type { FormState } from "./actions";
import "./seo.css";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

type FieldDef = { key: string; type: string; label: string; default?: string };

// ─── Schema types & their fields ──────────────────────────────────────────────

const SCHEMA_TYPES = [
  { value: "", label: "None" },
  { value: "Article", label: "Article" },
  { value: "Organization", label: "Organization" },
  { value: "Product", label: "Product" },
  { value: "FAQ", label: "FAQ" },
  { value: "LocalBusiness", label: "Local Business" },
  { value: "Event", label: "Event" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function charClass(len: number, min: number, max: number): string {
  if (len === 0) return "seo-counter";
  if (len < min) return "seo-counter seo-counter-warn";
  if (len > max) return "seo-counter seo-counter-over";
  return "seo-counter seo-counter-ok";
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="seo-section">
      <button type="button" className="seo-section-header" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className="seo-section-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="seo-section-body">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SeoTab({
  pageKey,
  currentSeo,
  formAction,
  fieldDefs,
  currentPayload,
}: {
  pageKey: string;
  currentSeo: Record<string, unknown>;
  formAction: (state: FormState, formData: FormData) => Promise<FormState>;
  fieldDefs: FieldDef[];
  currentPayload: Record<string, unknown>;
}) {
  const [state, action] = useActionState(formAction, {});

  // ── Live state ──
  const [title, setTitle] = useState((currentSeo.title as string) ?? "");
  const [description, setDescription] = useState((currentSeo.description as string) ?? "");
  const [focusKeyword, setFocusKeyword] = useState((currentSeo.focusKeyword as string) ?? "");
  const [slug, setSlug] = useState(pageKey === "home" ? "" : pageKey);

  // Open Graph
  const [ogTitle, setOgTitle] = useState((currentSeo.ogTitle as string) ?? "");
  const [ogDescription, setOgDescription] = useState((currentSeo.ogDescription as string) ?? "");
  const [ogImage, setOgImage] = useState((currentSeo.ogImage as string) ?? "");
  const [twitterCard, setTwitterCard] = useState((currentSeo.twitterCard as string) ?? "summary_large_image");

  // Indexing
  const [indexable, setIndexable] = useState((currentSeo.indexable as string) !== "false");
  const [followable, setFollowable] = useState((currentSeo.followable as string) !== "false");
  const [canonical, setCanonical] = useState((currentSeo.canonical as string) ?? "");
  const [redirect301, setRedirect301] = useState((currentSeo.redirect301 as string) ?? "");

  // Structured data
  const [schemaType, setSchemaType] = useState((currentSeo.schemaType as string) ?? "");
  const [schemaData, setSchemaData] = useState<Record<string, string>>(() => {
    try {
      return (currentSeo.schemaData as Record<string, string>) ?? {};
    } catch {
      return {};
    }
  });
  const [faqItems, setFaqItems] = useState<{ q: string; a: string }[]>(() => {
    try {
      return (currentSeo.faqItems as { q: string; a: string }[]) ?? [];
    } catch {
      return [];
    }
  });

  // OG image upload
  const [uploading, setUploading] = useState(false);
  async function handleOgImageUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setOgImage(data.url);
    setUploading(false);
  }

  // Effective OG values
  const effectiveOgTitle = ogTitle || title;
  const effectiveOgDesc = ogDescription || description;
  const displayUrl = `/${slug}`;

  // ── Schema JSON-LD ──
  function buildJsonLd(): string | null {
    if (!schemaType) return null;
    const base: Record<string, unknown> = { "@context": "https://schema.org" };
    if (schemaType === "Article") {
      base["@type"] = "Article";
      base.headline = schemaData.headline || title;
      if (schemaData.author) base.author = { "@type": "Person", name: schemaData.author };
      if (schemaData.datePublished) base.datePublished = schemaData.datePublished;
      if (schemaData.dateModified) base.dateModified = schemaData.dateModified;
    } else if (schemaType === "Organization") {
      base["@type"] = "Organization";
      base.name = schemaData.orgName || "";
      if (schemaData.orgUrl) base.url = schemaData.orgUrl;
    } else if (schemaType === "Product") {
      base["@type"] = "Product";
      base.name = schemaData.productName || "";
      if (schemaData.productPrice) {
        base.offers = {
          "@type": "Offer",
          price: schemaData.productPrice,
          priceCurrency: schemaData.productCurrency || "CAD",
          availability: schemaData.productAvailability || "InStock",
        };
      }
    } else if (schemaType === "FAQ") {
      base["@type"] = "FAQPage";
      base.mainEntity = faqItems.filter((f) => f.q && f.a).map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      }));
    } else if (schemaType === "LocalBusiness") {
      base["@type"] = "LocalBusiness";
      base.name = schemaData.bizName || "";
      if (schemaData.bizPhone) base.telephone = schemaData.bizPhone;
      if (schemaData.bizAddress) base.address = schemaData.bizAddress;
      if (schemaData.bizHours) base.openingHours = schemaData.bizHours;
    } else if (schemaType === "Event") {
      base["@type"] = "Event";
      base.name = schemaData.eventName || "";
      if (schemaData.eventStart) base.startDate = schemaData.eventStart;
      if (schemaData.eventEnd) base.endDate = schemaData.eventEnd;
      if (schemaData.eventLocation) base.location = { "@type": "Place", name: schemaData.eventLocation };
    }
    return JSON.stringify(base, null, 2);
  }

  // ── Content analysis ──
  const kw = focusKeyword.toLowerCase().trim();
  const checks = [
    { label: "Focus keyword in Meta Title", pass: kw.length > 0 && title.toLowerCase().includes(kw) },
    { label: "Focus keyword in Meta Description", pass: kw.length > 0 && description.toLowerCase().includes(kw) },
    { label: "Focus keyword in URL", pass: kw.length > 0 && slug.toLowerCase().includes(kw.replace(/\s+/g, "-")) },
    { label: "Meta Title is 50-60 characters", pass: title.length >= 50 && title.length <= 60 },
    { label: "Meta Description is 120-160 characters", pass: description.length >= 120 && description.length <= 160 },
  ];

  const jsonLd = buildJsonLd();

  return (
    <form action={action} className="seo-form">
      {state.success && <div className="status-message status-success">SEO settings saved.</div>}
      {state.error && <div className="status-message status-error">{state.error}</div>}

      {/* Preserve content fields */}
      {fieldDefs.map((field) => (
        <input key={field.key} type="hidden" name={`field_${field.key}`} value={(currentPayload[field.key] as string) ?? field.default ?? ""} />
      ))}

      {/* ── Search Engine Preview ── */}
      <div className="seo-preview-card">
        <h3>Search Engine Preview</h3>
        <div className="seo-serp">
          <div className="seo-serp-title">{truncate(title || "Page Title", 60)}</div>
          <div className="seo-serp-url">example.com{displayUrl}</div>
          <div className="seo-serp-desc">{truncate(description || "Add a meta description to see a preview here.", 160)}</div>
        </div>
        {(effectiveOgTitle || ogImage) && (
          <div className="seo-og-preview">
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>Social Media Preview</p>
            <div className="seo-og-card">
              {ogImage && <img src={ogImage} alt="" className="seo-og-image" />}
              <div className="seo-og-body">
                <div className="seo-og-title">{truncate(effectiveOgTitle || "Page Title", 60)}</div>
                <div className="seo-og-desc">{truncate(effectiveOgDesc || "", 160)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Basic SEO ── */}
      <Section title="Basic SEO" defaultOpen>
        <div className="seo-field">
          <label>Meta Title</label>
          <input name="seo_title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title for search engines" />
          <span className={charClass(title.length, 50, 60)}>{title.length}/60</span>
        </div>

        <div className="seo-field">
          <label>Meta Description</label>
          <textarea name="seo_description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description for search results" rows={3} />
          <span className={charClass(description.length, 120, 160)}>{description.length}/160</span>
        </div>

        <div className="seo-field">
          <label>Focus Keyword</label>
          <input name="seo_focusKeyword" value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} placeholder="e.g., dealer portal" />
        </div>

        <div className="seo-field">
          <label>URL Slug</label>
          <div className="seo-slug-row">
            <span className="seo-slug-prefix">/{pageKey === "home" ? "" : ""}</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={pageKey} />
          </div>
        </div>
      </Section>

      {/* ── Open Graph / Social ── */}
      <Section title="Open Graph / Social">
        <div className="seo-field">
          <label>OG Title <span className="seo-field-hint">(defaults to Meta Title if empty)</span></label>
          <input name="seo_ogTitle" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} placeholder={title || "Same as Meta Title"} />
        </div>

        <div className="seo-field">
          <label>OG Description <span className="seo-field-hint">(defaults to Meta Description if empty)</span></label>
          <textarea name="seo_ogDescription" value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} placeholder={description || "Same as Meta Description"} rows={2} />
        </div>

        <div className="seo-field">
          <label>OG Image <span className="seo-field-hint">(recommended: 1200x630px)</span></label>
          <div className="page-image-field">
            {ogImage && <img src={ogImage} alt="" className="page-image-preview" />}
            <div className="page-image-controls">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOgImageUpload(f); }}
                style={{ fontSize: "0.8rem" }}
              />
              <input type="hidden" name="seo_ogImage" value={ogImage} />
              {uploading && <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Uploading...</span>}
            </div>
          </div>
        </div>

        <div className="seo-field">
          <label>Twitter Card Type</label>
          <select name="seo_twitterCard" value={twitterCard} onChange={(e) => setTwitterCard(e.target.value)}>
            <option value="summary">Summary</option>
            <option value="summary_large_image">Summary with Large Image</option>
          </select>
        </div>
      </Section>

      {/* ── Indexing & Crawling ── */}
      <Section title="Indexing & Crawling">
        <div className="seo-toggle-row">
          <label>
            <input type="checkbox" name="seo_indexable" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} />
            Allow search engines to index this page
          </label>
        </div>

        <div className="seo-toggle-row">
          <label>
            <input type="checkbox" name="seo_followable" checked={followable} onChange={(e) => setFollowable(e.target.checked)} />
            Allow search engines to follow links on this page
          </label>
        </div>

        <div className="seo-field">
          <label>Canonical URL</label>
          <input name="seo_canonical" value={canonical} onChange={(e) => setCanonical(e.target.value)} placeholder="https://example.com/page" />
          <span className="seo-field-hint">Leave blank to use the page&#39;s own URL. Set this to avoid duplicate content.</span>
        </div>

        <div className="seo-field">
          <label>301 Redirect</label>
          <input name="seo_redirect301" value={redirect301} onChange={(e) => setRedirect301(e.target.value)} placeholder="/new-page-path" />
          <span className="seo-field-hint">If set, visitors to this page will be redirected to this path.</span>
        </div>
      </Section>

      {/* ── Structured Data ── */}
      <Section title="Structured Data">
        <div className="seo-field">
          <label>Schema Type</label>
          <select name="seo_schemaType" value={schemaType} onChange={(e) => { setSchemaType(e.target.value); setSchemaData({}); setFaqItems([]); }}>
            {SCHEMA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {schemaType === "Article" && (
          <>
            <SField label="Author" k="author" data={schemaData} set={setSchemaData} />
            <SField label="Published Date" k="datePublished" data={schemaData} set={setSchemaData} type="date" />
            <SField label="Modified Date" k="dateModified" data={schemaData} set={setSchemaData} type="date" />
          </>
        )}

        {schemaType === "Organization" && (
          <>
            <SField label="Organization Name" k="orgName" data={schemaData} set={setSchemaData} />
            <SField label="Website URL" k="orgUrl" data={schemaData} set={setSchemaData} />
          </>
        )}

        {schemaType === "Product" && (
          <>
            <SField label="Product Name" k="productName" data={schemaData} set={setSchemaData} />
            <SField label="Price" k="productPrice" data={schemaData} set={setSchemaData} />
            <SField label="Currency" k="productCurrency" data={schemaData} set={setSchemaData} placeholder="CAD" />
            <div className="seo-field">
              <label>Availability</label>
              <select value={schemaData.productAvailability ?? "InStock"} onChange={(e) => setSchemaData((d) => ({ ...d, productAvailability: e.target.value }))}>
                <option value="InStock">In Stock</option>
                <option value="OutOfStock">Out of Stock</option>
                <option value="PreOrder">Pre-Order</option>
              </select>
            </div>
          </>
        )}

        {schemaType === "FAQ" && (
          <div className="seo-faq-list">
            {faqItems.map((item, idx) => (
              <div key={idx} className="seo-faq-item">
                <input placeholder="Question" value={item.q} onChange={(e) => { const next = [...faqItems]; next[idx] = { ...next[idx], q: e.target.value }; setFaqItems(next); }} />
                <textarea placeholder="Answer" rows={2} value={item.a} onChange={(e) => { const next = [...faqItems]; next[idx] = { ...next[idx], a: e.target.value }; setFaqItems(next); }} />
                <button type="button" className="seo-faq-remove" onClick={() => setFaqItems(faqItems.filter((_, i) => i !== idx))}>Remove</button>
              </div>
            ))}
            <button type="button" className="seo-faq-add" onClick={() => setFaqItems([...faqItems, { q: "", a: "" }])}>+ Add Question</button>
          </div>
        )}

        {schemaType === "LocalBusiness" && (
          <>
            <SField label="Business Name" k="bizName" data={schemaData} set={setSchemaData} />
            <SField label="Address" k="bizAddress" data={schemaData} set={setSchemaData} />
            <SField label="Phone" k="bizPhone" data={schemaData} set={setSchemaData} />
            <SField label="Opening Hours" k="bizHours" data={schemaData} set={setSchemaData} placeholder="Mo-Fr 09:00-17:00" />
          </>
        )}

        {schemaType === "Event" && (
          <>
            <SField label="Event Name" k="eventName" data={schemaData} set={setSchemaData} />
            <SField label="Start Date" k="eventStart" data={schemaData} set={setSchemaData} type="datetime-local" />
            <SField label="End Date" k="eventEnd" data={schemaData} set={setSchemaData} type="datetime-local" />
            <SField label="Location" k="eventLocation" data={schemaData} set={setSchemaData} />
          </>
        )}

        {jsonLd && (
          <div className="seo-field">
            <label>JSON-LD Preview</label>
            <pre className="seo-jsonld">{jsonLd}</pre>
          </div>
        )}

        {/* Serialize structured data into hidden fields */}
        <input type="hidden" name="seo_schemaData" value={JSON.stringify(schemaData)} />
        <input type="hidden" name="seo_faqItems" value={JSON.stringify(faqItems)} />
      </Section>

      {/* ── Content Analysis ── */}
      {focusKeyword && (
        <Section title="Content Analysis" defaultOpen>
          <ul className="seo-checklist">
            {checks.map((c, i) => (
              <li key={i} className={c.pass ? "seo-check-pass" : "seo-check-fail"}>
                <span>{c.pass ? "✓" : "✗"}</span>
                {c.label}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Hidden fields for indexing toggles */}
      <input type="hidden" name="seo_indexable" value={indexable ? "true" : "false"} />
      <input type="hidden" name="seo_followable" value={followable ? "true" : "false"} />

      <div className="page-form-actions" style={{ marginTop: "1.5rem" }}>
        <SubmitButton label="Save SEO" />
      </div>
    </form>
  );
}

// ─── Schema field helper ──────────────────────────────────────────────────────

function SField({
  label,
  k,
  data,
  set,
  type = "text",
  placeholder,
}: {
  label: string;
  k: string;
  data: Record<string, string>;
  set: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="seo-field">
      <label>{label}</label>
      <input
        type={type}
        value={data[k] ?? ""}
        onChange={(e) => set((d) => ({ ...d, [k]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );
}
