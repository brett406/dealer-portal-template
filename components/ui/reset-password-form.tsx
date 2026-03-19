"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

export type ResetPasswordFormState = {
  success: boolean;
  error: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="login-submit" disabled={pending}>
      {pending ? "Resetting..." : "Reset password"}
    </button>
  );
}

export function ResetPasswordForm({
  action,
  token,
}: {
  action: (state: ResetPasswordFormState, formData: FormData) => Promise<ResetPasswordFormState>;
  token: string;
}) {
  const [state, formAction] = useActionState(action, {
    success: false,
    error: null,
  });
  const [showPassword, setShowPassword] = useState(false);

  if (state.success) {
    return (
      <div className="login-notice">
        Your password has been reset successfully.
        <div className="login-links" style={{ marginTop: "1rem" }}>
          <a href="/auth/login">Sign in with your new password</a>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="login-form">
      <input type="hidden" name="token" value={token} />

      {state.error ? <div className="login-error">{state.error}</div> : null}

      <div className="login-field">
        <label htmlFor="password">New password</label>
        <div className="login-password-wrapper">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Minimum 12 characters"
            minLength={12}
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

      <div className="login-field">
        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          minLength={12}
          required
        />
      </div>

      <SubmitButton />

      <div className="login-links">
        <a href="/auth/login">Back to sign in</a>
      </div>
    </form>
  );
}
