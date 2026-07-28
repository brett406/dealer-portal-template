import { describe, it, expect } from "vitest";
import { accountStandingError } from "@/lib/orders";

// A dealer who has been terminated or is still awaiting approval must not be
// able to transact. The portal layout checks this too, but server actions are
// independent POST endpoints that never render a layout — so the check has to
// live where the order is actually created.
describe("accountStandingError", () => {
  it("allows an active customer at an approved, active company", () => {
    expect(accountStandingError(true, true, "APPROVED")).toBeNull();
  });

  it("blocks a deactivated customer", () => {
    expect(accountStandingError(false, true, "APPROVED")).toMatch(/no longer active/i);
  });

  it("blocks a deactivated company", () => {
    expect(accountStandingError(true, false, "APPROVED")).toMatch(/no longer active/i);
  });

  it("blocks a company still pending approval", () => {
    expect(accountStandingError(true, true, "PENDING")).toMatch(/pending approval/i);
  });

  it("blocks a rejected company", () => {
    expect(accountStandingError(true, true, "REJECTED")).toMatch(/pending approval/i);
  });
});
