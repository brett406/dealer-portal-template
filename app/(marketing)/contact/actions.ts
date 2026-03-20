"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendContactFormEmail, parseAdminEmails } from "@/lib/email";
import { getDealerSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  phone: z.string().max(30).optional().default(""),
  company: z.string().max(200).optional().default(""),
  message: z.string().min(1, "Message is required").max(5000),
});

export type ContactFormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

export async function submitContactForm(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  // Rate limit: 5 submissions per 15 minutes per IP
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`contact:${ip}`, 5, 900);
  if (!rl.allowed) {
    return { error: `Too many submissions. Please try again in ${rl.retryAfterSeconds} seconds.` };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  // Save to database
  await prisma.formSubmission.create({
    data: {
      formKey: "contact",
      payload: parsed.data,
    },
  });

  // Send notification email to all configured admin emails
  getDealerSettings().then((settings) => {
    const emails = parseAdminEmails(settings.adminNotificationEmails);
    if (emails.length > 0) {
      sendContactFormEmail(parsed.data, emails).catch((err) =>
        console.error("Failed to send contact form email:", err),
      );
    }
  }).catch(() => {});

  return { success: true };
}
