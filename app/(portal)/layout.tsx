import { Metadata } from "next";
import { getTheme } from "@/lib/theme";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { buildLoginRedirectPath } from "@/lib/auth-redirects";
import { getDealerSettings } from "@/lib/settings";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { ActAsCustomerBanner } from "@/components/admin/ActAsCustomerBanner";
import "./portal.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const theme = getTheme();
  const user = await requireUser("/portal/dashboard");

  // Allow customers with APPROVED company or admins acting as a customer
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "STAFF";
  const isActing = isAdmin && !!user.actingAsCustomerId;

  let companyApprovalStatus: string | null = null;

  if (!isAdmin && user.role === "CUSTOMER" && user.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: user.customerId },
      include: { company: { select: { approvalStatus: true, active: true } } },
    });

    if (!customer || !customer.active) {
      redirect(buildLoginRedirectPath("forbidden"));
    }

    // Company deactivated while customer is logged in
    if (!customer.company.active) {
      redirect(buildLoginRedirectPath("forbidden"));
    }

    companyApprovalStatus = customer.company.approvalStatus;

    if (customer.company.approvalStatus === "REJECTED") {
      redirect(buildLoginRedirectPath("forbidden"));
    }
  } else if (!isActing && !user.customerId) {
    redirect(buildLoginRedirectPath("forbidden"));
  }

  // Get cart item count for nav badge
  const effectiveCustomerId = isActing && user.actingAsCustomerId
    ? user.actingAsCustomerId
    : user.customerId;
  let cartItemCount = 0;
  if (effectiveCustomerId) {
    try {
      const cart = await prisma.cart.findUnique({
        where: { customerId: effectiveCustomerId },
        include: { items: { select: { quantity: true } } },
      });
      cartItemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    } catch {
      // Non-critical — badge just won't show
    }
  }

  let actingCompanyName: string | null = null;
  let actingCustomerName: string | null = null;

  if (isActing && user.actingAsCustomerId) {
    const actingCustomer = await prisma.customer.findUnique({
      where: { id: user.actingAsCustomerId },
      include: { company: { select: { name: true, active: true } } },
    });

    // If act-as customer's company was deactivated, exit impersonation
    if (!actingCustomer || !actingCustomer.active || !actingCustomer.company.active) {
      // Clear the acting-as cookie and redirect to admin
      redirect("/admin?error=impersonation-ended");
    }

    actingCompanyName = actingCustomer.company.name;
    actingCustomerName = actingCustomer.name;
  }

  const dealerSettings = await getDealerSettings();

  return (
    <div className="portal-layout">
      <a href="#main-content" className="visually-hidden" style={{ position: "absolute", zIndex: 999 }}>
        Skip to main content
      </a>
      {dealerSettings.announcementBannerEnabled && dealerSettings.announcementBannerText && (
        <div
          className="announcement-banner"
          style={{
            background: dealerSettings.announcementBannerBgColor,
            color: dealerSettings.announcementBannerTextColor,
          }}
        >
          {dealerSettings.announcementBannerText}
        </div>
      )}
      {actingCompanyName ? (
        <ActAsCustomerBanner companyName={actingCompanyName} customerName={actingCustomerName ?? undefined} />
      ) : null}
      {companyApprovalStatus === "PENDING" && (
        <div style={{
          background: "#fffbeb",
          borderBottom: "1px solid #fde68a",
          color: "#92400e",
          textAlign: "center",
          padding: "0.6rem 1rem",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}>
          Your account is pending approval. You can browse the catalog but cannot place orders yet.
        </div>
      )}
      <PortalHeader
        brandName={theme.brand.name}
        logo={theme.brand.logo}
        userName={user.name}
        cartItemCount={cartItemCount}
      />
      <main id="main-content" className="portal-main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
