"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { updateCompanyApproval } from "./actions";
import "./companies.css";

export function ApprovalBar({ companyId, status }: { companyId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  function handleApproval(newStatus: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      await updateCompanyApproval(companyId, newStatus);
    });
  }

  if (status === "PENDING") {
    return (
      <div className="co-approval-bar co-approval-pending">
        <span>This company is <strong>pending approval</strong>.</span>
        <Button size="sm" onClick={() => handleApproval("APPROVED")} disabled={isPending}>
          Approve
        </Button>
        <Button size="sm" variant="danger" onClick={() => handleApproval("REJECTED")} disabled={isPending}>
          Reject
        </Button>
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <div className="co-approval-bar co-approval-rejected">
        <span>This company has been <strong>rejected</strong>.</span>
        <Button size="sm" onClick={() => handleApproval("APPROVED")} disabled={isPending}>
          Approve
        </Button>
      </div>
    );
  }

  return (
    <div className="co-approval-bar co-approval-approved">
      <span>Approved</span>
    </div>
  );
}
