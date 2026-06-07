import { describe, it, expect, vi, beforeEach } from "vitest";

// updatePageContent must support two modes:
//  - full-form admin editor (no __partial): rebuild payload from all submitted
//    fields (original behavior).
//  - inline "edit on the page" save (__partial): merge only the submitted
//    field(s) over the stored record, preserving untouched fields AND seo.

const mockPrisma = {
  pageContent: { findUnique: vi.fn(), upsert: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "u1", email: "admin@example.com" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sanitize", () => ({ sanitizeRichtext: (s: string) => s }));
vi.mock("@/lib/content-config", () => ({
  getPageDef: vi.fn(() => ({
    label: "Home",
    fields: {
      headline: { type: "text", label: "Headline" },
      body: { type: "richtext", label: "Body" },
      heroImage: { type: "image", label: "Hero" },
    },
  })),
}));

const { updatePageContent } = await import("@/app/admin/pages/actions");

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("updatePageContent merge semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.pageContent.upsert.mockResolvedValue({});
  });

  it("full-form submit (no __partial) rebuilds payload and does not read existing", async () => {
    await updatePageContent("home", {}, fd({
      field_headline: "Hi",
      field_body: "<p>x</p>",
      field_heroImage: "/a.jpg",
    }));

    expect(mockPrisma.pageContent.findUnique).not.toHaveBeenCalled();
    const arg = mockPrisma.pageContent.upsert.mock.calls[0][0];
    expect(arg.update.payload).toEqual({ headline: "Hi", body: "<p>x</p>", heroImage: "/a.jpg" });
  });

  it("partial inline submit merges over existing, preserving untouched fields + SEO", async () => {
    mockPrisma.pageContent.findUnique.mockResolvedValue({
      payload: { headline: "OLD", body: "OLDBODY", heroImage: "/old.jpg" },
      seo: { title: "SEO Title" },
    });

    await updatePageContent("home", {}, fd({ __partial: "1", field_headline: "NEW" }));

    expect(mockPrisma.pageContent.findUnique).toHaveBeenCalledWith({ where: { pageKey: "home" } });
    const arg = mockPrisma.pageContent.upsert.mock.calls[0][0];
    // Only headline changed; body + heroImage preserved.
    expect(arg.update.payload).toEqual({ headline: "NEW", body: "OLDBODY", heroImage: "/old.jpg" });
    // SEO is never touched by an inline save.
    expect(arg.update.seo).toEqual({ title: "SEO Title" });
  });
});
