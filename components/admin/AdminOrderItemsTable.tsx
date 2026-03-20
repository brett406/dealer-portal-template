"use client";

import { Table, type TableColumn } from "@/components/ui/Table";
import { formatPrice } from "@/lib/pricing";

type ItemRow = {
  id: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  uomNameSnapshot: string;
  uomConversionSnapshot: number;
  quantity: number;
  baseUnitQuantity: number;
  unitPrice: number;
  baseRetailPriceSnapshot: number;
  lineTotal: number;
};

const itemColumns: TableColumn<ItemRow>[] = [
  { key: "productNameSnapshot", label: "Product" },
  { key: "variantNameSnapshot", label: "Variant" },
  { key: "skuSnapshot", label: "SKU" },
  {
    key: "uomNameSnapshot",
    label: "UOM",
    render: (row) =>
      row.uomConversionSnapshot > 1
        ? `${row.uomNameSnapshot} of ${row.uomConversionSnapshot}`
        : row.uomNameSnapshot,
  },
  { key: "quantity", label: "Qty" },
  { key: "baseUnitQuantity", label: "Base Units" },
  {
    key: "unitPrice",
    label: "Unit Price",
    render: (row) => formatPrice(row.unitPrice),
  },
  {
    key: "baseRetailPriceSnapshot",
    label: "Retail",
    render: (row) => (
      <span style={{ color: "var(--color-text-muted)", textDecoration: "line-through" }}>
        {formatPrice(row.baseRetailPriceSnapshot)}
      </span>
    ),
  },
  {
    key: "lineTotal",
    label: "Total",
    render: (row) => <strong>{formatPrice(row.lineTotal)}</strong>,
  },
];

export function AdminOrderItemsTable({ items }: { items: ItemRow[] }) {
  return <Table columns={itemColumns} data={items} />;
}
