"use client";

import { Table, type TableColumn } from "@/components/ui/Table";
import { formatPrice, type Currency } from "@/lib/pricing";

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

function makeItemColumns(currency: Currency): TableColumn<ItemRow>[] {
  return [
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
      render: (row) => formatPrice(row.unitPrice, currency),
    },
    {
      key: "baseRetailPriceSnapshot",
      label: "Retail",
      render: (row) => (
        <span style={{ color: "var(--color-text-muted)", textDecoration: "line-through" }}>
          {formatPrice(row.baseRetailPriceSnapshot, currency)}
        </span>
      ),
    },
    {
      key: "lineTotal",
      label: "Total",
      render: (row) => <strong>{formatPrice(row.lineTotal, currency)}</strong>,
    },
  ];
}

export function AdminOrderItemsTable({
  items,
  currency,
}: {
  items: ItemRow[];
  currency: Currency;
}) {
  return <Table columns={makeItemColumns(currency)} data={items} />;
}
