import { describe, it, expect } from "vitest";
import {
  esc,
  contactFormTemplate,
  dealerApplicationTemplate,
  orderConfirmationTemplate,
  type OrderLineItem,
} from "@/lib/email-templates";

const PAYLOAD = `</div><a href="https://evil.test/login">Reset your password</a><div>`;

function lineItem(overrides: Partial<OrderLineItem> = {}): OrderLineItem {
  return {
    productName: "Gate",
    variantName: "10ft",
    sku: "G-10",
    uomName: "Each",
    uomConversion: 1,
    quantity: 1,
    unitPrice: "$100.00",
    lineTotal: "$100.00",
    ...overrides,
  };
}

describe("esc", () => {
  it("escapes the characters that let text become markup", () => {
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  it("returns an empty string for null and undefined", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

// These emails are sent by the portal, to the portal's own admins, and carry
// the customer's branding — so injected markup reads as legitimate.
describe("email templates escape untrusted input", () => {
  it("neutralizes markup in a contact-form message", () => {
    const html = contactFormTemplate({
      name: "Visitor",
      email: "visitor@test.com",
      message: PAYLOAD,
    });

    expect(html).not.toContain("evil.test/login</a>");
    expect(html).not.toContain(`<a href="https://evil.test/login">`);
    expect(html).toContain("&lt;a href=&quot;https://evil.test/login&quot;&gt;");
  });

  it("neutralizes markup in a contact-form name", () => {
    const html = contactFormTemplate({
      name: PAYLOAD,
      email: "visitor@test.com",
      message: "hello",
    });

    expect(html).not.toContain(`<a href="https://evil.test/login">`);
  });

  it("neutralizes markup in dealer-application notes", () => {
    const html = dealerApplicationTemplate({
      contactName: "Applicant",
      email: "a@test.com",
      phone: "555",
      businessName: "Trailers Inc",
      businessType: "Dealer",
      province: "ON",
      carriesAgTools: "No",
      additionalNotes: PAYLOAD,
    });

    expect(html).not.toContain(`<a href="https://evil.test/login">`);
  });

  it("neutralizes markup in a dealer-supplied PO number and product name", () => {
    const html = orderConfirmationTemplate({
      customerName: "Dealer",
      orderNumber: "ORD-1",
      orderDate: "2026-07-28",
      companyName: "Trailers Inc",
      priceLevelName: "Dealer",
      items: [lineItem({ productName: PAYLOAD })],
      subtotal: "$100.00",
      shipping: "$0.00",
      total: "$100.00",
      poNumber: PAYLOAD,
      orderId: "o1",
    });

    expect(html).not.toContain(`<a href="https://evil.test/login">`);
  });

  it("still renders the template's own markup", () => {
    const html = contactFormTemplate({
      name: "Visitor",
      email: "visitor@test.com",
      message: "hello",
    });

    expect(html).toContain('<a href="mailto:visitor%40test.com"');
    expect(html).toContain("<strong>Name:</strong>");
  });
});
