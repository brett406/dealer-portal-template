import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/pricing";
import { getValidStatusTransitions } from "@/lib/orders";
import { OrderDetailControls } from "../order-detail-controls";
import { AdminOrderItemsTable } from "@/components/admin/AdminOrderItemsTable";
import "../orders.css";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      customer: { select: { name: true, email: true } },
      placedByAdmin: { select: { name: true } },
      items: { orderBy: { createdAt: "asc" } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { name: true } } },
      },
    },
  });

  if (!order) notFound();

  const validTransitions = getValidStatusTransitions(order.status);

  const badgeClass: Record<string, string> = {
    RECEIVED: "ord-badge ord-badge-received",
    PROCESSING: "ord-badge ord-badge-processing",
    SHIPPED: "ord-badge ord-badge-shipped",
    DELIVERED: "ord-badge ord-badge-delivered",
    CANCELLED: "ord-badge ord-badge-cancelled",
  };

  const dotClass: Record<string, string> = {
    RECEIVED: "ord-timeline-dot received",
    PROCESSING: "ord-timeline-dot processing",
    SHIPPED: "ord-timeline-dot shipped",
    DELIVERED: "ord-timeline-dot delivered",
    CANCELLED: "ord-timeline-dot cancelled",
  };

  const itemData = order.items.map((i) => ({
    id: i.id,
    productNameSnapshot: i.productNameSnapshot,
    variantNameSnapshot: i.variantNameSnapshot,
    skuSnapshot: i.skuSnapshot,
    uomNameSnapshot: i.uomNameSnapshot,
    uomConversionSnapshot: i.uomConversionSnapshot,
    quantity: i.quantity,
    baseUnitQuantity: i.baseUnitQuantity,
    unitPrice: Number(i.unitPrice),
    baseRetailPriceSnapshot: Number(i.baseRetailPriceSnapshot),
    lineTotal: Number(i.lineTotal),
  }));

  return (
    <div>
      <Link href="/admin/orders" style={{ fontSize: "0.85rem", color: "var(--color-primary)", textDecoration: "none" }}>
        &larr; Back to Orders
      </Link>

      <div className="ord-detail-header">
        <div>
          <h1>{order.orderNumber}</h1>
          <span className={badgeClass[order.status]}>{order.status}</span>
        </div>
        <OrderDetailControls
          orderId={order.id}
          currentStatus={order.status}
          validTransitions={validTransitions}
          internalNotes={order.internalNotes ?? ""}
        />
      </div>

      {/* Info cards */}
      <div className="ord-detail-grid">
        <div className="ord-detail-card">
          <h3>Order Info</h3>
          <p><strong>Date:</strong> {order.submittedAt.toLocaleDateString()}</p>
          <p>
            <strong>Company:</strong>{" "}
            <Link href={`/admin/companies/${order.company.id}`} style={{ color: "var(--color-primary)", textDecoration: "none" }}>
              {order.company.name}
            </Link>
          </p>
          <p>
            <strong>Customer:</strong> {order.customer.name} ({order.customer.email})
          </p>
          {order.placedByAdmin && (
            <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
              Placed by {order.placedByAdmin.name} on behalf of customer
            </p>
          )}
          {order.poNumber && <p><strong>PO #:</strong> {order.poNumber}</p>}
        </div>

        <div className="ord-detail-card">
          <h3>Pricing</h3>
          <p><strong>Price Level:</strong> {order.priceLevelSnapshot}</p>
          <p><strong>Discount:</strong> {Number(order.discountPercentSnapshot)}%</p>
          {order.notes && (
            <>
              <h3 style={{ marginTop: "0.75rem" }}>Customer Notes</h3>
              <p>{order.notes}</p>
            </>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="ord-items-section">
        <h2>Line Items</h2>
        <AdminOrderItemsTable items={itemData} />
        <div className="ord-summary-box">
          <div className="ord-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(Number(order.subtotal))}</span>
          </div>
          <div className="ord-summary-row">
            <span>Shipping</span>
            <span>{Number(order.shippingCost) === 0 ? "Free" : formatPrice(Number(order.shippingCost))}</span>
          </div>
          {Number(order.taxAmount) > 0 && (
            <div className="ord-summary-row">
              <span>Tax{order.taxRateSnapshot ? ` (${order.taxRateSnapshot})` : ""}</span>
              <span>{formatPrice(Number(order.taxAmount))}</span>
            </div>
          )}
          <div className="ord-summary-total">
            <span>Total</span>
            <span>{formatPrice(Number(order.total))}</span>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="ord-detail-card" style={{ marginBottom: "1.5rem" }}>
        <h3>Status History</h3>
        <ul className="ord-timeline">
          {order.statusHistory.map((sh) => (
            <li key={sh.id}>
              <div className={dotClass[sh.status]} />
              <div className="ord-timeline-content">
                <div className="ord-timeline-status">{sh.status}</div>
                <div className="ord-timeline-meta">
                  {sh.createdAt.toLocaleString()} by {sh.changedBy.name}
                </div>
                {sh.notes && <div className="ord-timeline-notes">{sh.notes}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
