import { Resend } from "resend";
import { getTheme } from "@/lib/theme";
import {
  welcomeEmailTemplate,
  orderConfirmationTemplate,
  newOrderNotificationTemplate,
  orderStatusUpdateTemplate,
  accountApprovedTemplate,
  accountRejectedTemplate,
  passwordResetTemplate,
  adminResetPasswordTemplate,
  lowStockAlertTemplate,
  contactFormTemplate,
  selfRegistrationWelcomeTemplate,
  registrationPendingTemplate,
  type OrderConfirmationData,
  type NewOrderNotificationData,
  type OrderStatusUpdateData,
  type LowStockItem,
} from "@/lib/email-templates";

const FROM = process.env.EMAIL_FROM || "noreply@example.com";

// Log a clear warning on module load if RESEND_API_KEY is missing
if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "test") {
  console.warn(
    "[Email] RESEND_API_KEY is not set — emails will be logged to console instead of sent. " +
    "Set RESEND_API_KEY in your .env to enable email delivery.",
  );
}

let _resend: Resend | null = null;
function getResend() {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] SKIPPED "${subject}" → ${to} (no RESEND_API_KEY)`);
    return;
  }
  const client = getResend();
  if (!client) return;
  try {
    const result = await client.emails.send({ from: FROM, to, subject, html });
    if (result.error) {
      console.error(`[Email] FAILED "${subject}" → ${to}: ${result.error.message}`);
      throw new Error(result.error.message);
    }
    console.log(`[Email] SENT "${subject}" → ${to}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Email] ERROR "${subject}" → ${to}: ${msg}`);
    throw err;
  }
}

/** Parse a comma-separated email string into an array of trimmed, non-empty emails. */
export function parseAdminEmails(emailsStr: string): string[] {
  return emailsStr.split(",").map((e) => e.trim()).filter(Boolean);
}

/** Check if Resend is configured. */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Get the configured FROM address. */
export function getEmailFrom(): string {
  return FROM;
}

// ─── 1. Order Confirmation (to customer) ─────────────────────────────────────

export async function sendOrderConfirmationEmail(data: OrderConfirmationData) {
  await send(
    data.customerName, // overridden below
    `Order Confirmation — ${data.orderNumber}`,
    orderConfirmationTemplate(data),
  );
}

// Full version with explicit `to`
export async function sendOrderConfirmation(to: string, data: OrderConfirmationData) {
  await send(to, `Order Confirmation — ${data.orderNumber}`, orderConfirmationTemplate(data));
}

// ─── 2. New Order Notification (to admin) ────────────────────────────────────

export async function sendNewOrderNotification(to: string, data: NewOrderNotificationData) {
  await send(to, `New Order — ${data.orderNumber}`, newOrderNotificationTemplate(data));
}

// ─── 3. Order Status Update (to customer) ────────────────────────────────────

export async function sendOrderStatusUpdate(to: string, data: OrderStatusUpdateData) {
  await send(to, `Order ${data.orderNumber} — ${data.newStatus}`, orderStatusUpdateTemplate(data));
}

// ─── 4. Welcome Email (admin-created) ────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string, tempPassword: string) {
  await send(to, "Your account has been created", welcomeEmailTemplate({ name, email: to, tempPassword }));
}

// ─── 5. Account Approved ─────────────────────────────────────────────────────

export async function sendRegistrationApprovedEmail(to: string, customerName: string, companyName: string) {
  await send(to, "Your account has been approved!", accountApprovedTemplate({ customerName, companyName }));
}

// ─── 6. Account Rejected ─────────────────────────────────────────────────────

export async function sendRegistrationRejectedEmail(to: string, customerName: string, companyName: string) {
  await send(to, "Registration update", accountRejectedTemplate({ customerName, companyName }));
}

// ─── 7. Password Reset (link-based) ──────────────────────────────────────────

export async function sendPasswordResetLinkEmail(to: string, name: string, resetLink: string, expiresInHours = 24) {
  await send(to, "Password Reset", passwordResetTemplate({ name, resetLink, expiresInHours }));
}

// Admin-initiated password reset (temp password)
export async function sendPasswordResetEmail(to: string, name: string, tempPassword: string) {
  await send(to, "Your password has been reset", adminResetPasswordTemplate({ name, tempPassword }));
}

// ─── Test email ──────────────────────────────────────────────────────────────

export async function sendTestEmailTo(to: string) {
  let brand = "Dealer Portal";
  try { brand = getTheme().brand.name; } catch { /* keep fallback */ }
  await send(to, `Test Email — ${brand}`,
    `<h2>Test Email</h2><p>This is a test email from your ${brand} portal.</p>`);
}

// ─── 8. Low Stock Alert (to admin) ───────────────────────────────────────────

export async function sendLowStockAlert(to: string, items: LowStockItem[]) {
  await send(to, `Low Stock Alert — ${items.length} item${items.length !== 1 ? "s" : ""}`, lowStockAlertTemplate(items));
}

// ─── 9. Contact Form (to admin) ──────────────────────────────────────────────

export async function sendContactFormEmail(data: { name: string; email: string; phone?: string; company?: string; message: string }, adminEmails: string[]) {
  const html = contactFormTemplate(data);
  const subject = `Contact Form: ${data.name}`;
  for (const to of adminEmails) {
    await send(to, subject, html);
  }
}

// ─── Registration flows ──────────────────────────────────────────────────────

export async function sendRegistrationPendingEmail(adminEmail: string, companyName: string, contactName: string, contactEmail: string) {
  await send(adminEmail, `New Registration Pending Approval: ${companyName}`, registrationPendingTemplate({ companyName, contactName, contactEmail }));
}

export async function sendSelfRegistrationWelcomeEmail(to: string, customerName: string, companyName: string) {
  await send(to, `Welcome to our portal!`, selfRegistrationWelcomeTemplate({ customerName, companyName }));
}

// ─── Legacy compat (sendOrderConfirmationEmail with simple args) ─────────────

export async function sendOrderConfirmationSimple(to: string, customerName: string, orderNumber: string, total: string, companyName: string) {
  await send(to, `Order Confirmation — ${orderNumber}`, orderConfirmationTemplate({
    customerName,
    orderNumber,
    orderDate: new Date().toLocaleDateString(),
    companyName,
    priceLevelName: "",
    items: [],
    subtotal: total,
    shipping: "$0.00",
    total,
    orderId: "",
  }));
}
