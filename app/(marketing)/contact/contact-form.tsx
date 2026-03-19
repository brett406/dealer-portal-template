"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { submitContactForm, type ContactFormState } from "./actions";
import "@/app/(marketing)/marketing.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Send Message
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState<ContactFormState, FormData>(submitContactForm, {});

  if (state.success) {
    return (
      <div className="contact-success">
        Thank you for your message! We&apos;ll get back to you shortly.
      </div>
    );
  }

  return (
    <form action={formAction} className="contact-form">
      <div>
        <input name="name" placeholder="Your name *" required />
        {state.errors?.name && <p className="form-error-message">{state.errors.name}</p>}
      </div>
      <div>
        <input name="email" type="email" placeholder="Email address *" required />
        {state.errors?.email && <p className="form-error-message">{state.errors.email}</p>}
      </div>
      <input name="phone" placeholder="Phone number" />
      <input name="company" placeholder="Company name" />
      <div>
        <textarea name="message" placeholder="Your message *" required />
        {state.errors?.message && <p className="form-error-message">{state.errors.message}</p>}
      </div>
      <SubmitButton />
    </form>
  );
}
