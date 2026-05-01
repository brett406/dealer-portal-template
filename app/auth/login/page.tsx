import { AuthError } from "next-auth";
import { signIn, auth, getPostLoginRedirect } from "@/lib/auth";
import { sanitizeRedirectPath } from "@/lib/auth-redirects";
import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { getSiteSettings } from "@/lib/cms";
import { getTheme } from "@/lib/theme";
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
      redirect: false,
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

  // Auth succeeded — redirect based on role or original destination
  if (redirectTo) {
    redirect(redirectTo);
  }
  const session = await auth();
  if (session?.user) {
    redirect(getPostLoginRedirect(session));
  }
  redirect("/auth/login");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Redirect to setup wizard if no admin exists
  const setupComplete = await isSetupComplete();
  if (!setupComplete) redirect("/setup");

  const [params, session] = await Promise.all([searchParams, auth()]);

  // Redirect already-authenticated users
  if (session?.user) {
    redirect(getPostLoginRedirect(session));
  }

  const next = typeof params?.next === "string" ? sanitizeRedirectPath(params.next, "") : "";
  const reason = typeof params?.reason === "string" ? params.reason : "";

  const settings = await getSiteSettings();
  const brandName = settings?.siteTitle ?? getTheme().brand.name;

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>{brandName}</h1>
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
