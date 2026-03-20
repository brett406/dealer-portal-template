import { requireSuperAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getDealerSettings } from "@/lib/settings";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireSuperAdmin("/admin/settings");

  const [siteSettings, dealerSettings, adminUsers, taxRates] = await Promise.all([
    prisma.siteSetting.findFirst(),
    getDealerSettings(),
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "STAFF"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    }),
    prisma.taxRate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, percent: true },
    }),
  ]);

  return (
    <div>
      <h1>Settings</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        System configuration — Super Admin only.
      </p>

      <SettingsClient
        currentUserId={user.id}
        siteSettings={{
          siteTitle: siteSettings?.siteTitle ?? "Dealer Portal",
          siteDescription: siteSettings?.siteDescription ?? "",
          contactEmail: siteSettings?.contactEmail ?? "",
          contactPhone: siteSettings?.contactPhone ?? "",
          contactAddress: siteSettings?.contactAddress ?? "",
          notificationEmail: siteSettings?.notificationEmail ?? "",
          googleAnalyticsId: siteSettings?.googleAnalyticsId ?? "",
        }}
        dealerSettings={dealerSettings}
        taxRates={taxRates.map((tr) => ({ id: tr.id, label: tr.label, percent: Number(tr.percent) }))}
        adminUsers={adminUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
