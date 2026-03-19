"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

export type LoginFormState = {
  error: string | null;
  email: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="login-submit" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm({
  action,
  initialEmail,
  redirectTo,
}: {
  action: (state: LoginFormState, formData: FormData) => Promise<LoginFormState>;
  initialEmail?: string;
  redirectTo?: string;
}) {
  const [state, formAction] = useActionState(action, {
    error: null,
    email: initialEmail ?? "",
  });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="login-form">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      {state.error ? <div className="login-error">{state.error}</div> : null}

      <div className="login-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email || initialEmail}
          placeholder="you@company.com"
          required
        />
      </div>

      <div className="login-field">
        <label htmlFor="password">Password</label>
        <div className="login-password-wrapper">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
          <button
            type="button"
            className="login-toggle-password"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <SubmitButton />

      <div className="login-links">
        <a href="/auth/forgot-password">Forgot your password?</a>
      </div>
    </form>
  );
}
