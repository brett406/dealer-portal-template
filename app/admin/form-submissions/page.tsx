import { prisma } from "@/lib/prisma";
import { FormSubmissionsClient } from "./submissions-client";

export const dynamic = "force-dynamic";

export default async function FormSubmissionsPage() {
  const submissions = await prisma.formSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

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
    </div>
  );
}
