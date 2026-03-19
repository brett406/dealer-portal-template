import { vi } from "vitest";

interface CapturedEmail {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export function mockResend() {
  const sent: CapturedEmail[] = [];

  const mock = {
    emails: {
      send: vi.fn(async (params: CapturedEmail) => {
        sent.push(params);
        return { data: { id: `mock-email-${sent.length}` }, error: null };
      }),
    },
  };

  return { resend: mock, sent };
}

interface SessionOverrides {
  userId?: string;
  email?: string;
  role?: string;
  name?: string;
  actingAsCustomerId?: string;
}

export function mockSession(overrides: SessionOverrides = {}) {
  return {
    user: {
      id: overrides.userId ?? "test-user-id",
      email: overrides.email ?? "user@example.com",
      role: overrides.role ?? "CUSTOMER",
      name: overrides.name ?? "Test User",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function mockAdminActingAs(customerId: string) {
  return mockSession({
    userId: "admin-user-id",
    email: "admin@example.com",
    role: "ADMIN",
    name: "Admin User",
    actingAsCustomerId: customerId,
  });
}
