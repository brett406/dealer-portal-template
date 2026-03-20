import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { RecentOrdersTable, LowStockTable } from "./dashboard-tables";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    ordersToday,
    ordersThisWeek,
    ordersThisMonth,
    pendingApprovals,
    recentOrders,
    lowStockVariants,
    recentStatusChanges,
    recentCompanies,
  ] = await Promise.all([
    // Stats
    prisma.order.count({ where: { submittedAt: { gte: todayStart } } }),
    prisma.order.count({ where: { submittedAt: { gte: weekStart } } }),
    prisma.order.count({ where: { submittedAt: { gte: monthStart } } }),
    prisma.company.count({ where: { approvalStatus: "PENDING" } }),

    // Recent orders
    prisma.order.findMany({
      take: 10,
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        submittedAt: true,
        company: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),

    // Low stock — fetch active variants and filter where stock <= threshold
    prisma.productVariant.findMany({
      where: { active: true },
      orderBy: { stockQuantity: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        product: { select: { id: true, name: true } },
      },
    }).then((variants) =>
      variants
        .filter((v) => v.stockQuantity <= v.lowStockThreshold)
        .slice(0, 20)
    ),

    // Recent status changes
    prisma.orderStatusHistory.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        order: { select: { orderNumber: true } },
        changedBy: { select: { name: true } },
      },
    }),

    // Recent companies
    prisma.company.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true },
    }),
  ]);

  const orderData = recentOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    companyName: o.company.name,
    customerName: o.customer.name,
    total: Number(o.total),
    status: o.status,
    submittedAt: o.submittedAt.toISOString(),
  }));

  const stockData = lowStockVariants.map((v) => ({
    id: v.id,
    productId: v.product.id,
    productName: v.product.name,
    variantName: v.name,
    sku: v.sku,
    stockQuantity: v.stockQuantity,
    lowStockThreshold: v.lowStockThreshold,
  }));

  // Merge status changes and new companies into a single activity feed
  type Activity = { id: string; type: "order" | "status" | "company"; text: string; time: Date };
  const activities: Activity[] = [];

  for (const sc of recentStatusChanges) {
    activities.push({
      id: `sh-${sc.id}`,
      type: sc.status === "RECEIVED" ? "order" : "status",
      text:
        sc.status === "RECEIVED"
          ? `New order ${sc.order.orderNumber} placed`
          : `Order ${sc.order.orderNumber} → ${sc.status} by ${sc.changedBy.name}`,
      time: sc.createdAt,
    });
  }

  for (const co of recentCompanies) {
    activities.push({
      id: `co-${co.id}`,
      type: "company",
      text: `New company registered: ${co.name}`,
      time: co.createdAt,
    });
  }

  activities.sort((a, b) => b.time.getTime() - a.time.getTime());
  const activityFeed = activities.slice(0, 10);

  function timeAgo(date: Date): string {
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        Overview of your Bauman Custom Products portal.
      </p>

      {/* Stats cards */}
      <div className="dash-stats">
        <div className="dash-stat-card">
          <div className="dash-stat-label">Orders Today</div>
          <div className="dash-stat-value">{ordersToday}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">This Week</div>
          <div className="dash-stat-value">{ordersThisWeek}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">This Month</div>
          <div className="dash-stat-value">{ordersThisMonth}</div>
        </div>
        <div className={`dash-stat-card ${pendingApprovals > 0 ? "highlight" : ""}`}>
          <div className="dash-stat-label">Pending Approvals</div>
          <div className="dash-stat-value">{pendingApprovals}</div>
        </div>
      </div>

      {/* Recent Orders + Activity */}
      <div className="dash-grid">
        <div className="dash-section full-width">
          <div className="dash-section-header">
            <h2>Recent Orders</h2>
            <Link href="/admin/orders">View all</Link>
          </div>
          <RecentOrdersTable data={orderData} />
        </div>
      </div>

      <div className="dash-grid">
        {/* Low Stock Alerts */}
        <div className="dash-section">
          <div className="dash-section-header">
            <h2>Low Stock Alerts</h2>
            <Link href="/admin/products">View products</Link>
          </div>
          <LowStockTable data={stockData} />
        </div>

        {/* Activity Feed */}
        <div className="dash-section">
          <div className="dash-section-header">
            <h2>Recent Activity</h2>
          </div>
          {activityFeed.length > 0 ? (
            <ul className="dash-activity-list">
              {activityFeed.map((a) => (
                <li key={a.id} className="dash-activity-item">
                  <span className={`dash-activity-dot ${a.type}`} />
                  <span className="dash-activity-text">{a.text}</span>
                  <span className="dash-activity-time">{timeAgo(a.time)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>No recent activity.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dash-section">
        <div className="dash-section-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="dash-quick-actions">
          <Button href="/admin/products/new">Add Product</Button>
          <Button href="/admin/companies/new" variant="secondary">Add Company</Button>
          <Button href="/admin/orders" variant="secondary">View All Orders</Button>
        </div>
      </div>
    </div>
  );
}
