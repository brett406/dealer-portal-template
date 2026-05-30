import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { getUploadsDir } from "@/lib/uploads";
import { checkDatabaseAvailable } from "@/tests/helpers/integration";

let mockSession: Session | null = null;
vi.mock("@/lib/auth", () => ({ auth: vi.fn(() => Promise.resolve(mockSession)) }));

const { GET } = await import("@/app/api/uploads/[filename]/route");

function authedSession(): Session {
  return {
    user: { id: "u1", email: "a@b.c", name: "User", role: "CUSTOMER", mustChangePassword: false },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

function req(filename: string, qs = "") {
  return new NextRequest(`http://localhost/api/uploads/${filename}${qs}`);
}

const TEST_FILE = "test-serving-route.txt";
let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDatabaseAvailable();
});

afterEach(async () => {
  await fs.unlink(path.join(getUploadsDir(), TEST_FILE)).catch(() => {});
});

describe("GET /api/uploads/[filename] — auth gate", () => {
  it("returns 401 for an anonymous request", async () => {
    mockSession = null;
    const res = await GET(req(TEST_FILE), { params: Promise.resolve({ filename: TEST_FILE }) });
    expect(res.status).toBe(401);
  });

  it("returns 200 + private cache + attachment for an authenticated request", async (ctx) => {
    if (!dbAvailable) ctx.skip();
    mockSession = authedSession();

    const dir = getUploadsDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, TEST_FILE), "hello dealer");

    const res = await GET(req(TEST_FILE, "?download=1"), {
      params: Promise.resolve({ filename: TEST_FILE }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(await res.text()).toBe("hello dealer");
  });

  it("rejects path traversal with 400", async () => {
    mockSession = authedSession();
    const res = await GET(req("..%2f..%2fetc%2fpasswd"), {
      params: Promise.resolve({ filename: "..%2f..%2fetc%2fpasswd" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an authenticated request to a missing file", async (ctx) => {
    if (!dbAvailable) ctx.skip();
    mockSession = authedSession();
    const res = await GET(req("does-not-exist.pdf"), {
      params: Promise.resolve({ filename: "does-not-exist.pdf" }),
    });
    expect(res.status).toBe(404);
  });
});
