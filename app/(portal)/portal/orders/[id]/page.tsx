import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getEffectiveCustomerId } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { Table, type TableColumn } from "@/components/ui/Table";
import { formatPrice } from "@/lib/pricing";
import { OrderDetailActions } from "@/components/portal/OrderDetailActions";
import "@/app/(portal)/portal/orders/orders.css";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;

  const session = await auth();
  const customerId = session?.user ? getEffectiveCustomerId(session) : null;
  if (!customerId) return notFound();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { companyId: true },
  });

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      company: { select: { name: true } },
      customer: { select: { name: true } },
      placedByAdmin: { select: { name: true } },
      items: { orderBy: { createdAt: "asc" } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { name: true } } },
      },
    },
  });

  if (!order || order.companyId !== customer?.companyId) notFound();

  const badgeClass: Record<string, string> = {
    RECEIVED: "order-badge order-badge-received",
    PROCESSING: "order-badge order-badge-processing",
    SHIPPED: "order-badge order-badge-shipped",
    DELIVERED: "order-badge order-badge-delivered",
    CANCELLED: "order-badge order-badge-cancelled",
  };

  const dotClass: Record<string, string> = {
    RECEIVED: "timeline-dot received",
    PROCESSING: "timeline-dot processing",
    SHIPPED: "timeline-dot shipped",
    DELIVERED: "timeline-dot delivered",
    CANCELLED: "timeline-dot cancelled",
  };

  type ItemRow = {
    id: string;
    productNameSnapshot: string;
    variantNameSnapshot: string;
    skuSnapshot: string;
    uomNameSnapshot: string;
    uomConversionSnapshot: number;
    quantity: number;
    unitPrice: number;
    baseRetailPriceSnapshot: number;
    lineTotal: number;
  };

  const itemColumns: TableColumn<ItemRow>[] = [
    { key: "productNameSnapshot", label: "Product" },
    { key: "variantNameSnapshot", label: "Variant" },
    { key: "skuSnapshot", label: "SKU" },
    {
      key: "uomNameSnapshot",
      label: "UOM",
      render: (row) =>
        row.uomConversionSnapshot > 1
          ? `${row.uomNameSnapshot} of ${row.uomConversionSnapshot}`
          : row.uomNameSnapshot,
    },
    { key: "quantity", label: "Qty" },
    {
      key: "unitPrice",
      label: "Unit Price",
      render: (row) => (
        <span>
          {formatPrice(row.unitPrice)}
          {row.unitPrice < row.baseRetailPriceSnapshot && (
            <span style={{ textDecoration: "line-through", color: "var(--color-text-muted)", marginLeft: "0.4rem", fontSize: "0.8rem" }}>
              {formatPrice(row.baseRetailPriceSnapshot)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "lineTotal",
      label: "Total",
      render: (row) => <strong>{formatPrice(row.lineTotal)}</strong>,
    },
  ];

  const itemData: ItemRow[] = order.items.map((i) => ({
    id: i.id,
    productNameSnapshot: i.productNameSnapshot,
    variantNameSnapshot: i.variantNameSnapshot,
    skuSnapshot: i.skuSnapshot,
    uomNameSnapshot: i.uomNameSnapshot,
    uomConversionSnapshot: i.uomConversionSnapshot,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    baseRetailPriceSnapshot: Number(i.baseRetailPriceSnapshot),
    lineTotal: Number(i.lineTotal),
  }));

  return (
    <div>
      {status === "placed" && (
        <div className="order-placed-msg">
          Your order has been placed successfully!
        </div>
      )}

      <Link href="/portal/orders" style={{ fontSize: "0.85rem", color: "var(--color-primary)", textDecoration: "none" }}>
        &larr; Back to Orders
      </Link>

      <div className="order-detail-header">
        <div>
          <h1>{order.orderNumber}</h1>
          <span className={badgeClass[order.status]}>{order.status}</span>
        </div>
        <OrderDetailActions orderId={order.id} />
      </div>

      {/* Info cards */}
      <div className="order-detail-grid">
        <div className="order-detail-card">
          <h3>Order Info</h3>
          <p><strong>Date:</strong> {order.submittedAt.toLocaleDateString()}</p>
          <p><strong>Company:</strong> {order.company.name}</p>
          <p><strong>Placed By:</strong> {order.customer.name}
            {order.placedByAdmin && ` (by ${order.placedByAdmin.name})`}</p>
          {order.poNumber && <p><strong>PO #:</strong> {order.poNumber}</p>}
        </div>
        <div className="order-detail-card">
          <h3>Pricing</h3>
          <p><strong>Price Level:</strong> {order.priceLevelSnapshot}</p>
          <p><strong>Discount:</strong> {Number(order.discountPercentSnapshot)}%</p>
          {order.notes && (
            <>
              <h3 style={{ marginTop: "0.75rem" }}>Notes</h3>
              <p>{order.notes}</p>
            </>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="order-items-section">
        <h2>Items</h2>
        <Table columns={itemColumns} data={itemData} />
        <div className="order-summary-box">
          <div className="order-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(Number(order.subtotal))}</span>
          </div>
          <div className="order-summary-row">
            <span>Shipping</span>
            <span>{Number(order.shippingCost) === 0 ? "Free" : formatPrice(Number(order.shippingCost))}</span>
          </div>
          <div className="order-summary-total">
            <span>Total</span>
            <span>{formatPrice(Number(order.total))}</span>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="order-detail-card">
        <h3>Status History</h3>
        <ul className="status-timeline">
          {order.statusHistory.map((sh) => (
            <li key={sh.id}>
              <div className={dotClass[sh.status]} />
              <div className="timeline-content">
                <div className="timeline-status">{sh.status}</div>
                <div className="timeline-meta">
                  {sh.createdAt.toLocaleString()} by {sh.changedBy.name}
                </div>
                {sh.notes && <div className="timeline-notes">{sh.notes}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
