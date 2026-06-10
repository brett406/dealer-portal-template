/**
 * Read helpers for the materials admin surfaces. Plain server-side functions
 * (no "use server") — used by the server components and unit-testable directly.
 */

import { prisma } from "@/lib/prisma";

/**
 * Materials offered by the add-component picker (§13.2): archived materials
 * are excluded, and a sub-assembly can never pick itself (§15).
 */
export async function getMaterialPickerOptions(excludeMaterialId?: string) {
  return prisma.material.findMany({
    where: {
      archivedAt: null,
      ...(excludeMaterialId ? { id: { not: excludeMaterialId } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, kind: true },
  });
}

/** Labor rates offered by the add-labor picker (§13.2): archived rates excluded. */
export async function getLaborRatePickerOptions() {
  return prisma.laborRate.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, ratePerHour: true },
  });
}
