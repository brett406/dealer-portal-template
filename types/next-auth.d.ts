import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "SUPER_ADMIN" | "STAFF" | "CUSTOMER";
      name: string;
      mustChangePassword: boolean;
      customerId?: string;
      actingAsCustomerId?: string;
    };
  }

  interface User {
    id: string;
    role: "SUPER_ADMIN" | "STAFF" | "CUSTOMER";
    name: string;
    mustChangePassword: boolean;
    active?: boolean;
    customerId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "SUPER_ADMIN" | "STAFF" | "CUSTOMER";
    name?: string;
    mustChangePassword?: boolean;
    customerId?: string;
    actingAsCustomerId?: string;
  }
}
