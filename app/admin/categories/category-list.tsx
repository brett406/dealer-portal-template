"use client";

import { useState, useTransition } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteCategory, toggleCategoryActive, toggleCategoryFeatured } from "./actions";
import "./categories.css";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
  productCount: number;
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

export function CategoryList({ data }: { data: CategoryRow[] }) {
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(row: CategoryRow) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCategory(row.id);
      if (result.error) {
        setError(result.error);
      }
      setDeleteTarget(null);
    });
  }

  function handleToggleActive(row: CategoryRow) {
    startTransition(async () => {
      const result = await toggleCategoryActive(row.id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  function handleToggleFeatured(row: CategoryRow) {
    startTransition(async () => {
      const result = await toggleCategoryFeatured(row.id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  const columns: TableColumn<CategoryRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row) => (
        <span className={`cat-name ${!row.active ? "cat-inactive" : ""}`}>
          {row.name}
          {!row.active && <span className="cat-badge-inactive">Inactive</span>}
        </span>
      ),
    },
    {
      key: "slug",
      label: "Slug",
      render: (row) => <code className="cat-slug">{row.slug}</code>,
    },
    {
      key: "description",
      label: "Description",
      render: (row) => (
        <span className={!row.active ? "cat-inactive" : ""}>
          {row.description ? truncate(row.description, 60) : "—"}
        </span>
      ),
    },
    {
      key: "featured",
      label: "Featured",
      render: (row) => (
        <button
          type="button"
          className={`cat-featured-toggle ${row.featured ? "cat-featured-on" : ""}`}
          onClick={() => handleToggleFeatured(row)}
          disabled={isPending}
          title={row.featured ? "Remove from homepage" : "Show on homepage"}
        >
          {row.featured ? "Yes" : "No"}
        </button>
      ),
    },
    { key: "productCount", label: "Products", sortable: true },
    { key: "sortOrder", label: "Sort Order", sortable: true },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="cat-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleActive(row)}
            disabled={isPending}
          >
            {row.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="secondary" size="sm" href={`/admin/categories/${row.id}`}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => { setError(null); setDeleteTarget(row); }}
            disabled={row.productCount > 0}
            title={row.productCount > 0 ? "Cannot delete — products are assigned" : undefined}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="cat-toolbar">
        <Button href="/admin/categories/new">New Category</Button>
      </div>

      {error && <div className="status-message status-error">{error}</div>}

      <Table columns={columns} data={data} emptyMessage="No categories found." />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Category"
      >
        <p>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot
          be undone.
        </p>
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
