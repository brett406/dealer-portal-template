"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { registerCustomer, type RegisterFormState } from "./actions";
import "./register.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="login-submit" disabled={pending}>
      {pending ? "Creating account..." : "Create Account"}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<RegisterFormState, FormData>(registerCustomer, {});

  if (state.success && state.pending) {
    return (
      <div className="register-pending">
        <h2>Account Created</h2>
        <p>
          Your account has been created and is <strong>pending approval</strong>.
          You&apos;ll receive an email when your account is approved.
        </p>
        <p>
          You can <Link href="/auth/login">log in</Link> to browse the catalog while you wait.
        </p>
      </div>
    );
  }

  if (state.success && !state.pending) {
    return (
      <div className="register-success">
        <h2>Welcome!</h2>
        <p>Your account has been created and is ready to use.</p>
        <p>
          <Link href="/auth/login">Log in to get started &rarr;</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="login-form">
      {state.error && <div className="login-error">{state.error}</div>}

      <div className="login-field">
        <label htmlFor="companyName">Company Name</label>
        <input id="companyName" name="companyName" required placeholder="Your company name" />
        {state.errors?.companyName && <p className="form-error-message">{state.errors.companyName}</p>}
      </div>

      <div className="login-field">
        <label htmlFor="name">Your Name</label>
        <input id="name" name="name" required placeholder="Full name" />
        {state.errors?.name && <p className="form-error-message">{state.errors.name}</p>}
      </div>

      <div className="login-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@company.com" />
        {state.errors?.email && <p className="form-error-message">{state.errors.email}</p>}
      </div>

      <div className="login-field">
        <label htmlFor="phone">Phone (optional)</label>
        <input id="phone" name="phone" placeholder="(555) 123-4567" />
      </div>

      <div className="login-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required placeholder="12+ characters" />
        {state.errors?.password && <p className="form-error-message">{state.errors.password}</p>}
      </div>

      <div className="login-field">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" required placeholder="Confirm password" />
        {state.errors?.confirmPassword && <p className="form-error-message">{state.errors.confirmPassword}</p>}
      </div>

      <SubmitButton />
    </form>
  );
}
