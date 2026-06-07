import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { validateOrigin } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  // CSRF protection — this route re-issues the session JWT cookie.
  const csrfError = validateOrigin(request);
  if (csrfError) {
    return NextResponse.json({ error: csrfError }, { status: 403 });
  }

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isSecure = process.env.NODE_ENV === "production";
  const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";

  const token = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    mustChangePassword: session.user.mustChangePassword,
    customerId: session.user.customerId,
  };

  const secret = process.env.AUTH_SECRET!;
  const encoded = await encode({ token, secret, salt: cookieName });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, encoded, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({ success: true });
}
