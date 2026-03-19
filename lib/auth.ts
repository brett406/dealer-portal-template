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
    jwt: async ({ token, user, trigger, session: updateData }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name ?? undefined;
        token.mustChangePassword = user.mustChangePassword;
        token.customerId = user.customerId;
      }

      // Handle session updates (e.g., act-as-customer)
      if (trigger === "update" && updateData) {
        if ("actingAsCustomerId" in updateData) {
          token.actingAsCustomerId = updateData.actingAsCustomerId ?? undefined;
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
