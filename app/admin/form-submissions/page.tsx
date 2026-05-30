import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/ui/Pagination";
import { buildPageMeta, getPageParam, paginate, PER_PAGE } from "@/lib/pagination";
import { FormSubmissionsClient } from "./submissions-client";

export const dynamic = "force-dynamic";

export default async function FormSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const pageNum = getPageParam(page);
  const perPage = PER_PAGE.admin;

  const [submissions, totalCount] = await Promise.all([
    prisma.formSubmission.findMany({
      orderBy: { createdAt: "desc" },
      ...paginate(pageNum, perPage),
    }),
    prisma.formSubmission.count(),
  ]);

  const pageMeta = buildPageMeta(totalCount, pageNum, perPage);

  const data = submissions.map((s) => ({
    id: s.id,
    formKey: s.formKey,
    payload: s.payload as Record<string, string>,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1>Form Submissions</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Contact form and other form submissions.
      </p>
      <FormSubmissionsClient submissions={data} />

      <Pagination
        meta={{ ...pageMeta }}
        basePath="/admin/form-submissions"
        label="submissions"
      />
    </div>
  );
}
