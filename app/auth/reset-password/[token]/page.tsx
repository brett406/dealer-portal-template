import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ResetPasswordForm, type ResetPasswordFormState } from "@/components/ui/reset-password-form";

export const dynamic = "force-dynamic";

async function resetPasswordAction(
  _state: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  "use server";

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 12) {
    return { success: false, error: "Password must be at least 12 characters." };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
    return { success: false, error: "This reset link is invalid or has expired." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    }),
    prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true, error: null };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
  });

  const isValid = resetRecord && !resetRecord.usedAt && resetRecord.expiresAt > new Date();

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Set new password</h1>
          <p>Enter your new password below.</p>
        </div>

        {isValid ? (
          <ResetPasswordForm action={resetPasswordAction} token={token} />
        ) : (
          <div className="login-error">
            This reset link is invalid or has expired.
            <div className="login-links" style={{ marginTop: "1rem" }}>
              <a href="/auth/forgot-password">Request a new reset link</a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
