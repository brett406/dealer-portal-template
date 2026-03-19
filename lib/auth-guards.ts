import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { buildLoginRedirectPath } from "@/lib/auth-redirects";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

async function hasSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.getAll().some((cookie) => cookie.name.includes("authjs.session-token"));
}

/**
 * Require an authenticated user. Redirects to login if no session.
 */
export async function requireUser(nextPath?: string) {
  const user = await getSessionUser();

  if (!user) {
    const reason = (await hasSessionCookie()) ? "session-expired" : "auth-required";
    redirect(buildLoginRedirectPath(reason, nextPath));
  }

  return user;
}

/**
 * Require SUPER_ADMIN or STAFF role.
 */
export async function requireAdmin(nextPath?: string) {
  const user = await requireUser(nextPath);

  if (user.role !== "SUPER_ADMIN" && user.role !== "STAFF") {
    redirect(buildLoginRedirectPath("forbidden"));
  }

  return user;
}

/**
 * Require SUPER_ADMIN role only.
 */
export async function requireSuperAdmin(nextPath?: string) {
  const user = await requireUser(nextPath);

  if (user.role !== "SUPER_ADMIN") {
    redirect(buildLoginRedirectPath("forbidden"));
  }

  return user;
}

/**
 * Require CUSTOMER role with an APPROVED company.
 */
export async function requireCustomer(nextPath?: string) {
  const user = await requireUser(nextPath);

  if (user.role !== "CUSTOMER" || !user.customerId) {
    redirect(buildLoginRedirectPath("forbidden"));
  }

  const customer = await prisma.customer.findUnique({
    where: { id: user.customerId },
    include: { company: { select: { approvalStatus: true } } },
  });

  if (!customer || customer.company.approvalStatus !== "APPROVED") {
    redirect(buildLoginRedirectPath("forbidden"));
  }

  return user;
}

/**
 * Returns the effective customer ID — the impersonated customer if an admin
 * is acting as one, otherwise the session user's own customer ID.
 */
export function getEffectiveCustomerId(session: Session): string | undefined {
  if (session.user.actingAsCustomerId) {
    return session.user.actingAsCustomerId;
  }

  return session.user.customerId;
}

/**
 * Whether the current session is an admin impersonating a customer.
 */
export function isActingAsCustomer(session: Session): boolean {
  return !!session.user.actingAsCustomerId;
}
