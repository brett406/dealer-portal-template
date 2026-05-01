import { ForgotPasswordForm, type ForgotPasswordFormState } from "@/components/ui/forgot-password-form";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetLinkEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

async function forgotPasswordAction(
  _state: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { submitted: false, error: "Please enter your email address." };
  }

  // Rate limit: 3 reset requests per email+IP per hour
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`reset:${email}:${ip}`, 3, 3600);
  if (!rl.allowed) {
    return {
      submitted: false,
      error: `Too many requests. Please try again in ${Math.ceil((rl.retryAfterSeconds ?? 60) / 60)} minutes.`,
    };
  }

  const start = Date.now();

  // Always show success to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.active) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/auth/reset-password/${token}`;
    sendPasswordResetLinkEmail(email, user.name, resetUrl).catch(
      (err) => console.error("Failed to send password reset email:", err),
    );
  }

  // Ensure consistent response time to prevent timing-based email enumeration
  const elapsed = Date.now() - start;
  const minDelay = 500;
  if (elapsed < minDelay) {
    await new Promise((r) => setTimeout(r, minDelay - elapsed));
  }

  return { submitted: true, error: null };
}

export default function ForgotPasswordPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Reset your password</h1>
          <p>Enter your email and we'll send you a reset link.</p>
        </div>

        <ForgotPasswordForm action={forgotPasswordAction} />
      </div>
    </main>
  );
}
