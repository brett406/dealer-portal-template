"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";
import { repriceAll } from "@/lib/bom/reprice";
import {
  validateBomGraph,
  SAVE_MAX_DEPTH,
  type EngineMaterial,
} from "@/lib/bom/cost";

export type FormState = {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function materialPath(id: string) {
  return `/admin/materials/${id}`;
}

function extractErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}

function revalidateMaterial(id: string) {
  revalidatePath("/admin/materials");
  revalidatePath(materialPath(id));
}

/**
 * Save-time cycle/depth gate (§4.5, §13.4): build the would-be material graph
 * including the proposed parent→child edge and run the frozen engine's
 * validateBomGraph. Returns a user-facing error message, or null when OK.
 */
async function validateGraphWithNewEdge(
  parentMaterialId: string,
  childMaterialId: string,
): Promise<string | null> {
  const rows = await prisma.material.findMany({
    select: {
      id: true,
      name: true,
      kind: true,
      components: { select: { materialId: true } },
    },
  });
  const nameById = new Map(rows.map((r) => [r.id, r.name]));

  const graph: EngineMaterial[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    components: [
      ...r.components.map((c) => ({ materialId: c.materialId, quantity: "1" })),
      ...(r.id === parentMaterialId
        ? [{ materialId: childMaterialId, quantity: "1" }]
        : []),
    ],
  }));

  const check = validateBomGraph(graph);
  if (check.cycle) {
    const path = check.cycle.map((id) => nameById.get(id) ?? id).join(" → ");
    return `This would create a cycle: ${path}`;
  }
  if (check.maxDepth > SAVE_MAX_DEPTH) {
    return `This would make a BOM chain ${check.maxDepth} levels deep — the maximum is ${SAVE_MAX_DEPTH}`;
  }
  return null;
}

// ─── Schemas (§15) ───────────────────────────────────────────────────────────

const materialSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or less"),
  sku: z
    .union([z.string().max(50, "SKU must be 50 characters or less"), z.null()])
    .optional()
    .transform((v) => (v ? v.trim() || undefined : undefined)),
  unit: z.string().min(1, "Unit is required").max(20, "Unit must be 20 characters or less"),
  kind: z.enum(["raw", "subassembly"]),
  unitCost: z
    .union([
      z.literal("").transform(() => null),
      z.literal(null).transform(() => null),
      z.coerce
        .number()
        .min(0, "Unit cost must be 0 or greater")
        .max(99_999_999.9999, "Unit cost cannot exceed 99,999,999.9999"),
    ])
    .optional()
    .default(null),
  categoryId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => v || undefined),
});

const componentLineSchema = z.object({
  materialId: z.string().min(1, "Choose a material"),
  quantity: z.coerce
    .number()
    .gt(0, "Quantity must be greater than 0")
    .max(99_999_999.9999, "Quantity cannot exceed 99,999,999.9999"),
  notes: z
    .union([z.string().max(500, "Notes must be 500 characters or less"), z.null()])
    .optional()
    .transform((v) => v || undefined),
});

const laborLineSchema = z.object({
  laborRateId: z.string().min(1, "Choose a labor rate"),
  hours: z.coerce
    .number()
    .gt(0, "Hours must be greater than 0")
    .max(99_999_999.99, "Hours cannot exceed 99,999,999.99"),
  notes: z
    .union([z.string().max(500, "Notes must be 500 characters or less"), z.null()])
    .optional()
    .transform((v) => v || undefined),
});

