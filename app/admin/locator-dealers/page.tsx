import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function LocatorDealersListPage() {
  await requireAdmin();

  const dealers = await prisma.locatorDealer.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      country: true,
      dealerType: true,
      active: true,
      latitude: true,
      longitude: true,
    },
  });

  const geocoded = dealers.filter((d) => d.latitude !== null && d.longitude !== null).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1>Dealer Locator</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Public store-locator dealers. {dealers.length} total · {geocoded} geocoded.
          </p>
        </div>
        <Button href="/admin/locator-dealers/new">Add Dealer</Button>
      </div>

      {dealers.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          No locator dealers yet. <Link href="/admin/locator-dealers/new">Add your first one</Link>.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
              <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Name</th>
              <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Location</th>
              <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Type</th>
              <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Geocoded</th>
              <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <Link href={`/admin/locator-dealers/${d.id}`} style={{ fontWeight: 500 }}>
                    {d.name}
                  </Link>
                </td>
                <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                  {[d.city, d.region, d.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.9rem" }}>
                  {d.dealerType ?? "—"}
                </td>
                <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.9rem" }}>
                  {d.latitude !== null && d.longitude !== null ? "Yes" : <span style={{ color: "var(--color-warning)" }}>No</span>}
                </td>
                <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.9rem" }}>
                  {d.active ? "Active" : <span style={{ color: "var(--color-text-muted)" }}>Inactive</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
