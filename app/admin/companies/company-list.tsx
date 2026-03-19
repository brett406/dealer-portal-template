"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteCompany, toggleCompanyActive } from "./actions";
import "./companies.css";

type CompanyRow = {
  id: string;
  name: string;
  priceLevelName: string;
  contactCount: number;
  orderCount: number;
  approvalStatus: string;
  active: boolean;
};

type PriceLevel = { id: string; name: string };

const approvalBadge: Record<string, string> = {
  APPROVED: "co-badge co-badge-approved",
  PENDING: "co-badge co-badge-pending",
  REJECTED: "co-badge co-badge-rejected",
};

export function CompanyList({
  data,
  priceLevels,
  filters,
}: {
  data: CompanyRow[];
  priceLevels: PriceLevel[];
  filters: { priceLevel?: string; approval?: string; active?: string; q?: string };
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<CompanyRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    return `/admin/companies${qs ? `?${qs}` : ""}`;
  }

  function handleFilter(key: string, value: string) {
    router.push(buildUrl({ ...filters, [key]: value || undefined }));
  }

  function handleDelete(row: CompanyRow) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCompany(row.id);
      if (result.error) setError(result.error);
      setDeleteTarget(null);
    });
  }

  function handleToggle(row: CompanyRow) {
    startTransition(async () => {
      const result = await toggleCompanyActive(row.id);
      if (result.error) setError(result.error);
    });
  }

  const columns: TableColumn<CompanyRow>[] = [
    {
      key: "name",
      label: "Company",
      sortable: true,
      render: (row) => (
        <span className={`co-name-cell ${!row.active ? "co-inactive" : ""}`}>
          {row.name}
          {!row.active && <span className="co-badge co-badge-inactive" style={{ marginLeft: "0.4rem" }}>Inactive</span>}
        </span>
      ),
    },
    { key: "priceLevelName", label: "Price Level", sortable: true },
    { key: "contactCount", label: "Contacts", sortable: true },
    { key: "orderCount", label: "Orders", sortable: true },
    {
      key: "approvalStatus",
      label: "Status",
      sortable: true,
      render: (row) => <span className={approvalBadge[row.approvalStatus]}>{row.approvalStatus}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="co-actions">
          <Button variant="ghost" size="sm" onClick={() => handleToggle(row)} disabled={isPending}>
            {row.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="secondary" size="sm" href={`/admin/companies/${row.id}`}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => { setError(null); setDeleteTarget(row); }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="co-toolbar">
        <div className="co-filters">
          <input
            type="search"
            aria-label="Search companies"
            placeholder="Search company name..."
            defaultValue={filters.q}
            onChange={(e) => handleFilter("q", e.target.value)}
          />
          <select aria-label="Filter by price level" defaultValue={filters.priceLevel ?? ""} onChange={(e) => handleFilter("priceLevel", e.target.value)}>
            <option value="">All Price Levels</option>
            {priceLevels.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
          </select>
          <select aria-label="Filter by approval status" defaultValue={filters.approval ?? ""} onChange={(e) => handleFilter("approval", e.target.value)}>
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select aria-label="Filter by active status" defaultValue={filters.active ?? ""} onChange={(e) => handleFilter("active", e.target.value)}>
            <option value="">Active & Inactive</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <Button href="/admin/companies/new">New Company</Button>
      </div>

      {error && <div className="status-message status-error">{error}</div>}

      <Table columns={columns} data={data} emptyMessage="No companies found." />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Company">
        <p>Delete <strong>{deleteTarget?.name}</strong>? This will also delete all contacts and addresses.</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </>
  );
}