function parseMaterialForm(formData: FormData) {
  return materialSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    unit: formData.get("unit") || "each",
    kind: formData.get("kind"),
    unitCost: formData.get("unitCost"),
    categoryId: formData.get("categoryId"),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Material CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export async function createMaterial(formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = parseMaterialForm(formData);
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  if (parsed.data.sku) {
    const existing = await prisma.material.findUnique({ where: { sku: parsed.data.sku } });
    if (existing) return { errors: { sku: "A material with this SKU already exists" } };
  }

  const material = await prisma.material.create({
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      unit: parsed.data.unit,
      kind: parsed.data.kind,
      // 4dp string keeps the stored Decimal(12,4) scale-exact (§15).
      unitCost: parsed.data.unitCost !== null ? parsed.data.unitCost.toFixed(4) : null,
      categoryId: parsed.data.categoryId ?? null,
    },
  });

  await logAudit({
    action: "MATERIAL_CREATE",
    userId: user.id,
    targetId: material.id,
    targetType: "Material",
    details: {
      name: material.name,
      kind: material.kind,
      unitCost: material.unitCost?.toFixed(4) ?? null,
    },
  });

  revalidatePath("/admin/materials");
  redirect(materialPath(material.id));
}

export async function updateMaterial(id: string, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = parseMaterialForm(formData);
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const material = await prisma.material.findUnique({
    where: { id },
    include: { _count: { select: { components: true, laborLines: true } } },
  });
  if (!material) return { error: "Material not found" };

  if (parsed.data.sku) {
    const duplicate = await prisma.material.findFirst({
      where: { sku: parsed.data.sku, NOT: { id } },
    });
    if (duplicate) return { errors: { sku: "A material with this SKU already exists" } };
  }

  // Kind-change rules (§13.3): raw→subassembly always allowed;
  // subassembly→raw only when it has no own component/labor lines.
  const ownLineCount = material._count.components + material._count.laborLines;
  if (material.kind === "subassembly" && parsed.data.kind === "raw" && ownLineCount > 0) {
    return {
      errors: {
        kind: "This sub-assembly still has its own BOM — remove its components first",
      },
    };
  }

  const prevCost = material.unitCost?.toFixed(4) ?? null;
  const nextCost = parsed.data.unitCost !== null ? parsed.data.unitCost.toFixed(4) : null;
  const unitCostChanged = prevCost !== nextCost;
  const kindChanged = material.kind !== parsed.data.kind;

  await prisma.material.update({
    where: { id },
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      unit: parsed.data.unit,
      kind: parsed.data.kind,
      unitCost: nextCost,
      categoryId: parsed.data.categoryId ?? null,
    },
  });

  await logAudit({
    action: "MATERIAL_UPDATE",
    userId: user.id,
    targetId: id,
    targetType: "Material",
    details: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      ...(kindChanged ? { kindBefore: material.kind } : {}),
      ...(unitCostChanged ? { unitCostBefore: prevCost, unitCostAfter: nextCost } : {}),
    },
  });

  // unitCost edits are cost-affecting (§5); a kind change alters how the
  // material is costed (entered vs computed) so it reprices too (§13.3).
  if (unitCostChanged || kindChanged) {
    await repriceAll({ trigger: "MATERIAL_COST_UPDATE", userId: user.id, materialId: id });
  }

  revalidateMaterial(id);
  return { success: true };
}

/**
 * Archive/unarchive (§13.2): an archived material still costs normally in
 * existing BOMs — it is only excluded from the add-component pickers.
 */
export async function toggleMaterialArchived(id: string): Promise<FormState> {
  const user = await requireAdmin();

  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return { error: "Material not found" };

  const archiving = material.archivedAt === null;
  await prisma.material.update({
    where: { id },
    data: { archivedAt: archiving ? new Date() : null },
  });

  await logAudit({
    action: "MATERIAL_ARCHIVE",
    userId: user.id,
    targetId: id,
    targetType: "Material",
    details: { name: material.name, archived: archiving },
  });

  revalidateMaterial(id);
  return {};
}

export async function deleteMaterial(id: string): Promise<FormState> {
  await requireAdmin();

  const material = await prisma.material.findUnique({
    where: { id },
    include: { _count: { select: { usedIn: true } } },
  });
  if (!material) return { error: "Material not found" };

  if (material._count.usedIn > 0) {
    return {
      error: `Cannot delete — in use by ${material._count.usedIn} BOM line${material._count.usedIn === 1 ? "" : "s"} — archive instead.`,
    };
  }

  try {
    // Its OWN component/labor lines cascade; usedIn references Restrict.
    await prisma.material.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      const count = await prisma.bomComponent.count({ where: { materialId: id } });
      return {
        error: `Cannot delete — in use by ${count} BOM line${count === 1 ? "" : "s"} — archive instead.`,
      };
    }
    throw err;
  }

  revalidatePath("/admin/materials");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-assembly BOM editor — component lines (parent = material)
