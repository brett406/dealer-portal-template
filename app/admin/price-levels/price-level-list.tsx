"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deletePriceLevel, setDefaultPriceLevel } from "./actions";
import "./price-levels.css";

type PriceLevelRow = {
  id: string;
  name: string;
  discountPercent: number;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  companyCount: number;
};

export function PriceLevelList({ data }: { data: PriceLevelRow[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<PriceLevelRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(row: PriceLevelRow) {
    setError(null);
    startTransition(async () => {
      const result = await deletePriceLevel(row.id);
      if (result.error) {
        setError(result.error);
      }
      setDeleteTarget(null);
    });
  }

  function handleSetDefault(row: PriceLevelRow) {
    startTransition(async () => {
      const result = await setDefaultPriceLevel(row.id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  const columns: TableColumn<PriceLevelRow>[] = [
    { key: "name", label: "Name", sortable: true, render: (row) => (
      <span className="pl-name">
        {row.name}
        {row.isDefault && <span className="pl-badge-default">Default</span>}
      </span>
    )},
    { key: "discountPercent", label: "Discount", sortable: true, render: (row) => `${row.discountPercent}%` },
    { key: "description", label: "Description", render: (row) => row.description || "—" },
    { key: "companyCount", label: "Companies", sortable: true },
    { key: "sortOrder", label: "Sort Order", sortable: true },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="pl-actions">
          {!row.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetDefault(row)}
              disabled={isPending}
            >
              Set Default
            </Button>
          )}
          <Button variant="secondary" size="sm" href={`/admin/price-levels/${row.id}`}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => { setError(null); setDeleteTarget(row); }}
            disabled={row.companyCount > 0}
            title={row.companyCount > 0 ? "Cannot delete — companies are assigned" : undefined}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="pl-toolbar">
        <Button href="/admin/price-levels/new">New Price Level</Button>
      </div>

      {error && <div className="status-message status-error">{error}</div>}

      <Table columns={columns} data={data} emptyMessage="No price levels found." />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Price Level"
      >
        <p>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={isPending}
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
