"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendDealerApplicationEmail, parseAdminEmails } from "@/lib/email";
import { getDealerSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";

const dealerApplicationSchema = z.object({
  // Business Information
  businessName: z.string().min(1, "Business name is required").max(200),
  contactName: z.string().min(1, "Contact name is required").max(100),
  title: z.string().max(100).optional().default(""),
  phone: z.string().min(1, "Phone number is required").max(30),
  email: z.string().email("Invalid email address"),
  website: z.string().max(200).optional().default(""),

  // Business Details
  businessType: z.string().min(1, "Business type is required"),
  yearsInBusiness: z.string().max(50).optional().default(""),
  province: z.string().min(1, "Province is required"),
  carriesAgTools: z.string().min(1, "Please select an option"),

  // Inquiry
  productInterests: z.string().optional().default(""),
  estimatedVolume: z.string().max(500).optional().default(""),
  additionalNotes: z.string().max(2000).optional().default(""),
});

export type DealerFormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

export async function submitDealerApplication(
  _prev: DealerFormState,
  formData: FormData,
): Promise<DealerFormState> {
  // Rate limit: 3 submissions per 15 minutes per IP
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`dealer-app:${ip}`, 3, 900);
  if (!rl.allowed) {
    return { error: `Too many submissions. Please try again in ${rl.retryAfterSeconds} seconds.` };
  }

  // Collect checkbox values for product interests
  const productInterests = formData.getAll("productInterests").join(", ");

  const parsed = dealerApplicationSchema.safeParse({
    businessName: formData.get("businessName"),
    contactName: formData.get("contactName"),
    title: formData.get("title"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    website: formData.get("website"),
    businessType: formData.get("businessType"),
    yearsInBusiness: formData.get("yearsInBusiness"),
    province: formData.get("province"),
    carriesAgTools: formData.get("carriesAgTools"),
    productInterests,
    estimatedVolume: formData.get("estimatedVolume"),
    additionalNotes: formData.get("additionalNotes"),
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
      formKey: "dealer-application",
      payload: parsed.data,
    },
  });

  // Send notification email to admin
  getDealerSettings().then((settings) => {
    const emails = parseAdminEmails(settings.adminNotificationEmails);
    if (emails.length > 0) {
      const d = parsed.data;
      sendDealerApplicationEmail(
        {
          contactName: d.contactName,
          email: d.email,
          phone: d.phone,
          title: d.title || undefined,
          businessName: d.businessName,
          website: d.website || undefined,
          businessType: d.businessType,
          yearsInBusiness: d.yearsInBusiness || undefined,
          province: d.province,
          carriesAgTools: d.carriesAgTools,
          productInterests: d.productInterests || undefined,
          estimatedVolume: d.estimatedVolume || undefined,
          additionalNotes: d.additionalNotes || undefined,
        },
        emails,
      ).catch((err) =>
        console.error("Failed to send dealer application email:", err),
      );
    }
  }).catch(() => {});

  return { success: true };
}