// ═══════════════════════════════════════════════════════════════════════════════

export async function addMaterialComponent(
  parentMaterialId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = componentLineSchema.safeParse({
    materialId: formData.get("materialId"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const parent = await prisma.material.findUnique({ where: { id: parentMaterialId } });
  if (!parent) return { error: "Material not found" };
  if (parent.kind !== "subassembly") {
    return { error: "Only sub-assemblies have their own BOM" };
  }

  // Degenerate cycle — reject cheaply before the DFS (§15).
  if (parsed.data.materialId === parentMaterialId) {
    return { errors: { materialId: "A sub-assembly cannot contain itself" } };
  }

  const child = await prisma.material.findUnique({ where: { id: parsed.data.materialId } });
  if (!child) return { errors: { materialId: "Material not found" } };
  if (child.archivedAt !== null) {
    return { errors: { materialId: `"${child.name}" is archived — unarchive it to add it to a BOM` } };
  }

  const duplicate = await prisma.bomComponent.findFirst({
    where: { parentMaterialId, materialId: parsed.data.materialId },
  });
  if (duplicate) {
    return {
      errors: { materialId: `"${child.name}" is already on this BOM — edit its quantity instead` },
    };
  }

  // Cycle/depth gate at save (§4.5, §13.4) through the frozen engine.
  const graphError = await validateGraphWithNewEdge(parentMaterialId, parsed.data.materialId);
  if (graphError) return { errors: { materialId: graphError } };

  const line = await prisma.bomComponent.create({
    data: {
      parentMaterialId,
      materialId: parsed.data.materialId,
      quantity: parsed.data.quantity.toFixed(4),
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: parentMaterialId,
    targetType: "Material",
    details: {
      op: "addComponent",
      lineId: line.id,
      materialId: parsed.data.materialId,
      materialName: child.name,
      quantity: parsed.data.quantity.toFixed(4),
    },
  });

  await repriceAll({ trigger: "BOM_UPDATE", userId: user.id });
  revalidateMaterial(parentMaterialId);
  return { success: true };
}

export async function updateMaterialComponent(
  lineId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = componentLineSchema
    .omit({ materialId: true })
    .safeParse({ quantity: formData.get("quantity"), notes: formData.get("notes") });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const line = await prisma.bomComponent.findUnique({
    where: { id: lineId },
    include: { material: { select: { name: true } } },
  });
  if (!line || line.parentMaterialId === null) return { error: "BOM line not found" };

  await prisma.bomComponent.update({
    where: { id: lineId },
    data: { quantity: parsed.data.quantity.toFixed(4), notes: parsed.data.notes ?? null },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.parentMaterialId,
    targetType: "Material",
    details: {
      op: "updateComponent",
      lineId,
      materialName: line.material.name,
      quantityBefore: line.quantity.toFixed(4),
      quantityAfter: parsed.data.quantity.toFixed(4),
    },
  });

  await repriceAll({ trigger: "BOM_UPDATE", userId: user.id });
  revalidateMaterial(line.parentMaterialId);
  return { success: true };
}

export async function removeMaterialComponent(lineId: string): Promise<FormState> {
  const user = await requireAdmin();

  const line = await prisma.bomComponent.findUnique({
    where: { id: lineId },
    include: { material: { select: { name: true } } },
  });
  if (!line || line.parentMaterialId === null) return { error: "BOM line not found" };

  await prisma.bomComponent.delete({ where: { id: lineId } });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.parentMaterialId,
    targetType: "Material",
    details: {
      op: "removeComponent",
      lineId,
      materialName: line.material.name,
      quantity: line.quantity.toFixed(4),
    },
  });

  await repriceAll({ trigger: "BOM_UPDATE", userId: user.id });
  revalidateMaterial(line.parentMaterialId);
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-assembly BOM editor — labor lines (parent = material)
// ═══════════════════════════════════════════════════════════════════════════════

export async function addMaterialLaborLine(
  parentMaterialId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = laborLineSchema.safeParse({
    laborRateId: formData.get("laborRateId"),
    hours: formData.get("hours"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const parent = await prisma.material.findUnique({ where: { id: parentMaterialId } });
  if (!parent) return { error: "Material not found" };
  if (parent.kind !== "subassembly") {
    return { error: "Only sub-assemblies have their own BOM" };
  }

  const rate = await prisma.laborRate.findUnique({ where: { id: parsed.data.laborRateId } });
  if (!rate) return { errors: { laborRateId: "Labor rate not found" } };
  if (rate.archivedAt !== null) {
    return { errors: { laborRateId: `"${rate.name}" is archived — unarchive it to add it to a BOM` } };
  }

  const duplicate = await prisma.bomLaborLine.findFirst({
    where: { parentMaterialId, laborRateId: parsed.data.laborRateId },
  });
  if (duplicate) {
    return {
      errors: { laborRateId: `"${rate.name}" is already on this BOM — edit its hours instead` },
    };
  }

  const line = await prisma.bomLaborLine.create({
    data: {
      parentMaterialId,
      laborRateId: parsed.data.laborRateId,
      hours: parsed.data.hours.toFixed(2),
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: parentMaterialId,
    targetType: "Material",
    details: {
      op: "addLabor",
      lineId: line.id,
      laborRateId: parsed.data.laborRateId,
      laborRateName: rate.name,
      hours: parsed.data.hours.toFixed(2),
    },
  });

  await repriceAll({ trigger: "BOM_UPDATE", userId: user.id });
  revalidateMaterial(parentMaterialId);
  return { success: true };
}

export async function updateMaterialLaborLine(
  lineId: string,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = laborLineSchema
    .omit({ laborRateId: true })
    .safeParse({ hours: formData.get("hours"), notes: formData.get("notes") });
  if (!parsed.success) return { errors: extractErrors(parsed.error) };

  const line = await prisma.bomLaborLine.findUnique({
    where: { id: lineId },
    include: { laborRate: { select: { name: true } } },
  });
  if (!line || line.parentMaterialId === null) return { error: "BOM line not found" };

  await prisma.bomLaborLine.update({
    where: { id: lineId },
    data: { hours: parsed.data.hours.toFixed(2), notes: parsed.data.notes ?? null },
  });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.parentMaterialId,
    targetType: "Material",
    details: {
      op: "updateLabor",
      lineId,
      laborRateName: line.laborRate.name,
      hoursBefore: line.hours.toFixed(2),
      hoursAfter: parsed.data.hours.toFixed(2),
    },
  });

  await repriceAll({ trigger: "BOM_UPDATE", userId: user.id });
  revalidateMaterial(line.parentMaterialId);
  return { success: true };
}

export async function removeMaterialLaborLine(lineId: string): Promise<FormState> {
  const user = await requireAdmin();

  const line = await prisma.bomLaborLine.findUnique({
    where: { id: lineId },
    include: { laborRate: { select: { name: true } } },
  });
  if (!line || line.parentMaterialId === null) return { error: "BOM line not found" };

  await prisma.bomLaborLine.delete({ where: { id: lineId } });

  await logAudit({
    action: "BOM_UPDATE",
    userId: user.id,
    targetId: line.parentMaterialId,
    targetType: "Material",
    details: {
      op: "removeLabor",
      lineId,
      laborRateName: line.laborRate.name,
      hours: line.hours.toFixed(2),
    },
  });

  await repriceAll({ trigger: "BOM_UPDATE", userId: user.id });
  revalidateMaterial(line.parentMaterialId);
  return {};
}
