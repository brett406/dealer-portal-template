import Link from "next/link";
import { getDealerSettings } from "@/lib/settings";
import { getTheme } from "@/lib/theme";
import { RegisterForm } from "./register-form";
import "./register.css";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [settings, theme] = await Promise.all([getDealerSettings(), null].map((p, i) =>
    i === 0 ? p : Promise.resolve(getTheme()),
  ));
  const dealerSettings = settings as Awaited<ReturnType<typeof getDealerSettings>>;
  const brandTheme = getTheme();

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: "480px" }}>
        <div className="login-header">
          <h1>Create Account</h1>
          <p>Register your company for access to our dealer portal.</p>
        </div>

        {!dealerSettings.allowSelfRegistration ? (
          <div className="register-disabled">
            <p>
              Registration is not currently available. Please{" "}
              <Link href="/contact">contact us</Link> for access.
            </p>
          </div>
        ) : (
          <RegisterForm />
        )}

        <div className="login-links" style={{ marginTop: "1.5rem" }}>
          <Link href="/auth/login">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
