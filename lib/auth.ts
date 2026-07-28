import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRateLimit, recordAttempt, extractClientIp } from "@/lib/auth-security";
import { sanitizeRedirectPath, getPostLoginRedirect } from "@/lib/auth-redirects";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * How often the session token re-reads role/active from the database. Bounds
 * how long a deactivated or demoted account keeps its old access.
 */
const REVALIDATE_MS = 60 * 1000;

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

class InactiveAccountError extends CredentialsSignin {
  code = "inactive_account";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (rawCredentials, request) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();
        const ip = extractClientIp(request);

        try {
          await checkRateLimit(email, ip);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("RATE_LIMITED:")) {
            throw new RateLimitedError();
          }
          throw error;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { customer: { select: { id: true } } },
        });

        if (!user) {
          await recordAttempt(email, ip, false);
          return null;
        }

        if (!user.active) {
          await recordAttempt(email, ip, false);
          throw new InactiveAccountError();
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.password);

        if (!isValid) {
          await recordAttempt(email, ip, false);
          return null;
        }

        await recordAttempt(email, ip, true);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          active: user.active,
          customerId: user.customer?.id,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name ?? undefined;
        token.mustChangePassword = user.mustChangePassword;
        token.customerId = user.customerId;
      }

      // NOTE: act-as-customer is intentionally NOT handled here. The
      // `trigger === "update"` branch was a privilege-escalation hole — any
      // authenticated user can call session.update() and would have been able
      // to set actingAsCustomerId for any customer. Impersonation is performed
      // exclusively by /api/auth/act-as, which gates SUPER_ADMIN and writes the
      // token cookie directly via encode(). Do not reintroduce update handling
      // for actingAsCustomerId without a SUPER_ADMIN check on the token role.

      // Self-heal a stale must-change-password flag. It's stamped into the JWT
      // at sign-in, but the password-change actions only clear it in the DB —
      // and session.update() is deliberately not handled (see above), so
      // without this re-check the token nags "update your password" (and
      // blocks cart/dealer pricing) for the session's whole life. DB is the
      // trusted source; only ever flips true→false.
      // Re-read the authorization-bearing fields. role and active are stamped
      // at sign-in and the cookie lives for 12h, so without this a deactivated
      // or demoted user kept their old access until it expired — including a
      // fired admin still able to delete products. The DB is the trusted
      // source; mustChangePassword only ever flips true→false.
      //
      // The jwt callback runs on every request, so the check is throttled to
      // once per REVALIDATE_MS rather than adding a query to every page load.
      // A stale flag is re-read immediately, since that one blocks the user.
      const lastChecked = Number(token.checkedAt ?? 0);
      const isDue = Date.now() - lastChecked > REVALIDATE_MS;

      if (!user && token.id && (isDue || token.mustChangePassword)) {
        const fresh = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: { mustChangePassword: true, active: true, role: true },
        });

        // Deactivated or deleted: drop the session entirely.
        if (!fresh || !fresh.active) return null;

        token.role = fresh.role;
        token.checkedAt = Date.now();

        if (token.mustChangePassword && !fresh.mustChangePassword) {
          token.mustChangePassword = false;
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.id && token.role) {
        session.user.id = String(token.id);
        session.user.role = token.role as "SUPER_ADMIN" | "STAFF" | "CUSTOMER";
        session.user.name = String(token.name ?? "");
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.customerId = token.customerId as string | undefined;
        session.user.actingAsCustomerId = token.actingAsCustomerId as string | undefined;
      }

      return session;
    },
    redirect: async ({ url, baseUrl }) => {
      if (url.startsWith("/")) {
        return `${baseUrl}${sanitizeRedirectPath(url, "/auth/login")}`;
      }

      try {
        const parsed = new URL(url);

        if (parsed.origin === baseUrl) {
          return `${baseUrl}${sanitizeRedirectPath(`${parsed.pathname}${parsed.search}${parsed.hash}`, "/auth/login")}`;
        }
      } catch {
        return `${baseUrl}/auth/login`;
      }

      return `${baseUrl}/auth/login`;
    },
  },
});

export { getPostLoginRedirect };
