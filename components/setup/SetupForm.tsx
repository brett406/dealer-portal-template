"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { completeSetup, type SetupFormState } from "@/app/setup/actions";
import "@/app/setup/setup.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="setup-submit" disabled={pending}>
      {pending ? "Setting up..." : "Set Up Portal"}
    </button>
  );
}

export function SetupForm() {
  const [state, formAction] = useActionState<SetupFormState, FormData>(completeSetup, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      // Redirect to login after setup
      router.push("/auth/login?setup=complete");
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="setup-form">
      {state.error && <div className="setup-error">{state.error}</div>}

      <Input
        label="Business Name"
        name="businessName"
        required
        placeholder="Your company or brand name"
        error={state.errors?.businessName}
      />

      <Input
        label="Your Name"
        name="name"
        required
        placeholder="Full name"
        error={state.errors?.name}
      />

      <Input
        label="Admin Email"
        name="email"
        type="email"
        required
        placeholder="you@company.com"
        error={state.errors?.email}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        required
        placeholder="12+ characters"
        error={state.errors?.password}
      />

      <Input
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        required
        placeholder="Confirm password"
        error={state.errors?.confirmPassword}
      />

      <label className="setup-checkbox">
        <input type="checkbox" name="loadSampleData" />
        <div>
          <div className="setup-checkbox-text">Load sample data</div>
          <div className="setup-checkbox-hint">
            Adds demo products, categories, companies, and price levels so you can explore the portal immediately.
          </div>
        </div>
      </label>

      <SubmitButton />
    </form>
  );
}
