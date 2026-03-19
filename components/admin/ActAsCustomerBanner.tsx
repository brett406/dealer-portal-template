"use client";

import "./act-as-customer-banner.css";

export function ActAsCustomerBanner({
  companyName,
  customerName,
}: {
  companyName: string;
  customerName?: string;
}) {
  async function handleExit() {
    const res = await fetch("/api/auth/exit-acting-as", { method: "POST" });
    if (res.ok) {
      window.location.href = "/admin";
    }
  }

  return (
    <div className="act-as-banner">
      <div className="container act-as-banner-inner">
        <span>
          You are viewing the portal as{" "}
          {customerName && <strong>{customerName}</strong>}
          {customerName && " from "}
          <strong>{companyName}</strong>
        </span>
        <button type="button" onClick={handleExit} className="act-as-banner-exit" aria-label="Exit customer impersonation">
          Exit
        </button>
      </div>
    </div>
  );
}
