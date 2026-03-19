"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type ForgotPasswordFormState = {
  submitted: boolean;
  error: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="login-submit" disabled={pending}>
      {pending ? "Sending..." : "Send reset link"}
    </button>
  );
}

export function ForgotPasswordForm({
  action,
}: {
  action: (state: ForgotPasswordFormState, formData: FormData) => Promise<ForgotPasswordFormState>;
}) {
  const [state, formAction] = useActionState(action, {
    submitted: false,
    error: null,
  });

  if (state.submitted) {
    return (
      <div className="login-notice">
        If an account with that email exists, we've sent a password reset link. Check your inbox.
        <div className="login-links" style={{ marginTop: "1rem" }}>
          <a href="/auth/login">Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="login-form">
      {state.error ? <div className="login-error">{state.error}</div> : null}

      <div className="login-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
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
