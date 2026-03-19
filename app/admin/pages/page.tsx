import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPageKeys } from "@/lib/content-config";
import { Button } from "@/components/ui/Button";
import "./pages.css";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const pageKeys = getPageKeys();

  // Get last-edited dates from DB
  const pages = await prisma.pageContent.findMany({
    where: { pageKey: { in: pageKeys.map((p) => p.key) } },
    select: { pageKey: true, updatedAt: true },
  });

  const dateMap = new Map(pages.map((p) => [p.pageKey, p.updatedAt]));

  return (
    <div>
      <h1>Pages</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Edit marketing page content, SEO, and repeatable sections.
      </p>

      <div className="pages-list">
        {pageKeys.map((page) => {
          const lastEdited = dateMap.get(page.key);
          return (
            <div key={page.key} className="page-card">
              <div className="page-card-info">
                <h3>{page.label}</h3>
                <p>
                  /{page.key === "home" ? "" : page.key}
                  {lastEdited && ` · Edited ${lastEdited.toLocaleDateString()}`}
                  {!lastEdited && " · Not yet edited"}
                </p>
              </div>
              <Button variant="secondary" size="sm" href={`/admin/pages/${page.key}`}>
                Edit
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
