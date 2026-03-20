"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { updateOrderStatus as updateStatus } from "@/lib/orders";
import { exportOrdersToCSV, exportOrderDetailsToCSV, type OrderExportFilters } from "@/lib/export";
import { sendOrderConfirmationSimple, sendOrderStatusUpdate } from "@/lib/email";
import { formatPrice } from "@/lib/pricing";
import type { OrderStatus } from "@prisma/client";

export type FormState = {
  error?: string;
  success?: boolean;
};

export async function updateOrderStatusAction(
  orderId: string,
  newStatus: OrderStatus,
  notes?: string,
): Promise<FormState> {
  const user = await requireAdmin();

  const result = await updateStatus(orderId, newStatus, user.id, notes);

  if (!result.success) return { error: result.error };

  // Fire-and-forget: send status update email to customer
  prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { email: true, name: true } },
    },
  }).then((order) => {
    if (order) {
      sendOrderStatusUpdate(order.customer.email, {
        customerName: order.customer.name,
        orderNumber: order.orderNumber,
        previousStatus: order.status,
        newStatus,
        orderId: order.id,
      }).catch((err) => console.error("Failed to send status update email:", err));
    }
  }).catch(() => {});

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { success: true };
}

export async function updateInternalNotes(
  orderId: string,
  notes: string,
): Promise<FormState> {
  await requireAdmin();

  await prisma.order.update({
    where: { id: orderId },
    data: { internalNotes: notes || null },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function resendOrderConfirmation(
  orderId: string,
): Promise<FormState> {
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true, email: true } },
      company: { select: { name: true } },
    },
  });

  if (!order) return { error: "Order not found" };

  await sendOrderConfirmationSimple(
    order.customer.email,
    order.customer.name,
    order.orderNumber,
    formatPrice(Number(order.total)),
    order.company.name,
  );

  return { success: true };
}

export async function exportOrdersAction(
  filters: {
    status?: string;
    companyId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  } = {},
): Promise<string> {
  await requireAdmin();

  const exportFilters: OrderExportFilters = {};
  if (filters.status) exportFilters.status = filters.status as OrderStatus;
  if (filters.companyId) exportFilters.companyId = filters.companyId;
  if (filters.dateFrom) exportFilters.dateFrom = new Date(filters.dateFrom);
  if (filters.dateTo) exportFilters.dateTo = new Date(filters.dateTo);
  if (filters.search) exportFilters.search = filters.search;

  return exportOrdersToCSV(exportFilters);
}

export async function exportOrderDetailAction(
  orderId: string,
): Promise<string | null> {
  await requireAdmin();
  return exportOrderDetailsToCSV(orderId);
}
