"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActAsResult = {
  error?: string;
  success?: boolean;
};

export async function startActingAsCustomer(
  customerId: string,
): Promise<ActAsResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return { error: "Only Super Admins can use this feature" };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      company: { select: { active: true, approvalStatus: true } },
    },
  });

  if (!customer) return { error: "Customer not found" };
  if (!customer.active) return { error: "Customer is inactive" };
  if (!customer.company.active) return { error: "Company is inactive" };
  if (customer.company.approvalStatus !== "APPROVED") {
    return { error: "Company is not approved" };
  }

  // Return success — the client will call the API route to set the JWT
  return { success: true };
}

export async function getActAsEligibility(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "SUPER_ADMIN";
}
