import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MaterialBasicForm } from "../material-basic-form";
import { MaterialBomSection } from "../material-bom-section";
import { MaterialDangerZone } from "../material-danger-zone";
import { getMaterialPickerOptions, getLaborRatePickerOptions } from "../queries";
import "../materials.css";

export const dynamic = "force-dynamic";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [material, categories, materialOptions, laborRateOptions] = await Promise.all([
    prisma.material.findUnique({
      where: { id },
      include: {
        components: {
          orderBy: { createdAt: "asc" },
          include: {
            material: {
              select: {
                id: true,
                name: true,
                kind: true,
                unit: true,
                archivedAt: true,
                unitCost: true,
                computedCost: true,
              },
            },
          },
        },
        laborLines: {
          orderBy: { createdAt: "asc" },
          include: {
            laborRate: { select: { id: true, name: true, ratePerHour: true, archivedAt: true } },
          },
        },
        usedIn: {
          include: {
            product: { select: { id: true, name: true } },
            productVariant: {
              select: { id: true, name: true, product: { select: { id: true, name: true } } },
            },
            parentMaterial: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getMaterialPickerOptions(id),
    getLaborRatePickerOptions(),
  ]);

  if (!material) notFound();

  const componentData = material.components.map((line) => ({
    id: line.id,
    materialId: line.material.id,
    name: line.material.name,
    kind: line.material.kind,
    unit: line.material.unit,
    archived: line.material.archivedAt !== null,
    uncosted: line.material.kind === "raw" && line.material.unitCost === null,
    // computedCost mirrors unitCost for raw (§3) but may lag until the next
    // reprice — prefer unitCost for raw display.
    unitCost:
      line.material.kind === "raw"
        ? line.material.unitCost !== null
          ? Number(line.material.unitCost)
          : null
        : line.material.computedCost !== null
          ? Number(line.material.computedCost)
          : null,
    quantity: Number(line.quantity),
    notes: line.notes,
  }));

  const laborData = material.laborLines.map((line) => ({
    id: line.id,
    laborRateId: line.laborRate.id,
    name: line.laborRate.name,
    ratePerHour: Number(line.laborRate.ratePerHour),
    archived: line.laborRate.archivedAt !== null,
    hours: Number(line.hours),
    notes: line.notes,
  }));

  const whereUsed = material.usedIn.map((line) => {
    if (line.product) {
      return {
        id: line.id,
        type: "Product" as const,
        name: line.product.name,
        href: `/admin/products/${line.product.id}`,
        quantity: Number(line.quantity),
      };
    }
    if (line.productVariant) {
      return {
        id: line.id,
        type: "Variant" as const,
        name: `${line.productVariant.product.name} — ${line.productVariant.name}`,
        href: `/admin/products/${line.productVariant.product.id}`,
        quantity: Number(line.quantity),
      };
    }
    return {
      id: line.id,
      type: "Sub-assembly" as const,
      name: line.parentMaterial?.name ?? "Unknown",
      href: line.parentMaterial ? `/admin/materials/${line.parentMaterial.id}` : "#",
      quantity: Number(line.quantity),
    };
  });

  return (
    <div>
      <h1>
        Edit Material
        {material.archivedAt !== null && (
          <span className="mat-badge mat-badge-archived" style={{ marginLeft: "0.6rem", verticalAlign: "middle" }}>
            Archived
          </span>
        )}
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        {material.name}
        {" · "}
        <Link href="/admin/materials" style={{ color: "var(--color-primary)" }}>
          Back to materials
        </Link>
      </p>

      <div className="mat-edit-section">
        <h2>Basic Information</h2>
        <MaterialBasicForm
          materialId={id}
          categories={categories}
          hasOwnBomLines={material.components.length + material.laborLines.length > 0}
          defaultValues={{
            name: material.name,
            sku: material.sku,
            unit: material.unit,
            kind: material.kind,
            unitCost: material.unitCost !== null ? Number(material.unitCost) : null,
            categoryId: material.categoryId,
          }}
          computedCost={material.computedCost !== null ? Number(material.computedCost) : null}
        />
      </div>

      {material.kind === "subassembly" && (
        <MaterialBomSection
          materialId={id}
          components={componentData}
          laborLines={laborData}
          materialOptions={materialOptions.map((m) => ({
            id: m.id,
            name: m.name,
            sku: m.sku,
            kind: m.kind,
          }))}
          laborRateOptions={laborRateOptions.map((r) => ({
            id: r.id,
            name: r.name,
            ratePerHour: Number(r.ratePerHour),
          }))}
        />
      )}

      <div className="mat-edit-section">
        <h2>Where Used</h2>
        {whereUsed.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Not used in any BOM.
          </p>
        ) : (
          <ul className="mat-where-used">
            {whereUsed.map((entry) => (
              <li key={entry.id}>
                <span className="mat-badge mat-badge-raw">{entry.type}</span>
                <Link href={entry.href}>{entry.name}</Link>
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                  qty {entry.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MaterialDangerZone
        materialId={id}
        materialName={material.name}
        archived={material.archivedAt !== null}
        usedInCount={material.usedIn.length}
      />
    </div>
  );
}
