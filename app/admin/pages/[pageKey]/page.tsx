import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPageDef } from "@/lib/content-config";
import { getPageContent, getPageGroup } from "@/lib/cms";
import { updatePageContent } from "../actions";
import { PageEditorClient } from "../page-editor-client";
import "../pages.css";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}) {
  const { pageKey } = await params;

  const pageDef = getPageDef(pageKey);
  if (!pageDef) notFound();

  const content = await getPageContent(pageKey);

  // Load group items if groups are defined
  const groups: Record<string, { id: string; sortOrder: number; payload: Record<string, unknown> }[]> = {};
  if (pageDef.groups) {
    for (const groupKey of Object.keys(pageDef.groups)) {
      groups[groupKey] = await getPageGroup(pageKey, groupKey);
    }
  }

  const boundUpdate = updatePageContent.bind(null, pageKey);

  // Serialize field defs for client
  const fieldDefs = Object.entries(pageDef.fields).map(([key, def]) => ({
    key,
    type: def.type,
    label: def.label,
    default: def.default,
  }));

  const groupDefs = pageDef.groups
    ? Object.entries(pageDef.groups).map(([key, def]) => ({
        key,
        label: def.label,
        fields: Object.entries(def.fields).map(([fk, fd]) => ({
          key: fk,
          type: fd.type,
          label: fd.label,
        })),
      }))
    : [];

  return (
    <div>
      <Link href="/admin/pages" style={{ fontSize: "0.85rem", color: "var(--color-primary)", textDecoration: "none" }}>
        &larr; Back to Pages
      </Link>
      <h1 style={{ marginTop: "0.75rem" }}>Edit: {pageDef.label}</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        /{pageKey === "home" ? "" : pageKey}
      </p>

      <PageEditorClient
        pageKey={pageKey}
        fieldDefs={fieldDefs}
        groupDefs={groupDefs}
        currentPayload={content?.payload ?? {}}
        currentSeo={content?.seo ?? {}}
        currentGroups={groups}
        formAction={boundUpdate}
      />
    </div>
  );
}
