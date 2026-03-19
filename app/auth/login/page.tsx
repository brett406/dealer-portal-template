import { AuthError } from "next-auth";
import { signIn, auth, getPostLoginRedirect } from "@/lib/auth";
import { sanitizeRedirectPath } from "@/lib/auth-redirects";
import { redirect } from "next/navigation";
import { LoginForm, type LoginFormState } from "@/components/ui/login-form";

export const dynamic = "force-dynamic";

async function loginAction(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  "use server";

  const email = String(formData.get("email") ?? "");
  const redirectTo = sanitizeRedirectPath(formData.get("redirectTo"), "");

  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: redirectTo || undefined,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error ? String(error.code) : "";

      if (code === "rate_limited") {
        return {
          email,
          error: "Too many failed attempts. Please wait 15 minutes and try again.",
        };
      }

      if (code === "inactive_account") {
        return {
          email,
          error: "This account has been deactivated. Please contact your administrator.",
        };
      }

      return {
        email,
        error: "Invalid email or password. Please try again.",
      };
    }

    throw error;
  }

  return { error: null, email };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, session] = await Promise.all([searchParams, auth()]);

  // Redirect already-authenticated users
  if (session?.user) {
    redirect(getPostLoginRedirect(session));
  }

  const next = typeof params?.next === "string" ? sanitizeRedirectPath(params.next, "") : "";
  const reason = typeof params?.reason === "string" ? params.reason : "";

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Dealer Portal</h1>
          <p>Sign in to your account</p>
        </div>

        {reason === "auth-required" ? (
          <div className="login-notice">Please sign in to continue.</div>
        ) : null}

        {reason === "session-expired" ? (
          <div className="login-notice">Your session has expired. Please sign in again.</div>
        ) : null}

        {reason === "forbidden" ? (
          <div className="login-error">You do not have permission to access that area.</div>
        ) : null}

        <LoginForm action={loginAction} redirectTo={next || undefined} />
      </div>
    </main>
  );
}
