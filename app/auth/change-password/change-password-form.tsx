"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { changeInitialPassword, skipPasswordChange, type ChangePasswordFormState } from "./actions";
import "@/app/auth/login/login.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} style={{ width: "100%" }}>
      Set New Password
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordFormState, FormData>(
    changeInitialPassword,
    {},
  );
  const [skipping, startTransition] = useTransition();

  function handleSkip() {
    startTransition(async () => {
      await skipPasswordChange();
    });
  }

  return (
    <>
      <form action={formAction} className="login-form">
        {state.error && <div className="login-error">{state.error}</div>}

        <div className="login-field">
          <label htmlFor="newPassword">New Password</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
          {state.errors?.newPassword && (
            <p className="form-error-message">{state.errors.newPassword}</p>
          )}
        </div>

        <div className="login-field">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            placeholder="Repeat your new password"
          />
          {state.errors?.confirmPassword && (
            <p className="form-error-message">{state.errors.confirmPassword}</p>
          )}
        </div>

        <SubmitButton />
      </form>

      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          type="button"
          onClick={handleSkip}
          disabled={skipping}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted, #4B5563)",
            fontSize: "0.85rem",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {skipping ? "Redirecting..." : "Skip for now"}
        </button>
      </div>
    </>
  );
}
