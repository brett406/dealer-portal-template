"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type ChangePasswordFormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function changeInitialPassword(
  _prev: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const parsed = schema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed, mustChangePassword: false },
  });

  // Redirect based on role — can't use getPostLoginRedirect because the JWT
  // still has the old mustChangePassword=true until the token refreshes
  const role = session.user.role;
  if (role === "SUPER_ADMIN" || role === "STAFF") {
    redirect("/admin");
  } else {
    redirect("/portal/catalog");
  }
}

export async function skipPasswordChange(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mustChangePassword: false },
  });

  // Redirect to normal destination
  redirect(
    session.user.role === "SUPER_ADMIN" || session.user.role === "STAFF"
      ? "/admin"
      : "/portal/catalog",
  );
}
