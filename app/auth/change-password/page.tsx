import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPostLoginRedirect } from "@/lib/auth-redirects";
import { ChangePasswordForm } from "./change-password-form";
import "@/app/auth/login/login.css";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!session.user.mustChangePassword) {
    redirect(getPostLoginRedirect(session));
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Set your password</h1>
          <p>Your account was created with a temporary password. Please set a new one.</p>
        </div>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
