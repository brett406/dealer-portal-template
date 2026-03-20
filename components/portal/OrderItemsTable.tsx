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
  {
    key: "unitPrice",
    label: "Unit Price",
    render: (row) => (
      <span>
        {formatPrice(row.unitPrice)}
        {row.unitPrice < row.baseRetailPriceSnapshot && (
          <span style={{ textDecoration: "line-through", color: "var(--color-text-muted)", marginLeft: "0.4rem", fontSize: "0.8rem" }}>
            {formatPrice(row.baseRetailPriceSnapshot)}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "lineTotal",
    label: "Total",
    render: (row) => <strong>{formatPrice(row.lineTotal)}</strong>,
  },
];

export function OrderItemsTable({ items }: { items: ItemRow[] }) {
  return <Table columns={itemColumns} data={items} />;
}
