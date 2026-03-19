import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { customerId } = body;

  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  // Validate customer
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      company: { select: { active: true, approvalStatus: true } },
    },
  });

  if (!customer || !customer.active) {
    return NextResponse.json({ error: "Customer not found or inactive" }, { status: 400 });
  }

  if (!customer.company.active) {
    return NextResponse.json({ error: "Company is inactive" }, { status: 400 });
  }

  if (customer.company.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "Company is not approved" }, { status: 400 });
  }

  // Encode a new JWT with the actingAsCustomerId
  const token = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    mustChangePassword: session.user.mustChangePassword,
    customerId: session.user.customerId,
    actingAsCustomerId: customerId,
  };

  const secret = process.env.AUTH_SECRET!;
  const encoded = await encode({ token, secret, salt: "authjs.session-token" });

  const cookieStore = await cookies();
  cookieStore.set("authjs.session-token", encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({ success: true });
}
