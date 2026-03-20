"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";

export async function deleteSubmission(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  await prisma.formSubmission.delete({ where: { id } });
  revalidatePath("/admin/form-submissions");
  return {};
}

export async function deleteAllSubmissions(formKey: string): Promise<{ error?: string }> {
  await requireAdmin();
  await prisma.formSubmission.deleteMany({ where: { formKey } });
  revalidatePath("/admin/form-submissions");
  return {};
}
