import { getTheme } from "@/lib/theme";

// ─── Brand config ────────────────────────────────────────────────────────────

function getBrand() {
  try {
    const theme = getTheme();
    return {
      name: theme.brand.name,
      primary: theme.colors.primary,
      primaryDark: theme.colors.primaryDark,
      bg: theme.colors.background,
      surface: theme.colors.surface,
      text: theme.colors.text,
      muted: theme.colors.textMuted,
      border: theme.colors.border,
    };
  } catch {
    return {
      name: "Dealer Portal",
      primary: "#2563eb",
      primaryDark: "#1d4ed8",
      bg: "#ffffff",
      surface: "#f8fafc",
      text: "#1e293b",
      muted: "#64748b",
      border: "#e2e8f0",
    };
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// ─── Base layout ─────────────────────────────────────────────────────────────

function baseLayout(title: string, body: string): string {
  const b = getBrand();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${b.surface};font-family:'Inter',Helvetica,Arial,sans-serif;color:${b.text};line-height:1.6;font-size:15px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${b.surface};">
    <tr><td align="center" style="padding:24px 16px;">

      <!-- Header -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:16px 24px;background:${b.primary};border-radius:8px 8px 0 0;">
          <a href="${BASE_URL}" style="color:#ffffff;text-decoration:none;font-size:18px;font-weight:700;">
            ${b.name}
          </a>
        </td></tr>
      </table>

      <!-- Body -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:32px 24px;background:${b.bg};border-left:1px solid ${b.border};border-right:1px solid ${b.border};">
          ${body}
        </td></tr>
      </table>

      <!-- Footer -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:16px 24px;background:${b.surface};border:1px solid ${b.border};border-top:none;border-radius:0 0 8px 8px;text-align:center;font-size:12px;color:${b.muted};">
          &copy; ${new Date().getFullYear()} ${b.name}. All rights reserved.
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function btn(href: string, label: string): string {
  const b = getBrand();
  return `<a href="${href}" style="display:inline-block;padding:10px 24px;background:${b.primary};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">${label}</a>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;">${text}</h2>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 12px;">${text}</p>`;
}

function muted(text: string): string {
  const b = getBrand();
  return `<p style="margin:0 0 12px;color:${b.muted};font-size:13px;">${text}</p>`;
}

function hr(): string {
  const b = getBrand();
  return `<hr style="border:none;border-top:1px solid ${b.border};margin:20px 0;" />`;
}

function keyValue(key: string, value: string): string {
  return `<p style="margin:0 0 6px;"><strong>${key}:</strong> ${value}</p>`;
}

// ─── Order items table ───────────────────────────────────────────────────────

export type OrderLineItem = {
  productName: string;
  variantName: string;
  sku: string;
  uomName: string;
  uomConversion: number;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

function orderItemsTable(items: OrderLineItem[]): string {
  const b = getBrand();
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;">
        ${item.productName}<br/>
        <span style="color:${b.muted};font-size:12px;">${item.variantName} &middot; ${item.sku}</span>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;text-align:center;">
        ${item.uomConversion > 1 ? `${item.uomName} of ${item.uomConversion}` : item.uomName}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;text-align:right;">${item.unitPrice}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;text-align:right;font-weight:600;">${item.lineTotal}</td>
    </tr>`,
    )
    .join("");

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${b.border};border-radius:6px;overflow:hidden;margin:16px 0;">
    <thead>
      <tr style="background:${b.surface};">
        <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;letter-spacing:0.04em;">Product</th>
        <th style="padding:8px 10px;text-align:center;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;">UOM</th>
        <th style="padding:8px 10px;text-align:center;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;">Qty</th>
        <th style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;">Price</th>
        <th style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function orderTotals(subtotal: string, shipping: string, total: string): string {
  const b = getBrand();
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:250px;margin-left:auto;">
    <tr><td style="padding:4px 0;font-size:14px;">Subtotal</td><td style="padding:4px 0;text-align:right;font-size:14px;">${subtotal}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;">Shipping</td><td style="padding:4px 0;text-align:right;font-size:14px;">${shipping}</td></tr>
    <tr><td style="padding:8px 0 4px;font-size:16px;font-weight:700;border-top:2px solid ${b.border};">Total</td><td style="padding:8px 0 4px;text-align:right;font-size:16px;font-weight:700;border-top:2px solid ${b.border};">${total}</td></tr>
  </table>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Order Confirmation (to customer)
// ═══════════════════════════════════════════════════════════════════════════════

export type OrderConfirmationData = {
  customerName: string;
  orderNumber: string;
  orderDate: string;
  companyName: string;
  priceLevelName: string;
  items: OrderLineItem[];
  subtotal: string;
  shipping: string;
  total: string;
  shippingAddress?: string;
  orderId: string;
};

export function orderConfirmationTemplate(data: OrderConfirmationData): string {
  return baseLayout(
    `Order Confirmation — ${data.orderNumber}`,
    `
    ${heading("Order Confirmed")}
    ${para(`Hi ${data.customerName},`)}
    ${para(`Your order <strong>${data.orderNumber}</strong> has been received and is being processed.`)}
    ${hr()}
    ${keyValue("Order Number", data.orderNumber)}
    ${keyValue("Date", data.orderDate)}
    ${keyValue("Company", data.companyName)}
    ${keyValue("Price Level", data.priceLevelName)}
    ${data.shippingAddress ? keyValue("Ship To", data.shippingAddress) : ""}
    ${orderItemsTable(data.items)}
    ${orderTotals(data.subtotal, data.shipping, data.total)}
    <div style="margin-top:24px;text-align:center;">
      ${btn(`${BASE_URL}/portal/orders/${data.orderId}`, "View Order")}
    </div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. New Order Notification (to admin)
// ═══════════════════════════════════════════════════════════════════════════════

export type NewOrderNotificationData = OrderConfirmationData & {
  customerEmail: string;
};

export function newOrderNotificationTemplate(data: NewOrderNotificationData): string {
  return baseLayout(
    `New Order — ${data.orderNumber}`,
    `
    ${heading("New Order Received")}
    ${para(`A new order has been placed.`)}
    ${hr()}
    ${keyValue("Order Number", data.orderNumber)}
    ${keyValue("Date", data.orderDate)}
    ${keyValue("Company", data.companyName)}
    ${keyValue("Customer", `${data.customerName} (${data.customerEmail})`)}
    ${keyValue("Price Level", data.priceLevelName)}
    ${orderItemsTable(data.items)}
    ${orderTotals(data.subtotal, data.shipping, data.total)}
    <div style="margin-top:24px;text-align:center;">
      ${btn(`${BASE_URL}/admin/orders/${data.orderId}`, "View in Admin")}
    </div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Order Status Update (to customer)
// ═══════════════════════════════════════════════════════════════════════════════

export type OrderStatusUpdateData = {
  customerName: string;
  orderNumber: string;
  previousStatus: string;
  newStatus: string;
  notes?: string;
  orderId: string;
};

export function orderStatusUpdateTemplate(data: OrderStatusUpdateData): string {
  const b = getBrand();
  const statusColor: Record<string, string> = {
    PROCESSING: "#f59e0b",
    SHIPPED: "#8b5cf6",
    DELIVERED: "#22c55e",
    CANCELLED: "#ef4444",
  };
  const color = statusColor[data.newStatus] ?? b.primary;

  return baseLayout(
    `Order ${data.orderNumber} — ${data.newStatus}`,
    `
    ${heading("Order Status Updated")}
    ${para(`Hi ${data.customerName},`)}
    ${para(`Your order <strong>${data.orderNumber}</strong> has been updated.`)}
    <div style="margin:20px 0;padding:16px;background:${b.surface};border-radius:6px;border-left:4px solid ${color};">
      <span style="color:${b.muted};font-size:13px;">${data.previousStatus}</span>
      <span style="color:${b.muted};font-size:13px;"> &rarr; </span>
      <strong style="font-size:15px;color:${color};">${data.newStatus}</strong>
    </div>
    ${data.notes ? para(`<em style="color:${b.muted};">Note: ${data.notes}</em>`) : ""}
    <div style="margin-top:24px;text-align:center;">
      ${btn(`${BASE_URL}/portal/orders/${data.orderId}`, "View Order")}
    </div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Welcome Email (admin-created customer)
// ═══════════════════════════════════════════════════════════════════════════════

export type WelcomeEmailData = {
  name: string;
  email: string;
  tempPassword: string;
};

export function welcomeEmailTemplate(data: WelcomeEmailData): string {
  const b = getBrand();
  return baseLayout(
    "Your account has been created",
    `
    ${heading(`Welcome, ${data.name}!`)}
    ${para("An account has been created for you. Use the credentials below to log in.")}
    <div style="margin:20px 0;padding:16px;background:${b.surface};border-radius:6px;border:1px solid ${b.border};">
      ${keyValue("Email", data.email)}
      ${keyValue("Temporary Password", `<code style="background:#eff6ff;padding:2px 8px;border-radius:4px;font-weight:700;">${data.tempPassword}</code>`)}
    </div>
    ${muted("You will be asked to change your password on first login.")}
    <div style="margin-top:24px;text-align:center;">
      ${btn(`${BASE_URL}/auth/login`, "Login")}
    </div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Account Approved
// ═══════════════════════════════════════════════════════════════════════════════

export type AccountApprovedData = {
  customerName: string;
  companyName: string;
};

export function accountApprovedTemplate(data: AccountApprovedData): string {
  return baseLayout(
    "Your account has been approved",
    `
    ${heading("Account Approved!")}
    ${para(`Hi ${data.customerName},`)}
    ${para(`Great news! Your company <strong>${data.companyName}</strong> has been approved.`)}
    ${para("You can now log in, browse the full catalog, and place orders.")}
    <div style="margin-top:24px;text-align:center;">
      ${btn(`${BASE_URL}/auth/login`, "Login and Start Ordering")}
    </div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Account Rejected
// ═══════════════════════════════════════════════════════════════════════════════

export type AccountRejectedData = {
  customerName: string;
  companyName: string;
  contactEmail?: string;
};

export function accountRejectedTemplate(data: AccountRejectedData): string {
  return baseLayout(
    "Registration Update",
    `
    ${heading("Registration Update")}
    ${para(`Hi ${data.customerName},`)}
    ${para(`We've reviewed the registration for <strong>${data.companyName}</strong>. Unfortunately, we're unable to approve the account at this time.`)}
    ${data.contactEmail
      ? para(`If you have questions, please reach out to us at <a href="mailto:${data.contactEmail}" style="color:${getBrand().primary};">${data.contactEmail}</a>.`)
      : para("If you have questions, please contact us.")
    }
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Password Reset
// ═══════════════════════════════════════════════════════════════════════════════

export type PasswordResetData = {
  name: string;
  resetLink: string;
  expiresInHours: number;
};

export function passwordResetTemplate(data: PasswordResetData): string {
  const b = getBrand();
  return baseLayout(
    "Password Reset",
    `
    ${heading("Password Reset")}
    ${para(`Hi ${data.name},`)}
    ${para("We received a request to reset your password. Click the button below to set a new password.")}
    <div style="margin:24px 0;text-align:center;">
      ${btn(data.resetLink, "Reset Password")}
    </div>
    <div style="padding:12px;background:${b.surface};border-radius:6px;border:1px solid ${b.border};font-size:13px;color:${b.muted};">
      This link expires in ${data.expiresInHours} hour${data.expiresInHours !== 1 ? "s" : ""}. If you didn't request this, you can safely ignore this email.
    </div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Low Stock Alert (to admin)
// ═══════════════════════════════════════════════════════════════════════════════

export type LowStockItem = {
  productName: string;
  variantName: string;
  sku: string;
  currentStock: number;
  threshold: number;
  productId: string;
};

export function lowStockAlertTemplate(items: LowStockItem[]): string {
  const b = getBrand();
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;">
        <a href="${BASE_URL}/admin/products/${item.productId}" style="color:${b.primary};text-decoration:none;">${item.productName}</a><br/>
        <span style="color:${b.muted};font-size:12px;">${item.variantName} &middot; ${item.sku}</span>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;text-align:center;color:${item.currentStock === 0 ? "#ef4444" : "#b45309"};font-weight:600;">${item.currentStock}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${b.border};font-size:13px;text-align:center;">${item.threshold}</td>
    </tr>`,
    )
    .join("");

  return baseLayout(
    "Low Stock Alert",
    `
    ${heading("Low Stock Alert")}
    ${para(`${items.length} product${items.length !== 1 ? "s are" : " is"} below the stock threshold.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${b.border};border-radius:6px;overflow:hidden;margin:16px 0;">
      <thead>
        <tr style="background:${b.surface};">
          <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;">Product</th>
          <th style="padding:8px 10px;text-align:center;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;">Stock</th>
          <th style="padding:8px 10px;text-align:center;font-size:12px;font-weight:600;color:${b.muted};text-transform:uppercase;">Threshold</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:center;">
      ${btn(`${BASE_URL}/admin/products`, "View Products")}
    </div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Contact Form Submission (to admin)
// ═══════════════════════════════════════════════════════════════════════════════

export type ContactFormData = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
};

export function contactFormTemplate(data: ContactFormData): string {
  const b = getBrand();
  return baseLayout(
    `Contact Form: ${data.name}`,
    `
    ${heading("New Contact Form Submission")}
    <div style="padding:16px;background:${b.surface};border-radius:6px;border:1px solid ${b.border};margin:16px 0;">
      ${keyValue("Name", data.name)}
      ${keyValue("Email", `<a href="mailto:${data.email}" style="color:${b.primary};">${data.email}</a>`)}
      ${data.phone ? keyValue("Phone", data.phone) : ""}
      ${data.company ? keyValue("Company", data.company) : ""}
    </div>
    ${hr()}
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${data.message}</div>
    `,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Self-registration welcome
// ═══════════════════════════════════════════════════════════════════════════════

export type SelfRegistrationWelcomeData = {
  customerName: string;
  companyName: string;
};

export function selfRegistrationWelcomeTemplate(data: SelfRegistrationWelcomeData): string {
  return baseLayout(
    `Welcome to ${getBrand().name}`,
    `
    ${heading(`Welcome, ${data.customerName}!`)}
    ${para(`Your account for <strong>${data.companyName}</strong> has been created and is ready to use.`)}
    ${para("You can now log in, browse the catalog, and start placing orders.")}
    <div style="margin-top:24px;text-align:center;">
      ${btn(`${BASE_URL}/auth/login`, "Login")}
    </div>
    `,
  );
}

// Registration pending admin notification
export type RegistrationPendingData = {
  companyName: string;
  contactName: string;
  contactEmail: string;
};

export function registrationPendingTemplate(data: RegistrationPendingData): string {
  const b = getBrand();
  return baseLayout(
    `New Registration: ${data.companyName}`,
    `
    ${heading("New Company Registration")}
    ${para("A new company has registered and is waiting for your approval.")}
    <div style="padding:16px;background:${b.surface};border-radius:6px;border:1px solid ${b.border};margin:16px 0;">
      ${keyValue("Company", data.companyName)}
      ${keyValue("Contact", data.contactName)}
      ${keyValue("Email", `<a href="mailto:${data.contactEmail}" style="color:${b.primary};">${data.contactEmail}</a>`)}
    </div>
    <div style="text-align:center;">
      ${btn(`${BASE_URL}/admin/companies`, "Review in Admin")}
    </div>
    `,
  );
}

// Admin-reset password (temp password, not link)
export type AdminResetPasswordData = {
  name: string;
  tempPassword: string;
};

export function adminResetPasswordTemplate(data: AdminResetPasswordData): string {
  const b = getBrand();
  return baseLayout(
    "Your password has been reset",
    `
    ${heading("Password Reset")}
    ${para(`Hi ${data.name},`)}
    ${para("Your password has been reset by an administrator. Use the temporary password below to log in.")}
    <div style="margin:20px 0;padding:16px;background:${b.surface};border-radius:6px;border:1px solid ${b.border};">
      ${keyValue("Temporary Password", `<code style="background:#eff6ff;padding:2px 8px;border-radius:4px;font-weight:700;">${data.tempPassword}</code>`)}
    </div>
    ${muted("You will be asked to change your password on next login.")}
    <div style="margin-top:24px;text-align:center;">
      ${btn(`${BASE_URL}/auth/login`, "Login")}
    </div>
    `,
  );
}
