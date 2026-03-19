import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Re-encode JWT without actingAsCustomerId
  const token = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    mustChangePassword: session.user.mustChangePassword,
    customerId: session.user.customerId,
    // actingAsCustomerId intentionally omitted
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
